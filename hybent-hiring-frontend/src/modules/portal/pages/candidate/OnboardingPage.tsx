import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { AlertTriangle, Loader2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuthStore } from '@/store/authStore'
import { invitationsApi } from '@/api/invitations'
import { Button, Card, Input } from '@/components/hb'

/**
 * The invitation landing page: verify the token, set a password, drop the
 * candidate straight into the portal.
 *
 * Rebuilt on the design system in phase 7. The old page injected a `<style>`
 * block per render for the logo orbit (with the gradient hexes inline) and
 * carried `dark:` classes pointing at the removed dark theme. This page
 * renders outside the app shell, so it wraps itself in `.hb-app` to pick up
 * the token background and ambient wash.
 */

/** Full-viewport centring for the pre-portal states. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hb-app flex min-h-screen items-center justify-center p-4">{children}</div>
  )
}

export default function OnboardingPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    invitationsApi
      .verify(token)
      .then((res: any) => {
        setInvitation(res.data)
        setLoading(false)
      })
      .catch((err: any) => {
        setError(err.response?.data?.detail || 'Invalid or expired invitation link')
        setLoading(false)
      })
  }, [token])

  const { isAuthenticated, user, logout, setTokens } = useAuthStore()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleApply = async () => {
    if (!token) return
    if (!password) return toast.error('Please set a password')
    if (password !== confirmPassword) return toast.error('Passwords do not match')
    if (password.length < 6) return toast.error('Password must be at least 6 characters')

    setIsSubmitting(true)
    try {
      const res = await invitationsApi.use(token, { password })
      toast.success('Account activated!')

      // Automatic login
      if (res.data.access_token) {
        setTokens(res.data.access_token, res.data.refresh_token, res.data.user)
        navigate('/hiring/portal')
      } else {
        navigate('/login')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to activate account')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAuthenticated && user?.role !== 'candidate') {
    return (
      <Shell>
        <Card padding="loose" className="w-full max-w-md text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-hb-warning/25 bg-hb-warning/10 text-hb-warning">
            <AlertTriangle size={28} aria-hidden />
          </span>
          <h1 className="mb-2 font-display text-hb-h2 text-hb-text">Logout required</h1>
          <p className="mb-hb-5 text-hb-sm text-hb-muted">
            You are currently logged in as a <strong>{user?.role || 'user'}</strong>. To accept
            this invitation as a candidate, please log out first.
          </p>
          <div className="space-y-2.5">
            <Button onClick={() => logout()} className="w-full">
              Log out & continue
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)} className="w-full">
              Go back
            </Button>
          </div>
        </Card>
      </Shell>
    )
  }

  if (loading) {
    return (
      <Shell>
        <p role="status" className="flex items-center gap-2.5 text-hb-body text-hb-muted">
          <Loader2 size={22} aria-hidden className="animate-spin text-hb-cyan" />
          Verifying your invitation…
        </p>
      </Shell>
    )
  }

  if (error) {
    return (
      <Shell>
        <Card padding="loose" className="w-full max-w-md text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-hb-error/25 bg-hb-error/10 text-hb-error">
            <XCircle size={28} aria-hidden />
          </span>
          <h1 className="mb-2 font-display text-hb-h2 text-hb-text">Invitation error</h1>
          <p className="mb-hb-5 text-hb-sm text-hb-muted">{error}</p>
          <Button variant="ghost" onClick={() => navigate('/products/hiring')} className="w-full">
            Back to home
          </Button>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <Card padding="loose" className="w-full max-w-xl xl:p-10">
        <div className="mb-hb-6 text-center">
          <Link to="/" className="mb-hb-5 inline-flex items-center gap-3">
            <img src="/hybent_logo.webp" alt="" className="h-9 w-9 object-contain" />
            <img src="/hybent_wordmark_dark.webp" alt="Hybent" className="h-6" />
          </Link>

          <h1 className="mb-2 font-display text-hb-h2 text-hb-text">
            Welcome, {invitation?.full_name}!
          </h1>
          <p className="mx-auto max-w-[46ch] text-hb-sm text-hb-muted">
            You've been invited by a team member to join our candidate portal. Set your account
            password to get started.
          </p>
        </div>

        <div className="space-y-hb-5 border-t border-hb-border pt-hb-5">
          <div className="grid gap-hb-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 font-mono text-hb-label uppercase text-hb-dim">Invited email</p>
              <p className="break-all text-hb-sm font-semibold text-hb-text">
                {invitation?.email}
              </p>
            </div>
            <div>
              <p className="mb-1 font-mono text-hb-label uppercase text-hb-dim">Expires in</p>
              <p className="text-hb-sm font-semibold text-hb-warning">48 hours</p>
            </div>
          </div>

          <div className="space-y-hb-4">
            <Input
              label="Set password"
              type="password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Confirm password"
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="rounded-hb-md border border-hb-blue/20 bg-hb-blue/[0.06] p-4">
            <h2 className="mb-1 text-hb-sm font-semibold text-hb-text">What's next?</h2>
            <p className="text-hb-sm leading-relaxed text-hb-muted">
              Once you set your password, you are logged in automatically to complete your profile
              and upload your latest résumé.
            </p>
          </div>

          <Button onClick={handleApply} loading={isSubmitting} size="lg" className="w-full">
            Create account & join portal
          </Button>

          <p className="text-center text-hb-micro text-hb-dim">
            By clicking create account, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </Card>
    </Shell>
  )
}
