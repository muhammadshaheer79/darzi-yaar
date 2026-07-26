import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mic, Square, ArrowRight, AlertTriangle, RotateCcw, Keyboard, Loader2, Check } from "lucide-react";
import { garmentTypesQuery, type GarmentType, type GarmentField } from "@/lib/queries";
import { extractMeasurements } from "@/lib/gemini-extract.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { ExtractionResultT } from "@/lib/extraction-types";

export const Route = createFileRoute("/_authenticated/job-cards/new")({
  head: () => ({
    meta: [
      { title: "New Job Card — DarziYaar" },
      { name: "description", content: "Record a voice note and create a new job card." },
    ],
  }),
  component: NewJobCard,
});

type Step = "setup" | "record" | "processing" | "confirm";

function NewJobCard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: garmentTypes } = useQuery(garmentTypesQuery);
  const extractFn = useServerFn(extractMeasurements);

  const [step, setStep] = useState<Step>("setup");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [garmentTypeId, setGarmentTypeId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResultT | null>(null);

  const selectedGarment = useMemo(
    () => garmentTypes?.find((g) => g.id === garmentTypeId) ?? null,
    [garmentTypes, garmentTypeId]
  );

  const canProceedSetup = clientName.trim().length > 0 && !!garmentTypeId;

  // Warn on exit during recording/confirm
  useEffect(() => {
    if (step === "setup") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step]);

  const stepIndex = step === "setup" ? 1 : step === "record" ? 2 : 3;

  return (
    <AppShell
      title="New Job Card"
      showBack
      hideNav={step !== "setup"}
      onBack={() => {
        if (step === "setup") return navigate({ to: "/home" });
        const ok = window.confirm("Discard this recording? Your progress won't be saved.");
        if (ok) navigate({ to: "/home" });
      }}
    >
      <div className="px-4 sm:px-6 py-4 max-w-2xl mx-auto w-full">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Step {stepIndex} of 3</span>
          <div className="flex-1 flex gap-1">
            {[1, 2, 3].map((n) => (
              <div key={n} className={cn("h-1.5 flex-1 rounded-full", n <= stepIndex ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
        </div>

        {step === "setup" && (
          <SetupStep
            garmentTypes={garmentTypes ?? []}
            clientName={clientName}
            setClientName={setClientName}
            clientPhone={clientPhone}
            setClientPhone={setClientPhone}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            garmentTypeId={garmentTypeId}
            setGarmentTypeId={setGarmentTypeId}
            canProceed={canProceedSetup}
            onNext={() => setStep("record")}
          />
        )}

        {step === "record" && selectedGarment && (
          <RecordStep
            garment={selectedGarment}
            onManual={() => {
              setExtraction(emptyExtraction(selectedGarment));
              setStep("confirm");
            }}
            onAudio={async (base64, mime) => {
              setStep("processing");
              try {
                const res = await extractFn({ data: { garment_type_id: selectedGarment.id, audio_base64: base64, mime_type: mime } });
                if (res.ok) {
                  setExtraction(res.result);
                  setStep("confirm");
                } else {
                  const reason = res.reason;
                  const msgMap: Record<string, string> = {
                    empty: "We couldn't hear anything in that recording — please try again.",
                    malformed: "We had trouble understanding that recording — please fill in the details manually or try recording again.",
                    timeout: "This is taking longer than expected. Try again or enter values manually.",
                    no_fields: "This garment type isn't configured. Please pick another.",
                    server_error: "AI service is unavailable. Enter the details manually.",
                  };
                  toast.error(msgMap[reason] ?? "Something went wrong");
                  // Fall back to empty confirm form so tailor is never blocked
                  setExtraction(emptyExtraction(selectedGarment));
                  setStep("confirm");
                }
              } catch (err) {
                console.error(err);
                toast.error("Something went wrong. Enter the details manually.");
                setExtraction(emptyExtraction(selectedGarment));
                setStep("confirm");
              }
            }}
          />
        )}

        {step === "processing" && (
          <Card className="p-10 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            <h2 className="mt-4 text-lg font-semibold">Listening to your note…</h2>
            <p className="text-sm text-muted-foreground mt-1">This usually takes a few seconds.</p>
          </Card>
        )}

        {step === "confirm" && selectedGarment && extraction && (
          <ConfirmStep
            garment={selectedGarment}
            extraction={extraction}
            clientName={clientName}
            clientPhone={clientPhone}
            selectedClientId={selectedClientId}
            onRerecord={() => setStep("record")}
            onSaved={(cardId) => {
              qc.invalidateQueries();
              toast.success("Job card saved");
              navigate({ to: "/job-cards/$id", params: { id: cardId } });
            }}
          />
        )}
      </div>
    </AppShell>
  );
}

function emptyExtraction(g: GarmentType): ExtractionResultT {
  const fields: ExtractionResultT["fields"] = {};
  for (const f of g.fields) fields[f.field_key] = { value: null, confidence: null };
  return { fields };
}

// ============ SETUP ============
function SetupStep(props: {
  garmentTypes: GarmentType[];
  clientName: string;
  setClientName: (s: string) => void;
  clientPhone: string;
  setClientPhone: (s: string) => void;
  selectedClientId: string | null;
  setSelectedClientId: (s: string | null) => void;
  garmentTypeId: string | null;
  setGarmentTypeId: (s: string) => void;
  canProceed: boolean;
  onNext: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; phone: string | null }>>([]);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    const q = props.clientName.trim();
    if (!q || props.selectedClientId) { setSuggestions([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.from("clients").select("id, name, phone").ilike("name", `%${q}%`).order("name").limit(6);
      if (!cancel) setSuggestions(data ?? []);
    }, 180);
    return () => { cancel = true; clearTimeout(t); };
  }, [props.clientName, props.selectedClientId]);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="font-semibold mb-4">Who is this for?</h2>
        <div className="space-y-4">
          <div className="relative">
            <Label htmlFor="cname">Client name</Label>
            <Input
              id="cname"
              value={props.clientName}
              onChange={(e) => { props.setClientName(e.target.value); props.setSelectedClientId(null); setShowList(true); }}
              onFocus={() => setShowList(true)}
              onBlur={() => setTimeout(() => setShowList(false), 150)}
              placeholder="Type a name…"
              autoComplete="off"
              className="h-11"
              required
            />
            {showList && suggestions.length > 0 && !props.selectedClientId && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-accent text-sm flex items-center gap-2"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      props.setClientName(s.name);
                      props.setClientPhone(s.phone ?? "");
                      props.setSelectedClientId(s.id);
                      setShowList(false);
                    }}
                  >
                    <span className="font-medium">{s.name}</span>
                    {s.phone && <span className="text-muted-foreground text-xs">{s.phone}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">Existing</span>
                  </button>
                ))}
              </div>
            )}
            {props.selectedClientId && (
              <p className="text-xs text-success mt-1.5 flex items-center gap-1">
                <Check className="h-3 w-3" /> Existing client selected
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="cphone">Phone (optional)</Label>
            <Input id="cphone" type="tel" inputMode="tel" value={props.clientPhone} onChange={(e) => props.setClientPhone(e.target.value)} placeholder="03xx xxxxxxx" className="h-11" />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-4">What are you stitching?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {props.garmentTypes.map((g) => {
            const active = g.id === props.garmentTypeId;
            const disabled = g.fields.length === 0;
            return (
              <button
                key={g.id}
                type="button"
                disabled={disabled}
                onClick={() => props.setGarmentTypeId(g.id)}
                className={cn(
                  "text-left p-4 rounded-xl border-2 transition min-h-24",
                  active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="font-semibold">{g.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {g.fields.filter((f) => !f.is_notes).length} measurements
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Button size="lg" className="w-full h-12 text-base" disabled={!props.canProceed} onClick={props.onNext}>
        Continue <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

// ============ RECORD ============
const MAX_SECONDS = 90;

function RecordStep({ garment, onAudio, onManual }: {
  garment: GarmentType;
  onAudio: (base64: string, mime: string) => void;
  onManual: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const stopStream = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };

  useEffect(() => () => { stopTimer(); stopStream(); }, []);

  async function start() {
    setPermissionError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionError("Your browser doesn't support voice recording. Please enter values manually.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stopStream();
        stopTimer();
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 500) { toast.error("Recording was too short. Please try again."); setSeconds(0); return; }
        const base64 = await blobToBase64(blob);
        onAudio(base64, mime.split(";")[0]);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) { stop(); }
          return next;
        });
      }, 1000);
    } catch {
      setPermissionError("Microphone access was blocked. Enable it in your browser settings, or enter values manually below.");
    }
  }

  function stop() {
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.stop();
    }
    setRecording(false);
  }

  const remaining = MAX_SECONDS - seconds;
  const warn = recording && remaining <= 10;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="text-sm text-muted-foreground mb-1">Recording for</div>
        <div className="font-semibold">{garment.name}</div>
      </Card>

      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground mb-6">
          {recording
            ? "Speak naturally — chest, shoulder, sleeve length, and any notes."
            : "Tap to start. Speak like you would in a voice note."}
        </p>

        <button
          type="button"
          onClick={recording ? stop : start}
          className={cn(
            "mx-auto grid h-28 w-28 place-items-center rounded-full text-primary-foreground transition",
            recording ? "bg-destructive animate-rec-pulse" : "bg-primary hover:bg-primary/90 active:scale-95"
          )}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording ? <Square className="h-10 w-10" fill="currentColor" /> : <Mic className="h-10 w-10" />}
        </button>

        <div className={cn("mt-6 font-mono text-2xl tabular-nums", warn && "text-destructive font-bold")}>
          {formatTime(seconds)} <span className="text-muted-foreground text-base">/ {formatTime(MAX_SECONDS)}</span>
        </div>
        {warn && <p className="text-sm text-destructive mt-2">Recording will stop in {remaining}s</p>}

        {permissionError && (
          <div className="mt-6 p-4 rounded-lg bg-warning-bg text-warning-foreground text-sm flex items-start gap-3 text-left">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>{permissionError}</div>
          </div>
        )}
      </Card>

      <Button variant="outline" size="lg" className="w-full h-12" onClick={onManual}>
        <Keyboard className="h-4 w-4 mr-2" /> Skip voice, enter manually
      </Button>
    </div>
  );
}

