import { useState, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Upload, Check, AlertTriangle, CheckCircle, AlertCircle, ChevronDown, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { bulkImportApi, type ImportResultData, type SheetInfo, type SheetPreviewData } from '@/api/bulkImport'

interface PreviewRow {
  row_number: number
  raw_data: Record<string, any>
  parsed_data: Record<string, any>
  is_valid: boolean
  errors: string[]
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
  const [panelDropdownOpen, setPanelDropdownOpen] = useState(false)
  const [panelSearch, setPanelSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const panelDropdownRef = useRef<HTMLDivElement>(null)

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (panelDropdownRef.current && !panelDropdownRef.current.contains(event.target as Node)) {
        setPanelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const filteredSheets = useMemo(() => {
    const q = panelSearch.trim().toLowerCase()
    if (!q) return sheets
    return sheets.filter((s) => s.name.toLowerCase().includes(q))
  }, [sheets, panelSearch])

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      await handleFileSelect(files[0])
    }
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
    setPanelDropdownOpen(false)
    setPanelSearch('')
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  return (
    <Modal open={open} onClose={handleClose} title="Bulk Import Candidates" size="xl">
      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* UPLOAD STAGE */}
          {stage === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={clsx(
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                    'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10',
                    error ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : 'border-gray-300 dark:border-gray-600'
                  )}
                >
                  <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Drag and drop your file</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">or click to select</p>
                  <p className="text-xs text-gray-400">Supports .xlsx and .csv files (max 50MB)</p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />

                {file && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-4">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button onClick={() => fileInputRef.current?.click()} disabled={loading}>
                    {loading ? 'Uploading...' : 'Select File'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* SHEET SELECTION STAGE */}
          {stage === 'sheet-select' && (
            <motion.div key="sheet-select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">File: {fileName}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{sheets.length} sheet(s) detected</p>
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">Import Options</h3>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="import-option"
                      checked={importAll}
                      onChange={() => {
                        setImportAll(true)
                        setSelectedSheet('')
                      }}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Import All Panels</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Import candidates from all sheets</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="import-option"
                      checked={!importAll}
                      onChange={() => setImportAll(false)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Import Specific Panel</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Choose a sheet to import</p>
                    </div>
                  </label>
                </div>

                {!importAll && (
                  <div className="space-y-2" ref={panelDropdownRef}>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">Select Panel</label>
                    <button
                      type="button"
                      onClick={() => setPanelDropdownOpen((prev) => !prev)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setPanelDropdownOpen(false)
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setPanelDropdownOpen((prev) => !prev)
                        }
                      }}
                      className="w-full border border-violet-300 rounded-xl px-4 py-3 text-left bg-white dark:bg-gray-900 hover:border-violet-400 transition-colors flex items-center justify-between"
                      aria-haspopup="listbox"
                      aria-expanded={panelDropdownOpen}
                    >
                      <span className={selectedSheet ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400'}>
                        {selectedSheet
                          ? `${selectedSheet} (${sheets.find((s) => s.name === selectedSheet)?.row_count ?? 0} rows)`
                          : 'Choose a sheet...'}
                      </span>
                      <ChevronDown size={16} className={clsx('text-gray-500 transition-transform', panelDropdownOpen && 'rotate-180')} />
                    </button>

                    <AnimatePresence>
                      {panelDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.15 }}
                          className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-lg overflow-hidden z-20 relative"
                        >
                          <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-3">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                value={panelSearch}
                                onChange={(e) => setPanelSearch(e.target.value)}
                                placeholder="Search panel..."
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-violet-200"
                              />
                            </div>
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            {filteredSheets.map((sheet) => {
                              const active = selectedSheet === sheet.name
                              return (
                                <button
                                  key={sheet.name}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSheet(sheet.name)
                                    setPanelDropdownOpen(false)
                                  }}
                                  className={clsx(
                                    'w-full px-4 py-2.5 text-left text-sm transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0',
                                    active
                                      ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium'
                                      : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                                  )}
                                >
                                  <span>{sheet.name}</span>
                                  <span className="text-gray-500 ml-1">• {sheet.row_count} rows</span>
                                </button>
                              )
                            })}
                            {!filteredSheets.length && (
                              <div className="px-4 py-4 text-sm text-gray-500">No panel found.</div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                  <Button variant="outline" onClick={() => setStage('upload')}>
                    Back
                  </Button>
                  <Button onClick={handlePreview} disabled={loading || (!importAll && !selectedSheet)}>
                    {loading ? 'Loading...' : 'Preview'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* PREVIEW STAGE */}
          {stage === 'preview' && preview && (
            <motion.div key="preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Total Rows: {preview.total_rows}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Preview shows first 10 rows</p>
                  {preview.has_errors && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">⚠️ Some rows have validation errors</p>
                  )}
                </div>

                {/* Preview table */}
                <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="table-responsive">
<table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Row</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Email</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {preview.preview_rows.map((row) => (
                        <tr key={row.row_number} className={row.is_valid ? 'bg-white dark:bg-gray-900' : 'bg-red-50 dark:bg-red-900/20'}>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{row.row_number}</td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white truncate">{String(row.parsed_data.full_name ?? '-')}</td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400 truncate">{String(row.parsed_data.email ?? '-')}</td>
                          <td className="px-4 py-2">
                            {row.is_valid ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                <span className="text-xs text-red-600 dark:text-red-400">{row.errors[0]}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
</div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                  <Button variant="outline" onClick={() => setStage('sheet-select')}>
                    Back
                  </Button>
                  <Button onClick={handleImport} disabled={loading}>
                    {loading ? 'Preparing...' : 'Import Candidates'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* IMPORTING STAGE */}
          {stage === 'importing' && (
            <motion.div key="importing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <div className="relative mb-2">
                  {/* Rotating dashed outer orbit ring */}
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-10px] rounded-full border border-[#6c47ff]/40"
                    style={{ borderStyle: 'dashed', borderWidth: '1.2px', borderDasharray: '2 5' } as any}
                  >
                    {/* Orbiting glowing dot */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                  </motion.div>

                  {/* Pulsing Hybent Hiring Logo Box */}
                  <motion.div
                    animate={{ 
                      scale: [1, 1.05, 1],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="relative z-10 w-[48px] h-[48px] flex items-center justify-center"
                  >
                    {/* Background Squircle with Gradient */}
                    <div 
                      className="absolute inset-0 rounded-[12px] shadow-md"
                      style={{ 
                        background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)',
                        boxShadow: '0 6px 16px rgba(108,71,255,0.25)'
                      }}
                    >
                      <div className="absolute inset-0 rounded-[12px]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), transparent 60%)' }} />
                    </div>

                    {/* Hybent Hiring 'H' SVG mark */}
                    <svg className="relative z-10" width="24" height="24" viewBox="0 0 22 22" fill="none">
                      <rect x="2" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
                      <rect x="16" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
                      <rect x="2" y="9" width="18" height="4" rx="2" fill="white" opacity="0.95" />
                    </svg>
                  </motion.div>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-md">Importing candidates...</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Please wait while we process your data</p>
              </div>
            </motion.div>
          )}

          {/* COMPLETE STAGE */}
          {stage === 'complete' && result && (
            <motion.div key="complete" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Import Completed Successfully!</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Created {result.created_count} candidates, Skipped {result.skipped_count}, Errors {result.error_count}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{result.created_count}</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Created</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{result.skipped_count}</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">Duplicates</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{result.error_count}</p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">Errors</p>
                  </div>
                </div>

                {/* Preview data */}
                {result.preview_data.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">Sample Imported Candidates</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {result.preview_data.map((candidate) => (
                        <div key={candidate.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
                          <p className="font-medium text-gray-900 dark:text-white">{candidate.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{candidate.email}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Duplicates */}
                {result.duplicates.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">Skipped Duplicates ({result.duplicates.length})</h4>
                    <details className="cursor-pointer">
                      <summary className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                        Show details
                      </summary>
                      <div className="mt-2 space-y-1 text-xs">
                        {result.duplicates.slice(0, 5).map((dup) => (
                          <p key={dup.existing_id} className="text-gray-600 dark:text-gray-400">
                            Row {dup.row_number}: {dup.full_name} ({dup.email})
                          </p>
                        ))}
                        {result.duplicates.length > 5 && <p className="text-gray-500 dark:text-gray-500">...and {result.duplicates.length - 5} more</p>}
                      </div>
                    </details>
                  </div>
                )}

                {/* Invalid rows */}
                {result.invalid_rows.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">Invalid Rows ({result.invalid_rows.length})</h4>
                    <details className="cursor-pointer">
                      <summary className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                        Show details
                      </summary>
                      <div className="mt-2 space-y-1 text-xs">
                        {result.invalid_rows.slice(0, 5).map((row) => (
                          <p key={row.row_number} className="text-red-600 dark:text-red-400">
                            Row {row.row_number}: {row.errors.join(', ')}
                          </p>
                        ))}
                        {result.invalid_rows.length > 5 && <p className="text-gray-500 dark:text-gray-500">...and {result.invalid_rows.length - 5} more</p>}
                      </div>
                    </details>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                  <Button onClick={handleClose}>Done</Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ERROR STAGE */}
          {stage === 'error' && (
            <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900 dark:text-red-200">Import Failed</p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                  <Button variant="outline" onClick={() => setStage('sheet-select')}>
                    Back
                  </Button>
                  <Button onClick={handleImport}>Retry</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  )
}
