import { useQuery } from '@tanstack/react-query'
import { Activity, AlertCircle, Database, RefreshCw, Server } from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  ScoreRing,
  Skeleton,
  StatCard,
  StatGrid,
} from '@/components/hb'

/**
 * Live platform vitals, polled every fifteen seconds.
 *
 * Rebuilt on the design system in phase 9. Two things beyond appearance:
 *
 * - The three resource rings were drawn with a hand-rolled SVG whose rotation
 *   class was `-rotate-95` — not a Tailwind class, so it never applied and
 *   every ring started at three o'clock instead of twelve. They are
 *   `ScoreRing` now.
 * - Those rings were also painted blue, pink and green respectively, which
 *   encoded *which* resource rather than how it was doing: 95% disk was as
 *   green at 95 as it was at 5. `ScoreRing` gained a `polarity` prop for
 *   exactly this — utilisation is a figure that is worse when it is high — so
 *   the ring now goes amber and then red as a resource fills up.
 */

const RESOURCES = [
  { key: 'cpu_percent' as const, label: 'CPU utilisation', fallback: 12 },
  { key: 'memory_percent' as const, label: 'RAM allocation', fallback: 45 },
  { key: 'disk_percent' as const, label: 'Disk capacity (root)', fallback: 28 },
]

export default function HealthPage() {
  const { data: health, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['super-admin', 'health'],
    queryFn: () => superAdminApi.getHealth(),
    refetchInterval: 15_000,
  })

  const errors = health?.errors_24h ?? 0

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Health monitor"
        description="Resource allocation, latency, database load and service availability — refreshed every fifteen seconds."
        actions={
          <Button
            variant="ghost"
            icon={<RefreshCw size={14} className={isRefetching ? 'animate-spin' : undefined} />}
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      <div className="space-y-hb-5">
        {/* Phones: two gauges per row (the third spans), not three screen-tall cards. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-hb-4 max-md:[&>*:last-child:nth-child(odd)]:col-span-2">
          {isLoading
            ? RESOURCES.map((r) => <Skeleton key={r.key} className="h-[176px] w-full" rounded="md" />)
            : RESOURCES.map((r) => {
                const value = (health as any)?.[r.key] ?? r.fallback
                return (
                  <Card key={r.key} padding="default" className="flex flex-col items-center gap-3 max-md:!p-4">
                    <ScoreRing
                      score={value}
                      size={104}
                      strokeWidth={7}
                      polarity="lower-better"
                      label={r.label}
                      suffix="%"
                    />
                    <p className="text-hb-sm font-semibold text-hb-muted">{r.label}</p>
                  </Card>
                )
              })}
        </div>

        <StatGrid>
          <StatCard
            label="Gateway API uptime"
            value={health?.api_uptime || '99.99%'}
            icon={<Activity />}
            loading={isLoading}
          />
          <StatCard
            label="Avg API latency"
            value={health?.avg_latency || '220ms'}
            icon={<Server />}
            loading={isLoading}
          />
          <StatCard
            label="Platform errors (24h)"
            value={errors}
            icon={<AlertCircle />}
            loading={isLoading}
          />
          <StatCard
            label="Live DB queries/s"
            value={health?.db_queries_sec ?? 0}
            icon={<Database />}
            loading={isLoading}
          />
        </StatGrid>

        <Card padding="loose">
          <CardHeader
            title="Core microservices"
            subtitle="Continuous health checks on every internal dependency."
          />

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-10 w-full" rounded="md" />
              ))}
            </div>
          ) : health?.services?.length ? (
            <ul className="divide-y divide-hb-border">
              {health.services.map((srv: any, idx: number) => {
                const up = srv.status === 'Operational'
                return (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-hb-sm font-semibold text-hb-text">{srv.name}</p>
                      <p className="text-hb-xs text-hb-muted">Health check active</p>
                    </div>
                    <Badge tone={up ? 'success' : 'error'} dot="pulse">
                      {up ? 'Operational' : srv.status}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<Server />}
              title="No service diagnostics"
              description="The platform reported no microservice status records."
            />
          )}
        </Card>
      </div>
    </div>
  )
}
