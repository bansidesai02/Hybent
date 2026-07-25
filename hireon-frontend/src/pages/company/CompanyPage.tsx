import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CompanyPage.css';

export default function CompanyPage() {
  const [activePage, setActivePage] = useState('home');
  const [isNavScrolled, setIsNavScrolled] = useState(false);
  const [isProductsDropdownOpen, setIsProductsDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Hybent | Technology Company";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "Hybent is a modern technology company focused on building innovative digital products and scalable software solutions.");
    }
    
    const handleScroll = () => {
      setIsNavScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const goTo = (pageId: string) => {
    if (pageId === 'login') {
      navigate('/login');
      setMobileMenuOpen(false);
    } else {
      const targetPage = pageId === 'products' ? 'hybent-hiring' : pageId;
      setActivePage(targetPage);
      setMobileMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  return (
    <div className="company-page-root">
      

<nav className={`nav ${isNavScrolled ? "scrolled" : ""}`} id="nav">
  <div className="wrap">
    <div className="brand"><span className="mark">H</span>Hybent</div>
    <div className="navlinks">
      <a onClick={() => goTo("home")} className={activePage === "home" ? "active" : ""}>Home</a>
      <a onClick={() => goTo("about")} className={activePage === "about" ? "active" : ""}>About</a>
      <div className={`nav-dropdown ${isProductsDropdownOpen ? "open" : ""}`} onMouseEnter={() => setIsProductsDropdownOpen(true)} onMouseLeave={() => setIsProductsDropdownOpen(false)} id="productsDropdown">
        <a className={`nav-dropdown-trigger ${activePage === "hybent-hiring" ? "active" : ""}`} href="#" aria-haspopup="true" aria-expanded="false" onClick={(e) => { e.preventDefault(); navigate("/hiring"); }}>Products <span className="chev">▾</span></a>
        <div className="nav-dropdown-menu">
          <a className="product-card-link" onClick={() => { navigate("/hiring"); setIsProductsDropdownOpen(false); }}>
            <h4>Hybent Hiring</h4>
            <span>AI-Powered Hiring Platform</span>
          </a>
        </div>
      </div>
      <a onClick={() => goTo("services")} className={activePage === "services" ? "active" : ""}>Services</a>
      <a onClick={() => goTo("careers")} className={activePage === "careers" ? "active" : ""}>Careers</a>
      <a onClick={() => goTo("contact")} className={activePage === "contact" ? "active" : ""}>Contact</a>
    </div>
    <div className="navctas">
      <a onClick={() => goTo("contact")} className={`btn btn-ghost ${ activePage === "contact" ? "active" : "" }`}>Book a Call</a>
      <a className="btn btn-primary btn-sm" onClick={() => navigate("/hiring")}>Get Started</a>
    </div>
    <button className="mobile-menu-trigger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
      {mobileMenuOpen ? '✕' : '☰'}
    </button>
  </div>
  <div className={`mobile-nav-container ${mobileMenuOpen ? 'open' : ''}`}>
    <a onClick={() => goTo("home")}>Home</a>
    <a onClick={() => goTo("about")}>About</a>
    <a onClick={() => navigate("/hiring")}>Hybent Hiring (Product)</a>
    <a onClick={() => goTo("services")}>Services</a>
    <a onClick={() => goTo("careers")}>Careers</a>
    <a onClick={() => goTo("contact")}>Contact</a>
    <div className="mobile-nav-ctas">
      <a className="btn btn-secondary" onClick={() => goTo("contact")}>Book a Call</a>
      <a className="btn btn-primary" onClick={() => navigate("/hiring")}>Get Started</a>
    </div>
  </div>
</nav>

{/* ================= HOME ================= */}
<div className="page" id="page-home" style={{ display: activePage === "home" ? "block" : "none" }}>

  <section className="hero-split">
    <div className="wrap">
      <div className="hero-split-grid">
        <div className="hero-left">
          <div className="hero-badge"><span className="dot"></span>Technology Company • Software Products • AI Solutions</div>
          <div className="hero-kicker">Where Vision Meets <span className="grad-text">Innovation.</span></div>
          <h1 className="hero-heading">Build Technology That Powers Tomorrow.</h1>
          <p className="hero-desc">We build modern software for businesses that want to move faster. Simple experiences, intelligent automation, and products designed to solve real-world challenges.</p>
          <div className="hero-ctas-split">
            <a onClick={() => navigate("/hiring")} className={`btn btn-primary ${ activePage === "products" ? "active" : "" }`}>Explore Products</a>
            <a onClick={() => goTo("contact")} className={`btn btn-secondary ${ activePage === "contact" ? "active" : "" }`}>Book a Demo</a>
          </div>
          <div className="hero-trust">
            <div className="hero-trust-stars">★★★★★</div>
            <p>Trusted by ambitious businesses building the future.</p>
            <div className="hero-trust-logos">
              <span>Fintech</span><span>Healthcare</span><span>SaaS</span><span>Retail</span><span>Enterprise</span>
            </div>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-visual">
            <div className="hero-visual-glow"></div>
            <div className="dash-card dash-main">
              <div className="dash-main-head"><span className="dash-dot"></span><span className="dash-dot"></span><span className="dash-dot"></span></div>
              <div className="dash-chip">Live Overview</div>
              <div className="dash-bars">
                <span style={{ height: '38%' }}></span><span style={{ height: '64%' }}></span><span style={{ height: '50%' }}></span><span style={{ height: '88%' }}></span><span style={{ height: '60%' }}></span><span style={{ height: '76%' }}></span>
              </div>
              <div className="dash-stat"><strong>+42%</strong><span>Efficiency Gain</span></div>
            </div>
            <div className="dash-card float-card fc1"><span className="fc-icon">🤖</span><span>AI Recruitment</span></div>
            <div className="dash-card float-card fc2"><span className="fc-icon">📊</span><span>Analytics</span></div>
            <div className="dash-card float-card fc3"><span className="fc-icon">⚡</span><span>Workflow Automation</span></div>
            <div className="dash-card float-card fc4"><span className="fc-icon">☁</span><span>Cloud Platform</span></div>
            <div className="dash-card float-card fc5"><span className="fc-icon">🔒</span><span>Enterprise Security</span></div>
            <div className="dash-card float-card fc6"><span className="fc-icon">📈</span><span>Business Growth</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section className="section-mist">
    <div className="wrap">
      <div className="section-head"><div className="eyebrow">How We Help</div><h2>Software. Services. Solved.</h2></div>
      <div className="grid3">
        <div className="card"><div className="chip">▦</div><h3>Software Products</h3><p>We design and build proprietary software products, including Hybent Hiring, our AI-powered hiring platform.</p><a onClick={() => navigate("/hiring")} className={`link ${ activePage === "products" ? "active" : "" }`}>See our products</a></div>
        <div className="card"><div className="chip">⚙</div><h3>Professional IT Services</h3><p>Custom development, cloud infrastructure, and technology consulting for growing businesses.</p><a onClick={() => goTo("services")} className={`link ${ activePage === "services" ? "active" : "" }`}>View services</a></div>
        <div className="card"><div className="chip">✦</div><h3>AI &amp; Innovation</h3><p>We embed intelligent automation into everything we build, from products to client engagements.</p><a onClick={() => goTo("about")} className={`link ${ activePage === "about" ? "active" : "" }`}>Our approach</a></div>
      </div>
    </div>
  </section>

  <section>
    <div className="wrap grid2" style={{ alignItems: 'center', gridTemplateColumns: '1fr 1.1fr', gap: '60px' }}>
      <div className="diagram-box" style={{ height: '380px' }}>
        <svg className="diagram-svg" viewBox="0 0 400 380" preserveAspectRatio="none">
          <defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8A3FFC"/><stop offset="1" stop-color="#E9349A"/></linearGradient></defs>
          <path d="M96,84 C160,84 160,190 200,190" stroke="url(#lg1)" stroke-width="1.5" fill="none" opacity="0.45"/>
          <path d="M304,84 C240,84 240,190 200,190" stroke="url(#lg1)" stroke-width="1.5" fill="none" opacity="0.45"/>
          <path d="M96,296 C160,296 160,190 200,190" stroke="url(#lg1)" stroke-width="1.5" fill="none" opacity="0.45"/>
          <path d="M304,296 C240,296 240,190 200,190" stroke="url(#lg1)" stroke-width="1.5" fill="none" opacity="0.45"/>
        </svg>
        <div className="diagram-node center" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}><span className="ic">H</span>Hybent Core</div>
        <div className="diagram-node" style={{ left: '6%', top: '20%' }}><span className="ic">▦</span>Software Products</div>
        <div className="diagram-node" style={{ right: '6%', top: '20%', animationDelay: '.4s' }}><span className="ic">⚙</span>IT Services</div>
        <div className="diagram-node" style={{ left: '6%', bottom: '16%', animationDelay: '.8s' }}><span className="ic">✦</span>AI &amp; Automation</div>
        <div className="diagram-node" style={{ right: '6%', bottom: '16%', animationDelay: '1.2s' }}><span className="ic">☁</span>Cloud Infra</div>
      </div>
      <div>
        <div className="eyebrow">About Hybent</div>
        <h2 style={{ fontSize: '36px', marginBottom: '18px' }}>A technology company built on doing both things well.</h2>
        <p style={{ color: 'var(--gray)', fontSize: '16.5px', lineHeight: '1.8', marginBottom: '16px' }}>Hybent is a modern technology company focused on building innovative digital products and scalable software solutions. We exist because most technology companies choose to either build products or deliver services — rarely both, and rarely well.</p>
        <p style={{ color: 'var(--gray)', fontSize: '16.5px', lineHeight: '1.8', marginBottom: '16px' }}>Our vision is a world where software is built with the same rigor as it's operated. Our mission is to bring product-grade thinking to every engagement, whether we're shipping our own platforms or extending your team.</p>
        <p style={{ color: 'var(--gray)', fontSize: '16.5px', lineHeight: '1.8' }}>Companies trust Hybent because we combine an AI-native product mindset with real engineering discipline — scalable architecture, thoughtful design, and long-term partnership over one-off delivery.</p>
      </div>
    </div>
  </section>

  <section className="section-mist">
    <div className="wrap">
      <div className="section-head"><div className="eyebrow">Services</div><h2>Professional IT Services.</h2></div>
      <div className="grid3-services">
        <div className="card"><div className="chip">⌥</div><h3>Custom Software Development</h3><p>Tailored applications engineered around your workflow, not a template.</p><a onClick={() => goTo("services")} className={`link ${ activePage === "services" ? "active" : "" }`}>Learn more</a></div>
        <div className="card"><div className="chip">✦</div><h3>AI Solutions</h3><p>Practical AI and automation embedded into products and internal tools.</p><a onClick={() => goTo("services")} className={`link ${ activePage === "services" ? "active" : "" }`}>Learn more</a></div>
        <div className="card"><div className="chip">◇</div><h3>Web Development</h3><p>Fast, accessible, production-grade web applications and marketing sites.</p><a onClick={() => goTo("services")} className={`link ${ activePage === "services" ? "active" : "" }`}>Learn more</a></div>
        <div className="card"><div className="chip">▦</div><h3>Mobile App Development</h3><p>Native-feeling iOS and Android apps built for real-world scale.</p><a onClick={() => goTo("services")} className={`link ${ activePage === "services" ? "active" : "" }`}>Learn more</a></div>
        <div className="card"><div className="chip">◈</div><h3>UI/UX Design</h3><p>Research-led design systems and interfaces people enjoy using.</p><a onClick={() => goTo("services")} className={`link ${ activePage === "services" ? "active" : "" }`}>Learn more</a></div>
        <div className="card"><div className="chip">☁</div><h3>Cloud Engineering</h3><p>Resilient, secure cloud infrastructure managed end-to-end.</p><a onClick={() => goTo("services")} className={`link ${ activePage === "services" ? "active" : "" }`}>Learn more</a></div>
        <div className="card"><div className="chip">▤</div><h3>Product Development</h3><p>From zero-to-one product strategy through to shipped software.</p><a onClick={() => goTo("services")} className={`link ${ activePage === "services" ? "active" : "" }`}>Learn more</a></div>
        <div className="card"><div className="chip">◎</div><h3>Enterprise Software</h3><p>Mission-critical systems built for compliance, security, and scale.</p><a onClick={() => goTo("services")} className={`link ${ activePage === "services" ? "active" : "" }`}>Learn more</a></div>
        <div className="card"><div className="chip">⚙</div><h3>API Development</h3><p>Clean, well-documented APIs that connect your systems reliably.</p><a onClick={() => goTo("services")} className={`link ${ activePage === "services" ? "active" : "" }`}>Learn more</a></div>
        <div className="card"><div className="chip">✦</div><h3>Digital Transformation</h3><p>Modernizing legacy systems and workflows for the next decade.</p><a onClick={() => goTo("services")} className={`link ${ activePage === "services" ? "active" : "" }`}>Learn more</a></div>
      </div>
    </div>
  </section>

  <section className="section-dark">
    <div className="hero-bg-blob" style={{ opacity: '0.5' }}></div>
    <div className="wrap spotlight">
      <div>
        <div className="eyebrow eyebrow-dark"><span className="dot"></span>Flagship Product</div>
        <h2>Meet Hybent Hiring.</h2>
        <p>Hybent Hiring is an AI-powered recruitment platform designed to help companies source, evaluate, manage, and hire exceptional talent faster through intelligent automation and modern recruitment workflows.</p>
        <div className="spotlight-ctas">
          <a className="btn btn-white" onClick={() => navigate("/hiring")}>Explore Hybent Hiring</a>
          <a className="btn btn-outline-white">Watch Demo</a>
        </div>
        <div className="stat-chips">
          <div className="stat-chip">AI Candidate Matching</div>
          <div className="stat-chip">Resume Parsing</div>
          <div className="stat-chip">Applicant Tracking</div>
          <div className="stat-chip">Smart Job Posting</div>
          <div className="stat-chip">Interview Scheduling</div>
          <div className="stat-chip">Candidate Pipeline</div>
          <div className="stat-chip">Hiring Analytics</div>
          <div className="stat-chip">Workflow Automation</div>
        </div>
      </div>
      <div className="glass-panel">
        <div className="ring-big"><div className="ring-big-inner"><div className="n">94%</div><div className="l">MATCH SCORE</div></div></div>
        <div className="mockup-card" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}>
          <div className="mockup-avatar"></div>
          <div className="mockup-lines"><div className="mockup-line w60" style={{ background: 'rgba(255,255,255,0.15)' }}></div><div className="mockup-line w40" style={{ background: 'rgba(255,255,255,0.1)' }}></div></div>
        </div>
        <div className="mockup-card" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}>
          <div className="mockup-avatar"></div>
          <div className="mockup-lines"><div className="mockup-line w60" style={{ background: 'rgba(255,255,255,0.15)' }}></div><div className="mockup-line w40" style={{ background: 'rgba(255,255,255,0.1)' }}></div></div>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div className="wrap">
      <div className="section-head"><div className="eyebrow">Why Choose Us</div><h2>Why Hybent</h2><p>Six reasons businesses choose Hybent as their long-term technology partner.</p></div>
      <div className="grid3">
        <div className="card"><span className="reason-num">01</span><div className="chip">✦</div><h3>Innovation First</h3><p>We believe technology should create opportunities, solve meaningful problems, and help businesses stay ahead through continuous innovation, creative thinking, and user-focused product development.</p></div>
        <div className="card"><span className="reason-num">02</span><div className="chip">⌥</div><h3>Engineering Excellence</h3><p>Our engineering process focuses on scalable architecture, clean code, security, testing, maintainability, and long-term product success.</p></div>
        <div className="card"><span className="reason-num">03</span><div className="chip">▤</div><h3>Scalable Solutions</h3><p>Every solution is built with future growth in mind, allowing startups and enterprises to scale without technical limitations.</p></div>
        <div className="card"><span className="reason-num">04</span><div className="chip">◎</div><h3>Experienced Team</h3><p>Our designers, developers, AI engineers, strategists, and product experts collaborate closely to deliver exceptional digital experiences.</p></div>
        <div className="card"><span className="reason-num">05</span><div className="chip">☁</div><h3>Modern Technologies</h3><p>We leverage Artificial Intelligence, Cloud Computing, Automation, Modern Web Technologies, APIs, Mobile Frameworks, and DevOps to build future-ready software.</p></div>
        <div className="card"><span className="reason-num">06</span><div className="chip">◈</div><h3>Long-Term Partnership</h3><p>We don't simply deliver projects. We become trusted technology partners, continuously improving and evolving products after launch.</p></div>
      </div>
    </div>
  </section>

  <section className="section-off">
    <div className="wrap">
      <div className="logo-strip-wrapper">
        <p className="logo-strip-label">Trusted by innovative teams</p>
        <div className="logo-strip">
          <div className="lg">NORTHPEAK</div><div className="lg">Lumio</div><div className="lg">VertexHR</div><div className="lg">Orbital</div><div className="lg">Fintra</div><div className="lg">Clearwave</div>
        </div>
      </div>
    </div>
  </section>


  <section className="section-mist">
    <div className="wrap" style={{ maxWidth: '760px' }}>
      <div className="section-head"><div className="eyebrow">FAQ</div><h2>Frequently asked questions.</h2></div>
      <details className="faq-item" open>
        <summary>What does Hybent actually do?</summary>
        <p>Hybent is a technology company that builds proprietary software products, including our flagship platform Hybent Hiring, and delivers professional IT services such as custom development, cloud engineering, and product design.</p>
      </details>
      <details className="faq-item">
        <summary>Is Hybent Hiring available on its own?</summary>
        <p>Yes. Hybent Hiring is our standalone AI-powered recruitment platform — companies can adopt it independently of any services engagement.</p>
      </details>
      <details className="faq-item">
        <summary>What industries do you work with?</summary>
        <p>We work across healthcare, finance, education, recruitment, retail, manufacturing, real estate, travel, logistics, startups, and enterprise organizations.</p>
      </details>
      <details className="faq-item">
        <summary>Do you work with startups or only enterprise clients?</summary>
        <p>Both. Our engagements range from early-stage startups building their first product to enterprises modernizing mission-critical systems.</p>
      </details>
      <details className="faq-item">
        <summary>How do we start a project with Hybent?</summary>
        <p>Reach out through our contact page and tell us about your project. We'll follow up to understand your goals before proposing next steps.</p>
      </details>
    </div>
  </section>

  <section>
    <div className="wrap">
      <div className="cta-banner">
        <h2>Let's Build the Future Together.</h2>
        <p>Whether you're launching a new product or scaling an existing one, Hybent is ready to build it with you.</p>
        <div className="cta-ctas"><a onClick={() => goTo("contact")} className={`btn btn-primary ${ activePage === "contact" ? "active" : "" }`}>Start Your Project</a><a onClick={() => goTo("contact")} className={`btn btn-secondary ${ activePage === "contact" ? "active" : "" }`}>Book a Consultation</a></div>
      </div>
    </div>
  </section>

</div>

{/* ================= ABOUT ================= */}
<div className="page" id="page-about" style={{ display: activePage === "about" ? "block" : "none" }}>
  <section className="hero" style={{ paddingTop: '170px' }}>
    <div className="wrap">
      <div className="eyebrow">About Hybent</div>
      <h1 style={{ fontSize: '56px' }}>We build technology that moves companies forward.</h1>
      <p className="sub">Founded on the belief that great software and great service shouldn't be separate disciplines.</p>
    </div>
  </section>

  <section className="section-tight">
    <div className="wrap grid2" style={{ alignItems: 'center', gridTemplateColumns: '1.3fr 1fr' }}>
      <div>
        <p style={{ color: 'var(--gray)', fontSize: '17px', lineHeight: '1.8', marginBottom: '20px' }}>Hybent started with a simple observation: most technology companies either build products or deliver services — rarely both, and rarely well. We set out to be different.</p>
        <p style={{ color: 'var(--gray)', fontSize: '17px', lineHeight: '1.8' }}>Today we design proprietary software, including our flagship platform Hybent Hiring, while partnering with businesses as their technology team — bringing product-grade thinking to every engagement.</p>
      </div>
      <div className="diagram-box" style={{ height: '340px' }}>
        <svg className="diagram-svg" viewBox="0 0 400 340" preserveAspectRatio="none">
          <defs><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8A3FFC"/><stop offset="1" stop-color="#E9349A"/></linearGradient></defs>
          <path d="M92,74 C155,74 155,170 200,170" stroke="url(#lg2)" stroke-width="1.5" fill="none" opacity="0.45"/>
          <path d="M308,74 C245,74 245,170 200,170" stroke="url(#lg2)" stroke-width="1.5" fill="none" opacity="0.45"/>
          <path d="M92,266 C155,266 155,170 200,170" stroke="url(#lg2)" stroke-width="1.5" fill="none" opacity="0.45"/>
          <path d="M308,266 C245,266 245,170 200,170" stroke="url(#lg2)" stroke-width="1.5" fill="none" opacity="0.45"/>
        </svg>
        <div className="diagram-node center" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}><span className="ic">H</span>Our Values</div>
        <div className="diagram-node" style={{ left: '4%', top: '16%' }}><span className="ic">✦</span>Innovation</div>
        <div className="diagram-node" style={{ right: '4%', top: '16%', animationDelay: '.4s' }}><span className="ic">◈</span>Integrity</div>
        <div className="diagram-node" style={{ left: '4%', bottom: '12%', animationDelay: '.8s' }}><span className="ic">◎</span>Excellence</div>
        <div className="diagram-node" style={{ right: '4%', bottom: '12%', animationDelay: '1.2s' }}><span className="ic">◇</span>Partnership</div>
      </div>
    </div>
  </section>

  <section className="section-mist">
    <div className="wrap">
      <div className="section-head"><div className="eyebrow">What Drives Us</div><h2>Our values.</h2></div>
      <div className="value-grid">
        <div className="card"><div className="chip">✦</div><h3>Innovation</h3><p>We build for where the industry is going, not where it's been.</p></div>
        <div className="card"><div className="chip">◈</div><h3>Integrity</h3><p>Honest counsel, even when it's not the easy answer.</p></div>
        <div className="card"><div className="chip">◎</div><h3>Excellence</h3><p>Craft and rigor in every line of code and every engagement.</p></div>
        <div className="card"><div className="chip">◇</div><h3>Partnership</h3><p>We succeed when the businesses we work with succeed.</p></div>
      </div>
    </div>
  </section>

  <section><div className="wrap"><div className="cta-banner"><h2>Join us in building what's next.</h2><div className="cta-ctas"><a onClick={() => goTo("careers")} className={`btn btn-primary ${ activePage === "careers" ? "active" : "" }`}>View Careers</a></div></div></div></section>
</div>

{/* ================= PRODUCTS ================= */}
<div className="page" id="page-products" style={{ display: activePage === "products" ? "block" : "none" }}>
  <section className="hero" style={{ paddingTop: '170px' }}>
    <div className="wrap">
      <div className="eyebrow">Our Products</div>
      <h1 style={{ fontSize: '56px' }}>Software built for impact.</h1>
      <p className="sub">We design proprietary products that solve real business problems — starting with Hybent Hiring.</p>
    </div>
  </section>

  <section className="section-tight">
    <div className="wrap">
      <div className="card" style={{ background: 'var(--mist)', border: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center', padding: '50px' }}>
        <div>
          <div className="eyebrow" style={{ background: 'white' }}>Flagship Product</div>
          <h2 style={{ fontSize: '34px', marginBottom: '14px' }}>Hybent Hiring — AI-Powered Hiring Platform</h2>
          <p style={{ color: 'var(--gray)', fontSize: '16px', lineHeight: '1.7', marginBottom: '20px' }}>Find, match, and hire top talent faster with an AI engine built for modern recruiting teams.</p>
          <a className="btn btn-primary" onClick={() => navigate("/hiring")}>Explore Hybent Hiring</a>
        </div>
        <div className="mockup-frame" style={{ transform: 'none', boxShadow: '0 20px 50px -20px rgba(20,18,26,0.2)' }}>
          <div className="mockup-chrome"><span></span><span></span><span></span></div>
          <div className="mockup-body">
            <div className="mockup-card"><div className="mockup-avatar"></div><div className="mockup-lines"><div className="mockup-line w60"></div><div className="mockup-line w40"></div></div><div className="match-ring"></div></div>
            <div className="mockup-card"><div className="mockup-avatar"></div><div className="mockup-lines"><div className="mockup-line w60"></div><div className="mockup-line w40"></div></div><div className="match-ring"></div></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div className="wrap">
      <div className="section-head"><div className="eyebrow">Roadmap</div><h2>More products, in progress.</h2></div>
      <div className="grid3">
        <div className="card" style={{ borderStyle: 'dashed' }}><div className="chip">✦</div><h3>Product Coming Soon</h3><p>We're always building. Our next platform is in early development.</p></div>
        <div className="card" style={{ borderStyle: 'dashed' }}><div className="chip">✦</div><h3>Product Coming Soon</h3><p>Sign up to be first to know when we launch something new.</p></div>
        <div style={{ borderStyle: 'dashed' }}><div className="chip">✦</div><h3>Have an idea?</h3><p>We partner with clients to co-develop new product concepts.</p><a onClick={() => goTo("contact")} className={`link card ${ activePage === "contact" ? "active" : "" }`}>Get in touch</a></div>
      </div>
    </div>
  </section>

  <section className="section-mist">
    <div className="wrap grid3" style={{ textAlign: 'center' }}>
      <div><h3 style={{ fontSize: '18px' }}>Human-Centered</h3><p style={{ color: 'var(--gray)', fontSize: '14.5px', marginTop: '8px' }}>Designed around how people actually work.</p></div>
      <div><h3 style={{ fontSize: '18px' }}>AI-Native</h3><p style={{ color: 'var(--gray)', fontSize: '14.5px', marginTop: '8px' }}>Intelligence built in, not bolted on.</p></div>
      <div><h3 style={{ fontSize: '18px' }}>Enterprise-Ready</h3><p style={{ color: 'var(--gray)', fontSize: '14.5px', marginTop: '8px' }}>Secure, scalable, and built to last.</p></div>
    </div>
  </section>

  <section><div className="wrap"><div className="cta-banner"><h2>Want to see our products in action?</h2><div className="cta-ctas"><a onClick={() => goTo("contact")} className={`btn btn-primary ${ activePage === "contact" ? "active" : "" }`}>Book a Demo</a></div></div></div></section>
</div>

{/* ================= HYBENT HIRING ================= */}
<div className="page" id="page-hybent-hiring" style={{ display: activePage === "hybent-hiring" ? "block" : "none" }}>
  <section className="hero" style={{ paddingTop: '190px' }}>
    <div className="hero-bg-blob"></div>
    <div className="hero-bg-blob2"></div>
    <div className="wrap">
      <div className="eyebrow"><span className="dot"></span>AI-Powered Hiring Platform</div>
      <h1 style={{ fontSize: '72px', maxWidth: '820px', margin: '0 auto 22px' }}>Hire on <span className="grad-text">Autopilot.</span></h1>
      <p className="sub" style={{ maxWidth: '600px' }}>Hybent Hiring uses AI to source, parse, screen, rank, and manage candidates—automating repetitive hiring tasks so your team can focus on finding and hiring exceptional talent faster.</p>
      <div className="hero-ctas">
        <a className="btn btn-primary">Start Free Trial</a>
        <a onClick={() => goTo("contact")} className={`btn btn-secondary ${ activePage === "contact" ? "active" : "" }`}>Book a Demo</a>
      </div>
      <div className="mockup-frame">
        <div className="mockup-chrome"><span></span><span></span><span></span></div>
        <div className="mockup-body">
          <div className="mockup-row">
            <div className="mockup-col">
              <h4>Sourced</h4>
              <div className="mockup-card"><div className="mockup-avatar"></div><div className="mockup-lines"><div className="mockup-line w60"></div><div className="mockup-line w40"></div></div><div className="match-ring"></div></div>
              <div className="mockup-card"><div className="mockup-avatar"></div><div className="mockup-lines"><div className="mockup-line w60"></div><div className="mockup-line w40"></div></div><div className="match-ring"></div></div>
            </div>
            <div className="mockup-col">
              <h4>Screened</h4>
              <div className="mockup-card"><div className="mockup-avatar"></div><div className="mockup-lines"><div className="mockup-line w60"></div><div className="mockup-line w40"></div></div><div className="match-ring"></div></div>
            </div>
            <div className="mockup-col">
              <h4>Interview</h4>
              <div className="mockup-card"><div className="mockup-avatar"></div><div className="mockup-lines"><div className="mockup-line w60"></div><div className="mockup-line w40"></div></div><div className="match-ring"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section className="about-hiring">
    <div className="about-hiring-glow"></div>
    <div className="wrap">
      <div className="about-hiring-grid">
        <div>
          <div className="eyebrow">About Hybent Hiring</div>
          <h2 style={{ fontSize: '38px', marginBottom: '22px' }}>Built for Recruiters.<br />Designed for Growing Teams.</h2>
          <div className="about-hiring-copy">
            <p className="lead">Behind every successful company is an exceptional team.</p>
            <p>Finding that talent has become increasingly challenging. Recruiters are expected to hire faster, deliver outstanding candidate experiences, collaborate across teams, and manage growing hiring demands — all while working with disconnected tools and time-consuming processes.</p>
            <p>We believed hiring deserved something better. That's why we created Hybent Hiring.</p>
            <p>Our mission is to transform recruitment through AI-powered automation, intelligent insights, and seamless collaboration — empowering hiring teams to spend less time managing workflows and more time connecting with the right talent.</p>
            <p>Every feature we build is designed around one purpose: helping organizations hire faster, make smarter decisions, and build stronger teams with confidence.</p>
          </div>
          <div className="mission-card">
            <h4>Our Mission</h4>
            <p>To help businesses hire exceptional talent faster through intelligent automation, AI-powered insights, and seamless collaboration.</p>
          </div>
          <div className="badge-row">
            <span className="badge-pill">⚡ AI-Powered Automation</span>
            <span className="badge-pill">🚀 Faster Hiring</span>
            <span className="badge-pill">🤝 Better Candidate Experience</span>
          </div>
        </div>
        <div className="about-hiring-visual">
          <div className="mockup-frame">
            <div className="mockup-chrome"><span></span><span></span><span></span></div>
            <div className="mockup-body">
              <div className="mockup-row">
                <div className="mockup-col">
                  <h4>Candidates</h4>
                  <div className="mockup-card"><div className="mockup-avatar"></div><div className="mockup-lines"><div className="mockup-line w60"></div><div className="mockup-line w40"></div></div><div className="match-ring"></div></div>
                  <div className="mockup-card"><div className="mockup-avatar"></div><div className="mockup-lines"><div className="mockup-line w60"></div><div className="mockup-line w40"></div></div><div className="match-ring"></div></div>
                </div>
                <div className="mockup-col">
                  <h4>Scorecards</h4>
                  <div className="mockup-card"><div className="mockup-avatar"></div><div className="mockup-lines"><div className="mockup-line w60"></div><div className="mockup-line w40"></div></div><div className="match-ring"></div></div>
                  <div className="mockup-card"><div className="mockup-avatar"></div><div className="mockup-lines"><div className="mockup-line w60"></div><div className="mockup-line w40"></div></div><div className="match-ring"></div></div>
                </div>
              </div>
            </div>
          </div>
          <div className="float-tag t1"><span className="dot-check">✓</span>AI Candidate Matching</div>
          <div className="float-tag t2"><span className="dot-check">✓</span>Resume Parsing</div>
          <div className="float-tag t3"><span className="dot-check">✓</span>Smart Hiring Workflow</div>
          <div className="float-tag t4"><span className="dot-check">✓</span>ATS Dashboard</div>
          <div className="float-tag t5"><span className="dot-check">✓</span>Interview Scheduling</div>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div className="wrap">
      <div className="section-head"><div className="eyebrow">Features</div><h2>Everything you need to hire with confidence.</h2></div>
      <div className="bento">
        <div className="card large" style={{ background: 'var(--mist)', border: 'none' }}>
          <div className="ring-big" style={{ background: 'conic-gradient(var(--violet) 0% 88%, rgba(20,18,26,0.08) 88% 100%)', margin: '0 0 16px' }}><div className="ring-big-inner" style={{ background: 'var(--mist)' }}><div className="n" style={{ color: 'var(--ink)' }}>94%</div><div className="l" style={{ color: 'var(--gray)' }}>MATCH</div></div></div>
          <h3>AI Candidate Matching</h3><p>Ranks every applicant by true role fit, not just keyword overlap.</p>
        </div>
        <div className="card"><div className="chip">⚡</div><h3>Automated Screening</h3><p>Filters resumes and applications instantly.</p></div>
        <div className="card"><div className="chip">◷</div><h3>Smart Scheduling</h3><p>Auto-coordinates interviews across calendars.</p></div>
        <div className="card"><div className="chip">◈</div><h3>Bias-Reduction Analytics</h3><p>Flags patterns to support fairer hiring.</p></div>
        <div className="card"><div className="chip">◎</div><h3>Team Collaboration</h3><p>Shared notes, scorecards, and feedback in one place.</p></div>
      </div>
    </div>
  </section>

  <section className="section-mist">
    <div className="wrap">
      <div className="section-head"><div className="eyebrow">How It Works</div><h2>From post to hire.</h2></div>
      <div className="step-flow">
        <div className="step"><div className="step-num">1</div><h4>Post Role</h4><p>Publish once, reach every channel.</p></div>
        <div className="step"><div className="step-num">2</div><h4>AI Sourcing</h4><p>Hybent Hiring finds and scores matches.</p></div>
        <div className="step"><div className="step-num">3</div><h4>Review Candidates</h4><p>Ranked list, ready to act on.</p></div>
        <div className="step"><div className="step-num">4</div><h4>Hire</h4><p>Move top candidates to offer.</p></div>
      </div>
    </div>
  </section>

  <section className="section-dark">
    <div className="wrap" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', flexWrap: 'wrap', gap: '40px' }}>
      <div><div className="mono" style={{ fontSize: '40px', color: 'white', fontWeight: '700' }}>70%</div><p style={{ color: '#B3ABC4', marginTop: '8px' }}>Faster Time-to-Hire</p></div>
      <div><div className="mono" style={{ fontSize: '40px', color: 'white', fontWeight: '700' }}>3x</div><p style={{ color: '#B3ABC4', marginTop: '8px' }}>More Qualified Candidates</p></div>
      <div><div className="mono" style={{ fontSize: '40px', color: 'white', fontWeight: '700' }}>40+</div><p style={{ color: '#B3ABC4', marginTop: '8px' }}>Hours Saved Monthly</p></div>
    </div>
  </section>

  <section><div className="wrap"><div className="cta-banner"><h2>Ready to transform your hiring?</h2><div className="cta-ctas"><a className="btn btn-primary">Start Free Trial</a><a onClick={() => goTo("contact")} className={`btn btn-secondary ${ activePage === "contact" ? "active" : "" }`}>Talk to Sales</a></div></div></div></section>
</div>

{/* ================= SERVICES ================= */}
<div className="page" id="page-services" style={{ display: activePage === "services" ? "block" : "none" }}>
  <section className="hero" style={{ paddingTop: '170px' }}>
    <div className="wrap">
      <div className="eyebrow">Professional IT Services</div>
      <h1 style={{ fontSize: '56px' }}>Technology expertise, delivered.</h1>
      <p className="sub">A dedicated technology partner for custom software, cloud infrastructure, and strategic consulting.</p>
    </div>
  </section>

  <section className="section-tight">
    <div className="wrap grid3">
      <div className="card"><div className="chip">⌥</div><h3>Custom Software Development</h3><p>Tailored applications built around your workflow.</p><p style={{ marginTop: '14px', fontSize: '13px', color: 'var(--gray-light)' }}>Web Apps · Mobile Apps · API Integrations</p><a className="link">Learn more</a></div>
      <div className="card"><div className="chip">☁</div><h3>Cloud &amp; Infrastructure</h3><p>Scalable systems, managed end-to-end.</p><p style={{ marginTop: '14px', fontSize: '13px', color: 'var(--gray-light)' }}>Migration · DevOps · Monitoring</p><a className="link">Learn more</a></div>
      <div className="card"><div className="chip">◇</div><h3>IT Consulting &amp; Strategy</h3><p>Technology roadmaps tied to business outcomes.</p><p style={{ marginTop: '14px', fontSize: '13px', color: 'var(--gray-light)' }}>Audits · Architecture · Roadmapping</p><a className="link">Learn more</a></div>
      <div className="card"><div className="chip">◈</div><h3>UI/UX &amp; Product Design</h3><p>Interfaces that feel as good as they function.</p><p style={{ marginTop: '14px', fontSize: '13px', color: 'var(--gray-light)' }}>Research · Design Systems · Prototyping</p><a className="link">Learn more</a></div>
      <div className="card"><div className="chip">✦</div><h3>AI &amp; Automation</h3><p>Intelligent workflows that save real time.</p><p style={{ marginTop: '14px', fontSize: '13px', color: 'var(--gray-light)' }}>LLM Integration · Workflow Automation</p><a className="link">Learn more</a></div>
      <div className="card"><div className="chip">◎</div><h3>Managed IT Support</h3><p>Ongoing support so nothing breaks unnoticed.</p><p style={{ marginTop: '14px', fontSize: '13px', color: 'var(--gray-light)' }}>Monitoring · Helpdesk · Security</p><a className="link">Learn more</a></div>
    </div>
  </section>

  <section className="section-mist">
    <div className="wrap">
      <div className="section-head"><div className="eyebrow">Our Process</div><h2>How we work.</h2></div>
      <div className="step-flow">
        <div className="step"><div className="step-num">1</div><h4>Discover</h4><p>Understand goals and constraints.</p></div>
        <div className="step"><div className="step-num">2</div><h4>Design</h4><p>Plan architecture and experience.</p></div>
        <div className="step"><div className="step-num">3</div><h4>Build</h4><p>Ship in focused, tested iterations.</p></div>
        <div className="step"><div className="step-num">4</div><h4>Support</h4><p>Stay on as your long-term partner.</p></div>
      </div>
    </div>
  </section>

  <section>
    <div className="wrap" style={{ textAlign: 'center' }}>
      <div className="section-head"><div className="eyebrow">Industries</div><h2>Who we work with.</h2></div>
      <div className="pill-row" style={{ justifyContent: 'center' }}>
        <div className="pill">Fintech</div><div className="pill">Healthcare</div><div className="pill">SaaS</div><div className="pill">Retail</div><div className="pill">Enterprise</div>
      </div>
    </div>
  </section>

  <section><div className="wrap"><div className="cta-banner"><h2>Have a project in mind?</h2><div className="cta-ctas"><a onClick={() => goTo("contact")} className={`btn btn-primary ${ activePage === "contact" ? "active" : "" }`}>Let's Talk</a></div></div></div></section>
</div>

{/* ================= CAREERS ================= */}
<div className="page" id="page-careers" style={{ display: activePage === "careers" ? "block" : "none" }}>
  <section className="hero" style={{ paddingTop: '170px' }}>
    <div className="wrap">
      <div className="eyebrow">Careers at Hybent</div>
      <h1 style={{ fontSize: '56px' }}>Build the future with us.</h1>
      <p className="sub">Join a team shaping software and AI-driven products for companies worldwide.</p>
    </div>
  </section>

  <section className="section-tight section-mist">
    <div className="wrap grid3">
      <div className="card"><div className="chip">✦</div><h3>Innovation</h3><p>Work on AI-native products from day one.</p></div>
      <div className="card"><div className="chip">◎</div><h3>Growth</h3><p>Learning budgets and real career paths.</p></div>
      <div className="card"><div className="chip">◈</div><h3>Flexibility</h3><p>Remote-friendly, outcome-focused culture.</p></div>
    </div>
  </section>

  <section>
    <div className="wrap">
      <div className="section-head"><div className="eyebrow">Perks &amp; Benefits</div><h2>Why work here.</h2></div>
      <div className="grid3">
        <div className="card"><div className="chip">🏠</div><h3>Remote-Friendly</h3><p>Work from where you do your best work.</p></div>
        <div className="card"><div className="chip">⚕</div><h3>Health Benefits</h3><p>Comprehensive coverage for you and your family.</p></div>
        <div className="card"><div className="chip">📚</div><h3>Learning Budget</h3><p>Annual stipend for courses and conferences.</p></div>
        <div className="card"><div className="chip">◷</div><h3>Flexible Hours</h3><p>Structure your day around your life.</p></div>
        <div className="card"><div className="chip">📈</div><h3>Equity &amp; Growth</h3><p>Real ownership in what you help build.</p></div>
        <div className="card"><div className="chip">✈</div><h3>Team Retreats</h3><p>In-person gatherings, twice a year.</p></div>
      </div>
    </div>
  </section>

  <section className="section-off">
    <div className="wrap">
      <div className="section-head left"><div className="eyebrow">Open Roles</div><h2>Open positions.</h2></div>
      <div className="filters">
        <div className="filter-pill active">All</div><div className="filter-pill">Engineering</div><div className="filter-pill">Design</div><div className="filter-pill">Sales</div>
      </div>
      <div className="pos-row"><div><h3>Senior Frontend Engineer</h3><span className="tag">Engineering</span><span className="tag">Remote</span></div><a className="btn btn-ghost">View Role</a></div>
      <div className="pos-row"><div><h3>Product Designer</h3><span className="tag">Design</span><span className="tag">Remote</span></div><a className="btn btn-ghost">View Role</a></div>
      <div className="pos-row"><div><h3>AI/ML Engineer</h3><span className="tag">Engineering</span><span className="tag">Hybrid</span></div><a className="btn btn-ghost">View Role</a></div>
      <div className="pos-row"><div><h3>Account Executive</h3><span className="tag">Sales</span><span className="tag">Remote</span></div><a className="btn btn-ghost">View Role</a></div>
    </div>
  </section>

  <section><div className="wrap"><div className="cta-banner"><h2>Don't see your role? We'd still love to hear from you.</h2><div className="cta-ctas"><a onClick={() => goTo("contact")} className={`btn btn-primary ${ activePage === "contact" ? "active" : "" }`}>Send Your Resume</a></div></div></div></section>
</div>

{/* ================= CONTACT ================= */}
<div className="page" id="page-contact" style={{ display: activePage === "contact" ? "block" : "none" }}>
  <section className="hero" style={{ paddingTop: '170px', paddingBottom: '60px' }}>
    <div className="wrap">
      <div className="eyebrow">Get in Touch</div>
      <h1 style={{ fontSize: '52px' }}>Let's start a conversation.</h1>
      <p className="sub">Tell us about your project, or ask us anything about Hybent Hiring.</p>
    </div>
  </section>

  <section className="section-tight">
    <div className="wrap contact-split">
      <div className="form-card">
        <div className="form-group"><label>Name</label><input type="text" placeholder="Your full name" /></div>
        <div className="form-group"><label>Email</label><input type="email" placeholder="you@company.com" /></div>
        <div className="form-group"><label>Company</label><input type="text" placeholder="Company name" /></div>
        <div className="form-group"><label>I'm interested in</label>
          <select><option>Hybent Hiring</option><option>IT Services</option><option>Partnership</option><option>Other</option></select>
        </div>
        <div className="form-group"><label>Message</label><textarea placeholder="Tell us a bit about what you need..."></textarea></div>
        <a className="btn btn-primary" style={{ width: '100%' }}>Send Message</a>
      </div>
      <div>
        <div className="info-item"><div className="chip">✉</div><div><h4>Email</h4><p>hello@hybent.com</p></div></div>
        <div className="info-item"><div className="chip">☎</div><div><h4>Phone</h4><p>+1 (555) 019‑2200</p></div></div>
        <div className="info-item"><div className="chip">📍</div><div><h4>Office</h4><p>500 Market Street, San Francisco, CA</p></div></div>
        <div className="map-illus"><div className="map-pin"></div></div>
      </div>
    </div>
  </section>

  <section className="section-mist">
    <div className="wrap grid3">
      <div className="card"><h3>Sales Inquiries</h3><p style={{ margin: '10px 0' }}>Talk to us about Hybent Hiring or a new project.</p><a className="link">sales@hybent.com</a></div>
      <div className="card"><h3>Support</h3><p style={{ margin: '10px 0' }}>Need help with an existing product?</p><a className="link">support@hybent.com</a></div>
      <div className="card"><h3>Partnerships</h3><p style={{ margin: '10px 0' }}>Explore working with us long-term.</p><a className="link">partners@hybent.com</a></div>
    </div>
  </section>
</div>

<footer>
  <div className="wrap">
    <div className="footer-grid">
      <div className="footer-brand">
        <div className="brand"><span className="mark">H</span>Hybent</div>
        <p>A technology company building innovative software products and delivering professional IT services.</p>
        <div className="social"><span>in</span><span>X</span><span>gh</span></div>
      </div>
      <div className="footer-col"><h4>Product</h4><a onClick={() => navigate("/hiring")}>Hybent Hiring</a><a onClick={() => goTo("products")} className={activePage === "products" ? "active" : ""}>All Products</a></div>
      <div className="footer-col"><h4>Company</h4><a onClick={() => goTo("about")} className={activePage === "about" ? "active" : ""}>About</a><a onClick={() => goTo("careers")} className={activePage === "careers" ? "active" : ""}>Careers</a><a onClick={() => goTo("contact")} className={activePage === "contact" ? "active" : ""}>Contact</a></div>
      <div className="footer-col"><h4>Resources</h4><a onClick={() => goTo("services")} className={activePage === "services" ? "active" : ""}>Services</a><a>Blog</a><a>Support</a></div>
    </div>
    <div className="footer-bottom"><span>© 2026 Hybent Inc. All rights reserved.</span><span>Privacy · Terms</span></div>
    <div className="footer-watermark">Hybent</div>
  </div>
</footer>



    </div>
  );
}
