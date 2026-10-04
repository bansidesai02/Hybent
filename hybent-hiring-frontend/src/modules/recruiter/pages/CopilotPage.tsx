/**
 * CopilotPage — the full-page Recruiter Copilot.
 *
 * A one-row header, then two cards that fill the shell's main area —
 * conversation history on the left, the thread and composer on the right.
 * The page is exactly one viewport tall (useFillShell) and each card scrolls
 * on its own. History moves into a Drawer below `lg`.
 *
 * URL is the source of truth: /copilot/:conversationId loads that conversation.
 * `useCopilotStore` is shared with CopilotWidget so switching surfaces keeps
 * the active conversation.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  GitBranch,
  History,
  MessageSquarePlus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'

import { useFillShell } from '@/hooks/useFillShell'
import { PHONE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery'
import { useCopilotStore } from '@/store/useCopilotStore'
import { useAuthStore } from '@/store/authStore'
import { candidatesApi } from '@/api/candidates'
import type { ConversationSummary } from '@/api/copilot'
import {
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  IconTile,
  Skeleton,
} from '@/components/hb'
import { useCopilotConversations } from '@/modules/recruiter/components/Copilot/useCopilotConversations'
import { useCopilotChat } from '@/modules/recruiter/components/Copilot/useCopilotChat'
import { BotMessageContent } from '@/modules/recruiter/components/Copilot/CopilotMessageContent'
import { CopilotSteps } from '@/modules/recruiter/components/Copilot/CopilotSteps'
import {
  EXAMPLE_PROMPTS,
  COPILOT_STOPWORDS,
  fmtTime,
  resolveAndNavigateToCandidateProfile,
} from '@/modules/recruiter/components/Copilot/conversationUtils'
import type { CandidateCardData } from '@/modules/recruiter/components/Copilot/conversationUtils'

// The shared prompts carry emoji for the popup; the page uses the design
// system's icon tiles instead.
const PROMPT_ICONS: Record<string, ReactNode> = {
  'Search Talent': <Search />,
  Analytics: <BarChart3 />,
  Interviews: <CalendarDays />,
  Pipeline: <GitBranch />,
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Older'] as const

function useBasePath() {
  const role = useAuthStore.getState().user?.role
  return role === 'admin' ? '/hiring/admin' : '/hiring/recruiter'
}

// ── Conversation history ──────────────────────────────────────────────────────

function ConversationRow({
  conv,
  active,
  deleting,
  disabled,
  onSelect,
  onDelete,
}: {
  conv: ConversationSummary
  active: boolean
  deleting: boolean
  disabled: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-current={active ? 'true' : undefined}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
        className={clsx(
          'group relative flex cursor-pointer items-center gap-2 rounded-hb-sm px-3 py-2 text-hb-sm',
          'transition-colors duration-hb ease-hb',
          active
            ? 'bg-hb-blue/10 text-hb-text'
            : 'text-hb-muted hover:bg-hb-surface-2 hover:text-hb-text',
        )}
      >
        {active && (
          <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-hb-grad" />
        )}
        <span className="min-w-0 flex-1 truncate">{conv.title}</span>
        <span className="shrink-0 font-mono text-[10.5px] text-hb-dim group-hover:hidden">
          {fmtTime(conv.updated_at)}
        </span>
        <button
          type="button"
          aria-label={`Delete "${conv.title}"`}
          disabled={disabled}
          onClick={onDelete}
          className="hidden shrink-0 rounded-hb-sm p-1 text-hb-dim transition-colors hover:text-hb-error group-hover:block disabled:cursor-not-allowed"
        >
          {deleting ? (
            <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-hb-border border-t-hb-error" />
          ) : (
            <Trash2 size={14} />
          )}
        </button>
      </div>
    </li>
  )
}

function ConversationList({
  conversations,
  grouped,
  activeId,
  deletingId,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onSelect,
  onDelete,
  onNewChat,
}: {
  conversations: ConversationSummary[]
  grouped: Record<string, ConversationSummary[]>
  activeId: string | null
  deletingId: string | null
  isLoading: boolean
  hasNextPage: boolean | undefined
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  onSelect: (id: string) => void
  onDelete: (e: React.MouseEvent, id: string) => void
  onNewChat: () => void
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-1">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<History />}
        title="No conversations yet"
        description="Your chats with Copilot are saved here."
        action={{ label: 'Start a chat', onClick: onNewChat }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {GROUP_ORDER.map((group) => {
        const items = grouped[group] ?? []
        if (items.length === 0) return null
        return (
          <section key={group}>
            <h3 className="mb-1 px-3 font-mono text-[10.5px] uppercase tracking-[.16em] text-hb-dim">
              {group}
            </h3>
            <ul className="flex flex-col gap-0.5">
              {items.map((conv) => (
                <ConversationRow
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeId}
                  deleting={deletingId === conv.id}
                  disabled={!!deletingId}
                  onSelect={() => onSelect(conv.id)}
                  onDelete={(e) => onDelete(e, conv.id)}
                />
              ))}
            </ul>
          </section>
        )
      })}
      {hasNextPage && (
        <Button variant="quiet" size="sm" fullWidth loading={isFetchingNextPage} onClick={fetchNextPage}>
          Load older chats
        </Button>
      )}
    </div>
  )
}

// ── Thread pieces ─────────────────────────────────────────────────────────────

function Welcome({ onSend }: { onSend: (msg: string) => void }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center py-8 text-center">
      <IconTile size="lg">
        <Sparkles />
      </IconTile>
      <h2 className="mt-4 font-display text-hb-h3 text-hb-text">How can I help today?</h2>
      <p className="mt-2 max-w-[46ch] text-hb-sm text-hb-muted">
        Ask about candidates, open roles, interviews or your pipeline. I can also take actions for
        you once you approve them.
      </p>
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {EXAMPLE_PROMPTS.map((p) => (
          <Card
            key={p.prompt}
            as="article"
            variant="interactive"
            padding="compact"
            role="button"
            tabIndex={0}
            onClick={() => onSend(p.prompt)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSend(p.prompt)
              }
            }}
            className="flex items-start gap-3 text-left"
          >
            <IconTile size="sm">{PROMPT_ICONS[p.title] ?? <Sparkles />}</IconTile>
            <div className="min-w-0">
              <p className="text-hb-sm font-semibold text-hb-text">{p.title}</p>
              <p className="mt-0.5 text-hb-xs text-hb-muted">{p.prompt}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function AssistantRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <IconTile size="sm">
        <Sparkles />
      </IconTile>
      <div className="min-w-0 flex-1 pt-1">{children}</div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <AssistantRow>
      <div className="flex h-6 items-center gap-1 text-hb-muted" aria-label="Copilot is thinking">
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 rounded-full bg-current"
            style={{ animation: `copilotDot 1.2s ${delay}s infinite ease-in-out` }}
          />
        ))}
      </div>
    </AssistantRow>
  )
}

function ApprovalCard({
  pendingApproval,
  onApprove,
  onDismiss,
}: {
  pendingApproval: { name?: string; args?: Record<string, unknown> }
  onApprove: () => void
  onDismiss: () => void
}) {
  const name = (pendingApproval?.name ?? '').replace(/_/g, ' ')
  const args = Object.entries(pendingApproval?.args ?? {})

  return (
    <AssistantRow>
      <div className="rounded-hb-md border border-hb-blue/30 bg-hb-blue/5 p-4">
        <p className="text-hb-sm font-semibold text-hb-text">Approve this action?</p>
        <p className="mt-1 text-hb-sm capitalize text-hb-text">{name}</p>
        {args.length > 0 && (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-hb-xs">
            {args.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="capitalize text-hb-muted">{k.replace(/_/g, ' ')}</dt>
                <dd className="break-words text-hb-text">{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" icon={<Check size={14} />} onClick={onApprove}>
            Approve and run
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </AssistantRow>
  )
}

// ── Composer ──────────────────────────────────────────────────────────────────

function Composer({ onSend, isThinking }: { onSend: (text: string) => void; isThinking: boolean }) {
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [candidateSuggestions, setCandidateSuggestions] = useState<{ candidate: any; matchedWord: string }[]>([])
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateSuggestions = useCallback((val: string) => {
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
    if (!val || val.trim().length < 2) {
      setCandidateSuggestions([])
      return
    }
    suggestTimerRef.current = setTimeout(async () => {
      const words = val
        .split(/\s+/)
        .map((w) => w.replace(/[^a-zA-Z]/g, '').trim())
        .filter((w) => w.length >= 2 && !COPILOT_STOPWORDS.includes(w.toLowerCase()))
      if (words.length === 0) {
        setCandidateSuggestions([])
        return
      }
      try {
        const seen = new Set<string>()
        const all: { candidate: any; matchedWord: string }[] = []
        for (const w of words.slice(-2)) {
          const res = await candidatesApi.suggest(w)
          for (const item of res.data || []) {
            const nameWords = item.full_name.toLowerCase().split(/\s+/)
            if (!seen.has(item.id) && nameWords.some((nw: string) => nw.startsWith(w.toLowerCase()))) {
              seen.add(item.id)
              all.push({ candidate: item, matchedWord: w })
            }
          }
        }
        setCandidateSuggestions(all.slice(0, 5))
      } catch {
        setCandidateSuggestions([])
      }
    }, 250)
  }, [])

  const send = useCallback(() => {
    const text = value.trim()
    if (!text || isThinking) return
    onSend(text)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setCandidateSuggestions([])
  }, [value, isThinking, onSend])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    updateSuggestions(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const applySuggestion = (name: string) => {
    setValue(name)
    setCandidateSuggestions([])
    textareaRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className="shrink-0 border-t border-hb-border px-4 pb-4 pt-3 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        {candidateSuggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {candidateSuggestions.map(({ candidate }) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => applySuggestion(candidate.full_name)}
                className="rounded-hb-full border border-hb-border bg-hb-surface px-3 py-1 text-hb-xs text-hb-text transition-colors hover:border-hb-blue/40 hover:bg-hb-blue/5"
              >
                {candidate.full_name}
              </button>
            ))}
          </div>
        )}
        <div
          className={clsx(
            'flex items-end gap-2 rounded-hb-md border border-hb-border bg-hb-surface p-1.5 pl-4 shadow-hb-1',
            'transition-colors duration-hb focus-within:border-hb-blue focus-within:ring-2 focus-within:ring-hb-blue/20',
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isPhone ? 'Message Copilot…' : 'Ask about candidates, jobs, interviews or your pipeline…'}
            aria-label="Message Copilot"
            enterKeyHint="send"
            rows={1}
            disabled={isThinking}
            className="max-h-40 min-h-[36px] flex-1 resize-none overflow-y-auto bg-transparent py-2 text-hb-sm text-hb-text placeholder:text-hb-muted focus:outline-none disabled:opacity-60"
          />
          <Button
            size="sm"
            aria-label="Send message"
            loading={isThinking}
            disabled={!value.trim()}
            onClick={send}
            className="!h-9 !w-9 shrink-0 !px-0"
          >
            {!isThinking && <ArrowUp size={16} />}
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-hb-dim">
          Copilot can make mistakes. Check candidate details before acting on them.
        </p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CopilotPage() {
  useFillShell()

  const { conversationId: urlConvId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const basePath = useBasePath()

  const { messages, startNewConversation, conversationId, isThinking } = useCopilotStore()

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

  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  // URL → store
  useEffect(() => {
    if (urlConvId && urlConvId !== conversationId) {
      loadConversation(urlConvId).then((detail) => {
        if (!detail) {
          navigate(`${basePath}/copilot`, { replace: true })
          return
        }
        if (detail.pending_tool_call) setPendingApproval(detail.pending_tool_call)
      })
    } else if (!urlConvId && conversationId) {
      startNewConversation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConvId])

  // Store → URL, once the first message creates a conversation
  useEffect(() => {
    if (conversationId && conversationId !== urlConvId) {
      navigate(`${basePath}/copilot/${conversationId}`, { replace: true })
    }
  }, [conversationId, urlConvId, navigate, basePath])

  // Scroll the thread itself — scrollIntoView would also scroll the shell's
  // overflow-hidden ancestors, pushing the topbar off-screen with no way back.
  const threadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, isThinking])

  const onSend = useCallback((text: string) => handleSend(text, messages), [handleSend, messages])

  const onApprove = useCallback(() => {
    if (pendingApproval) handleSend('', messages, pendingApproval)
  }, [pendingApproval, handleSend, messages])

  const handleNewChat = useCallback(() => {
    startNewConversation()
    setPendingApproval(null)
    navigate(`${basePath}/copilot`, { replace: true })
    setHistoryOpen(false)
  }, [startNewConversation, setPendingApproval, navigate, basePath])

  const handleSelectConv = useCallback(
    async (id: string) => {
      const detail = await loadConversation(id)
      setPendingApproval(detail?.pending_tool_call ?? null)
      navigate(`${basePath}/copilot/${id}`, { replace: true })
      setHistoryOpen(false)
    },
    [loadConversation, navigate, basePath, setPendingApproval],
  )

  // Clear the open thread BEFORE changing the URL. Otherwise the store→URL
  // effect still sees the old conversationId, navigates straight back to it
  // and reloads it (the delete hasn't finished yet), so it stays on screen.
  const leaveConversation = useCallback(() => {
    startNewConversation()
    setPendingApproval(null)
    navigate(`${basePath}/copilot`, { replace: true })
  }, [startNewConversation, setPendingApproval, navigate, basePath])

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      deleteConversation(e, id)
      if (id === conversationId) leaveConversation()
    },
    [deleteConversation, conversationId, leaveConversation],
  )

  const handleClearAll = useCallback(() => {
    deleteAll()
    setConfirmClear(false)
    leaveConversation()
    setHistoryOpen(false)
  }, [deleteAll, leaveConversation])

  const handleViewProfile = useCallback((card: CandidateCardData) => {
    resolveAndNavigateToCandidateProfile(card)
  }, [])

  const activeTitle = conversationId
    ? conversations.find((c) => c.id === conversationId)?.title ?? 'Conversation'
    : 'New conversation'

  const list = (
    <ConversationList
      conversations={conversations}
      grouped={grouped}
      activeId={conversationId}
      deletingId={deletingConvId}
      isLoading={convListLoading}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      onSelect={handleSelectConv}
      onDelete={handleDelete}
      onNewChat={handleNewChat}
    />
  )

  const clearButton = conversations.length > 0 && (
    <Button
      variant="quiet"
      size="sm"
      icon={<Trash2 size={14} />}
      onClick={() => setConfirmClear(true)}
      className="hover:!text-hb-error"
    >
      Clear history
    </Button>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile size="sm" className="hidden sm:grid">
            <Sparkles />
          </IconTile>
          <h1 className="truncate font-display text-[22px] font-semibold text-hb-text sm:text-hb-h3">
            <span className="sm:hidden">Copilot</span>
            <span className="hidden sm:inline">Recruiter Copilot</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<History size={14} />}
            onClick={() => setHistoryOpen(true)}
            className="lg:hidden"
            aria-label="Chat history"
          >
            <span className="hidden sm:inline">History</span>
          </Button>
          <Button size="sm" icon={<MessageSquarePlus size={14} />} onClick={handleNewChat} aria-label="New chat">
            <span className="hidden sm:inline">New chat</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 xl:gap-4">
        {/* History */}
        <Card padding="none" as="section" className="hidden w-72 shrink-0 flex-col overflow-hidden lg:flex">
          <div className="flex shrink-0 items-center justify-between border-b border-hb-border px-5 py-4">
            <h2 className="font-display text-hb-h3 text-hb-text">History</h2>
            {conversations.length > 0 && (
              <span className="font-mono text-hb-xs text-hb-dim">{conversations.length}</span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-none p-2">{list}</div>
          {clearButton && <div className="shrink-0 border-t border-hb-border p-2">{clearButton}</div>}
        </Card>

        {/* Thread */}
        <Card padding="none" as="section" className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-3 border-b border-hb-border px-4 py-3 sm:px-6 sm:py-4">
            <h2 className="min-w-0 flex-1 truncate font-display text-hb-h3 text-hb-text">{activeTitle}</h2>
            {isThinking && (
              <span className="shrink-0 text-hb-xs text-hb-muted">Thinking…</span>
            )}
          </div>

          <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto overscroll-none px-4 py-6 sm:px-6">
            {convLoading ? (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                <Skeleton className="ml-auto h-10 w-2/5" rounded="md" />
                <Skeleton className="h-20 w-4/5" rounded="md" />
                <Skeleton className="ml-auto h-10 w-1/3" rounded="md" />
              </div>
            ) : messages.length === 0 ? (
              <Welcome onSend={onSend} />
            ) : (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                {messages.map((msg) =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[78%] break-words rounded-hb-md rounded-br-[6px] border border-hb-blue/20 bg-hb-blue/5 px-4 py-2.5 text-hb-sm text-hb-text">
                        {msg.content === '👍 Action Approved' ? (
                          <span className="flex items-center gap-1.5">
                            <Check size={14} /> Action approved
                          </span>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ) : (
                    <AssistantRow key={msg.id}>
                      <div className="c-bot text-hb-sm leading-relaxed text-hb-text">
                        <CopilotSteps
                          steps={msg.steps}
                          startedAt={msg.startedAt}
                          finishedAt={msg.finishedAt}
                          hasContent={!!msg.content}
                        />
                        {msg.content && (
                          <BotMessageContent content={msg.content} onSend={onSend} onViewProfile={handleViewProfile} />
                        )}
                      </div>
                    </AssistantRow>
                  ),
                )}

                {isThinking && <ThinkingDots />}

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

          <Composer onSend={onSend} isThinking={isThinking} />
        </Card>
      </div>

      <Drawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="History"
        side="left"
        size="sm"
        footer={clearButton || undefined}
      >
        {list}
      </Drawer>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={handleClearAll}
        title="Clear all chat history?"
        description="This permanently deletes every Copilot conversation. It can't be undone."
        confirmLabel="Delete all"
        destructive
        loading={clearingAll}
      />

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
