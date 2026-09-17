import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  Search,
  UserPlus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  Dropzone,
  Input,
  Select,
  StatCard,
  type Column,
} from '@/components/hb'
import {
  bulkImportApi,
  type ImportResultData,
  type PreviewRow,
  type SheetPreviewData,
  type SheetInfo,
} from '@/api/bulkImport'

/**
 * Bulk candidate import: upload → sheet-select → preview → importing → complete.
 *
 * Migrated onto the design system. Three things changed shape:
 *
 * · The drop target was a `<div onClick>` over a hidden input, unreachable by
 *   keyboard. It is the `Dropzone` primitive now, which also clears its input
 *   after every pick — so a file rejected for type or size can be re-picked,
 *   which the old hidden input silently refused to do.
 *
 * · The panel picker was a hand-built listbox with its own search box, outside
 *   click listener and z-index. It is a native `Select`: keyboard type-ahead
 *   comes for free and it cannot be clipped by the dialog's scroll container.
 *
 * · The importing spinner drew the Hybent mark from hardcoded gradient stops.
 *   Same composition, built from tokens.
 */

const PREVIEW_COLUMNS: Array<Column<PreviewRow>> = [
  {
    key: 'row',
    header: 'Row',
    width: '72px',
    cell: (row) => <span className="font-mono text-hb-xs text-hb-muted">{row.row_number}</span>,
  },
  {
    key: 'name',
    header: 'Name',
    cardTitle: true,
    cell: (row) => (
      <span className="font-semibold text-hb-text">{String(row.parsed_data.full_name ?? '-')}</span>
    ),
  },
  {
    key: 'email',
    header: 'Email',
    cell: (row) => <span className="text-hb-muted">{String(row.parsed_data.email ?? '-')}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) =>
      row.is_valid ? (
        <Badge tone="success">Valid</Badge>
      ) : (
        <span className="inline-flex items-start gap-1.5 text-hb-xs text-hb-error">
          <AlertTriangle size={13} aria-hidden className="mt-px shrink-0" />
          {row.errors[0]}
        </span>
      ),
  },
]

/** One of the two mutually exclusive import modes. */
function ImportOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean
  onChange: () => void
  title: string
  description: string
}) {
  return (
    <label
      className={clsx(
        'flex cursor-pointer items-start gap-hb-3 rounded-hb-sm border p-hb-3',
        'transition-colors duration-hb ease-hb',
        checked
          ? 'border-hb-blue/50 bg-hb-blue/5'
          : 'border-hb-border bg-hb-surface hover:border-hb-border-strong hover:bg-hb-surface-2'
      )}
    >
      <input
        type="radio"
        name="import-option"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-hb-blue focus-visible:shadow-hb-ring focus-visible:outline-none"
      />
      <span className="min-w-0">
        <span className="block font-semibold text-hb-text">{title}</span>
        <span className="block text-hb-xs text-hb-muted">{description}</span>
      </span>
    </label>
  )
}

/** Collapsed list of rows the import did not create. */
function ResultDetails({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="space-y-hb-2">
      <h4 className="font-display text-hb-h3 text-hb-text">{title}</h4>
      <details>
        <summary className="cursor-pointer text-hb-xs text-hb-muted transition-colors duration-hb hover:text-hb-text">
          Show details
        </summary>
        <div className="mt-hb-2 space-y-1 text-hb-xs">{children}</div>
      </details>
    </div>
  )
}

type Stage = 'upload' | 'sheet-select' | 'preview' | 'importing' | 'complete' | 'error'

interface BulkImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (result: ImportResultData) => void
}

