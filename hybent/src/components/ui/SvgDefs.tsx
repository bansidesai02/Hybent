/** Gradient + icon-symbol definitions shared by every view. */
export function SvgDefs() {
  return (
    <>
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}><defs>
        <linearGradient id="hbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" /><stop offset="45%" stopColor="var(--blue)" /><stop offset="100%" stopColor="var(--magenta)" />
        </linearGradient>
        <linearGradient id="hbsoft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity=".17" /><stop offset="100%" stopColor="var(--violet)" stopOpacity=".21" />
        </linearGradient>
        <linearGradient id="hbbp" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--blue)" /><stop offset="100%" stopColor="var(--violet)" />
        </linearGradient>
        <linearGradient id="hbcb" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--cyan)" /><stop offset="100%" stopColor="var(--blue)" />
        </linearGradient>
        <linearGradient id="hbgh" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--cyan)" /><stop offset="38%" stopColor="var(--blue)" /><stop offset="72%" stopColor="var(--violet)" /><stop offset="100%" stopColor="var(--magenta)" />
        </linearGradient>
      </defs></svg>

      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
      <g id="sp" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"></g>
      </defs>
      <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></symbol>
      <symbol id="i-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
      <symbol id="i-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></symbol>
      <symbol id="i-ai" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.4" /></symbol>
      <symbol id="i-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16 20v-1.6a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.4" /><path d="M22 20v-1.6a4 4 0 0 0-3-3.9M16.5 4.2a4 4 0 0 1 0 7.1" /></symbol>
      <symbol id="i-cloud" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.1 11.2 3.9 3.9 0 0 0 6.5 19z" /></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-3.6 8-9.6V5.4L12 2 4 5.4v7c0 6 8 9.6 8 9.6z" /><path d="M9.2 12.2l2 2 3.6-3.9" /></symbol>
      <symbol id="i-chart" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20h18M7 20v-6M12 20V7M17 20v-9" /></symbol>
      <symbol id="i-code" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l-6-6 6-6M15 6l6 6-6 6" /></symbol>
      <symbol id="i-layers" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.6 2.8 7.3 12 12l9.2-4.7z" /><path d="M2.8 12.4 12 17l9.2-4.6M2.8 17 12 21.6 21.2 17" /></symbol>
      <symbol id="i-brief" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2.6" y="7.2" width="18.8" height="13.2" rx="2.4" /><path d="M8.4 7.2V5.4a2 2 0 0 1 2-2h3.2a2 2 0 0 1 2 2v1.8M2.6 12.6h18.8" /></symbol>
      <symbol id="i-head" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="2.4" y="13.4" width="4.2" height="6.4" rx="2" /><rect x="17.4" y="13.4" width="4.2" height="6.4" rx="2" /><path d="M19.5 19.8a3 3 0 0 1-3 2.2H13" /></symbol>
      <symbol id="i-wallet" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.8A2.8 2.8 0 0 1 5.8 5H18v3" /><rect x="3" y="7.8" width="18" height="11.4" rx="2.6" /><circle cx="16.6" cy="13.5" r="1.2" /></symbol>
      <symbol id="i-mega" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10v4a2 2 0 0 0 2 2h1.6L18 21V3L7.6 8H6a2 2 0 0 0-2 2z" /><path d="M20.6 9.4a4 4 0 0 1 0 5.2" /></symbol>
      <symbol id="i-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.4a2.4 2.4 0 0 1 2.4-2.4h3.4l2 2.6h7.8A2.4 2.4 0 0 1 21 10v7.6a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 17.6z" /></symbol>
      <symbol id="i-cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.4" /><path d="M3 10h18M8 3v4M16 3v4" /></symbol>
      <symbol id="i-bot" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 4.4V8M9.4 13.4v1.6M14.6 13.4v1.6M2 13v3M22 13v3" /><circle cx="12" cy="3" r="1.4" /></symbol>
      <symbol id="i-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.2" /><path d="M2.8 12h18.4M12 2.8c2.5 2.6 3.8 5.9 3.8 9.2s-1.3 6.6-3.8 9.2c-2.5-2.6-3.8-5.9-3.8-9.2S9.5 5.4 12 2.8z" /></symbol>
      <symbol id="i-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10.4" width="16" height="10.6" rx="2.6" /><path d="M8 10.4V7.6a4 4 0 0 1 8 0v2.8" /></symbol>
      <symbol id="i-zap" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13.4 2 4 13.6h6.2L10.6 22 20 10.4h-6.2z" /></symbol>
      <symbol id="i-build" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V5.4A2.4 2.4 0 0 1 6.4 3h5.2A2.4 2.4 0 0 1 14 5.4V21M14 10h3.6A2.4 2.4 0 0 1 20 12.4V21M2.6 21h18.8M7.4 7.6h3.2M7.4 11.6h3.2M7.4 15.6h3.2" /></symbol>
      <symbol id="i-heart" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.3 5.9a5 5 0 0 0-7.1 0L12 7.1l-1.2-1.2a5 5 0 1 0-7.1 7.1L12 21.2l8.3-8.2a5 5 0 0 0 0-7.1z" /></symbol>
      <symbol id="i-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2.6" y="5" width="18.8" height="14" rx="2.4" /><path d="M3.4 6.6 12 12.8l8.6-6.2" /></symbol>
      <symbol id="i-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 16.9v2.6a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.5-3 19.3 19.3 0 0 1-6-6 19.6 19.6 0 0 1-3-8.6A2 2 0 0 1 3.8 1.7h2.6a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L7.5 9.5a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.9 2.3z" /></symbol>
      <symbol id="i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10.4c0 6-8 11.6-8 11.6s-8-5.6-8-11.6a8 8 0 1 1 16 0z" /><circle cx="12" cy="10.2" r="2.9" /></symbol>
      <symbol id="i-cpu" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="14" height="14" rx="2.4" /><rect x="9" y="9" width="6" height="6" rx="1.2" /><path d="M9 2.6v2.4M15 2.6v2.4M9 19v2.4M15 19v2.4M2.6 9H5M2.6 15H5M19 9h2.4M19 15h2.4" /></symbol>
      <symbol id="i-db" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5.6" rx="8" ry="3.2" /><path d="M4 5.6v12.8c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V5.6M4 12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" /></symbol>
      <symbol id="i-plug" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2.6v6M15 2.6v6M6.2 8.6h11.6v3.2a5.8 5.8 0 0 1-5.8 5.8 5.8 5.8 0 0 1-5.8-5.8zM12 17.6v4" /></symbol>
      <symbol id="i-award" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="6.2" /><path d="M8.4 14.4 7 22l5-2.6L17 22l-1.4-7.6" /></symbol>
      <symbol id="i-target" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.3" /></symbol>
      <symbol id="i-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1.8 12S5.5 5.2 12 5.2 22.2 12 22.2 12 18.5 18.8 12 18.8 1.8 12 1.8 12z" /><circle cx="12" cy="12" r="3.1" /></symbol>
      <symbol id="i-compass" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.2" /><path d="m15.8 8.2-2 5.6-5.6 2 2-5.6z" /></symbol>
      <symbol id="i-doc" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2.8H7a2.4 2.4 0 0 0-2.4 2.4v13.6A2.4 2.4 0 0 0 7 21.2h10a2.4 2.4 0 0 0 2.4-2.4V8.2z" /><path d="M14 2.8v5.4h5.4M8.6 13h6.8M8.6 17h4.8" /></symbol>
      <symbol id="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.4v2.4M12 19.2v2.4M4.2 12H1.8M22.2 12h-2.4M5.9 5.9 4.2 4.2M19.8 19.8l-1.7-1.7M18.1 5.9l1.7-1.7M4.2 19.8l1.7-1.7" /></symbol>
      <symbol id="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z" /></symbol>
      <symbol id="i-in" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9.5 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.76-1.95 4.02 0 4.76 2.5 4.76 5.76V21h-4v-5.6c0-1.34-.03-3.06-1.9-3.06-1.9 0-2.19 1.45-2.19 2.96V21h-4z" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1L4.7 21H1.5l7.5-8.6L1.1 3h6.6l4.5 5.6zm-1.1 16h1.8L7.7 4.8H5.8z" /></symbol>
      <symbol id="i-gh" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.5c.5.08.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .26.18.57.69.47A10 10 0 0 0 12 2z" /></symbol>
      <symbol id="i-yt" viewBox="0 0 24 24" fill="currentColor"><path d="M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.7 12 4.7 12 4.7s-6.8 0-8.5.5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 4.8 2.8 2.8 0 0 0 2 2c1.7.5 8.5.5 8.5.5s6.8 0 8.5-.5a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-4.8zM9.8 15.3V8.7l5.7 3.3z" /></symbol>
      </svg>
    </>
  )
}
