import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import {
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Plus,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react'

import api from '@/api/axios'
import { offersApi } from '@/api/offers'
import { formatDate, formatSalary } from '@/utils/formatters'
import type { Application, Offer, PaginatedResponse } from '@/types'
import { GenerateOfferModal } from '@/modules/recruiter/components/GenerateOfferModal'
import {
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  StatGrid,
  StatusPill,
  Textarea,
} from '@/components/hb'

/**
 * Offer letters.
 *
 * Rebuilt on the design system in phase 6. The page shipped its own `Toast`
 * component — a `fixed bottom-6 right-6` div in emerald or red — while the rest
 * of the product uses `react-hot-toast`, so an offer action and a candidate
 * action produced two different-looking notifications in the same session. It
 * now uses the shared one.
 */

const createSchema = z.object({
  application_id: z.string().min(1, 'Choose a candidate'),
  position_title: z.string().min(1, 'Position title is required'),
  base_salary: z.coerce.number().min(1, 'Base salary is required'),
  salary_currency: z.string().default('USD'),
  bonus: z.coerce.number().nullable().optional(),
  equity: z.string().optional(),
  start_date: z.string().optional(),
  expiry_date: z.string().optional(),
  benefits: z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'].map((c) => ({ value: c, label: c }))

/** Stages at which drafting an offer makes sense. */
const OFFER_READY_STAGES = [
  'hired',
  'hired_joined',
  'offer',
  'offered',
  'interview',
  'interviewed',
  'hr_round_selected',
  'management_round_selected',
  'technical_round_selected',
]

function CreateOfferDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { salary_currency: 'USD', position_title: '' },
  })

  const { data: applications, isLoading } = useQuery({
    queryKey: ['applications-for-offer'],
    queryFn: () =>
      api
        .get<PaginatedResponse<Application>>('/v1/applications?limit=100')
        .then((r) => r.data)
        .catch(() => ({ items: [] as Application[] })),
  })

  const selectedAppId = watch('application_id')

  const options = useMemo(() => {
    if (!applications?.items) return [{ value: '', label: 'Loading candidates…' }]

    const ready = applications.items.filter((app) => {
      const stage = (app.stage || '').toLowerCase()
      const candStage = (app.candidate?.pipeline_stage || '').toLowerCase()
      return OFFER_READY_STAGES.includes(stage) || OFFER_READY_STAGES.includes(candStage)
    })

    if (!ready.length) {
      return [{ value: '', label: 'No candidates at interview, offer or hired stage' }]
    }

    return [
      { value: '', label: 'Select a candidate…' },
      ...ready.map((app) => ({
        value: app.id,
        label: `${app.candidate?.full_name || 'Unknown'} — ${app.job?.title || 'Unknown job'}`,
      })),
    ]
  }, [applications])

  /* Position title follows the selected application unless the user overrides it. */
  useEffect(() => {
    if (!selectedAppId || !applications?.items) return
    const selected = applications.items.find((app) => app.id === selectedAppId)
    if (selected?.job?.title) setValue('position_title', selected.job.title)
  }, [selectedAppId, applications, setValue])

  const mutation = useMutation({
    mutationFn: (data: CreateForm) => offersApi.create(data),
    onSuccess,
  })

  const formId = 'create-offer-form'

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Draft a new offer"
      description="Saved as a draft — nothing is sent to the candidate until you send it."
      footer={
        <>
          <Button variant="quiet" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            form={formId}
            loading={isSubmitting || mutation.isPending}
          >
            Save draft
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit((d) => mutation.mutate(d))} className="pb-2">
        <div className="grid gap-hb-4 md:grid-cols-2">
          <Controller
            name="application_id"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                label="Candidate"
                options={options}
                error={errors.application_id?.message}
                disabled={isLoading}
                fieldClassName="md:col-span-2"
              />
            )}
          />

          <Input
            label="Position title"
            placeholder="Filled in from the application"
            error={errors.position_title?.message}
            fieldClassName="md:col-span-2"
            {...register('position_title')}
          />

          <Input
            label="Base salary"
            type="number"
            placeholder="0"
            error={errors.base_salary?.message}
            {...register('base_salary')}
          />

          <Controller
            name="salary_currency"
            control={control}
            render={({ field }) => <Select {...field} label="Currency" options={CURRENCIES} />}
          />

          <Input label="Annual bonus" type="number" placeholder="Optional" {...register('bonus')} />
          <Input label="Equity" placeholder="e.g. 0.5% over 4 years" {...register('equity')} />

          <Input label="Start date" type="date" {...register('start_date')} />
          <Input label="Expiry date" type="date" {...register('expiry_date')} />

          <Textarea
            label="Benefits & perks"
            placeholder="Health insurance, remote allowance, learning budget…"
            rows={3}
            fieldClassName="md:col-span-2"
            {...register('benefits')}
          />
        </div>

        {mutation.isError && (
          <p
            role="alert"
            className="mt-hb-4 rounded-hb-sm border border-hb-error/25 bg-hb-error/8 p-3 text-hb-sm text-hb-error"
          >
            Could not save the offer. Check the selected candidate and try again.
          </p>
        )}
      </form>
    </Dialog>
  )
}

