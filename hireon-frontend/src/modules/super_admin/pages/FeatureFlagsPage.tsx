import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superAdmin'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'react-hot-toast'
import { ToggleLeft, Sliders, ToggleRight, Building2 } from 'lucide-react'

export default function FeatureFlagsPage() {
  const queryClient = useQueryClient()

  // Queries
  const { data: globalFlags, isLoading: globalLoading } = useQuery({
    queryKey: ['super-admin', 'global-flags'],
    queryFn: () => superAdminApi.getGlobalFlags()
  })

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients()
  })

  // Mutations
  const updateGlobalFlagsMutation = useMutation({
    mutationFn: (updatedFlags: Record<string, boolean>) => superAdminApi.updateGlobalFlags(updatedFlags),
    onSuccess: () => {
      toast.success('Global default feature flags updated successfully!')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'global-flags'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update global feature flags.')
    }
  })

  const updateClientFlagsMutation = useMutation({
    mutationFn: ({ clientId, flags }: { clientId: string; flags: Record<string, boolean> }) => 
      superAdminApi.updateClientFlags(clientId, flags),
    onSuccess: () => {
      toast.success('Client feature flags override updated successfully!')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update client feature flags overrides.')
    }
  })

  const handleGlobalFlagChange = (flagKey: string, val: boolean) => {
    if (!globalFlags) return
    const newFlags = { ...globalFlags, [flagKey]: val }
    updateGlobalFlagsMutation.mutate(newFlags)
  }

  const handleClientFlagChange = (client: any, flagKey: string, val: boolean) => {
    const currentFlags = { ...client.flags }
    const newFlags = { ...currentFlags, [flagKey]: val }
    updateClientFlagsMutation.mutate({ clientId: client.id, flags: newFlags })
  }

  const flagConfigs = [
    { key: 'ai', title: 'AI Scoring Engine', desc: 'Default state for deep AI candidate resume screening.' },
    { key: 'video', title: 'Video Interviews', desc: 'Allows candidates recording asynchronous answers.' },
    { key: 'bulk', title: 'Bulk Excel Import', desc: 'Support upload sheet candidate rosters parser.' },
    { key: 'domain', title: 'Custom Subdomain URL', desc: 'Renders custom branded domain host urls.' },
    { key: 'analytics', title: 'Advanced Export metrics', desc: 'Allows downloading CSV reports charts.' }
  ]

  return (
    <div className="space-y-8 pb-10 pt-6">
      {/* Header */}
      <header className="page-header">
        <h1 className="page-title text-[28px] font-black leading-tight text-[var(--text)]">Feature Flags</h1>
        <p className="page-subtitle text-[13px] text-[var(--text-light)]">Control default feature configurations, toggles rules, and override individual organization access flags.</p>
      </header>

      {/* Global Feature Flags defaults */}
      <div className="rounded-[24px] border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="mb-5">
          <h3 className="text-[16px] font-black text-[var(--text)] flex items-center gap-2">
            <Sliders className="text-[var(--violet)]" size={18} />
            Global Platform Defaults
          </h3>
          <p className="text-[11.5px] text-[var(--text-light)] mt-0.5">These defaults determine feature states for new client registrations. Existing organizations overrides are unaffected.</p>
        </div>

        <div className="divide-y" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
          {globalLoading ? (
            <div className="space-y-3 py-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : globalFlags ? (
            flagConfigs.map(f => {
              const val = !!globalFlags[f.key]
              return (
                <div key={f.key} className="flex items-center justify-between py-3.5">
                  <div className="max-w-[80%]">
                    <p className="text-[13.5px] font-bold text-[var(--text)]">{f.title}</p>
                    <p className="text-[11.5px] text-[var(--text-light)] mt-0.5">{f.desc}</p>
                  </div>
                  <button
                    onClick={() => handleGlobalFlagChange(f.key, !val)}
                    disabled={updateGlobalFlagsMutation.isPending}
                    className={`w-10 h-[22px] rounded-full relative p-0.5 transition-colors duration-200 focus:outline-none ${val ? 'bg-[var(--violet)]' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <div 
                      className={`w-[18px] h-[18px] bg-white rounded-full transition-transform duration-200 ${val ? 'translate-x-[18px]' : 'translate-x-0'}`} 
                    />
                  </button>
                </div>
              )
            })
          ) : (
            <div className="py-6 text-center text-[var(--text-light)] text-[12.5px]">No feature flags available.</div>
          )}
        </div>
      </div>

      {/* Per-Client Overrides Matrix */}
      <div className="rounded-[24px] border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
          <h3 className="text-[16px] font-black text-[var(--text)] flex items-center gap-2">
            <ToggleLeft className="text-[var(--violet)]" size={18} />
            Per-Client Feature Override Matrix
          </h3>
        </div>

        <div className="overflow-x-auto">
          {clientsLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : clients && clients.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(108,71,255,0.06)', background: 'rgba(108,71,255,0.01)' }}>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider min-w-[200px]">Client name</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-center">AI Scoring</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-center">Video Interviews</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-center">Bulk Import</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-center">Custom Domain</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-center">Analytics Export</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr
                    key={client.id}
                    className="border-b last:border-b-0 hover:bg-[var(--sb-hover)]/30 transition-colors"
                    style={{ borderColor: 'rgba(108,71,255,0.03)' }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-[var(--violet)]/10 text-[var(--violet)] flex items-center justify-center font-bold text-[10.5px]">
                          {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-[var(--text)]">{client.name}</p>
                          <p className="text-[10.5px] text-[var(--text-light)]">{client.slug}.hirreon.com</p>
                        </div>
                      </div>
                    </td>
                    {['ai', 'video', 'bulk', 'domain', 'analytics'].map(flagKey => {
                      const val = !!client.flags?.[flagKey]
                      return (
                        <td key={flagKey} className="p-4 text-center">
                          <button
                            onClick={() => handleClientFlagChange(client, flagKey, !val)}
                            disabled={updateClientFlagsMutation.isPending}
                            className={`w-9 h-[20px] rounded-full relative p-0.5 transition-colors duration-200 focus:outline-none mx-auto ${val ? 'bg-[var(--violet)]' : 'bg-slate-300 dark:bg-slate-600'}`}
                          >
                            <div 
                              className={`w-[16px] h-[16px] bg-white rounded-full transition-transform duration-200 ${val ? 'translate-x-[16px]' : 'translate-x-0'}`} 
                            />
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-14 text-center">
              <Building2 className="mx-auto text-[var(--text-light)] opacity-20 mb-3" size={42} />
              <p className="text-[14px] font-bold text-[var(--text)]">No clients found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
