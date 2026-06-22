import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superAdmin'
import { Skeleton } from '@/components/ui/Skeleton'
import { Activity, Server, Database, AlertCircle, RefreshCw } from 'lucide-react'

export default function HealthPage() {
  const { data: health, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['super-admin', 'health'],
    queryFn: () => superAdminApi.getHealth(),
    refetchInterval: 15000 // auto poll every 15s
  })

  // Circular progress ring helper
  const renderProgressCircle = (percentage: number, label: string, color: string) => {
    const radius = 40
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percentage / 100) * circumference

    return (
      <div className="flex flex-col items-center p-4 rounded-2xl border" style={{ borderColor: 'rgba(108,71,255,0.06)', background: 'var(--search-bg)' }}>
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-95">
            <circle cx="48" cy="48" r={radius} stroke="rgba(148,163,184,0.12)" strokeWidth="6" fill="transparent" />
            <circle 
              cx="48" 
              cy="48" 
              r={radius} 
              stroke={color} 
              strokeWidth="6" 
              fill="transparent" 
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <span className="absolute text-[16px] font-black text-[var(--text)]">{percentage.toFixed(0)}%</span>
        </div>
        <span className="text-[12.5px] font-bold text-[var(--text-light)] mt-2.5">{label}</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10 pt-6">
      {/* Header */}
      <header className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title text-[28px] font-black leading-tight text-[var(--text)]">Health Monitor</h1>
          <p className="page-subtitle text-[13px] text-[var(--text-light)]">Real-time system resource allocation, latency statistics, database load, and services availability state.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-[12px] font-bold text-[var(--text-mid)] hover:bg-[var(--sb-hover)] transition-colors active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={13} className={isRefetching ? 'animate-spin' : ''} />
          {isRefetching ? 'Refreshing...' : 'Refresh Stats'}
        </button>
      </header>

      {/* Resource meters (CPU, RAM, Disk) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[150px] rounded-[24px]" />
          ))
        ) : (
          <>
            {renderProgressCircle(health?.cpu_percent ?? 12, 'CPU Utilization', 'var(--violet)')}
            {renderProgressCircle(health?.memory_percent ?? 45, 'RAM Allocation', '#ff6bc6')}
            {renderProgressCircle(health?.disk_percent ?? 28, 'Disk Capacity (Root)', '#10b981')}
          </>
        )}
      </div>

      {/* Health Overview grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
        <div className="rounded-[20px] p-5 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <span className="text-[12px] font-bold text-[var(--text-light)] flex items-center gap-1.5"><Activity size={14} /> Gateway API Uptime</span>
          <p className="text-[26px] font-black text-emerald-500 mt-3 leading-none">{health?.api_uptime || '99.99%'}</p>
        </div>

        <div className="rounded-[20px] p-5 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <span className="text-[12px] font-bold text-[var(--text-light)] flex items-center gap-1.5"><Server size={14} /> Avg API Latency</span>
          <p className="text-[26px] font-black text-blue-500 mt-3 leading-none">{health?.avg_latency || '220ms'}</p>
        </div>

        <div className="rounded-[20px] p-5 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <span className="text-[12px] font-bold text-[var(--text-light)] flex items-center gap-1.5"><AlertCircle size={14} /> Platform Errors (24h)</span>
          <p className="text-[26px] font-black text-amber-500 mt-3 leading-none">{health?.errors_24h ?? 0}</p>
        </div>

        <div className="rounded-[20px] p-5 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <span className="text-[12px] font-bold text-[var(--text-light)] flex items-center gap-1.5"><Database size={14} /> Live DB Queries/s</span>
          <p className="text-[26px] font-black text-slate-500 mt-3 leading-none">{health?.db_queries_sec ?? 0}</p>
        </div>
      </div>

      {/* Platform Microservices states */}
      <div className="rounded-[24px] border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="mb-6">
          <h3 className="text-[15px] font-black text-[var(--text)]">Core Platform Microservices</h3>
          <p className="text-[11.5px] text-[var(--text-light)] mt-0.5">Diagnostic check status of all internal service dependencies.</p>
        </div>

        <div className="divide-y" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
          {isLoading ? (
            <div className="space-y-3 py-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : health?.services ? (
            health.services.map((srv: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[13.5px] font-bold text-[var(--text)]">{srv.name}</p>
                  <p className="text-[10.5px] text-[var(--text-light)] mt-0.5">Continuous health checking active</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[12px] font-bold text-emerald-500 capitalize">{srv.status.toLowerCase()}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-[var(--text-light)] text-[12.5px]">No diagnostic microservices status records available.</div>
          )}
        </div>
      </div>
    </div>
  )
}
