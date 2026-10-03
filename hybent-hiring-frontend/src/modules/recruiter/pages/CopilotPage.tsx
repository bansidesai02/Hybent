/**
 * CopilotPage — full-page Hybent Copilot workspace.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────┐
 *   │ Sidebar (280px)  │  Chat thread + Composer        │
 *   │  - New chat      │  - Message list (scrollable)   │
 *   │  - Conv list     │  - Empty state / prompts       │
 *   │  - Date groups   │  - Approval card               │
 *   │  - Delete        │  - Composer (pinned bottom)    │
 *   └──────────────────────────────────────────────────┘
 *
 * The sidebar collapses into a slide-over drawer on mobile.
 * URL is the source of truth: /copilot/:conversationId loads that conversation.
 * The `useCopilotStore` is shared with CopilotWidget so switching surfaces
 * keeps the active conversation.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, Check, MessageSquarePlus, Menu, Send, Trash2 } from 'lucide-react'
import { useFillShell } from '@/hooks/useFillShell'

import { useCopilotStore } from '@/store/useCopilotStore'
import { useAuthStore } from '@/store/authStore'
import { copilotApi } from '@/api/copilot'
import { candidatesApi } from '@/api/candidates'
import { useCopilotConversations } from '@/modules/recruiter/components/Copilot/useCopilotConversations'
import { useCopilotChat } from '@/modules/recruiter/components/Copilot/useCopilotChat'
import {
  BotMessageContent,
} from '@/modules/recruiter/components/Copilot/CopilotMessageContent'
import {
  EXAMPLE_PROMPTS,
  COPILOT_STOPWORDS,
  fmtTime,
  resolveAndNavigateToCandidateProfile,
} from '@/modules/recruiter/components/Copilot/conversationUtils'
import type { CandidateCardData } from '@/modules/recruiter/components/Copilot/conversationUtils'
import type { ConversationSummary } from '@/api/copilot'

// ── Helpers ───────────────────────────────────────────────────────────────────

function useBasePath() {
  const role = useAuthStore.getState().user?.role
  return role === 'admin' ? '/hiring/admin' : '/hiring/recruiter'
}

// ── Conversation sidebar ──────────────────────────────────────────────────────

function ConvItem({
  conv,
  active,
  deletingId,
  onSelect,
  onDelete,
}: {
  conv: ConversationSummary
  active: boolean
  deletingId: string | null
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      className={[
        'group relative flex cursor-pointer items-center gap-2 rounded-hb-sm px-3 py-2.5 text-hb-sm transition-all',
        active
          ? 'border border-hb-blue/40 bg-hb-blue/8 text-hb-text'
          : 'border border-transparent text-hb-dim hover:border-hb-border hover:bg-hb-surface-2 hover:text-hb-text',
      ].join(' ')}
    >
      <span className="min-w-0 flex-1 truncate leading-snug">{conv.title}</span>
      <span className="shrink-0 font-mono text-[10px] text-hb-dim opacity-0 transition-opacity group-hover:opacity-100">
        {fmtTime(conv.updated_at)}
      </span>
      <button
        title="Delete"
        disabled={!!deletingId}
        onClick={onDelete}
        className="shrink-0 rounded p-0.5 text-hb-muted opacity-0 transition-all hover:text-hb-error group-hover:opacity-100 disabled:cursor-not-allowed"
      >
        {deletingId === conv.id ? (
          <span className="h-3.5 w-3.5 block animate-spin rounded-full border-2 border-hb-border border-t-hb-error" />
        ) : (
          <Trash2 size={13} />
        )}
      </button>
    </div>
  )
}

function Sidebar({
  conversations,
  grouped,
  activeId,
  deletingId,
  clearingAll,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onSelect,
  onDelete,
  onDeleteAll,
  onNewChat,
}: {
  conversations: ConversationSummary[]
  grouped: Record<string, ConversationSummary[]>
  activeId: string | null
  deletingId: string | null
  clearingAll: boolean
  isLoading: boolean
  hasNextPage: boolean | undefined
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  onSelect: (id: string) => void
  onDelete: (e: React.MouseEvent, id: string) => void
  onDeleteAll: () => void
  onNewChat: () => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const ORDER = ['Today', 'Yesterday', 'This Week', 'Older'] as const

  return (
    <aside
      className="flex flex-col border-r border-hb-border"
      style={{ height: '100%', overflow: 'hidden', background: 'rgb(var(--hb-surface-2))' }}
    >
      {/* New chat */}
      <div className="flex-shrink-0 px-3 py-4">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-hb-sm border border-hb-border bg-hb-surface-2 px-4 py-2.5 text-hb-sm font-semibold text-hb-text transition-all hover:border-hb-blue/40 hover:bg-hb-blue/8 hover:text-hb-blue"
        >
          <MessageSquarePlus size={15} />
          New Chat
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isLoading ? (
          <div className="flex flex-col gap-2 px-1 pt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-hb-sm bg-hb-surface-2" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-hb-sm text-hb-muted">
            <Bot size={28} className="text-hb-dim" />
            <p>No conversations yet.</p>
            <p className="text-hb-xs text-hb-dim">Start a chat and it'll appear here.</p>
          </div>
        ) : (
          <>
            {ORDER.map((group) => {
              const items = grouped[group] ?? []
              if (items.length === 0) return null
              return (
                <div key={group} className="mb-1">
                  <p className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-widest text-hb-dim">
                    {group}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {items.map((conv) => (
                      <ConvItem
                        key={conv.id}
                        conv={conv}
                        active={conv.id === activeId}
                        deletingId={deletingId}
                        onSelect={() => onSelect(conv.id)}
                        onDelete={(e) => onDelete(e, conv.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
            {/* Infinite scroll trigger */}
            {hasNextPage && (
              <button
                onClick={fetchNextPage}
                disabled={isFetchingNextPage}
                className="mt-2 w-full py-2 text-center text-hb-xs text-hb-muted transition-colors hover:text-hb-text disabled:opacity-60"
              >
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Clear all */}
      {conversations.length > 0 && (
        <div className="flex-shrink-0 border-t border-hb-border px-3 py-3">
          {showConfirm ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-hb-xs text-hb-muted">Delete all chats?</p>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded px-2 py-1 text-hb-xs text-hb-muted hover:text-hb-text"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDeleteAll(); setShowConfirm(false) }}
                disabled={clearingAll}
                className="rounded bg-hb-error/10 px-2 py-1 text-hb-xs font-semibold text-hb-error hover:bg-hb-error/20 disabled:opacity-60"
              >
                {clearingAll ? 'Deleting…' : 'Confirm'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex w-full items-center gap-1.5 text-hb-xs text-hb-muted transition-colors hover:text-hb-error"
            >
              <Trash2 size={12} /> Clear all history
            </button>
          )}
        </div>
      )}
    </aside>
  )
}

// ── Approval card ─────────────────────────────────────────────────────────────

function ApprovalCard({
  pendingApproval,
  onApprove,
  onDismiss,
}: {
  pendingApproval: any
  onApprove: () => void
  onDismiss: () => void
}) {
  const name = (pendingApproval?.name as string ?? '').replace(/_/g, ' ')
  const args = pendingApproval?.args ?? {}

  return (
    <div className="mx-auto my-2 w-full max-w-3xl">
      <div className="rounded-hb-lg border border-hb-blue/30 bg-hb-blue/5 p-4">
        <p className="mb-1 text-hb-sm font-semibold text-hb-text">Action ready — please approve</p>
        <p className="mb-3 text-hb-xs text-hb-muted capitalize">
          <strong>{name}</strong>
          {Object.keys(args).length > 0 && (
            <> — {Object.entries(args).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ')}</>
          )}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 rounded-hb-sm px-4 py-2 text-hb-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'var(--hb-grad-diag)' }}
          >
            <Check size={14} /> Approve &amp; Run
          </button>
          <button
            onClick={onDismiss}
            className="rounded-hb-sm border border-hb-border px-4 py-2 text-hb-sm text-hb-muted transition-colors hover:text-hb-text"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Composer ──────────────────────────────────────────────────────────────────

function Composer({
  onSend,
  isThinking,
}: {
  onSend: (text: string) => void
  isThinking: boolean
}) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [candidateSuggestions, setCandidateSuggestions] = useState<{ candidate: any; matchedWord: string }[]>([])
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateSuggestions = useCallback((val: string) => {
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
    if (!val || val.trim().length < 2) { setCandidateSuggestions([]); return }
    suggestTimerRef.current = setTimeout(async () => {
      const words = val.split(/\s+/).map((w) => w.replace(/[^a-zA-Z]/g, '').trim())
        .filter((w) => w.length >= 2 && !COPILOT_STOPWORDS.includes(w.toLowerCase()))
      if (words.length === 0) { setCandidateSuggestions([]); return }
      try {
        const seen = new Set<string>()
        const all: { candidate: any; matchedWord: string }[] = []
        for (const w of words.slice(-2)) {
          const res = await candidatesApi.suggest(w)
          for (const item of (res.data || [])) {
            const nameWords = item.full_name.toLowerCase().split(/\s+/)
            if (!seen.has(item.id) && nameWords.some((nw: string) => nw.startsWith(w.toLowerCase()))) {
              seen.add(item.id); all.push({ candidate: item, matchedWord: w })
            }
          }
        }
        setCandidateSuggestions(all.slice(0, 5))
      } catch { setCandidateSuggestions([]) }
    }, 250)
  }, [])

  const send = useCallback(() => {
    const text = value.trim()
    if (!text || isThinking) return
    onSend(text)
    setValue('')
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }
    setCandidateSuggestions([])
  }, [value, isThinking, onSend])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    updateSuggestions(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const applySuggestion = (name: string) => {
    setValue(name)
    setCandidateSuggestions([])
    textareaRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className="flex-shrink-0 border-t border-hb-border bg-hb-surface px-4 py-4">
      <div className="mx-auto w-full max-w-3xl">
        {/* Candidate suggestions */}
        {candidateSuggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {candidateSuggestions.map(({ candidate }) => (
              <button
                key={candidate.id}
                onClick={() => applySuggestion(candidate.full_name)}
                className="flex items-center gap-1.5 rounded-hb-full border border-hb-border bg-hb-surface-2 px-2.5 py-1 text-hb-xs text-hb-text transition-colors hover:border-hb-blue/40 hover:bg-hb-blue/8"
              >
                {candidate.full_name}
              </button>
            ))}
          </div>
        )}
        {/* Textarea row */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask me about candidates, jobs, interviews, pipeline…"
            rows={1}
            disabled={isThinking}
            className="flex-1 resize-none rounded-hb-sm border border-hb-border bg-hb-surface px-4 py-3 text-hb-sm text-hb-text placeholder:text-hb-muted focus:border-hb-blue focus:outline-none focus:ring-2 focus:ring-hb-blue/20 disabled:opacity-60"
            style={{ maxHeight: '160px', overflowY: 'auto' }}
          />
          <button
            onClick={send}
            disabled={!value.trim() || isThinking}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-hb-sm transition-all disabled:opacity-40"
            style={{ background: 'var(--hb-grad-diag)', color: 'rgb(var(--hb-on-brand))' }}
            title="Send"
          >
            {isThinking ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Send size={17} />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-hb-dim">
          AI can make mistakes — always verify candidate details before acting.
        </p>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onSend }: { onSend: (msg: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div
        className="text-5xl"
        style={{ background: 'var(--hb-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
      >
        ✦
      </div>
      <div>
        <h1 className="mb-1 font-display text-xl font-semibold text-hb-text">Hybent Copilot</h1>
        <p className="text-hb-sm text-hb-muted">
          Your AI recruiting partner. Ask about candidates, jobs, interviews, analytics, or pipeline.
        </p>
      </div>
      <div className="grid w-full max-w-lg grid-cols-2 gap-3">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p.prompt}
            onClick={() => onSend(p.prompt)}
            className="flex flex-col gap-2 rounded-hb-sm border border-hb-border bg-hb-surface-2 p-4 text-left transition-all hover:border-hb-blue/40 hover:bg-hb-blue/5"
          >
            <span className="text-xl">{p.icon}</span>
            <span className="text-hb-sm font-semibold text-hb-text">{p.title}</span>
            <span className="text-hb-xs text-hb-muted">{p.prompt}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Thinking dots ─────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 rounded-hb-lg border border-hb-border bg-hb-surface-2 px-4 py-3 text-hb-sm text-hb-muted">
      <span className="animate-[copilotDot_1.2s_infinite_ease-in-out]">●</span>
      <span className="animate-[copilotDot_1.2s_0.2s_infinite_ease-in-out]">●</span>
      <span className="animate-[copilotDot_1.2s_0.4s_infinite_ease-in-out]">●</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CopilotPage() {
  // Escape the shell's responsive padding so this page fills edge-to-edge.
  useFillShell()

  const { conversationId: urlConvId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const basePath = useBasePath()

  const {
    messages,
    addMessage,
    setMessages,
    startNewConversation,
    conversationId,
    setConversationId,
    isThinking,
  } = useCopilotStore()

  const {
    conversations,
    grouped,
    isLoading: convListLoading,
    convLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    loadConversation,
    deleteConversation,
    deletingConvId,
    deleteAll,
    clearingAll,
    scheduleRefetchForNewTitle,
  } = useCopilotConversations()

  const { handleSend, pendingApproval, setPendingApproval } = useCopilotChat({
    onNewConversation: scheduleRefetchForNewTitle,
  })

  // ── Mobile sidebar drawer ─────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── URL → store sync ──────────────────────────────────────────────────────
  useEffect(() => {
    if (urlConvId && urlConvId !== conversationId) {
      // Load the conversation from the URL
      loadConversation(urlConvId).then((detail) => {
        if (!detail) {
          // Unknown id → redirect to base copilot page
          navigate(`${basePath}/copilot`, { replace: true })
          return
        }
        // Restore pending approval if the conversation had one
        if (detail.pending_tool_call) setPendingApproval(detail.pending_tool_call)
      })
    } else if (!urlConvId && conversationId) {
      // /copilot (no id) → start a fresh conversation view
      startNewConversation()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConvId])

  // ── Store conversationId → URL sync (after a new message creates a conv) ──
  useEffect(() => {
    if (conversationId && conversationId !== urlConvId) {
      navigate(`${basePath}/copilot/${conversationId}`, { replace: true })
    }
  }, [conversationId, urlConvId, navigate, basePath])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  // Scroll the thread itself — scrollIntoView would also scroll the shell's
  // overflow-hidden ancestors, pushing the topbar off-screen with no way back.
  const threadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, isThinking])

  // ── Send message ──────────────────────────────────────────────────────────
  const onSend = useCallback(
    (text: string) => {
      handleSend(text, messages)
    },
    [handleSend, messages],
  )

  // ── Approve action ────────────────────────────────────────────────────────
  const onApprove = useCallback(() => {
    if (!pendingApproval) return
    handleSend('', messages, pendingApproval)
  }, [pendingApproval, handleSend, messages])

  // ── New chat ──────────────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    startNewConversation()
    navigate(`${basePath}/copilot`, { replace: true })
    setSidebarOpen(false)
  }, [startNewConversation, navigate, basePath])

  // ── Select conversation ───────────────────────────────────────────────────
  const handleSelectConv = useCallback(
    async (id: string) => {
      const detail = await loadConversation(id)
      if (detail?.pending_tool_call) setPendingApproval(detail.pending_tool_call)
      else setPendingApproval(null)
      navigate(`${basePath}/copilot/${id}`, { replace: true })
      setSidebarOpen(false)
    },
    [loadConversation, navigate, basePath, setPendingApproval],
  )

  // ── View candidate profile ────────────────────────────────────────────────
  const handleViewProfile = useCallback((card: CandidateCardData) => {
    resolveAndNavigateToCandidateProfile(card)
  }, [])

  // ── Grouped sorted by our key order ──────────────────────────────────────
  const sidebarGrouped = grouped

  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height: '100%', background: 'rgb(var(--hb-surface))' }}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}

      {/* Desktop sidebar */}
      <div className="hidden w-72 flex-shrink-0 lg:flex lg:flex-col" style={{ height: '100%' }}>
        <Sidebar
          conversations={conversations}
          grouped={sidebarGrouped}
          activeId={conversationId}
          deletingId={deletingConvId}
          clearingAll={clearingAll}
          isLoading={convListLoading}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          onSelect={handleSelectConv}
          onDelete={deleteConversation}
          onDeleteAll={deleteAll}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute bottom-0 left-0 top-0 w-72 shadow-xl" style={{ height: '100%' }}>
            <Sidebar
              conversations={conversations}
              grouped={sidebarGrouped}
              activeId={conversationId}
              deletingId={deletingConvId}
              clearingAll={clearingAll}
              isLoading={convListLoading}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
              onSelect={handleSelectConv}
              onDelete={deleteConversation}
              onDeleteAll={deleteAll}
              onNewChat={handleNewChat}
            />
          </div>
        </div>
      )}

      {/* ── Main chat area ───────────────────────────────────────────────── */}
      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        style={{ height: '100%', background: 'rgb(var(--hb-surface))' }}
      >
        {/* Topbar with mobile menu */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-hb-border bg-hb-surface px-4 py-3">
          <button
            className="flex items-center justify-center rounded-hb-sm p-1.5 text-hb-muted transition-colors hover:bg-hb-surface-2 hover:text-hb-text lg:hidden"
            onClick={() => setSidebarOpen(true)}
            title="Open conversation list"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg hb-grad-text">✦</span>
            <h1 className="truncate font-display text-base font-semibold text-hb-text">
              {conversationId
                ? (conversations.find((c) => c.id === conversationId)?.title ?? 'Hybent Copilot')
                : 'Hybent Copilot'}
            </h1>
            {isThinking && (
              <span className="text-hb-xs font-normal text-hb-blue/60">thinking…</span>
            )}
          </div>
          {conversationId && (
            <button
              onClick={handleNewChat}
              title="New chat"
              className="flex items-center gap-1.5 rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3 py-1.5 text-hb-xs font-semibold text-hb-muted transition-all hover:border-hb-blue/40 hover:text-hb-text"
            >
              <MessageSquarePlus size={13} /> New Chat
            </button>
          )}
        </div>

        {/* Message thread — min-h-0 lets it shrink when composer grows;
            overscroll-behavior:none stops the macOS rubber-band from revealing
            the body background below. */}
        <div
          ref={threadRef}
          className="flex-1 overflow-y-auto px-4 py-6"
          style={{
            background: 'rgb(var(--hb-surface))',
            minHeight: 0,
            overscrollBehavior: 'none',
          }}
        >
          {convLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-1 text-hb-muted">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-hb-border border-t-hb-blue" />
                <span className="ml-2 text-hb-sm">Loading conversation…</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <EmptyState onSend={onSend} />
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div
                      className="max-w-[78%] break-words rounded-[18px_18px_4px_18px] px-4 py-3 text-hb-sm font-medium leading-relaxed"
                      style={{ background: 'var(--hb-grad-diag)', color: 'rgb(var(--hb-on-brand))' }}
                    >
                      {msg.content === '👍 Action Approved' ? (
                        <span className="flex items-center gap-1.5">
                          <Check size={14} /> Action approved
                        </span>
                      ) : (
                        msg.content
                      )}
                    </div>
                  ) : (
                    <div className="c-bot w-full max-w-[92%] rounded-[18px_18px_18px_4px] border border-hb-border bg-hb-surface-2 px-5 py-4 text-hb-sm leading-relaxed text-hb-text">
                      <BotMessageContent
                        content={msg.content}
                        onSend={onSend}
                        onViewProfile={handleViewProfile}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking indicator */}
              {isThinking && (
                <div className="flex justify-start">
                  <ThinkingDots />
                </div>
              )}

              {/* Approval card */}
              {pendingApproval && !isThinking && (
                <ApprovalCard
                  pendingApproval={pendingApproval}
                  onApprove={onApprove}
                  onDismiss={() => setPendingApproval(null)}
                />
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <Composer onSend={onSend} isThinking={isThinking} />
      </div>

      {/* Global styles for copilot markdown */}
      <style>{`
        .c-bot p{margin:0 0 10px 0;} .c-bot p:last-child{margin:0;}
        .c-bot ul,.c-bot ol{margin:6px 0 10px 20px;padding:0;} .c-bot li{margin:4px 0;}
        .c-bot strong{color:rgb(var(--hb-text));font-weight:600;}
        .c-bot code{background:rgb(var(--hb-surface-2));border-radius:6px;padding:2px 6px;font-size:13px;font-family:ui-monospace,monospace;color:rgb(var(--hb-magenta));border:1px solid var(--hb-border);}
        .c-bot pre{background:rgb(var(--hb-surface-2));padding:12px;border-radius:8px;overflow-x:auto;margin:10px 0;border:1px solid var(--hb-border);}
        .c-bot pre code{background:transparent;border:none;padding:0;color:rgb(var(--hb-text));}
        .copilot-markdown p{margin:0 0 10px 0;} .copilot-markdown p:last-child{margin:0;}
        .copilot-markdown ul,.copilot-markdown ol{margin:6px 0 10px 20px;padding:0;}
        .copilot-markdown li{margin:4px 0;}
        .copilot-markdown strong{font-weight:600;}
        @keyframes copilotDot { 0%,80%,100%{opacity:0.3;} 40%{opacity:1;} }
      `}</style>
    </div>
  )
}
