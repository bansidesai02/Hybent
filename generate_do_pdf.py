import os
try:
    from fpdf import FPDF
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "fpdf2"])
    from fpdf import FPDF

html_content = """
<h1>Hireon: Cost-Optimized (Cheapest-Stack) SaaS Proposal & Costing</h1>

<h2>Executive Summary</h2>
<p>This document presents a cost-optimized, lowest-price production stack that supports <b>5,000 new candidates / month</b>. All vendor choices prioritize lowest recurring cost while remaining practical for production use.</p>

<h2>Assumptions</h2>
<ul>
  <li>Exchange rate: <b>1 USD = Rs 83 INR</b> (used for conversions)</li>
  <li>Average audio per candidate: <b>2 minutes</b></li>
  <li>Retention: store 12 months of resumes/transcripts by default</li>
  <li>Goal: minimize monthly spend (cheapest paid plans / pay-as-you-go)</li>
</ul>

<h2>Cheapest-stack Monthly Costs (INR)</h2>
<table border="1" width="100%">
  <thead>
    <tr><th>Category</th><th>Provider / Plan</th><th>Monthly Cost (INR)</th></tr>
  </thead>
  <tbody>
    <tr><td>Compute (App + DB self-hosted)</td><td>DigitalOcean Droplet Basic (1GB) - self-host Postgres</td><td>Rs 498</td></tr>
    <tr><td>Redis (cache)</td><td>Upstash Starter / serverless (minimal)</td><td>Rs 415</td></tr>
    <tr><td>Object Storage</td><td>Backblaze B2 (pay-as-you-go small volume)</td><td>Rs 25</td></tr>
    <tr><td>Email (transactional)</td><td>Amazon SES (pay-as-you-go) ~10k emails</td><td>Rs 83</td></tr>
    <tr><td>Embeddings (API)</td><td>Cheapest embedding provider (pay-as-you-go)</td><td>Rs 249</td></tr>
    <tr><td>Speech (raw audio storage only)</td><td>No transcription; raw audio optionally stored and auto-deleted</td><td>Rs 0</td></tr>
    <tr><td>Resume Parses (LLM calls)</td><td>Client will import candidates; only 100 resume parses / month</td><td>Rs 915</td></tr>
    <tr><td>Monitoring / CDN / Security</td><td>Cloudflare Free + Sentry/Grafana free tiers</td><td>Rs 0</td></tr>
    <tr><td><b>Estimated Monthly Total</b></td><td></td><td><b>Rs 2,185</b></td></tr>
  </tbody>
</table>

<h3>Per-candidate variable cost (approx)</h3>
<p><b>Rs 2,185 / 5,000 approx Rs 0.44 per candidate</b> (includes embeddings, storage amortized; only 100 resume parses/month).</p>

<h2>Cheapest Purchase Recommendations (what to buy)</h2>
<ol>
  <li>DigitalOcean Droplet Basic (1GB) - host backend & DB (Rs 498/mo)</li>
  <li>Upstash Starter (or free tier) for Redis (Rs 415/mo if paid)</li>
  <li>Backblaze B2 for object storage (pay-as-you-go)</li>
  <li>Amazon SES for transactional email (pay-as-you-go)</li>
  <li>Low-cost LLM provider (Mistral/HuggingFace pay-as-you-go) - purchase API credits as needed</li>
  <li>OpenAI Whisper API (or comparable low-cost STT) for transcription minutes</li>
</ol>

<h2>Notes & Cost-Saving Tips</h2>
<ul>
  <li>Auto-delete raw audio after transcription to save storage and costs.</li>
  <li>Compress/quantize embeddings and store in a low-cost vector store or object store if QPS is low.</li>
  <li>Batch LLM requests where possible to reduce token wasted on prompts.</li>
  <li>Start with a single droplet and scale to managed DB/Redis only when needed.</li>
</ul>

<p><i>These are conservative, cheapest-stack estimates. If you want, I can now (A) generate a PDF from this content, (B) produce a CSV with editable assumptions, or (C) create a vendor-by-vendor purchase checklist with direct links to the cheapest plans.</i></p>
"""

pdf = FPDF()
pdf.add_page()
pdf.set_font("helvetica", size=12)
pdf.write_html(html_content)
pdf.output("Hireon_Cheapest_Stack_Costing_fixed.pdf")
print("Cheapest-stack PDF generated: Hireon_Cheapest_Stack_Costing_fixed.pdf")
