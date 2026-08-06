import { useState, useCallback, useRef } from 'react'
import type { ChatMessageItem, RichCardData } from './types'

const INITIAL_WELCOME_MESSAGE: ChatMessageItem = {
  id: 'welcome-1',
  sender: 'ai',
  text: `👋 Welcome to Hybent!

I am your **AI Business Copilot**. 

I can help you explore software engineering services, estimate project costs, calculate development timelines, compare pricing plans, and book a consultation call with our leadership team.`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  followups: [
    'How much does a custom app cost?',
    'Show software development timeline',
    'Compare Starter vs Enterprise plans',
    'Book a free technical consultation',
  ],
}

/* Rich Cards Repository with FAQ Accordion, Timeline, Comparison Table & CTA Actions */
const RICH_CARDS: Record<string, RichCardData> = {
  products: {
    id: 'rc-1',
    type: 'product',
    title: 'Hybent Hiring — Flagship AI Platform',
    description: 'Automate candidate parsing, screening, interview scoring, and copilot recruitment workflows.',
    badge: 'Live Product',
    ctaText: 'Explore Hybent Hiring',
    ctaLink: '/products/hiring',
  },
  services: {
    id: 'rc-2',
    type: 'service',
    title: 'Enterprise Engineering & AI Consulting',
    description: 'Custom web, mobile, and AI solutions built by dedicated senior engineering teams.',
    badge: 'Enterprise',
    ctaText: 'Explore All Services',
    ctaLink: '/services',
  },
  pricing: {
    id: 'rc-3',
    type: 'comparison_table',
    title: 'Hybent Subscription & Custom Comparison',
    description: 'Overview of Starter, Pro, and Enterprise options.',
    tableHeaders: ['Feature', 'Starter ($299/m)', 'Pro ($799/m)', 'Enterprise'],
    tableRows: [
      ['AI Screening', 'Basic', 'Advanced', 'Custom Models'],
      ['Team Slots', 'Up to 5', 'Up to 25', 'Unlimited'],
      ['Support', 'Email', '24/7 Priority', 'Dedicated Manager'],
      ['SLA Guarantee', 'Standard', '99.9%', '99.99% Custom'],
    ],
  },
  timeline: {
    id: 'rc-4',
    type: 'timeline',
    title: 'Typical Agile Software Delivery Timeline',
    description: 'Standard 4-phase engineering methodology.',
    items: [
      { label: 'Phase 1: Discovery & Architecture', value: 'Weeks 1-2 (Scope, UI/UX, Specs)' },
      { label: 'Phase 2: Core Engineering Sprint', value: 'Weeks 3-6 (Frontend, Backend, DB)' },
      { label: 'Phase 3: AI Integration & Testing', value: 'Weeks 7-8 (LLMs, QA, Security)' },
      { label: 'Phase 4: Production Deployment', value: 'Week 8+ (CI/CD, Monitoring)' },
    ],
  },
  faq: {
    id: 'rc-5',
    type: 'faq_accordion',
    title: 'Frequently Asked Questions',
    description: 'Common questions regarding Hybent services.',
    items: [
      { label: 'How long does a typical project take?', value: 'Custom web/mobile apps take 4 to 8 weeks depending on scope.' },
      { label: 'What is your trial policy?', value: 'We offer a 14-day risk-free trial for our Hybent Hiring platform.' },
      { label: 'Can we hire dedicated developers?', value: 'Yes, we provide senior full-stack, backend, and AI engineers on demand.' },
    ],
  },
  booking: {
    id: 'rc-6',
    type: 'cta_actions',
    title: 'Schedule a Consultation Call',
    description: 'Connect with a Hybent Solutions Architect to discuss your technical roadmap.',
    actions: [
      { label: 'Book 15-min Call', link: 'https://hybent.com/book-call', isPrimary: true },
      { label: 'Contact Sales', link: '/contact' },
      { label: 'Explore Services', link: '/services' },
    ],
  },
}

/* Follow-up suggestions repository */
const FOLLOWUP_MAP: Record<string, string[]> = {
  hybent: ['What services do you offer?', 'Estimate project cost', 'Book a call'],
  services: ['Custom app cost & timeline', 'Hire dedicated engineers', 'Request proposal'],
  products: ['Try Hybent Hiring', 'Explore Recruiter Copilot', 'Book live demo'],
  pricing: ['Compare plans', 'Custom enterprise quote', 'Start 14-day free trial'],
  estimate: ['Summarize my requirements', 'Book a consultation call', 'See case studies'],
  meeting: ['Book demo now', 'Email contact@hybent.com', 'Explore services'],
  default: ['Estimate project cost', 'Compare pricing plans', 'Book a meeting'],
}

