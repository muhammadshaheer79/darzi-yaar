
# DarziYaar — Implementation Plan

Voice-first digital job cards for local tailors. Record a spoken measurement note → AI extracts fields → tailor confirms → saved to a structured, searchable job card.

## Stack note (small deviation from PRD)

The PRD specifies a Supabase Edge Function. This project runs on TanStack Start, which has its own server runtime, so the equivalent secure server call will be a **TanStack `createServerFn`** on the same backend. Behavior is identical to what the PRD requires: `GEMINI_API_KEY` is stored as a server-side secret, only read inside the server handler, and never shipped to the browser bundle. No functional difference for the user.

## 1. Backend setup

- Enable Lovable Cloud (managed Postgres + Auth + Storage).
- Store `GEMINI_API_KEY` as a server-side secret (added via secure form, never in code).
- Auth: **Email + OTP (magic code)** — single email field, single 6-digit code entry, no password anywhere.
- Session persists on device.

## 2. Database schema (with RLS + grants)

Tables (all under `public`, RLS on, per-tailor isolation via `user_id = auth.uid()`):

- `profiles` — `id (=auth.users.id)`, `phone` (required at signup, stored for future use), `display_name`, `created_at`. Auto-created via trigger on signup.
- `clients` — `id`, `user_id`, `name`, `phone` (nullable), `created_at`.
- `garment_types` — `id`, `name`, `slug`, `is_active`. Seeded with **Men's Shalwar Kameez** and **Women's Shalwar Kameez / Kurti**.
- `garment_fields` — `id`, `garment_type_id`, `field_key`, `field_label`, `unit`, `min_value`, `max_value`, `display_order`, `is_notes` (bool). Seeded with exact fields from PRD §5.3.
- `job_cards` — `id`, `user_id`, `client_id`, `garment_type_id`, `status` (`draft` | `needs_review` | `confirmed`), `created_at`, `updated_at`.
- `job_card_values` — `id`, `job_card_id`, `field_key`, `value` (text; numbers stored as string, validated at write), `confidence` (`high` | `low` | null).

RLS: owners can CRUD their own `clients`, `job_cards`, `job_card_values`; `garment_types` / `garment_fields` are readable by all authenticated users. Explicit GRANTs on every new table. All seed data (garment types + fields) inserted via migration.

## 3. Voice extraction server function

`src/lib/extract.functions.ts` — `createServerFn({ method: "POST" })`:

1. Accepts base64 audio + `garment_type_id`.
2. Loads the field schema for that garment type from DB.
3. Calls Gemini (audio-capable model, e.g. `gemini-2.5-flash`) via REST with `GEMINI_API_KEY` from `process.env`.
4. Prompt = the exact prompt from PRD §5.4, with the field list injected dynamically.
5. Validates returned JSON shape with Zod against the expected schema before returning.
6. On malformed/empty/timeout (15s): returns a typed `{ ok: false, reason: "empty" | "malformed" | "timeout" }` — never crashes the client.

The key is never exposed to the frontend. No audio is persisted — processed in-memory and discarded.

## 4. Routes (TanStack Router, file-based)

```
src/routes/
  __root.tsx              → app shell, QueryClient, auth listener
  index.tsx               → redirects to /home if signed in, else /auth
  auth.tsx                → email + OTP flow (public)
  auth.callback.tsx       → OTP verification landing
  _authenticated/
    route.tsx             → managed auth gate (ssr:false)
    home.tsx              → dashboard: job card list + search + FAB
    clients.index.tsx     → client list
    clients.$id.tsx       → single client: their job cards
    job-cards.new.tsx     → new job card flow (client select → garment picker → record → processing → confirm)
    job-cards.$id.tsx     → detail / edit view
    job-cards.$id.print.tsx → print-friendly view (@media print)
    settings.tsx          → profile, phone, logout, audio-retention notice
```

Each route defines its own `head()` metadata.

## 5. New job card flow (Steps 3–7 in PRD)

Single wizard route with three internal steps and a top step indicator ("Step X of 3"):

1. **Setup** — client autocomplete (fuzzy match on existing clients) + inline create; garment type visual picker (tiles, designed to accept more tiles later).
2. **Record** — large bottom-anchored record button (tap to start / tap to stop), pulsing waveform animation, live timer, 90-sec cap with countdown warning in last 10s. Uses `MediaRecorder` API. "Skip voice, enter manually" secondary link.
3. **Processing** — spinner with "Listening to your note…", 15s timeout.
4. **Confirm** — editable form pre-filled from AI output; low-confidence fields get amber background + "Please verify" microcopy; numeric keypad for measurements; per-field range validation; save disabled until name + ≥1 measurement present. **Nothing writes to DB until Confirm & Save is tapped.**

Back-navigation / tab-close during recording or unconfirmed confirm shows a "Discard this recording?" dialog.

## 6. Job card detail, edit, print, search

- Detail view shows all fields with units, notes, dates, status badge.
- Edit mode reuses the confirm form + validation.
- Print view uses browser `@media print` — no PDF library.
- Home search filters by client name in real time (client-side over React Query cache).
- Optional Share action: builds a plain-text WhatsApp-friendly summary via `wa.me/?text=…` (small win, low risk).

## 7. Navigation & layout

- **Mobile:** persistent bottom nav bar (Home / Clients / Settings), hidden during active recording + confirm screens.
- **Desktop:** left sidebar with same three items.
- Every non-root screen: sticky header with back arrow + short title.
- Primary actions bottom-anchored; destructive actions require confirm.
- Empty state + loading state designed for every list screen.

## 8. Edge cases (all covered per PRD §8)

Mic-permission denied, offline, malformed AI JSON, AI timeout, mid-flow exit, duplicate client name, silent recording, OTP expiry, misconfigured garment type, near-90s recording — each with the exact user-visible behavior specified in the PRD.

## 9. Design tone

Clean, warm, approachable — not enterprise. Rounded cards, generous 44px+ tap targets, icons + text labels (never icons alone), warm neutral palette with a single accent color, amber reserved for the "low confidence" flag so it stays semantically meaningful. Fully mobile-first, scales up to tablet/desktop. Semantic design tokens in `src/styles.css`.

## 10. Explicitly out of scope (per PRD §10)

Additional garment types, team accounts, payments/invoicing, client-facing portal, push/SMS, permanent audio storage, PDF library.

## Delivery order

1. Enable Cloud + add `GEMINI_API_KEY` secret.
2. Migration: schema + RLS + grants + garment-type seed data.
3. Auth (email OTP) + profile trigger + `_authenticated` layout.
4. App shell + responsive nav (bottom bar / sidebar) + Home empty state.
5. Client management (list, autocomplete, inline create).
6. Garment picker + record UI + `MediaRecorder` capture.
7. Gemini server function + Zod validation + error paths.
8. Confirm screen + validation + save flow.
9. Detail / edit / print views.
10. Search, share, settings, audio-retention notice.
11. Edge-case polish + empty/loading states + a browser smoke test of the full loop.
