import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react'

const schema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  organization_name: z.string().min(2, 'Organization name must be at least 2 characters'),
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'

  const [serverError, setServerError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ 
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      email: '',
      organization_name: '',
    }
  })

  const onSubmit = async (values: FormData) => {
    setServerError('')
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || ''
      const response = await fetch(`${apiBase}/api/public/demo-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: values.full_name.split(' ')[0] || values.full_name,
          last_name: values.full_name.split(' ').slice(1).join(' ') || 'User',
          work_email: values.email,
          company_name: values.organization_name,
          team_size: 'Lead from Register',
          monthly_hires: 'Lead from Register',
          hiring_challenge: isDemo ? 'Book a Demo Request' : 'Get Started Free Request'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setServerError(data.message || 'Something went wrong.');
      }
    } catch (err: unknown) {
      setServerError('Submission failed. Please try again.')
    }
  }

  const CSS = `
    .register-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      font-family: 'Poppins', sans-serif;
      background: #fff;
    }
    :root[data-theme="dark"] .register-container {
      background: var(--color-bg-page, #16132a);
    }
    .aurora { position: fixed; inset: 0; background: linear-gradient(135deg, #f0eeff 0%, #ffe8f8 35%, #e8f0ff 65%, #f0fff8 100%); z-index: 0; }
    :root[data-theme="dark"] .aurora {
      background: linear-gradient(135deg, #16132a 0%, #0a0818 100%);
    }
    .aura { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; will-change: transform; }
    .a1 { width: 700px; height: 700px; background: radial-gradient(circle, rgba(108,71,255,.28), transparent 70%); top: -250px; right: -150px; animation: drift1 16s ease-in-out infinite alternate; }
    .a2 { width: 600px; height: 600px; background: radial-gradient(circle, rgba(255,107,198,.22), transparent 70%); bottom: -200px; left: -150px; animation: drift2 20s ease-in-out infinite alternate; }
    .a3 { width: 350px; height: 350px; background: radial-gradient(circle, rgba(0,212,200,.18), transparent 70%); top: 40%; left: 35%; animation: drift3 12s ease-in-out infinite alternate; }
    .a4 { width: 250px; height: 250px; background: radial-gradient(circle, rgba(251,191,36,.14), transparent 70%); bottom: 20%; right: 25%; animation: drift1 9s ease-in-out infinite alternate; }
    @keyframes drift1 { from { transform: translate(0, 0); } to { transform: translate(40px, -50px); } }
    @keyframes drift2 { from { transform: translate(0, 0); } to { transform: translate(-30px, 40px); } }
    @keyframes drift3 { from { transform: translate(0, 0); } to { transform: translate(50px, -30px); } }
    .float-card { position: absolute; background: rgba(255,255,255,.55); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,.8); border-radius: 16px; padding: 14px 18px; box-shadow: 0 8px 32px rgba(108,71,255,.12); font-size: 12px; font-weight: 600; color: #5a4e7a; display: flex; align-items: center; gap: 9px; animation: floatAnim 6s ease-in-out infinite alternate; z-index: 1; }
    :root[data-theme="dark"] .float-card {
      background: var(--color-bg-card, #1f1b36);
      border-color: var(--color-border, #2e2855);
      color: var(--text-mid, #6b6393);
    }
    .fc1 { top: 12%; left: 6%; animation-delay: 0s; }
    .fc2 { top: 18%; right: 8%; animation-delay: 1.5s; }
    .fc3 { bottom: 18%; left: 7%; animation-delay: 2.5s; }
    .fc4 { bottom: 12%; right: 6%; animation-delay: 0.8s; }
    @keyframes floatAnim { from { transform: translateY(0); } to { transform: translateY(-12px); } }
    .fc-dot { width: 8px; height: 8px; border-radius: 50%; }
    .glass-card { position: relative; z-index: 2; width: 440px; background: rgba(255,255,255,.65); border: 1px solid rgba(255,255,255,.9); border-radius: 28px; padding: 46px 42px; backdrop-filter: blur(40px); box-shadow: 0 24px 80px rgba(108,71,255,.16), 0 2px 0 rgba(255,255,255,.9) inset; animation: cardIn .7s cubic-bezier(.16,1,.3,1) both; }
    :root[data-theme="dark"] .glass-card {
      background: rgba(31, 27, 54, 0.7);
      border-color: rgba(46, 40, 85, 0.8);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
    }
    @keyframes cardIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    .logo-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; justify-content: center; }
    .form-h1 { font-family: 'Poppins', sans-serif; font-size: 26px; font-weight: 800; color: #1a1040; text-align: center; margin-bottom: 5px; letter-spacing: -.4px; }
    :root[data-theme="dark"] .form-h1 { color: var(--color-text-main, #ede9ff); }
    .form-h2 { font-size: 13px; color: #9689bb; text-align: center; margin-bottom: 30px; line-height: 1.5; }
    :root[data-theme="dark"] .form-h2 { color: var(--text-mid, #6b6393); }
    .field-box { margin-bottom: 16px; position: relative; }
    .field-label { display: block; font-size: 11px; font-weight: 700; color: #5a4e7a; letter-spacing: .7px; text-transform: uppercase; margin-bottom: 7px; text-align: left; }
    :root[data-theme="dark"] .field-label { color: var(--text-mid, #6b6393); }
    .input-ctrl { width: 100%; padding: 12px 16px; background: rgba(255,255,255,.8); border: 1.5px solid rgba(108,71,255,.14); border-radius: 12px; color: #1a1040; font-family: 'Poppins', sans-serif; font-size: 13px; outline: none; transition: all .2s; backdrop-filter: blur(8px); box-sizing: border-box; }
    :root[data-theme="dark"] .input-ctrl { background: rgba(31, 27, 54, 0.4); border-color: var(--color-border, #2e2855); color: var(--color-text-main, #ede9ff); }
    .input-ctrl:focus { border-color: #6c47ff; background: rgba(255,255,255,.95); box-shadow: 0 0 0 3px rgba(108,71,255,.1); }
    :root[data-theme="dark"] .input-ctrl:focus { border-color: var(--color-text-link, #a78bfa); }
    .input-ctrl::placeholder { color: #c4b9de; }
    .error-txt { margin-top: 4px; font-size: 11px; color: #ef4444; text-align: left; }
    .btn-submit { width: 100%; padding: 13px; border-radius: 13px; background: linear-gradient(135deg, var(--violet, #6c47ff), var(--brand2, #9b6bff)); color: #fff; font-family: 'Poppins', sans-serif; font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: all .25s; box-shadow: 0 8px 24px rgba(108,71,255,.38), 0 1px 0 rgba(255,255,255,.2) inset; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-submit:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(108,71,255,.5); }
    .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
    .foot-note { text-align: center; margin-top: 20px; font-size: 12px; color: #9689bb; }
    :root[data-theme="dark"] .foot-note { color: var(--text-mid, #6b6393); }
    .foot-note a { color: #6c47ff; font-weight: 700; text-decoration: none; }
    :root[data-theme="dark"] .foot-note a { color: var(--color-text-link, #a78bfa); }
    .server-err { margin-bottom: 20px; padding: 12px; border-radius: 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; font-size: 13px; text-align: left; }
    .sent-icon { width: 64px; height: 64px; border-radius: 20px; background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(16,185,129,.06)); border: 1px solid rgba(16,185,129,.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    @media (max-width: 640px) { .glass-card { width: 90%; padding: 32px 24px; } .float-card { display: none; } }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `;

  return (
    <div className="register-container">
      <style>{CSS}</style>

      <div className="aurora">
        <div className="aura a1" />
        <div className="aura a2" />
        <div className="aura a3" />
        <div className="aura a4" />
      </div>

      {isDemo ? (
        <>
          <div className="float-card fc1"><div className="fc-dot" style={{ background: '#10b981' }} /> ⚡ Live product tour</div>
          <div className="float-card fc2"><div className="fc-dot" style={{ background: '#6c47ff' }} /> 💼 Enterprise features</div>
          <div className="float-card fc3"><div className="fc-dot" style={{ background: '#ff6bc6' }} /> 🤖 AI agents demo</div>
          <div className="float-card fc4"><div className="fc-dot" style={{ background: '#00d4c8' }} /> 📊 Custom workflow</div>
        </>
      ) : (
        <>
          <div className="float-card fc1"><div className="fc-dot" style={{ background: '#10b981' }} /> 🚀 Free 14-day trial</div>
          <div className="float-card fc2"><div className="fc-dot" style={{ background: '#6c47ff' }} /> ✨ No credit card</div>
          <div className="float-card fc3"><div className="fc-dot" style={{ background: '#ff6bc6' }} /> 🎯 Set up in 2 mins</div>
          <div className="float-card fc4"><div className="fc-dot" style={{ background: '#00d4c8' }} /> 💼 Hire top 1% talent</div>
        </>
      )}

      <div className="glass-card">
        <div className="logo-wrap">
          <div className="logo-orbit">
            <div className="logo-orbit-ring"></div>
            <div className="logo-box">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95"/>
                <rect x="16" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95"/>
                <rect x="2" y="9" width="18" height="4" rx="2" fill="white" opacity="0.95"/>
              </svg>
            </div>
          </div>
          <span className="logo-wordmark lwl" style={{ fontSize: '22px' }}>Hybent Hiring</span>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <div className="sent-icon">
              <CheckCircle2 size={28} style={{ color: '#10b981' }} />
            </div>
            <h1 className="form-h1" style={{ marginBottom: 10 }}>
              {isDemo ? 'Demo Requested!' : 'Request Received!'}
            </h1>
            <p className="form-h2">
              {isDemo 
                ? "Thank you for scheduling a demo. Our team will reach out to you within 24 hours to set up your session."
                : "Thank you for your interest in Hybent Hiring. Our team will reach out to you shortly to get your workspace ready."}
            </p>
            <button 
              className="btn-submit" 
              type="button" 
              onClick={() => navigate('/')}
              style={{ marginTop: 24 }}
            >
              Return Home
            </button>
          </div>
        ) : (
          <>
            <h1 className="form-h1">
              {isDemo ? 'Book a Demo' : 'Get early access.'}
            </h1>
            <p className="form-h2">
              {isDemo 
                ? 'Experience the power of Hybent Hiring AI. Schedule a personalized walkthrough with our team.'
                : "Fill in your details and we'll get back to you within 24 hours to set up your account."}
            </p>

            {serverError && (
              <div className="server-err">
                <AlertTriangle size={14} className="inline mr-2" />
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="field-box">
                <label className="field-label">Full Name</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  className="input-ctrl"
                  {...register('full_name')}
                  disabled={isSubmitting}
                  style={{ 
                    border: errors.full_name ? '1.5px solid #ef4444' : '',
                    opacity: isSubmitting ? 0.7 : 1,
                    cursor: isSubmitting ? 'not-allowed' : 'text'
                  }}
                />
                {errors.full_name && <div className="error-txt">{errors.full_name.message}</div>}
              </div>

              <div className="field-box">
                <label className="field-label">Work Email</label>
                <input
                  type="email"
                  placeholder="jane@company.com"
                  className="input-ctrl"
                  {...register('email')}
                  disabled={isSubmitting}
                  style={{ 
                    border: errors.email ? '1.5px solid #ef4444' : '',
                    opacity: isSubmitting ? 0.7 : 1,
                    cursor: isSubmitting ? 'not-allowed' : 'text'
                  }}
                />
                {errors.email && <div className="error-txt">{errors.email.message}</div>}
              </div>

              <div className="field-box">
                <label className="field-label">Organization Name</label>
                <input
                  type="text"
                  placeholder="Acme Corp"
                  className="input-ctrl"
                  {...register('organization_name')}
                  disabled={isSubmitting}
                  style={{ 
                    border: errors.organization_name ? '1.5px solid #ef4444' : '',
                    opacity: isSubmitting ? 0.7 : 1,
                    cursor: isSubmitting ? 'not-allowed' : 'text'
                  }}
                />
                {errors.organization_name && <div className="error-txt">{errors.organization_name.message}</div>}
              </div>

              <div style={{ height: 8 }} />

              <button className="btn-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin" style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Sending...
                  </>
                ) : <>{isDemo ? 'Book Demo' : 'Create Account'} <ArrowRight size={16} className="ml-1 inline" /></>}
              </button>
            </form>

            <div className="foot-note" style={{ pointerEvents: isSubmitting ? 'none' : 'auto', opacity: isSubmitting ? 0.6 : 1 }}>
              Already have an account? <Link to="/login">Sign In <ArrowRight size={14} className="ml-1 inline" /></Link>
            </div>

            <p className="foot-note" style={{ fontSize: '11px', marginTop: '24px', opacity: 0.8, pointerEvents: isSubmitting ? 'none' : 'auto' }}>
              By clicking {isDemo ? 'Book Demo' : 'Create Account'}, you agree to our <a href="#" target="_blank" rel="noreferrer">Terms of Service</a>.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
