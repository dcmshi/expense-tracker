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

Idempotency: POST /uploads and POST /ingest/receipt require an
Idempotency-Key: <UUID> header. Duplicate requests return the original
result without creating duplicate jobs.

API versioning: no /v1/ prefix in MVP. Versioning introduced when
breaking changes or external clients require it.

Voice ingestion (POST /ingest/voice) is introduced in Phase 2.

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
- Offline sync
- Analytics dashboard
- Notifications

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

### Phase 2 — Not started

### Phase 3 — Not started

------------------------------------------------------------------------

## Portfolio Value

Demonstrates: - Mobile ingestion architecture - Async processing
pipeline - Data normalization - Idempotent API design -
Human-in-the-loop workflows - Backend system design for real-world
inputs

------------------------------------------------------------------------

## Future Enhancements

-   Auto-categorization model
-   Budget tracking
-   Spending insights
-   Export features
-   Multi-currency support
