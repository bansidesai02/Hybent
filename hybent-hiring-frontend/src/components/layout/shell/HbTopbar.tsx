import {
  lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, Briefcase, Calendar, Loader2, LogOut, Menu, Moon, Search, SearchX, Settings, Sun, User, Users, X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { globalSearch } from '@/api/search'
import { useThemeStore } from '@/store/themeStore'
import type { SearchResult, SearchResults } from '@/types'

const MessageInbox = lazy(() =>
  import('../MessageInbox').then((m) => ({ default: m.MessageInbox }))
)
const NotificationBell = lazy(() =>
  import('../NotificationBell').then((m) => ({ default: m.NotificationBell }))
)

/**
 * The workspace top bar, on the Hybent design system.
 *
 * Message inbox and notification bell stay lazy and deferred behind a short
 * timer, as they were: both open websockets and fetch on mount, and loading
 * them in the first frame measurably delayed first paint on the dashboard.
 * They keep their existing appearance for now — they are migrated with the
 * notification surfaces later, not here.
 */

interface HbTopbarProps {
  onToggleMenu: () => void
  /** Phone top bar title (the current nav item's label). */
  mobileTitle?: string
  /** True once the page's own large title has scrolled away (iOS pattern). */
  showMobileTitle?: boolean
  /** Off in the candidate portal, which has no scoped search API. */
  search?: boolean
  /** Off in the candidate portal, which has no team messaging. */
  messages?: boolean
  /** Extra entries above Sign out. Defaults to Profile and Settings. */
  menuItems?: Array<{ label: string; icon: ReactNode; path: string }>
}

/** Deferred so the bell and inbox never compete with the page's own data. */
function DeferredWidgets({ messages }: { messages: boolean }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 700)
    return () => window.clearTimeout(id)
  }, [])

  const reserved = messages ? 'w-[76px]' : 'w-9'
  if (!ready) return <div className={clsx('h-9', reserved)} aria-hidden />

  return (
    <Suspense fallback={<div className={clsx('h-9', reserved)} aria-hidden />}>
      {messages && (
        <div className="hidden sm:block">
          <MessageInbox />
        </div>
      )}
      <div className="relative">
        <NotificationBell />
      </div>
    </Suspense>
  )
}

