import type React from 'react'

export default function ProductsPage() {
  return (
    <div className="route route--on" data-route="products">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Products</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">One product live today. An ecosystem being built underneath it.</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">We call a product live only when it can carry real work. Hybent Hiring is in production. Everything else on this page is marked coming soon, and stays that way until the day it ships.</p>
        </div>
      </section>

      <section className="section section--tight-pt-none" id="products">
        <div className="wrap">

          <div className="flagship" data-rv="scale">
            <div className="flagship__in">
              <div>
                <div className="flagship__logo flex-wrap">
                  <span className="fl-mark shrink-0">H</span>
                  <span><h3>Hybent Hiring</h3>
                    <p>AI recruitment platform</p>
                  </span>
                  <span className="badge badge--live" style={{ marginLeft: "6px" }}>
                    <i className="dot dot--pulse"></i>Live now
                  </span>
                </div>
                <p className="lead" style={{ fontSize: "1.02rem" }}>Hiring breaks in the handoffs — sourcing to screening, screening to interview, interview to offer. Hybent Hiring holds the whole pipeline in one place and puts AI on the work people do least consistently by hand: reading every résumé against the same standard, keeping scorecards comparable, and never leaving a candidate waiting on an answer.</p>
                <ul className="feat-list">
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span><b>Resume parsing &amp; talent database.</b> Every CV structured on arrival and searchable for the next role, not buried in an inbox.</span></li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span><b>AI screening.</b> Every applicant scored against the same rubric, with the evidence attached to the score.</span></li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span><b>Interview management.</b> Scheduling, structured scorecards and AI interview assistance that drafts notes as the conversation happens.</span></li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span><b>Recruiter copilot &amp; candidate portal.</b> Pipeline health and next actions for your team; automatic status updates for everyone who applied.</span></li>
                </ul>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <a className="btn btn-primary" href="/contact">Book a Hybent Hiring demo <svg className="arw" width="16" height="16" aria-hidden="true"><use href="#i-arrow" /></svg></a>
                  <a className="btn btn-ghost" href="/solutions">See how it works</a>
                </div>
              </div>

              <div className="mock" id="mock">
                <div className="mock__bar"><i></i><i></i><i></i><span>hybent hiring / pipeline / senior backend engineer</span></div>
                <div className="mock__body">
                  <div className="mock__row"><span className="mock__ava"></span><span className="mock__meta"><b>A. Raman</b><span>Screened · 4 competencies matched</span><span className="mock__meter" style={{ "--w": "94%" } as React.CSSProperties}><i></i></span></span><span className="score">94</span></div>
                  <div className="mock__row"><span className="mock__ava" style={{ background: "linear-gradient(140deg,#4C6FFF,#E85CFF)" }}></span><span className="mock__meta"><b>J. Okafor</b><span>Interview scheduled · Thu 14:00</span><span className="mock__meter" style={{ "--w": "88%" } as React.CSSProperties}><i></i></span></span><span className="score">88</span></div>
                  <div className="mock__row"><span className="mock__ava" style={{ background: "linear-gradient(140deg,#22CFFF,#4C6FFF)" }}></span><span className="mock__meta"><b>M. Alvarez</b><span>Screened · needs system design</span><span className="mock__meter" style={{ "--w": "71%" } as React.CSSProperties}><i></i></span></span><span className="score score--mid">71</span></div>
                  <div className="mock__row"><span className="mock__ava" style={{ background: "linear-gradient(140deg,#A855F7,#22CFFF)" }}></span><span className="mock__meta"><b>S. Beck</b><span>Offer drafted · awaiting approval</span><span className="mock__meter" style={{ "--w": "91%" } as React.CSSProperties}><i></i></span></span><span className="score">91</span></div>
                </div>
              </div>
            </div>
          </div>


          <div id="roadmap" style={{ marginTop: "clamp(52px,6vw,80px)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", flexWrap: "wrap", marginBottom: "30px" }} data-rv="up">
              <div>
                <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Roadmap</span></p>
                <h3 className="h-md">What we are building next</h3>
              </div>
              <p className="small" style={{ maxWidth: "38ch" }}>None of the products below has shipped. They are the direction of the ecosystem, not a delivery commitment — we will announce dates only when we can meet them.</p>
            </div>

            <div className="soon-grid">
              <article className="soon" data-rv="up"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-users" /></svg></span><h4>CRM</h4><p>Accounts, pipeline and revenue forecasting built on the same person record Hybent Hiring already keeps.</p><p className="ph">Coming soon</p></article>
              <article className="soon" data-rv="up" data-delay="50"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-brief" /></svg></span><h4>HRMS</h4><p>Onboarding, records, leave and reviews — continuing the employee story where Hybent Hiring leaves off.</p><p className="ph">Coming soon</p></article>
              <article className="soon" data-rv="up" data-delay="100"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-build" /></svg></span><h4>ERP</h4><p>Inventory, procurement and order management for operations teams that have outgrown spreadsheets.</p><p className="ph">Coming soon</p></article>
              <article className="soon" data-rv="up" data-delay="150"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-cal" /></svg></span><h4>Project Management</h4><p>Plans, capacity and delivery tracking wired to the people and budgets they actually depend on.</p><p className="ph">Coming soon</p></article>
              <article className="soon" data-rv="up" data-delay="200"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-head" /></svg></span><h4>Helpdesk</h4><p>Ticketing that already knows the customer, because the record is shared rather than synced.</p><p className="ph">Coming soon</p></article>
              <article className="soon" data-rv="up" data-delay="250"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-wallet" /></svg></span><h4>Finance</h4><p>Invoicing, expenses and reconciliation that close the loop on work already tracked elsewhere.</p><p className="ph">Coming soon</p></article>
              <article className="soon" data-rv="up" data-delay="300"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-chart" /></svg></span><h4>Analytics</h4><p>Metrics across every product without a warehouse project. Ask in plain language, get the answer.</p><p className="ph">Coming soon</p></article>
              <article className="soon" data-rv="up" data-delay="350"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-bot" /></svg></span><h4>AI Assistant</h4><p>One assistant with permissioned reach across every HYBENT product you have switched on.</p><p className="ph">Coming soon</p></article>
              <article className="soon" data-rv="up" data-delay="400"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-mega" /></svg></span><h4>Marketing Automation</h4><p>Campaigns, journeys and attribution reading from live customer data instead of an export.</p><p className="ph">Coming soon</p></article>
              <article className="soon" data-rv="up" data-delay="450"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-heart" /></svg></span><h4>Customer Support</h4><p>Self-serve portal, knowledge base and satisfaction tracking tied to account health.</p><p className="ph">Coming soon</p></article>
              <article className="soon" data-rv="up" data-delay="500"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-layers" /></svg></span><h4>Collaboration</h4><p>Threads, documents and decisions attached to the record they are actually about.</p><p className="ph">Coming soon</p></article>
              <article className="soon" data-rv="up" data-delay="550"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-doc" /></svg></span><h4>Document Management</h4><p>Versioned storage, e-signature and retention policy shared across every product.</p><p className="ph">Coming soon</p></article>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
