import { useMessageStore } from '@/store/messageStore'
import { ChatPanel } from './ChatPanel'

export function GlobalChatOverlay() {
  const { activeChatRecipient, activeGroup, closeChat } = useMessageStore()

  if (activeGroup) {
    return <ChatPanel open onClose={closeChat} thread={{ kind: 'group', group: activeGroup }} />
  }
  if (activeChatRecipient) {
    return <ChatPanel open onClose={closeChat} thread={{ kind: 'dm', recipient: activeChatRecipient }} />
  }
  return null
}
