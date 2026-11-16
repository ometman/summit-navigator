# Project Development Chronicle: Summit Navigator

This document chronicles the evolution of **Summit Navigator**, from its initial starter prototype (`localStorage` Q&A and Email/Password auth) through six full-stack feature branches implementing Firebase-backed MFA, QR credentials, live polls, networking, role-based administration, 30/60/90-day accountability tracking, and automated outbound reminder crons.

---

## Part I: Starter Baseline Chronicle (Pre-Branch Prototype)

### Stage 1: Dynamic Login/Logout Button
- **Prompt**: `"when already logged in the login button on the dashboard should be 'log out'"`
- **Work Done**:
  - Updated `src/components/dashboard/header.tsx` with `useUser` conditional rendering for Login vs. Logout.

### Stage 2: Early Firestore Permissions Debugging
- **Prompts**: Multiple iterations troubleshooting `"FirebaseError: Missing or insufficient permissions"` on collection `list` queries.
- **Work Done**:
  - Investigated collection-level `list` vs. document-level `get` rule evaluation in `firestore.rules`.

### Stage 3: Temporary Open Access & Anonymous Auth
- **Prompt**: `"let's allow free authentication to access dashboard and ask questions and see questions. But keep the UI"`
- **Work Done**:
  - Temporarily enabled anonymous authentication in the starter app to keep dashboard access unblocked while prototyping.

### Stage 4: Temporary Pivot to Local Storage Q&A
- **Prompt**: `"Still not working so let's use 'local storage' for the questions"`
- **Work Done**:
  - Temporarily refactored `src/components/session/q-and-a.tsx` to persist questions in browser `localStorage` keyed by `sessionId`.

### Stage 5: Q&A UX Enhancements
- **Prompt**: `"All the copy of all questions to avoid for redundancy, a copy question button or check box. also add questions counter. Let's mark answered questions. Let all persist"`
- **Work Done**:
  - Added copy-to-clipboard actions, question counter badges, answered status toggles, and bottom-sorting of answered questions.

### Stage 6: Initial Documentation
- **Prompt**: `"Write a complete Readme on the Project. Make it detail enough Right a prompt file a .md file, having the prompts used and work done stage by stage"`
- **Work Done**:
  - Authored the original `README.md` and `PROMPTS.md` capturing the starter state.

---

## Part II: Multi-Branch Feature Evolution (Implemented Branches)

### Branch 1: `feature/qr-attendee-pass` (`8d90952`) — Auth MFA, Signed QR Passes & Live Firestore Q&A
- **Goal / Milestone**: Replace starter `localStorage` Q&A and anonymous auth with production Firebase authentication, signed digital passes, and real-time moderated Q&A.
- **Work Done**:
  - **Google Sign-In + Email OTP MFA**: Replaced anonymous/email-password auth with Google Sign-In (`src/firebase/auth/use-user.tsx`) + Email OTP challenge (`src/components/auth/email-otp-challenge.tsx`, `/api/auth/otp`) and `users/{uid}` profiles (`src/firebase/user-profile.ts`).
  - **Signed QR Attendee Pass & Organizer Scanner**: Created `/pass`, `src/lib/pass-token.ts`, `/api/passes/sign`, `/api/passes/verify`, `src/firebase/passes.ts`, `AttendeePassCard`, and `OrganizerScanner` (with `qrcode` + `jsqr`).
  - **Live Firestore Q&A**: Replaced `localStorage` Q&A with real-time Firestore listeners (`src/firebase/qa.ts`, `/sessions/{sessionId}/questions`, deterministic `/upvotes/{questionId}_{uid}`) and speaker/moderator controls (pin, answer, archive).
  - **Interactive Footer & Presentation Modal**: Built `TikTokFooter` and `PresentationPlayerModal` with session slide decks, plus `RegistrationReport` (`/dashboard/registrations`, `/api/registrations`).

### Branch 2: `feature/live-polls-sentiment` (`08188a1`) — Live Audience Polls & Instant Sentiment Feedback
- **Prompt**: *"Live Audience Polls & Instant Sentiment Feedback: Allow speakers to launch real-time multiple-choice polls or 1-tap commitment responses during each session, displaying live aggregate results on the dashboard."*
- **Work Done**:
  - Added `SessionPoll` and `PollVote` schemas to `firebase-blueprint.json` and `firestore.rules` (deterministic `pollVotes/{pollId}_{uid}` guaranteeing one vote per verified attendee and atomic option counter increments).
  - Created `src/firebase/polls.ts` for launching polls/1-tap commitments, casting votes, toggling open/closed status, and archiving.
  - Built `LivePolls` (`src/components/session/live-polls.tsx`) inside `/session/[id]` and `LivePollsSummary` (`src/components/dashboard/live-polls-summary.tsx`) on `/dashboard`.

