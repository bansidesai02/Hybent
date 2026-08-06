import { useState } from 'react'
import { Check, Copy, Terminal } from 'lucide-react'

interface CodeBlockProps {
  language?: string
  value: string
}

export function CodeBlock({ language = 'code', value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback copy strategy if clipboard API fails
      const textarea = document.createElement('textarea')
      textarea.value = value
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const displayLang = language.replace(/^language-/, '')

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-[#0d091a] text-slate-200 font-mono text-xs shadow-md">
      {/* Code Block Header */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#18112d] border-b border-slate-800 text-slate-400">
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          <Terminal className="w-3.5 h-3.5 text-violet-400" />
          <span className="uppercase tracking-wider text-slate-300">
            {displayLang || 'code'}
          </span>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-[11px]"
          title="Copy code"
          aria-label="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-3.5 overflow-x-auto leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
        <pre className="m-0 font-mono text-xs text-violet-100 whitespace-pre">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  )
}
