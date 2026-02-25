-- schema.sql
-- Mobile Expense Tracker — PostgreSQL Schema
-- Phase 1 MVP
--
-- Requirements:
--   PostgreSQL 13+ (gen_random_uuid() built-in)
--   For PostgreSQL <13 add: CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- FUNCTION: auto-update updated_at on row change
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: expenses
--
-- Central record for all expense entries regardless of source.
-- processing_status mirrors the canonical lifecycle:
--   uploaded → processing → parsed → awaiting_user → verified
--                        ↘ failed
-- Manual entries skip straight to verified on creation.
-- ============================================================

CREATE TABLE expenses (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID,          -- nullable, reserved for future multi-user support
  amount            NUMERIC(12, 2),                        -- null for receipt/voice drafts until parsed
  currency          VARCHAR(3)     NOT NULL DEFAULT 'CAD',  -- ISO 4217
  merchant          TEXT,
  category          TEXT,
  date              DATE,                                   -- null for receipt/voice drafts until parsed
  notes             TEXT,
  source            VARCHAR(10)    NOT NULL,
  receipt_url       TEXT,
  raw_input         JSONB          NOT NULL DEFAULT '{}',   -- ocr_text + line_items for receipt; transcript for voice
  confidence        NUMERIC(4, 3),                         -- null in Phase 1 for non-manual; 1.0 for manual
  is_user_verified  BOOLEAN        NOT NULL DEFAULT FALSE,
  processing_status VARCHAR(20)    NOT NULL,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT expenses_source_check
    CHECK (source IN ('manual', 'voice', 'receipt')),

  CONSTRAINT expenses_processing_status_check
    CHECK (processing_status IN ('uploaded', 'processing', 'parsed', 'awaiting_user', 'verified', 'failed')),

  CONSTRAINT expenses_confidence_range_check
    CHECK (confidence IS NULL OR (confidence >= 0.000 AND confidence <= 1.000)),

  CONSTRAINT expenses_currency_length_check
    CHECK (char_length(currency) = 3),

  -- amount must be positive when present (null is valid for unprocessed drafts)
  CONSTRAINT expenses_amount_positive_check
    CHECK (amount IS NULL OR amount > 0)
);

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: uploads
--
-- Tracks presigned URL requests for direct-to-S3 uploads.
-- Supports idempotency on POST /uploads: duplicate requests
-- within the URL TTL return the existing record.
-- ============================================================

CREATE TABLE uploads (
  upload_id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  object_key               TEXT         NOT NULL,
  idempotency_key          VARCHAR(255) NOT NULL UNIQUE,
  presigned_url_expires_at TIMESTAMPTZ  NOT NULL,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: processing_jobs
--
-- One job per ingestion request. Tracks worker state, retry
-- count, and error history. Idempotency key ties the job back
-- to the originating POST /ingest/receipt request.
-- ============================================================

CREATE TABLE processing_jobs (
  job_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id         UUID         NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  status             VARCHAR(20)  NOT NULL,
  attempt_count      INTEGER      NOT NULL DEFAULT 0,
  max_attempts       INTEGER      NOT NULL DEFAULT 3,
  last_error_message TEXT,
  idempotency_key    VARCHAR(255) NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT processing_jobs_status_check
    CHECK (status IN ('uploaded', 'processing', 'parsed', 'awaiting_user', 'verified', 'failed')),

  CONSTRAINT processing_jobs_attempt_count_non_negative_check
    CHECK (attempt_count >= 0),

  CONSTRAINT processing_jobs_max_attempts_positive_check
    CHECK (max_attempts > 0),

  CONSTRAINT processing_jobs_attempt_within_max_check
    CHECK (attempt_count <= max_attempts)
);

CREATE TRIGGER processing_jobs_set_updated_at
  BEFORE UPDATE ON processing_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================

-- Expense list screen: default ordering
CREATE INDEX idx_expenses_created_at
  ON expenses (created_at DESC);

-- Client status filtering (e.g. show all failed or awaiting_user)
CREATE INDEX idx_expenses_processing_status
  ON expenses (processing_status);

-- Join from processing_jobs back to expense
CREATE INDEX idx_processing_jobs_expense_id
  ON processing_jobs (expense_id);

-- Worker polling hot path: only indexes active jobs, shrinks over
-- time as the majority of jobs accumulate in terminal states
CREATE INDEX idx_processing_jobs_active_status
  ON processing_jobs (created_at ASC)
  WHERE status IN ('uploaded', 'processing');

-- Note: UNIQUE constraints on uploads.idempotency_key and
-- processing_jobs.idempotency_key create implicit unique indexes;
-- no separate index definitions required.
