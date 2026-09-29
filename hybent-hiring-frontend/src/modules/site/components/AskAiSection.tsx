/**
 * "Still wondering?" — links that open each AI assistant with a question
 * about HYBENT, so a visitor can check us with a third party before booking
 * a demo. The question names hybent.com so the assistant looks us up rather
 * than guessing (public/llms.txt is what it should find there).
 *
 * The Gemini app has no URL parameter that prefills a prompt, so "Ask Gemini"
 * opens Google Search's AI Mode (udm=50), which runs on Gemini and answers
 * straight away; where AI Mode is unavailable Google shows normal results.
 */

const PROMPT =
  'What is HYBENT (hybent.com) and what does its AI recruitment platform, Hybent Hiring, do? Who is it for, and why would a team choose it?'

const Q = encodeURIComponent(PROMPT)

// Row order follows the grid: two per row.
const ASSISTANTS = [
  { name: 'ChatGPT', logo: '/hybent/ai/chatgpt.svg', href: `https://chatgpt.com/?prompt=${Q}` },
  { name: 'Claude', logo: '/hybent/ai/claude.svg', href: `https://claude.ai/new?q=${Q}` },
  { name: 'Perplexity', logo: '/hybent/ai/perplexity.svg', href: `https://www.perplexity.ai/search?q=${Q}` },
  { name: 'Gemini', logo: '/hybent/ai/gemini.svg', href: `https://www.google.com/search?udm=50&q=${Q}` },
]

export function AskAiSection() {
  return (
    <section className="section section--tight-py-none" id="ask-ai">
      <div className="wrap">
        <div className="ask-ai" data-rv="up">
          <div className="ask-ai__intro">
            <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Ask AI about us</span></p>
            <h2 className="h-lg">Still wondering?</h2>
            <p className="lead">See what your favorite AI assistant has to say about HYBENT, then make an informed decision.</p>
          </div>
          <ul className="ask-ai__grid">
            {ASSISTANTS.map((a) => (
              <li key={a.name}>
                <a
                  className="ask-ai__item"
                  href={a.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ask ${a.name} about HYBENT (opens in a new tab)`}
                >
                  <img src={a.logo} width="28" height="28" alt="" loading="lazy" decoding="async" />
                  <span>Ask {a.name}</span>
                  <svg className="ask-ai__arw" width="16" height="16" aria-hidden="true"><use href="#i-arrow" /></svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