export function BulkImportModal({ open, onClose, onSuccess }: BulkImportModalProps) {
  const [stage, setStage] = useState<Stage>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileId, setFileId] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [sheets, setSheets] = useState<SheetInfo[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [importAll, setImportAll] = useState(false)
  const [preview, setPreview] = useState<SheetPreviewData | null>(null)
  const [result, setResult] = useState<ImportResultData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [panelSearch, setPanelSearch] = useState('')

  /* A workbook can carry dozens of similarly-prefixed panel names, which is why
     the old bespoke listbox shipped a search box. A native <select> only offers
     first-character type-ahead, so the substring filter stays as a real field
     above it. The selected panel is never filtered out, or the <select> would
     fall back to showing nothing while a value is still set. */
  const panelQuery = panelSearch.trim().toLowerCase()
  const panelMatches = sheets.filter(
    (s) => !panelQuery || s.name.toLowerCase().includes(panelQuery) || s.name === selectedSheet
  )

  const getFriendlyError = (err: any, fallback: string) => {
    const status = err?.response?.status
    const detail = err?.response?.data?.detail
    const message = err?.response?.data?.message
    if (status === 413) {
      return 'File is too large for upload. Keep the file under 50MB.'
    }
    if (status === 401) {
      return 'Your session expired. Please login again and retry import.'
    }
    if (status === 403) {
      return 'You do not have permission to perform bulk imports.'
    }
    if (status === 504) {
      return 'Upload timed out while reading the file. Please retry, or split very large/malformed sheets.'
    }
    if (typeof detail === 'string' && detail.trim()) return detail
    if (typeof message === 'string' && message.trim()) return message
    if (!err?.response || err?.code === 'ERR_NETWORK') {
      return 'Backend is unreachable. Please ensure API server is running and healthy, then retry.'
    }
    return fallback
  }

  const handleFileSelect = async (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.csv')) {
      toast.error('Only .xlsx and .csv files are supported')
      return
    }

    // Validate file size (50MB max)
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('File size exceeds 50MB limit')
      return
    }

    setFile(selectedFile)
    setError('')
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await bulkImportApi.upload(formData)
      const { file_id, file_name, sheets: detectedSheets } = response.data

      setFileId(file_id)
      setFileName(file_name)
      setSheets(detectedSheets)

      if (detectedSheets.length === 1) {
        setSelectedSheet(detectedSheets[0].name)
      }

      setStage('sheet-select')
      toast.success(`File uploaded! Found ${detectedSheets.length} sheet(s)`)
    } catch (err: any) {
      const errorMsg = getFriendlyError(err, 'Failed to upload file')
      setError(errorMsg)
      toast.error(errorMsg)
      setStage('upload')
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!fileId || (!selectedSheet && !importAll)) {
      toast.error('Please select a sheet to preview')
      return
    }

    setLoading(true)
    try {
      const response = await bulkImportApi.preview(fileId, selectedSheet, importAll)
      setPreview(response.data)
      setStage('preview')
    } catch (err: any) {
      const errorMsg = getFriendlyError(err, 'Failed to preview data')
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!fileId || (!selectedSheet && !importAll)) {
      toast.error('Please select a sheet to import')
      return
    }

    setStage('importing')
    setLoading(true)

    try {
      const response = await bulkImportApi.execute(fileId, selectedSheet, importAll)
      const importResult = response.data
      setResult(importResult)
      setStage('complete')
      toast.success(`Import successful! Created ${importResult.created_count} candidates`)
      onSuccess?.(importResult)
    } catch (err: any) {
      const errorMsg = getFriendlyError(err, 'Import failed')
      setError(errorMsg)
      toast.error(errorMsg)
      setStage('error')
    } finally {
      setLoading(false)
    }
  }

  const resetModal = () => {
    setStage('upload')
    setFile(null)
    setFileId('')
    setFileName('')
    setSheets([])
    setSelectedSheet('')
    setImportAll(false)
    setPreview(null)
    setResult(null)
    setError('')
    setPanelSearch('')
  }

  const handleClose = () => {
    if (stage === 'complete') {
      resetModal()
      onClose()
    } else if (stage === 'importing') {
      return // Don't allow closing during import
    } else {
      resetModal()
      onClose()
    }
  }

  const footer = (() => {
    if (stage === 'upload') {
      return (
        <Button variant="ghost" onClick={handleClose}>
          Cancel
        </Button>
      )
    }
    if (stage === 'sheet-select') {
      return (
        <>
          <Button variant="ghost" onClick={() => setStage('upload')}>
            Back
          </Button>
          <Button onClick={handlePreview} loading={loading} disabled={!importAll && !selectedSheet}>
            {loading ? 'Loading…' : 'Preview'}
          </Button>
        </>
      )
    }
    if (stage === 'preview' && preview) {
      return (
        <>
          <Button variant="ghost" onClick={() => setStage('sheet-select')}>
            Back
          </Button>
          <Button onClick={handleImport} loading={loading}>
            {loading ? 'Preparing…' : 'Import Candidates'}
          </Button>
        </>
      )
    }
    if (stage === 'complete' && result) {
      return <Button onClick={handleClose}>Done</Button>
    }
    if (stage === 'error') {
      return (
        <>
          <Button variant="ghost" onClick={() => setStage('sheet-select')} disabled={loading}>
            Back
          </Button>
          <Button onClick={handleImport} loading={loading}>Retry</Button>
        </>
      )
    }
    return undefined
  })()

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Bulk Import Candidates"
      size="xl"
      footer={footer}
    >
      <AnimatePresence mode="wait">
        {/* UPLOAD STAGE */}
        {stage === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-hb-4"
          >
            <Dropzone
              icon={<FileSpreadsheet />}
              title="Drag and drop your file"
              description="Or click to select. Maximum 50 MB."
              formats={['XLSX', 'CSV']}
              accept=".xlsx,.csv"
              busy={loading}
              busyLabel="Uploading…"
              onFiles={([selected]) => handleFileSelect(selected)}
            />

            {file && (
              <Card padding="compact" className="flex items-center justify-between gap-hb-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-hb-text">{file.name}</p>
                  <p className="text-hb-xs text-hb-muted">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <CheckCircle2 size={18} aria-hidden className="shrink-0 text-hb-success" />
              </Card>
            )}

            {error && (
              <p
                role="alert"
                className="flex items-start gap-hb-3 rounded-hb-sm border border-hb-error/30 bg-hb-error/10 p-hb-4 text-hb-sm text-hb-error"
              >
                <AlertCircle size={18} aria-hidden className="mt-px shrink-0" />
                {error}
              </p>
            )}
          </motion.div>
        )}

        {/* SHEET SELECTION STAGE */}
        {stage === 'sheet-select' && (
          <motion.div
            key="sheet-select"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-hb-4"
          >
            <Card padding="compact">
              <p className="font-semibold text-hb-text">File: {fileName}</p>
              <p className="text-hb-xs text-hb-muted">{sheets.length} sheet(s) detected</p>
            </Card>

            <div className="space-y-hb-3">
              <h3 className="font-display text-hb-h3 text-hb-text">Import Options</h3>

              <ImportOption
                checked={importAll}
                onChange={() => {
                  setImportAll(true)
                  setSelectedSheet('')
                }}
                title="Import All Panels"
                description="Import candidates from all sheets"
              />

              <ImportOption
                checked={!importAll}
                onChange={() => setImportAll(false)}
                title="Import Specific Panel"
                description="Choose a sheet to import"
              />
            </div>

            {!importAll && (
              <div className="space-y-hb-2">
                {sheets.length > 1 && (
                  <Input
                    type="search"
                    aria-label="Search panels"
                    placeholder="Search panel…"
                    leadingIcon={<Search size={14} />}
                    value={panelSearch}
                    onChange={(e) => setPanelSearch(e.target.value)}
                  />
                )}
                <Select
                  label="Select Panel"
                  placeholder="Choose a sheet…"
                  description={panelMatches.length === 0 ? 'No panel found.' : undefined}
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  options={panelMatches.map((sheet) => ({
                    value: sheet.name,
                    label: `${sheet.name} (${sheet.row_count} rows)`,
                  }))}
                />
              </div>
            )}
          </motion.div>
        )}

        {/* PREVIEW STAGE */}
        {stage === 'preview' && preview && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-hb-4"
          >
            <Card padding="compact">
              <p className="font-semibold text-hb-text">Total Rows: {preview.total_rows}</p>
              <p className="text-hb-xs text-hb-muted">Preview shows first 10 rows</p>
              {preview.has_errors && (
                <p className="mt-hb-2 flex items-center gap-1.5 text-hb-xs text-hb-warning">
                  <AlertTriangle size={13} aria-hidden className="shrink-0" />
                  Some rows have validation errors
                </p>
              )}
            </Card>

            <div className="max-h-96 overflow-y-auto">
              <DataTable
                caption="Preview of the rows this import will create"
                columns={PREVIEW_COLUMNS}
                rows={preview.preview_rows}
                rowKey={(row) => row.row_number}
              />
            </div>
          </motion.div>
        )}

        {/* IMPORTING STAGE */}
        {stage === 'importing' && (
          <motion.div
            key="importing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            role="status"
            className="flex flex-col items-center justify-center gap-hb-4 py-hb-10 text-center"
          >
            <div className="relative mb-hb-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-2.5 rounded-hb-full border border-dashed border-hb-blue/40"
              >
                <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-hb-full bg-hb-cyan" />
              </motion.div>

              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="relative grid h-12 w-12 place-items-center rounded-hb-tile bg-hb-grad text-hb-on-brand shadow-hb-2"
              >
                <FileSpreadsheet size={21} aria-hidden />
              </motion.div>
            </div>

            <div>
              <h3 className="font-display text-hb-h3 text-hb-text">Importing candidates…</h3>
              <p className="mt-1 text-hb-sm text-hb-muted">
                Please wait while we process your data
              </p>
            </div>
          </motion.div>
        )}

        {/* COMPLETE STAGE */}
        {stage === 'complete' && result && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-hb-4"
          >
            <div className="flex items-start gap-hb-3 rounded-hb-md border border-hb-success/30 bg-hb-success/10 p-hb-4">
              <CheckCircle2 size={22} aria-hidden className="mt-px shrink-0 text-hb-success" />
              <div>
                <p className="font-display text-hb-h3 text-hb-text">
                  Import Completed Successfully!
                </p>
                <p className="mt-1 text-hb-sm text-hb-muted">
                  Created {result.created_count} candidates, Skipped {result.skipped_count}, Errors{' '}
                  {result.error_count}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-hb-3 sm:grid-cols-3">
              <StatCard label="Created" value={result.created_count} icon={<UserPlus />} />
              <StatCard label="Duplicates" value={result.skipped_count} icon={<Copy />} />
              <StatCard label="Errors" value={result.error_count} icon={<AlertTriangle />} />
            </div>

            {result.preview_data.length > 0 && (
              <div className="space-y-hb-2">
                <h4 className="font-display text-hb-h3 text-hb-text">Sample Imported Candidates</h4>
                <ul className="max-h-48 space-y-hb-2 overflow-y-auto">
                  {result.preview_data.map((candidate) => (
                    <li
                      key={candidate.id}
                      className="rounded-hb-sm border border-hb-border bg-hb-surface-2 p-hb-3"
                    >
                      <p className="font-semibold text-hb-text">{candidate.name}</p>
                      <p className="text-hb-xs text-hb-muted">{candidate.email}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.duplicates.length > 0 && (
              <ResultDetails title={`Skipped Duplicates (${result.duplicates.length})`}>
                {result.duplicates.slice(0, 5).map((dup) => (
                  <p key={dup.existing_id} className="text-hb-muted">
                    Row {dup.row_number}: {dup.full_name} ({dup.email})
                  </p>
                ))}
                {result.duplicates.length > 5 && (
                  <p className="text-hb-dim">…and {result.duplicates.length - 5} more</p>
                )}
              </ResultDetails>
            )}

            {result.invalid_rows.length > 0 && (
              <ResultDetails title={`Invalid Rows (${result.invalid_rows.length})`}>
                {result.invalid_rows.slice(0, 5).map((row) => (
                  <p key={row.row_number} className="text-hb-error">
                    Row {row.row_number}: {row.errors.join(', ')}
                  </p>
                ))}
                {result.invalid_rows.length > 5 && (
                  <p className="text-hb-dim">…and {result.invalid_rows.length - 5} more</p>
                )}
              </ResultDetails>
            )}
          </motion.div>
        )}

        {/* ERROR STAGE */}
        {stage === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div
              role="alert"
              className="flex items-start gap-hb-3 rounded-hb-md border border-hb-error/30 bg-hb-error/10 p-hb-4"
            >
              <AlertCircle size={22} aria-hidden className="mt-px shrink-0 text-hb-error" />
              <div>
                <p className="font-display text-hb-h3 text-hb-error">Import Failed</p>
                <p className="mt-1 text-hb-sm text-hb-error">{error}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  )
}
