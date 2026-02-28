# CLAUDE.md --- Mobile Expense Tracker MVP

## Project Goal

Build a mobile-first expense tracker that supports: - Voice input -
Receipt photo ingestion - Manual entry - User editing and verification -
Async backend processing - Offline-friendly capture

This system emphasizes ingestion pipelines, idempotent APIs, and
human-in-the-loop correction.

------------------------------------------------------------------------

## High-Level Architecture

### Mobile App (React Native)

-   Voice capture (on-device speech → text)
-   Camera capture + image preprocessing
-   Manual entry UI
-   Local draft storage
-   Sync with backend
-   Edit and verify expenses

### Backend API

-   Expense CRUD
-   Ingestion endpoints
-   Async processing workers
-   File storage (object store)
-   Normalization and parsing pipeline

### Processing Workers

-   Receipt OCR parsing (Google Vision API)
-   Data normalization
-   Confidence scoring (Phase 2)

### Storage

-   PostgreSQL (expenses + job table)
-   S3-compatible object storage (receipt images)

------------------------------------------------------------------------

## Core Data Model

### Expense

-   id: UUID, PK, default gen_random_uuid()
-   user_id: UUID, nullable — reserved for future multi-user support
-   amount: NUMERIC(12, 2) NOT NULL
-   currency: VARCHAR(3) NOT NULL DEFAULT 'CAD' — ISO 4217 code
-   merchant: TEXT, nullable
-   category: TEXT, nullable
-   date: DATE NOT NULL — purchase date, no time granularity needed
-   notes: TEXT, nullable
-   source: VARCHAR(10) NOT NULL, CHECK IN ('manual', 'voice', 'receipt')
-   receipt_url: TEXT, nullable
-   raw_input: JSONB NOT NULL DEFAULT '{}' — per source: {ocr_text, line_items} or {transcript}
-   confidence: NUMERIC(4, 3), nullable — null for non-manual in Phase 1; 1.0 for manual
-   is_user_verified: BOOLEAN NOT NULL DEFAULT FALSE
-   processing_status: VARCHAR(20) NOT NULL, CHECK IN ('uploaded', 'processing', 'parsed', 'awaiting_user', 'verified', 'failed')
-   created_at: TIMESTAMPTZ NOT NULL DEFAULT now()
-   updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()

### Upload

-   upload_id: UUID, PK, default gen_random_uuid()
-   object_key: TEXT NOT NULL — S3 object key
-   idempotency_key: VARCHAR(255) NOT NULL UNIQUE
-   presigned_url_expires_at: TIMESTAMPTZ NOT NULL
-   created_at: TIMESTAMPTZ NOT NULL DEFAULT now()

### ProcessingJob

-   job_id: UUID, PK, default gen_random_uuid()
-   expense_id: UUID NOT NULL, FK → expenses(id) ON DELETE CASCADE
-   status: VARCHAR(20) NOT NULL, CHECK IN ('uploaded', 'processing', 'parsed', 'awaiting_user', 'verified', 'failed')
-   attempt_count: INTEGER NOT NULL DEFAULT 0
-   max_attempts: INTEGER NOT NULL DEFAULT 3
-   last_error_message: TEXT, nullable
-   idempotency_key: VARCHAR(255) NOT NULL UNIQUE
-   created_at: TIMESTAMPTZ NOT NULL DEFAULT now()
-   updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()

### LocalExpenseDraft (Mobile Only)

-   local_id: UUID, generated on device
-   sync_status: enum ('pending', 'uploaded', 'processed')
-   captured_image_path: string, nullable
-   base_server_version: UUID, nullable — server expense id for last-write-wins sync
-   amount: NUMERIC(12, 2), nullable
-   currency: VARCHAR(3), nullable
-   merchant: TEXT, nullable
-   category: TEXT, nullable
-   date: DATE, nullable
-   notes: TEXT, nullable

### Indexes

-   expenses(created_at DESC) — expense list ordering
-   expenses(processing_status) — status filtering for client
-   processing_jobs(expense_id) — join from expense to its job
-   processing_jobs(idempotency_key) UNIQUE — idempotency enforcement
-   PARTIAL INDEX processing_jobs(status) WHERE status IN ('uploaded', 'processing') — worker polling hot path
-   uploads(idempotency_key) UNIQUE — idempotency enforcement

