import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Download, FileArchive, FileText, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

import { bulkImportApi, type ResumeImportItem, type ResumeImportStatus } from '@/api/bulkImport'
import { jobsApi } from '@/api/jobs'
import { Badge, Button, Card, Select, StatCard, type BadgeTone } from '@/components/hb'

/**
 * Resume files in bulk: PDF / Word files and ZIPs of them. The server unpacks
 * and parses them in the background; this polls for progress, then lists what
 * happened to every file. A job is optional: with one, each candidate is scored
 * against it (and marked rejected, with the reason, if outside its experience range).
 */

const MAX_MB = 100

const RESULT: Record<string, { label: string; tone: BadgeTone }> = {
  created: { label: 'Added', tone: 'success' },
  duplicate: { label: 'Already in Hybent', tone: 'info' },
  not_resume: { label: 'Not a resume', tone: 'warning' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'error' },
  pending: { label: 'Waiting', tone: 'neutral' },
}

function ItemRow({ it }: { it: ResumeImportItem }) {
  const r = it.rejected ? { label: 'Added · rejected', tone: 'warning' as BadgeTone } : RESULT[it.status] ?? RESULT.pending
  const sub = [it.name ? it.file : '', it.reason].filter(Boolean).join(' · ')
  return (
    <li className="flex items-start gap-3 px-hb-3 py-2">
      <FileText size={15} aria-hidden className="mt-0.5 shrink-0 text-hb-dim" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-hb-sm text-hb-text">{it.name || it.file}</span>
        {sub && <span className="block text-hb-xs text-hb-muted">{sub}</span>}
      </span>
      {typeof it.score === 'number' && <span className="shrink-0 text-hb-xs font-semibold text-hb-muted">{it.score}%</span>}
      <Badge tone={r.tone}>{r.label}</Badge>
    </li>
  )
}

