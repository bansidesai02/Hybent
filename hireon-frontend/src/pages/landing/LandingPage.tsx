import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, AnimatePresence } from 'framer-motion'

import { TeamIcon } from '@/components/common/CustomIcons'
import { GlassIcon } from '@/components/common/GlassIcon'
import { ArrowRight, Calendar, Menu, X, Check } from 'lucide-react'

// ─── Animation Variants ────────────────────────────────────────────────────────

const fadeReveal = {
  hidden: {
    y: 30,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: { 
      duration: 1.0, 
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
  hidden: {
    scale: 0.96,
    y: 20,
    opacity: 0,
  },
  visible: {
    scale: 1,
    y: 0,
    opacity: 1,
    transition: { 
      duration: 1.0, 
      ease: [0.22, 1, 0.36, 1] 
    }
  }
}

const sideReveal = {
  hidden: ({ side }: { side: 'left' | 'right' }) => ({
    x: side === 'left' ? -30 : 30,
    y: 20,
    opacity: 0,
  }),
  visible: {
    x: 0,
    y: 0,
    opacity: 1,
    transition: { 
      duration: 1.0, 
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
    icon: 'Brain',
    variant: 'violet' as const,
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
    icon: 'Target',
    variant: 'pink' as const,
    color: 'rgba(255,107,198,0.08)',
    title: 'Smart Auto-Shortlisting',
    description: 'Set your thresholds once. Hybent Hiring filters automatically — only the best candidates ever reach your desk.',
    bullets: [
      'Configurable match thresholds per role',
      'Instant HR dashboard notifications',
      'Automatic candidate status emails',
      'Multi-role concurrent processing',
      'Zero manual resume filtering'
    ]
  },
  {
    icon: 'Calendar',
    variant: 'teal' as const,
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
    icon: 'MessageSquare',
    variant: 'violet' as const,
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
    icon: 'Database',
    variant: 'violet' as const,
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
    icon: 'BarChart3',
    variant: 'teal' as const,
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
    icon: 'Brain',
    variant: 'violet' as const,
    title: 'AI Resume Intelligence',
    desc: "The moment a candidate uploads their resume, Hybent Hiring's AI engine kicks in. It parses the document, extracts explicit skills like React, Node.js and TypeScript, and infers hidden skills from context clues. Experience years are calculated precisely and seniority level is determined automatically.",
    tags: [
      { label: 'Skill Extraction' },
      { label: 'Experience Calc' },
      { label: 'Seniority Detection' },
      { label: '~10 seconds', color: 'teal' as const },
    ],
  },
  {
    phase: 'Phase 02 — Scoring',
    icon: 'Target',
    variant: 'pink' as const,
    title: 'Smart Auto-Shortlisting',
    desc: "Hybent Hiring compares each candidate's profile against your requirements and generates a precise match score. If a candidate clears your threshold, they're instantly shortlisted, their status updated, your HR team notified, and the candidate gets an automated email — all without a single human action.",
    tags: [
      { label: 'Match Scoring' },
      { label: 'Auto-Shortlist' },
      { label: 'HR Notification', color: 'pink' as const },
      { label: 'Fully Automated', color: 'teal' as const },
    ],
  },
  {
    phase: 'Phase 03 — Scheduling',
    icon: 'Calendar',
    variant: 'amber' as const,
    title: 'Conflict-Free Scheduling',
    desc: "One click. Hybent Hiring cross-references the candidate's availability, the interviewer's calendar, and checks for existing bookings. It selects the optimal slot, generates a Google Meet link, and dispatches calendar invites to everyone involved. What used to take 15 emails and 3 days now takes 30 seconds.",
    tags: [
      { label: 'Slot Matching' },
      { label: 'Conflict Detection' },
      { label: 'Meet Link', color: 'pink' as const },
      { label: '30 seconds', color: 'teal' as const },
    ],
  },
  {
    phase: 'Phase 04 — Decision',
    icon: 'BarChart3',
    variant: 'teal' as const,
    title: 'Interview Intelligence & Hiring',
    desc: "Post-interview, the interviewer submits structured feedback. Hybent Hiring's AI analyzes it, generates a summary, updates the hire probability score, and surfaces a hiring recommendation to HR. Every decision is data-backed. Every candidate is stored permanently in your searchable talent database for future roles.",
    tags: [
      { label: 'Feedback Analysis' },
      { label: 'Hire Probability' },
      { label: 'Talent Database', color: 'pink' as const },
      { label: 'AI Recommendation', color: 'teal' as const },
    ],
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
// ─── Custom Components ────────────────────────────────────────────────────────

const FormDropdown = ({ 
  label, 
  options, 
  value, 
  onChange, 
  placeholder 
}: { 
  label: string, 
  options: string[], 
  value: string, 
  onChange: (val: string) => void,
  placeholder?: string
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <label className="text-[11px] font-bold uppercase tracking-[1.2px] ml-1" style={{ color: '#9689bb' }}>
        {label}
      </label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-6 py-4 rounded-[14px] border-2 transition-all cursor-pointer flex items-center justify-between select-none
          ${isOpen ? 'border-[#6c47ff]/40 bg-white shadow-[0_4px_20px_rgba(108,71,255,0.12)]' : 'border-transparent bg-white shadow-[0_2px_12px_rgba(108,71,255,0.04)]'}
        `}
      >
        <span className="text-[15px]" style={{ color: value ? 'var(--text)' : '#cbd5e1' }}>
          {value || placeholder}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6c47ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 right-0 z-[100] mt-1 overflow-hidden rounded-[16px] border border-white bg-white/95 backdrop-blur-xl shadow-[0_20px_64px_rgba(108,71,255,0.18)]"
          >
            <div className="py-2 max-h-[240px] overflow-y-auto scrollbar-hide">
              {options.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    onChange(opt)
                    setIsOpen(false)
                  }}
                  className={`px-6 py-3 text-[14px] font-medium transition-colors cursor-pointer hover:bg-[#6c47ff]/05
                    ${value === opt ? 'text-[#6c47ff] bg-[#6c47ff]/05' : 'text-gray-700'}
                  `}
                >
                  {opt}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function LandingPage() {
  useEffect(() => {
    document.title = "Hybent Hiring | AI Recruitment Platform";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "Find, match, and hire top talent faster with an AI engine built for modern recruiting teams.");
    }
  }, []);

  const [scrolled, setScrolled] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [landingConfig, setLandingConfig] = useState<{
    testimonials: any[]
    pricing: any[]
    faqs: any[]
  }>({ testimonials: [], pricing: [], faqs: [] });

  useEffect(() => {
    fetch('/landing-config.json')
      .then(res => res.json())
      .then(data => setLandingConfig(data))
      .catch(err => console.error('Failed to load landing config:', err));
  }, []);


  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
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
          width: 'min(calc(100% - 32px), 1200px)',
          maxWidth: '1200px',
          padding: '12px min(24px, 4vw)',
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.95)',
          borderRadius: '20px',
          boxShadow: '0 8px 40px rgba(108,71,255,0.10), 0 1px 0 rgba(255,255,255,0.8) inset',
        }}
      >
        {/* Logo */}
        <Link to="/hiring" className="flex items-center gap-2.5 no-underline">
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
              {/* Hybent Hiring 'H' mark logo — matches HTML demo */}
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
            Hybent Hiring
          </span>
        </Link>

        {/* Nav links */}
        <ul className="hidden md:flex items-center gap-1 list-none m-0 p-0">
          {['Features', 'How it works', 'About'].map((item) => {
            const targetId = item.toLowerCase().replace(/\s+/g, '-');
            return (
              <li key={item}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="block px-4 py-2 text-[16px] font-medium rounded-[10px] bg-transparent border-none cursor-pointer transition-all duration-200 hover:bg-[rgba(108,71,255,0.07)]"
                  style={{ color: 'var(--text-mid)', fontFamily: 'inherit' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#6c47ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-mid)')}
                >
                  {item}
                </button>
              </li>
            );
          })}
        </ul>

        {/* CTA buttons - Desktop only */}
        <div className="hidden lg:flex items-center gap-3">
          <Link to="/hiring/login">
            <button
              className="px-6 py-2.5 bg-transparent border rounded-[12px] text-[14px] font-bold cursor-pointer transition-all duration-200 hover:bg-[rgba(108,71,255,0.06)] active:scale-95"
              style={{ borderColor: 'rgba(108,71,255,0.25)', color: '#6c47ff', fontFamily: "'Sora', sans-serif" }}
            >
              Sign In
            </button>
          </Link>
          <Link to="/hiring/register">
            <button
              className="px-7 py-2.5 border-0 rounded-[12px] text-[14px] font-bold text-white cursor-pointer transition-all duration-200 hover:-translate-y-[1px] active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #6c47ff, #8b6bff)',
                boxShadow: '0 4px 16px rgba(108,71,255,0.35)',
                fontFamily: "'Sora', sans-serif",
              }}
            >
              Get Started Free
            </button>
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="lg:hidden flex items-center gap-1">
          <Link to="/hiring/login" className="px-3 py-2 text-[13px] font-bold text-[#6c47ff]">Sign In</Link>
          <Link to="/hiring/register">
            <button
              className="px-4 py-2 border-0 rounded-xl text-[13px] font-bold text-white cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #6c47ff, #8b6bff)',
                boxShadow: '0 4px 12px rgba(108,71,255,0.25)',
              }}
            >
              Get Started
            </button>
          </Link>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-9 h-9 rounded-xl bg-[rgba(108,71,255,0.08)] flex items-center justify-center text-[#6c47ff] ml-1"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-[calc(100%+12px)] left-0 right-0 p-6 bg-white/95 backdrop-blur-2xl rounded-2xl border border-white shadow-2xl z-[201] flex flex-col gap-4 lg:hidden"
            >
              <ul className="flex flex-col gap-2 list-none m-0 p-0">
                <li>
                  <Link
                    to="/hiring/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 text-[16px] font-bold rounded-xl no-underline"
                    style={{ color: 'var(--violet)' }}
                  >
                    Sign In
                  </Link>
                </li>
                {['Features', 'How it works', 'About'].map((item) => {
                  const targetId = item.toLowerCase().replace(/\s+/g, '-');
                  return (
                    <li key={item}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setMobileMenuOpen(false);
                          document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full text-left block px-4 py-3 text-[16px] font-bold rounded-xl bg-transparent border-none cursor-pointer"
                        style={{ color: 'var(--text-mid)', fontFamily: 'inherit' }}
                      >
                        {item}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="h-px bg-gray-100 my-2" />
              <Link to="/hiring/register" onClick={() => setMobileMenuOpen(false)}>
                <button className="w-full py-4 rounded-xl text-[15px] font-bold text-white bg-gradient-to-r from-[#6c47ff] to-[#8b6bff]">
                  Get Started Free
                </button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── HERO ── */}
      <section
        className="relative z-10 flex flex-col items-center justify-start text-center"
        style={{ padding: '120px 48px 40px' }}
      >
        {/* Badge */}
        <motion.div
          variants={fadeReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="inline-flex items-center gap-2 mb-8 px-5 py-2 rounded-full text-[14px] font-semibold"
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
          variants={fadeReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
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
          variants={fadeReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="text-[22px] leading-[1.75] max-w-[800px] mb-14"
          style={{
            color: 'var(--text-mid)',
          }}
        >
          Hybent Hiring uses AI to parse resumes, score candidates, manage your pipeline, and close the best talent — in a fraction of the time.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          variants={fadeReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-8 w-full sm:w-auto px-6"
        >
          <Link to="/hiring/register" className="w-full sm:w-auto">
            <button
              className="w-full sm:px-10 py-4 border-0 rounded-[10px] text-[17px] font-semibold text-white cursor-pointer transition-all duration-300 relative overflow-hidden hover:-translate-y-[3px] flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #6c47ff, #8b6bff)',
                boxShadow: '0 8px 28px rgba(108,71,255,0.38)',
                fontFamily: "'Sora', sans-serif",
              }}
            >
              Start for Free <ArrowRight size={20} />
            </button>
          </Link>
        </motion.div>
      </section>

      {/* ── STATS ── */}
      <section className="relative z-10 py-12 px-6 md:px-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: "-100px" }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5"
        >
          {stats.map((s) => (
            <motion.div
              variants={fadeReveal}
              key={s.label}
              className="group relative rounded-[24px] p-8 md:p-10 text-center overflow-hidden transition-all duration-300 hover:-translate-y-[6px]"
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
                  fontSize: 'clamp(48px, 6vw, 64px)',
                  background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {s.value}
              </span>
              <p className="text-[14px] md:text-[16px] font-medium" style={{ color: 'var(--text-mid)', lineHeight: 1.5 }}>{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="relative z-10 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-20"
          >
            <p className="text-[14px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--violet)' }}>How It Works</p>
            <h2
              className="font-black leading-tight mb-5"
              style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(40px,6vw,72px)', color: 'var(--text)', letterSpacing: '-1px' }}
            >
              From application to offer,<br />
              <span style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                all automated.
              </span>
            </h2>
            <p className="text-[20px] max-w-[640px] mx-auto" style={{ color: 'var(--text-mid)', lineHeight: 1.7 }}>
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
                custom={{ side: i % 2 === 0 ? 'left' : 'right' }}
                variants={sideReveal}
                key={step.phase}
                className={`relative flex gap-12 md:gap-[120px] mb-[80px] items-start ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
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
                  <p className="text-[12px] font-bold tracking-[2px] uppercase mb-3" style={{ color: 'var(--violet)' }}>{step.phase}</p>
                  <h3 className="text-[24px] font-bold mb-3" style={{ color: 'var(--text)' }}>{step.title}</h3>
                  <p className="text-[16px] leading-[1.7] mb-5" style={{ color: 'var(--text-mid)' }}>{step.desc}</p>
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

                <div
                  className="absolute left-1/2 -translate-x-1/2 top-4 w-[60px] h-[60px] rounded-full flex items-center justify-center z-10 hidden md:flex shadow-sm"
                  style={{
                    background: 'white',
                    boxShadow: '0 0 0 4px white',
                  }}
                >
                  <GlassIcon icon={step.icon} variant={step.variant} size={50} iconSize={24} glow={false} rounded="50%" />
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
            variants={fadeReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <p className="text-[14px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--violet)' }}>Platform Features</p>
            <h2
              className="font-black leading-tight mb-4"
              style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(40px,6vw,72px)', color: 'var(--text)', letterSpacing: '-1px' }}
            >
              Everything your hiring<br />
              <span style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                team actually needs.
              </span>
            </h2>
            <p className="text-[20px] max-w-2xl mx-auto" style={{ color: 'var(--text-mid)', lineHeight: 1.6 }}>
              No fluff, no bloat. Every feature in Hybent Hiring was built to eliminate a specific friction point in the recruiting process.
            </p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((f) => (
              <motion.div
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
                <div 
                  className="w-16 h-16 rounded-[20px] mb-8 flex items-center justify-center"
                  style={{ background: f.color }}
                >
                  <GlassIcon icon={f.icon} variant={f.variant} size={64} iconSize={28} glow={false} />
                </div>
                <h3 className="text-[22px] font-bold mb-3" style={{ color: 'var(--text)' }}>{f.title}</h3>
                <p className="text-[16px] leading-relaxed mb-6" style={{ color: 'var(--text-mid)' }}>{f.description}</p>
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
              custom={{ side: 'left' }}
              variants={sideReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="flex-1 text-left"
            >
              <p className="text-[13px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--violet)' }}>About Hybent Hiring</p>
              <h2
                className="font-black leading-tight mb-8"
                style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(32px,5vw,52px)', color: 'var(--text)', letterSpacing: '-1px' }}
              >
                Reimagining the Future<br />
                <span style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  of Talent Acquisition.
                </span>
              </h2>
              <div className="space-y-6 text-[18px] leading-[1.7] max-w-xl" style={{ color: 'var(--text-mid)' }}>
                <p>
                  Hybent Hiring was born from a simple mission to fix a recruiting process that hadn't meaningfully changed in decades. From her experience in Human Resources and Talent Acquisition, she saw first-hand how great teams were drowning in manual spreadsheets and inbox chaos.
                </p>
                <p>
                  She set out to build the co-pilot she always wished existed — not just another database, but an intelligent layer that handles the repetitive, time-consuming work so recruiters can focus on the human side of hiring.
                </p>
                <p>
                  Today, Hybent Hiring represents that vision. By leveraging cutting-edge AI to automate the "boring parts," we're empowering talent teams to hire exceptional people faster than ever before.
                </p>
              </div>
            </motion.div>

            {/* Founder Card */}
            <motion.div 
              custom={{ side: 'right' }}
              variants={sideReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
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

                <div className="relative z-10 text-right">
                  {/* Quotes Icon at top - kept left aligned for standard structure or move to right? User said Sabse uper quotes, but usually they are left. I'll keep them left but move the profile to the right. */}
                  <div className="mb-6 opacity-10 flex justify-start">
                    <svg width="40" height="30" viewBox="0 0 40 30" fill="var(--violet)">
                      <path d="M0 30V15C0 6.66667 6.66667 0 15 0V7.5C10.8333 7.5 7.5 10.8333 7.5 15H15V30H0ZM22 30V15C22 6.66667 28.6667 0 37 0V7.5C32.8333 7.5 29.5 10.8333 29.5 15H37V30H22Z" />
                    </svg>
                  </div>

                  <blockquote className="text-[18px] sm:text-[20px] leading-[1.8] font-medium text-left mb-6" style={{ color: 'var(--text)', fontFamily: "'Fraunces', serif" }}>
                    "I didn't want to build just another HR tool. I wanted to build the thing I wish existed — a recruiter's co-pilot that handles the boring parts so humans can focus on the human parts."
                  </blockquote>
                  <div className="text-right">
                    {/* <span className="text-[15px] font-bold" style={{ color: 'var(--text)', opacity: 0.9 }}>— Bansi Desai</span> */}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      {/*
      <section id="testimonials" className="relative z-10 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={fadeReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <p className="text-[14px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--violet)' }}>Wall of Love</p>
            <h2
              className="font-black leading-tight mb-4"
              style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(40px,6vw,72px)', color: 'var(--text)', letterSpacing: '-1px' }}
            >
              Loved by hiring<br />
              <span style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                teams everywhere.
              </span>
            </h2>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid sm:grid-cols-2 md:grid-cols-3 gap-6"
          >
            {landingConfig.testimonials.map((t, i) => (
              <motion.div
                variants={fadeReveal}
                key={i}
                className="rounded-[24px] p-8 transition-all duration-300 hover:-translate-y-1 flex flex-col"
                style={{
                  background: 'rgba(255,255,255,0.72)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 4px 24px rgba(108,71,255,0.06)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 48px rgba(108,71,255,0.14)'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(108,71,255,0.06)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.72)' }}
              >
                <div className="flex-1">
                  <div className="flex gap-1 mb-6 text-[#ff6bc6]">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg key={star} width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-[17px] font-medium leading-[1.6] mb-8" style={{ color: 'var(--text-dark)' }}>"{t.quote}"</p>
                </div>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[15px]"
                    style={{ background: t.gradient }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-[15px] font-bold" style={{ color: 'var(--text)' }}>{t.name}</div>
                    <div className="text-[13px] font-medium" style={{ color: 'var(--text-mid)' }}>{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      */}

      {/* ── PRICING ── */}
      {/*
      <section id="pricing" className="relative z-10 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={fadeReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <p className="text-[14px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--violet)' }}>Pricing</p>
            <h2
              className="font-black leading-tight mb-4"
              style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(40px,6vw,72px)', color: 'var(--text)', letterSpacing: '-1px' }}
            >
              Simple, transparent<br />
              <span style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                pricing for everyone.
              </span>
            </h2>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-center"
          >
            {landingConfig.pricing.map((p, i) => (
              <motion.div
                variants={fadeReveal}
                key={p.name}
                className={`rounded-[32px] p-8 transition-all duration-300 flex flex-col relative ${p.featured ? 'md:-translate-y-4 shadow-xl border-[#6c47ff]/20 bg-white' : 'hover:-translate-y-1'}`}
                style={{
                  background: p.featured ? 'white' : 'rgba(255,255,255,0.72)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${p.featured ? 'rgba(108,71,255,0.2)' : 'rgba(255,255,255,0.95)'}`,
                  boxShadow: p.featured ? '0 24px 80px rgba(108,71,255,0.15)' : '0 4px 24px rgba(108,71,255,0.06)',
                  zIndex: p.featured ? 10 : 1,
                  transform: p.featured ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {p.featured && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-[#6c47ff] to-[#ff6bc6] text-white px-4 py-1.5 rounded-full text-[12px] font-bold tracking-wide shadow-lg">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-8 mt-2">
                  <h3 className="text-[22px] font-bold mb-2" style={{ color: p.featured ? '#6c47ff' : 'var(--text)' }}>{p.name}</h3>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-[44px] font-black tracking-tight" style={{ color: 'var(--text)', fontFamily: "'Fraunces', serif" }}>{p.price}</span>
                    <span className="text-[14px] font-medium" style={{ color: 'var(--text-mid)' }}>{p.period}</span>
                  </div>
                  <p className="text-[15px] font-medium" style={{ color: 'var(--text-mid)' }}>{p.desc}</p>
                </div>

                <div className="flex-1 mb-8">
                  <ul className="flex flex-col gap-4 list-none p-0 m-0">
                    {p.features.map((f: string) => (
                      <li key={f} className="flex items-start gap-3 text-[14px] font-medium" style={{ color: 'var(--text-dark)' }}>
                        <Check size={18} className="flex-shrink-0 mt-0.5 text-[#00d4c8]" strokeWidth={3} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  className="w-full py-4 rounded-[12px] text-[15px] font-bold transition-all duration-300"
                  style={{
                    background: p.featured ? 'linear-gradient(135deg, #6c47ff, #8b6bff)' : 'rgba(108,71,255,0.05)',
                    color: p.featured ? 'white' : '#6c47ff',
                    boxShadow: p.featured ? '0 8px 24px rgba(108,71,255,0.3)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!p.featured) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,0.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!p.featured) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,0.05)'
                    }
                  }}
                >
                  {p.cta}
                </button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      */}

      {/* ── FAQS ── */}
      <section id="faqs" className="relative z-10 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            variants={fadeReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <p className="text-[14px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--violet)' }}>Got Questions?</p>
            <h2
              className="font-black leading-tight mb-4"
              style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(36px,5vw,56px)', color: 'var(--text)', letterSpacing: '-1px' }}
            >
              Frequently Asked<br />
              <span style={{ background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Questions.
              </span>
            </h2>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="flex flex-col gap-4"
          >
            {landingConfig.faqs.map((faq, i) => (
              <motion.div variants={fadeReveal} key={i}>
                <FaqItem q={faq.q} a={faq.a} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>



      {/* ── FOOTER ── */}
      <footer
        className="relative z-10 py-16 px-6"
        style={{ borderTop: '1px solid rgba(108,71,255,0.10)' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-12">
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
                <span className="logo-wordmark lwl" style={{ fontSize: '18px' }}>Hybent Hiring</span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-mid)' }}>
                AI-powered recruiting platform that helps teams hire faster and smarter.
              </p>
            </div>

            {/* Links */}
            {[
              { heading: 'Product', links: ['Features'] },
              { heading: 'Company', links: ['About'] },
              { heading: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Cookies'] },
            ].map((col) => (
              <div key={col.heading}>
                <h4 className="text-[12px] font-bold uppercase tracking-[1.5px] mb-4" style={{ color: 'var(--text-light)' }}>
                  {col.heading}
                </h4>
                <ul className="space-y-2">
                  {col.links.map((link) => {
                    const targetId = link === 'Features' ? 'features' : link === 'About' ? 'about' : '';
                    return (
                      <li key={link}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            if (targetId) {
                              document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="text-[13px] no-underline transition-colors hover:text-violet-600 bg-transparent border-none p-0 cursor-pointer text-left"
                          style={{ color: 'var(--text-mid)' }}
                        >
                          {link}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-[12px]"
            style={{ borderTop: '1px solid rgba(108,71,255,0.08)', color: 'var(--text-light)' }}
          >
            <span>&copy; {new Date().getFullYear()} Hybent Hiring. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
