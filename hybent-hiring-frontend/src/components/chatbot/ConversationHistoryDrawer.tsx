import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  X,
  Pin,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Archive,
  Download,
  MessageSquare,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react'
import type { ConversationItem } from './types'

interface ConversationHistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeId: string
  searchQuery: string
  onSearchChange: (query: string) => void
  groupedConversations: {
    pinned: ConversationItem[]
    today: ConversationItem[]
    yesterday: ConversationItem[]
    previous7Days: ConversationItem[]
    older: ConversationItem[]
  }
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  onRename: (id: string, newTitle: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onTogglePin: (id: string) => void
  onToggleArchive: (id: string) => void
  onExport: (conv: ConversationItem) => void
}

export function ConversationHistoryDrawer({
  isOpen,
  onClose,
  activeId,
  searchQuery,
  onSearchChange,
  groupedConversations,
  onSelectConversation,
  onNewConversation,
  onRename,
  onDelete,
  onDuplicate,
  onTogglePin,
  onToggleArchive,
  onExport,
}: ConversationHistoryDrawerProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Listen for Ctrl+K to focus search input
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!isOpen) return null

  const handleStartRename = (conv: ConversationItem) => {
    setEditingId(conv.id)
    setRenameText(conv.title)
    setActiveMenuId(null)
  }

  const handleSaveRename = (id: string) => {
    if (renameText.trim()) {
      onRename(id, renameText.trim())
    }
    setEditingId(null)
  }

  const handleConfirmDelete = () => {
    if (deletingId) {
      onDelete(deletingId)
      setDeletingId(null)
    }
  }

  const renderSection = (title: string, items: ConversationItem[]) => {
    if (items.length === 0) return null

    return (
      <div className="space-y-1 my-3">
        <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          {title === 'Pinned' && <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />}
          <span>{title}</span>
        </div>

        {items.map((conv) => {
          const isActive = conv.id === activeId
          const isEditing = conv.id === editingId

          return (
            <div
              key={conv.id}
              className={`group relative flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-violet-50 text-violet-900 border-violet-200 font-semibold shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
              }`}
              onClick={() => {
                onSelectConversation(conv.id)
                onClose()
              }}
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1 pr-2">
                <MessageSquare className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-violet-600' : 'text-slate-400'}`} />

                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)}
                        autoFocus
                        className="w-full px-2 py-1 text-xs bg-white border border-violet-500 rounded focus:outline-none text-[#1a1040]"
                      />
                      <button
                        onClick={() => handleSaveRename(conv.id)}
                        className="px-2 py-1 bg-violet-600 text-white rounded text-[10px] font-bold"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <>
                      <h4 className={`text-xs font-semibold truncate ${isActive ? 'text-violet-900' : 'text-[#1a1040]'}`}>
                        {conv.title}
                      </h4>
                      {conv.previewText && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {conv.previewText}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Actions Button Menu */}
              <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setActiveMenuId(activeMenuId === conv.id ? null : conv.id)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Conversation options"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {/* Dropdown Menu */}
                {activeMenuId === conv.id && (
                  <div className="absolute right-0 top-7 z-30 w-36 p-1 rounded-xl bg-white border border-violet-200 shadow-xl text-xs font-medium space-y-0.5">
                    <button
                      onClick={() => handleStartRename(conv)}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-violet-50 text-left flex items-center gap-2 text-slate-700"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                      <span>Rename</span>
                    </button>

                    <button
                      onClick={() => {
                        onTogglePin(conv.id)
                        setActiveMenuId(null)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-violet-50 text-left flex items-center gap-2 text-slate-700"
                    >
                      <Pin className="w-3.5 h-3.5 text-amber-500" />
                      <span>{conv.isPinned ? 'Unpin' : 'Pin'}</span>
                    </button>

                    <button
                      onClick={() => {
                        onDuplicate(conv.id)
                        setActiveMenuId(null)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-violet-50 text-left flex items-center gap-2 text-slate-700"
                    >
                      <Copy className="w-3.5 h-3.5 text-purple-500" />
                      <span>Duplicate</span>
                    </button>

                    <button
                      onClick={() => {
                        onExport(conv)
                        setActiveMenuId(null)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-violet-50 text-left flex items-center gap-2 text-slate-700"
                    >
                      <Download className="w-3.5 h-3.5 text-teal-500" />
                      <span>Export</span>
                    </button>

                    <button
                      onClick={() => {
                        onToggleArchive(conv.id)
                        setActiveMenuId(null)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-violet-50 text-left flex items-center gap-2 text-slate-700"
                    >
                      <Archive className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{conv.isArchived ? 'Unarchive' : 'Archive'}</span>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      onClick={() => {
                        setDeletingId(conv.id)
                        setActiveMenuId(null)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-left flex items-center gap-2 text-red-600 font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const hasAny =
    groupedConversations.pinned.length > 0 ||
    groupedConversations.today.length > 0 ||
    groupedConversations.yesterday.length > 0 ||
    groupedConversations.previous7Days.length > 0 ||
    groupedConversations.older.length > 0

  return (
    <div className="absolute inset-0 z-40 flex">
      {/* Dimmed Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#0a0718]/50 backdrop-blur-xs rounded-[20px]"
      />

      {/* History Side Panel */}
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="relative z-10 w-[85%] sm:w-[310px] h-full bg-white backdrop-blur-2xl border-r border-slate-200 rounded-l-[20px] flex flex-col shadow-2xl overflow-hidden text-slate-900"
      >
        {/* Header Bar */}
        <div className="p-3.5 pb-3 border-b border-slate-200 flex items-center justify-between bg-white">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-violet-600" />
            <span>Chat History</span>
          </h3>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onNewConversation()
                onClose()
              }}
              className="p-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
              title="New Chat (Ctrl+N)"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
              title="Close history"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input Box */}
        <div className="p-3 border-b border-violet-100/60">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search chats... (Ctrl+K)"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-violet-500 focus:bg-white text-slate-900 outline-none transition-all placeholder-slate-400"
            />
          </div>
        </div>

        {/* Grouped Conversations List */}
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-violet-200">
          {!hasAny ? (
            /* Empty State for Search or History */
            <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2 text-slate-400">
              <MessageSquare className="w-8 h-8 opacity-40 text-violet-500" />
              <p className="text-xs font-semibold text-slate-600">
                {searchQuery ? 'No matching conversations' : 'No chat history yet'}
              </p>
              <p className="text-[11px]">
                {searchQuery ? 'Try searching for another keyword.' : 'Start a new conversation to begin!'}
              </p>
            </div>
          ) : (
            <>
              {renderSection('Pinned', groupedConversations.pinned)}
              {renderSection('Today', groupedConversations.today)}
              {renderSection('Yesterday', groupedConversations.yesterday)}
              {renderSection('Previous 7 Days', groupedConversations.previous7Days)}
              {renderSection('Older', groupedConversations.older)}
            </>
          )}
        </div>
      </motion.div>

      {/* Delete Confirmation Modal Dialog */}
      <AnimatePresence>
        {deletingId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setDeletingId(null)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 w-full max-w-[280px] p-5 rounded-2xl bg-white border border-violet-200 text-center shadow-2xl"
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-[#1a1040] mb-1">
                Delete Conversation?
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
