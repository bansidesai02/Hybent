import { useRef, useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { useCopilotStore } from '@/store/useCopilotStore'
import { useMessageStore } from '@/store/messageStore'
import { copilotApi } from '@/api/copilot'
import { useQueryClient } from '@tanstack/react-query'
import type { ConversationSummary } from '@/api/copilot'

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  fab: { position: 'fixed', bottom: 'min(28px, 4vw)', right: 'min(28px, 4vw)', width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--violet) 0%, var(--pink) 100%)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-hover)', zIndex: 9999, transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease', color: '#fff', fontSize: '24px' },
  panel: { position: 'fixed', bottom: 'min(100px, calc(4vw + 70px))', right: 'min(28px, 4vw)', width: '400px', maxWidth: 'calc(100vw - min(56px, 8vw))', height: '600px', maxHeight: 'calc(100vh - 120px)', borderRadius: '24px', background: 'var(--glass)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--glass-border-soft)', boxShadow: 'var(--shadow-h)', display: 'flex', flexDirection: 'column', zIndex: 9998, overflow: 'hidden', animation: 'copilotSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)' },
  header: { padding: '18px 24px', background: 'var(--topbar-bg)', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  headerTitle: { color: 'var(--text)', fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' },
  headerActions: { display: 'flex', gap: '8px' },
  iconBtn: { background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '10px', color: 'var(--text-mid)', cursor: 'pointer', padding: '6px', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  messages: { flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  userBubble: { alignSelf: 'flex-end', background: 'linear-gradient(135deg, var(--violet), var(--violet-mid))', color: '#fff', borderRadius: '18px 18px 4px 18px', padding: '12px 16px', maxWidth: '85%', fontSize: '14px', lineHeight: 1.5, boxShadow: 'var(--shadow-card)' },
  botBubble: { alignSelf: 'flex-start', background: 'var(--kpi-bg)', backdropFilter: 'blur(16px)', color: 'var(--text)', borderRadius: '18px 18px 18px 4px', padding: '14px 18px', maxWidth: '90%', fontSize: '14px', lineHeight: 1.6, border: '1px solid var(--input-border)', boxShadow: 'var(--shadow-card)' },
  thinkingBubble: { alignSelf: 'flex-start', background: 'var(--kpi-bg)', borderRadius: '18px 18px 18px 4px', padding: '14px 18px', border: '1px solid var(--input-border)', display: 'flex', alignItems: 'center', gap: '6px' },
  footer: { padding: '14px 16px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: '6px', alignItems: 'flex-end', flexShrink: 0, background: 'var(--topbar-bg)' },
  input: { flex: 1, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '14px', color: 'var(--text)', fontSize: '14px', padding: '10px 14px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, maxHeight: '120px', overflowY: 'auto', transition: 'all 0.2s ease' },
  sendBtn: { background: 'linear-gradient(135deg, var(--violet), var(--violet-mid))', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', flexShrink: 0, boxShadow: 'var(--shadow-card)' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '32px 24px', textAlign: 'center' },
  emptyIcon: { fontSize: '48px', background: 'linear-gradient(135deg, var(--violet), var(--pink))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 8px 16px var(--hover-row))' },
  emptyTitle: { color: 'var(--text)', fontWeight: 700, fontSize: '18px' },
  emptySubtitle: { color: 'var(--text-mid)', fontSize: '14px', lineHeight: 1.6 },
  promptGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', width: '100%', marginTop: '16px' },
  promptCard: { background: 'var(--kpi-bg)', border: '1px solid var(--input-border)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)', textAlign: 'left' },
  promptCardIcon: { fontSize: '20px' },
  promptCardTitle: { color: 'var(--text)', fontSize: '13px', fontWeight: 600 },
  promptCardText: { color: 'var(--text-mid)', fontSize: '11px', lineHeight: 1.4 },
  // History panel
  historyPanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  historyHeader: { padding: '16px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  historyTitle: { color: 'var(--text)', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' },
  newChatBtn: { background: 'linear-gradient(135deg, var(--violet), var(--violet-mid))', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', padding: '7px 14px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease' },
  historyList: { flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' },
  historyGroup: { color: 'var(--text-mid)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', padding: '8px 0 4px' },
  historyItem: { background: 'var(--kpi-bg)', border: '1px solid var(--input-border)', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s ease' },
  historyItemTitle: { flex: 1, color: 'var(--text)', fontSize: '13px', lineHeight: 1.4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  historyItemDate: { color: 'var(--text-mid)', fontSize: '11px', flexShrink: 0 },
  historyDeleteBtn: { background: 'transparent', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', flexShrink: 0, transition: 'all 0.2s ease', opacity: 0.6 },
  historyEmpty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-mid)', fontSize: '14px', gap: '12px' },
  backBtn: { background: 'transparent', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', padding: '4px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', transition: 'all 0.2s ease' },
  loadingRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'var(--text-mid)', fontSize: '14px' },
  micBtn: { background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '12px', color: 'var(--text-mid)', cursor: 'pointer', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', flexShrink: 0 },
  micBtnActive: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', animation: 'micPulse 1.5s infinite ease-in-out' },
}

const EXAMPLE_PROMPTS = [
  { icon: '🔍', title: 'Search Talent', prompt: 'Show top candidates for React role' },
  { icon: '📅', title: 'Schedule Interview', prompt: 'Schedule a technical round for a candidate tomorrow at 2 pm' },
  { icon: '⚡', title: 'Update Stage', prompt: 'Move a candidate to Technical Round Selected' },
  { icon: '📊', title: 'Pipeline Stats', prompt: 'What is the current pipeline summary?' },
]

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const SendIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const HistoryIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const BackIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const MicIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>

// ── Date grouping helper ──────────────────────────────────────────────────────
function groupConversationsByDate(convs: ConversationSummary[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: Record<string, ConversationSummary[]> = {
    Today: [], Yesterday: [], 'This Week': [], Older: [],
  }
  for (const c of convs) {
    const d = new Date(c.updated_at)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (day >= today) groups['Today'].push(c)
    else if (day >= yesterday) groups['Yesterday'].push(c)
    else if (day >= weekAgo) groups['This Week'].push(c)
    else groups['Older'].push(c)
  }
  return groups
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ── Main Widget ───────────────────────────────────────────────────────────────
export function CopilotWidget() {
  const {
    isOpen, toggle, close, isThinking, setThinking,
    messages, addMessage, setMessages, startNewConversation,
    conversationId, setConversationId, pageContext,
  } = useCopilotStore()

  const { activeChatRecipient } = useMessageStore()

  const queryClient = useQueryClient()

  const [input, setInput] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [convLoading, setConvLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort() }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  // Load history panel conversations
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await copilotApi.getConversations()
      setConversations(res.data)
    } catch { /* silent — history is non-critical */ }
    finally { setHistoryLoading(false) }
  }, [])

  const openHistory = useCallback(() => {
    setHistoryOpen(true)
    loadHistory()
  }, [loadHistory])

  // Load a past conversation into the chat
  const loadConversation = useCallback(async (id: string) => {
    setConvLoading(true)
    try {
      const res = await copilotApi.getConversation(id)
      const mapped = res.data.messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
      setMessages(mapped)
      setConversationId(id)
      setHistoryOpen(false)
    } catch { /* silent */ }
    finally { setConvLoading(false) }
  }, [setMessages, setConversationId])

  // Restore messages on mount/reload if conversationId is active but messages are cached empty
  useEffect(() => {
    if (conversationId && messages.length === 0) {
      loadConversation(conversationId)
    }
  }, [conversationId, messages.length, loadConversation])

  // Delete a conversation
  const deleteConversation = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await copilotApi.deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      // If active conversation is deleted, start fresh
      if (conversationId === id) startNewConversation()
    } catch { /* silent */ }
  }, [conversationId, startNewConversation])

  const [pendingApproval, setPendingApproval] = useState<any>(null)

  // Textarea auto-resize
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  // Send message
  const handleSend = useCallback(async (text?: string, approvedToolCall?: any) => {
    // If it's just an approval (no text), we can send a system confirmation
    const isApproval = !!approvedToolCall
    const msg = text !== undefined ? text.trim() : input.trim()
    
    if (!msg && !isApproval) return
    if (isThinking) return

    const historySnapshot = useCopilotStore.getState().messages
    const activeConvId = useCopilotStore.getState().conversationId

    addMessage({ role: 'user', content: isApproval ? '👍 Action Approved' : msg })
    if (!isApproval) {
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }
    
    setThinking(true)
    setPendingApproval(null)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await copilotApi.chat(
        isApproval ? 'User approved the action. Please proceed.' : msg,
        historySnapshot.slice(-10),
        pageContext ?? undefined,
        activeConvId,
        approvedToolCall,
        controller.signal,
      )
      if (controller.signal.aborted) return
      const { reply, conversation_id, requires_approval, pending_tool_call } = res.data
      addMessage({ role: 'assistant', content: reply })
      if (conversation_id) setConversationId(conversation_id)
      
      if (requires_approval && pending_tool_call) {
        setPendingApproval(pending_tool_call)
      } else if (isApproval) {
        // If we just finished an approved action, refresh common data
        queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
        queryClient.invalidateQueries({ queryKey: ['candidates'] })
        queryClient.invalidateQueries({ queryKey: ['interviews'] })
        queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
        queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
        queryClient.invalidateQueries({ queryKey: ['candidates-for-schedule'] })
      }
    } catch (err: any) {
      if (controller.signal.aborted) return
      const errMsg = err?.response?.data?.detail || 'Sorry, I encountered an error. Please try again.'
      addMessage({ role: 'assistant', content: `⚠️ ${errMsg}` })
    } finally {
      if (!controller.signal.aborted) setThinking(false)
    }
  }, [input, isThinking, pageContext, addMessage, setThinking, setConversationId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setThinking(true)
        try {
          const res = await copilotApi.transcribe(audioBlob)
          const text = res.data.text.trim()
          if (text) {
            setInput(text)
            // Auto-resize textarea after setting text
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
                textareaRef.current.focus()
              }
            }, 0)
          }
        } catch (err) {
          addMessage({ role: 'assistant', content: '⚠️ Failed to transcribe audio. Please try again.' })
        } finally {
          setThinking(false)
        }
        stream.getTracks().forEach(t => t.stop())
      }

      recorder.start()
      setIsRecording(true)
    } catch (err) {
      addMessage({ role: 'assistant', content: '⚠️ Microphone access denied or not available.' })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const toggleRecording = () => {
    if (isRecording) stopRecording()
    else startRecording()
  }

  const handleNewChat = () => {
    startNewConversation()
    setHistoryOpen(false)
  }

  if (activeChatRecipient) {
    return null
  }

  const grouped = groupConversationsByDate(conversations)

  return (
    <>
      <style>{`
        @keyframes copilotSlideUp { from { opacity:0; transform:translateY(20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes copilotDot { 0%,80%,100% { transform:translateY(0); opacity:0.3; } 40% { transform:translateY(-4px); opacity:1; background:var(--pink); } }
        .c-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--violet); animation:copilotDot 1.2s infinite ease-in-out; }
        .c-dot:nth-child(2){animation-delay:0.2s;} .c-dot:nth-child(3){animation-delay:0.4s;}
        .c-fab:hover { transform:scale(1.08) translateY(-4px) !important; box-shadow:var(--shadow-h) !important; }
        .c-icon-btn:hover { background:var(--hover-row) !important; color:var(--text) !important; }
        .c-send:hover { opacity:0.9; transform:scale(1.05); }
        .c-send:disabled { background:var(--input-bg) !important; color:var(--text-mid) !important; box-shadow:none !important; transform:none !important; cursor:not-allowed !important; }
        .c-card:hover { background:var(--hover-row) !important; border-color:var(--violet) !important; transform:translateY(-2px); }
        .c-input:focus { border-color:var(--violet) !important; box-shadow:0 0 0 3px var(--search-bg) !important; }
        .c-hist-item:hover { background:var(--hover-row) !important; border-color:var(--violet) !important; }
        .c-hist-del:hover { opacity:1 !important; color:var(--pink) !important; }
        .c-new-chat:hover { opacity:0.9; transform:scale(1.02); }
        .c-back:hover { color:var(--text) !important; }
        .c-messages::-webkit-scrollbar,.c-hist-list::-webkit-scrollbar { width:5px; }
        .c-messages::-webkit-scrollbar-track,.c-hist-list::-webkit-scrollbar-track { background:transparent; }
        .c-messages::-webkit-scrollbar-thumb,.c-hist-list::-webkit-scrollbar-thumb { background:var(--violet-light); border-radius:10px; }
        .c-bot p{margin:0 0 10px 0;} .c-bot p:last-child{margin:0;} .c-bot ul,.c-bot ol{margin:6px 0 10px 20px;padding:0;} .c-bot li{margin:4px 0;}
        .c-bot strong{color:var(--text);font-weight:600;}
        .c-bot code{background:var(--bg2);border-radius:6px;padding:2px 6px;font-size:13px;font-family:ui-monospace,monospace;color:var(--pink);border:1px solid var(--input-border);}
        .c-bot pre{background:var(--bg2);padding:12px;border-radius:8px;overflow-x:auto;margin:10px 0;border:1px solid var(--input-border);}
        .c-bot pre code{background:transparent;border:none;padding:0;color:var(--text);}
        @keyframes micPulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
      `}</style>

      {/* FAB */}
      <button className="c-fab" style={s.fab} onClick={toggle} aria-label="Open AI Copilot">
        {isOpen ? <CloseIcon /> : '✦'}
      </button>

      {/* Panel */}
      {isOpen && (
        <div style={s.panel} role="dialog" aria-label="AI Copilot">
          {/* Header */}
          <div style={s.header}>
            {historyOpen ? (
              <>
                <button className="c-back" style={s.backBtn} onClick={() => setHistoryOpen(false)}>
                  <BackIcon /> Back
                </button>
                <button className="c-new-chat" style={s.newChatBtn} onClick={handleNewChat}>
                  <PlusIcon /> New Chat
                </button>
              </>
            ) : (
              <>
                <div style={s.headerTitle}>
                  <span style={{ background: 'linear-gradient(135deg, var(--violet), var(--pink))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '18px' }}>✦</span>
                  <span>Recruiter Copilot</span>
                  {isThinking && <span style={{ fontSize: '12px', opacity: 0.8, fontWeight: 400, color: 'var(--violet-light)' }}>thinking...</span>}
                </div>
                <div style={s.headerActions}>
                  <button className="c-icon-btn" style={s.iconBtn} onClick={openHistory} title="Chat history"><HistoryIcon /></button>
                  <button className="c-icon-btn" style={s.iconBtn} onClick={handleNewChat} title="New chat"><PlusIcon /></button>
                  <button className="c-icon-btn" style={s.iconBtn} onClick={close} title="Close"><CloseIcon /></button>
                </div>
              </>
            )}
          </div>

          {/* History Panel */}
          {historyOpen ? (
            <div style={s.historyPanel}>
              {historyLoading || convLoading ? (
                <div style={s.loadingRow}>
                  <span className="c-dot" /><span className="c-dot" /><span className="c-dot" />
                </div>
              ) : conversations.length === 0 ? (
                <div style={s.historyEmpty}>
                  <span style={{ fontSize: '36px' }}>🕐</span>
                  <div>No past conversations yet.</div>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>Your chats will appear here.</div>
                </div>
              ) : (
                <div className="c-hist-list" style={s.historyList}>
                  {Object.entries(grouped).map(([group, items]) =>
                    items.length === 0 ? null : (
                      <div key={group}>
                        <div style={s.historyGroup}>{group}</div>
                        {items.map((conv) => (
                          <div
                            key={conv.id}
                            className="c-hist-item"
                            style={{ ...s.historyItem, borderColor: conv.id === conversationId ? 'var(--violet)' : undefined }}
                            onClick={() => loadConversation(conv.id)}
                          >
                            <div style={s.historyItemTitle} title={conv.title}>{conv.title}</div>
                            <div style={s.historyItemDate}>{fmtTime(conv.updated_at)}</div>
                            <button
                              className="c-hist-del"
                              style={s.historyDeleteBtn}
                              onClick={(e) => deleteConversation(e, conv.id)}
                              title="Delete"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Chat Messages */}
              <div className="c-messages" style={s.messages}>
                {convLoading ? (
                  <div style={{ ...s.loadingRow, flex: 1 }}>
                    <span className="c-dot" />&nbsp;<span className="c-dot" />&nbsp;<span className="c-dot" />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={s.emptyState}>
                    <div style={s.emptyIcon}>✦</div>
                    <div style={s.emptyTitle}>Your Recruiter AI Copilot</div>
                    <div style={s.emptySubtitle}>Ask me anything — candidates, jobs, interviews, offers, or pipeline stats.</div>
                    <div style={s.promptGrid}>
                      {EXAMPLE_PROMPTS.map((item) => (
                        <button key={item.title} className="c-card" style={s.promptCard} onClick={() => handleSend(item.prompt)}>
                          <div style={s.promptCardIcon}>{item.icon}</div>
                          <div style={s.promptCardTitle}>{item.title}</div>
                          <div style={s.promptCardText}>{item.prompt}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) =>
                      msg.role === 'user' ? (
                        <div key={msg.id} style={s.userBubble}>{msg.content}</div>
                      ) : (
                        <div key={msg.id} className="c-bot" style={s.botBubble}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )
                    )}
                    {isThinking && (
                      <div style={s.thinkingBubble}>
                        <span className="c-dot" /><span className="c-dot" /><span className="c-dot" />
                      </div>
                    )}
                    {pendingApproval && (
                      <div style={{ padding: '12px', background: 'var(--bg2)', borderRadius: '8px', border: '1px solid var(--violet-light)', margin: '10px 0' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
                          ⚠️ Approval Required: {pendingApproval.name.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-mid)', marginBottom: '12px' }}>
                          Review the details below and approve to proceed.
                        </div>
                        <div style={{ 
                          fontSize: '11px', color: 'var(--text-mid)', marginBottom: '16px', 
                          background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '8px',
                          display: 'flex', flexDirection: 'column', gap: '4px',
                          border: '1px solid rgba(0,0,0,0.05)'
                        }}>
                          {Object.entries(pendingApproval.args).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{k.replace('_', ' ')}:</span>
                              <span style={{ textAlign: 'right', flex: 1, marginLeft: '10px' }}>{String(v)}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => handleSend(undefined, pendingApproval)}
                            style={{ flex: 1, padding: '8px', background: 'var(--violet)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                            disabled={isThinking}
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => setPendingApproval(null)}
                            style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid var(--input-border)', color: 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                            disabled={isThinking}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input Footer */}
              <div style={s.footer}>
                <button
                  className="c-mic"
                  style={{ ...s.micBtn, ...(isRecording ? s.micBtnActive : {}) }}
                  onClick={toggleRecording}
                  disabled={isThinking}
                  title={isRecording ? "Stop Recording" : "Voice Command"}
                >
                  <MicIcon />
                </button>
                <textarea
                  ref={textareaRef}
                  className="c-input"
                  style={s.input}
                  placeholder={isRecording ? "Listening..." : "Ask me about candidates..."}
                  value={input}
                  rows={1}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={isThinking || isRecording}
                />
                <button
                  className="c-send"
                  style={s.sendBtn}
                  onClick={() => handleSend()}
                  disabled={isThinking || !input.trim() || isRecording}
                  title="Send"
                >
                  <SendIcon />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
