import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  ArrowRight, 
  ClipboardList, 
  Video, 
  User, 
  FileText, 
  Sparkles, 
  Mic, 
  BarChart3, 
  X, 
  ExternalLink, 
  Link as LinkIcon, 
  Inbox, 
  AlertTriangle, 
  ArrowLeft,
  Eye,
  EyeOff 
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { authApi } from '@/api/auth'
import { workspaceForRole } from '@/app/paths'
import { useAuthStore } from '@/store/authStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  useDocumentTitle('Sign in — Hybent Hiring | HYBENT', 'Sign in to Hybent Hiring, the AI recruitment platform from HYBENT.')

  const navigate = useNavigate()
  const location = useLocation()
  /* RequireAuth records the page the visitor was heading for, so signing in
     resumes the journey instead of dropping everyone on their dashboard. */
  const intended = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
  const { setTokens, isAuthenticated, user } = useAuthStore()
  const [serverError, setServerError] = useState('')
  const [activeTab, setActiveTab] = useState<'pass' | 'magic'>('pass')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [view, setView] = useState<'login' | 'forgot' | 'forgot_sent' | 'magic_sent'>('login')
  const [fpEmail, setFpEmail] = useState('')
  const [fpLoading, setFpLoading] = useState(false)
  const [fpError, setFpError] = useState('')
  const [logoutBanner, setLogoutBanner] = useState<'account_deleted' | 'session_expired' | null>(null)

  useEffect(() => {
    // Show logout reason banner if redirected from a forced logout
    const reason = sessionStorage.getItem('logout_reason')
    if (reason === 'account_deleted' || reason === 'session_expired') {
      setLogoutBanner(reason)
      sessionStorage.removeItem('logout_reason')
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(intended || workspaceForRole(user.role), { replace: true })
    }
  }, [isAuthenticated, user, intended, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormData) => {
    setServerError('')
    try {
      const { data } = await authApi.login(values.email, values.password)
      // Login response already includes the full user object — no extra /me round-trip needed.
      const user = data.user
      setTokens(data.access_token, data.refresh_token, user, rememberMe)

      navigate(intended || workspaceForRole(user?.role), { replace: true })
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Invalid email or password. Please try again.'
      setServerError(msg)
    }
  }

  const onForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFpError('')
    if (!fpEmail || !/\S+@\S+\.\S+/.test(fpEmail)) {
      setFpError('Enter a valid email address')
      return
    }
    setFpLoading(true)
    try {
      await authApi.forgotPassword(fpEmail)
      setView('forgot_sent')
    } catch {
      setFpError('Something went wrong. Please try again.')
    } finally {
      setFpLoading(false)
    }
  }

  const CSS = `
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      font-family: 'Poppins', sans-serif;
      background: #fff;
    }
    :root[data-theme="dark"] .login-container {
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
    .logo-mark { width: 40px; height: 40px; background: linear-gradient(135deg, #6c47ff, #ff6bc6); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(108,71,255,.35); }
    .logo-text { font-family: 'Poppins', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -.5px; background: linear-gradient(135deg, #6c47ff, #ff6bc6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .form-h1 { font-family: 'Poppins', sans-serif; font-size: 26px; font-weight: 800; color: #1a1040; text-align: center; margin-bottom: 5px; letter-spacing: -.4px; }
    :root[data-theme="dark"] .form-h1 { color: var(--color-text-main, #ede9ff); }
    .form-h2 { font-size: 13px; color: #9689bb; text-align: center; margin-bottom: 30px; }
    :root[data-theme="dark"] .form-h2 { color: var(--text-mid, #6b6393); }
    .tabs-list { display: flex; background: rgba(108,71,255,.07); border-radius: 12px; padding: 4px; margin-bottom: 24px; }
    .tab-btn { flex: 1; padding: 9px; text-align: center; font-size: 13px; font-weight: 600; color: #9689bb; border-radius: 9px; cursor: pointer; transition: all .22s; border: none; background: transparent; }
    .tab-btn.active { background: #fff; color: #6c47ff; box-shadow: 0 2px 8px rgba(108,71,255,.15); }
    .field-box { margin-bottom: 14px; position: relative; }
    .field-label { display: block; font-size: 11px; font-weight: 700; color: #5a4e7a; letter-spacing: .7px; text-transform: uppercase; margin-bottom: 7px; text-align: left; }
    :root[data-theme="dark"] .field-label { color: var(--text-mid, #6b6393); }
    .input-ctrl { width: 100%; padding: 12px 16px; background: rgba(255,255,255,.8); border: 1.5px solid rgba(108,71,255,.14); border-radius: 12px; color: #1a1040; font-family: 'Poppins', sans-serif; font-size: 13px; outline: none; transition: all .2s; backdrop-filter: blur(8px); box-sizing: border-box; }
    :root[data-theme="dark"] .input-ctrl { background: rgba(31, 27, 54, 0.4); border-color: var(--color-border, #2e2855); color: var(--color-text-main, #ede9ff); }
    .input-ctrl:focus { border-color: #6c47ff; background: rgba(255,255,255,.95); box-shadow: 0 0 0 3px rgba(108,71,255,.1); }
    :root[data-theme="dark"] .input-ctrl:focus { border-color: var(--color-text-link, #a78bfa); }
    .input-ctrl::placeholder { color: #c4b9de; }
    .input-ctrl.with-toggle { padding-right: 44px; }
    .input-wrap { position: relative; }
    .eye-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #9689bb; padding: 4px; display: flex; align-items: center; justify-content: center; transition: color .2s; }
    .eye-btn:hover { color: #6c47ff; }
    .error-txt { margin-top: 4px; font-size: 11px; color: #ef4444; text-align: left; }
    .row-utils { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; font-size: 12px; }
    .remember-chk { display: flex; align-items: center; gap: 7px; color: #9689bb; cursor: pointer; }
    :root[data-theme="dark"] .remember-chk { color: var(--text-mid, #6b6393); }
    .forgot-link { color: #6c47ff; font-weight: 600; text-decoration: none; background: none; border: none; cursor: pointer; font-family: 'Poppins', sans-serif; font-size: 12px; padding: 0; }
    :root[data-theme="dark"] .forgot-link { color: var(--color-text-link, #a78bfa); }
    .forgot-link:hover { text-decoration: underline; }
    .btn-submit { width: 100%; padding: 13px; border-radius: 13px; background: linear-gradient(135deg, var(--violet, #6c47ff), var(--brand2, #9b6bff)); color: #fff; font-family: 'Poppins', sans-serif; font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: all .25s; box-shadow: 0 8px 24px rgba(108,71,255,.38), 0 1px 0 rgba(255,255,255,.2) inset; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-submit:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(108,71,255,.5); }
    .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
    .btn-back { background: none; border: none; cursor: pointer; color: #9689bb; font-size: 12px; font-weight: 600; font-family: 'Poppins', sans-serif; display: flex; align-items: center; gap: 5px; padding: 0; margin-bottom: 20px; transition: color .2s; }
    :root[data-theme="dark"] .btn-back { color: var(--text-mid, #6b6393); }
    .btn-back:hover { color: #6c47ff; }
    :root[data-theme="dark"] .btn-back:hover { color: var(--color-text-link, #a78bfa); }
    .or-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; font-size: 11px; color: #c4b9de; font-weight: 600; }
    .or-divider::before, .or-divider::after { content: ''; flex: 1; height: 1px; background: rgba(108,71,255,.1); }
    .socials-grid { display: flex; gap: 10px; }
    .social-btn { flex: 1; padding: 11px; border-radius: 12px; border: 1.5px solid rgba(108,71,255,.15); background: rgba(255,255,255,.7); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; font-weight: 600; color: #5a4e7a; transition: all .2s; backdrop-filter: blur(8px); }
    .social-btn:hover { border-color: rgba(108,71,255,.4); background: rgba(255,255,255,.9); transform: translateY(-1px); }
    .foot-note { text-align: center; margin-top: 20px; font-size: 12px; color: #9689bb; }
    :root[data-theme="dark"] .foot-note { color: var(--text-mid, #6b6393); }
    .foot-note a { color: #6c47ff; font-weight: 700; text-decoration: none; }
    :root[data-theme="dark"] .foot-note a { color: var(--color-text-link, #a78bfa); }
    .server-err { margin-bottom: 20px; padding: 12px; border-radius: 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; font-size: 13px; text-align: left; }
    .sent-icon { width: 64px; height: 64px; border-radius: 20px; background: linear-gradient(135deg, rgba(108,71,255,.12), rgba(108,71,255,.06)); border: 1px solid rgba(108,71,255,.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    @media (max-width: 640px) { .glass-card { width: 90%; padding: 32px 24px; } .float-card { display: none; } }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `

  return (
    <div className="login-container">
      <style>{CSS}</style>

      <div className="aurora">
        <div className="aura a1" />
        <div className="aura a2" />
        <div className="aura a3" />
        <div className="aura a4" />
      </div>

      <div className="float-card fc1"><div className="fc-dot" style={{ background: '#10b981' }} /> 24 shortlisted today</div>
      <div className="float-card fc2"><div className="fc-dot" style={{ background: '#6c47ff' }} /> AI scoring live</div>
      <div className="float-card fc3"><div className="fc-dot" style={{ background: '#ff6bc6' }} /> 3 interviews scheduled</div>
      <div className="float-card fc4"><div className="fc-dot" style={{ background: '#00d4c8' }} /> 97% match accuracy</div>

      <div className="glass-card">
        <Link to="/" className="logo-wrap" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="logo-orbit">
            <div className="logo-orbit-ring"></div>
            <div className="logo-box" style={{ background: 'none', boxShadow: 'none' }}>
              <img src="/hybent_logo.webp" alt="Hybent Logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
            </div>
          </div>
          <img src="/hybent_wordmark_dark.webp" alt="HYBENT" className="wordmark-image wordmark-dark" style={{ height: '22px' }} />
          <img src="/hybent_wordmark_light.webp" alt="HYBENT" className="wordmark-image wordmark-light" style={{ height: '22px' }} />
        </Link>

        {view === 'forgot_sent' || view === 'magic_sent' ? (
          <div style={{ textAlign: 'center' }}>
            <div className="sent-icon">
              <Inbox size={28} className="text-[#6c47ff]" />
            </div>
            <h1 className="form-h1" style={{ marginBottom: 10 }}>Check your inbox</h1>
            <p className="form-h2" style={{ marginBottom: 32 }}>
              We sent a reset link to <strong style={{ color: '#1a1040' }}>{fpEmail}</strong>.<br />Link expires in 30 minutes.
            </p>
            <button className="btn-submit" type="button" onClick={() => { setView('login'); setFpEmail(''); }}>
              Back to Sign In
            </button>
          </div>
        ) : view === 'forgot' ? (
          <div>
            <button className="btn-back" onClick={() => { setView('login'); setFpError('') }}>
              <ArrowLeft size={16} />
              Back to Sign In
            </button>
            <h1 className="form-h1">Forgot password?</h1>
            <p className="form-h2" style={{ marginBottom: 28 }}>Enter your email and we'll send a reset link.</p>
            {fpError && <div className="server-err"><AlertTriangle size={14} className="inline mr-2" />{fpError}</div>}
            <form onSubmit={onForgotSubmit}>
              <div className="field-box">
                <label className="field-label">Email</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="input-ctrl"
                  value={fpEmail}
                  onChange={e => setFpEmail(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ height: 8 }} />
              <button className="btn-submit" type="submit" disabled={fpLoading}>
                {fpLoading ? (
                  <>
                    <svg className="animate-spin" style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Sending...
                  </>
                ) : <>Send Reset Link <ArrowRight size={16} className="ml-1 inline" /></>}
              </button>
            </form>
          </div>
        ) : (
          <>
            <h1 className="form-h1">Good to see you</h1>
            <p className="form-h2">Sign in to your hiring dashboard</p>

            {logoutBanner === 'account_deleted' && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.3)',
                borderRadius: 12, padding: '12px 14px', marginBottom: 16,
                color: '#dc2626', fontSize: 13, fontWeight: 500, lineHeight: 1.5
              }}>
                <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>
                  <strong>Your account has been removed.</strong><br />
                  You have been logged out because your account was deleted by an administrator.
                  Please contact your admin if this was a mistake.
                </span>
              </div>
            )}

            {logoutBanner === 'session_expired' && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.3)',
                borderRadius: 12, padding: '12px 14px', marginBottom: 16,
                color: '#b45309', fontSize: 13, fontWeight: 500, lineHeight: 1.5
              }}>
                <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                <span><strong>Session expired.</strong> Please sign in again.</span>
              </div>
            )}

            {serverError && <div className="server-err"><AlertTriangle size={14} className="inline mr-2" />{serverError}</div>}

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="field-box">
                <label className="field-label">Email</label>
                <input
                  type="email"
                  placeholder="you@company.com"
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
                <label className="field-label">Password</label>
                <div className="input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••"
                    className="input-ctrl with-toggle"
                    {...register('password')}
                    disabled={isSubmitting}
                    style={{ 
                      border: errors.password ? '1.5px solid #ef4444' : '',
                      opacity: isSubmitting ? 0.7 : 1,
                      cursor: isSubmitting ? 'not-allowed' : 'text'
                    }}
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowPassword(p => !p)} tabIndex={-1} disabled={isSubmitting}>
                    {showPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
                {errors.password && <div className="error-txt">{errors.password.message}</div>}
              </div>
              <div className="row-utils">
                <label className="remember-chk" style={{ opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: '#6c47ff' }}
                    disabled={isSubmitting}
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  /> Remember me
                </label>
                <button type="button" className="forgot-link" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }} onClick={() => { setView('forgot'); setServerError(''); setFpError('') }}>
                  Forgot password?
                </button>
              </div>
              <button className="btn-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin" style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing In...
                  </>
                ) : <>Sign In <ArrowRight size={16} className="ml-1 inline" /></>}
              </button>
            </form>

            
          </>
        )}
      </div>
    </div>
  )
}
