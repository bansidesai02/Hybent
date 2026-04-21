import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const schema = z.object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
    organization_name: z.string().min(2, 'Organization name must be at least 2 characters'),
  })

  type FormData = z.infer<typeof schema>

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
      const response = await fetch('/api/public/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: values.full_name.split(' ')[0] || values.full_name,
          last_name: values.full_name.split(' ').slice(1).join(' ') || 'User',
          work_email: values.email,
          company_name: values.organization_name,
          team_size: 'Lead from Register',
          monthly_hires: 'Lead from Register',
          hiring_challenge: `Sourced from new Register/Access Page`
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0915] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration matching landing page */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 pointer-events-none" style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 pointer-events-none" style={{ background: 'linear-gradient(135deg, #00d4c8, #6c47ff)' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-3 mb-8 no-underline">
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
            <span className="logo-wordmark lwl" style={{ fontSize: '26px', fontWeight: 800 }}>Hireon</span>
          </Link>
          <h1 className="text-[32px] sm:text-[40px] font-black leading-tight mb-3 dark:text-white" style={{ fontFamily: "'Fraunces', serif" }}>
            Get early access.
          </h1>
          <p className="text-[16px] text-gray-500 dark:text-[#b0a8d8] max-w-sm mx-auto">
            Fill in your details and we'll get back to you within 24 hours to set up your account.
          </p>
        </div>

        <div 
          className="rounded-[32px] p-8 sm:p-10 relative overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(40px) saturate(200%)',
            border: '1px solid rgba(255,255,255,1)',
            boxShadow: '0 32px 96px -12px rgba(108,71,255,0.15)',
          }}
        >
          {submitted ? (
            <div className="text-center py-8 animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
              </div>
              <h2 className="text-[28px] font-black mb-4 dark:text-white" style={{ fontFamily: "'Fraunces', serif" }}>Request Received!</h2>
              <p className="text-[16px] leading-relaxed text-gray-500 dark:text-[#b0a8d8] mb-10">
                Thank you for your interest in Hireon. Our team will reach out to you shortly to get your workspace ready.
              </p>
              <Button 
                onClick={() => navigate('/')} 
                className="w-full py-6 rounded-[16px] text-[16px] font-bold"
                style={{ background: 'linear-gradient(135deg, #6c47ff, #8b6bff)' }}
              >
                Return Home
              </Button>
            </div>
          ) : (
            <>
              {serverError && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-[12px] font-bold">!</span>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">{serverError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[1.5px] ml-1 text-gray-400 dark:text-[#9689bb]">Full Name</label>
                  <Input
                    placeholder="Jane Smith"
                    error={errors.full_name?.message}
                    {...register('full_name')}
                    className="py-4 px-6 rounded-[16px] border-2 border-transparent focus:border-[#6c47ff]/20 bg-white dark:bg-[#0b0915]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[1.5px] ml-1 text-gray-400 dark:text-[#9689bb]">Work Email</label>
                  <Input
                    type="email"
                    placeholder="jane@company.com"
                    error={errors.email?.message}
                    {...register('email')}
                    className="py-4 px-6 rounded-[16px] border-2 border-transparent focus:border-[#6c47ff]/20 bg-white dark:bg-[#0b0915]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[1.5px] ml-1 text-gray-400 dark:text-[#9689bb]">Organization Name</label>
                  <Input
                    placeholder="Acme Corp"
                    error={errors.organization_name?.message}
                    {...register('organization_name')}
                    className="py-4 px-6 rounded-[16px] border-2 border-transparent focus:border-[#6c47ff]/20 bg-white dark:bg-[#0b0915]"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full py-7 rounded-[18px] text-[16px] font-bold mt-4 shadow-[0_12px_40px_rgba(108,71,255,0.25)] hover:shadow-[0_16px_48px_rgba(108,71,255,0.35)] transition-all"
                  loading={isSubmitting}
                  style={{ background: 'linear-gradient(135deg, #6c47ff, #8b6bff)' }}
                >
                  {isSubmitting ? 'Sending Request...' : <>Create Account <ArrowRight size={20} className="ml-2" /></>}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[14px] text-gray-400 dark:text-[#b0a8d8] mt-8">
          By clicking Create Account, you agree to our{' '}
          <a href="#" className="font-bold underline hover:text-violet-500">Terms of Service</a>.
        </p>
      </motion.div>
    </div>
  )
}