------------------------------------------------------------------------

## Receipt Processing Pipeline

1.  Capture photo
2.  On-device preprocessing (crop, rotate, compress)
3.  Client calls POST /uploads → receives presigned URL + object key
4.  Client uploads image directly to object storage
5.  Client calls POST /ingest/receipt with object key + Idempotency-Key header
6.  Backend creates ProcessingJob record (status: uploaded)
7.  Worker polls for pending jobs → transitions to processing
8.  Google Vision API performs OCR extraction
9.  Heuristic parsing extracts total, merchant, date; line items stored in raw_input only
10. Job transitions to parsed → awaiting_user
11. User reviews editable draft, confirms → verified

Failure path: worker retries up to max_attempts with exponential backoff → failed (terminal)

## Voice Input Pipeline (Phase 2)

1.  Record audio on device
2.  Convert speech → text locally
3.  Send text to backend parser
4.  Receive structured expense
5.  User reviews and edits
6.  Save expense

Example structured output: { "amount": 23, "currency": "CAD",
"merchant": "Metro", "category": "groceries", "date": "2026-02-17" }

------------------------------------------------------------------------

## Editing Model

All ingestion methods produce a draft expense.

User can edit: - amount - merchant - category - date - notes

User confirms → expense marked verified.

------------------------------------------------------------------------

## API Design

Phase 1 endpoints:

    POST /uploads              — request presigned upload URL
    POST /ingest/receipt       — submit object key, create processing job
    POST /expenses             — manual expense creation
    GET  /expenses             — list expenses
    GET  /expenses/{id}        — get expense (includes processing_status for polling)
    PATCH /expenses/{id}       — edit or verify expense
    DELETE /expenses/{id}      — delete expense

Phase 2 endpoints:

    POST /ingest/voice         — submit transcript, create processing job

Phase 3 endpoints:

    GET  /analytics/summary    — category + monthly breakdown (?from&to, YYYY-MM-DD; defaults to last 30 days)
    PUT  /device-token         — register Expo push token { token: string }

