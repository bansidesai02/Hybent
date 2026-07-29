import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superAdmin'
import { GlassIcon } from '@/components/common/GlassIcon'
import { Skeleton } from '@/components/ui/Skeleton'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { 
  Building2, 
  Search, 
  Plus, 
  Trash2, 
  Pause, 
  Play, 
  ShieldAlert, 
  Check, 
  ArrowRight, 
  ArrowLeft,
  X,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react'

export default function ClientsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  // State
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'active' | 'pending' | 'suspended'>('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [sortBy, setSortBy] = React.useState<'name' | 'users' | 'mrr'>('name')
  const [isWizardOpen, setIsWizardOpen] = React.useState(false)
  const [wizardStep, setWizardStep] = React.useState(1)

  // Wizard Data
  const [wizardData, setWizardData] = React.useState({
    name: '',
    slug: '',
    industry: '',
    size: '11–50',
    location: 'Ahmedabad, IN',
    admin_email: '',
    plan_name: 'Pro',
    billing_cycle: 'monthly',
    trial_days: 14,
    flags: {
      ai: true,
      video: true,
      bulk: true,
      domain: false,
      analytics: false
    }
  })

  // Queries
  const { data: clients, isLoading } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  // Mutations
  const createClientMutation = useMutation({
    mutationFn: (payload: any) => superAdminApi.createClient(payload),
    onSuccess: (data) => {
      toast.success('Client onboarding wizard completed successfully!')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] })
      setIsWizardOpen(false)
      resetWizard()
      // Go to client details page
      if (data && data.org_id) {
        navigate(`/super-admin/clients/${data.org_id}`)
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || 'Failed to onboard client.'
      toast.error(msg)
    }
  })

  // Open wizard if navigate passed state
  React.useEffect(() => {
    if (location.state?.openWizard) {
      setIsWizardOpen(true)
      // clear state
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const resetWizard = () => {
    setWizardStep(1)
    setWizardData({
      name: '',
      slug: '',
      industry: '',
      size: '11–50',
      location: 'Ahmedabad, IN',
      admin_email: '',
      plan_name: 'Pro',
      billing_cycle: 'monthly',
      trial_days: 14,
      flags: {
        ai: true,
        video: true,
        bulk: true,
        domain: false,
        analytics: false
      }
    })
  }

  // Handle slug auto generation
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    setWizardData(prev => ({ ...prev, name, slug }))
  }

  const handleFlagToggle = (flagKey: string) => {
    setWizardData(prev => ({
      ...prev,
      flags: {
        ...prev.flags,
        [flagKey]: !prev.flags[flagKey as keyof typeof prev.flags]
      }
    }))
  }

  // Filter & Sort Logic
  const processedClients = React.useMemo(() => {
    if (!clients) return []
    let list = [...clients]

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.slug.toLowerCase().includes(q) ||
        (c.industry && c.industry.toLowerCase().includes(q))
      )
    }

    // Status filter
    if (filterStatus !== 'all') {
      list = list.filter(c => c.status === filterStatus)
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else if (sortBy === 'users') {
        return b.users_count - a.users_count
      } else if (sortBy === 'mrr') {
        return b.mrr - a.mrr
      }
      return 0
    })

    return list
  }, [clients, searchQuery, filterStatus, sortBy])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val)
  }

  // Wizard Steps validation and progression
  const nextWizardStep = () => {
    if (wizardStep === 1) {
      if (!wizardData.name.trim() || !wizardData.slug.trim()) {
        toast.error('Name and subdomain slug are required.')
        return
      }
    } else if (wizardStep === 2) {
      // Plan parameters are prefilled
    } else if (wizardStep === 3) {
      // flags toggled
    } else if (wizardStep === 4) {
      if (!wizardData.admin_email.trim() || !/^\S+@\S+\.\S+$/.test(wizardData.admin_email)) {
        toast.error('A valid administrator email address is required.')
        return
      }
      // Submit wizard!
      createClientMutation.mutate(wizardData)
      return
    }
    setWizardStep(prev => prev + 1)
  }

  const prevWizardStep = () => {
    if (wizardStep > 1) {
      setWizardStep(prev => prev - 1)
    }
  }

  return (
    <div className="space-y-8 pb-10 pt-6">
      {/* Header */}
      <header className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-[28px] font-black leading-tight text-[var(--text)]">Clients Directory</h1>
          <p className="page-subtitle text-[13px] text-[var(--text-light)]">Onboard new SaaS tenants, manage current client subscriptions, usage metrics, and toggles.</p>
        </div>
        <button
          onClick={() => { resetWizard(); setIsWizardOpen(true) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-white transition-all hover:scale-[1.02] active:scale-95 shadow-md self-start md:self-auto"
          style={{
            background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))',
            boxShadow: '0 4px 14px rgba(108, 71, 255, 0.35)',
          }}
        >
          <Plus size={16} />
          Onboard New Client
        </button>
      </header>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 flex-wrap justify-between">
        <div className="flex bg-[var(--search-bg)] border border-[var(--input-border)] rounded-xl p-1 gap-1">
          {(['all', 'active', 'pending', 'suspended'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`text-[12.5px] font-bold px-4 py-1.5 rounded-lg transition-all capitalize ${filterStatus === st ? 'bg-white dark:bg-[var(--card-bg)] text-[var(--violet)] shadow-sm' : 'text-[var(--text-mid)] hover:text-[var(--text)]'}`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div 
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 bg-[var(--search-bg)] border border-[var(--input-border)] w-full sm:w-[220px]"
          >
            <Search size={16} className="text-[var(--text-light)] opacity-60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients..."
              className="border-none bg-transparent text-[12.5px] outline-none w-full text-[var(--text)]"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none pr-8 pl-3 py-1.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[12.5px] font-bold text-[var(--text-mid)] focus:outline-none focus:border-[var(--violet)]"
            >
              <option value="name">Sort: Name</option>
              <option value="users">Sort: Users count</option>
              <option value="mrr">Sort: MRR price</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-light)] pointer-events-none" size={13} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-[24px] border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : processedClients.length > 0 ? (
            <div className="table-responsive">
<table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(108,71,255,0.06)', background: 'rgba(108,71,255,0.01)' }}>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Client Organization</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Plan & billing</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-center">Users Used</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-center">Active Jobs</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-right">Estimated MRR</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {processedClients.map(client => (
                  <tr
                    key={client.id}
                    onClick={() => navigate(`/super-admin/clients/${client.id}`)}
                    className="border-b last:border-b-0 hover:bg-[var(--sb-hover)] cursor-pointer transition-colors duration-150"
                    style={{ borderColor: 'rgba(108,71,255,0.03)' }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-[13px]" style={{ background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))' }}>
                          {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[14px] font-black text-[var(--text)]">{client.name}</p>
                          <p className="text-[11.5px] text-[var(--text-light)]">{client.slug}.hirreon.com</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-[13px] font-bold text-[var(--text)]">{client.plan}</p>
                      <p className="text-[11px] text-[var(--text-light)]">14d trial period</p>
                    </td>
                    <td className="p-4 text-center">
                      <p className="text-[13px] font-bold text-[var(--text)]">{client.users_count}</p>
                      <p className="text-[11px] text-[var(--text-light)]">limit {client.users_limit}</p>
                    </td>
                    <td className="p-4 text-center">
                      <p className="text-[13px] font-bold text-[var(--text)]">{client.jobs_count}</p>
                      <p className="text-[11px] text-[var(--text-light)]">limit {client.jobs_limit}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="text-[13.5px] font-black text-[var(--text)]">{formatCurrency(client.mrr)}</p>
                      <p className="text-[11px] text-[var(--text-light)]">billed monthly</p>
                    </td>
                    <td className="p-4">
                      <span
                        className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                        style={{
                          background: client.status === 'active' ? 'rgba(16,185,129,0.1)' : client.status === 'pending' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                          color: client.status === 'active' ? '#10b981' : client.status === 'pending' ? '#3b82f6' : '#ef4444'
                        }}
                      >
                        {client.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          ) : (
            <div className="py-20 text-center">
              <Building2 className="mx-auto text-[var(--text-light)] opacity-20 mb-4" size={48} />
              <p className="text-[15px] font-bold text-[var(--text)]">No clients found</p>
              <p className="text-[12.5px] text-[var(--text-light)] mt-1">Try resetting filters or adding a new client.</p>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div 
            className="w-full max-w-[620px] rounded-[24px] overflow-hidden border flex flex-col shadow-2xl animate-scale-up"
            style={{ background: 'var(--modal-bg)', borderColor: 'var(--sidebar-border)' }}
          >
            {/* Modal Head */}
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--violet)]/10 flex items-center justify-center text-[var(--violet)]">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-[16px] font-black text-[var(--text)]">Onboard New Client</h3>
                  <p className="text-[11.5px] text-[var(--text-light)]">Step {wizardStep} of 4 &middot; Set up tenant workspace</p>
                </div>
              </div>
              <button 
                onClick={() => setIsWizardOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-[var(--sb-hover)] flex items-center justify-center text-[var(--text-light)] hover:text-[var(--text)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stepper Progress */}
            <div className="px-8 py-4 flex items-center justify-between border-b" style={{ borderColor: 'rgba(108,71,255,0.03)' }}>
              {[1, 2, 3, 4].map(step => (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center">
                    <div 
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold border transition-all duration-300 ${wizardStep === step ? 'bg-[var(--violet)] text-white border-[var(--violet)]' : wizardStep > step ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-transparent text-[var(--text-light)] border-[var(--input-border)]'}`}
                    >
                      {wizardStep > step ? <Check size={14} /> : step}
                    </div>
                  </div>
                  {step < 4 && (
                    <div className="flex-1 h-[2px] mx-4 rounded" style={{ background: wizardStep > step ? '#10b981' : 'rgba(108,71,255,0.06)' }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Modal Body (Wizard steps) */}
            <div className="p-6 flex-1 overflow-y-auto max-h-[380px] space-y-4">
              {/* Step 1: Client details */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h4 className="text-[14px] font-black text-[var(--text)]">Organization Details</h4>
                  
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[var(--text-mid)]">Organization Name *</label>
                    <input
                      type="text"
                      value={wizardData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. Brainerhub Solutions"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--violet)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[var(--text-mid)]">Workspace Subdomain *</label>
                    <div className="flex items-stretch border border-[var(--input-border)] bg-[var(--search-bg)] rounded-xl overflow-hidden">
                      <input
                        type="text"
                        value={wizardData.slug}
                        onChange={(e) => setWizardData(prev => ({ ...prev, slug: e.target.value }))}
                        placeholder="slug"
                        className="flex-1 px-3.5 py-2.5 bg-transparent text-[13px] text-[var(--text)] focus:outline-none"
                      />
                      <span className="px-3 bg-[var(--sb-hover)] border-l text-[var(--text-light)] text-[12.5px] flex items-center">
                        .hirreon.com
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--text-mid)]">Industry</label>
                      <input
                        type="text"
                        value={wizardData.industry}
                        onChange={(e) => setWizardData(prev => ({ ...prev, industry: e.target.value }))}
                        placeholder="e.g. Technology"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--text-mid)]">Company Size</label>
                      <select
                        value={wizardData.size}
                        onChange={(e) => setWizardData(prev => ({ ...prev, size: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none"
                      >
                        <option>1–10</option>
                        <option>11–50</option>
                        <option>51–200</option>
                        <option>201–1000</option>
                        <option>1000+</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Subscription details */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h4 className="text-[14px] font-black text-[var(--text)]">Subscription Setup</h4>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { name: 'Starter', price: '₹8k/mo', desc: '20 Users / 10 Jobs' },
                      { name: 'Pro', price: '₹24k/mo', desc: '50 Users / 20 Jobs' },
                      { name: 'Enterprise', price: '₹60k/mo', desc: 'Unlimited bounds' },
                    ].map(p => (
                      <div 
                        key={p.name}
                        onClick={() => setWizardData(prev => ({ ...prev, plan_name: p.name }))}
                        className={`p-3.5 rounded-xl border cursor-pointer text-left transition-all ${wizardData.plan_name === p.name ? 'border-[var(--violet)] bg-[var(--violet)]/5 shadow-sm' : 'border-[var(--input-border)] hover:bg-[var(--sb-hover)]'}`}
                      >
                        <p className="text-[13px] font-bold text-[var(--text)]">{p.name}</p>
                        <p className="text-[12px] text-[var(--violet)] font-black mt-0.5">{p.price}</p>
                        <p className="text-[10px] text-[var(--text-light)] mt-1.5 leading-tight">{p.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--text-mid)]">Billing Cycle</label>
                      <select
                        value={wizardData.billing_cycle}
                        onChange={(e) => setWizardData(prev => ({ ...prev, billing_cycle: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly (Discounted)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--text-mid)]">Trial Days</label>
                      <input
                        type="number"
                        value={wizardData.trial_days}
                        onChange={(e) => setWizardData(prev => ({ ...prev, trial_days: Number(e.target.value) }))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Feature flags overrides */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[14px] font-black text-[var(--text)]">Feature Toggles Override</h4>
                      <p className="text-[11px] text-[var(--text-light)]">Override feature flags state specifically for this client.</p>
                    </div>
                  </div>

                  <div className="divide-y" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
                    {[
                      { key: 'ai', title: 'AI Scoring Engine', desc: 'Enables deep AI screening on incoming resume attachments.' },
                      { key: 'video', title: 'Video Interviews', desc: 'Allows setting up and recording video rounds.' },
                      { key: 'bulk', title: 'Bulk Candidate Import', desc: 'Allows import of candidate sheets via Excel/CSV parser.' },
                      { key: 'domain', title: 'Custom Subdomain', desc: 'Allows hosting applicant portal on organization custom URL.' },
                      { key: 'analytics', title: 'Advanced Export', desc: 'Enables Excel/CSV reports downloads.' }
                    ].map(f => (
                      <div key={f.key} className="flex items-center justify-between py-3">
                        <div className="max-w-[75%]">
                          <p className="text-[12.5px] font-bold text-[var(--text)]">{f.title}</p>
                          <p className="text-[11px] text-[var(--text-light)] mt-0.5">{f.desc}</p>
                        </div>
                        <button
                          onClick={() => handleFlagToggle(f.key)}
                          className={`w-10 h-[22px] rounded-full relative p-0.5 transition-colors duration-200 focus:outline-none ${wizardData.flags[f.key as keyof typeof wizardData.flags] ? 'bg-[var(--violet)]' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                          <div 
                            className={`w-[18px] h-[18px] bg-white rounded-full transition-transform duration-200 ${wizardData.flags[f.key as keyof typeof wizardData.flags] ? 'translate-x-[18px]' : 'translate-x-0'}`} 
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Administrator Account */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h4 className="text-[14px] font-black text-[var(--text)]">Platform Administrator</h4>
                  <p className="text-[11.5px] text-[var(--text-light)]">Create the primary administrative account link for this workspace organization.</p>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[var(--text-mid)]">Admin Email Address *</label>
                    <input
                      type="email"
                      value={wizardData.admin_email}
                      onChange={(e) => setWizardData(prev => ({ ...prev, admin_email: e.target.value }))}
                      placeholder="e.g. hr@company.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--violet)]"
                    />
                    <p className="text-[10.5px] text-[var(--text-light)] mt-1">
                      A temporary password link will be created: <code className="font-mono text-[var(--violet)]">password123</code>. The administrator will be prompted to reset this credential upon first session login.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Foot */}
            <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
              <span className="text-[11.5px] font-bold text-[var(--text-light)]">
                {wizardStep === 4 ? 'Ready to onboarding' : 'Step ' + wizardStep + ' of 4'}
              </span>
              <div className="flex gap-2.5">
                {wizardStep > 1 && (
                  <button
                    onClick={prevWizardStep}
                    className="flex items-center gap-1.5 px-4 py-2 border rounded-xl text-[12px] font-bold text-[var(--text-mid)] hover:bg-[var(--sb-hover)] transition-colors"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                )}
                <button
                  onClick={nextWizardStep}
                  disabled={createClientMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))',
                    opacity: createClientMutation.isPending ? 0.65 : 1
                  }}
                >
                  {createClientMutation.isPending ? (
                    'Saving...'
                  ) : wizardStep === 4 ? (
                    <>Complete Wizard <Check size={14} /></>
                  ) : (
                    <>Next <ArrowRight size={14} /></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