/* Response text repository */
const FAKE_RESPONSES: Record<string, { text: string; richCardKey?: string; followupKey?: string }> = {
  hybent: {
    text: `**Hybent** is an enterprise AI and software engineering consulting company. We build high-performance web applications, mobile platforms, and AI Copilot solutions for growing businesses.

### Our Core Offerings:
1. **Custom Software Engineering**: Scalable full-stack web and mobile systems.
2. **AI & RAG Solutions**: Fine-tuned LLMs, vector search, and copilot integrations.
3. **Dedicated Engineering Talent**: Senior developers embedded into your workflow.`,
    followupKey: 'hybent',
  },

  services: {
    text: `Hybent provides end-to-end technical consulting and engineering services:

- 🚀 **Custom Web & Mobile Engineering**: React, Next.js, React Native, Python, FastAPI.
- 🤖 **Enterprise AI & RAG Solutions**: OpenAI, Supabase Vector, custom agentic workflows.
- ⚡ **Cloud & Microservices**: Docker, Kubernetes, AWS, GCP, CI/CD pipelines.
- 🎯 **Dedicated Tech Staffing**: Senior full-stack, backend, and AI engineers.`,
    richCardKey: 'services',
    followupKey: 'services',
  },

  products: {
    text: `Our flagship platform is **Hybent Hiring** — an AI-powered candidate screening and recruitment copilot!

### Key Capabilities:
* **Resume Parsing & Indexing**: Instant vectorization of candidate CVs.
* **AI Candidate Pre-Screener**: Automated video/text interview screening.
* **Recruiter Copilot**: AI-generated interview questions and candidate match scoring.`,
    richCardKey: 'products',
    followupKey: 'products',
  },

  pricing: {
    text: `We offer transparent pricing models tailored for startups and enterprise organizations:

- **Starter ($299/mo)**: Ideal for fast-growing teams needing core AI recruitment.
- **Pro ($799/mo)**: Advanced copilot workflows, multi-seat access, and priority support.
- **Enterprise (Custom)**: Dedicated cloud infrastructure, custom SLA, and tailored AI models.`,
    richCardKey: 'pricing',
    followupKey: 'pricing',
  },

  estimate: {
    text: `Here is a preliminary cost and timeline estimate for a typical **Custom Web & AI Application**:

- 💰 **Estimated Budget Range**: **$15,000 – $35,000**
- ⏱️ **Estimated Timeline**: **4 to 8 weeks**

*Note: This is a preliminary initial estimate subject to detailed technical discovery.*

Would you like me to summarize your project requirements into a formal Project Brief or schedule a 15-minute call with our team?`,
    richCardKey: 'timeline',
    followupKey: 'estimate',
  },

  meeting: {
    text: `I'd be happy to schedule a 15-minute technical consultation call with a Hybent Solutions Architect!

Please select an action below to pick a convenient date and time:`,
    richCardKey: 'booking',
    followupKey: 'meeting',
  },

  faq: {
    text: `Here are answers to common questions about working with Hybent:`,
    richCardKey: 'faq',
    followupKey: 'default',
  },

  default: {
    text: `Thank you for reaching out! As your **AI Business Copilot**, I can help you evaluate software options, estimate development costs, or book a consultation with our technical team.

What type of project or service can I assist you with today?`,
    followupKey: 'default',
  },
}

