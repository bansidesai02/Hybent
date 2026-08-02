/** @type {import('tailwindcss').Config} */

/* Colour tokens live in `src/styles/tokens.css` as RGB channel triplets, which
   is what lets `bg-hb-blue/10` compose alpha correctly. This helper wires one
   into Tailwind's `<alpha-value>` slot. */
const hb = (name) => `rgb(var(--hb-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  /* Hybent is light-only, and as of phase 10 no `dark:` variant survives in the
     product. The option stays anyway, as a guard rather than a crutch: deleting
     it makes Tailwind fall back to `media`, so the day someone reintroduces a
     `dark:` class it would silently activate for every visitor whose OS prefers
     dark — the exact outcome the requirement rules out. Pinned to `class`,
     nothing adds `.dark`, so such a variant stays inert until reviewed. */
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* ── Hybent design system ────────────────────────────────────────────
           The canonical palette. Theme-aware: every one of these resolves
           differently under `[data-theme="dark"]` without a `dark:` variant. */
        hb: {
          /* Brand gradient stops — full saturation in both themes */
          'brand-cyan':    hb('brand-cyan'),
          'brand-blue':    hb('brand-blue'),
          'brand-violet':  hb('brand-violet'),
          'brand-magenta': hb('brand-magenta'),

          /* Contrast-corrected accents */
          cyan:    hb('cyan'),
          blue:    hb('blue'),
          violet:  hb('violet'),
          magenta: hb('magenta'),

          /* Ground */
          bg:          hb('bg'),
          'bg-2':      hb('bg-2'),
          ground:      hb('ground'),
          surface:     hb('surface'),
          'surface-2': hb('surface-2'),
          elevated:    hb('elevated'),

          /* Ink */
          text:  hb('text'),
          muted: hb('muted'),
          dim:   hb('dim'),

          /* Status */
          success: hb('success'),
          warning: hb('warning'),
          error:   hb('error'),

          /* Lines. Pre-composed, so no `/alpha` modifier — border-hb-border
             is already the correct alpha for the active theme. */
          border:   'var(--hb-border)',
          'border-strong': 'var(--hb-border-strong)',

          /* Ink on the brand gradient */
          'on-brand': hb('on-brand'),
        },

        /* ── Legacy — retained until the last page migrates off it ───────────
           Deleted in phase 10. Do not reach for these in new work. */
        violet: {
          DEFAULT: '#6c47ff',
          mid:     '#8b6bff',
          light:   '#a98bff',
          50:      '#f5f0ff',
          100:     '#ece8ff',
          200:     '#ddd6fe',
          300:     '#c4b5fd',
          400:     '#a78bfa',
          500:     '#8b5cf6',
          600:     '#6c47ff',
          700:     '#5535d4',
          800:     '#4527aa',
          900:     '#321d80',
        },
        'pink-hi':      '#ff6bc6',
        'pink-light':   '#ff9dd7',
        'teal-hi':      '#00d4c8',
        'teal-light':   '#5eead4',
        'amber-hi':     '#fbbf24',
        'text-dark':    '#1a1040',
        'text-mid':     '#5a4e7a',
        'text-light':   '#9689bb',
        'bg-lavender':  '#f0eeff',
        'bg-lavender2': '#ece8ff',
        brand: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#6c47ff',
          700: '#5535d4',
          800: '#4527aa',
          900: '#321d80',
        },
        accent: {
          pink:  '#ff6bc6',
          teal:  '#00d4c8',
          amber: '#fbbf24',
        },
      },

      fontFamily: {
        /* Sora displays, Manrope reads, IBM Plex Mono labels — the site's
           stack, now available to the product. */
        display: ['Sora', '-apple-system', 'Segoe UI', 'system-ui', 'sans-serif'],
        body:    ['Manrope', '-apple-system', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],

        /* Legacy. `sans` stays system-ui so unmigrated pages render exactly as
           they do today; they set Poppins inline. Removed in phase 10. */
        sans:     ['system-ui', 'sans-serif'],
        sora:     ['Sora', 'system-ui', 'sans-serif'],
        fraunces: ['Fraunces', 'serif'],
        serif:    ['Fraunces', 'Georgia', 'serif'],
      },

      /* The type ramp that replaces 17 arbitrary `text-[Npx]` sizes.
         [size, { lineHeight, letterSpacing, fontWeight }]

         Three tiers, because they answer different questions:
           content   what the page says
           control   what a button or chip says — its own scale, since control
                     text is optically centred rather than set on a baseline
           micro     numerals in counters and pills, mono but untracked; the
                     .16em of `hb-label` is right for words and wrong for "12" */
      fontSize: {
        /* Content.
           Sized against the site's own scale rather than shrunk from it. The
           first version of this ramp ran every heading at 65–75% of the site's
           equivalent, on the reasoning that a workspace needs more density than
           a marketing page. Density belongs in tables and chips — which is why
           `hb-sm`, `hb-xs` and the label steps are untouched — but applying it
           to headings and figures too is what made the product read as a
           shrunken copy rather than the same design at working density.

           `hb-display`  ← the site's `.h-lg`, at the low end of its clamp
           `hb-h2`       ← `.h-md`
           `hb-h3`       ← `.h-sm`
           `hb-num`      ← `.stat b`
           `hb-lead`     ← `.lead` */
        /* Fluid, like the site's. Every one of these was a fixed pixel value —
           so on a 27" monitor the marketing page's headline grew to 54px while
           the workspace title stayed pinned at 40px and the whole screen read
           as zoomed out. The clamps stay below the site's ceilings because a
           dashboard title is not a hero, but they now breathe with the
           viewport, which is most of what "responsive" buys you visually. */
        /* The site's hero runs `clamp(2.7rem,6.1vw,4.7rem)` at `line-height:1.02`
           and `-.042em`. A dashboard title should not be a 75px hero, but it was
           sitting at 44px/1.08 — small and loose enough that it read as a form
           label rather than as the page speaking. Bigger, and tightened toward
           the site's tracking, which is what makes large Sora look editorial. */
        'hb-display': ['clamp(32px, 3.3vw, 54px)', { lineHeight: '1.04', letterSpacing: '-.038em', fontWeight: '600' }],
        'hb-h2':      ['clamp(22px, 1.8vw, 29px)', { lineHeight: '1.18', letterSpacing: '-.026em', fontWeight: '600' }],
        'hb-h3':      ['clamp(17px, 1.2vw, 20px)', { lineHeight: '1.28', letterSpacing: '-.02em',  fontWeight: '600' }],
        'hb-lead':    ['clamp(16px, 1.1vw, 18px)', { lineHeight: '1.6' }],
        'hb-body':    ['14px', { lineHeight: '1.55' }],
        'hb-sm':      ['13px', { lineHeight: '1.5',  fontWeight: '500' }],
        'hb-xs':      ['12px', { lineHeight: '1.45' }],
        'hb-label':   ['10px', { lineHeight: '1.2',  letterSpacing: '.16em',  fontWeight: '500' }],
        /* The site's `.eyebrow` — wider and one step larger than `hb-label`.
           For the kicker above a page title, nothing else. */
        'hb-eyebrow': ['11.5px', { lineHeight: '1', letterSpacing: '.22em' }],
        /* The site's `.stat b` is `clamp(2.1rem,3.6vw,3rem)` at `-.045em`,
           weight 600 — 34px to 48px. This was a flat 28px at `-.02em`, which is
           why a stat card looked like a small number marooned in a large empty
           box. You turned down a flat 40px earlier and you were right to: fixed
           jumps badly between screen sizes. This is the site's own figure,
           clamped, so it grows with the viewport instead. */
        'hb-num':     ['clamp(30px, 2.6vw, 42px)', { lineHeight: '1', letterSpacing: '-.045em', fontWeight: '600' }],

        /* Control — sm and md deliberately share the content steps */
        'hb-ctl-lg':  ['15px', { lineHeight: '1' }],

        /* Micro */
        'hb-micro':   ['10px', { lineHeight: '1' }],
      },

      borderRadius: {
        'hb-xs':   'var(--hb-r-xs)',    /* 6px  — checkboxes */
        'hb-sm':   'var(--hb-r-sm)',    /* 10px */
        'hb-md':   'var(--hb-r-md)',    /* 16px — the product card */
        'hb-lg':   'var(--hb-r-lg)',    /* 22px — the site card */
        'hb-xl':   'var(--hb-r-xl)',    /* 30px */
        'hb-full': 'var(--hb-r-full)',
        'hb-tile': '13px',

        /* Legacy */
        'card-sm': '10px',
        'card-md': '16px',
        'card-lg': '24px',
      },

      boxShadow: {
        'hb-1':    'var(--hb-sh-1)',
        'hb-2':    'var(--hb-sh-2)',
        'hb-3':    'var(--hb-sh-3)',
        /* The site's own card drop, so a product card and a marketing card
           sit on the page identically. */
        'hb-card':       'var(--hb-sh-card)',
        'hb-card-hover': 'var(--hb-sh-card-hover)',
        'hb-ring': 'var(--hb-ring)',

        /* Legacy — violet-tinted, replaced by the neutral ink scale above */
        card:         '0 8px 40px rgba(108, 71, 255, 0.10)',
        'card-hover': '0 20px 60px rgba(108, 71, 255, 0.18)',
        glass:        '0 8px 32px rgba(108, 71, 255, 0.12)',
        'glass-sm':   '0 4px 16px rgba(108, 71, 255, 0.08)',
        violet:       '0 4px 14px rgba(108, 71, 255, 0.30)',
        'violet-lg':  '0 8px 28px rgba(108, 71, 255, 0.40)',
        kpi:          '0 4px 24px rgba(108, 71, 255, 0.10)',
        'kpi-hover':  '0 12px 40px rgba(108, 71, 255, 0.16)',
      },

      spacing: {
        'hb-1':  'var(--hb-s-1)',
        'hb-2':  'var(--hb-s-2)',
        'hb-3':  'var(--hb-s-3)',
        'hb-4':  'var(--hb-s-4)',
        'hb-5':  'var(--hb-s-5)',
        'hb-6':  'var(--hb-s-6)',
        'hb-8':  'var(--hb-s-8)',
        'hb-10': 'var(--hb-s-10)',
        'hb-12': 'var(--hb-s-12)',
      },

      maxWidth: {
        'hb-page': 'var(--hb-maxw)',
      },

      height: {
        'hb-nav':    'var(--hb-nav-h)',
        'hb-topbar': '64px',
      },

      backgroundImage: {
        /* The identity. One gradient, used where it must carry the brand. */
        'hb-grad':      'var(--hb-grad)',
        'hb-grad-diag': 'var(--hb-grad-diag)',
        'hb-grad-soft': 'var(--hb-grad-soft)',

        /* Legacy */
        'gradient-brand':  'linear-gradient(135deg, #6c47ff 0%, #ff6bc6 100%)',
        'gradient-violet': 'linear-gradient(135deg, #6c47ff 0%, #8b6bff 100%)',
        'gradient-teal':   'linear-gradient(135deg, #00d4c8 0%, #5eead4 100%)',
        'gradient-pink':   'linear-gradient(135deg, #ff6bc6 0%, #ff9dd7 100%)',
        'gradient-amber':  'linear-gradient(135deg, #fbbf24 0%, #fde68a 100%)',
      },

      transitionTimingFunction: {
        hb: 'cubic-bezier(.2, .8, .3, 1)',
      },

      /* Read from the token layer rather than restating the numbers, which is
         how these drifted to a third of the site's tempo in the first place. */
      transitionDuration: {
        'hb-fast':   'var(--hb-dur-fast)',
        hb:          'var(--hb-dur)',
        'hb-slow':   'var(--hb-dur-slow)',
        'hb-lift':   'var(--hb-dur-lift)',
        'hb-reveal': 'var(--hb-dur-reveal)',
      },

      animation: {
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'orbit-spin': 'orbit-spin 5s linear infinite',
        'drift-a':    'driftA 12s ease-in-out infinite alternate',
        'drift-b':    'driftB 15s ease-in-out infinite alternate',
        'drift-c':    'driftC 10s ease-in-out infinite alternate',
        'grow-width': 'growWidth 1.2s ease both',
        'fade-up':    'fadeUp 0.6s ease both',
      },

      keyframes: {
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:      { from: { transform: 'translateY(10px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fadeUp:       { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'orbit-spin': { to: { transform: 'rotate(360deg)' } },
        driftA:       { from: { transform: 'translate(0,0) scale(1)' }, to: { transform: 'translate(40px,-60px) scale(1.1)' } },
        driftB:       { from: { transform: 'translate(0,0) scale(1)' }, to: { transform: 'translate(-30px,50px) scale(1.05)' } },
        driftC:       { from: { transform: 'translate(0,0)' }, to: { transform: 'translate(60px,-40px)' } },
        growWidth:    { from: { width: '0%' } },
      },
    },
  },
  plugins: [],
}
