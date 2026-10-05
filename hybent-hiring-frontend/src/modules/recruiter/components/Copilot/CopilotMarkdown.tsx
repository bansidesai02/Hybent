/**
 * CopilotMarkdown
 * Renders a Copilot reply's Markdown with chat-specific formatting:
 *
 *  - Tables are real, styled tables when there's room, and turn into one small
 *    card per row (label: value) when the chat is narrow — a phone, or a
 *    narrow panel — so a comparison never needs sideways scrolling. The switch
 *    is a CSS container query on the chat's width, not the screen's (index.css).
 *  - A reply that opens with a bold-only line ("**12 candidates found.**") gets
 *    it as a headline, which is how the agent is told to lead every answer.
 *  - Long emails / URLs / code wrap instead of widening the bubble.
 */
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/* Minimal hast shapes — enough to read a table's text for the card view. */
type HastNode = { type: string; tagName?: string; value?: string; children?: HastNode[] }

function hastText(node?: HastNode): string {
  if (!node) return ''
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(hastText).join('')
}

function hastChildren(node: HastNode | undefined, tag: string): HastNode[] {
  return (node?.children ?? []).filter((c) => c.type === 'element' && c.tagName === tag)
}

function tableData(node?: HastNode): { headers: string[]; rows: string[][] } {
  const thead = hastChildren(node, 'thead')[0]
  const tbody = hastChildren(node, 'tbody')[0]
  const headRow = hastChildren(thead, 'tr')[0]
  const headers = hastChildren(headRow, 'th').map((c) => hastText(c).trim())
  const rows = hastChildren(tbody, 'tr').map((tr) =>
    (tr.children ?? [])
      .filter((c) => c.type === 'element' && (c.tagName === 'td' || c.tagName === 'th'))
      .map((c) => hastText(c).trim()),
  )
  return { headers, rows }
}

/** The narrow-width version of a table: one card per row. */
function TableCards({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="cm-table-cards grid gap-2">
      {rows.map((row, ri) => {
        const [title, ...rest] = row
        return (
          <div key={ri} className="rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3 py-2.5">
            <p className="text-hb-sm font-semibold text-hb-text">{title || '—'}</p>
            {rest.length > 0 && (
              <dl className="mt-1.5 grid gap-1">
                {rest.map((cell, ci) => (
                  <div key={ci} className="flex items-baseline justify-between gap-3 text-hb-xs">
                    <dt className="shrink-0 text-hb-muted">{headers[ci + 1] || `Column ${ci + 2}`}</dt>
                    <dd className="min-w-0 text-right font-medium text-hb-text [overflow-wrap:anywhere]">{cell || '—'}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )
      })}
    </div>
  )
}

const components: Components = {
  table({ node, children }) {
    const { headers, rows } = tableData(node as unknown as HastNode)
    return (
      <div className="cm-table my-3">
        <div className="cm-table-wide overflow-x-auto rounded-hb-sm border border-hb-border">
          <table>{children}</table>
        </div>
        <TableCards headers={headers} rows={rows} />
      </div>
    )
  },
  p({ node, children }) {
    // A paragraph that is only bold text is the answer's headline.
    const kids = (node as unknown as HastNode)?.children ?? []
    const onlyStrong =
      kids.length > 0 &&
      kids.every((k) => (k.type === 'element' && k.tagName === 'strong') || (k.type === 'text' && !k.value?.trim()))
    return <p className={onlyStrong ? 'cm-lead' : undefined}>{children}</p>
  },
  a({ href, children }) {
    const external = !!href && /^https?:\/\//.test(href) && !href.includes(window.location.host)
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>
        {children}
      </a>
    )
  },
}

export function CopilotMarkdown({ children }: { children: string }) {
  return (
    <div className="copilot-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
