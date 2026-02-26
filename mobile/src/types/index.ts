export type ProcessingStatus =
  | 'uploaded'
  | 'processing'
  | 'parsed'
  | 'awaiting_user'
  | 'verified'
  | 'failed'

export type ExpenseSource = 'manual' | 'voice' | 'receipt'

export interface Expense {
  id: string
  user_id: string | null
  amount: string | null        // NUMERIC serialised as string
  currency: string
  merchant: string | null
  category: string | null
  date: string | null          // YYYY-MM-DD
  notes: string | null
  source: ExpenseSource
  receipt_url: string | null
  raw_input: Record<string, unknown>
  confidence: string | null    // NUMERIC(4,3) serialised as string
  is_user_verified: boolean
  processing_status: ProcessingStatus
  created_at: string           // ISO 8601
  updated_at: string           // ISO 8601
}

export type SyncStatus = 'pending' | 'uploaded' | 'processed'

export interface LocalExpenseDraft {
  local_id: string
  expense_id?: string          // server expense id once created
  sync_status: SyncStatus
  captured_image_path?: string
  transcript_text?: string
  base_server_version?: string // last-write-wins: server expense id at last sync
  edited_fields: Partial<
    Pick<Expense, 'amount' | 'merchant' | 'category' | 'date' | 'notes' | 'currency'>
  >
  created_at: string           // ISO 8601
  updated_at: string           // ISO 8601
}

// Request/response shapes

export interface CreateExpenseBody {
  amount: string
  currency?: string
  merchant?: string
  category?: string
  date: string
  notes?: string
}

export interface UpdateExpenseBody {
  amount?: string
  currency?: string
  merchant?: string
  category?: string
  date?: string
  notes?: string
  is_user_verified?: boolean
}

export interface CreateUploadResponse {
  presigned_url: string
  object_key: string
  expires_at: string
}

export interface IngestReceiptResponse {
  expense_id: string
  processing_status: ProcessingStatus
}

export interface IngestVoiceResponse {
  expense_id: string
  processing_status: ProcessingStatus
}
