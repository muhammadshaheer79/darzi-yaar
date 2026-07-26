import { z } from "zod";

// ===== Domain types shared by client + server =====

export const ExtractionField = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
  confidence: z.enum(["high", "low"]).nullable(),
});

export const ExtractionResult = z.object({
  fields: z.record(z.string(), ExtractionField),
});

export type ExtractionResultT = z.infer<typeof ExtractionResult>;

export const ExtractionResponse = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: ExtractionResult }),
  z.object({
    ok: z.literal(false),
    reason: z.enum(["empty", "malformed", "timeout", "no_fields", "server_error"]),
    message: z.string().optional(),
  }),
]);

export type ExtractionResponseT = z.infer<typeof ExtractionResponse>;
