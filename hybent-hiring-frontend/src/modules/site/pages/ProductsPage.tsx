import type React from 'react'
import { SiteView } from '../components/SiteView'

export default function ProductsPage() {
  return (
    <SiteView route="products">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Product</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">Hybent Hiring. AI-Powered Recruitment Platform.</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">Our AI-powered recruitment platform holds your entire pipeline in one place — resume parsing, AI screening, interview management, recruiter copilot, and candidate portal.</p>
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
                    <i className="dot dot--pulse"></i>Live
                  </span>
                </div>
                <p className="lead" style={{ fontSize: "1.02rem" }}>Hiring breaks in the handoffs — sourcing to screening, screening to interview, interview to offer. Hybent Hiring holds the whole pipeline in one place and puts AI on the work people do least consistently by hand: reading every resume against the same standard, keeping scorecards comparable, and never leaving a candidate waiting on an answer.</p>
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
        </div>
      </section>
    </SiteView>
  )
}
