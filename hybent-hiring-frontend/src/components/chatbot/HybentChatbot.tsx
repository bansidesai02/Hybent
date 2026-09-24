import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatbotLauncher } from './ChatbotLauncher'
import { ChatbotHeader } from './ChatbotHeader'
import { ChatbotBody } from './ChatbotBody'
import { ChatbotFooter } from './ChatbotFooter'
import { ExitConfirmationModal } from './ExitConfirmationModal'

const EndSessionScreen = lazy(() => import('./EndSessionScreen').then(m => ({ default: m.EndSessionScreen })))
const ConversationHistoryDrawer = lazy(() => import('./ConversationHistoryDrawer').then(m => ({ default: m.ConversationHistoryDrawer })))
const SettingsDrawer = lazy(() => import('./SettingsDrawer').then(m => ({ default: m.SettingsDrawer })))
const KeyboardShortcutsModal = lazy(() => import('./KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal })))
import { WelcomeOnboarding } from './WelcomeOnboarding'
import { ToastNotification } from './ToastNotification'
import { useChat } from './useChat'
import { useChatHistory } from './useChatHistory'
import { useChatSettings } from './useChatSettings'
import { exportAsPdf, copyTranscriptToClipboard } from './exportUtils'
import { playReceivedSound, playNotificationSound } from './soundUtils'
import type { SuggestionChip, ToastItem, ConversationItem } from './types'

import { ChatbotErrorBoundary } from './ChatbotErrorBoundary'

export function HybentChatbot() {
  return (
    <ChatbotErrorBoundary>
      <HybentChatbotInner />
    </ChatbotErrorBoundary>
  )
}

function HybentChatbotInner() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [showChips, setShowChips] = useState(true)

  // Drawer, Modal, Settings & Shortcuts States
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [isSessionEnded, setIsSessionEnded] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Settings & Preferences Hook
  const { settings, updateSetting, resetSettings } = useChatSettings()

  // Multi-conversation history hook
  const {
    activeConversation,
    activeId,
    searchQuery,
    setSearchQuery,
    groupedConversations,
    updateActiveMessages,
    createNewConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
    duplicateConversation,
    togglePin,
    toggleArchive,
  } = useChatHistory()

  // Chat engine hook tied to active conversation messages
  const {
    messages,
    setMessages,
    isTyping,
    isStreaming,
    sendMessage,
    regenerateResponse,
    editAndResendMessage,
    toggleLike,
    toggleDislike,
  } = useChat(activeConversation.messages, updateActiveMessages)

  // Keep hook messages in sync when active conversation changes
  useEffect(() => {
    if (activeConversation && activeConversation.messages) {
      setMessages(activeConversation.messages)
    }
  }, [activeId, activeConversation, setMessages])

  // Play sound and flag unread when AI finishes while chat is closed/minimized
  const [wasStreaming, setWasStreaming] = useState(false)
  useEffect(() => {
    if (wasStreaming && !isStreaming) {
      if (settings.soundEnabled) {
        playReceivedSound()
      }
      if (!isOpen || isMinimized) {
        setHasUnread(true)
      }
    }
    setWasStreaming(isStreaming)
  }, [isStreaming, wasStreaming, settings.soundEnabled, isOpen, isMinimized])

  // Toast Helper with optional Undo callback
  const addToast = useCallback(
    (message: string, type: ToastItem['type'] = 'success', onUndo?: () => void) => {
      const id = `toast-${Date.now()}`
      setToasts((prev) => [...prev, { id, message, type, onUndo }])
      if (settings.soundEnabled) {
        playNotificationSound()
      }
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3500)
    },
    [settings.soundEnabled]
  )

  // Global Keyboard Shortcuts (Ctrl+K, Ctrl+N, Ctrl+/, ESC)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Ctrl+/ or Cmd+/ -> Open Shortcuts Modal
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setIsOpen(true)
        setIsMinimized(false)
        setIsShortcutsOpen((prev) => !prev)
      }

      // Ctrl+K -> Focus Search / History
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setIsMinimized(false)
        setIsHistoryOpen(true)
      }

      // Ctrl+N -> New Conversation
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setIsOpen(true)
        setIsMinimized(false)
        handleNewConversation()
      }

      // ESC -> Close modal or drawers
      if (e.key === 'Escape') {
        if (isShortcutsOpen) setIsShortcutsOpen(false)
        else if (isSettingsOpen) setIsSettingsOpen(false)
        else if (showExitModal) setShowExitModal(false)
        else if (isHistoryOpen) setIsHistoryOpen(false)
      }
    }

    window.addEventListener('keydown', handleGlobalShortcuts)
    return () => window.removeEventListener('keydown', handleGlobalShortcuts)
  }, [showExitModal, isHistoryOpen, isSettingsOpen, isShortcutsOpen])

  const handleToggle = () => {
    if (isMinimized) {
      setIsMinimized(false)
      setHasUnread(false)
      return
    }

    if (isOpen) {
      setIsMinimized(true)
    } else {
      setIsOpen(true)
      setIsMinimized(false)
      setHasUnread(false)
    }
  }

  const handleMinimize = () => {
    setIsMinimized(true)
  }

  const handleHeaderCloseClick = () => {
    if (isSessionEnded) {
      setIsOpen(false)
    } else {
      setShowExitModal(true)
    }
  }

  const handleConfirmEndSession = () => {
    setShowExitModal(false)
    setIsSessionEnded(true)
  }

  const handleNewConversation = () => {
    createNewConversation()
    setIsSessionEnded(false)
    setShowExitModal(false)
    setShowChips(true)
    setIsHistoryOpen(false)
    addToast('New conversation started', 'success')
  }

  const handleCloseWidgetCompletely = () => {
    setIsOpen(false)
    setIsMinimized(false)
    setShowExitModal(false)
  }

  const handleSendMessage = (text: string) => {
    setShowChips(false)
    sendMessage(text)
  }

  const handleSelectChip = (chip: SuggestionChip) => {
    setShowChips(false)
    sendMessage(chip.query)
  }

  const handleShareMessage = async (msgId: string) => {
    const success = await copyTranscriptToClipboard(messages)
    if (success) {
      addToast('Message transcript copied to clipboard!', 'info')
    }
  }

  const handleExportConversation = (conv: ConversationItem) => {
    exportAsPdf(conv.messages)
    addToast(`Exported "${conv.title}" as PDF`, 'success')
  }

  const handleDeleteWithUndo = (id: string) => {
    const target = activeConversation
    deleteConversation(id)
    addToast('Conversation deleted', 'warning', () => {
      // Undo restoration simulation
      if (target) {
        createNewConversation()
        addToast('Conversation restored!', 'success')
      }
    })
  }

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-6 z-[99999] flex flex-col items-end pointer-events-none pb-safe">
      {/* Main Glassmorphism Chat Panel */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="relative pointer-events-auto mb-2 sm:mb-3 w-[calc(100vw-24px)] sm:w-[380px] h-[calc(100vh-110px)] sm:h-[min(560px,calc(100vh-110px))] max-h-[570px] flex flex-col bg-white text-slate-900 border border-slate-200/90 rounded-[20px] shadow-[0_20px_50px_-10px_rgba(15,23,42,0.22)] overflow-hidden"
          >
            {/* Toast Notifications Overlay */}
            <ToastNotification toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((item) => item.id !== id))} />

            {/* Header */}
            <ChatbotHeader
              onToggleHistory={() => setIsHistoryOpen((prev) => !prev)}
              onToggleSettings={() => setIsSettingsOpen((prev) => !prev)}
              onNewConversation={handleNewConversation}
              onMinimize={handleMinimize}
              onClose={handleHeaderCloseClick}
            />

            {/* Settings Drawer */}
            <AnimatePresence>
              {isSettingsOpen && (
                <Suspense fallback={null}>
                  <SettingsDrawer
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    settings={settings}
                    onUpdateSetting={updateSetting}
                    onResetSettings={resetSettings}
                    onOpenShortcuts={() => {
                      setIsSettingsOpen(false)
                      setIsShortcutsOpen(true)
                    }}
                  />
                </Suspense>
              )}
            </AnimatePresence>

            {/* Keyboard Shortcuts Modal */}
            <AnimatePresence>
              {isShortcutsOpen && (
                <Suspense fallback={null}>
                  <KeyboardShortcutsModal
                    isOpen={isShortcutsOpen}
                    onClose={() => setIsShortcutsOpen(false)}
                  />
                </Suspense>
              )}
            </AnimatePresence>

            {/* Conversation History Drawer */}
            <AnimatePresence>
              {isHistoryOpen && (
                <Suspense fallback={null}>
                  <ConversationHistoryDrawer
                    isOpen={isHistoryOpen}
                    onClose={() => setIsHistoryOpen(false)}
                    activeId={activeId}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    groupedConversations={groupedConversations}
                    onSelectConversation={switchConversation}
                    onNewConversation={handleNewConversation}
                    onRename={(id, title) => {
                      renameConversation(id, title)
                      addToast('Conversation renamed')
                    }}
                    onDelete={handleDeleteWithUndo}
                    onDuplicate={(id) => {
                      duplicateConversation(id)
                      addToast('Conversation duplicated')
                    }}
                    onTogglePin={(id) => {
                      togglePin(id)
                      addToast('Updated pin status')
                    }}
                    onToggleArchive={(id) => {
                      toggleArchive(id)
                      addToast('Updated archive status')
                    }}
                    onExport={handleExportConversation}
                  />
                </Suspense>
              )}
            </AnimatePresence>

            {/* Exit Confirmation Modal Overlay */}
            <AnimatePresence>
              {showExitModal && (
                <ExitConfirmationModal
                  isOpen={showExitModal}
                  onClose={() => setShowExitModal(false)}
                  onConfirmEnd={handleConfirmEndSession}
                />
              )}
            </AnimatePresence>

            {/* Content: Main Chat Body OR End Session Screen OR Welcome Onboarding */}
            {isSessionEnded ? (
              <Suspense fallback={null}>
                <EndSessionScreen
                  messages={messages}
                  onStartNewConversation={handleNewConversation}
                  onCloseChat={handleCloseWidgetCompletely}
                />
              </Suspense>
            ) : messages.length === 0 ? (
              <WelcomeOnboarding onSelectPrompt={handleSendMessage} />
            ) : (
              <>
                {/* Body */}
                <ChatbotBody
                  messages={messages}
                  isTyping={isTyping}
                  onSelectChip={handleSelectChip}
                  showChips={showChips}
                  settings={settings}
                  onRegenerate={regenerateResponse}
                  onToggleLike={toggleLike}
                  onToggleDislike={toggleDislike}
                  onShare={handleShareMessage}
                  onEditUserMessage={editAndResendMessage}
                  onSelectFollowup={handleSendMessage}
                  onShowToast={(msg) => addToast(msg, 'success')}
                />

                {/* Footer */}
                <ChatbotFooter
                  onSendMessage={handleSendMessage}
                  disabled={isStreaming}
                  soundEnabled={settings.soundEnabled}
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Launcher Button */}
      <div className="pointer-events-auto overflow-visible">
        <ChatbotLauncher
          isOpen={isOpen && !isMinimized}
          hasUnread={hasUnread}
          onClick={handleToggle}
        />
      </div>
    </div>
  )
}
