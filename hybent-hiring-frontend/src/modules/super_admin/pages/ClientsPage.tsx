import { Fragment, useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Building2, Check, Plus } from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import {
  Badge,
  Button,
  Card,
  type Column,
  DataTable,
  Dialog,
  FilterChips,
  Input,
  PageHeader,
  Select,
  type SortDirection,
  Switch,
  Toolbar,
  ToolbarSearch,
} from '@/components/hb'

/**
 * The tenant directory, and the wizard that creates one.
 *
 * Rebuilt on the design system in phase 9. Beyond appearance:
 *
 * - Both navigations to a client's detail page dropped the `/hiring` prefix
 *   the workspace is mounted under — the row click and the redirect after the
 *   wizard succeeds — so onboarding a client ended on the marketing homepage
 *   instead of the tenant you had just created.
 * - The wizard was a hand-rolled fixed overlay: no focus trap, no Escape, no
 *   `role="dialog"`, and the backdrop click did nothing. It is a `Dialog` now.
 * - The five feature toggles were `<button>`s wrapping a translated `<div>`,
 *   announced as unlabelled buttons with no state. They are the design
 *   system's `Switch`, added for this page and the two other screens that had
 *   each rebuilt the same control.
 * - Sorting was a separate "Sort: …" dropdown beside the search box. The
 *   sortable columns are the table's own headers now, which is where the rest
 *   of the product puts them.
 */

const STATUS_TONE: Record<string, 'success' | 'info' | 'error'> = {
  active: 'success',
  pending: 'info',
  suspended: 'error',
}

const STATUS_FILTERS = ['active', 'pending', 'suspended'] as const

/* The published plans (hybent.com/pricing). Each includes 1 admin + 2
   recruiter seats and 10,000 AI credits a month; the term sets the billing
   cycle. */
const PLANS = [
  { name: 'Standard', price: '$69/mo', desc: 'Billed monthly' },
  { name: '6 months', price: '$66/mo', desc: 'Billed $396 every 6 months' },
  { name: '12 months', price: '$62/mo', desc: 'Billed $744 per year' },
  { name: 'Custom', price: 'Custom', desc: 'Priced by sales' },
]

const FEATURE_FLAGS = [
  { key: 'ai', title: 'AI scoring engine', desc: 'Deep AI screening on incoming résumé attachments.' },
  { key: 'video', title: 'Video interviews', desc: 'Setting up and recording video rounds.' },
  { key: 'bulk', title: 'Bulk candidate import', desc: 'Importing candidate sheets via the Excel/CSV parser.' },
  { key: 'domain', title: 'Custom subdomain', desc: 'Hosting the applicant portal on the organisation’s own URL.' },
  { key: 'analytics', title: 'Advanced export', desc: 'Excel/CSV report downloads.' },
]

const SIZE_OPTIONS = ['1–10', '11–50', '51–200', '201–1000', '1000+'].map((v) => ({
  value: v,
  label: v,
}))

const EMPTY_WIZARD = {
  name: '',
  slug: '',
  industry: '',
  size: '11–50',
  location: 'Ahmedabad, IN',
  admin_email: '',
  plan_name: 'Standard',
  trial_days: 14,
  flags: { ai: true, video: true, bulk: true, domain: false, analytics: false },
}

type WizardData = typeof EMPTY_WIZARD

interface ClientRow {
  id: string
  name: string
  slug: string
  industry?: string
  plan: string
  status: string
  mrr: number
  users_count: number
  users_limit: number
  jobs_count: number
  jobs_limit: number
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val)