### Branch 3: `feature/leadership-directory` (`7cd6522`) — Attendee-to-Speaker & Leadership Directory Networking
- **Prompt**: *"Attendee-to-Speaker & Leadership Directory Networking: Provide an opt-in attendee directory filtered by ministry role (Senior Pastor, Operations & Strategy, Youth & Outreach, etc.) and session track so church leaders can connect across organizations."*
- **Work Done**:
  - Added PII-free `DirectoryProfile` (`/directoryProfiles/{userId}`) and `DirectoryConnection` (`/directoryConnections/{senderUid}_{recipientUid}`) schemas and security rules.
  - Created `src/firebase/directory.ts`, `/directory` route, and `DirectoryWorkspace` (`src/components/directory/directory-workspace.tsx`) supporting role/track/member-type filtering, explicit opt-in controls, and cross-organization intro/accept/decline workflows.
  - Updated `Header` and `SpeakerGrid` with direct links to leadership directory profiles.

### Branch 4: `feature/admin-console` (`003cf08`, `db21a54`) — Role-Based Admin Console & Live Content Editor
- **Prompts**:
  - *"Role-Based Admin Console & Session Content Editor: Add an organizer admin view (enforced in firestore.rules) to edit session times, speaker bios, slide decks, downloadable study packets, and manage bulk registration approvals."*
  - *"Fix the errors in the app"* (`Missing or insufficient permissions` on `list` of `sessionOverrides` and `speakerOverrides`).
- **Work Done**:
  - Added `SessionOverride`, `SpeakerOverride`, and `RegistrationRecord` entities and organizer/admin RBAC rules (`isOrganizerAdmin()`, `isBootstrappedAdmin()`) to `firebase-blueprint.json` and `firestore.rules`.
  - Built `/admin`, `AdminConsole` (`src/components/admin/admin-console.tsx`), `src/firebase/admin-content.ts`, and `SummitContentProvider` (`src/components/content/summit-content-provider.tsx`) to propagate session timing, slide deck, downloadable study packet, and speaker bio overrides across `/dashboard`, `/session/[id]`, `/speaker/[name]`, and the presentation player modal, alongside bulk registration approvals.
  - **Permissions Hotfix (`db21a54`)**: Replaced collection-level `list` listeners on `sessionOverrides` and `speakerOverrides` with document-level `get` listeners (`doc(firestore, 'sessionOverrides', id)` / `doc(firestore, 'speakerOverrides', key)`) and aligned list query filters with `firestore.rules`.

### Branch 5: `feature/action-plan-tracker` (`e1d16f5`) — Post-Summit Action Plan & 30/60/90-Day Accountability Tracker
- **Prompt**: *"Post-Summit Action Plan & 30-Day Ministry Accountability Tracker: Turn each session's key takeaways into interactive 30/60/90-day action checklists assigned to an attendee's church or department, with progress reminders synced to their profile."*
- **Work Done**:
  - Added `ActionPlanItem` (`users/{userId}/actionItems/{itemId}`) and `ActionReminderPreference` (`users/{userId}/actionReminderSettings/default`) schemas and owner-only rules to `firebase-blueprint.json` and `firestore.rules`.
  - Created starter 30/60/90-day takeaway templates (`src/lib/action-plan-templates.ts`) and Firestore CRUD/check-in helpers (`src/firebase/action-plan.ts`).
  - Built `SessionActionChecklist` on `/session/[id]`, the full `/action-plan` workspace (`ActionPlanTracker`), and `ActionPlanSummary` on `/dashboard` with overdue/due-soon metrics, church/department assignment, manual check-in logs, and profile-synced reminder cadences.

### Branch 6: `feature/automated-reminder-cron` (`b9b0544`) — Automated Outbound Reminder Email Cron
- **Prompt**: *"Let's implement the next in a new branch: Automated Outbound Reminder Email Cron... scheduled background email sending (a cron/Cloud Function sending automated digest emails when the user is offline)..."*
- **Work Done**:
  - Added `ReminderSubscription` (`/reminderSubscriptions/{userId}`) and `ReminderDispatchLog` (`/reminderDispatchLogs/{logId}`) schemas and deployed updated `firestore.rules`.
  - Built shared scheduling/mailer libraries (`src/lib/reminder-cron.ts`, `src/lib/reminder-mailer.ts`, `src/lib/firebase-admin.ts`) supporting Resend, SMTP (`nodemailer`), and safe preview mode.
  - Added `GET`/`POST /api/reminders/cron` (with `?status=1` readiness endpoint) and `POST /api/reminders/send-digest`, plus standalone Firebase Cloud Functions v2 daily scheduler (`functions/src/index.ts` → `scheduledAccountabilityDigest`).
  - Updated `ActionPlanTracker` with automatic subscription syncing and on-demand "Send Digest Email", and added the **Reminders & Cron** management tab (`ReminderCronPanel`) to `/admin`.

### Branch 7: `docs/update-readme-prompts` — Documentation Synchronization
- **Prompt**: *"Updated Project Documentation (README.md / PROMPTS.md): Those root markdown files still describe the original starter baseline (localStorage Q&A and Email/Password auth) and have not been updated to reflect the 6 implemented branches. Update it on a new branch"*
- **Work Done**:
  - Updated `README.md` and `PROMPTS.md` to accurately reflect the current architecture, authentication flow, Firestore data model, API surface, Cloud Functions worker, and full six-branch development chronicle.
