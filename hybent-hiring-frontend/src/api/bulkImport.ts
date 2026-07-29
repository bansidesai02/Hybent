import api from './axios'

export interface SheetInfo {
  name: string
  row_count: number
}

export interface UploadResponseData {
  file_id: string
  file_name: string
  file_size: number
  sheets: SheetInfo[]
  message: string
}

export interface PreviewRow {
  row_number: number
  sheet_name?: string
  raw_data: Record<string, unknown>
  parsed_data: Record<string, unknown>
  is_valid: boolean
  errors: string[]
}

export interface SheetPreviewData {
  total_rows: number
  preview_rows: PreviewRow[]
  has_errors: boolean
  column_mapping: Record<string, string | null>
}

export interface ImportResultData {
  created_count: number
  skipped_count: number
  error_count: number
  errors: Array<{ row_number?: number; message?: string; error?: string }>
  duplicates: Array<{ row_number: number; email: string; full_name: string; existing_id: string }>
  invalid_rows: Array<{ row_number: number; raw_data: Record<string, unknown>; errors: string[] }>
  preview_data: Array<{ id: string; name: string; email: string; phone?: string; company?: string; experience?: number }>
  imported_candidates: string[]
  import_batch_id?: string | null
}

export interface ImportBatchSummary {
  id: string
  file_name: string
  selected_panels: string[]
  total_rows: number
  success_count: number
  failed_count: number
  duplicate_count: number
  status: string
  imported_by_name?: string | null
  created_at: string
}

export interface ImportBatchDetail extends ImportBatchSummary {
  failure_details?: Record<string, unknown> | null
  candidates: Array<{
    id: string
    full_name: string
    email: string
    phone?: string | null
    import_panel_name?: string | null
    imported_at?: string | null
  }>
}

export const bulkImportApi = {
  upload: (formData: FormData) =>
    api.post<UploadResponseData>('/v1/bulk-import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  preview: (fileId: string, sheetName?: string, importAllSheets = false) =>
    api.post<SheetPreviewData>('/v1/bulk-import/preview', null, {
      params: {
        file_id: fileId,
        sheet_name: importAllSheets ? undefined : sheetName,
        import_all_sheets: importAllSheets,
      },
    }),

  execute: (fileId: string, sheetName?: string, importAllSheets = false) =>
    api.post<ImportResultData>('/v1/bulk-import/execute', null, {
      params: {
        file_id: fileId,
        sheet_name: importAllSheets ? undefined : sheetName,
        import_all_sheets: importAllSheets,
      },
    }),

  listHistory: (params?: { search?: string; status?: string }) =>
    api.get<ImportBatchSummary[]>('/v1/bulk-import/history', { params }),

  getHistoryDetail: (batchId: string) =>
    api.get<ImportBatchDetail>(`/v1/bulk-import/history/${batchId}`),

  rollbackBatch: (batchId: string) =>
    api.post<{ batch_id: string; deleted_count: number }>(`/v1/bulk-import/history/${batchId}/rollback`),

  downloadFailedRows: (batchId: string) =>
    api.get<Blob>(`/v1/bulk-import/history/${batchId}/failed-rows`, { responseType: 'blob' as const }),

  downloadOriginalFile: (batchId: string) =>
    api.get<Blob>(`/v1/bulk-import/history/${batchId}/original-file`, { responseType: 'blob' as const }),
}
