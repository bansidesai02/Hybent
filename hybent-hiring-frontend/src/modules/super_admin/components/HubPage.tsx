import { Suspense, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Tabs } from '@/components/hb'

export interface HubTab {
  value: string
  label: string
  count?: number
  element: ReactNode
}

/**
 * Several super admin pages under one sidebar item, as tabs. The open tab is
 * in the URL (?tab=), so links, notifications and the back button land on it.
 * Each tab is the existing page, unchanged.
 */
export default function HubPage({ tabs, label }: { tabs: HubTab[]; label: string }) {
  const [params, setParams] = useSearchParams()
  const current = tabs.find((t) => t.value === params.get('tab')) ?? tabs[0]

  return (
    <div>
      <Tabs<string>
        aria-label={label}
        value={current.value}
        onChange={(value) => setParams(value === tabs[0].value ? {} : { tab: value }, { replace: true })}
        className="mb-hb-5"
        items={tabs.map((t) => ({ value: t.value, label: t.label, count: t.count || undefined }))}
      />
      <Suspense fallback={null}>
        <div key={current.value}>{current.element}</div>
      </Suspense>
    </div>
  )
}
