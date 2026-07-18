import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { bulkImportApi, type ImportBatchDetail, type ImportBatchSummary } from '@/api/bulkImport'
import { formatDate } from '@/utils/formatters'

interface Props {
  open: boolean
  onClose: () => void
  onRollbackSuccess?: () => void
}

export function BulkImportHistoryModal({ open, onClose, onRollbackSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ImportBatchSummary[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [detail, setDetail] = useState<ImportBatchDetail | null>(null)
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null)
  const [rollbackLoading, setRollbackLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await bulkImportApi.listHistory({
        search: search || undefined,
        status: status === 'all' ? undefined : status,
      })
      setItems(res.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load import history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      load()
      setDetail(null)
    }
  }, [open])

  const handleDetail = async (batchId: string) => {
    try {
      const res = await bulkImportApi.getHistoryDetail(batchId)
      setDetail(res.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load batch details')
    }
  }

  const handleRollback = (batchId: string) => {
    setRollbackTarget(batchId)
  }

  const handleRollbackConfirm = async () => {
    if (!rollbackTarget) return
    setRollbackLoading(true)
    try {
      const res = await bulkImportApi.rollbackBatch(rollbackTarget)
      toast.success(`Rollback complete. Deleted ${res.data.deleted_count} candidates`)
      setRollbackTarget(null)
      await load()
      onRollbackSuccess?.()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Rollback failed')
    } finally {
      setRollbackLoading(false)
    }
  }

  const downloadFailed = (batchId: string) => {
    bulkImportApi.downloadFailedRows(batchId).then((res) => {
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `import_${batchId}_failed_rows.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    }).catch((err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to download failed rows')
    })
  }

  const downloadOriginal = (batchId: string) => {
    bulkImportApi.downloadOriginalFile(batchId).then((res) => {
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `import_${batchId}_original.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    }).catch((err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to download original file')
    })
  }

  const rows = useMemo(() => items, [items])

  return (
    <Modal open={open} onClose={onClose} title="Bulk Import History" size="xl">
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by file name..." />
          <div className="w-full sm:w-44">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'completed', label: 'Completed' },
                { value: 'rolled_back', label: 'Rolled Back' },
              ]}
            />
          </div>
          <Button onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Apply'}</Button>
        </div>

        <div className="max-h-80 overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-3 py-2">File</th>
                <th className="text-left px-3 py-2">Panels</th>
                <th className="text-left px-3 py-2">Summary</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-3 py-2">{row.file_name}</td>
                  <td className="px-3 py-2">{row.selected_panels.join(', ') || 'N/A'}</td>
                  <td className="px-3 py-2">
                    {row.success_count} success / {row.failed_count} failed / {row.duplicate_count} duplicate
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${row.status === 'rolled_back' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{formatDate(row.created_at, 'dd MMM yyyy, hh:mm a')}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" onClick={() => handleDetail(row.id)}>Details</Button>
                      <Button variant="outline" onClick={() => downloadFailed(row.id)}>Failed CSV</Button>
                      <Button variant="outline" onClick={() => downloadOriginal(row.id)}>Original</Button>
                      {row.status !== 'rolled_back' && (
                        <Button onClick={() => handleRollback(row.id)}>Rollback</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={6}>No import history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {detail && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800 space-y-3">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{detail.file_name}</p>
              <p className="text-xs text-gray-500">
                {detail.total_rows} total rows • {detail.success_count} success • {detail.failed_count} failed • {detail.duplicate_count} duplicates
              </p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                Imported Candidates ({detail.candidates.length})
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-900">
                    <tr>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">Email</th>
                      <th className="text-left px-3 py-2">Panel</th>
                      <th className="text-left px-3 py-2">Imported</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.candidates.map((candidate) => (
                      <tr key={candidate.id} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-3 py-2">{candidate.full_name}</td>
                        <td className="px-3 py-2">{candidate.email}</td>
                        <td className="px-3 py-2">{candidate.import_panel_name || '-'}</td>
                        <td className="px-3 py-2">{candidate.imported_at ? formatDate(candidate.imported_at, 'dd MMM yyyy, hh:mm a') : '-'}</td>
                      </tr>
                    ))}
                    {!detail.candidates.length && (
                      <tr>
                        <td colSpan={4} className="px-3 py-3 text-center text-gray-500">No candidates found for this batch.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        <ConfirmModal
          open={!!rollbackTarget}
          onClose={() => setRollbackTarget(null)}
          onConfirm={handleRollbackConfirm}
          title="Rollback Import Batch"
          message="Rollback this import batch? This deletes only candidates imported in this batch."
          confirmText="Rollback"
          danger
          loading={rollbackLoading}
        />
      </div>
    </Modal>
  )
}