export default function OffersPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Offer | null>(null)
  const [docxTarget, setDocxTarget] = useState<Offer | null>(null)

  const { data: offers, isLoading, isError } = useQuery({
    queryKey: ['offers'],
    queryFn: () => offersApi.list().then((r) => r.data),
  })

  const stats = useMemo(() => {
    const list = offers ?? []
    return {
      total: list.length,
      accepted: list.filter((o) => o.status === 'accepted').length,
      pending: list.filter((o) => ['draft', 'sent'].includes(o.status)).length,
      declined: list.filter((o) => o.status === 'declined').length,
    }
  }, [offers])

  const generatePdf = useMutation({
    mutationFn: (id: string) => offersApi.generatePdf(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      if (res.data.pdf_url) window.open(res.data.pdf_url, '_blank', 'noopener,noreferrer')
      toast.success('PDF generated')
    },
    onError: () => toast.error('Failed to generate the PDF'),
  })

  const send = useMutation({
    mutationFn: (id: string) => offersApi.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      toast.success('Offer sent to the candidate')
    },
    onError: () => toast.error('Failed to send the offer'),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => offersApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      toast.success('Offer revoked')
      setRevokeTarget(null)
    },
    onError: () => toast.error('Failed to revoke the offer'),
  })

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Offers"
        title="Offers"
        description="Draft, send and track candidate offer letters in one place."
        actions={
          <Button icon={<Plus size={17} />} onClick={() => setShowCreate(true)}>
            New offer letter
          </Button>
        }
      />

      <div className="space-y-hb-6">
        <StatGrid>
          <StatCard label="Total issued" value={stats.total} icon={<FileText />} loading={isLoading} />
          <StatCard label="Accepted" value={stats.accepted} icon={<CheckCircle2 />} loading={isLoading} />
          <StatCard label="Pending" value={stats.pending} icon={<Clock />} loading={isLoading} />
          <StatCard label="Declined" value={stats.declined} icon={<XCircle />} loading={isLoading} />
        </StatGrid>

        {isLoading ? (
          <div className="space-y-hb-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full" rounded="md" />
            ))}
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 p-4 text-hb-sm text-hb-error"
          >
            Could not load offers. Please refresh.
          </div>
        ) : !offers?.length ? (
          <Card padding="none">
            <EmptyState
              icon={<Send />}
              title="No offers yet"
              description="Draft an offer letter for one of your top candidates and track it from here."
              action={{ label: 'Create the first offer', onClick: () => setShowCreate(true) }}
              size="page"
            />
          </Card>
        ) : (
          <ul className="space-y-hb-3">
            {offers.map((offer) => (
              <li key={offer.id}>
                <Card variant="interactive" padding="loose">
                  <div className="flex flex-col gap-hb-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="truncate font-display text-hb-h3 text-hb-text">
                          {offer.position_title}
                        </h3>
                        <StatusPill status={offer.status} />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-hb-sm text-hb-muted">
                        <span className="inline-flex items-center gap-1.5 text-hb-text">
                          <Banknote size={14} aria-hidden className="text-hb-dim" />
                          {formatSalary(offer.base_salary, null, offer.salary_currency)}
                        </span>
                        {offer.start_date && <span>Starts {formatDate(offer.start_date)}</span>}
                        <span className="font-mono text-hb-micro uppercase text-hb-dim">
                          ID {offer.id.slice(-6)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<FileText size={13} />}
                        loading={generatePdf.isPending && generatePdf.variables === offer.id}
                        onClick={() => generatePdf.mutate(offer.id)}
                      >
                        Generate PDF
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Download size={13} />}
                        onClick={() => setDocxTarget(offer)}
                      >
                        DOCX
                      </Button>

                      {offer.status === 'draft' && (
                        <Button
                          size="sm"
                          icon={<Send size={13} />}
                          loading={send.isPending && send.variables === offer.id}
                          onClick={() => send.mutate(offer.id)}
                        >
                          Send offer
                        </Button>
                      )}

                      {offer.pdf_url && (
                        <a
                          href={offer.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open the PDF for ${offer.position_title}`}
                          className="grid h-8 w-8 place-items-center rounded-hb-sm border border-hb-border bg-hb-surface-2 text-hb-muted transition-colors duration-hb hover:border-hb-border-strong hover:text-hb-text"
                        >
                          <ExternalLink size={14} aria-hidden />
                        </a>
                      )}

                      {!['declined', 'revoked', 'expired'].includes(offer.status) && (
                        <button
                          type="button"
                          onClick={() => setRevokeTarget(offer)}
                          aria-label={`Revoke the offer for ${offer.position_title}`}
                          title="Revoke offer"
                          className="grid h-8 w-8 place-items-center rounded-hb-sm border border-hb-error/25 bg-hb-error/8 text-hb-error transition-colors duration-hb hover:bg-hb-error/15 focus-visible:outline-none focus-visible:shadow-hb-ring"
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && (
        <CreateOfferDialog
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['offers'] })
            setShowCreate(false)
            toast.success('Offer draft created')
          }}
        />
      )}

      {docxTarget && (
        <GenerateOfferModal
          onClose={() => setDocxTarget(null)}
          candidate={{ full_name: '' } as any}
          application={{ job: { title: docxTarget.position_title } } as any}
        />
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => revokeTarget && revoke.mutate(revokeTarget.id)}
        title="Revoke this offer?"
        description={`The offer for "${revokeTarget?.position_title}" will be withdrawn and the candidate notified immediately.`}
        confirmLabel="Revoke offer"
        destructive
        loading={revoke.isPending}
      />
    </div>
  )
}
