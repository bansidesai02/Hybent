import { useAuth } from '@/hooks/useAuth'
import { NotificationBell } from './NotificationBell'
import { TeamIcon } from '@/components/common/CustomIcons'
import { MessageInbox } from './MessageInbox'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { globalSearch } from '@/api/search'
import type { SearchResults, SearchResult } from '@/types'
import { 
  Search, 
  Sun, 
  Moon, 
  User, 
  Settings, 
  LogOut, 
  Briefcase, 
  Calendar, 
  Users, 
  SearchX,
  Menu
} from 'lucide-react'


interface TopbarProps {
  title?: string
  onToggleMenu?: () => void
}

export function Topbar({ title, onToggleMenu }: TopbarProps) {
  const { user, logout, basePath } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [isDark, setIsDark] = useState(() => localStorage.getItem('hireon_theme') === 'dark')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  
  const searchRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // Sync dark class on <html> and persist preference
  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('hireon_theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('hireon_theme', 'light')
    }
  }, [isDark])

  // Global Search Debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      setIsSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await globalSearch(searchQuery)
        setSearchResults(results)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close search results on route change or click outside
  useEffect(() => {
    setSearchQuery('')
    setSearchResults(null)
    setSearchFocused(false)
  }, [location.pathname])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleResultClick = (result: SearchResult) => {
    const path = result.type === 'candidate' ? `${basePath}/candidates` 
               : result.type === 'job' ? `${basePath}/jobs`
               : result.type === 'interview' ? `${basePath}/interviews`
               : result.type === 'user' ? `${basePath}/teams`
               : basePath

    // We'll pass the search query to the page state so it can filter locally if needed
    // or just navigate to the relevant list page. 
    // For candidates, we might want to navigate to a specific ID if we had detail pages.
    navigate(path, { state: { search: result.title }})
    setSearchQuery('')
    setSearchResults(null)
    setSearchFocused(false)
  }

  const renderSearchSection = (title: string, icon: React.ReactNode, results: SearchResult[]) => {
    if (results.length === 0) return null
    return (
      <div className="mb-4 last:mb-0">
        <h4 className="px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[var(--text-light)] opacity-60 flex items-center gap-2">
          {icon} {title}
        </h4>
        <div className="space-y-0.5">
          {results.map((res) => (
            <button
              key={res.id}
              onClick={() => handleResultClick(res)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all hover:bg-[var(--sb-hover)] group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center text-[14px] group-hover:scale-110 transition-transform">
                {res.avatar_url ? (
                  <img src={res.avatar_url} alt="" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  resultIconMap[res.type]
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[var(--text)] truncate">{res.title}</p>
                <p className="text-[11px] text-[var(--text-mid)] truncate">{res.subtitle}</p>
              </div>
              {res.meta && (
                <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-[var(--search-bg)] border border-[var(--input-border)] text-[var(--text-light)]">
                  {res.meta}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const resultIconMap: Record<string, React.ReactNode> = {
    candidate: <User size={14} />,
    job: <Briefcase size={14} />,
    interview: <Calendar size={14} />,
    user: <TeamIcon size={14} />
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  const profilePath = `${basePath}/profile`

  const menuItems = [
    { label: 'My Profile', icon: <User size={16} />, path: profilePath },
    { label: 'Settings', icon: <Settings size={16} />, path: `${basePath}/settings` },
  ]

  return (
    <header
      className="flex-shrink-0 flex items-center justify-between gap-4 px-4 md:px-6"
      style={{
        height: '64px',
        background: 'transparent',
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Mobile Menu Toggle */}
      <button 
        onClick={onToggleMenu}
        className="flex lg:hidden items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-100 dark:border-[var(--card-border)] shadow-sm"
      >
        <Menu size={20} className="text-[var(--text)]" />
      </button>

      {/* Search bar */}
      <div className="flex-1 hidden md:flex justify-center" ref={searchRef}>
        <div className="relative w-full max-w-[440px]">
          <div
            className="flex items-center gap-2 w-full rounded-[12px] px-[16px] py-[8px] transition-all duration-200"
            style={{
              background: 'var(--search-bg)',
              border: `1.5px solid ${searchFocused ? 'var(--violet)' : 'var(--input-border)'}`,
              boxShadow: searchFocused ? '0 0 0 4px rgba(167, 139, 250, 0.1)' : 'none',
            }}
          >
            <Search size={18} className="transition-opacity" style={{ opacity: isSearching ? 0 : 0.5 }} />
            {isSearching && (
              <div className="absolute left-[16px] flex items-center">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-[var(--violet)] border-t-transparent rounded-full"
                />
              </div>
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidates, roles, interviews..."
              onFocus={() => setSearchFocused(true)}
              className="border-none bg-transparent text-[13px] outline-none w-full"
              style={{ fontFamily: "'Poppins', sans-serif", color: 'var(--text)' }}
            />
          </div>

          <AnimatePresence>
            {searchFocused && (searchQuery || searchResults) && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                className="absolute top-[calc(100%+8px)] left-0 right-0 max-h-[480px] overflow-y-auto rounded-2xl p-2 z-[100]"
                style={{
                  background: 'var(--sidebar-bg)',
                  border: '1px solid var(--sidebar-border)',
                  boxShadow: 'var(--shadow-h)',
                }}
              >
                {!searchResults && !isSearching && searchQuery && (
                  <div className="p-8 text-center">
                    <Search size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-[13px] font-bold text-[var(--text)]">Search across everything</p>
                    <p className="text-[11px] text-[var(--text-light)]">Candidates, jobs, team members and more</p>
                  </div>
                )}

                {isSearching && !searchResults && (
                  <div className="p-8 text-center">
                    <motion.div 
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-[13px] font-medium text-[var(--text-light)]"
                    >
                      Searching for "{searchQuery}"...
                    </motion.div>
                  </div>
                )}

                {searchResults && (
                  <>
                    {searchResults.total === 0 ? (
                      <div className="p-8 text-center">
                        <SearchX size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-[13px] font-bold text-[var(--text)]">No results found</p>
                        <p className="text-[11px] text-[var(--text-light)]">Try searching for something else</p>
                      </div>
                    ) : (
                      <>
                        {renderSearchSection('Candidates', <User size={12} />, searchResults.candidates)}
                        {renderSearchSection('Jobs', <Briefcase size={12} />, searchResults.jobs)}
                        {renderSearchSection('Interviews', <Calendar size={12} />, searchResults.interviews)}
                        {renderSearchSection('Team', <Users size={12} />, searchResults.users)}
                        
                        <div className="mt-2 p-2 border-t border-[var(--sidebar-border)] text-center">
                          <p className="text-[10px] text-[var(--text-light)] font-bold uppercase tracking-widest opacity-40">
                            {searchResults.total} results found
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-3.5 flex-shrink-0">

        {/* Theme toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center text-[16px] cursor-pointer transition-all duration-200 active:scale-95 shadow-sm"
          style={{ 
            background: 'var(--search-bg)', 
            border: '1.5px solid var(--input-border)',
          }}
        >
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Messages */}
        <div className="relative">
          <MessageInbox />
        </div>

        {/* Notifications */}
        <div className="relative">
          <NotificationBell />
        </div>

        {/* User avatar / menu */}
        <div className="relative ml-1">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-white text-[13px] font-black cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))',
              boxShadow: '0 4px 12px rgba(167, 139, 250, 0.3)',
            }}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-full" />
            ) : (
              initials
            )}
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 top-[46px] w-60 rounded-[18px] z-40 overflow-hidden py-2"
                  style={{
                    background: 'var(--modal-bg)',
                    border: '1px solid var(--sidebar-border)',
                    boxShadow: 'var(--shadow-h)',
                  }}
                >
                  <div
                    className="px-5 py-4 mb-1 border-b border-[var(--sidebar-border)]"
                  >
                    <p className="text-[14px] font-bold text-[var(--text)] leading-tight">
                      {user?.full_name}
                    </p>
                    <p className="text-[11px] text-[var(--text-light)] font-medium mt-0.5">
                      {user?.email}
                    </p>
                  </div>

                  {menuItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { setMenuOpen(false); navigate(item.path) }}
                      className="w-full flex items-center gap-3 px-5 py-2.5 text-[13px] font-bold text-[var(--text-mid)] transition-all hover:bg-[var(--sb-hover)] hover:text-[#6c47ff] group"
                    >
                      <span className="text-[16px] transition-transform group-hover:scale-110">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}

                  <div className="mt-1 pt-1 border-t border-[var(--sidebar-border)]">
                    <button
                      onClick={() => { setMenuOpen(false); logout() }}
                      className="w-full flex items-center gap-3 px-5 py-2.5 text-[13px] font-bold text-red-500 transition-all hover:bg-red-500/10"
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}


