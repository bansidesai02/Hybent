/**
 * Typewriter pacing for streamed Copilot replies.
 *
 * The server sends text in uneven bursts — a few tokens, then a whole result
 * card in one go. Showing each burst as it lands makes cards "pop" in at once.
 * This queue reveals text at a steady pace instead, the way Claude does:
 *
 *  - a few characters per animation frame, speeding up when a backlog builds,
 *    so a big card types out quickly but never appears all at once;
 *  - non-text events (steps, approval, done) are queued in order, so they fire
 *    only after the text that came before them has been revealed;
 *  - in a background tab (no animation frames) everything is flushed at once.
 */

type Item = { kind: 'text'; text: string } | { kind: 'event'; run: () => void }

/** A backlog is cleared in roughly this many frames (~0.6s at 60fps). */
const FRAMES_TO_CLEAR_BACKLOG = 36
/** Never slower than this many characters per frame. */
const MIN_CHARS_PER_FRAME = 2

export function createSmoothStream(onText: (text: string) => void) {
  const queue: Item[] = []
  let frame: number | null = null
  let drainWaiters: Array<() => void> = []
  let stopped = false

  const backlog = () => queue.reduce((n, item) => n + (item.kind === 'text' ? item.text.length : 0), 0)

  const settle = () => {
    if (queue.length === 0) {
      drainWaiters.forEach((resolve) => resolve())
      drainWaiters = []
    }
  }

  const flushAll = () => {
    while (queue.length) {
      const item = queue.shift()!
      if (item.kind === 'text') onText(item.text)
      else item.run()
    }
    settle()
  }

  const tick = () => {
    frame = null
    if (stopped) return
    if (typeof document !== 'undefined' && document.hidden) {
      flushAll()
      return
    }
    let budget = Math.max(MIN_CHARS_PER_FRAME, Math.ceil(backlog() / FRAMES_TO_CLEAR_BACKLOG))
    let out = ''
    while (queue.length) {
      const head = queue[0]
      if (head.kind === 'event') {
        // Text before an event must be on screen before the event runs.
        if (out) {
          onText(out)
          out = ''
        }
        queue.shift()
        head.run()
        continue
      }
      if (budget <= 0) break
      let take = head.text.slice(0, budget)
      // Don't split a word if the rest of it is close by.
      const rest = head.text.slice(take.length)
      const wordTail = rest.match(/^\S{1,12}/)
      if (wordTail && !/\s$/.test(take)) take += wordTail[0]
      head.text = head.text.slice(take.length)
      budget -= take.length
      out += take
      if (!head.text) queue.shift()
    }
    if (out) onText(out)
    if (queue.length) schedule()
    else settle()
  }

  const schedule = () => {
    if (frame !== null || stopped) return
    if (typeof requestAnimationFrame === 'undefined') {
      flushAll()
      return
    }
    frame = requestAnimationFrame(tick)
  }

  return {
    /** Queue text to be revealed gradually. */
    text(text: string) {
      if (!text || stopped) return
      queue.push({ kind: 'text', text })
      schedule()
    },
    /** Run `fn` once all text queued before it has been revealed. */
    event(fn: () => void) {
      if (stopped) return
      queue.push({ kind: 'event', run: fn })
      schedule()
    },
    /** Resolves when everything queued so far has been shown. */
    drain(): Promise<void> {
      if (queue.length === 0) return Promise.resolve()
      return new Promise((resolve) => drainWaiters.push(resolve))
    },
    /** Drop anything not yet shown (e.g. the request was aborted). */
    stop() {
      stopped = true
      if (frame !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(frame)
      frame = null
      queue.length = 0
      settle()
    },
  }
}
