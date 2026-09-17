import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Download, Eye, RotateCcw, Search } from 'lucide-react'
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  Dialog,
  Input,
  Select,
  StatusPill,
  type Column,
} from '@/components/hb'
import { bulkImportApi, type ImportBatchDetail, type ImportBatchSummary } from '@/api/bulkImport'
import { formatDate } from '@/utils/formatters'

/**
 * Past bulk imports, with per-batch downloads and a rollback.
 *
 * Search and status are applied by the Apply button, not on change — the filter
 * runs server-side and each keystroke would be a request.
 *
 * Rollback confirms through `ConfirmDialog`, which is portalled, so it is not
 * clipped by this dialog's scrolling body.
 */

type BatchCandidate = ImportBatchDetail['candidates'][number]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'completed', label: 'Completed' },
  { value: 'rolled_back', label: 'Rolled Back' },
]

const CANDIDATE_COLUMNS: Array<Column<BatchCandidate>> = [
  {
    key: 'name',
    header: 'Name',
    cardTitle: true,
    cell: (candidate) => <span className="font-semibold text-hb-text">{candidate.full_name}</span>,
  },
  {
    key: 'email',
    header: 'Email',
    cell: (candidate) => <span className="text-hb-muted">{candidate.email}</span>,
  },
  {
    key: 'panel',
    header: 'Panel',
    cell: (candidate) => candidate.import_panel_name || '-',
  },
  {
    key: 'imported',
    header: 'Imported',
    cell: (candidate) =>
      candidate.imported_at ? formatDate(candidate.imported_at, 'dd MMM yyyy, hh:mm a') : '-',
  },
]

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
  /** The row action currently in flight — every row action is disabled while
   * set, so a fast click can't fire the same download/detail fetch twice. */
  const [busyAction, setBusyAction] = useState<{ id: string; kind: 'detail' | 'failed' | 'original' } | null>(
    null
  )

  const load = async () => {
    setLoading(true)
    try {
      const res = await bulkImportApi.listHistory({
        search: search || undefined,
        status: status === 'all' ? undefined : status,
      })
      setItems(res.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load import history')
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
    if (busyAction) return
    setBusyAction({ id: batchId, kind: 'detail' })
    try {
      const res = await bulkImportApi.getHistoryDetail(batchId)
      setDetail(res.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load batch details')
    } finally {
      setBusyAction(null)
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
      toast.error(err?.response?.data?.message || 'Rollback failed')
    } finally {
      setRollbackLoading(false)
    }
  }

  const downloadFailed = (batchId: string) => {
    if (busyAction) return
    setBusyAction({ id: batchId, kind: 'failed' })
    bulkImportApi
      .downloadFailedRows(batchId)
      .then((res) => {
        const url = window.URL.createObjectURL(res.data)
        const a = document.createElement('a')
        a.href = url
        a.download = `import_${batchId}_failed_rows.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      })
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || 'Failed to download failed rows')
      })
      .finally(() => setBusyAction(null))
  }

  const downloadOriginal = (batchId: string) => {
    if (busyAction) return
    setBusyAction({ id: batchId, kind: 'original' })
    bulkImportApi
      .downloadOriginalFile(batchId)
      .then((res) => {
        const url = window.URL.createObjectURL(res.data)
        const a = document.createElement('a')
        a.href = url
        a.download = `import_${batchId}_original.xlsx`
        a.click()
        window.URL.revokeObjectURL(url)
      })
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || 'Failed to download original file')
      })
      .finally(() => setBusyAction(null))
  }

  const columns: Array<Column<ImportBatchSummary>> = [
    {
      key: 'file',
      header: 'File',
      cardTitle: true,
      cell: (row) => <span className="font-semibold text-hb-text">{row.file_name}</span>,
    },
    {
      key: 'panels',
      header: 'Panels',
      cell: (row) => (
        <span className="text-hb-muted">{row.selected_panels.join(', ') || 'N/A'}</span>
      ),
    },
    {
      key: 'summary',
      header: 'Summary',
      cell: (row) => (
        <span className="whitespace-nowrap text-hb-muted">
          <span className="font-mono font-semibold text-hb-success">{row.success_count}</span>{' '}
          success{' / '}
          <span className="font-mono font-semibold text-hb-error">{row.failed_count}</span> failed
          {' / '}
          <span className="font-mono font-semibold text-hb-warning">{row.duplicate_count}</span>{' '}
          duplicate
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusPill status={row.status} />,
    },
    {
      key: 'date',
      header: 'Date',
      cell: (row) => (
        <span className="whitespace-nowrap text-hb-muted">
          {formatDate(row.created_at, 'dd MMM yyyy, hh:mm a')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => {
        const rowBusy = busyAction?.id === row.id ? busyAction.kind : null
        const otherRowBusy = !!busyAction && busyAction.id !== row.id
        return (
          <div className="flex flex-wrap gap-hb-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Eye size={14} />}
              loading={rowBusy === 'detail'}
              disabled={otherRowBusy || (!!rowBusy && rowBusy !== 'detail')}
              onClick={() => handleDetail(row.id)}
              aria-label={`Details for ${row.file_name}`}
            >
              Details
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={14} />}
              loading={rowBusy === 'failed'}
              disabled={otherRowBusy || (!!rowBusy && rowBusy !== 'failed')}
              onClick={() => downloadFailed(row.id)}
              aria-label={`Failed CSV for ${row.file_name}`}
            >
              Failed CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={14} />}
              loading={rowBusy === 'original'}
              disabled={otherRowBusy || (!!rowBusy && rowBusy !== 'original')}
              onClick={() => downloadOriginal(row.id)}
              aria-label={`Original file for ${row.file_name}`}
            >
              Original
            </Button>
            {row.status !== 'rolled_back' && (
              <Button
                variant="danger"
                size="sm"
                icon={<RotateCcw size={14} />}
                disabled={!!busyAction}
                onClick={() => handleRollback(row.id)}
                aria-label={`Rollback the import of ${row.file_name}`}
              >
                Rollback
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Bulk Import History"
        size="xl"
        footer={
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="space-y-hb-4">
          <div className="flex flex-col gap-hb-3 sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file name…"
              aria-label="Search import history by file name"
              leadingIcon={<Search size={15} />}
              fieldClassName="flex-1"
            />
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter import history by status"
              options={STATUS_OPTIONS}
              fieldClassName="w-full sm:w-44"
            />
            <Button onClick={load} loading={loading}>
              {loading ? 'Loading…' : 'Apply'}
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            <DataTable
              caption="Bulk imports run for this account"
              columns={columns}
              rows={items}
              rowKey={(row) => row.id}
              loading={loading}
              empty={
                search.trim() || status !== 'all'
                  ? {
                      tone: 'no-results',
                      title: 'No import history found',
                      description: 'No batch matches this search and status.',
                    }
                  : {
                      tone: 'empty',
                      title: 'No import history found',
                      description: 'Bulk imports you run are listed here.',
                    }
              }
            />
          </div>

          {detail && (
            <Card padding="compact">
              <CardHeader
                title={detail.file_name}
                subtitle={`${detail.total_rows} total rows • ${detail.success_count} success • ${detail.failed_count} failed • ${detail.duplicate_count} duplicates`}
                action={
                  <Button variant="quiet" size="sm" onClick={() => setDetail(null)}>
                    Hide
                  </Button>
                }
              />
              <p className="mb-hb-2 font-mono text-hb-label uppercase text-hb-muted">
                Imported Candidates ({detail.candidates.length})
              </p>
              <div className="max-h-56 overflow-y-auto">
                <DataTable
                  caption={`Candidates created by the import of ${detail.file_name}`}
                  columns={CANDIDATE_COLUMNS}
                  rows={detail.candidates}
                  rowKey={(candidate) => candidate.id}
                  empty={{ title: 'No candidates found for this batch' }}
                />
              </div>
            </Card>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!rollbackTarget}
        onClose={() => setRollbackTarget(null)}
        onConfirm={handleRollbackConfirm}
        title="Rollback Import Batch"
        description="Rollback this import batch? This deletes only candidates imported in this batch."
        confirmLabel="Rollback"
        destructive
        loading={rollbackLoading}
      />
    </>
  )
}
