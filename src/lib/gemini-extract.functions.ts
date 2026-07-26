import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ExtractionResponseT } from "./extraction-types";

const Input = z.object({
  garment_type_id: z.string().uuid(),
  audio_base64: z.string().min(1).max(8_000_000), // ~6MB base64 max
  mime_type: z.string().default("audio/webm"),
});

export const extractMeasurements = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }): Promise<ExtractionResponseT> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { ok: false, reason: "server_error", message: "AI service not configured" };
    }

    // Load field schema for this garment type using a server-side publishable client.
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: fields, error: fieldsErr } = await supabase
      .from("garment_fields")
      .select("field_key, field_label, unit, is_notes, min_value, max_value")
      .eq("garment_type_id", data.garment_type_id)
      .order("display_order");

    if (fieldsErr || !fields || fields.length === 0) {
      return { ok: false, reason: "no_fields", message: "Garment type not configured" };
    }

    const numericKeys = fields.filter((f) => !f.is_notes).map((f) => f.field_key);
    const hasNotes = fields.some((f) => f.is_notes);
    const fieldList = fields
      .map((f) => `  - ${f.field_key}${f.unit ? ` (${f.unit})` : ""}: ${f.field_label}${f.is_notes ? " — free text" : ""}`)
      .join("\n");

    const schemaKeys = fields.map((f) => f.field_key);
    const prompt = `You are transcribing and extracting information from a voice note recorded by a tailor in Karachi, Pakistan. The speaker may talk in Roman Urdu, Urdu, English, or a mix of these, in a casual, conversational tone. Listen to the audio and extract values for the following fields:
${fieldList}

Measurements are typically given in inches as whole or half numbers. Return ONLY a valid JSON object with one key per field. For each numeric field, include a sibling confidence key (e.g. chest_confidence) with value "high" or "low" — mark "low" if the number was unclear, mumbled, or you are inferring rather than clearly hearing it. If a field was not mentioned at all, return null for that field and omit its confidence key.${hasNotes ? ' Put any descriptive or non-numeric instructions (e.g. style notes, fabric notes) into the "notes" field as clean, readable text.' : ""} Do not include any text outside the JSON object — no preamble, no explanation, no markdown formatting.

Valid field keys: ${schemaKeys.join(", ")}.`;

    // Call Gemini REST API with a 15s timeout.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let raw: string;
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: data.mime_type, data: data.audio_base64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          }),
        }
      );
      clearTimeout(timer);
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error("Gemini error", resp.status, errText);
        return { ok: false, reason: "server_error", message: `AI service returned ${resp.status}` };
      }
      const json = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: false, reason: "timeout" };
      }
      console.error("Gemini fetch failed", err);
      return { ok: false, reason: "server_error", message: "Could not reach AI service" };
    }

    if (!raw || raw.trim().length === 0) {
      return { ok: false, reason: "empty" };
    }

    let parsed: Record<string, unknown>;
    try {
      // Strip potential markdown fences just in case.
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return { ok: false, reason: "malformed" };
    }

    const outFields: Record<string, { value: string | number | null; confidence: "high" | "low" | null }> = {};
    let anyValue = false;
    for (const f of fields) {
      const rawVal = parsed[f.field_key];
      if (rawVal === undefined || rawVal === null || rawVal === "") {
        outFields[f.field_key] = { value: null, confidence: null };
        continue;
      }
      if (f.is_notes) {
        outFields[f.field_key] = { value: String(rawVal), confidence: null };
        anyValue = true;
        continue;
      }
      // Numeric field: coerce and clamp
      const num = typeof rawVal === "number" ? rawVal : Number(String(rawVal).replace(/[^\d.]/g, ""));
      if (!Number.isFinite(num)) {
        outFields[f.field_key] = { value: null, confidence: null };
        continue;
      }
      const confRaw = parsed[`${f.field_key}_confidence`];
      const confidence = confRaw === "high" || confRaw === "low" ? confRaw : null;
      outFields[f.field_key] = { value: num, confidence };
      anyValue = true;
    }

    if (!anyValue) {
      return { ok: false, reason: "empty" };
    }

    // Mark any numeric field with no confidence marker as "low" so tailor verifies
    for (const key of numericKeys) {
      const f = outFields[key];
      if (f.value !== null && f.confidence === null) f.confidence = "low";
    }

    return { ok: true, result: { fields: outFields } };
  });
