export function Footer() {
  return (
    <footer className="footer">
      <svg className="footer__field" aria-hidden="true" viewBox="0 0 900 200" width="900" height="200" style={{ maxWidth: "100%" }}>
          <rect width="900" height="200" fill="var(--surface-2)" />
          <g opacity=".5">
            <g stroke="url(#hbgh)" strokeWidth="1" fill="none" opacity=".55">
              <path d="M80 150L200 70M200 70L330 130M330 130L470 50M470 50L610 120M610 120L740 60M740 60L850 140M200 70L330 40M330 130L470 170M610 120L500 170" />
            </g>
            <g fill="url(#hbgh)">
              <circle cx="80" cy="150" r="3.5" /><circle cx="200" cy="70" r="5" /><circle cx="330" cy="130" r="3.5" />
              <circle cx="470" cy="50" r="5.5" /><circle cx="610" cy="120" r="3.5" /><circle cx="740" cy="60" r="4.5" />
              <circle cx="850" cy="140" r="3.5" /><circle cx="330" cy="40" r="2.6" /><circle cx="470" cy="170" r="2.6" /><circle cx="500" cy="170" r="2.6" />
            </g>
          </g>
        </svg>
      <div className="wrap">
        <div className="footer__top">
          <div className="footer__brand">
            <img className="wm t-dark" src="/assets/hybent-wordmark-dark.png" alt="HYBENT" /><img className="wm t-light" src="/assets/hybent-wordmark-light.png" alt="HYBENT" />
            <p className="small" style={{ maxWidth: "34ch" }}>Intelligent enterprise software, built AI-first. Headquartered in Ahmedabad, India.</p>
            <div className="socials" style={{ marginTop: "22px" }}>
              <a href="/" aria-label="LinkedIn"><svg aria-hidden="true"><use href="#i-in" /></svg></a>
              <a href="/" aria-label="X"><svg aria-hidden="true"><use href="#i-x" /></svg></a>
              <a href="/" aria-label="GitHub"><svg aria-hidden="true"><use href="#i-gh" /></svg></a>
              <a href="/" aria-label="YouTube"><svg aria-hidden="true"><use href="#i-yt" /></svg></a>
            </div>
          </div>
          <div><h5>Products</h5><ul>
            <li><a href="/products">Hybent Hiring</a></li><li><a href="/products/roadmap">CRM — soon</a></li><li><a href="/products/roadmap">HRMS — soon</a></li>
            <li><a href="/products/roadmap">ERP — soon</a></li><li><a href="/products/roadmap">Analytics — soon</a></li><li><a href="/products/roadmap">Full roadmap</a></li></ul></div>
          <div><h5>Solutions</h5><ul>
            <li><a href="/solutions">Talent acquisition</a></li><li><a href="/solutions">People operations</a></li>
            <li><a href="/solutions">Hiring managers</a></li><li><a href="/solutions">IT &amp; security</a></li><li><a href="/industries">Industries</a></li></ul></div>
          <div><h5>Company</h5><ul>
            <li><a href="/about">About</a></li><li><a href="/about/timeline">Our story</a></li><li><a href="/careers">Careers</a></li>
            <li><a href="/resources">Blog</a></li><li><a href="/contact">Contact</a></li></ul></div>
          <div><h5>Resources</h5><ul>
            <li><a href="/security">Security</a></li><li><a href="/platform/ecosystem">Platform</a></li><li><a href="/products/roadmap">Roadmap</a></li>
            <li><a href="/resources">Insights</a></li><li><a href="/contact">Contact sales</a></li></ul></div>
        </div>

        <div className="footer__tag"><img className="t-dark" src="/assets/tagline-dark.png" alt="Where vision meets innovation" /><img className="t-light" src="/assets/tagline-light.png" alt="Where vision meets innovation" /></div>

        <div className="footer__bottom">
          <p>© 2026 HYBENT. All rights reserved.</p>
          <p style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
            <a href="/privacy">Privacy</a><a href="/">Terms</a><a href="/">Cookies</a>
          </p>
        </div>
      </div>
    </footer>
  )
}
