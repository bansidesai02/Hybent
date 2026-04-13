import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, useScroll } from 'framer-motion'
import MouseTrail from '@/components/common/MouseTrail'

// ─── Animation Variants ────────────────────────────────────────────────────────
const fadeReveal = {
  hidden: (direction: 'up' | 'down') => ({
    y: direction === 'down' ? 40 : -40,
    opacity: 0,
  }),
  visible: {
    y: 0,
    opacity: 1,
    transition: { 
      duration: 1.2, 
      ease: [0.22, 1, 0.36, 1],
    }
  }
}

const staggerContainer = {
  hidden: {},
  visible: { 
    transition: { 
      staggerChildren: 0.08 
    } 
  }
}

const scaleReveal = {
  hidden: (direction: 'up' | 'down') => ({
    scale: 0.95,
    y: direction === 'down' ? 30 : -30,
    opacity: 0,
  }),
  visible: {
    scale: 1,
    y: 0,
    opacity: 1,
    transition: { 
      duration: 1.2, 
      ease: [0.22, 1, 0.36, 1] 
    }
  }
}

const sideReveal = {
  hidden: ({ direction, side }: { direction: 'up' | 'down', side: 'left' | 'right' }) => ({
    x: side === 'left' ? -60 : 60,
    y: direction === 'down' ? 30 : -30,
    opacity: 0,
  }),
  visible: {
    x: 0,
    y: 0,
    opacity: 1,
    transition: { 
      duration: 1.2, 
      ease: [0.22, 1, 0.36, 1],
    }
  }
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const stats = [
  { value: '80%', label: 'Reduction in resume screening time' },
  { value: '90%', label: 'Interview scheduling fully automated' },
  { value: '60%', label: 'Faster overall time-to-hire' },
  { value: '30h', label: 'HR hours saved every single week' },
]

const features = [
  {
    emoji: '🧠',
    color: 'rgba(108,71,255,0.08)',
    title: 'AI Resume Intelligence',
    description: 'Parse any resume format in under 10 seconds. Get precise skills, experience years, and match scores automatically.',
    bullets: [
      'PDF & DOCX parsing, any format',
      'Explicit + Inferred skill extraction',
      'Experience years auto-calculated',
      'Seniority level classification',
      '87% average match accuracy'
    ]
  },
  {
    emoji: '🎯',
    color: 'rgba(255,107,198,0.08)',
    title: 'Smart Auto-Shortlisting',
    description: 'Set your thresholds once. Hireon filters automatically — only the best candidates ever reach your desk.',
    bullets: [
      'Configurable match thresholds per role',
      'Instant HR dashboard notifications',
      'Automatic candidate status emails',
      'Multi-role concurrent processing',
      'Zero manual resume filtering'
    ]
  },
  {
    emoji: '📅',
    color: 'rgba(0,212,200,0.08)',
    title: 'Conflict-Free Scheduling',
    description: 'One-click interview scheduling that prevents double-booking and removes every back-and-forth email.',
    bullets: [
      'Candidate + interviewer availability sync',
      'Automatic conflict detection',
      'Google Meet link generation',
      'Calendar invites to all parties',
      'Reschedule handling built-in'
    ]
  },
  {
    emoji: '💬',
    color: 'rgba(108,71,255,0.08)',
    title: 'Interview Intelligence',
    description: 'Structure your feedback, remove bias, and continuously improve hiring decisions with AI-powered analysis.',
    bullets: [
      'Structured feedback forms per role',
      'AI-generated interview summaries',
      'Hire probability updated after each stage',
      'Bias detection across candidates',
      'Multi-interviewer score aggregation'
    ]
  },
  {
    emoji: '💾',
    color: 'rgba(108,71,255,0.08)',
    title: 'Permanent Talent Database',
    description: "Every candidate you've ever considered is stored, indexed, and searchable — forever. Never lose great talent again.",
    bullets: [
      'Permanent storage of all profiles',
      'Full-text skill & experience search',
      'Re-match past candidates to new roles',
      'Smart alerts for role-candidate fits',
      'Hire in days, not weeks for repeat roles'
    ]
  },
  {
    emoji: '📊',
    color: 'rgba(0,212,200,0.08)',
    title: 'Predictive Analytics',
    description: 'Understand your pipeline health, spot bottlenecks, and continuously improve your hiring funnel with data.',
    bullets: [
      'Real-time pipeline funnel visualization',
      'Time-to-hire trend tracking',
      'Hire probability modeling per role',
      'Sourcing channel performance',
      'Team workload & efficiency reports'
    ]
  }
]

const howItWorks = [
  {
    phase: 'Phase 01 — Intake',
    emoji: '🧠',
    title: 'AI Resume Intelligence',
    desc: "The moment a candidate uploads their resume, Hireon's AI engine kicks in. It parses the document, extracts explicit skills like React, Node.js and TypeScript, and infers hidden skills from context clues. Experience years are calculated precisely and seniority level is determined automatically.",
    tags: [
      { label: 'Skill Extraction' },
      { label: 'Experience Calc' },
      { label: 'Seniority Detection' },
      { label: '~10 seconds', color: 'teal' as const },
    ],
  },
  {
    phase: 'Phase 02 — Scoring',
    emoji: '🎯',
    title: 'Smart Auto-Shortlisting',
    desc: "Hireon compares each candidate's profile against your requirements and generates a precise match score. If a candidate clears your threshold, they're instantly shortlisted, their status updated, your HR team notified, and the candidate gets an automated email — all without a single human action.",
    tags: [
      { label: 'Match Scoring' },
      { label: 'Auto-Shortlist' },
      { label: 'HR Notification', color: 'pink' as const },
      { label: 'Fully Automated', color: 'teal' as const },
    ],
  },
  {
    phase: 'Phase 03 — Scheduling',
    emoji: '📅',
    title: 'Conflict-Free Scheduling',
    desc: "One click. Hireon cross-references the candidate's availability, the interviewer's calendar, and checks for existing bookings. It selects the optimal slot, generates a Google Meet link, and dispatches calendar invites to everyone involved. What used to take 15 emails and 3 days now takes 30 seconds.",
    tags: [
      { label: 'Slot Matching' },
      { label: 'Conflict Detection' },
      { label: 'Meet Link', color: 'pink' as const },
      { label: '30 seconds', color: 'teal' as const },
    ],
  },
  {
    phase: 'Phase 04 — Decision',
    emoji: '📊',
    title: 'Interview Intelligence & Hiring',
    desc: "Post-interview, the interviewer submits structured feedback. Hireon's AI analyzes it, generates a summary, updates the hire probability score, and surfaces a hiring recommendation to HR. Every decision is data-backed. Every candidate is stored permanently in your searchable talent database for future roles.",
    tags: [
      { label: 'Feedback Analysis' },
      { label: 'Hire Probability' },
      { label: 'Talent Database', color: 'pink' as const },
      { label: 'AI Recommendation', color: 'teal' as const },
    ],
  },
]

const testimonials = [
  {
    quote: 'Hireon cut our screening time by 80%. We went from 2 weeks to 2 days for first-round shortlists.',
    name: 'Priya Sharma',
    role: 'Head of Talent @ Finlytic',
    initials: 'PS',
    gradient: 'linear-gradient(135deg, #ddd6fe, #a78bfa)',
  },
  {
    quote: "The AI match scores are eerily accurate. We haven't made a bad hire since switching to Hireon.",
    name: 'Marcus Chen',
    role: 'Engineering Manager @ Orbitalync',
    initials: 'MC',
    gradient: 'linear-gradient(135deg, #fce7f3, #f9a8d4)',
  },
  {
    quote: 'The pipeline view is a game-changer. My whole team knows exactly where every candidate stands.',
    name: 'Aisha Okonkwo',
    role: 'Talent Lead @ Nexlayer',
    initials: 'AO',
    gradient: 'linear-gradient(135deg, #d1fae5, #6ee7b7)',
  },
]

const pricing = [
  {
    name: 'Starter',
    price: '$0',
    period: 'Free forever',
    desc: 'Perfect for early-stage teams.',
    features: ['Up to 5 active jobs', '50 candidate profiles', 'AI resume parsing', 'Basic pipeline', 'Email support'],
    cta: 'Get Started Free',
    featured: false,
  },
  {
    name: 'Growth',
    price: '$79',
    period: 'per month',
    desc: 'For growing recruitment teams.',
    features: ['Unlimited jobs', 'Unlimited candidates', 'Advanced AI matching', 'Kanban pipeline', 'Interview scheduling', 'Offer letters', 'Analytics dashboard'],
    cta: 'Start Free Trial',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'Contact us',
    desc: 'For large organisations.',
    features: ['Everything in Growth', 'Custom AI models', 'SSO / SAML', 'SLA & uptime guarantee', 'Dedicated success manager', 'Custom integrations'],
    cta: 'Talk to Sales',
    featured: false,
  },
]

const faqs = [
  {
    q: 'How accurate is the AI matching?',
    a: 'Our AI achieves ~90% precision on role-specific matching across 500+ job categories. It continuously improves as your team rates candidates.',
  },
  {
    q: 'Can I import existing candidates?',
    a: 'Yes. Upload a CSV or paste LinkedIn profiles — Hireon parses and enriches them automatically.',
  },
  {
    q: 'Is my data secure?',
    a: 'All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We are SOC 2 Type II compliant.',
  },
  {
    q: 'Does Hireon integrate with our ATS?',
    a: 'We offer native integrations with Greenhouse, Lever, and Workday — plus a REST API for custom connections.',
  },
  {
    q: 'Can I try it before paying?',
    a: 'Absolutely. The Starter plan is free forever. Growth and Enterprise come with a 14-day free trial, no credit card required.',
  },
]

// ─── FAQ Item ──────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-[16px] overflow-hidden transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.95)',
        boxShadow: '0 4px 20px rgba(108,71,255,0.06)',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-[15px] font-600 text-text-dark">{q}</span>
        <span
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-lg font-bold transition-transform duration-200"
          style={{
            background: 'linear-gradient(135deg, #6c47ff, #8b6bff)',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          +
        </span>
      </button>
      {open && (
        <div className="px-6 pb-5 text-[14px] leading-relaxed" style={{ color: 'var(--text-mid)' }}>
          {a}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [demoForm, setDemoForm] = useState({
    firstName: '',
    lastName: '',
    workEmail: '',
    companyName: '',
    teamSize: '1-10',
    monthlyHires: '1-5',
    hiringChallenge: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/public/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: demoForm.firstName,
          last_name: demoForm.lastName,
          work_email: demoForm.workEmail,
          company_name: demoForm.companyName,
          team_size: demoForm.teamSize,
          monthly_hires: demoForm.monthlyHires,
          hiring_challenge: demoForm.hiringChallenge
        })
      });
      const data = await response.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Please check your internet and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Scroll Direction Tracking ──────────────────────────────────────────────
  const { scrollY } = useScroll()
  const [direction, setDirection] = useState<'up' | 'down'>('down')

  useEffect(() => {
    return scrollY.on('change', (latest) => {
      const prev = scrollY.getPrevious() ?? 0
      if (latest > prev) setDirection('down')
      else if (latest < prev) setDirection('up')
    })
  }, [scrollY])

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <MouseTrail />
      {/* Background blobs */}
      <div className="blob-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
      </div>

      {/* ── NAV ── */}
      <nav
        className="fixed z-[200] flex items-center justify-between gap-6"
        style={{
          top: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 64px)',
          maxWidth: '1200px',
          padding: '14px 24px',
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.95)',
          borderRadius: '20px',
          boxShadow: '0 8px 40px rgba(108,71,255,0.10), 0 1px 0 rgba(255,255,255,0.8) inset',
        }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="relative w-[38px] h-[38px] flex items-center justify-center">
            <span
              className="absolute inset-[-7px] rounded-full border border-dashed"
              style={{
                borderColor: 'rgba(108,71,255,0.4)',
                animation: 'orbit-spin 5s linear infinite',
              }}
            >
              <span
                className="absolute top-[-4px] left-1/2 -translate-x-1/2 w-[7px] h-[7px] rounded-full"
                style={{ background: '#00d4c8', boxShadow: '0 0 8px rgba(0,212,200,0.9), 0 0 16px rgba(0,212,200,0.5)' }}
              />
            </span>
            <span
              className="relative w-[38px] h-[38px] rounded-[11px] flex items-center justify-center overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)', boxShadow: '0 4px 14px rgba(108,71,255,0.35)' }}
            >
              <span className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2), transparent 60%)' }} />
              {/* Hireon 'H' mark logo — matches HTML demo */}
              <svg className="relative z-10" width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
                <rect x="16" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
                <rect x="2" y="9" width="18" height="4" rx="2" fill="white" opacity="0.95" />
              </svg>
            </span>
          </div>
          <span
            className="text-[20px] font-extrabold"
            style={{
              background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Hireon
          </span>
        </Link>

        {/* Nav links */}
        <ul className="hidden md:flex items-center gap-1 list-none m-0 p-0">
          {['Features', 'How it works', 'About', 'Book Demo'].map((item) => (
            <li key={item}>
              <a
                href={item === 'Book Demo' ? '#book-demo' : `#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="block px-4 py-2 text-[14px] font-medium rounded-[10px] no-underline transition-all duration-200 hover:bg-[rgba(108,71,255,0.07)]"
                style={{ color: 'var(--text-mid)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#6c47ff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-mid)')}
              >
                {item}
              </a>
            </li>
          ))}
        </ul>

        {/* CTA buttons */}
        <div className="flex items-center gap-3">
          <Link to="/login">
            <button
              className="px-6 py-2.5 bg-transparent border rounded-[12px] text-[14px] font-bold cursor-pointer transition-all duration-200 hover:bg-[rgba(108,71,255,0.06)] active:scale-95"
              style={{ borderColor: 'rgba(108,71,255,0.25)', color: '#6c47ff', fontFamily: "'Sora', sans-serif" }}
            >
              Sign In
            </button>
          </Link>
          <Link to="/register?demo=true">
            <button
              className="px-6 py-2.5 border-0 rounded-[12px] text-[14px] font-bold text-white cursor-pointer transition-all duration-200 hover:-translate-y-[1px] active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #ff6bc6, #ff8dc7)',
                boxShadow: '0 4px 16px rgba(255,107,198,0.35)',
                fontFamily: "'Sora', sans-serif",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(255,107,198,0.45)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(255,107,198,0.35)' }}
            >
              Book Demo
            </button>
          </Link>
          <Link to="/register">
            <button
              className="px-7 py-2.5 border-0 rounded-[12px] text-[14px] font-bold text-white cursor-pointer transition-all duration-200 hover:-translate-y-[1px] active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #6c47ff, #8b6bff)',
                boxShadow: '0 4px 16px rgba(108,71,255,0.35)',
                fontFamily: "'Sora', sans-serif",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(108,71,255,0.45)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(108,71,255,0.35)' }}
            >
              Get Started Free
            </button>
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        className="relative z-10 flex flex-col items-center justify-start text-center"
        style={{ padding: '120px 48px 40px' }}
      >
        {/* Badge */}
        <motion.div
          custom={direction}
          variants={fadeReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: "-50px" }}
          className="inline-flex items-center gap-2 mb-8 px-5 py-2 rounded-full text-[12px] font-semibold"
          style={{
            background: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(255,255,255,1)',
            backdropFilter: 'blur(12px)',
            color: '#6c47ff',
            boxShadow: '0 4px 16px rgba(108,71,255,0.08)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)',
              boxShadow: '0 0 0 3px rgba(108,71,255,0.2)',
              animation: 'pulse-glow 2s infinite',
            }}
          />
          AI-Powered Recruiting Platform
        </motion.div>

        {/* Headline */}
        <motion.h1
          custom={direction}
          variants={fadeReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: "-50px" }}
          className="font-black leading-[1.0] mb-7 max-w-[1000px]"
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 'clamp(48px, 7.5vw, 108px)',
            letterSpacing: '-2px',
            color: 'var(--text)',
          }}
        >
          Hire on{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #6c47ff 0%, #ff6bc6 50%, #00d4c8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Autopilot
          </span>
          .
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          custom={direction}
          variants={fadeReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: "-50px" }}
          className="text-[18px] leading-[1.75] max-w-[600px] mb-14"
          style={{
            color: 'var(--text-mid)',
          }}
        >
          Hireon uses AI to parse resumes, score candidates, manage your pipeline, and close the best talent — in a fraction of the time.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          custom={direction}
          variants={fadeReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: "-50px" }}
          className="flex gap-3.5 justify-center mb-8"
        >
          <Link to="/register">
            <button
              className="px-10 py-4 border-0 rounded-[10px] text-[15px] font-semibold text-white cursor-pointer transition-all duration-300 relative overflow-hidden hover:-translate-y-[3px]"
              style={{
                background: 'linear-gradient(135deg, #6c47ff, #8b6bff)',
                boxShadow: '0 8px 28px rgba(108,71,255,0.38)',
                fontFamily: "'Sora', sans-serif",
              }}
            >
              Start for Free →
            </button>
          </Link>
          <Link to="/register?demo=true">
            <button
              className="px-10 py-4 rounded-[10px] text-[15px] font-semibold cursor-pointer transition-all duration-300 hover:bg-white hover:-translate-y-[2px] flex items-center gap-2"
              style={{
                background: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(255,255,255,0.6)',
                backdropFilter: 'blur(12px)',
                color: 'var(--text)',
                fontFamily: "'Sora', sans-serif",
              }}
            >
              <span>🗓️</span> Book Demo
            </button>
          </Link>
        </motion.div>
      </section>

      {/* ── STATS ── */}
      <section className="relative z-10 py-12 px-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: "-100px" }}
          className="grid grid-cols-2 md:grid-cols-4 gap-5"
        >
          {stats.map((s) => (
            <motion.div
              custom={direction}
              variants={fadeReveal}
              key={s.label}
              className="group relative rounded-[24px] p-10 text-center overflow-hidden transition-all duration-300 hover:-translate-y-[6px]"
              style={{
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.95)',
                boxShadow: '0 8px 40px rgba(108,71,255,0.10)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(108,71,255,0.18)'; (e.currentTarget as HTMLElement).style.background = 'white' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 40px rgba(108,71,255,0.10)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.72)' }}
            >
              {/* Top border slide-in */}
              <div
                className="absolute top-0 left-0 right-0 h-[3px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-[400ms]"
                style={{ background: 'linear-gradient(90deg, #6c47ff, #ff6bc6)' }}
              />
              <span
                className="block font-black leading-none mb-3"
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: '60px',
                  background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {s.value}
              </span>
              <p className="text-[14px] font-medium" style={{ color: 'var(--text-mid)', lineHeight: 1.5 }}>{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="relative z-10 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            custom={direction}
            variants={fadeReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-100px" }}
            className="text-center mb-20"
          >
            <p className="text-[12px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--violet)' }}>How It Works</p>
            <h2
              className="font-black leading-tight mb-5"
              style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(36px,5vw,60px)', color: 'var(--text)', letterSpacing: '-1px' }}
            >
              From application to offer,<br />
              <span style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                all automated.
              </span>
            </h2>
            <p className="text-[17px] max-w-[560px] mx-auto" style={{ color: 'var(--text-mid)', lineHeight: 1.7 }}>
              Four intelligent phases that take a candidate from resume submission to hiring decision — with AI doing the heavy lifting at every step.
            </p>
          </motion.div>

          {/* Timeline */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-100px" }}
            className="relative"
          >
            {/* Center line */}
            <div
              className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 rounded-sm hidden md:block"
              style={{ background: 'linear-gradient(180deg, #6c47ff, #ff6bc6, #00d4c8)' }}
            />

            {howItWorks.map((step, i) => (
              <motion.div
                custom={{ direction, side: i % 2 === 0 ? 'left' : 'right' }}
                variants={sideReveal}
                key={step.phase}
                className={`relative flex gap-0 md:gap-[60px] mb-[60px] items-start ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, margin: "-100px" }}
              >
                {/* Content card */}
                <div
                  className="flex-1 rounded-[24px] p-9 transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: 'rgba(255,255,255,0.72)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.95)',
                    boxShadow: '0 8px 40px rgba(108,71,255,0.10)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(108,71,255,0.18)'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 40px rgba(108,71,255,0.10)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.72)' }}
                >
                  <p className="text-[11px] font-bold tracking-[2px] uppercase mb-3" style={{ color: 'var(--violet)' }}>{step.phase}</p>
                  <h3 className="text-[20px] font-bold mb-3" style={{ color: 'var(--text)' }}>{step.title}</h3>
                  <p className="text-[14px] leading-[1.7] mb-5" style={{ color: 'var(--text-mid)' }}>{step.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {step.tags.map((tag) => (
                      <span
                        key={tag.label}
                        className="px-3 py-1 rounded-full text-[11px] font-semibold"
                        style={
                          tag.color === 'pink'
                            ? { background: 'rgba(255,107,198,0.10)', color: '#ff6bc6' }
                            : tag.color === 'teal'
                              ? { background: 'rgba(0,212,200,0.10)', color: '#00d4c8' }
                              : { background: 'rgba(108,71,255,0.08)', color: 'var(--violet)' }
                        }
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Spacer (desktop only) */}
                <div className="flex-1 hidden md:block" />

                {/* Center dot */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-6 w-[52px] h-[52px] rounded-full flex items-center justify-center text-[22px] z-10 hidden md:flex"
                  style={{
                    background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)',
                    boxShadow: '0 0 0 6px var(--bg), 0 4px 16px rgba(108,71,255,0.35)',
                  }}
                >
                  {step.emoji}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="relative z-10 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            custom={direction}
            variants={fadeReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-100px" }}
            className="text-center mb-16"
          >
            <p className="text-[12px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--violet)' }}>Platform Features</p>
            <h2
              className="font-black leading-tight mb-4"
              style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(36px,5vw,56px)', color: 'var(--text)', letterSpacing: '-1px' }}
            >
              Everything your hiring<br />
              <span style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                team actually needs.
              </span>
            </h2>
            <p className="text-[17px] max-w-xl mx-auto" style={{ color: 'var(--text-mid)', lineHeight: 1.6 }}>
              No fluff, no bloat. Every feature in Hireon was built to eliminate a specific friction point in the recruiting process.
            </p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-100px" }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((f) => (
              <motion.div
                custom={direction}
                variants={fadeReveal}
                key={f.title}
                className="rounded-[24px] p-8 transition-all duration-300 hover:-translate-y-1 text-left"
                style={{
                  background: 'rgba(255,255,255,0.72)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 4px 24px rgba(108,71,255,0.06)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 48px rgba(108,71,255,0.14)'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(108,71,255,0.06)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.72)' }}
              >
                <span
                  className="text-2xl w-14 h-14 rounded-[16px] flex items-center justify-center mb-6"
                  style={{ background: f.color }}
                >
                  {f.emoji}
                </span>
                <h3 className="text-[18px] font-bold mb-3" style={{ color: 'var(--text)' }}>{f.title}</h3>
                <p className="text-[14px] leading-relaxed mb-6" style={{ color: 'var(--text-mid)' }}>{f.description}</p>
                <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
                  {f.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-[13px] font-medium" style={{ color: 'var(--text-mid)' }}>
                      <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17L4 12" stroke="#00d4c8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="relative z-10 py-16 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Text content */}
            <motion.div 
              custom={{ direction, side: 'left' }}
              variants={sideReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, margin: "-100px" }}
              className="flex-1 text-left"
            >
              <p className="text-[12px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--violet)' }}>About Hireon</p>
              <h2
                className="font-black leading-tight mb-8"
                style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(36px,5vw,56px)', color: 'var(--text)', letterSpacing: '-1px' }}
              >
                Reimagining the Future<br />
                <span style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  of Talent Acquisition.
                </span>
              </h2>
              <div className="space-y-6 text-[17px] leading-[1.7] max-w-xl" style={{ color: 'var(--text-mid)' }}>
                <p>
                  Hireon was born from a simple mission by Bansi Desai: to fix a recruiting process that hadn't meaningfully changed in decades. As an IIT Engineer, she saw first-hand how great teams were drowning in manual spreadsheets and inbox chaos.
                </p>
                <p>
                  She set out to build the co-pilot she always wished existed — not just another database, but an intelligent layer that handles the repetitive, time-consuming work so recruiters can focus on the human side of hiring.
                </p>
                <p>
                  Today, Hireon represents that vision. By leveraging cutting-edge AI to automate the "boring parts," we're empowering talent teams to hire exceptional people faster than ever before.
                </p>
              </div>
            </motion.div>

            {/* Founder Card */}
            <motion.div 
              custom={{ direction, side: 'right' }}
              variants={sideReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, margin: "-100px" }}
              className="w-full lg:w-[460px] flex-shrink-0"
            >
              <div
                className="relative rounded-[32px] p-10 overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(32px) saturate(180%)',
                  border: '1px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 20px 60px rgba(108,71,255,0.12)',
                }}
              >
                {/* Decorative blob inside card */}
                <div
                  className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[60px] opacity-20 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)' }}
                />

                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div
                      className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-lg"
                      style={{ background: 'linear-gradient(135deg, #f3f0ff, #ffffff)' }}
                    >
                      <img src="/bansi_desai.jpg" alt="Bansi Desai" className="w-full object-cover" />
                    </div>
                    <div>
                      <h4 className="text-[18px] font-bold" style={{ color: 'var(--text)' }}>Bansi Desai</h4>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--violet)' }}>Founder,Hireon</p>
                    </div>
                  </div>

                  <blockquote className="relative italic text-[18px] leading-[1.8] mb-0" style={{ color: 'var(--text)' }}>
                    <span className="absolute -top-4 -left-6 text-[80px] opacity-[0.08] pointer-events-none" style={{ fontFamily: 'serif' }}>"</span>
                    "I didn't want to build just another HR tool. I wanted to build the thing I wish existed — a recruiter's co-pilot that handles the boring parts so humans can focus on the human parts."
                    <span className="absolute -bottom-10 -right-2 text-[80px] opacity-[0.08] pointer-events-none" style={{ fontFamily: 'serif' }}>"</span>
                  </blockquote>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── BOOK A DEMO ── */}
      <section id="book-demo" className="relative z-10 py-16 px-6 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-40" style={{ background: 'radial-gradient(circle at center, rgba(108,71,255,0.05), transparent 70%)' }} />

        <div className="max-w-6xl mx-auto">
          <motion.div
            custom={direction}
            variants={fadeReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-100px" }}
            className="text-center mb-16"
          >
            <p className="text-[12px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--violet)' }}>Book a Demo</p>
            <h2
              className="font-black leading-tight mb-4"
              style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(36px,5vw,56px)', color: 'var(--text)', letterSpacing: '-1px' }}
            >
              See Hireon in action.<br />
              <span style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Live, just for you.
              </span>
            </h2>
            <p className="text-[17px] max-w-xl mx-auto" style={{ color: 'var(--text-mid)', lineHeight: 1.6 }}>
              Get a personalized walkthrough with one of our team members. We'll show you exactly how Hireon fits your hiring workflow.
            </p>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-12 items-start">
            {/* Form Column */}
            <motion.div 
              custom={{ direction, side: 'left' }}
              variants={sideReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, margin: "-100px" }}
              className="flex-1 w-full"
            >
              <div
                className="rounded-[32px] p-10 relative overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.78)',
                  backdropFilter: 'blur(32px) saturate(180%)',
                  border: '1px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 24px 80px rgba(108,71,255,0.12)',
                }}
              >
                {!submitted ? (
                  <>
                    <h3 className="text-[24px] font-black mb-1.5" style={{ fontFamily: "'Fraunces', serif", color: 'var(--text)' }}>Request a Demo</h3>
                    <p className="text-[14px] mb-8" style={{ color: 'var(--text-mid)' }}>Fill in your details and we'll get back to you within 24 hours to schedule your personalized session.</p>

                    <form onSubmit={handleDemoSubmit} className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[12px] font-bold uppercase tracking-[0.5px] ml-1" style={{ color: 'var(--text-light)' }}>First Name</label>
                          <input
                            required
                            type="text"
                            placeholder="John"
                            className="w-full px-5 py-3.5 rounded-[12px] border-none text-[15px] transition-all outline-none"
                            style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', color: 'var(--text)' }}
                            value={demoForm.firstName}
                            onChange={e => setDemoForm({ ...demoForm, firstName: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[12px] font-bold uppercase tracking-[0.5px] ml-1" style={{ color: 'var(--text-light)' }}>Last Name</label>
                          <input
                            required
                            type="text"
                            placeholder="Doe"
                            className="w-full px-5 py-3.5 rounded-[12px] border-none text-[15px] transition-all outline-none"
                            style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', color: 'var(--text)' }}
                            value={demoForm.lastName}
                            onChange={e => setDemoForm({ ...demoForm, lastName: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[12px] font-bold uppercase tracking-[0.5px] ml-1" style={{ color: 'var(--text-light)' }}>Work Email</label>
                        <input
                          required
                          type="email"
                          placeholder="john@company.com"
                          className="w-full px-5 py-3.5 rounded-[12px] border-none text-[15px] transition-all outline-none"
                          style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', color: 'var(--text)' }}
                          value={demoForm.workEmail}
                          onChange={e => setDemoForm({ ...demoForm, workEmail: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[12px] font-bold uppercase tracking-[0.5px] ml-1" style={{ color: 'var(--text-light)' }}>Company Name</label>
                        <input
                          required
                          type="text"
                          placeholder="Your Company Inc."
                          className="w-full px-5 py-3.5 rounded-[12px] border-none text-[15px] transition-all outline-none"
                          style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', color: 'var(--text)' }}
                          value={demoForm.companyName}
                          onChange={e => setDemoForm({ ...demoForm, companyName: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[12px] font-bold uppercase tracking-[0.5px] ml-1" style={{ color: 'var(--text-light)' }}>Team Size</label>
                          <select
                            className="w-full px-5 py-3.5 rounded-[12px] border-none text-[15px] transition-all outline-none appearance-none"
                            style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', color: 'var(--text)' }}
                            value={demoForm.teamSize}
                            onChange={e => setDemoForm({ ...demoForm, teamSize: e.target.value })}
                          >
                            <option>1-10</option>
                            <option>11-50</option>
                            <option>51-200</option>
                            <option>201-500</option>
                            <option>501+</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[12px] font-bold uppercase tracking-[0.5px] ml-1" style={{ color: 'var(--text-light)' }}>Monthly Hires</label>
                          <select
                            className="w-full px-5 py-3.5 rounded-[12px] border-none text-[15px] transition-all outline-none appearance-none"
                            style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', color: 'var(--text)' }}
                            value={demoForm.monthlyHires}
                            onChange={e => setDemoForm({ ...demoForm, monthlyHires: e.target.value })}
                          >
                            <option>1-5</option>
                            <option>6-15</option>
                            <option>16-30</option>
                            <option>31-50</option>
                            <option>50+</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[12px] font-bold uppercase tracking-[0.5px] ml-1" style={{ color: 'var(--text-light)' }}>What's your biggest hiring challenge?</label>
                        <textarea
                          placeholder="e.g. Resume screening takes too long..."
                          rows={3}
                          className="w-full px-5 py-3.5 rounded-[12px] border-none text-[15px] transition-all outline-none resize-none"
                          style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', color: 'var(--text)' }}
                          value={demoForm.hiringChallenge}
                          onChange={e => setDemoForm({ ...demoForm, hiringChallenge: e.target.value })}
                        />
                      </div>

                      {error && <p className="text-[13px] font-bold text-red-500 ml-1">{error}</p>}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 rounded-[14px] text-white font-bold text-[16px] transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70"
                        style={{
                          background: 'linear-gradient(135deg, #6c47ff, #8b6bff)',
                          boxShadow: '0 8px 24px rgba(108,71,255,0.25)',
                          fontFamily: "'Sora', sans-serif"
                        }}
                      >
                        {submitting ? 'Submitting...' : 'Book My Demo →'}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="text-center py-10 animate-fade-in">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h3 className="text-[28px] font-black mb-4" style={{ fontFamily: "'Fraunces', serif", color: 'var(--text)' }}>Request Received!</h3>
                    <p className="text-[16px] leading-relaxed mb-8" style={{ color: 'var(--text-mid)' }}>
                      Thank you for your interest in Hireon. Our team will reach out to <strong>{demoForm.workEmail}</strong> within 24 hours to schedule your personalized demo.
                    </p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="text-[14px] font-bold underline cursor-pointer" style={{ color: 'var(--violet)' }}
                    >
                      Send another request
                    </button>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Info Column */}
            <motion.div 
              custom={{ direction, side: 'right' }}
              variants={sideReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, margin: "-100px" }}
              className="w-full lg:w-[420px] pt-10 px-4"
            >
              <h4 className="text-[20px] font-bold mb-8" style={{ color: 'var(--text)' }}>What to expect in your demo</h4>

              <div className="space-y-10">
                {[
                  { icon: '🧠', bg: 'rgba(108,71,255,0.08)', title: 'Live AI Resume Parsing', desc: 'Watch Hireon parse a real resume in under 10 seconds, extract skills, and generate match scores.' },
                  { icon: '🎯', bg: 'rgba(255,107,198,0.08)', title: 'Auto-Shortlisting in Action', desc: 'See how Hireon automatically shortlists candidates and keeps everyone informed — without human input.' },
                  { icon: '📅', bg: 'rgba(0,212,200,0.08)', title: 'One-Click Scheduling', desc: 'Experience conflict-free interview scheduling that takes 30 seconds instead of 3 days of emails.' },
                  { icon: '📊', bg: 'rgba(108,71,255,0.08)', title: 'Your Custom Hiring Setup', desc: "We'll configure a demo environment matched to your actual roles, team size, and hiring workflow." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-5 group">
                    <div className="w-12 h-12 rounded-[14px] flex-shrink-0 flex items-center justify-center text-xl transition-transform group-hover:scale-110" style={{ background: item.bg }}>{item.icon}</div>
                    <div>
                      <h5 className="text-[15px] font-bold mb-1.5" style={{ color: 'var(--text)' }}>{item.title}</h5>
                      <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-mid)' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            custom={direction}
            variants={scaleReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-100px" }}
            className="rounded-[32px] p-16 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #6c47ff 0%, #ff6bc6 60%, #00d4c8 100%)' }}
          >
            {/* Glow overlay */}
            <div
              className="absolute inset-0 opacity-30"
              style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.3), transparent 70%)' }}
            />
            <div className="relative z-10">
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <span className="text-[12px] font-bold text-white tracking-[0.5px] uppercase">+ Start hiring smarter today</span>
              </div>

              <h2
                className="font-black leading-tight text-white mb-6"
                style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(38px,6vw,64px)', letterSpacing: '-2px' }}
              >
                Simple to start.<br />
                Impossible to outgrow.
              </h2>
              <p className="text-[18px] mb-12 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>
                Get started in minutes — not days. Hireon is built to be simple enough for a team of one, yet powerful enough to scale with you.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-4">
                <Link to="/register">
                  <button
                    className="px-14 py-5.5 rounded-[16px] text-[17px] font-bold text-violet-600 bg-white cursor-pointer shadow-xl transition-all hover:-translate-y-1.5 hover:shadow-2xl active:translate-y-0 active:scale-95"
                    style={{ fontFamily: "'Sora', sans-serif" }}
                  >
                    Start Free Trial →
                  </button>
                </Link>
                <Link to="#book-demo">
                  <button
                    className="px-14 py-5.5 rounded-[16px] text-[17px] font-bold text-white cursor-pointer transition-all hover:bg-white/10 active:scale-95"
                    style={{ border: '2px solid rgba(255,255,255,0.4)', background: 'transparent', fontFamily: "'Sora', sans-serif" }}
                  >
                    Book a Demo
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="relative z-10 py-16 px-6"
        style={{ borderTop: '1px solid rgba(108,71,255,0.10)' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="logo-orbit">
                  <div className="logo-orbit-ring"></div>
                  <div className="logo-box">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <rect x="2" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
                      <rect x="16" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
                      <rect x="2" y="9" width="18" height="4" rx="2" fill="white" opacity="0.95" />
                    </svg>
                  </div>
                </div>
                <span className="logo-wordmark lwl" style={{ fontSize: '18px' }}>Hireon</span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-mid)' }}>
                AI-powered recruiting platform that helps teams hire faster and smarter.
              </p>
            </div>

            {/* Links */}
            {[
              { heading: 'Product', links: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
              { heading: 'Company', links: ['About', 'Blog', 'Careers', 'Press'] },
              { heading: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Cookies'] },
            ].map((col) => (
              <div key={col.heading}>
                <h4 className="text-[12px] font-bold uppercase tracking-[1.5px] mb-4" style={{ color: 'var(--text-light)' }}>
                  {col.heading}
                </h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-[13px] no-underline transition-colors hover:text-violet-600"
                        style={{ color: 'var(--text-mid)' }}
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-[12px]"
            style={{ borderTop: '1px solid rgba(108,71,255,0.08)', color: 'var(--text-light)' }}
          >
            <span>&copy; {new Date().getFullYear()} Hireon. All rights reserved.</span>
            <span>Powered by AI &mdash; Built with ❤️</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