export default function ClientsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const [filterStatus, setFilterStatus] = useState<(typeof STATUS_FILTERS)[number] | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: 'name',
    direction: 'asc',
  })
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState<WizardData>(EMPTY_WIZARD)

  const { data: clients, isLoading } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  const resetWizard = () => {
    setWizardStep(1)
    setWizardData(EMPTY_WIZARD)
  }

  const createClientMutation = useMutation({
    mutationFn: (payload: WizardData) => superAdminApi.createClient(payload),
    onSuccess: (data) => {
      toast.success('Client onboarded successfully')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] })
      setIsWizardOpen(false)
      resetWizard()
      if (data && data.org_id) {
        navigate(`/hiring/super-admin/clients/${data.org_id}`)
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to onboard client.')
    },
  })

  // Open the wizard when the dashboard's "Add client" sent us here.
  useEffect(() => {
    if (location.state?.openWizard) {
      setIsWizardOpen(true)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    setWizardData((prev) => ({ ...prev, name, slug }))
  }

  const processedClients = useMemo(() => {
    if (!clients) return []
    let list = [...clients] as ClientRow[]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          (c.industry && c.industry.toLowerCase().includes(q))
      )
    }

    if (filterStatus) list = list.filter((c) => c.status === filterStatus)

    const dir = sort.direction === 'asc' ? 1 : -1
    list.sort((a, b) => {
      switch (sort.key) {
        case 'users': return (a.users_count - b.users_count) * dir
        case 'jobs': return (a.jobs_count - b.jobs_count) * dir
        case 'mrr': return (a.mrr - b.mrr) * dir
        case 'plan': return a.plan.localeCompare(b.plan) * dir
        default: return a.name.localeCompare(b.name) * dir
      }
    })

    return list
  }, [clients, searchQuery, filterStatus, sort])

  const nextWizardStep = () => {
    if (wizardStep === 1) {
      if (!wizardData.name.trim() || !wizardData.slug.trim()) {
        toast.error('Name and subdomain slug are required.')
        return
      }
    } else if (wizardStep === 4) {
      if (!wizardData.admin_email.trim() || !/^\S+@\S+\.\S+$/.test(wizardData.admin_email)) {
        toast.error('A valid administrator email address is required.')
        return
      }
      createClientMutation.mutate(wizardData)
      return
    }
    setWizardStep((prev) => prev + 1)
  }

  const columns: Array<Column<ClientRow>> = [
    {
      key: 'name',
      header: 'Client organisation',
      sortable: true,
      cardTitle: true,
      cell: (c) => (
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-hb-sm bg-hb-grad font-mono text-hb-xs font-bold text-white">
            {c.name.substring(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-hb-sm font-semibold text-hb-text">{c.name}</span>
            <span className="block truncate text-hb-xs text-hb-muted">{c.slug}.hybent.com</span>
          </span>
        </span>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      width: '130px',
      sortable: true,
      cell: (c) => <Badge>{c.plan}</Badge>,
    },
    {
      key: 'users',
      header: 'Users',
      width: '110px',
      align: 'center',
      sortable: true,
      cell: (c) => (
        <span className="font-mono tabular-nums">
          <span className="text-hb-text">{c.users_count}</span>
          <span className="text-hb-dim"> / {c.users_limit}</span>
        </span>
      ),
    },
    {
      key: 'jobs',
      header: 'Jobs',
      width: '110px',
      align: 'center',
      sortable: true,
      cell: (c) => (
        <span className="font-mono tabular-nums">
          <span className="text-hb-text">{c.jobs_count}</span>
          <span className="text-hb-dim"> / {c.jobs_limit}</span>
        </span>
      ),
    },
    {
      key: 'mrr',
      header: 'MRR',
      width: '130px',
      align: 'right',
      sortable: true,
      cell: (c) => (
        <span className="font-mono tabular-nums text-hb-text">{formatCurrency(c.mrr)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      cell: (c) => <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status}</Badge>,
    },
  ]

  const openWizard = () => {
    resetWizard()
    setIsWizardOpen(true)
  }

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Clients"
        description="Onboard new tenants and manage subscriptions, usage and feature access."
        actions={
          <Button icon={<Plus size={15} />} onClick={openWizard}>
            Onboard client
          </Button>
        }
      />

      <Toolbar>
        <ToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search clients…"
          aria-label="Search clients by name, subdomain or industry"
        />
        <FilterChips
          options={STATUS_FILTERS.map((s) => ({
            value: s,
            label: s.charAt(0).toUpperCase() + s.slice(1),
          }))}
          value={filterStatus}
          onChange={setFilterStatus}
          allLabel="All"
        />
      </Toolbar>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={processedClients}
          rowKey={(c) => c.id}
          loading={isLoading}
          sort={sort}
          onSortChange={setSort}
          onRowClick={(c) => navigate(`/hiring/super-admin/clients/${c.id}`)}
          caption="All client organisations on the platform"
          empty={{
            icon: <Building2 />,
            title: 'No clients found',
            description:
              searchQuery || filterStatus
                ? 'Try clearing the search or status filter.'
                : 'Onboard your first tenant to get started.',
            size: 'page',
            action:
              searchQuery || filterStatus
                ? {
                    label: 'Clear filters',
                    onClick: () => { setSearchQuery(''); setFilterStatus(null) },
                  }
                : { label: 'Onboard client', onClick: openWizard },
          }}
        />
      </Card>

      <Dialog
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Onboard a new client"
        description={`Step ${wizardStep} of 4 · set up the tenant workspace.`}
        size="lg"
        footer={
          <>
            {wizardStep > 1 && (
              <Button
                variant="quiet"
                size="sm"
                icon={<ArrowLeft size={14} />}
                onClick={() => setWizardStep((s) => s - 1)}
                disabled={createClientMutation.isPending}
              >
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={nextWizardStep}
              loading={createClientMutation.isPending}
              icon={wizardStep === 4 ? <Check size={14} /> : <ArrowRight size={14} />}
            >
              {wizardStep === 4 ? 'Complete' : 'Next'}
            </Button>
          </>
        }
      >
        {/* Stepper */}
        <ol className="mb-hb-5 flex items-center" aria-label="Onboarding progress">
          {[1, 2, 3, 4].map((step) => (
            <Fragment key={step}>
              <li
                aria-current={wizardStep === step ? 'step' : undefined}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-hb-xs font-bold transition-all duration-hb ${
                  wizardStep === step
                    ? 'border-transparent bg-hb-grad text-white'
                    : wizardStep > step
                      ? 'border-hb-success bg-hb-success text-white'
                      : 'border-hb-border text-hb-dim'
                }`}
              >
                {wizardStep > step ? <Check size={13} aria-hidden /> : step}
                <span className="sr-only">Step {step}</span>
              </li>
              {step < 4 && (
                <span
                  aria-hidden
                  className={`mx-3 h-0.5 flex-1 rounded-full ${
                    wizardStep > step ? 'bg-hb-success' : 'bg-hb-border'
                  }`}
                />
              )}
            </Fragment>
          ))}
        </ol>

        {wizardStep === 1 && (
          <div className="space-y-hb-4">
            <Input
              label="Organisation name"
              required
              value={wizardData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Acme Corp"
            />
            <Input
              label="Workspace subdomain"
              required
              value={wizardData.slug}
              onChange={(e) => setWizardData((p) => ({ ...p, slug: e.target.value }))}
              placeholder="slug"
              description="Their team signs in at this address."
              trailingSlot={<span className="text-hb-xs text-hb-muted">.hybent.com</span>}
            />
            <div className="grid gap-hb-4 sm:grid-cols-2">
              <Input
                label="Industry"
                value={wizardData.industry}
                onChange={(e) => setWizardData((p) => ({ ...p, industry: e.target.value }))}
                placeholder="e.g. Technology"
              />
              <Select
                label="Company size"
                options={SIZE_OPTIONS}
                value={wizardData.size}
                onChange={(e) => setWizardData((p) => ({ ...p, size: e.target.value }))}
              />
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="space-y-hb-4">
            <fieldset>
              <legend className="mb-2 text-hb-sm font-semibold text-hb-text">Plan</legend>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {PLANS.map((p) => {
                  const selected = wizardData.plan_name === p.name
                  return (
                    <button
                      key={p.name}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setWizardData((prev) => ({ ...prev, plan_name: p.name }))}
                      className={`rounded-hb-md border p-3.5 text-left transition-all duration-hb ease-hb focus-visible:outline-none focus-visible:shadow-hb-ring ${
                        selected
                          ? 'border-hb-blue/45 bg-hb-blue/8'
                          : 'border-hb-border hover:border-hb-border-strong'
                      }`}
                    >
                      <p className="text-hb-sm font-semibold text-hb-text">{p.name}</p>
                      <p className="mt-0.5 font-mono text-hb-sm text-hb-cyan">{p.price}</p>
                      <p className="mt-1.5 text-hb-xs leading-tight text-hb-muted">{p.desc}</p>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="grid gap-hb-4 sm:grid-cols-2">
              <Input
                label="Trial days"
                type="number"
                min={0}
                value={wizardData.trial_days}
                onChange={(e) =>
                  setWizardData((p) => ({ ...p, trial_days: Number(e.target.value) }))
                }
              />
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div className="space-y-hb-4">
            <p className="text-hb-sm text-hb-muted">
              Override the platform defaults for this client only.
            </p>
            <div className="divide-y divide-hb-border">
              {FEATURE_FLAGS.map((f) => (
                <div key={f.key} className="py-3.5 first:pt-0 last:pb-0">
                  <Switch
                    label={f.title}
                    description={f.desc}
                    checked={wizardData.flags[f.key as keyof WizardData['flags']]}
                    onChange={(next) =>
                      setWizardData((prev) => ({
                        ...prev,
                        flags: { ...prev.flags, [f.key]: next },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {wizardStep === 4 && (
          <div className="space-y-hb-4">
            <p className="text-hb-sm text-hb-muted">
              The primary administrative account for this workspace.
            </p>
            <Input
              label="Admin email address"
              type="email"
              required
              value={wizardData.admin_email}
              onChange={(e) => setWizardData((p) => ({ ...p, admin_email: e.target.value }))}
              placeholder="e.g. hr@company.com"
              description={
                <>
                  A temporary password of <code className="font-mono text-hb-cyan">password123</code>{' '}
                  is created. They are prompted to reset it on first sign-in.
                </>
              }
            />
          </div>
        )}
      </Dialog>
    </div>
  )
}
