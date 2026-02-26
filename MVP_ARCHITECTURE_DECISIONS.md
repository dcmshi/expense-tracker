# MVP_ARCHITECTURE_DECISIONS.md

## Purpose

This document defines authoritative architecture and scope decisions for
the Mobile Expense Tracker MVP. All implementation should conform to
these constraints.

------------------------------------------------------------------------

## 1. Backend Technology (Language-Agnostic)

The backend language is not fixed. The system must be designed
independent of language choice.

Recommended implementation options: - Python + FastAPI → fastest
ingestion pipeline development - Node.js + TypeScript → strong ecosystem
alignment with mobile/web - Go → simple deployment and strong
performance

Selection criteria: - native async support - strong HTTP framework -
simple background job execution - robust JSON handling - minimal
deployment overhead

The architecture must not rely on language-specific features.

------------------------------------------------------------------------

## 2. OCR Provider

MVP default: - Google Vision API

Rationale: - high receipt accuracy - simple integration - no heavy
preprocessing requirements

Future upgrade option: - Amazon Textract for structured receipt parsing

Local OCR engines are not used in MVP.

------------------------------------------------------------------------

## 3. Async Processing Model

MVP uses a database-backed job table (PostgreSQL) for async processing.

Design:
- ingestion creates a ProcessingJob record
- worker polls for jobs WHERE status IN ('uploaded', 'processing')
- job state transitions stored in database
- crash-safe and retryable by design

In-process background tasks are not used.
External queue systems are deferred to post-MVP scaling.

------------------------------------------------------------------------

## 4. Object Storage

MVP uses S3-compatible object storage.

Requirements: - presigned upload URLs - immutable receipt storage - URL
reference stored in Expense record

Local file storage is not permitted.

------------------------------------------------------------------------

## 5. Authentication Model

MVP is single-user with no authentication.

However: - database schema must include nullable user_id - API must be
designed to support multi-user ownership later

Multi-tenant architecture is out of scope for MVP.

------------------------------------------------------------------------

## 6. Mobile Draft Model

LocalExpenseDraft stores a full editable snapshot, not a diff.

Design principles: - complete expense field copy - optional
base_server_version - last-write-wins conflict resolution - server
remains source of truth

This enables offline capture and reliable sync.

------------------------------------------------------------------------

## 7. Confidence Scoring

Confidence exists in schema from Phase 1 and is computed by the worker in Phase 2.

Phase 1 behavior:
- manual entry → `confidence: 1.0` (set at creation, no worker involved)
- receipt / voice → `confidence: null` until worker processes the job

Phase 2 implementation:
- Worker computes confidence from parse completeness (source-agnostic formula):
  - `+0.5` if amount is extracted
  - `+0.3` if date is extracted
  - `+0.2` if merchant is extracted
- Range: 0.000 (nothing parsed) to 1.000 (all three extracted)
- Stored as `NUMERIC(4,3)` on the Expense record
- Mobile displays a colour-coded badge: green ≥80%, amber ≥50%, red <50%

------------------------------------------------------------------------

## 8. Receipt Data Scope

MVP supports one expense per receipt.

Rules: - line items may be parsed - stored only in raw_input - not
first-class database records - no line-item UI

Future enhancement may introduce structured line items.

------------------------------------------------------------------------

## 9. API Versioning Strategy

MVP does not use a version prefix.

When breaking changes or external clients appear: - introduce /v1/ -
maintain backward compatibility

This is an intentional simplification.

------------------------------------------------------------------------

## 10. Ingestion Reliability Requirements

System must support: - idempotent ingestion requests - retry-safe
uploads - asynchronous processing - processing state tracking - human
verification workflow

Canonical processing lifecycle:

uploaded → processing → parsed → awaiting_user → verified

------------------------------------------------------------------------

## 11. Database Schema Conventions

### Enum representation
VARCHAR with CHECK constraints, not PostgreSQL ENUM types.
Rationale: easier to add or rename values without ALTER TYPE migrations.

### Amount precision
NUMERIC(12, 2) — supports up to 9,999,999,999.99.
Currency is CAD for MVP. Multi-currency support deferred.
currency column: VARCHAR(3), ISO 4217 code, DEFAULT 'CAD'.

### Expense date type
DATE — purchase date only, no time granularity needed.
Avoids timezone ambiguity. Upgraded to TIMESTAMPTZ if precision required later.

### Uploads table
A dedicated uploads table tracks presigned URL requests.
Fields: upload_id, object_key, idempotency_key, presigned_url_expires_at, created_at.
Rationale: supports idempotency on POST /uploads and aids debugging.
Ephemeral uploads are not used.

### Index strategy
- General indexes on frequently filtered columns (expenses.processing_status, expenses.created_at)
- Partial index on processing_jobs WHERE status IN ('uploaded', 'processing') for worker polling hot path
- Unique indexes on all idempotency_key columns (processing_jobs, uploads)
- Index on processing_jobs(expense_id) for expense → job joins

------------------------------------------------------------------------

## End of Decisions
