import { useEffect, useMemo, useState } from 'react'
import { Search, Check, X, Loader2 } from 'lucide-react'
import { Avatar } from '@/components/hb'
import { adminApi } from '@/api/admin'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

interface MemberPickerProps {
  selected: string[]
  onChange: (ids: string[]) => void
  /** Users who can't be picked (already members). */
  excludeIds?: string[]
}

/** Searchable multi-select of active teammates in the caller's organization. */
export function MemberPicker({ selected, onChange, excludeIds = [] }: MemberPickerProps) {
  const me = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<User[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    adminApi
      .listUsers()
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]))
  }, [])

  const candidates = useMemo(() => {
    const skip = new Set([...excludeIds, me?.id])
    const q = query.trim().toLowerCase()
    return (users ?? [])
      .filter((u) => u.is_active && u.role !== 'candidate' && !skip.has(u.id))
      .filter((u) => !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [users, query, excludeIds, me?.id])

  const byId = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users])
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const u = byId.get(id)
            return (
              <span
                key={id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-hb-border bg-hb-surface-2 py-1 pl-1 pr-1.5 text-hb-xs font-medium text-hb-text"
              >
                <Avatar name={u?.full_name ?? '?'} src={u?.avatar_url || ''} size="xs" />
                <span className="truncate">{u?.full_name ?? 'Member'}</span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="rounded-full p-0.5 text-hb-dim hover:bg-hb-surface hover:text-hb-text"
                  aria-label={`Remove ${u?.full_name ?? 'member'}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <label className="flex items-center gap-2 rounded-hb-sm border border-hb-border bg-hb-surface px-3 transition-colors focus-within:border-hb-blue/50">
        <Search className="h-4 w-4 shrink-0 text-hb-dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teammates by name or email"
          className="h-10 min-w-0 flex-1 border-0 bg-transparent text-hb-sm text-hb-text outline-none ring-0 placeholder:text-hb-dim focus:outline-none focus:ring-0"
        />
      </label>

      <ul className="max-h-64 min-h-0 divide-y divide-hb-border overflow-y-auto rounded-hb-sm border border-hb-border">
        {users === null ? (
          <li className="flex justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-hb-dim" />
          </li>
        ) : candidates.length === 0 ? (
          <li className="p-6 text-center text-hb-xs text-hb-dim">No teammates to add.</li>
        ) : (
          candidates.map((u) => {
            const on = selected.includes(u.id)
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => toggle(u.id)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-hb-surface-2 ${on ? 'bg-hb-blue/5' : ''}`}
                >
                  <Avatar name={u.full_name} src={u.avatar_url || ''} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-hb-sm font-semibold text-hb-text">{u.full_name}</span>
                    <span className="block truncate text-hb-xs text-hb-muted">
                      {u.email} · <span className="capitalize">{u.role.replace('_', ' ')}</span>
                    </span>
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      on ? 'border-transparent bg-hb-grad text-white' : 'border-hb-border-strong'
                    }`}
                  >
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
