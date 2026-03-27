import { motion } from 'framer-motion'

export function AppLoader() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-[#0a051d]"
    >
      <div className="relative">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-18px] rounded-full border border-[#6c47ff]/30"
          style={{ borderStyle: 'dashed', borderWidth: '1.2px', borderDasharray: '1 4' } as any}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
        </motion.div>

        {/* Logo Icon (Matching Landing Page) */}
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10 w-[90px] h-[90px] flex items-center justify-center"
        >
          {/* Background Squircle with Gradient */}
          <div 
            className="absolute inset-0 rounded-[22px] shadow-2xl"
            style={{ 
              background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)',
              boxShadow: '0 12px 40px rgba(108,71,255,0.35)'
            }}
          >
            <div className="absolute inset-0 rounded-[22px]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2), transparent 60%)' }} />
          </div>

          {/* Hireon 'H' mark — Exact Proportions from Landing Page (22x22 source) */}
          <svg className="relative z-10" width="48" height="48" viewBox="0 0 22 22" fill="none">
            <rect x="2" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
            <rect x="16" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
            <rect x="2" y="9" width="18" height="4" rx="2" fill="white" opacity="0.95" />
          </svg>
        </motion.div>
      </div>

      {/* Wordmark */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-12 text-center"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-[#6c47ff] via-[#b357ff] to-[#ff6bc6] text-transparent bg-clip-text" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Hireon
          </h1>
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:-0.3s]" />
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.15s]" />
          <div className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-bounce" />
        </div>
      </motion.div>

      {/* Footer hint */}
      <div className="absolute bottom-12 text-[10px] font-bold tracking-[3px] text-gray-400 dark:text-gray-600 uppercase">
        AI Hiring Platform
      </div>
    </motion.div>
  )
}
