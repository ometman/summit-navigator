# Summit Navigator — Interactive Leadership Seminar & Ministry Accountability Platform

Summit Navigator is a full-stack interactive web application built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Firebase**. Originally created as a leadership seminar agenda guide, it now provides a complete end-to-end event and post-summit experience: MFA-verified attendee onboarding, cryptographic QR check-in passes, real-time Firestore Q&A and audience polling, an opt-in leadership directory, a role-based organizer admin console, a 30/60/90-day action plan tracker, and automated outbound reminder email crons.

---

## Tech Stack

- **Framework**: Next.js 15 (`App Router`), React 18, TypeScript 5
- **Styling & UI**: Tailwind CSS, ShadCN/UI (Radix UI primitives), `lucide-react`
- **Data Visualization**: Recharts (program composition & speaker allocation charts)
- **Authentication**: Firebase Auth (**Google Sign-In**) + custom **Email OTP MFA** (`/api/auth/otp`) and signed HTTP-only `summit_mfa_session` cookies
- **Database & Security**: Cloud Firestore (named database `ai-studio-summitnavigator-bbf3552c-038d-468f-8110-4c0b4949bb1a`) with strict schema-validated rules (`firestore.rules` / `firebase-blueprint.json`)
- **Backend & Scheduled Jobs**: Next.js Route Handlers, Firebase Admin SDK (`firebase-admin`), and Firebase Cloud Functions v2 (`functions/src/index.ts`)
- **Email Delivery**: Resend REST API + `nodemailer` SMTP transport (with a safe in-app `preview` fallback when transport env vars are unset)
- **QR Credentials & Scanning**: `qrcode` (HMAC-signed pass tokens) and `jsqr` (organizer camera verification)
- **AI Integration**: Genkit (`@genkit-ai/google-genai`) for three-sentence session summaries

---

## Feature Evolution Across Implemented Branches

The application has been built incrementally across six feature branches (plus this documentation branch):

1. **`feature/qr-attendee-pass` — Auth MFA, Signed QR Passes & Live Firestore Q&A**
   - **Google Sign-In + Email OTP MFA**: Replaced anonymous/email-password login with verified Google Sign-In paired with a 6-digit Email OTP verification challenge (`/login`, `/register`, `/api/auth/otp`).
   - **Signed Digital QR Pass & Scanner (`/pass`)**: Issues HMAC-signed QR credentials backed by `attendeePasses/{userId}` with self check-in and organizer camera/manual QR scanning (`/api/passes/sign`, `/api/passes/verify`).
   - **Live Firestore Q&A**: Replaced the early `localStorage` Q&A prototype with real-time Firestore collections (`/sessions/{sessionId}/questions` and deterministic `/upvotes/{questionId}_{uid}`), atomic upvote counters, and speaker/moderator pin/answer/archive controls.
   - **Interactive Footer & Presentation Player**: TikTok-style floating navigation footer and interactive slide deck modal for every session, alongside Genkit AI summaries.

2. **`feature/live-polls-sentiment` — Live Audience Polls & Instant Sentiment Feedback**
   - Speakers and moderators can launch real-time multiple-choice polls (2–5 options) or 1-tap commitment prompts on any session page (`/session/[id]`).
   - Single-vote-per-attendee integrity is enforced in Firestore (`sessions/{sessionId}/pollVotes/{pollId}_{uid}`) with atomic aggregate option counters and a live `LivePollsSummary` feed on `/dashboard`.

3. **`feature/leadership-directory` — Attendee-to-Speaker & Leadership Directory Networking**
   - Opt-in, PII-free leadership directory at `/directory` (`directoryProfiles/{userId}`), filterable by ministry role (`Senior Pastor`, `Ministry Lead`, `Operations & Strategy`, `Youth & Outreach`, `Volunteer Coordinator`), summit track, and member type (attendee vs. speaker).
   - Cross-organization introduction workflow (`directoryConnections/{senderUid}_{recipientUid}`) allowing leaders and speakers to send, accept, or decline connection requests with optional contact notes.

4. **`feature/admin-console` — Role-Based Admin Console & Live Content Editor**
   - Organizer Admin Console at `/admin` enforced in `firestore.rules` (`isBootstrappedAdmin()` for primary admin `stackvarsity@gmail.com` and `isOrganizerAdmin()` / `isModerator()` via `moderators/{uid}`).
   - Live editing of session schedules, teaching/Q&A/prayer minute allocations, summaries, slide decks, downloadable study packets (`sessionOverrides/{sessionId}`), and speaker roles/biographies (`speakerOverrides/{speakerKey}`), propagated app-wide via `SummitContentProvider` using document-level listeners.
   - Single and bulk attendee registration status approvals (`registrations/{registrationId}`).

5. **`feature/action-plan-tracker` — Post-Summit Action Plan & 30/60/90-Day Accountability Tracker**
   - Turns each session's key takeaways into interactive 30-, 60-, and 90-day ministry action checklists (`users/{userId}/actionItems/{itemId}`), embedded both on `/session/[id]` and in the dedicated `/action-plan` workspace.
   - Supports assignment to a church and ministry department, due-date calculation from the summit baseline date, overdue/due-soon filtering, manual progress check-ins, profile-synced reminder cadence preferences (`users/{userId}/actionReminderSettings/default`), and a `/dashboard` summary widget.

