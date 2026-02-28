# FEATURES.md — Mobile Expense Tracker Implementation Checklist

Track implementation progress here. Check items off as they are completed.
Organized by phase and component in recommended build order.

---

## Phase 1

### 1. Infrastructure & Database

- [x] Write `schema.sql` — expenses, uploads, processing_jobs tables with all constraints and indexes
- [x] Set up database migrations tooling
- [x] Set up local development environment (Docker Compose: PostgreSQL + MinIO or localstack for S3)
- [x] Define `.env` structure: DATABASE_URL, S3 credentials, Google Vision API key, worker config

---

### 2. Backend — Project Setup

- [x] Scaffold backend project and folder structure
- [x] Configure database connection pool
- [x] Configure S3-compatible client (presigned URL generation)
- [x] Configure Google Vision API client
- [x] Set up request validation middleware
- [x] Set up centralised error handling middleware

---

### 3. Backend — Upload Endpoint

- [x] `POST /uploads` — generate presigned URL + object key, store Upload record
- [x] Idempotency: if Idempotency-Key already exists and URL not expired, return existing record
- [x] Return: `{ presigned_url, object_key, expires_at }`

---

### 4. Backend — Receipt Ingestion Endpoint

- [x] `POST /ingest/receipt` — accept object_key + Idempotency-Key header
- [x] Create Expense draft record (`processing_status: uploaded`, `source: receipt`)
- [x] Create ProcessingJob record linked to expense
- [x] Idempotency: if Idempotency-Key already exists, return existing expense_id without creating duplicate job
- [x] Return: `{ expense_id, processing_status }`

---

### 5. Backend — Expense CRUD

- [x] `POST /expenses` — manual entry: `source: manual`, `confidence: 1.0`, `processing_status: verified`, `is_user_verified: true`
- [x] `GET /expenses` — list all expenses ordered by `created_at DESC`
- [x] `GET /expenses/{id}` — single expense including `processing_status` for client polling
- [x] `PATCH /expenses/{id}` — partial update of editable fields; setting `is_user_verified: true` transitions `processing_status` to `verified`
- [x] `DELETE /expenses/{id}` — delete expense, cascades to processing_jobs

---

### 6. Backend — Processing Worker

- [x] Worker polling loop — query ProcessingJob WHERE status IN ('uploaded', 'processing') ORDER BY created_at
- [x] Transition job + expense status: `uploaded → processing` on pickup
- [x] Call Google Vision API for OCR text extraction from S3 object
- [x] Heuristic parser — extract amount, merchant, date, currency from OCR output
- [x] Store raw OCR text and parsed line items in `raw_input` JSONB on Expense
- [x] Transition job + expense status: `processing → parsed → awaiting_user` on success
- [x] On failure: increment `attempt_count`, store `last_error_message`, apply exponential backoff
- [x] Transition to `failed` after `max_attempts` reached (terminal)
- [x] Keep `processing_status` on Expense in sync with ProcessingJob status at each transition

---

### 7. Mobile App — Project Setup

- [x] Scaffold React Native project
- [x] Set up navigation (stack + tab navigator)
- [x] Configure HTTP client with base URL and default headers (Idempotency-Key injection)
- [x] Configure local storage for LocalExpenseDraft (SQLite or AsyncStorage)
- [x] Set up environment config (API base URL, feature flags)

---

### 8. Mobile App — Expense List Screen

- [x] Fetch and display expenses from `GET /expenses`
- [x] Show amount, merchant, date, category per row
- [x] Show processing status badge per row (processing / awaiting\_user / failed / verified)
- [x] Pull-to-refresh
- [x] Empty state
- [x] Tap row → navigate to Edit/Verify screen

---

### 9. Mobile App — Manual Entry Screen

- [x] Form fields: amount, merchant, category, date, notes
- [x] Numeric keyboard for amount field
- [x] Input validation (amount and date required)
- [x] Submit → `POST /expenses` → return to expense list

---

### 10. Mobile App — Receipt Capture Flow

- [x] Camera permission request and handling
- [x] Photo capture
- [x] On-device image preprocessing (rotate, crop, compress)
- [x] Generate UUID as Idempotency-Key for upload session
- [x] `POST /uploads` → receive presigned\_url + object\_key
- [x] Upload image directly to S3 via presigned URL
- [x] `POST /ingest/receipt` with object\_key + Idempotency-Key header
- [x] Save LocalExpenseDraft locally (`sync_status: uploaded`)
- [x] Navigate to Edit/Verify screen for the new expense

---

### 11. Mobile App — Edit/Verify Screen

