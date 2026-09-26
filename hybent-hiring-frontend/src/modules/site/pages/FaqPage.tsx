import { SiteView } from '../components/SiteView'

/**
 * FAQ — the questions buyers put to us before anything else.
 *
 * Moved out of the retired Resources view and given its own page under Company,
 * where the rest of the "who we are and how we operate" material lives.
 */
export default function FaqPage() {
  return (
    <SiteView route="faq">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>FAQ</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">The questions we get asked first</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">Straight answers on what is live today, how pricing works, and what happens to your data.</p>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="wrap" style={{ maxWidth: "900px" }}>
          <div className="faq" data-rv="up">
            <details open><summary>What is Hybent Hiring?<span className="pm"></span></summary><div className="ans">Hybent Hiring is our flagship AI recruitment platform. It holds your entire pipeline in one place — resume parsing, AI screening, interview management, recruiter copilot, and candidate portal.</div></details>
            <details><summary>Is Hybent Hiring live and available today?<span className="pm"></span></summary><div className="ans">Yes, Hybent Hiring is fully live and in production today. You can start managing your recruitment pipeline immediately.</div></details>
            <details><summary>How is Hybent Hiring priced?<span className="pm"></span></summary><div className="ans">Every plan includes 1 admin and 2 recruiter seats. The standard plan is $69 per month; a 6-month term saves 5% ($66/month) and a 12-month term saves 10% ($62/month). Additional seats and custom plans are available through our team. See <a href="/pricing">pricing</a> for details.</div></details>
            <details><summary>Do you train AI models on our data?<span className="pm"></span></summary><div className="ans">No. Your candidate data is never used to train models shared with any other customer. Tuning specific to your account is opt-in, documented and reversible, and every AI feature explains the inputs behind what it produces.</div></details>
            <details><summary>Where is our data stored?<span className="pm"></span></summary><div className="ans">We will tell you exactly where your data sits and who processes it, and we publish our sub-processor list. Additional regions are added as we expand — if you have a specific residency requirement, ask us and we will give you a straight answer about whether we can meet it yet.</div></details>
            <details><summary>How do we get our data out if we leave?<span className="pm"></span></summary><div className="ans">Export in open formats from the admin console at any time, including attachments and decision history. No ticket, no fee, no notice period. We would rather you stay because leaving is easy and you chose not to.</div></details>
          </div>

          <div className="section-head center" style={{ marginTop: "48px" }} data-rv="up">
            <p className="small">Still have a question? <a className="link-arrow" href="/contact">Talk to us <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a></p>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
