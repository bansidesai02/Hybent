import { useMessageStore } from '@/store/messageStore'
import { ChatPanel } from './ChatPanel'

export function GlobalChatOverlay() {
  const { activeChatRecipient, closeChat } = useMessageStore()

  if (!activeChatRecipient) return null

  return (
    <ChatPanel
      open={!!activeChatRecipient}
      onClose={closeChat}
      recipient={activeChatRecipient}
    />
  )
}