- [x] Display editable fields: amount, merchant, category, date, notes
- [x] Receipt image preview (loaded from `receipt_url`)
- [x] Show processing status indicator: spinner while `processing`, form when `awaiting_user`
- [x] Poll `GET /expenses/{id}` while `processing_status` is `uploaded` or `processing`
- [x] On `awaiting_user`: populate fields from parsed data, enable editing
- [x] On `failed`: show error message, offer options to edit manually, retry, or delete
- [x] Confirm button → `PATCH /expenses/{id}` with `is_user_verified: true`
- [x] Delete button → `DELETE /expenses/{id}` → return to expense list

---

### 12. Mobile App — LocalExpenseDraft Management

- [x] Create draft locally on receipt capture start
- [x] Update `sync_status` as upload and ingestion steps complete
- [x] Clear draft after successful server sync (expense reaches `awaiting_user` or `verified`)
- [x] On app restart: resume any pending drafts that did not complete sync

---

## Phase 2

### 13. Voice Input — Mobile

- [x] Microphone permission request and handling (`ExpoSpeechRecognitionModule.requestPermissionsAsync`)
- [x] On-device audio recording and speech-to-text (`expo-speech-recognition`)
- [x] Display live partial transcript while listening
- [x] Display full transcript for user review before submitting (`preview` phase)
- [x] `POST /ingest/voice` with transcript + Idempotency-Key header
- [x] Save LocalExpenseDraft (`transcript_text`) and resume on app restart
- [x] Navigate to Edit/Verify screen

### 14. Voice Input — Backend

- [x] `POST /ingest/voice` — accept transcript, create Expense draft + ProcessingJob (`source: voice`)
- [x] Idempotency: same contract as receipt ingestion (Idempotency-Key header, dedup on processingJob)
- [x] `voiceParser.ts` — extract amount (`$X` / `X dollars/bucks`), merchant (`at/from <Name>`), date (relative + formatted), currency
- [x] Worker branches on `expense.source` → `processVoiceJob` (no S3/OCR) or `processReceiptJob`
- [x] Transition to `awaiting_user` on successful parse

### 15. Confidence Scoring

- [x] Worker computes confidence from parse completeness: amount 0.5 + date 0.3 + merchant 0.2
- [x] Store computed `confidence` on Expense record (0.000–1.000); applied to both receipt and voice jobs
- [x] Mobile: `ConfidenceBadge` on Edit/Verify screen — green ≥80%, amber ≥50%, red <50%

### 16. Category Suggestion

- [x] `categoryMatcher.ts` — 8-category keyword regex map (Groceries, Restaurant, Fuel, Transport, Utilities, Healthcare, Shopping, Entertainment)
- [x] Applied in both receipt worker (merchant + OCR text) and voice parser (merchant + transcript)
- [x] Pre-populates category field in Edit/Verify screen; user can override

---

## Phase 3

### 17. Offline Sync

- [x] Queue failed uploads in LocalExpenseDraft when device is offline
- [x] Detect connectivity and trigger background sync on reconnect
- [x] Handle last-write-wins conflict resolution on sync
- [x] Show sync status indicator in UI (OfflineBanner)

### 18. Analytics Dashboard

- [x] Spending breakdown by category (VictoryPie donut chart)
- [x] Monthly spending totals (VictoryBar chart)
- [x] Date range filter (1M / 3M / 1Y / All period chips)

### 19. Notifications

- [x] Push notification when receipt processing completes (`awaiting_user`)
- [x] Push notification on processing failure (`failed`)

---

## E2E Tests

### 20. Backend E2E Test Suite

- [x] Separate Jest config (`jest.e2e.config.js`) — real PostgreSQL, no DB/S3 mocks, `--runInBand`
- [x] `globalSetup.js` — creates `expense_tracker_test` database + applies schema via `prisma db push`
- [x] `expenses.e2e.test.ts` — full CRUD lifecycle with DB persistence assertions (14 tests)
- [x] `uploads.e2e.test.ts` — presigned URL creation + idempotency + expired-URL refresh (5 tests)
- [x] `ingest.e2e.test.ts` — receipt + voice ingestion, idempotency dedup verified in DB (8 tests)
- [x] `analytics.e2e.test.ts` — summary totals, category breakdown, monthly buckets, date filtering, exclusion of in-flight expenses (6 tests)
- [x] `worker.e2e.test.ts` — voice + receipt state machine, 3-attempt failure exhaustion, verify flow (4 tests [sic: 6 tests])
- [x] `expenseService.ts` — serialization fixed: `amount` formatted to 2 dp, `confidence` to 3 dp via `Number().toFixed()`
- [x] `npm run test:e2e` script added (requires `docker-compose up -d`)
