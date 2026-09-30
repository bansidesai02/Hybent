import { SiteView } from '../components/SiteView'

const FACTS = [
  { label: 'Live product', value: 'Hybent Hiring', live: true },
  { label: 'We build', value: 'Web, mobile & AI software' },
  { label: 'First release', value: '4–8 weeks' },
  { label: 'Extra hands', value: 'Dedicated pre-vetted engineers' },
  { label: 'Based in', value: 'Ahmedabad, India' },
]

const PRINCIPLES = [
  {
    title: 'Honest timelines',
    text: 'We quote realistically and ship when we say we will. No surprise invoices, no “two more weeks” forever.',
  },
  {
    title: 'AI with accountability',
    text: 'Our AI is explainable and auditable — you can always see why it made a recommendation. You stay in control of every decision.',
  },
  {
    title: 'Partners, not vendors',
    text: 'We win when you win. We’d rather build one product that lasts five years than five products that last five months.',
  },
]

const TEAM = [
  {
    name: 'Bansi Desai',
    role: 'Founder',
    bio: 'Obsessed with making AI genuinely useful for real businesses.',
    photo: '/hybent/team-bansi-desai.jpg',
    width: 600,
    height: 899,
  },
  {
    name: 'Yash Desai',
    role: 'Co-Founder',
    bio: 'Focused on building software that ships on time and lasts for years.',
    photo: '/hybent/team-yash-desai.jpg',
    width: 600,
    height: 800,
  },
]

const Bars = () => <span className="bars"><i></i><i></i><i></i></span>

export default function AboutPage() {
  return (
    <SiteView route="about">
      <section className="hero ab-hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap ab-hero__grid">
          <div>
            <p className="eyebrow" data-rv="up"><Bars /><span>About HYBENT</span></p>
            <h1 className="ab-hero__title" data-rv="up" data-delay="80"><span className="grad-text">AI-powered software,</span> built for businesses that need results.</h1>
            <p className="hero__sub" data-rv="up" data-delay="160">We build custom software and AI products — including Hybent Hiring — that remove work instead of adding another dashboard. For teams in India and worldwide.</p>
            <div className="hero__actions" data-rv="up" data-delay="240">
              <a className="btn btn-primary btn-lg" href="/contact">Talk to us <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg></a>
              <a className="link-arrow" href="/about/team" style={{ alignSelf: "center", marginLeft: "8px" }}>Meet the founders <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
            </div>
          </div>

          <aside className="ab-card ab-facts"data-rv="up" data-delay="200" aria-label="HYBENT at a glance">
            <p className="mono">At a glance</p>
            <dl>
              {FACTS.map((f) => (
                <div className="ab-facts__row" key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}{f.live && <span className="badge badge--live"><i className="dot"></i>Live</span>}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      <section className="section ab-sec" id="story">
        <div className="wrap ab-story">
          <div className="ab-story__aside" data-rv="up">
            <p className="eyebrow"><Bars /><span>Our story</span></p>
            <h2 className="h-lg">Why we built HYBENT</h2>
            <blockquote className="ab-quote">AI should genuinely remove work, not just add another dashboard.</blockquote>
          </div>
          <div className="ab-prose" data-rv="up" data-delay="100">
            <p className="ab-prose__lede">We kept watching the same two problems slow businesses down.</p>
            <p>Building software took too long and cost too much — agencies over-promised, freelancers disappeared, and internal teams were already stretched thin. And hiring, the thing every growing company needs most, was drowning teams in manual work: hundreds of resumes, endless spreadsheets, decisions made on gut feel at midnight.</p>
            <p>So we stopped complaining and started building.</p>
            <p>HYBENT began with a simple conviction: AI should genuinely remove work, not just add another dashboard. Today we do two things. Our services team designs and builds custom web, mobile and AI software for businesses — end to end, from first sketch to maintenance. And our product line is led by Hybent Hiring, an AI recruitment platform that parses resumes, screens candidates with explainable AI, and hands recruiters back their time.</p>
            <p>We&rsquo;re based in Ahmedabad, India, and we work with teams everywhere. We ship fast, we give honest timelines, and we treat every client like a long-term partner — because the best work comes from long relationships.</p>
          </div>
        </div>
      </section>

      <section className="section ab-sec" id="what-we-do">
        <div className="wrap">
          <div className="ab-head" data-rv="up">
            <p className="eyebrow"><Bars /><span>What we do</span></p>
            <h2 className="h-lg">Two ways we work with you</h2>
          </div>
          <div className="ab-offer">
            <article className="ab-card ab-offer__card" data-rv="up">
              <div className="ab-offer__top"><span className="mono">01 · Products</span><span className="badge badge--live"><i className="dot"></i>Live</span></div>
              <h3 className="h-md">Hybent Hiring — our AI recruitment platform</h3>
              <p className="ab-offer__text">Resume parsing, AI-powered screening, interview management, and a recruiter copilot — so your team shortlists in minutes, not days.</p>
              <ul className="ab-chips"><li>Resume parsing</li><li>AI screening</li><li>Interview management</li><li>Recruiter copilot</li></ul>
              <div className="ab-offer__links">
                <a className="link-arrow" href="/products/hiring">Explore Hybent Hiring <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
              </div>
            </article>
            <article className="ab-card ab-offer__card" data-rv="up" data-delay="100">
              <div className="ab-offer__top"><span className="mono">02 · IT Services</span></div>
              <h3 className="h-md">Custom software, built end to end</h3>
              <p className="ab-offer__text">Web, mobile and AI software designed, built, tested and maintained by one team. First working release in 4–8 weeks. Dedicated pre-vetted engineers available when you need extra hands.</p>
              <ul className="ab-chips"><li>Web apps</li><li>Mobile apps</li><li>AI software</li><li>Testing &amp; QA</li><li>Maintenance</li></ul>
              <div className="ab-offer__links">
                <a className="link-arrow" href="/services">Start a project <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
                <a className="link-arrow" href="/hire-talent">Hire engineers <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section ab-sec" id="how-we-work">
        <div className="wrap">
          <div className="ab-head" data-rv="up">
            <p className="eyebrow"><Bars /><span>How we work</span></p>
            <h2 className="h-lg">What you can expect from us</h2>
          </div>
          <ol className="ab-principles">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title} data-rv="up" data-delay={i * 90}>
                <span className="ab-principles__num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="h-sm">{p.title}</h3>
                <p className="small">{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section ab-sec" id="team">
        <div className="wrap">
          <div className="ab-head" data-rv="up">
            <p className="eyebrow"><Bars /><span>Team</span></p>
            <h2 className="h-lg">The people behind HYBENT</h2>
          </div>
          <div className="ab-team">
            {TEAM.map((m, i) => (
              <article className="ab-card ab-person" key={m.name} data-rv="up" data-delay={i * 100}>
                <div className="ab-person__photo">
                  <img src={m.photo} width={m.width} height={m.height} alt={`${m.name}, ${m.role} of HYBENT`} loading="lazy" decoding="async" />
                </div>
                <div>
                  <span className="ab-person__role">{m.role}</span>
                  <h3 className="ab-person__name">{m.name}</h3>
                  <p className="ab-person__bio">{m.bio}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section ab-sec ab-sec--last">
        <div className="wrap">
          <div className="cta-band ab-cta" data-rv="scale">
            <div>
              <h2 className="h-md">Have a project — or a hiring problem?</h2>
              <p className="lead" style={{ marginTop: "10px" }}>Talk to us. We&rsquo;ll scope it honestly and tell you what it really takes.</p>
            </div>
            <a className="btn btn-primary btn-lg" href="/contact">Talk to us <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg></a>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
