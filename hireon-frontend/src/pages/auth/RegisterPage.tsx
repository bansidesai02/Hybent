import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'
  
  const { setTokens } = useAuthStore()
  const [serverError, setServerError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const schema = z.object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
    password: isDemo ? z.string().optional() : z.string().min(8, 'Password must be at least 8 characters'),
    organization_name: z.string().min(2, 'Organization name must be at least 2 characters'),
    organization_slug: z
      .string()
      .min(2, 'Slug must be at least 2 characters')
      .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers and hyphens'),
  })

  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ 
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      organization_name: '',
      organization_slug: ''
    }
  })

  // @ts-ignore - watch type inference can be tricky with dynamic schemas
  const orgName = watch('organization_name')

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setValue('organization_name', value)
    setValue('organization_slug', toSlug(value))
  }

  const onSubmit = async (values: any) => {
    setServerError('')
    try {
      if (isDemo) {
        // Handle demo request submission
        const response = await fetch('/api/public/demo-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: values.full_name.split(' ')[0] || values.full_name,
            last_name: values.full_name.split(' ').slice(1).join(' ') || 'User',
            work_email: values.email,
            company_name: values.organization_name,
            team_size: 'Select in Demo', // Placeholder for Register-sourced demo
            monthly_hires: 'Select in Demo',
            hiring_challenge: `Sourced from Register Page (Org: ${values.organization_name})`
          })
        });
        const data = await response.json();
        if (data.success) {
          setSubmitted(true);
        } else {
          setServerError(data.message || 'Something went wrong.');
        }
      } else {
        // Standard registration
        const { data } = await authApi.register(values as any)
        setTokens(data.access_token, undefined)
        
        // Fetch profile
        const { data: user } = await authApi.me()
        useAuthStore.getState().setUser(user)

        if (user.role === 'admin') navigate('/admin')
        else navigate('/recruiter')
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Submission failed. Please try again.'
      setServerError(msg)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0e0c1a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
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
            <span className="logo-wordmark lwl" style={{ fontSize: '24px' }}>Hireon</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#ede9ff]">
            {isDemo ? 'Book your personalized demo' : 'Create your account'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#b0a8d8] mt-1">
            {isDemo ? 'See how Hireon can transform your hiring workflow' : "Start hiring smarter today — it's free"}
          </p>
        </div>

        <div className="bg-white dark:bg-[#1a1730] rounded-2xl border border-gray-200 dark:border-[#2a2550] p-8 shadow-sm">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">Request Received!</h2>
              <p className="text-sm text-gray-500 dark:text-[#b0a8d8] mb-6">
                Thank you. Our team will contact you shortly to schedule your demo.
              </p>
              <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                Back to Home
              </Button>
            </div>
          ) : (
            <>
              {serverError && (
                <div className="mb-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700 dark:text-red-300">{serverError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Full Name"
                  placeholder="Jane Smith"
                  error={errors.full_name?.message}
                  {...register('full_name')}
                />
                <Input
                  label="Work Email"
                  type="email"
                  placeholder="jane@company.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
                {!isDemo && (
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Min. 8 characters"
                    error={errors.password?.message}
                    {...register('password')}
                  />
                )}

                <div className="border-t border-gray-100 dark:border-[#2a2550] pt-4">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-3">Organization</p>
                  <div className="space-y-4">
                    <Input
                      label="Organization Name"
                      placeholder="Acme Corp"
                      error={errors.organization_name?.message}
                      {...register('organization_name')}
                      onChange={handleOrgNameChange}
                    />
                    {!isDemo && (
                      <div>
                        <Input
                          label="Organization Slug"
                          placeholder="acme-corp"
                          error={errors.organization_slug?.message}
                          {...register('organization_slug')}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Used in your portal URL. Only lowercase letters, numbers and hyphens.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  loading={isSubmitting}
                >
                  {isDemo ? <>Book Demo <ArrowRight size={18} className="ml-1 inline" /></> : 'Create Account'}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-[#b0a8d8] mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-violet-600 dark:text-violet-400 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