export function useChat(
  initialMessages?: ChatMessageItem[],
  onMessagesChange?: (messages: ChatMessageItem[]) => void
) {
  const [messages, setMessages] = useState<ChatMessageItem[]>(
    initialMessages || [INITIAL_WELCOME_MESSAGE]
  )
  const [isTyping, setIsTyping] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const activeStreamTimer = useRef<number | null>(null)

  const getTime = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const setAndSyncMessages = useCallback(
    (updater: (prev: ChatMessageItem[]) => ChatMessageItem[]) => {
      setMessages((prev) => {
        const next = updater(prev)
        if (onMessagesChange) onMessagesChange(next)
        return next
      })
    },
    [onMessagesChange]
  )

  const streamFakeResponse = useCallback(
    (userText: string) => {
      setIsTyping(true)

      const lower = userText.toLowerCase()
      let payload = FAKE_RESPONSES.default
      if (lower.includes('estimate') || lower.includes('cost') || lower.includes('how much') || lower.includes('timeline')) {
        payload = FAKE_RESPONSES.estimate
      } else if (lower.includes('service') || lower.includes('software')) {
        payload = FAKE_RESPONSES.services
      } else if (lower.includes('product') || lower.includes('hiring')) {
        payload = FAKE_RESPONSES.products
      } else if (lower.includes('pricing') || lower.includes('compare')) {
        payload = FAKE_RESPONSES.pricing
      } else if (lower.includes('meeting') || lower.includes('book') || lower.includes('call') || lower.includes('consultation')) {
        payload = FAKE_RESPONSES.meeting
      } else if (lower.includes('faq') || lower.includes('question')) {
        payload = FAKE_RESPONSES.faq
      } else if (lower.includes('hybent')) {
        payload = FAKE_RESPONSES.hybent
      }

      setTimeout(() => {
        setIsTyping(false)
        setIsStreaming(true)

        const aiMessageId = `ai-${Date.now()}`
        const initialAiMsg: ChatMessageItem = {
          id: aiMessageId,
          sender: 'ai',
          text: '',
          timestamp: getTime(),
          isStreaming: true,
          richCard: payload.richCardKey ? RICH_CARDS[payload.richCardKey] : undefined,
          followups: payload.followupKey ? FOLLOWUP_MAP[payload.followupKey] : undefined,
        }

        setAndSyncMessages((prev) => [...prev, initialAiMsg])

        const words = payload.text.split(' ')
        let currentIndex = 0

        if (activeStreamTimer.current) {
          clearInterval(activeStreamTimer.current)
        }

        activeStreamTimer.current = window.setInterval(() => {
          if (currentIndex < words.length) {
            const nextText = words.slice(0, currentIndex + 1).join(' ')
            setAndSyncMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId ? { ...msg, text: nextText } : msg
              )
            )
            currentIndex++
          } else {
            if (activeStreamTimer.current) {
              clearInterval(activeStreamTimer.current)
              activeStreamTimer.current = null
            }
            setAndSyncMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
              )
            )
            setIsStreaming(false)
          }
        }, 30)
      }, 500)
    },
    [setAndSyncMessages]
  )

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return

      const userMsg: ChatMessageItem = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: trimmed,
        timestamp: getTime(),
      }

      setAndSyncMessages((prev) => [...prev, userMsg])
      streamFakeResponse(trimmed)
    },
    [isStreaming, streamFakeResponse, setAndSyncMessages]
  )

  const regenerateResponse = useCallback(() => {
    if (isStreaming || messages.length === 0) return

    const lastUserIndex = [...messages].reverse().findIndex((m) => m.sender === 'user')
    if (lastUserIndex !== -1) {
      const actualIndex = messages.length - 1 - lastUserIndex
      const lastUserMsg = messages[actualIndex]

      setAndSyncMessages((prev) => prev.slice(0, actualIndex + 1))
      streamFakeResponse(lastUserMsg.text)
    }
  }, [isStreaming, messages, setAndSyncMessages, streamFakeResponse])

  const editAndResendMessage = useCallback(
    (oldMsgId: string, newText: string) => {
      const index = messages.findIndex((m) => m.id === oldMsgId)
      if (index === -1) return

      const updatedUserMsg: ChatMessageItem = {
        ...messages[index],
        text: newText,
        timestamp: getTime(),
      }

      setAndSyncMessages((prev) => [...prev.slice(0, index), updatedUserMsg])
      streamFakeResponse(newText)
    },
    [messages, setAndSyncMessages, streamFakeResponse]
  )

  const toggleLike = useCallback(
    (msgId: string) => {
      setAndSyncMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, liked: !m.liked, disliked: false } : m
        )
      )
    },
    [setAndSyncMessages]
  )

  const toggleDislike = useCallback(
    (msgId: string) => {
      setAndSyncMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, disliked: !m.disliked, liked: false } : m
        )
      )
    },
    [setAndSyncMessages]
  )

  return {
    messages,
    setMessages,
    isTyping,
    isStreaming,
    sendMessage,
    regenerateResponse,
    editAndResendMessage,
    toggleLike,
    toggleDislike,
  }
}
