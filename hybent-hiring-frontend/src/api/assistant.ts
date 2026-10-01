import api from './axios'

export interface AssistantTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantReply {
  reply: string
  followups: string[]
}

/** Hybent AI, the hybent.com chatbot. Send the conversation, oldest first,
    ending with the visitor's new message. */
export const assistantApi = {
  ask: (messages: AssistantTurn[]): Promise<AssistantReply> =>
    api
      .post('/api/public/assistant', { messages }, { skipLoader: true })
      .then((res) => res.data.data as AssistantReply),
}
