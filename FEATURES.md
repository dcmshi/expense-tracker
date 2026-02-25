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

- [ ] Camera permission request and handling
- [ ] Photo capture
- [ ] On-device image preprocessing (rotate, crop, compress)
- [ ] Generate UUID as Idempotency-Key for upload session
- [ ] `POST /uploads` → receive presigned\_url + object\_key
- [ ] Upload image directly to S3 via presigned URL
- [ ] `POST /ingest/receipt` with object\_key + Idempotency-Key header
- [ ] Save LocalExpenseDraft locally (`sync_status: uploaded`)
- [ ] Navigate to Edit/Verify screen for the new expense

---

### 11. Mobile App — Edit/Verify Screen

- [ ] Display editable fields: amount, merchant, category, date, notes
- [ ] Receipt image preview (loaded from `receipt_url`)
- [ ] Show processing status indicator: spinner while `processing`, form when `awaiting_user`
- [ ] Poll `GET /expenses/{id}` while `processing_status` is `uploaded` or `processing`
- [ ] On `awaiting_user`: populate fields from parsed data, enable editing
- [ ] On `failed`: show error message, offer options to edit manually, retry, or delete
- [ ] Confirm button → `PATCH /expenses/{id}` with `is_user_verified: true`
- [ ] Delete button → `DELETE /expenses/{id}` → return to expense list

---

### 12. Mobile App — LocalExpenseDraft Management

- [ ] Create draft locally on receipt capture start
- [ ] Update `sync_status` as upload and ingestion steps complete
- [ ] Clear draft after successful server sync (expense reaches `awaiting_user` or `verified`)
- [ ] On app restart: resume any pending drafts that did not complete sync

---

## Phase 2

### 13. Voice Input — Mobile

- [ ] Microphone permission request and handling
- [ ] On-device audio recording
- [ ] On-device speech-to-text conversion
- [ ] Display transcript for user review before submitting
- [ ] `POST /ingest/voice` with transcript + Idempotency-Key header
- [ ] Navigate to Edit/Verify screen

### 14. Voice Input — Backend

- [ ] `POST /ingest/voice` — accept transcript, create Expense draft + ProcessingJob (`source: voice`)
- [ ] Idempotency: same contract as receipt ingestion
- [ ] Voice parser worker — extract structured fields (amount, merchant, date, currency) from transcript text
- [ ] Transition to `awaiting_user` on successful parse

### 15. Confidence Scoring

- [ ] Worker computes confidence score from OCR signal quality and parse completeness
- [ ] Store computed `confidence` on Expense record (0.000–1.000)
- [ ] Mobile: display confidence indicator on Edit/Verify screen

### 16. Category Suggestion

- [ ] Keyword or heuristic-based category inference from merchant name and OCR text
- [ ] Pre-populate category field in Edit/Verify screen with suggested value (user can override)

---

## Phase 3

### 17. Offline Sync

- [ ] Queue failed uploads in LocalExpenseDraft when device is offline
- [ ] Detect connectivity and trigger background sync on reconnect
- [ ] Handle last-write-wins conflict resolution on sync
- [ ] Show sync status indicator in UI

### 18. Analytics Dashboard

- [ ] Spending breakdown by category (chart)
- [ ] Monthly spending totals
- [ ] Date range filter

### 19. Notifications

- [ ] Push notification when receipt processing completes (`awaiting_user`)
- [ ] Push notification on processing failure (`failed`)
