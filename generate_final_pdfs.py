import os
try:
    from fpdf import FPDF
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "fpdf2"])
    from fpdf import FPDF

# --- PDF 1: Client Facing PDF ---
html_client = """
<h1>Hireon: Commercial SaaS Platform Proposal</h1>
<h2>Executive Summary</h2>
<p>This document outlines the detailed commercial pricing and infrastructure architecture for the <b>Hireon AI-Powered Recruitment Platform</b>. Designed to handle up to <b>5,000 candidates per month</b>, this production-grade architecture ensures zero downtime, permanent data safety, and includes 1 Admin Portal and 1 Recruiter Portal.</p>

<h2>Infrastructure & Services Breakdown</h2>
<ul>
<li><b>Enterprise Database & Secure Storage</b> (Permanent safety & daily backups): <b>Rs 3,500</b></li>
<li><b>Dedicated Cloud Server & Load Balancing</b> (Smooth 24/7 performance): <b>Rs 2,500</b></li>
<li><b>AI Processing Engine</b> (LLMs & Audio Parsing APIs): <b>Rs 2,500</b></li>
<li><b>Email Delivery & Automated Notifications</b> (Premium email servers): <b>Rs 1,000</b></li>
<li><b>Security Firewall, Custom Domain & SSL</b> (DDoS protection): <b>Rs 500</b></li>
</ul>

<h2>Software Licensing & Technical Maintenance</h2>
<p>This fee covers the commercial license to use the Hireon proprietary software (Admin + Recruiter portals), continuous server monitoring, bug fixes, and 24/7 technical support. It eliminates the need for an in-house developer.</p>
<ul>
<li><b>Monthly Maintenance Fee</b>: <b>Rs 2,000</b></li>
</ul>

<h2>Final Billing Summary</h2>
<table border="1" width="100%">
  <thead>
    <tr>
      <th width="70%">Category</th>
      <th width="30%">Monthly Cost (INR)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Total Infrastructure & APIs</td>
      <td>Rs 10,000</td>
    </tr>
    <tr>
      <td>Software Licensing & Technical Maintenance</td>
      <td>Rs 2,000</td>
    </tr>
    <tr>
      <td><b>TOTAL MONTHLY RETAINER</b></td>
      <td><b>Rs 12,000 / month</b></td>
    </tr>
  </tbody>
</table>
"""

# --- PDF 2: Internal User Costing PDF ---
html_internal = """
<h1>Hireon: Internal Actual Costing Report (CONFIDENTIAL)</h1>
<h2>Actual Provider Costs</h2>
<ul>
<li><b>Database (Supabase Pro)</b>: $25 -> <b>~Rs 2,100</b> (Mandatory for safe permanent storage)</li>
<li><b>Backend Server (Render Starter)</b>: $7 -> <b>~Rs 600</b> (Mandatory for 24/7 uptime)</li>
<li><b>AI APIs (Groq + Gemini + Whisper)</b>: Pay-as-you-go -> <b>~Rs 1,500</b> (Buffered amount)</li>
<li><b>Emails (Brevo Free Tier)</b>: 9000 emails/month -> <b>Rs 0</b></li>
<li><b>Domain (Hostinger)</b>: Already owned -> <b>Rs 0</b></li>
<li><b>Frontend (Vercel/Netlify)</b>: Global CDN -> <b>Rs 0</b></li>
</ul>

<h2>Financial Summary</h2>
<table border="1" width="100%">
  <thead>
    <tr>
      <th width="70%">Item</th>
      <th width="30%">Amount (INR)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Total Actual Monthly Cost</b></td>
      <td><b>Rs 4,200</b></td>
    </tr>
    <tr>
      <td><b>Total Billed to Client</b></td>
      <td><b>Rs 12,000</b></td>
    </tr>
    <tr>
      <td><b>NET MONTHLY PROFIT (MARGIN)</b></td>
      <td><b>Rs 7,800</b></td>
    </tr>
  </tbody>
</table>
"""

# Generate Client PDF
pdf_client = FPDF()
pdf_client.add_page()
pdf_client.set_font("helvetica", size=12)
pdf_client.write_html(html_client)
pdf_client.output("Hireon_Client_Proposal.pdf")

# Generate Internal PDF
pdf_internal = FPDF()
pdf_internal.add_page()
pdf_internal.set_font("helvetica", size=12)
pdf_internal.write_html(html_internal)
pdf_internal.output("Hireon_Internal_Costing.pdf")

print("Both PDFs Generated successfully!")
