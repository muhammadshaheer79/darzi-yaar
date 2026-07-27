# DarziYaar

**Voice-first digital job cards for local tailors.**

DarziYaar lets a tailor record a client's measurements and instructions as a natural spoken voice note — in English, Roman Urdu, or a mix — and instantly turns it into a structured, searchable digital job card. No typing, no lost paper slips, no digging through old WhatsApp voice notes trying to remember a client's chest measurement.

---

## 1. The Problem

Local tailors overwhelmingly rely on **paper measurement slips** to track client orders — a system that is easy to lose, easy to smudge, and impossible to search. Many have already adapted informally by sending themselves or their apprentice **WhatsApp voice notes** as a makeshift record. But this workaround creates its own problem: voice notes pile up unsearchable in chat history, aren't organized by client or garment, and require replaying long messages just to locate one measurement.

Existing tailoring and CRM apps don't solve this either — every one of them is built around **typed forms**, not around how small tailoring shops actually communicate: quickly, verbally, and often in casual Roman Urdu rather than typed English. **None of them offer a voice-to-text capture feature at all.** That gap is exactly what DarziYaar fills — turning an already-familiar habit (recording a quick voice note) into a structured, verified, and searchable digital record, without asking tailors to change how they already work.

**Who it's for:** Small, independent tailoring shops (typically a single ustaad, sometimes with one apprentice) who serve walk-in and repeat clients for stitched clothing.

---

## 2. Live App

🔗 **https://darzi-yaar.lovable.app/auth**

---

## 3. Current Scope — This is an MVP (Version 1)

