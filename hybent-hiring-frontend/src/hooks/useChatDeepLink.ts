import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useMessageStore } from '@/store/messageStore'

/** Opens the chat a tapped phone notification is about (?chat=<user> or ?group=<id>, plus &name=). */
export function useChatDeepLink(enabled: boolean) {
  const [params, setParams] = useSearchParams()
  const chat = params.get('chat')
  const group = params.get('group')

  useEffect(() => {
    if (!enabled || (!chat && !group)) return
    const name = params.get('name') ?? ''
    const store = useMessageStore.getState()
    if (group) store.openGroup({ id: group, name })
    else if (chat) store.openChat({ id: chat, full_name: name })
    setParams(
      (prev) => {
        for (const key of ['chat', 'group', 'name']) prev.delete(key)
        return prev
      },
      { replace: true },
    )
    // Runs once per link; `params` changes when it is cleared above.
  }, [enabled, chat, group])
}
