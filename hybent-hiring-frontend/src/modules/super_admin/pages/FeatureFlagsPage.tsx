import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Building2, Sliders, ToggleLeft } from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import {
  Card,
  CardHeader,
  type Column,
  DataTable,
  EmptyState,
  PageHeader,
  Skeleton,
  Switch,
} from '@/components/hb'

/**
 * Platform-wide feature defaults, and the per-tenant overrides that beat them.
 *
 * Rebuilt on the design system in phase 9. Every toggle on this page — five
 * global ones and five per client, so potentially hundreds — was a `<button>`
 * wrapping a translated `<div>` with no accessible name and no state, which
 * meant a screen reader announced the override matrix as a grid of identical
 * unlabelled buttons. They are `Switch` now, each named by its column and row.
 */

const FLAGS = [
  { key: 'ai', title: 'AI scoring engine', short: 'AI scoring', desc: 'Deep AI screening of candidate résumés.' },
  { key: 'video', title: 'Video interviews', short: 'Video', desc: 'Candidates recording asynchronous answers.' },
  { key: 'bulk', title: 'Bulk Excel import', short: 'Bulk import', desc: 'Uploading candidate rosters as a sheet.' },
  { key: 'domain', title: 'Custom subdomain', short: 'Custom domain', desc: 'Branded host URLs for the applicant portal.' },
  { key: 'analytics', title: 'Advanced export', short: 'Export', desc: 'Downloading CSV reports and charts.' },
]

interface ClientRow {
  id: string
  name: string
  slug: string
  flags?: Record<string, boolean>
}

export default function FeatureFlagsPage() {
  const queryClient = useQueryClient()

  const { data: globalFlags, isLoading: globalLoading } = useQuery({
    queryKey: ['super-admin', 'global-flags'],
    queryFn: () => superAdminApi.getGlobalFlags(),
  })

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  const updateGlobalFlagsMutation = useMutation({
    mutationFn: (updatedFlags: Record<string, boolean>) =>
      superAdminApi.updateGlobalFlags(updatedFlags),
    onSuccess: () => {
      toast.success('Global defaults updated')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'global-flags'] })
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update the global defaults.'),
  })

  const updateClientFlagsMutation = useMutation({
    mutationFn: ({ clientId, flags }: { clientId: string; flags: Record<string, boolean> }) =>
      superAdminApi.updateClientFlags(clientId, flags),
    onSuccess: () => {
      toast.success('Client override updated')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update the client override.'),
  })

  const columns: Array<Column<ClientRow>> = [
    {
      key: 'name',
      header: 'Client',
      width: 'minmax(200px, 1.5fr)',
      cardTitle: true,
      cell: (client) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-hb-xs bg-hb-grad font-mono text-hb-micro font-bold text-white">
            {client.name.substring(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-hb-sm font-semibold text-hb-text">
              {client.name}
            </span>
            <span className="block truncate text-hb-xs text-hb-muted">
              {client.slug}.hybent.com
            </span>
          </span>
        </span>
      ),
    },
    ...FLAGS.map<Column<ClientRow>>((f) => ({
      key: f.key,
      header: f.short,
      align: 'center' as const,
      width: '130px',
      cell: (client) => (
        <span className="flex justify-center">
          <Switch
            size="sm"
            /* A matrix cell has no visible label of its own — the column
               header names the flag but is not associated with the control. */
            aria-label={`${f.title} for ${client.name}`}
            checked={Boolean(client.flags?.[f.key])}
            disabled={updateClientFlagsMutation.isPending}
            onChange={(next) =>
              updateClientFlagsMutation.mutate({
                clientId: client.id,
                flags: { ...(client.flags ?? {}), [f.key]: next } as Record<string, boolean>,
              })
            }
          />
        </span>
      ),
    })),
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Feature flags"
        description="Set the defaults new tenants inherit, and override them per client."
      />

      <div className="space-y-hb-5">
        <Card padding="loose">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Sliders size={18} aria-hidden className="text-hb-cyan" />
                Global defaults
              </span>
            }
            subtitle="Applied to new client registrations. Existing overrides are unaffected."
          />

          {globalLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-10 w-full" rounded="md" />
              ))}
            </div>
          ) : globalFlags ? (
            <div className="divide-y divide-hb-border">
              {FLAGS.map((f) => (
                <div key={f.key} className="py-3.5 first:pt-0 last:pb-0">
                  <Switch
                    label={f.title}
                    description={f.desc}
                    checked={Boolean((globalFlags as any)[f.key])}
                    disabled={updateGlobalFlagsMutation.isPending}
                    onChange={(next) =>
                      updateGlobalFlagsMutation.mutate({
                        ...(globalFlags as Record<string, boolean>),
                        [f.key]: next,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ToggleLeft />}
              title="No feature flags"
              description="The platform reported no configurable flags."
            />
          )}
        </Card>

        <Card padding="none">
          <div className="border-b border-hb-border px-5 py-4 xl:px-7">
            <h2 className="inline-flex items-center gap-2 font-display text-hb-h3 text-hb-text">
              <ToggleLeft size={18} aria-hidden className="text-hb-cyan" />
              Per-client overrides
            </h2>
          </div>
          <DataTable
            columns={columns}
            rows={(clients ?? []) as ClientRow[]}
            rowKey={(c) => c.id}
            loading={clientsLoading}
            caption="Feature flag overrides for each client organisation"
            empty={{
              icon: <Building2 />,
              title: 'No clients found',
              description: 'Onboard a tenant to override its feature access.',
              size: 'page',
            }}
          />
        </Card>
      </div>
    </div>
  )
}
