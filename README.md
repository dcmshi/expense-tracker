# Mobile Expense Tracker

A mobile-first expense tracker with receipt OCR, voice input, async backend processing, offline sync, and analytics. Built as a portfolio project demonstrating mobile ingestion architecture, idempotent API design, and human-in-the-loop data verification workflows.

---

## Features

- **Manual entry** — form-based expense creation with instant save
- **Receipt scanning** — photo capture → on-device preprocessing → S3 upload → Google Vision OCR → heuristic parsing
- **Voice input** — on-device speech-to-text → structured expense extraction via heuristic parsing
- **Async processing pipeline** — database-backed job queue with retry/backoff, no external queue required
- **Edit & verify** — review and correct parsed data before confirming
- **Confidence scoring** — 0–100% badge indicating parse completeness (amount + date + merchant)
- **Category suggestion** — keyword matching across 8 categories applied to merchant name and OCR/transcript text
- **Offline-friendly drafts** — captures persist locally and resume after app restart
- **Auto-sync on reconnect** — pending drafts upload automatically when connectivity is restored
- **Analytics dashboard** — category breakdown (donut chart), monthly trend (bar chart), configurable time range
- **Push notifications** — notified when receipt processing completes or fails; tap to open directly in Edit & Verify
- **Idempotent ingestion** — safe to retry uploads and ingest calls on network failure

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                 Mobile App (Expo)                │
│                                                  │
│  VoiceCaptureScreen                              │
│  ReceiptCaptureScreen  ──────────────────────┐  │
│  ManualEntryScreen                           │  │
│  EditVerifyScreen  (polling + confidence)    │  │
│  AnalyticsScreen   (charts + period filter)  │  │
│  AddHubScreen      (draft resume)            │  │
│  OfflineBanner     (NetInfo)                 │  │
│  syncManager       (auto-retry on reconnect) │  │
└──────────────────────┬───────────────────────┘  │
                       │ HTTPS                     │
                       ▼
┌──────────────────────────────────────────────────┐
│              Backend API (Express/TS)            │
│                                                  │
│  POST /uploads              (presigned URL)      │
│  POST /ingest/receipt       (idempotent)         │
│  POST /ingest/voice         (idempotent)         │
│  GET|PATCH|DELETE /expenses/{id}                 │
│  GET  /expenses                                  │
│  GET  /analytics/summary?from&to                 │
│  PUT  /device-token                              │
└───────┬──────────────────────────────────────────┘
        │
   ┌────┴───────────────────┐
   │                        │
   ▼                        ▼
┌──────────┐          ┌────────────┐
│PostgreSQL│          │   MinIO    │
│          │          │ (S3-compat)│
│expenses  │          │  receipts  │
│proc_jobs │          │   bucket   │
│uploads   │          └────────────┘
└──────────┘
        ▲
        │ polls every 5s
┌───────┴──────────────────────────────────────────┐
│               Processing Worker                  │
│                                                  │
│  receipt → fetchS3 → OCR → parse                │
│  voice   → parseTranscript                       │
│  both    → confidence + category                 │
│  → awaiting_user (or failed after N retries)     │
│  → sendProcessingComplete / sendProcessingFailed │
└──────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native, Expo (managed workflow), React Navigation |
| API client | axios |
| Local storage | AsyncStorage (`@react-native-async-storage`) |
| Voice | expo-speech-recognition (on-device STT) |
| Image | expo-image-picker, expo-image-manipulator |
| Connectivity | @react-native-community/netinfo |
| Charts | victory-native (v36) |
| Notifications | expo-notifications |
| Backend | Node.js, TypeScript, Express |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Object storage | MinIO (S3-compatible; swap for AWS S3 in production) |
| OCR | Google Vision API |
| Push delivery | Expo Push API |

---

## Quick Start

### Prerequisites

- Docker + Docker Compose
- Node.js 20+
- A Google Vision API key

### 1. Start infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL on `localhost:5432` and MinIO on `localhost:9000` (console at `localhost:9001`).

### 2. Backend

```bash
cd backend
cp .env.example .env          # fill in GOOGLE_VISION_API_KEY
npm install
npx prisma migrate deploy     # applies schema.sql migrations
npm run dev                   # API on :3000
```

In a second terminal, start the processing worker:

```bash
cd backend
npm run worker
```

### 3. Mobile

```bash
cd mobile
npm install
cp .env.example .env.local    # set EXPO_PUBLIC_API_BASE_URL=http://<your-ip>:3000
npx expo start
```

