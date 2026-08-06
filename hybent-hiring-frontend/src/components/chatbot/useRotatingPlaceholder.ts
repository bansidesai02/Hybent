import { useState, useEffect } from 'react'

const PLACEHOLDERS = [
  'Ask Hybent AI anything...',
  'Need AI software?',
  'Looking for pricing?',
  'Book a meeting...',
  'Want to build a SaaS?',
  'Ask about Hybent products...',
]

export function useRotatingPlaceholder(intervalMs = 3500): string {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % PLACEHOLDERS.length)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return PLACEHOLDERS[index]
}
