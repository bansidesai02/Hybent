import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superAdmin'
import { GlassIcon } from '@/components/common/GlassIcon'
import { Skeleton } from '@/components/ui/Skeleton'
import { 
  CreditCard, 
  Check, 
  HelpCircle,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react'

export default function BillingPage() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val)
  }

  const plans = [
    {
      name: 'Starter',
      price: 8000,
      users: 20,
      jobs: 10,
      features: ['Basic AI Parser', 'Phone Interviews Scheduling', 'Basic Analytics Dashboard'],
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.05)'
    },
    {
      name: 'Pro',
      price: 24000,
      users: 50,
      jobs: 20,
      features: ['Deep AI Scoring Engine', 'Recorded Video Interviews', 'Bulk Candidate Sheet Import'],
      color: 'var(--violet)',
      bg: 'rgba(108, 71, 255, 0.05)',
      popular: true
    },
    {
      name: 'Enterprise',
      price: 60000,
      users: 999,
      jobs: 999,
      features: ['Unlimited AI Scoring', 'Dedicated Custom Subdomain URL', 'Full Reports CSV/Excel Downloads'],
      color: '#ff6bc6',
      bg: 'rgba(255, 107, 198, 0.05)'
    }
  ]

  return (
    <div className="space-y-8 pb-10 pt-6">
      {/* Header */}
      <header className="page-header">
        <h1 className="page-title text-[28px] font-black leading-tight text-[var(--text)]">Billing & Plans</h1>
        <p className="page-subtitle text-[13px] text-[var(--text-light)]">Manage standard subscription packages, limits parameters, and monitor active organization billing contracts.</p>
      </header>

      {/* Subscription Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(p => (
          <div 
            key={p.name}
            className="rounded-[24px] border p-6 flex flex-col justify-between relative overflow-hidden"
            style={{ 
              background: 'var(--card-bg)', 
              borderColor: p.popular ? 'var(--violet)' : 'var(--card-border)',
              boxShadow: p.popular ? '0 10px 30px rgba(108, 71, 255, 0.15)' : 'none'
            }}
          >
            {p.popular && (
              <span 
                className="absolute top-3 right-3 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                style={{ background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))' }}
              >
                POPULAR
              </span>
            )}
            <div>
              <p className="text-[16px] font-black text-[var(--text)]">{p.name}</p>
              <div className="flex items-baseline gap-1 mt-2.5">
                <span className="text-[28px] font-black text-[var(--text)]">{formatCurrency(p.price)}</span>
                <span className="text-[12px] text-[var(--text-light)]">/ month</span>
              </div>
              <p className="text-[11px] text-[var(--text-light)] mt-1">10% discount on yearly payments</p>
              
              <div className="sb-divider my-4" />

              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-[12.5px] font-semibold text-[var(--text-mid)]">
                  <Check className="text-emerald-500 flex-shrink-0" size={15} />
                  <span>Up to {p.users === 999 ? 'Unlimited' : p.users} User Accounts</span>
                </div>
                <div className="flex items-center gap-2.5 text-[12.5px] font-semibold text-[var(--text-mid)]">
                  <Check className="text-emerald-500 flex-shrink-0" size={15} />
                  <span>Up to {p.jobs === 999 ? 'Unlimited' : p.jobs} Active Jobs</span>
                </div>
                {p.features.map(feat => (
                  <div key={feat} className="flex items-center gap-2.5 text-[12.5px] font-semibold text-[var(--text-mid)]">
                    <Check className="text-emerald-500 flex-shrink-0" size={15} />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <button 
              className="w-full mt-6 py-2 rounded-xl text-[12.5px] font-bold text-center border transition-all"
              style={{
                borderColor: p.popular ? 'var(--violet)' : 'var(--input-border)',
                background: p.popular ? 'var(--violet)' : 'transparent',
                color: p.popular ? 'white' : 'var(--text-mid)',
              }}
            >
              Default plan parameters
            </button>
          </div>
        ))}
      </div>

      {/* active billing renewal contracts */}
      <div className="rounded-[24px] border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
          <h3 className="text-[16px] font-black text-[var(--text)] flex items-center gap-2">
            <CreditCard className="text-[var(--violet)]" size={18} />
            Active Organization Billing Contracts
          </h3>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : clients && clients.length > 0 ? (
            <div className="table-responsive">
<table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(108,71,255,0.06)', background: 'rgba(108,71,255,0.01)' }}>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Organization Name</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Plan Subscribed</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Billing cycle</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-right">MRR Price</th>
                  <th className="p-4 text-[11px] font-black text(--text-light) uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr
                    key={client.id}
                    className="border-b last:border-b-0"
                    style={{ borderColor: 'rgba(108,71,255,0.03)' }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--violet)]/10 text-[var(--violet)] flex items-center justify-center font-bold text-[11px]">
                          {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13.5px] font-bold text-[var(--text)]">{client.name}</p>
                          <p className="text-[11px] text-[var(--text-light)]">{client.slug}.hirreon.com</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-[13px] font-bold text-[var(--text)]">{client.plan}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-[12.5px] font-semibold text-[var(--text-mid)] capitalize">Monthly cycle</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-[13.5px] font-black text-[var(--text)]">{formatCurrency(client.mrr)}</span>
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
            <div className="py-14 text-center text-[var(--text-light)] text-[12.5px]">No billing contracts records active.</div>
          )}
        </div>
      </div>
    </div>
  )
}
