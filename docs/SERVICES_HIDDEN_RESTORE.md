# Services hidden until 2027 — how to bring them back

Decided: 26 October 2026. HYBENT is focusing on Hybent Hiring, so IT Services, Industries and
Hire Talent are hidden from the website. **Nothing was deleted.** Every original page, text and
link is still in the code, behind a switch.

## To restore everything (2 switches)

1. `hybent-hiring-frontend/src/app/paths.ts` → `export const SHOW_SERVICES = true`
2. `hybent-hiring-backend/app/services/ai/site_assistant.py` → `SHOW_SERVICES = True`

Optional, only if the Solutions menu should come back too:
`hybent-hiring-frontend/src/app/paths.ts` → `export const SHOW_SOLUTIONS = true`.
That flag was already `false` before this change. It controls the "Solutions" dropdown, the mobile
menu's Solutions section and the footer's Solutions column.

One manual edit: `hybent-hiring-frontend/index.html` cannot read the switch. Put
` &amp; IT Services` back at the end of the three titles (`<title>`, `og:title`,
`twitter:title`) so they read `Hybent | AI-Powered Software Products &amp; IT Services`.

Then build (`npm run build && npm run prerender`) and check `dist/sitemap.xml` lists `/services`,
`/industries` and `/hire-talent` again.

## Everything the switch controls

| Where | While hidden (`false`) | When restored (`true`) |
|---|---|---|
| `src/app/AppRoutes.tsx` | `/services`, `/services/:slug`, `/industries`, `/hire-talent` redirect to `/` | Pages open normally |
| `vite-plugins/seoPages.ts` | Those pages are left out of the sitemap and prerender | Included again |
| `src/app/routeMeta.ts` | Home title has no "& IT Services"; About and Privacy descriptions don't mention services | Original titles/descriptions |
| `src/components/layout/GlobalNav.tsx` | Mobile menu "Services" link hidden | Shown (also needs `SHOW_SOLUTIONS`) |
| `src/components/layout/GlobalFooter.tsx` | Footer "Services" link hidden | Shown (also needs `SHOW_SOLUTIONS`) |
| `src/components/SolutionsMegaMenu.tsx` | "Services" card hidden | Shown (also needs `SHOW_SOLUTIONS`) |
| `src/modules/site/pages/HomePage.tsx` | Hero text without "delivers technology services"; hero graphic shows only the Hybent Hiring node | Original text and the IT Services, Custom Software, Hire Talent, Web & Mobile Apps nodes |
| `src/modules/site/pages/AboutPage.tsx` | Hero text "We build AI products…"; heading "What we build"; "02 · IT Services" card (with "Start a project" and "Hire engineers") hidden | Original text, "Two ways we work with you", card shown |
| `src/modules/site/pages/HireTalentPage.tsx` | "Explore Managed Services" button hidden | Shown |
| `src/modules/site/pages/IndustriesPage.tsx` | "Browse All Services" button hidden | Shown |
| `src/modules/site/pages/PrivacyPage.tsx` | Intro, scope, "about us" and "Product & Service Delivery" texts without IT services | Original texts |
| `src/modules/site/components/ContactForm.tsx` | "IT Services" topic hidden; links with `?service=` no longer pre-select it | Topic shown and pre-selected |
| `src/components/chatbot/SuggestionChips.tsx` | "Services" chip hidden | Shown |
| `src/components/chatbot/useChat.ts` | Welcome text without "custom software services"; follow-up "How does the AI screening work?" | Original welcome and "Can you build custom software for us?" |
| `src/components/chatbot/WelcomeOnboarding.tsx` | Hybent Hiring cards (What is Hybent Hiring, AI Resume Screening, Pricing, Interview Scheduling, Book a Demo) | Original service cards (Build an AI Product, Custom Software, Mobile Apps, AI Automation, Hire Developers, Free Consultation) |
| Backend `app/services/ai/site_assistant.py` | Website chatbot isn't told about IT Services / Hire Talent and says HYBENT doesn't currently offer them | Full original knowledge (`_FULL_SITE_KNOWLEDGE`) |

## Not changed (still in the code, untouched)

- The service pages themselves: `ServicesPage.tsx`, `ServiceDetailPage.tsx`, `IndustriesPage.tsx`,
  `HireTalentPage.tsx`, `src/modules/site/components/service-detail/*`,
  `src/modules/site/data/servicesData.ts`, `src/lib/solutions-menu.ts`.
- Backend contact topic `services` is still accepted, so old links or forms keep working.
- `src/modules/site/pages/CustomersPage.tsx` links to `/hire-talent`; that page is already hidden by `SHOW_CUSTOMERS`.

## Check after restoring

Search the built site: `grep -rliE "IT Services|/services|Hire Talent" dist --include=*.html`.
It should find the pages again (it found none while hidden).