6. **`feature/automated-reminder-cron` — Automated Outbound Reminder Email Cron**
   - Syncs verified attendees' active milestones and cadence preferences to `reminderSubscriptions/{userId}` and records immutable delivery audits in `reminderDispatchLogs/{logId}`.
   - **Next.js Cron & Digest APIs**: `GET`/`POST /api/reminders/cron` (secured by `CRON_SECRET` or Super Admin Bearer token, with `?status=1` readiness probe) and `POST /api/reminders/send-digest` for immediate user self-tests and admin batch dispatches.
   - **Firebase Cloud Functions v2 Worker (`/functions`)**: Daily scheduled function (`scheduledAccountabilityDigest`, `every day 08:00`) targeting the named Firestore database for offline background email delivery.
   - **Admin Reminders & Cron Tab**: Real-time subscriber table, due-status evaluator, transport readiness indicator, batch trigger, and dispatch audit log inside `/admin`.

---

## Application Routes & API Endpoints

### Pages
- `/` — Landing page with quick links to Dashboard, Google Sign-In, and Registration
- `/dashboard` — Central KPI cards, interactive agenda, speaker highlights, Recharts visualizations, live polls summary, and action plan progress summary
- `/dashboard/registrations` — Detailed registration report
- `/session/[id]` (`1`–`6`) — Session details, live overrides, Genkit AI summary, interactive Q&A, live polls & commitments, and session action checklist
- `/speaker/[name]` — Speaker profile, live bio override, and assigned sessions
- `/pass` — Signed QR attendee credential and organizer check-in scanner
- `/directory` — Opt-in leadership & speaker networking directory
- `/action-plan` — 30/60/90-day post-summit accountability tracker & reminder settings
- `/admin` — Role-based Organizer Admin Console (Sessions, Speakers, Registrations, Moderators, Reminders & Cron)
- `/login` & `/register` — Google Sign-In, attendee onboarding, and Email OTP MFA verification

### API Route Handlers
- `POST /api/auth/otp` — Issue/verify Email OTP codes and mint signed `summit_mfa_session` cookies
- `POST /api/passes/sign` & `POST /api/passes/verify` — Sign and cryptographically verify attendee QR pass payloads
- `GET` / `POST /api/registrations` — Fetch and submit attendee registration records
- `GET` / `POST /api/reminders/cron` — Health status (`?status=1`) and scheduled cron digest batch execution
- `POST /api/reminders/send-digest` — Authenticated on-demand user test digest or admin-triggered single dispatch

---

## Project Structure

```text
/
├── firebase-applet-config.json   # Active Firebase project & named Firestore database config
├── firebase-blueprint.json       # Entity schemas for all 14 Firestore collections
├── firestore.rules               # Schema & RBAC security rules
├── functions/                    # Standalone Firebase Cloud Functions v2 cron worker
│   └── src/index.ts              # scheduledAccountabilityDigest daily trigger
├── src/
│   ├── ai/                       # Genkit configuration & generate-session-summary flow
│   ├── app/                      # Next.js App Router pages and API route handlers
│   ├── components/
│   │   ├── action-plan/          # 30/60/90-day action plan tracker UI
│   │   ├── admin/                # Organizer console & Reminders/Cron dispatch panel
│   │   ├── auth/                 # Email OTP MFA challenge modal/form
│   │   ├── content/              # SummitContentProvider (live doc-level overrides)
│   │   ├── dashboard/            # Agenda, KPIs, Recharts, polls & action plan summaries
│   │   ├── directory/            # Opt-in leadership directory & connection requests
│   │   ├── footer/               # Interactive floating footer & slide presentation modal
│   │   ├── pass/                 # Signed QR pass card & organizer scanner
│   │   ├── session/              # AI summary, Q&A, live polls, session checklists
│   │   ├── speaker/              # Speaker detail view
│   │   └── ui/                   # ShadCN/UI primitives
│   ├── firebase/                 # Firebase client SDK setup, hooks, & typed domain modules
│   └── lib/                      # Static baseline data, templates, OTP, pass tokens, cron & mailer
└── .env.example                  # Optional outbound mail, cron secret & Admin SDK variables
```

---

## Getting Started

### Prerequisites
- Node.js (v18+ or v20+)
- npm (or bun)

### Installation & Running Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables (optional for local preview, required for live email/cron):**
   Copy `.env.example` to `.env.local` and supply any credentials you want active:
   - `NEXT_PUBLIC_APP_URL` — Base URL used in digest deep links (defaults to `http://localhost:3000`)
   - `RESEND_API_KEY` **or** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — Outbound mail transport (runs in safe `preview` mode if unset)
   - `CRON_SECRET` — Bearer secret protecting `GET`/`POST /api/reminders/cron` for automated schedulers
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — Service account credentials when calling `/api/reminders/cron` outside Google Cloud Application Default Credentials

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   The application runs on `http://localhost:3000`.

4. **Typecheck & Production Build:**
   ```bash
   npm run typecheck
   npm run build
   ```

5. **Optional — Run Genkit Developer UI:**
   ```bash
   npm run genkit:dev
   ```

6. **Optional — Deploy Scheduled Cloud Function (`functions/`):**
   ```bash
   cd functions && npm install && npm run build
   firebase deploy --only functions:scheduledAccountabilityDigest
   ```

---

## Firebase Integration Notes

- **Named Firestore Database**: All client hooks (`src/firebase/`), server Admin helpers (`src/lib/firebase-admin.ts`), and Cloud Functions (`functions/src/index.ts`) explicitly target the Firestore database configured in `firebase-applet-config.json` (`ai-studio-summitnavigator-bbf3552c-038d-468f-8110-4c0b4949bb1a`).
- **Role-Based Access Control**:
  - Verified attendees must authenticate with **Google Sign-In** (`email_verified == true`) and pass **Email OTP MFA**.
  - The bootstrapped primary administrator (`stackvarsity@gmail.com`) can manage `/moderators`, list subscriber/pass oversight views, approve registrations in bulk, and trigger reminder cron batches.