// ============ CONFIRM ============
function ConfirmStep(props: {
  garment: GarmentType;
  extraction: ExtractionResultT;
  clientName: string;
  clientPhone: string;
  selectedClientId: string | null;
  onRerecord: () => void;
  onSaved: (id: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of props.garment.fields) {
      const v = props.extraction.fields[f.field_key]?.value;
      initial[f.field_key] = v === null || v === undefined ? "" : String(v);
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);

  const measurementFields = props.garment.fields.filter((f) => !f.is_notes);
  const notesField = props.garment.fields.find((f) => f.is_notes);

  const filledMeasurements = measurementFields.filter((f) => values[f.field_key]?.trim().length > 0).length;
  const canSave = filledMeasurements >= 1 && props.clientName.trim().length > 0;

  function validate(): string | null {
    for (const f of measurementFields) {
      const raw = values[f.field_key]?.trim();
      if (!raw) continue;
      const num = Number(raw);
      if (!Number.isFinite(num)) return `${f.field_label} must be a number`;
      const min = f.min_value ?? 0;
      const max = f.max_value ?? 999;
      if (num < min || num > max) return `${f.field_label}: this doesn't look right — please check.`;
    }
    return null;
  }

  async function save() {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!canSave) { toast.error("Add at least one measurement before saving."); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // 1. Resolve client
      let clientId = props.selectedClientId;
      if (!clientId) {
        const { data: newClient, error: cErr } = await supabase
          .from("clients")
          .insert({ user_id: user.id, name: props.clientName.trim(), phone: props.clientPhone.trim() || null })
          .select("id")
          .single();
        if (cErr) throw cErr;
        clientId = newClient.id;
      }

      // 2. Create job card
      const { data: card, error: jErr } = await supabase
        .from("job_cards")
        .insert({
          user_id: user.id,
          client_id: clientId!,
          garment_type_id: props.garment.id,
          status: "confirmed",
        })
        .select("id")
        .single();
      if (jErr) throw jErr;

      // 3. Insert values
      const rows = props.garment.fields
        .filter((f) => values[f.field_key]?.trim().length > 0)
        .map((f) => ({ job_card_id: card.id, field_key: f.field_key, value: values[f.field_key].trim(), confidence: null }));
      if (rows.length > 0) {
        const { error: vErr } = await supabase.from("job_card_values").insert(rows);
        if (vErr) throw vErr;
      }

      props.onSaved(card.id);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Review & confirm</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Amber fields need a second look. Tap any value to edit — nothing is saved yet.
        </p>
      </div>

      <Card className="p-5">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Client · Garment</div>
        <div className="font-semibold">{props.clientName} · {props.garment.name}</div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {measurementFields.map((f) => (
            <FieldInput
              key={f.field_key}
              field={f}
              value={values[f.field_key]}
              confidence={props.extraction.fields[f.field_key]?.confidence ?? null}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.field_key]: v }))}
            />
          ))}
        </div>
        {notesField && (
          <div>
            <Label htmlFor={notesField.field_key}>{notesField.field_label}</Label>
            <Textarea
              id={notesField.field_key}
              value={values[notesField.field_key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [notesField.field_key]: e.target.value }))}
              placeholder="Any style, fabric, or fitting notes…"
              rows={3}
            />
          </div>
        )}
      </Card>

      {filledMeasurements === 0 && (
        <div className="p-4 rounded-lg bg-warning-bg text-warning-foreground text-sm flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>We couldn't find any measurements in that recording. Enter values manually, or try recording again.</div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sticky bottom-0 pb-4 -mx-4 sm:mx-0 sm:pb-0 sm:static px-4 sm:px-0 bg-background sm:bg-transparent pt-3 sm:pt-0 border-t sm:border-t-0 border-border">
        <Button variant="outline" className="h-12 sm:flex-1" onClick={props.onRerecord}>
          <RotateCcw className="h-4 w-4 mr-2" /> Record again
        </Button>
        <Button className="h-12 sm:flex-1 text-base" onClick={save} disabled={saving || !canSave}>
          {saving ? "Saving…" : (<><Check className="h-4 w-4 mr-2" /> Confirm & Save</>)}
        </Button>
      </div>
    </div>
  );
}

function FieldInput({ field, value, confidence, onChange }: {
  field: GarmentField;
  value: string;
  confidence: "high" | "low" | null;
  onChange: (v: string) => void;
}) {
  const lowConf = confidence === "low" && value.trim().length > 0;
  return (
    <div>
      <Label htmlFor={field.field_key}>
        {field.field_label} {field.unit && <span className="text-muted-foreground font-normal">({field.unit})</span>}
      </Label>
      <Input
        id={field.field_key}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        type="text"
        placeholder="—"
        className={cn(
          "h-11 text-base",
          lowConf && "bg-warning-bg border-warning focus-visible:ring-warning"
        )}
      />
      {lowConf && (
        <p className="text-xs text-warning-foreground mt-1 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Please verify this value
        </p>
      )}
    </div>
  );
}

// ============ helpers ============
function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
