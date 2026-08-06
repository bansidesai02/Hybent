import ReactMarkdown from 'react-markdown'
import { CodeBlock } from './CodeBlock'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !match && !String(children).includes('\n')

          if (!isInline) {
            return (
              <CodeBlock
                language={match ? match[1] : 'text'}
                value={String(children).replace(/\n$/, '')}
              />
            )
          }

          return (
            <code
              className="px-1.5 py-0.5 rounded bg-violet-100/80 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 font-mono text-[12px] border border-violet-200/60 dark:border-violet-800/40"
              {...props}
            >
              {children}
            </code>
          )
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 dark:text-violet-400 underline underline-offset-2 hover:text-pink-500 transition-colors font-medium"
            >
              {children}
            </a>
          )
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        },
        ul({ children }) {
          return <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
        },
        ol({ children }) {
          return <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>
        },
        h1({ children }) {
          return <h1 className="text-base font-bold my-2 text-[#1a1040] dark:text-white">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-sm font-bold my-1.5 text-[#1a1040] dark:text-white">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-xs font-semibold my-1 text-[#1a1040] dark:text-white">{children}</h3>
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-violet-400 pl-3 my-2 italic text-slate-600 dark:text-slate-300 bg-violet-50/50 dark:bg-violet-950/30 py-1 rounded-r-md">
              {children}
            </blockquote>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
