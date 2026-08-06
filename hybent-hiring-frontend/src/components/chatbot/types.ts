export interface SuggestionChip {
  id: string
  label: string
  query: string
  iconName?: string
}

export type MessageRole = 'ai' | 'user' | 'system'

export interface RichCardData {
  id: string
  type: 'service' | 'product' | 'case_study' | 'pricing' | 'faq_accordion' | 'timeline' | 'comparison_table' | 'cta_actions'
  title: string
  description: string
  iconName?: string
  image?: string
  ctaText?: string
  ctaLink?: string
  badge?: string
  items?: Array<{ label: string; value: string }>
  tableHeaders?: string[]
  tableRows?: string[][]
  actions?: Array<{ label: string; link: string; isPrimary?: boolean }>
}

export interface ChatMessageItem {
  id: string
  sender: MessageRole
  text: string
  timestamp: string
  chips?: SuggestionChip[]
  isTyping?: boolean
  isStreaming?: boolean
  richCard?: RichCardData
  followups?: string[]
  liked?: boolean
  disliked?: boolean
}

export interface StreamChunkHandler {
  onChunk: (chunk: string) => void
  onComplete: (fullText: string) => void
  onError?: (error: Error) => void
}

export type FeedbackScore = 'excellent' | 'good' | 'needs_improvement'

export type ExportFormat = 'pdf' | 'txt' | 'markdown'

export interface ConversationItem {
  id: string
  title: string
  messages: ChatMessageItem[]
  createdAt: number
  updatedAt: number
  isPinned?: boolean
  isArchived?: boolean
  previewText?: string
}

export interface ToastItem {
  id: string
  message: string
  type?: 'success' | 'info' | 'warning' | 'error'
  onUndo?: () => void
}

export type ThemeMode = 'light' | 'dark' | 'system'

export type StreamSpeed = 'fast' | 'medium' | 'relaxed'

export type MessageDensity = 'comfortable' | 'compact'

export interface ChatSettings {
  theme: ThemeMode
  soundEnabled: boolean
  streamSpeed: StreamSpeed
  density: MessageDensity
  showTimestamps: boolean
  showTypingIndicator: boolean
  showSuggestions: boolean
  autoScroll: boolean
  onboarded: boolean
}