export function ResumeBulkImport({
  files,
  onBack,
  onRemove,
  onFinished,
  onClose,
}: {
  files: File[]
  onBack: () => void
  onRemove: (index: number) => void
  onFinished: (status: ResumeImportStatus) => void
  onClose: () => void
}) {
  const [jobId, setJobId] = useState('')
  const [batchId, setBatchId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const { data: jobs } = useQuery({
    // Own key: 'active-jobs' is cached in other shapes by other pages.
    queryKey: ['active-jobs', 'resume-import'],
    queryFn: () =>
      jobsApi.list({ status: 'active', limit: 100 }).then((r) => {
        const d: any = r.data
        return (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []) as Array<{ id: string; title: string }>
      }),
  })

  const { data: status } = useQuery({
    queryKey: ['resume-import', batchId],
    queryFn: () => bulkImportApi.resumeStatus(batchId!).then((r) => r.data),
    enabled: !!batchId,
    refetchInterval: (q) => (q.state.data?.status === 'completed' ? false : 2000),
  })

  const done = status?.status === 'completed'
  useEffect(() => {
    if (done && status) onFinished(status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  const totalMb = files.reduce((n, f) => n + f.size, 0) / 1024 / 1024
  const zips = files.filter((f) => f.name.toLowerCase().endsWith('.zip')).length

  const start = async () => {
    if (totalMb > MAX_MB) {
      setError(`Keep one import under ${MAX_MB} MB. Split the files into smaller ZIPs.`)
      return
    }
    setStarting(true)
    setError('')
    try {
      const res = await bulkImportApi.startResumes(files, jobId || undefined)
      setBatchId(res.data.id)
    } catch (err: any) {
      const d = err?.response?.data
      setError((typeof d?.detail === 'string' && d.detail) || d?.message || 'Could not start the import. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  const downloadReport = () =>
    bulkImportApi
      .downloadFailedRows(batchId!)
      .then((res) => {
        const url = window.URL.createObjectURL(res.data)
        const a = document.createElement('a')
        a.href = url
        a.download = 'resume_import_report.csv'
        a.click()
        window.URL.revokeObjectURL(url)
      })
      .catch(() => toast.error('Could not download the report.'))

  // ── Before starting: the files and an optional job ──
  if (!batchId) {
    return (
      <div className="space-y-hb-4">
        <Card padding="none">
          <div className="flex items-center justify-between border-b border-hb-border px-hb-3 py-2 text-hb-xs text-hb-muted">
            <span>
              {files.length} file{files.length === 1 ? '' : 's'}
              {zips ? ` · ${zips} ZIP${zips === 1 ? '' : 's'}, opened on upload` : ''}
            </span>
            <span className={totalMb > MAX_MB ? 'font-semibold text-hb-error' : ''}>
              {totalMb.toFixed(1)} / {MAX_MB} MB
            </span>
          </div>
          <ul className="max-h-56 divide-y divide-hb-border overflow-y-auto">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-hb-3 py-2">
                {f.name.toLowerCase().endsWith('.zip') ? (
                  <FileArchive size={15} aria-hidden className="shrink-0 text-hb-violet" />
                ) : (
                  <FileText size={15} aria-hidden className="shrink-0 text-hb-blue" />
                )}
                <span className="min-w-0 flex-1 truncate text-hb-sm text-hb-text">{f.name}</span>
                <span className="shrink-0 text-hb-xs text-hb-muted">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => onRemove(i)}
                  className="rounded p-1 text-hb-dim hover:bg-hb-surface-2 hover:text-hb-text"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Select
          label="Job (optional)"
          description="Pick a job to score every resume against it. Anyone outside its experience range is marked rejected, with the reason."
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          options={[
            { value: '', label: 'No job: add to the talent pool' },
            ...(jobs ?? []).map((j) => ({ value: j.id, label: j.title })),
          ]}
        />

        <p className="text-hb-xs text-hb-muted">
          AI reads each resume, and each one uses AI credits. Files that aren't resumes, and people already in Hybent, are skipped.
        </p>

        {error && (
          <p role="alert" className="flex items-start gap-hb-3 rounded-hb-sm border border-hb-error/30 bg-hb-error/10 p-hb-3 text-hb-sm text-hb-error">
            <AlertCircle size={16} aria-hidden className="mt-px shrink-0" /> {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-hb-border pt-hb-4">
          <Button variant="ghost" onClick={onBack} disabled={starting}>
            Back
          </Button>
          <Button onClick={start} loading={starting} disabled={files.length === 0}>
            {starting ? 'Uploading…' : 'Import resumes'}
          </Button>
        </div>
      </div>
    )
  }

  // ── Running / finished ──
  const pct = status && status.total ? Math.round((status.done / status.total) * 100) : 0
  const items = [...(status?.items ?? [])].sort((a, b) => Number(a.status === 'pending') - Number(b.status === 'pending'))

  return (
    <div className="space-y-hb-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3 text-hb-sm">
          <span className="flex items-center gap-2 font-semibold text-hb-text">
            {done ? (
              <CheckCircle2 size={16} className="text-hb-success" aria-hidden />
            ) : (
              <Loader2 size={16} className="animate-spin text-hb-blue" aria-hidden />
            )}
            {done ? 'Import finished' : `Reading resumes… ${status?.done ?? 0} of ${status?.total ?? '…'}`}
          </span>
          <span className="truncate text-hb-xs text-hb-muted">{status?.job_title ? `Scored for ${status.job_title}` : 'Talent pool'}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-hb-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-hb-blue to-hb-violet transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        {!done && (
          <p className="mt-2 text-hb-xs text-hb-muted">You can close this window. The import keeps running, and it's listed under Import history.</p>
        )}
      </div>

      {status && (
        <div className="grid grid-cols-2 gap-hb-3 sm:grid-cols-4">
          <StatCard label="Added" value={status.created} />
          <StatCard label="Already in Hybent" value={status.duplicate} />
          <StatCard label="Not a resume / skipped" value={status.not_resume + status.skipped} />
          <StatCard label="Failed" value={status.failed} />
        </div>
      )}
      {status && status.rejected > 0 && (
        <p className="text-hb-xs text-hb-muted">
          {status.rejected} added as rejected: outside the job's experience range. The reason is on each profile.
        </p>
      )}

      <Card padding="none">
        <ul className="max-h-64 divide-y divide-hb-border overflow-y-auto">
          {items.map((it, i) => (
            <ItemRow key={`${it.file}-${i}`} it={it} />
          ))}
        </ul>
      </Card>

      <div className="flex justify-end gap-2 border-t border-hb-border pt-hb-4">
        {done && status && status.created < status.total && (
          <Button variant="ghost" onClick={downloadReport}>
            <Download size={14} className="mr-1" aria-hidden /> Download report
          </Button>
        )}
        <Button onClick={onClose}>{done ? 'Done' : 'Close'}</Button>
      </div>
    </div>
  )
}
