try:
    from fpdf import FPDF, XPos, YPos
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "fpdf2"])
    from fpdf import FPDF, XPos, YPos

class PDF(FPDF):
    def header(self):
        self.set_fill_color(20, 20, 45)
        self.rect(0, 0, 210, 16, 'F')
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(255, 255, 255)
        self.set_xy(10, 4)
        self.cell(0, 8, 'HIREON  |  ZERO-SURPRISE SAAS COST RISK AUDIT  |  CONFIDENTIAL', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(0, 0, 0)
        self.ln(4)

    def footer(self):
        self.set_y(-12)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(130, 130, 130)
        self.cell(0, 8, f'Page {self.page_no()} | Hireon Internal Document | Confidential | Not for Distribution', align='C')

    def section_title(self, title, r=20, g=20, b=45):
        self.set_fill_color(r, g, b)
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(255, 255, 255)
        self.cell(0, 7, f'  {title}', fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(0, 0, 0)
        self.ln(1)

    def sub_title(self, title):
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(20, 20, 45)
        self.cell(0, 5, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(20, 20, 45)
        self.set_line_width(0.3)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(2)
        self.set_text_color(0, 0, 0)

    def table_header(self, cols, widths):
        self.set_fill_color(20, 20, 45)
        self.set_font('Helvetica', 'B', 7.5)
        self.set_text_color(255, 255, 255)
        for col, w in zip(cols, widths):
            self.cell(w, 5.5, col, border=1, fill=True)
        self.ln()
        self.set_text_color(0, 0, 0)

    def table_row(self, values, widths, fill=False):
        self.set_font('Helvetica', '', 7.5)
        bg = (245, 245, 252) if fill else (255, 255, 255)
        self.set_fill_color(*bg)
        self.set_text_color(40, 40, 40)
        for val, w in zip(values, widths):
            self.cell(w, 5, str(val), border=1, fill=fill)
        self.ln()
        self.set_text_color(0, 0, 0)

    def total_row(self, label, value, color=(20, 20, 45)):
        self.set_fill_color(*color)
        self.set_font('Helvetica', 'B', 8)
        self.set_text_color(255, 255, 255)
        self.cell(140, 6, f'  {label}', border=1, fill=True)
        self.cell(50, 6, value, border=1, fill=True)
        self.ln()
        self.set_text_color(0, 0, 0)

    def risk_block(self, title, detail, fix, r, g, b):
        self.set_fill_color(r, g, b)
        self.set_font('Helvetica', 'B', 8.5)
        self.set_text_color(255, 255, 255)
        self.cell(0, 6, f'  {title}', fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_fill_color(252, 248, 248)
        self.set_font('Helvetica', '', 7.5)
        self.set_text_color(50, 50, 50)
        self.set_x(10)
        self.multi_cell(185, 4.5, f'FINDING: {detail}', fill=True)
        self.set_font('Helvetica', 'B', 7.5)
        self.set_text_color(0, 120, 0)
        self.set_x(10)
        self.multi_cell(185, 4.5, f'{fix}')
        self.set_text_color(0, 0, 0)
        self.ln(1.5)

    def action_row(self, text, r, g, b):
        self.set_fill_color(r, g, b)
        self.set_font('Helvetica', 'B', 7.5)
        self.set_text_color(255, 255, 255)
        self.set_x(10)
        self.multi_cell(185, 5, f'  {text}', fill=True)
        self.ln(0.5)

pdf = PDF()
pdf.set_auto_page_break(auto=True, margin=14)
pdf.set_margins(10, 22, 10)
pdf.add_page()

# ── COVER BANNER ─────────────────────────────────────────────────────────
pdf.set_fill_color(20, 20, 45)
pdf.rect(10, 22, 190, 25, 'F')
pdf.set_font('Helvetica', 'B', 14)
pdf.set_text_color(255, 255, 255)
pdf.set_xy(14, 25)
pdf.cell(0, 7, 'HIREON: ZERO-SURPRISE COST RISK AUDIT', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font('Helvetica', '', 8)
pdf.set_xy(14, 33)
pdf.cell(0, 5, 'Full Codebase Audit | June 2026 | Exchange Rate: $1 = Rs 84', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(180, 180, 255)
pdf.set_xy(14, 39)
pdf.cell(0, 4, 'Scope: 1 Client  |  4,900 Bulk Import + 100 AI Resume Parse/Month  |  Voice Answers Active (No STT)', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(0, 0, 0)
pdf.set_xy(10, 50)

# ── SECTION 1: CRITICAL RISKS ─────────────────────────────────────────────
pdf.section_title('SECTION 1: CRITICAL RISK FINDINGS FROM CODEBASE AUDIT', 190, 30, 30)
pdf.set_font('Helvetica', 'B', 8)
pdf.set_text_color(190, 30, 30)
pdf.cell(0, 4, 'Discovered by reading actual source code. MUST be resolved before going live to avoid hidden expenses.', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(0, 0, 0)
pdf.ln(1)

pdf.risk_block(
    'RISK 1 [CRITICAL] | CLOUDINARY STORAGE IS ACTIVE | File: app/services/storage_service.py Lines 13-86',
    'Your code uploads ALL resumes, JDs, logos, and avatars to Cloudinary (checked at startup). Free Tier = 25GB only. When limit hits, Cloudinary Starter = $89/month (Rs 7,476). This single item destroys all profit.',
    'FIX: Switch to Supabase Storage (already included in Pro Plan with 100GB free). Remove Cloudinary env keys from production .env.',
    190, 30, 30
)
pdf.risk_block(
    'RISK 2 [CRITICAL] | CELERY/REDIS HAS NO HOSTING | File: app/celery_app.py Line 9-10',
    'Celery requires Redis as broker for background tasks (interview feedback check every 5 mins). Render Starter does NOT include Redis. Without it, all background tasks fail silently in production.',
    'FIX: Use Upstash Redis Free Tier (10k commands/day). Free for 1 client. Takes 5 minutes to configure. Just set REDIS_URL in Render env vars.',
    190, 30, 30
)
pdf.risk_block(
    'RISK 3 [HIGH] | ELASTICSEARCH WILL BREAK ON RENDER | File: app/services/elasticsearch_service.py',
    'ES connects to localhost:9200 which works in Docker locally but not on Render Starter. Full-text candidate search will fail. Good news: code already has a PostgreSQL fallback in search_service.py.',
    'FIX: Ensure ES URL is set to an invalid/empty value in production so code falls back to PostgreSQL ilike search. Cost: Rs 0.',
    200, 100, 0
)
pdf.risk_block(
    'RISK 4 [MEDIUM] | OPENAI + MISTRAL API KEYS PRESENT | File: app/config.py Lines 42-44',
    'openai_api_key and mistral_api_key fields exist in config. If any code path triggers them (e.g. a model fallback or voice processing), unexpected charges will appear on your card without warning.',
    'FIX: Set openai_api_key="" and mistral_api_key="" in production .env. Since client does not need STT or transcription, these keys must be empty.',
    30, 90, 180
)

# ── SECTION 2: FEATURE MAP ────────────────────────────────────────────────
pdf.section_title('SECTION 2: COMPLETE FEATURE TO SERVICE COST MAPPING', 20, 20, 45)
cols = ['Feature', 'Service / API', 'Monthly Cost', 'Required', 'Risk Level']
ws = [50, 54, 24, 24, 38]
pdf.table_header(cols, ws)
rows = [
    ('Backend Server (24/7 uptime)', 'Render Starter Plan', 'Rs 588', 'MANDATORY', 'None'),
    ('Database + Authentication', 'Supabase Pro Plan', 'Rs 2,100', 'MANDATORY', 'None'),
    ('File Storage (needs fix)', 'Supabase Storage (switch from Cloudinary)', 'Included', 'MANDATORY', 'HIGH if not switched'),
    ('Voice Audio Storage', 'Cloudflare R2 (Free Tier)', 'Rs 0 - Rs 17', 'MANDATORY', 'None'),
    ('Resume Parsing (100/month)', 'Groq API - Llama-3.3-70b', '~Rs 420', 'MANDATORY', 'Low'),
    ('JD Parsing', 'Groq API - Llama-3.3-70b', '~Rs 50', 'MANDATORY', 'Low'),
    ('AI Copilot Chatbot', 'Groq API - Llama-3.1-8b-instant', '~Rs 200', 'MANDATORY', 'Low'),
    ('Match Scoring + Summary', 'Groq API - Llama-3.3-70b', '~Rs 200', 'MANDATORY', 'Low'),
    ('HF Image Generation', 'HuggingFace Free (FLUX.1-schnell)', 'Rs 0', 'OPTIONAL', 'None'),
    ('Email Notifications', 'Gmail SMTP (App Password)', 'Rs 0', 'MANDATORY', 'None'),
    ('Interview Scheduling', 'Google Calendar API', 'Rs 0', 'MANDATORY', 'None'),
    ('LinkedIn OAuth Login', 'LinkedIn Basic OAuth', 'Rs 0', 'MANDATORY', 'None'),
    ('Push Notifications', 'Firebase FCM (Free)', 'Rs 0', 'OPTIONAL', 'None'),
    ('Background Tasks', 'Upstash Redis Free Tier', 'Rs 0', 'MANDATORY', 'HIGH if not set up'),
    ('Candidate Search', 'PostgreSQL Full Text (Supabase)', 'Included', 'MANDATORY', 'None'),
    ('4,900 Bulk Import', 'Python Pandas (No External API)', 'Rs 0', 'MANDATORY', 'None'),
    ('Analytics and Reports', 'PostgreSQL Queries (Supabase)', 'Included', 'MANDATORY', 'None'),
    ('Frontend Hosting', 'Vercel Free Tier (Global CDN)', 'Rs 0', 'MANDATORY', 'None'),
    ('Domain hirreon.com', 'Hostinger (Already Purchased)', 'Rs 0', 'DONE', 'None'),
    ('GST 18% on Foreign SaaS', 'Indian Tax (Auto-added by Bank)', '~Rs 484', 'MANDATORY', 'Often Missed'),
]
for i, row in enumerate(rows):
    pdf.table_row(row, ws, fill=(i % 2 == 0))
pdf.ln(2)

# ── SECTION 3: COST SCENARIOS ─────────────────────────────────────────────
pdf.section_title('SECTION 3: MONTHLY COST SCENARIOS', 20, 20, 45)

pdf.sub_title('A. MINIMUM MONTHLY COST (After All Critical Fixes Are Applied)')
cw = [140, 50]
pdf.table_header(['Service Item', 'Monthly Cost (Rs)'], cw)
for i, row in enumerate([
    ('Render Starter Plan', 'Rs 588'),
    ('Supabase Pro (DB + Auth + Storage)', 'Rs 2,100'),
    ('Groq API (Resume Parse + Copilot + Scoring + JD)', '~Rs 920'),
    ('Cloudflare R2 for Voice Audio', 'Rs 0 - Rs 17'),
    ('All Others: Gmail, Vercel, Firebase, Redis, Google API', 'Rs 0'),
    ('GST 18% on Render + Supabase', '~Rs 484'),
]):
    pdf.table_row(row, cw, fill=(i % 2 == 0))
pdf.total_row('MINIMUM TOTAL', 'Rs 4,092 / month', (20, 20, 45))
pdf.ln(2)

pdf.sub_title('B. RECOMMENDED PRODUCTION COST (With 20% Buffer for Spikes)')
pdf.table_header(['Service Item', 'Monthly Cost (Rs)'], cw)
for i, row in enumerate([
    ('All infrastructure same as minimum', 'Rs 4,092'),
    ('AI API buffer for unexpected usage spikes', 'Rs 500'),
]):
    pdf.table_row(row, cw, fill=(i % 2 == 0))
pdf.total_row('RECOMMENDED TOTAL', 'Rs 4,600 / month', (0, 120, 0))
pdf.ln(2)

pdf.sub_title('C. WORST CASE COST (If Critical Risks Are Left Unresolved)')
pdf.table_header(['Service Item', 'Monthly Cost (Rs)'], cw)
for i, row in enumerate([
    ('Render Starter', 'Rs 588'),
    ('Supabase Pro', 'Rs 2,100'),
    ('Cloudinary Starter (if NOT switched to Supabase)', 'Rs 7,476'),
    ('Bonsai.io Elasticsearch Paid Tier', 'Rs 1,260'),
    ('Groq API with heavy usage spikes', 'Rs 1,500'),
    ('Email Service Resend Pro (if Gmail blocked)', 'Rs 1,680'),
    ('GST on all paid services', '~Rs 800'),
]):
    pdf.table_row(row, cw, fill=(i % 2 == 0))
pdf.total_row('WORST CASE TOTAL', 'Rs 15,404 / month', (190, 30, 30))
pdf.ln(2)

# ── SECTION 4: ANNUAL + CONFIDENCE ────────────────────────────────────────
pdf.section_title('SECTION 4: ANNUAL PROJECTIONS AND CONFIDENCE SCORES', 20, 20, 45)

pdf.sub_title('Annual Cost Summary')
aw = [80, 55, 55]
pdf.table_header(['Scenario', 'Monthly (Rs)', 'Annual (Rs)'], aw)
for i, row in enumerate([
    ('Minimum (All Fixes Done)', 'Rs 4,092', 'Rs 49,104'),
    ('Recommended Production', 'Rs 4,600', 'Rs 55,200'),
    ('Worst Case (No Fixes)', 'Rs 15,404', 'Rs 1,84,848'),
]):
    pdf.table_row(row, aw, fill=(i % 2 == 0))
pdf.ln(2)

pdf.sub_title('Confidence Score Per Cost Item')
fw = [50, 30, 24, 86]
pdf.table_header(['Cost Item', 'Estimate (Rs)', 'Confidence', 'Reason'], fw)
for i, row in enumerate([
    ('Render Starter', 'Rs 588', 'HIGH', 'Fixed monthly plan. Zero variability. Confirmed on Render pricing page.'),
    ('Supabase Pro', 'Rs 2,100', 'HIGH', 'Fixed monthly plan. Confirmed on Supabase pricing page.'),
    ('Groq API Total', '~Rs 920', 'MEDIUM', 'Depends on frequency of copilot usage by the recruiter. Can vary 20-30%.'),
    ('Cloudflare R2', 'Rs 0 - Rs 17', 'HIGH', 'Mathematically confirmed. 250MB/month audio is within free 10GB for 3+ years.'),
    ('GST 18%', '~Rs 484', 'HIGH', 'Fixed statutory tax on all foreign SaaS bills in India.'),
    ('Elasticsearch', 'Rs 0 (risky)', 'LOW', 'Depends on which code path activates in production. Needs manual verification.'),
    ('Email Gmail SMTP', 'Rs 0', 'HIGH', 'Gmail SMTP is free. Google does not charge for SMTP with App Password.'),
]):
    pdf.table_row(row, fw, fill=(i % 2 == 0))
pdf.ln(2)

# ── SECTION 5: FUTURE TRIGGERS ────────────────────────────────────────────
pdf.section_title('SECTION 5: FUTURE COST TRIGGERS TO WATCH', 20, 20, 45)
pdf.sub_title('What Can Increase Costs in Future and Under What Conditions')
tw = [62, 68, 60]
pdf.table_header(['Trigger Event', 'When It Happens', 'Additional Monthly Cost'], tw)
for i, row in enumerate([
    ('Cloudinary free limit hit (25GB)', 'Storage exceeds 25GB (approx 6-12 months)', '+Rs 7,476/month'),
    ('Groq rate limit exceeded', 'More than 100 parses per day consistently', 'Add API credits as needed'),
    ('Supabase DB exceeds 8GB', 'After 2+ years of heavy platform use', 'Upgrade to Rs 4,200/month plan'),
    ('Elasticsearch needed beyond PG', 'PostgreSQL search becomes too slow', '+Rs 1,260/month (Bonsai.io)'),
    ('Second client onboarded', 'When you add client number 2', '+Rs 500/month (AI API only)'),
    ('Email volume exceeds 300/day', 'Heavy notification blasts to candidates', '+Rs 1,680/month (Resend Pro)'),
    ('OpenAI key accidentally populated', 'Any audio/voice code path triggers it', 'Up to Rs 25,000/month'),
]):
    pdf.table_row(row, tw, fill=(i % 2 == 0))
pdf.ln(2)

# ── SECTION 6: SALES PRICING ──────────────────────────────────────────────
pdf.section_title('SECTION 6: SALES SAFE PRICING RECOMMENDATION', 0, 120, 0)
pdf.sub_title('Recommended Pricing Strategy for Client')
pdf.table_header(['Item', 'Amount (Rs)'], cw)
for i, row in enumerate([
    ('Actual Operating Cost (Recommended Scenario)', 'Rs 4,600 / month'),
    ('Minimum Safe Client Price (Break-even + buffer)', 'Rs 8,000 / month'),
    ('Recommended Client Price', 'Rs 12,000 / month'),
    ('Net Monthly Profit at Rs 12,000', 'Rs 7,400 / month'),
    ('Annual Net Profit at Rs 12,000 (1 client)', 'Rs 88,800 / year'),
    ('Profit Margin at Recommended Price', '61%'),
]):
    pdf.table_row(row, cw, fill=(i % 2 == 0))
pdf.ln(2)

# ── SECTION 7: MANDATORY ACTION ITEMS ────────────────────────────────────
pdf.section_title('SECTION 7: MANDATORY ACTION ITEMS BEFORE GOING LIVE', 190, 30, 30)
pdf.action_row('[CRITICAL]  Switch all file uploads (resumes, JDs, logos) from Cloudinary to Supabase Storage. Remove Cloudinary keys from .env.', 190, 30, 30)
pdf.action_row('[CRITICAL]  Configure Upstash Redis Free Tier and set REDIS_URL env variable on Render for Celery background tasks.', 190, 30, 30)
pdf.action_row('[IMPORTANT] Set openai_api_key="" and mistral_api_key="" in production .env to prevent accidental API charges.', 200, 120, 0)
pdf.action_row('[IMPORTANT] Verify PostgreSQL search fallback activates correctly when Elasticsearch is unavailable on Render.', 200, 120, 0)
pdf.action_row('[RECOMMENDED] Create a Cloudflare R2 bucket and integrate it for voice audio permanent storage with signed URL access.', 0, 130, 60)
pdf.action_row('[RECOMMENDED] Do a full end-to-end test on Render Starter with all env vars before presenting to client.', 0, 130, 60)

pdf.output('Hireon_Cost_Risk_Audit.pdf')
print("PDF Generated successfully!")
