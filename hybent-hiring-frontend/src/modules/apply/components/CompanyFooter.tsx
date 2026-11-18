import { useEffect } from 'react'

/** Footer of a company's careers and apply pages. */
export function CompanyFooter({ company }: { company: string }) {
  return (
    <footer className="mt-hb-10 border-t border-hb-border pt-hb-5 text-center">
      <p className="text-hb-sm font-semibold text-hb-muted">{company}</p>
      <p className="mt-1.5 text-hb-xs text-hb-dim">
        © {new Date().getFullYear()} {company}. Powered by{' '}
        <a href="https://hybent.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-hb-blue hover:underline">
          Hybent
        </a>
      </p>
    </footer>
  )
}

/** Company pages are reached only through the company's own links, so keep
 * them out of search engines. */
export function useNoIndex() {
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex, nofollow'
    document.head.appendChild(m)
    return () => m.remove()
  }, [])
}