DarziYaar is a **mobile-first mini-web-application**, deliberately scoped to validate one thing well: the full voice → structured job card → searchable record loop. It is fully functional and usable end-to-end today, with a few areas intentionally left for future iterations (see [Future Scope](#7-future-scope)).

---

## 4. Features

### Core Loop

- **Voice-to-text job card creation** — tap record, speak naturally, and the app extracts structured measurement fields automatically via AI
- **Manual entry fallback** — every field is editable by hand in case a recording doesn't work well or the tailor prefers typing
- **Confirmation-before-save** — every AI-extracted job card is shown back to the tailor for review; low-confidence fields are visibly flagged for a quick double-check before anything is saved. The AI drafts, the tailor always has final say.

### Job Cards

- Create job cards for two garment types at launch — Men's Shalwar Kameez and Women's Shalwar Kameez / Kurti — with the schema designed to support more garment types in future versions without a rebuild
- Edit any saved job card at any time
- Delete job cards
- **Share a job card as a WhatsApp message link** directly from the app

### Clients

- Dedicated Clients tab — search and view all clients and their job card history
- Client autocomplete when creating a new job card, to avoid accidental duplicate entries

### Navigation & Layout

- Fully **responsive** design — sidebar navigation on desktop, bottom navigation bar on mobile
- Floating "+ New Job Card" action button on mobile for quick one-thumb access
- Clean, modern, minimalist visual style — built to feel approachable for a small local business, not like enterprise software

### Authentication

- Email + magic link sign-in (passwordless — no password to remember)
- UI is already built for a full create-account flow including phone number collection as part of onboarding; phone-based OTP sign-in wiring on the backend is planned for a future version (see [Future Scope](#7-future-scope))

### Settings

- Edit ustaad (tailor) profile details
- Logout

---

## 5. The AI Feature

The heart of DarziYaar is its **voice-to-text extraction feature** — the one capability that, as far as this project's research found, **no comparable tailor-focused app currently offers.**

### What it does

When a tailor records a voice note, the audio is sent directly to a Gemini model, which:

1. Listens to the recording (in English, Roman Urdu, or a natural mix of the two)
2. Extracts the relevant measurement and note fields for the selected garment type
3. Flags any value it wasn't fully confident about, so the tailor knows exactly what to double-check
4. Returns everything as structured data, ready to populate the confirmation screen — never saved until the tailor explicitly confirms it

### The system prompt behind it

```
You are transcribing and extracting information from a voice note recorded by a
tailor in Karachi, Pakistan. The speaker may talk in Roman Urdu, Urdu, English, or
a mix of these, in a casual, conversational tone. Listen to the audio and extract
values for the following fields:
  [dynamic field list per garment type, e.g. chest, shoulder, sleeve_length,
   kameez_length, neck, waist, notes]

Measurements are typically given in inches as whole or half numbers. Return ONLY a
valid JSON object with one key per field. For each numeric field, include a sibling
confidence key (e.g. chest_confidence) with value "high" or "low" — mark "low" if
the number was unclear, mumbled, or you are inferring rather than clearly hearing
it. If a field was not mentioned at all, return null for that field and omit its
confidence key. Put any descriptive or non-numeric instructions (e.g. style notes,
fabric notes) into the "notes" field as clean, readable text. Do not include any
text outside the JSON object — no preamble, no explanation, no markdown formatting.
```

### Current limitations of the AI feature

- Works reliably today for **English and Roman Urdu** voice notes
- **Proper Urdu-language voice notes** (spoken in Urdu rather than Roman Urdu) are not yet handled reliably and are a priority for the next iteration
- Recording length is currently capped at **90 seconds** per note

---

## 6. Built With

| Layer              | Technology                                                                   |
| ------------------ | ---------------------------------------------------------------------------- |
| App builder        | Lovable (AI-assisted full-stack generation)                                  |
| Framework          | TanStack Start                                                               |
| Language           | TypeScript                                                                   |
| UI                 | React, Tailwind CSS                                                          |
| Backend / Database | Lovable Cloud (managed Postgres, Auth, Storage) with Row Level Security      |
| AI model           | Google Gemini (`gemini-3.5-flash`) — audio-input-capable, called server-side |
| Data validation    | Zod                                                                          |

---

## 7. Future Scope

These are known, intentional gaps for the current version — not oversights, but deliberate scoping decisions to ship a focused, reliable MVP first:

- **Urdu-language voice notes** — improve extraction accuracy for voice notes spoken in proper Urdu (not just Roman Urdu/English), likely via refined prompting or a two-step transcription pipeline
- **Longer voice recordings** — raise the current 90-second cap once accuracy at longer lengths is validated
- **Phone number / OTP authentication** — the UI for phone-based signup and OTP verification already exists in the app; this needs backend wiring (SMS provider integration) to go live
- **Print functionality** — a Print button exists on the job card detail view but does not yet produce output; implementing a proper printable layout is planned
- **Additional garment types** — the database schema was deliberately designed to support new garment types via data entry rather than a code rebuild; more types (e.g. trousers, coats, blouses) can be added once the core two are validated in real use

---

## 8. Running the Project Locally

You'll need [Node.js](https://nodejs.org) and npm installed (recommended: install via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)).

```bash
# Clone the repository
git clone <this-repository-url>
cd <repository-name>

# Install dependencies
npm i

# Run the development server
npm run dev
```

You'll also need to configure a `GEMINI_API_KEY` environment variable (obtained from [Google AI Studio](https://aistudio.google.com)) for the voice-to-text feature to function, along with the relevant Supabase/Lovable Cloud connection variables for auth and the database.

---

## 9. Screenshots

_Added 3 or more screenshots below showing the app in action — the auth/dashboard/home screen/page, the voice recording screen, the confirmation screen with a flagged field, and a completed job card detail view._

|                                                   |                                                 |
| ------------------------------------------------- | ----------------------------------------------- |
| ![Auth Sign Up](image.png) | <img width="979" height="911" alt="Image" src="https://github.com/user-attachments/assets/fdab6276-10e8-4e0d-8aa9-2c70fc98ae54" /> | 
| ![Auth Sign In](image.png) | <img width="979" height="822" alt="Image" src="https://github.com/user-attachments/assets/f8279c7d-bcc3-4d46-9929-37d26b242f59" /> |
| ![Dashboard Home](image-8.png) | <img width="1184" height="401" alt="Image" src="https://github.com/user-attachments/assets/ad9d457f-ab6e-4937-95e9-c1beb6831d8d" /> |
| ![Create Job Card 1](image-8.png) | <img width="652" height="588" alt="Image" src="https://github.com/user-attachments/assets/7acdf983-fe76-4986-87a4-9af5b18fb909" /> |
| ![Create Job Card 2](image-3.png) | <img width="779" height="662" alt="Image" src="https://github.com/user-attachments/assets/2b535d1a-6283-484d-bd37-50d597477dda" /> |
| ![Voice Recording](image-3.png) | <img width="979" height="590" alt="Image" src="https://github.com/user-attachments/assets/7634f2a6-1fb9-4df4-b74b-cd857ac56fbb" /> |
| ![Voice-to-Text conversion](image-3.png) | <img width="979" height="794" alt="Image" src="https://github.com/user-attachments/assets/e8fdfaea-3efd-4589-abd1-fdd94bbc0223" /> |
| ![Job Card Details & Options](image-3.png) | <img width="979" height="662" alt="Image" src="https://github.com/user-attachments/assets/fc3fa6d6-f8ce-462d-94f4-c9bdda1ab1d3" /> |
| ![Confirmation Screen/Page](image-4.png) | ![Job Card Details](image-5.png)  |
| ![Client List](image-10.png) | ![Profile Settings](image-7.png)  |
| ![Sign Out](image-11.png) |