function HbTopbarComponent({
  onToggleMenu,
  mobileTitle,
  showMobileTitle = false,
  search = true,
  messages = true,
  menuItems: menuItemsOverride,
}: HbTopbarProps) {
  const { user, logout, basePath } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  const [menuOpen, setMenuOpen] = useState(false)
  // Some avatar sources (a Google-account photo, chiefly) refuse to load for
  // a plain <img> in some referrer/CORS conditions even though the URL is
  // valid — falls back to initials instead of a permanently broken image.
  const [brokenAvatarSrc, setBrokenAvatarSrc] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // Phones: search is an icon that expands into a full-width field.
  const [mobileSearch, setMobileSearch] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const searchRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // `logout()` awaits an API call before navigating away — a synchronous ref
  // guard (not state, since the component unmounts on navigation) stops a
  // fast double-click on "Sign out" from firing it twice. `loggingOut` state
  // sits alongside it purely to render the in-progress spinner; setting state
  // right up to unmount is harmless, React just drops it.
  const loggingOutRef = useRef(false)
  const [loggingOut, setLoggingOut] = useState(false)

  /* ── Search ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      setSearching(false)
      return
    }
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await globalSearch(query))
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  /* Close both popovers on an outside click. */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false)
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  /* Escape closes whichever is open. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setSearchOpen(false)
      setMenuOpen(false)
      setMobileSearch(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  /* Navigating away should not leave a popover hanging. */
  useEffect(() => {
    setSearchOpen(false)
    setMenuOpen(false)
    setMobileSearch(false)
  }, [location.pathname])

  const openMobileSearch = () => {
    // Render the field and focus it inside the same tap: iOS Safari only
    // raises the keyboard for a focus() made synchronously in the gesture.
    flushSync(() => {
      setMobileSearch(true)
      setSearchOpen(true)
    })
    searchInputRef.current?.focus()
  }
  const closeMobileSearch = () => {
    setMobileSearch(false)
    setSearchOpen(false)
    setQuery('')
    setResults(null)
  }

  const onResultClick = useCallback(
    (result: SearchResult) => {
      const path =
        result.type === 'candidate' ? `${basePath}/candidates`
        : result.type === 'job' ? `${basePath}/jobs`
        : result.type === 'interview' ? `${basePath}/interviews`
        : result.type === 'user' ? `${basePath}/teams`
        : basePath

      navigate(path, { state: { search: result.title } })
      setQuery('')
      setResults(null)
      setSearchOpen(false)
      setMobileSearch(false)
    },
    [basePath, navigate]
  )

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  const menuItems = useMemo(
    () =>
      menuItemsOverride ?? [
        { label: 'My Profile', icon: <User size={15} />, path: `${basePath}/profile` },
        { label: 'Settings', icon: <Settings size={15} />, path: `${basePath}/settings` },
      ],
    [menuItemsOverride, basePath]
  )

  const section = (title: string, icon: ReactNode, items: SearchResult[]) => {
    if (!items.length) return null
    return (
      <div key={title} className="mb-3 last:mb-0">
        <h3 className="flex items-center gap-2 px-3 py-1.5 font-mono text-hb-label uppercase text-hb-dim">
          {icon} {title}
        </h3>
        <ul>
          {items.map((res) => (
            <li key={res.id}>
              <button
                type="button"
                onClick={() => onResultClick(res)}
                className="flex w-full items-center gap-3 rounded-hb-sm px-3 py-2 text-left transition-colors duration-hb hover:bg-hb-surface-2 focus-visible:outline-none focus-visible:shadow-hb-ring"
              >
                <span className="grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-hb-sm border border-hb-border bg-hb-surface-2 text-hb-muted">
                  {res.avatar_url ? (
                    <img src={res.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    RESULT_ICON[res.type] ?? <User size={14} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-hb-sm font-semibold text-hb-text">{res.title}</span>
                  <span className="block truncate text-hb-xs text-hb-muted">{res.subtitle}</span>
                </span>
                {res.meta && (
                  <span className="flex-none rounded-hb-full border border-hb-border px-2 py-0.5 font-mono text-hb-micro text-hb-muted">
                    {res.meta}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <header className="relative box-content flex h-14 lg:h-hb-topbar flex-none items-center gap-2 sm:gap-3 border-b border-hb-border bg-hb-surface px-3 sm:px-hb-4 md:px-hb-6 pt-[env(safe-area-inset-top)]">
      {/* Tablet-only drawer toggle (md→lg). Phones use the tab bar's "More". */}
      <button
        type="button"
        onClick={onToggleMenu}
        aria-label="Open navigation"
        className="hidden h-10 w-10 flex-none place-items-center rounded-hb-full border border-hb-border text-hb-muted transition-colors duration-hb hover:bg-hb-surface-2 hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring md:grid lg:hidden"
      >
        <Menu size={18} aria-hidden />
      </button>

      {/* Phone title: the brand mark while the page's own large title is in
          view, then the page name once it scrolls away — like iOS. */}
      {!mobileSearch && (
        <div className="relative h-8 min-w-0 flex-1 md:hidden">
          {/* Same mark + wordmark as the sidebar's brand row. */}
          <span
            className={clsx(
              'absolute inset-y-0 left-0 flex items-center gap-2 transition-opacity duration-hb',
              showMobileTitle && mobileTitle ? 'opacity-0' : 'opacity-100'
            )}
          >
            <img src="/hybent/hybent-mark.png" alt="" className="h-7 w-7 flex-none object-contain" />
            <img
              src={theme === 'dark' ? '/hybent/hybent-wordmark-dark.png' : '/hybent/hybent-wordmark-light.png'}
              alt="Hybent"
              className="h-[16px] w-auto object-contain"
            />
          </span>
          {mobileTitle && (
            <span
              aria-hidden={!showMobileTitle}
              className={clsx(
                'absolute inset-0 flex items-center truncate font-display text-[17px] font-semibold text-hb-text transition-opacity duration-hb',
                showMobileTitle ? 'opacity-100' : 'opacity-0'
              )}
            >
              {mobileTitle}
            </span>
          )}
        </div>
      )}

      {/* ── Search ───────────────────────────────────────────────────────── */}
      {search && (
      <div
        ref={searchRef}
        className={clsx(
          'relative min-w-0 flex-1',
          mobileSearch
            ? 'flex items-center gap-2'
            : 'hidden md:block md:max-w-[440px]'
        )}
      >
        {mobileSearch && (
          <button
            type="button"
            onClick={closeMobileSearch}
            aria-label="Close search"
            className="grid h-10 w-10 flex-none place-items-center rounded-hb-full text-hb-muted active:bg-hb-muted/10 md:hidden"
          >
            <ArrowLeft size={20} aria-hidden />
          </button>
        )}
        <div className="relative min-w-0 flex-1">
        <label htmlFor="workspace-search" className="sr-only">
          Search candidates, roles and interviews
        </label>
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-hb-dim"
        />
        <input
          ref={searchInputRef}
          id="workspace-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search candidates, roles, interviews…"
          enterKeyHint="search"
          className={clsx(
            'h-10 w-full rounded-hb-full border border-hb-border bg-hb-surface-2 pl-11 pr-9',
            'font-body text-hb-sm text-hb-text placeholder:text-hb-dim',
            'transition-[border-color,box-shadow] duration-hb ease-hb',
            'focus:border-hb-blue/60 focus:bg-hb-surface focus:outline-none focus:shadow-hb-ring',
            '[&::-webkit-search-cancel-button]:hidden'
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-hb-dim transition-colors duration-hb hover:bg-hb-muted/10 hover:text-hb-text"
          >
            <X size={13} aria-hidden />
          </button>
        )}
        </div>

        <AnimatePresence>
          {searchOpen && (query || results) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16, ease: [0.2, 0.8, 0.3, 1] }}
              role="region"
              aria-label="Search results"
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-[100] max-h-[min(460px,calc(100dvh-140px))] overflow-y-auto rounded-hb-md border border-hb-border bg-hb-elevated p-2 shadow-hb-3"
            >
              {searching && (
                <p aria-live="polite" className="p-8 text-center text-hb-sm text-hb-muted">
                  Searching for “{query}”…
                </p>
              )}

              {!searching && !results && query && (
                <div className="p-8 text-center">
                  <Search size={26} aria-hidden className="mx-auto mb-2 text-hb-dim opacity-50" />
                  <p className="text-hb-sm font-semibold text-hb-text">Search across everything</p>
                  <p className="text-hb-xs text-hb-muted">Candidates, jobs, team members and more</p>
                </div>
              )}

              {!searching && results && results.total === 0 && (
                <div className="p-8 text-center">
                  <SearchX size={26} aria-hidden className="mx-auto mb-2 text-hb-dim opacity-50" />
                  <p className="text-hb-sm font-semibold text-hb-text">No results found</p>
                  <p className="text-hb-xs text-hb-muted">Try searching for something else</p>
                </div>
              )}

              {!searching && results && results.total > 0 && (
                <>
                  {section('Candidates', <User size={11} />, results.candidates)}
                  {section('Jobs', <Briefcase size={11} />, results.jobs)}
                  {section('Interviews', <Calendar size={11} />, results.interviews)}
                  {section('Team', <Users size={11} />, results.users)}
                  <p
                    aria-live="polite"
                    className="mt-2 border-t border-hb-border pt-2 text-center font-mono text-hb-label uppercase text-hb-dim"
                  >
                    {results.total} results
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      <div className="hidden flex-1 md:block" />

      {/* ── Right cluster ────────────────────────────────────────────────── */}
      <div className={clsx('flex flex-none items-center gap-1 sm:gap-2', mobileSearch && 'hidden md:flex')}>
        {search && (
          <button
            type="button"
            onClick={openMobileSearch}
            aria-label="Search"
            className="grid h-10 w-10 flex-none place-items-center rounded-hb-full text-hb-muted transition-colors duration-hb active:bg-hb-muted/10 focus-visible:outline-none focus-visible:shadow-hb-ring md:hidden"
          >
            <Search size={20} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="hidden h-10 w-10 flex-none place-items-center rounded-hb-full border border-hb-border text-hb-muted transition-colors duration-hb hover:bg-hb-surface-2 hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring md:grid"
        >
          {theme === 'dark' ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
        </button>

        <DeferredWidgets messages={messages} />

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="grid h-9 w-9 md:h-10 md:w-10 place-items-center overflow-hidden rounded-full bg-hb-grad font-display text-hb-xs font-bold text-hb-on-brand transition-transform duration-hb hover:scale-105 focus-visible:outline-none focus-visible:shadow-hb-ring"
          >
            {user?.avatar_url && user.avatar_url !== brokenAvatarSrc ? (
              <img
                src={user.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setBrokenAvatarSrc(user.avatar_url ?? null)}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: [0.2, 0.8, 0.3, 1] }}
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] z-[100] w-56 overflow-hidden rounded-hb-md border border-hb-border bg-hb-elevated p-1.5 shadow-hb-3"
              >
                <div className="border-b border-hb-border px-3 pb-2.5 pt-1.5">
                  <p className="truncate text-hb-sm font-semibold text-hb-text">
                    {user?.full_name || 'Account'}
                  </p>
                  <p className="truncate text-hb-xs text-hb-muted">{user?.email}</p>
                </div>

                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="mt-1 flex items-center gap-2.5 rounded-hb-sm px-3 py-2 text-hb-sm text-hb-text transition-colors duration-hb hover:bg-hb-surface-2 focus-visible:outline-none focus-visible:shadow-hb-ring"
                  >
                    <span className="text-hb-dim">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}

                <button
                  type="button"
                  role="menuitem"
                  onClick={toggleTheme}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-hb-sm px-3 py-2.5 text-left text-hb-sm text-hb-text transition-colors duration-hb hover:bg-hb-surface-2 focus-visible:outline-none focus-visible:shadow-hb-ring md:hidden"
                >
                  <span className="text-hb-dim">
                    {theme === 'dark' ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
                  </span>
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={loggingOut}
                  aria-busy={loggingOut || undefined}
                  onClick={() => {
                    if (loggingOutRef.current) return
                    loggingOutRef.current = true
                    // Left open on purpose — closing immediately gave no sign
                    // that anything was happening during the awaited logout
                    // API call. It closes on its own once `logout()` navigates
                    // to /login and this whole menu unmounts.
                    setLoggingOut(true)
                    logout()
                  }}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-hb-sm px-3 py-2 text-left text-hb-sm text-hb-error transition-colors duration-hb hover:bg-hb-error/8 focus-visible:outline-none focus-visible:shadow-hb-ring disabled:cursor-wait disabled:opacity-70"
                >
                  {loggingOut ? (
                    <>
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Signing out…
                    </>
                  ) : (
                    <>
                      <LogOut size={15} aria-hidden />
                      Sign out
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

const RESULT_ICON: Record<string, ReactNode> = {
  candidate: <User size={14} />,
  job: <Briefcase size={14} />,
  interview: <Calendar size={14} />,
  user: <Users size={14} />,
}

export const HbTopbar = memo(HbTopbarComponent)
