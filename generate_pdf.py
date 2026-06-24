import os

try:
    from fpdf import FPDF
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "fpdf2"])
    from fpdf import FPDF

html_content = """
<h1>Hireon: Commercial SaaS Proposal & Costing Report</h1>

<h2>Executive Summary</h2>
<p>This document outlines the detailed commercial pricing, infrastructure architecture, and platform licensing for the <b>Hireon AI-Powered Recruitment Platform</b>. Designed to handle up to <b>5,000 candidates per month</b>, this production-grade architecture ensures high availability, enterprise-grade data security, and seamless AI performance.</p>

<h2>PART 1: Premium Infrastructure Breakdown</h2>

<h3>1. Cloud Hosting & Infrastructure (Render)</h3>
<ul>
<li><b>Backend (FastAPI)</b>: Render Web Service (Starter Plan) - $7/month</li>
<li><b>Frontend (React)</b>: Render Static Site (Global CDN) - Free</li>
<li><b>Monthly Cost</b>: ~$7 USD -> <b>Rs 700 INR</b></li>
</ul>

<h3>2. Enterprise Database & Authentication (Supabase)</h3>
<ul>
<li><b>Plan</b>: Supabase Pro Tier - $25/month</li>
<li><b>Included Features</b>: 100,000 MAUs, 8GB DB space, Automated Backups.</li>
<li><b>Monthly Cost</b>: $25/month -> <b>Rs 2,100 INR</b></li>
</ul>

<h3>3. AI Services & LLM APIs (Gemini & Groq)</h3>
<ul>
<li><b>Usage</b>: 12.5M tokens for Parsing, 10M tokens for Scoring.</li>
<li><b>Monthly Cost</b>: ~$15/month -> <b>Rs 1,260 INR</b></li>
</ul>

<h3>4. Storage for Resumes & Logos</h3>
<ul>
<li><b>Plan</b>: Supabase Storage (10GB/month new data).</li>
<li><b>Monthly Cost</b>: <b>Rs 0 INR</b> (Covered in Database cost)</li>
</ul>

<h3>5. Email Notifications (Resend / SendGrid)</h3>
<ul>
<li><b>Plan</b>: Pro Tier for up to 50,000 emails - $20/month</li>
<li><b>Monthly Cost</b>: $20/month -> <b>Rs 1,680 INR</b></li>
</ul>

<h3>6. Security, DNS & Miscellaneous Integrations</h3>
<ul>
<li><b>Services</b>: Cloudflare CDN, SSL, DNS.</li>
<li><b>Monthly Cost</b>: <b>~Rs 1,260 INR</b></li>
</ul>

<h2>Infrastructure Subtotal: Rs 7,000 INR / month</h2>
<p>(Covers the exact operational costs of premium third-party tools, fast servers, and APIs required to keep the platform running flawlessly).</p>

<h2>PART 2: Hireon Platform Licensing & Maintenance</h2>
<ul>
<li>Continuous server monitoring & uptime guarantees</li>
<li>Commercial SaaS license to use the Hireon platform</li>
<li><b>Monthly Fee</b>: <b>Rs 5,000 INR</b></li>
</ul>

<h2>Final Client Billing Summary</h2>
<table border="1" width="100%">
  <thead>
    <tr>
      <th width="70%">Category</th>
      <th width="30%">Monthly Cost (INR)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Enterprise Infrastructure & APIs</td>
      <td>Rs 7,000</td>
    </tr>
    <tr>
      <td>Platform Licensing & Support Fee</td>
      <td>Rs 5,000</td>
    </tr>
    <tr>
      <td><b>TOTAL MONTHLY RETAINER</b></td>
      <td><b>Rs 12,000 INR / month</b></td>
    </tr>
  </tbody>
</table>

<h3>What You Get for Rs 12,000/month:</h3>
<ul>
<li><b>Full Capacity</b>: Manage up to 5,000 candidates.</li>
<li><b>Premium Speed</b>: Hosted on paid servers.</li>
<li><b>Data Safety</b>: Enterprise DB with daily backups.</li>
<li><b>Worry-Free Operations</b>: Full technical maintenance.</li>
</ul>
"""

pdf = FPDF()
pdf.add_page()
pdf.set_font("helvetica", size=12)
pdf.write_html(html_content)
pdf.output("Hireon_SaaS_Proposal.pdf")
print("PDF Generated successfully!")