Scan the QR code with Expo Go, or press `i`/`a` for a simulator.

---

## Processing Pipelines

### Receipt

```
capture photo
  → on-device resize + compress (expo-image-manipulator)
  → POST /uploads  →  presigned URL + object_key
  → PUT image to MinIO (direct from device)
  → POST /ingest/receipt  →  expense (status: uploaded) + ProcessingJob
  → worker: fetchS3 → Google Vision OCR → heuristic parse
  → expense updated: amount, merchant, date, category, confidence
  → status: awaiting_user  →  push notification sent
  → user reviews in EditVerifyScreen
  → PATCH /expenses/{id} with is_user_verified: true  →  status: verified
```

### Voice

```
tap Record  →  request mic + speech permissions
  → ExpoSpeechRecognitionModule.start()  →  live partial transcript
  → stop  →  transcript preview
  → POST /ingest/voice  →  expense (status: uploaded) + ProcessingJob
  → worker: parseVoiceTranscript (amount / merchant / date regex)
  → expense updated: amount, merchant, date, category, confidence
  → status: awaiting_user  →  push notification sent
  → user reviews in EditVerifyScreen
  → PATCH /expenses/{id} with is_user_verified: true  →  status: verified
```

### Offline sync

```
no connection  →  draft saved locally (sync_status: pending)
  → OfflineBanner shown across all tabs
  → connectivity restored  →  syncManager fires automatically
  → pending drafts retried sequentially
  → each draft: preprocess → upload → ingest (fresh idempotency key)
  → sync_status: uploaded  →  expense appears in list
```

### Job state machine

```
uploaded → processing → awaiting_user → verified
                     ↘ failed  (after max_attempts, default 3)
```

---

## API Reference

All endpoints at `http://localhost:3000`. No auth in MVP.

| Method | Path | Description |
|---|---|---|
| `POST` | `/uploads` | Request presigned S3 URL. Requires `Idempotency-Key` header. |
| `POST` | `/ingest/receipt` | Submit object key after S3 upload, create processing job. Requires `Idempotency-Key`. |
| `POST` | `/ingest/voice` | Submit transcript, create processing job. Requires `Idempotency-Key`. |
| `POST` | `/expenses` | Create manual expense (immediately verified). |
| `GET` | `/expenses` | List all expenses ordered by `created_at DESC`. |
| `GET` | `/expenses/:id` | Get single expense including `processing_status` for client polling. |
| `PATCH` | `/expenses/:id` | Edit fields or set `is_user_verified: true` to verify. |
| `DELETE` | `/expenses/:id` | Delete expense; cascades to processing jobs. |
| `GET` | `/analytics/summary` | Category + monthly breakdown. Optional `from`/`to` query params (YYYY-MM-DD). Defaults to last 30 days. |
| `PUT` | `/device-token` | Register Expo push token `{ token: string }`. |

Idempotency: `POST /uploads` and `POST /ingest/*` accept an `Idempotency-Key: <UUID>` header. Duplicate requests return the original result without creating a second job.

---

## Confidence Scoring

The worker scores each parsed expense based on what was successfully extracted:

| Field | Weight |
|---|---|
| Amount | +0.50 |
| Date | +0.30 |
| Merchant | +0.20 |

Score of `1.000` = all three extracted. The mobile app shows a colour-coded badge on the Edit/Verify screen:

- **Green** — ≥ 80% (high confidence)
- **Amber** — 50–79% (partial parse)
- **Red** — < 50% (low confidence, review carefully)

Manual entries always receive `confidence: 1.0`.

---

## Category Suggestion

Applied automatically by the worker (both receipt and voice) using keyword matching on the merchant name and raw text:

| Category | Example keywords |
|---|---|
| Groceries | Costco, Walmart, Loblaws, Metro, Sobeys, grocery |
| Restaurant | McDonald's, Subway, pizza, cafe, coffee, sushi |
| Fuel | Shell, Esso, Petro-Canada, gas station |
| Transport | Uber, Lyft, taxi, transit, parking |
| Utilities | Hydro, Bell, Rogers, Telus, internet |
| Healthcare | Shoppers Drug Mart, Rexall, dental, clinic |
| Shopping | Amazon, Best Buy, Home Depot, IKEA |
| Entertainment | Netflix, Spotify, cinema, Steam |

The suggested value pre-fills the category field; users can override it freely.

---

## Project Structure