Idempotency: POST /uploads and POST /ingest/* require an
Idempotency-Key: <UUID> header. Duplicate requests return the original
result without creating duplicate jobs.

API versioning: no /v1/ prefix in MVP. Versioning introduced when
breaking changes or external clients require it.

------------------------------------------------------------------------

## Async Processing Design

Job storage: PostgreSQL job table (no external queue in MVP).

State machine:

    uploaded → processing → parsed → awaiting_user → verified
                         ↘ failed (after max_attempts exceeded)

Worker behavior:
- polls database for jobs in uploaded or processing state
- retries automatically up to max_attempts with exponential backoff
- records attempt_count and last_error_message on each failure
- transitions to failed only after max_attempts reached

Failure causes: OCR error, parse failure, corrupted image, timeout,
unexpected worker error.

Client polling: GET /expenses/{id} — client reads processing_status
to determine current state. On failed, user may edit manually, retry,
or delete.

Processing stages:
1. Extract raw text (Google Vision API)
2. Normalize structure (merchant, amount, date, currency)
3. Store line items in raw_input only
4. Save parsed draft → awaiting_user
5. Await user verification → verified

------------------------------------------------------------------------

## Mobile UX Principles

-   Immediate draft after capture
-   Offline-friendly storage
-   Single-screen editing
-   Confidence indicators
-   Fast numeric entry
-   Receipt preview

------------------------------------------------------------------------

## MVP Scope

Phase 1
- Manual expense entry
- Receipt upload + OCR (presigned URL flow, Google Vision)
- Async processing pipeline with job table
- Edit and verify screen
- Expense list

Phase 2
- Voice input (on-device speech → text → structured expense)
- Confidence scoring
- Category suggestion

Phase 3
- Offline sync (auto-retry pending drafts on reconnect, OfflineBanner)
- Analytics dashboard (category donut, monthly bar chart, configurable period)
- Push notifications (processing complete/failed → Expo Push API, tap → EditVerify)

------------------------------------------------------------------------

## Implementation Status

### Phase 1 — Complete

**Backend** (§1–§6)
- Infrastructure: PostgreSQL + MinIO via Docker Compose, schema + migrations
- Upload endpoint: POST /uploads with presigned URL generation and idempotency
- Ingestion endpoint: POST /ingest/receipt with idempotent job creation
- Expense CRUD: full REST API (POST, GET list, GET single, PATCH, DELETE)
- Processing worker: Google Vision OCR, heuristic parser, state machine with retry/backoff

**Mobile** (§7–§12)
- Project scaffold: Expo managed workflow, React Navigation (tab + stack), axios client
- Expense List screen: fetches from API, status badges, pull-to-refresh, empty state
- Manual Entry screen: form with validation, submits to POST /expenses
- Receipt Capture screen: camera permission, capture, on-device preprocessing, presigned upload, ingest
- Edit/Verify screen: receipt preview, in-flight polling, editable fields, confirm + delete
- LocalExpenseDraft management: draft created on capture, sync\_status tracked through pipeline, draft cleared on server sync, pending drafts surfaced in AddHub for resume on app restart

### Phase 2 — Complete

**Backend** (§13–§16)
- `categoryMatcher.ts`: keyword regex map, `suggestCategory(merchant, text)` → category label or null
- `voiceParser.ts`: `parseVoiceTranscript(transcript)` — extracts amount ($X / X dollars), merchant (at/from pattern), date (relative + formatted), category via matcher
- `ingestService.ts`: `ingestVoice(transcript, idempotencyKey)` — same idempotent pattern as receipt
- `POST /ingest/voice` route: idempotency-key validation, delegates to ingestVoice
- `processingWorker.ts`: refactored — branches on `expense.source`; `processReceiptJob` (existing logic + confidence + category); `processVoiceJob` (transcript parse, no S3/OCR); `computeConfidence` (0.5 amount + 0.3 date + 0.2 merchant)

**Mobile** (§13–§16)
- `expo-speech-recognition` added to package.json + app.json (config plugin + mic/speech permissions)
- `api/ingest.ts`: `ingestVoice(transcript, idempotencyKey)` added
- `VoiceCaptureScreen`: idle → listening → preview → uploading → EditVerify; mic permission request; live partial transcript; resume support
- `AddHubScreen`: Voice Entry button; voice draft resume (transcript_text path); draft row label distinguishes voice vs receipt
- `EditVerifyScreen`: `ConfidenceBadge` for non-manual expenses — green ≥80%, amber ≥50%, red <50%

### Phase 3 — Complete

**Mobile** (§17)
- `services/uploadHelpers.ts`: extracted `preprocessImage` + `uploadToPresignedUrl` from ReceiptCaptureScreen
- `services/syncManager.ts`: NetInfo subscription; `startListening` / `stopListening`; sequential retry of `pending` drafts on reconnect (receipt + voice paths)
- `components/OfflineBanner.tsx`: amber banner shown across all tabs when offline
- `AppNavigator.tsx`: renders OfflineBanner, calls `syncManager.startListening` on mount

**Backend** (§18)
- `services/analyticsService.ts`: `getAnalyticsSummary(from, to)` — Prisma groupBy for categories, `$queryRaw` for monthly trend; excludes uploaded/processing/failed expenses
- `routes/analytics.ts`: `GET /analytics/summary?from&to` with Zod query validation; defaults to last 30 days

**Mobile** (§18)
- `api/analytics.ts`: `getAnalyticsSummary(from?, to?)` → `AnalyticsSummary`
- `AnalyticsScreen.tsx`: period chips (1M/3M/1Y/All), total card, VictoryPie donut + legend, VictoryBar monthly trend, loading/empty/error states
- `navigation/types.ts`: `AnalyticsTab: undefined` added to `RootTabParamList`
- `AppNavigator.tsx`: third tab registered

**Backend** (§19)
- `services/notificationService.ts`: in-memory token store; `setToken`, `sendProcessingComplete`, `sendProcessingFailed` via Expo Push API (native fetch; silent no-op when no token)
- `routes/device.ts`: `PUT /device-token`
- `processingWorker.ts`: notification calls after `awaiting_user` and terminal `failed` transitions (non-fatal try/catch)

**Mobile** (§19)
- `navigation/navigationRef.ts`: `createNavigationContainerRef<RootTabParamList>()`
- `services/notificationService.ts`: `requestPermissionsAndRegister`, `setupNotificationHandler`, `addNotificationResponseListener` (tap → navigate to EditVerify)
- `App.tsx`: `navigationRef` passed to `<NavigationContainer ref={...}>`
- `app.json`: expo-notifications config plugin added

### Test Infrastructure — Complete

**Backend unit** (`backend/`)
- `jest.config.js`: preset ts-jest, `moduleNameMapper` redirects `lib/db` → Prisma mock, `lib/s3` → S3 stub, `uuid` → CJS stub (uuid v13 ships ESM-only); `testPathIgnorePatterns` excludes `e2e/`
- `src/__mocks__/db.ts`: all Prisma methods as `jest.fn()`; `$transaction` calls its callback with the mock client
- `src/__mocks__/s3.ts`: exports stub bucket name + TTL constant
- `src/__mocks__/uuid.js`: CJS shim returning deterministic `'test-uuid-v4'`
- 13 suites, 119 tests — workers, services, all route files

**Backend e2e** (`backend/`)
- `jest.e2e.config.js`: separate config; real Prisma client against `expense_tracker_test` PostgreSQL database; `--runInBand` to prevent cross-suite DB races
- `src/__tests__/e2e/setup.ts`: `setupFiles` entry — sets `DATABASE_URL` to test DB before any module loads so dotenv cannot override it
- `src/__tests__/e2e/globalSetup.js`: creates `expense_tracker_test` if absent; runs `prisma db push --accept-data-loss` to apply schema
- `src/__mocks__/uuid.real.js`: CJS stub using `crypto.randomUUID()` — real UUIDs to avoid DB unique-constraint collisions
- `processingWorker.ts` exports `processPendingJobs` (for e2e worker tests); `runWorker()` guarded by `require.main === module`
- 5 suites, 39 tests — full CRUD, presigned upload + idempotency, receipt/voice ingest + idempotency, analytics summary + filtering, processing state machine + retry + verify flow
- Requires Docker: `docker-compose up -d` before running

**Mobile** (`mobile/`)
- `jest.config.js`: preset jest-expo (jest@29), `moduleNameMapper` redirects AsyncStorage → in-memory mock, `transformIgnorePatterns` includes all Expo/RN packages
- 10 suites, 67 tests — api modules, draftStorage, services (uploadHelpers, syncManager, notificationService), OfflineBanner component, AnalyticsScreen

**Running tests**
```bash
cd backend && npm test           # unit tests (no Docker needed)
cd backend && npm run test:e2e   # e2e tests  (requires docker-compose up -d)
cd mobile  && npm test
```

------------------------------------------------------------------------

## Portfolio Value

Demonstrates: - Mobile ingestion architecture - Async processing
pipeline - Data normalization - Idempotent API design -
Human-in-the-loop workflows - Backend system design for real-world
inputs

------------------------------------------------------------------------

## UI Screenshots

Static HTML mockups for all 7 screens are in `screenshots/`. They render at
iPhone 14 dimensions (390×844 pt) and are used as portfolio visuals in the
README.

### Files

| HTML source | PNG output | Screen |
|---|---|---|
| `screenshots/01-expense-list.html`    | `screenshots/01-expense-list.png`    | Expense List |
| `screenshots/02-add-hub.html`         | `screenshots/02-add-hub.png`         | Add Hub |
| `screenshots/03-manual-entry.html`    | `screenshots/03-manual-entry.png`    | Manual Entry |
| `screenshots/04-receipt-capture.html` | `screenshots/04-receipt-capture.png` | Receipt Capture |
| `screenshots/05-voice-capture.html`   | `screenshots/05-voice-capture.png`   | Voice Capture |
| `screenshots/06-edit-verify.html`     | `screenshots/06-edit-verify.png`     | Edit & Verify |
| `screenshots/07-analytics.html`       | `screenshots/07-analytics.png`       | Analytics |

### Regenerating

```bash
npm install --save-dev puppeteer   # one-time install from repo root
node scripts/generate-screenshots.js
```

The script (`scripts/generate-screenshots.js`) launches a headless Chromium
browser, navigates to each HTML file, and saves a @2x PNG (780×1688px).
Edit the `.html` source for a screen, then re-run the script to refresh its
PNG.

------------------------------------------------------------------------

## Future Enhancements

-   Auto-categorization model
-   Budget tracking
-   Spending insights
-   Export features
-   Multi-currency support