```
expense-tracker/
├── docker-compose.yml          # PostgreSQL + MinIO
├── schema.sql                  # canonical DB schema
├── CLAUDE.md                   # project spec + implementation status
├── FEATURES.md                 # phase-by-phase implementation checklist
├── MVP_ARCHITECTURE_DECISIONS.md
│
├── backend/
│   ├── .env.example
│   ├── prisma/schema.prisma
│   └── src/
│       ├── app.ts              # Express app
│       ├── server.ts           # HTTP server entry
│       ├── lib/db.ts           # Prisma client
│       ├── middleware/         # validation, error handling
│       ├── routes/
│       │   ├── expenses.ts     # CRUD
│       │   ├── uploads.ts      # POST /uploads
│       │   ├── ingest.ts       # POST /ingest/receipt + /voice
│       │   ├── analytics.ts    # GET /analytics/summary
│       │   └── device.ts       # PUT /device-token
│       ├── services/
│       │   ├── ingestService.ts
│       │   ├── analyticsService.ts  # groupBy categories + monthly $queryRaw
│       │   └── notificationService.ts  # Expo Push API (in-memory token)
│       └── workers/
│           ├── processingWorker.ts   # poll loop + job dispatch + notifications
│           ├── receiptParser.ts      # OCR text → structured fields
│           ├── voiceParser.ts        # transcript → structured fields
│           ├── categoryMatcher.ts    # keyword → category label
│           └── ocrClient.ts          # Google Vision API + S3 fetch
│
└── mobile/
    ├── App.tsx                 # NavigationContainer with navigationRef
    ├── app.json                # Expo config + plugins (speech, notifications)
    ├── package.json
    └── src/
        ├── api/
        │   ├── client.ts       # axios instance
        │   ├── expenses.ts
        │   ├── uploads.ts
        │   ├── ingest.ts       # ingestReceipt + ingestVoice
        │   └── analytics.ts    # getAnalyticsSummary
        ├── components/
        │   └── OfflineBanner.tsx    # amber bar when offline
        ├── navigation/
        │   ├── types.ts             # RootTabParamList (3 tabs)
        │   ├── AppNavigator.tsx     # tabs + OfflineBanner + sync + notifications
        │   └── navigationRef.ts     # shared ref for notification tap navigation
        ├── screens/
        │   ├── AddHubScreen.tsx         # entry point + draft resume
        │   ├── ManualEntryScreen.tsx
        │   ├── ReceiptCaptureScreen.tsx
        │   ├── VoiceCaptureScreen.tsx
        │   ├── EditVerifyScreen.tsx     # polling + confidence badge
        │   ├── ExpenseListScreen.tsx
        │   └── AnalyticsScreen.tsx      # period chips, donut, bar chart
        ├── services/
        │   ├── uploadHelpers.ts         # preprocessImage, uploadToPresignedUrl
        │   ├── syncManager.ts           # NetInfo → auto-retry pending drafts
        │   └── notificationService.ts   # permissions, handler, tap listener
        ├── storage/
        │   └── draftStorage.ts  # AsyncStorage CRUD for LocalExpenseDraft
        └── types/index.ts
```

---

## Testing

Both packages have a full Jest test suite that runs without a live database, S3, or device.

### Backend

```bash
cd backend && npm test
```

13 suites · 119 tests covering:

| Area | What's tested |
|---|---|
| Workers | `categoryMatcher`, `receiptParser`, `voiceParser` — pure unit tests |
| Services | `uploadService`, `ingestService`, `expenseService`, `analyticsService`, `notificationService` — Prisma + S3 mocked via `moduleNameMapper` |
| Routes | All 5 route files — mini Express apps, service layer fully mocked |

Stack: **Jest 30 + ts-jest + supertest**

### Mobile

```bash
cd mobile && npm test
```

10 suites · 67 tests covering:

| Area | What's tested |
|---|---|
| API modules | `expenses`, `uploads`, `ingest`, `analytics` — axios client mocked |
| Storage | `draftStorage` — full CRUD against in-memory AsyncStorage mock |
| Services | `uploadHelpers`, `syncManager`, `notificationService` — native deps mocked |
| Components | `OfflineBanner` — all NetInfo connectivity states |
| Screens | `AnalyticsScreen` — loading / empty / data / error / period-chip states |

Stack: **Jest 29 + jest-expo + @testing-library/react-native**

---

## Implementation Status

| Phase | Status | Scope |
|---|---|---|
| Phase 1 | Complete | Manual entry, receipt OCR pipeline, expense CRUD, edit/verify screen, draft management |
| Phase 2 | Complete | Voice input, confidence scoring, category suggestion |
| Phase 3 | Complete | Offline auto-sync, analytics dashboard, push notifications |
