# Hireon: Commercial SaaS Proposal & Costing Report

## Executive Summary
This document outlines the detailed commercial pricing, infrastructure architecture, and platform licensing for the **Hireon AI-Powered Recruitment Platform**. Designed to handle up to **5,000 candidates per month**, this production-grade architecture ensures high availability, enterprise-grade data security, and seamless AI performance.

---

## 🏗️ PART 1: Premium Infrastructure Breakdown

### 1. Cloud Hosting & Infrastructure (Render)
To ensure fast load times, zero cold-starts, and reliable uptime, we utilize dedicated hosting environments rather than free shared servers.
* **Backend (FastAPI)**: Render Web Service (Starter Plan) - $7/month
* **Frontend (React)**: Render Static Site (Global CDN) - Free
* **Why this is needed**: Ensures the platform is always awake and responds instantly when recruiters search or add candidates.
* **Monthly Cost**: ~$7 USD -> **₹700 INR** (approx. with taxes)

### 2. Enterprise Database & Authentication (Supabase)
For 5,000 candidates/month, data integrity is critical. We use premium database tiers to prevent data loss.
* **Plan**: Supabase Pro Tier - $25/month
* **Included Features**: 100,000 Monthly Active Users, 8GB Database space, Point-in-time recovery, and Automated Daily Backups.
* **Why this is needed**: Guarantees that candidate data, resumes, and recruiter accounts are backed up daily and secured with enterprise standards.
* **Monthly Cost**: $25/month -> **₹2,100 INR**

### 3. AI Services & LLM APIs (Gemini & Groq)
Hireon uses advanced AI for resume parsing, candidate matching, and the Recruiter Copilot.
* **Gemini API**: Used for complex candidate evaluations and scoring. (Est. $10/mo for 5,000 resumes).
* **Groq API**: Provides ultra-fast inference for the chatbot and extraction. (Est. $5/mo).
* **Why this is needed**: To automate resume reading and scoring, saving hundreds of manual hours.
* **Monthly Cost**: ~$15/month -> **₹1,260 INR**

### 4. Storage for Resumes & Logos
5,000 resumes per month (approx 1MB each) requires 5GB of robust storage per month.
* **Plan**: Supabase Storage (Included in Pro Plan up to 100GB).
* **Monthly Cost**: **₹0 INR** (Covered in Database cost)

### 5. Email Notifications (Resend / SendGrid)
High-deliverability email infrastructure to ensure interview invites and candidate notifications never hit the spam folder.
* **Plan**: Pro Tier for up to 50,000 emails - $20/month
* **Why this is needed**: Processing 5,000 candidates requires sending thousands of automated updates, interview links, and status emails.
* **Monthly Cost**: $20/month -> **₹1,680 INR**

### 6. Security, DNS & Miscellaneous Integrations
* **Services**: Cloudflare CDN routing, SSL certificates, Domain renewal provisioning, and proxy APIs for light data extraction.
* **Monthly Cost**: **~₹1,260 INR**

---

## 💻 Infrastructure Subtotal: ₹7,000 INR / month
*(This covers the exact operational costs of premium third-party tools, fast servers, and APIs required to keep the platform running flawlessly).*

---

## 🚀 PART 2: Hireon Platform Licensing & Maintenance
To provide continuous value, this fee covers the proprietary software usage and ongoing technical support.
* **Services Included**: 
  - Continuous server monitoring & uptime guarantees
  - Regular security patches and bug fixes
  - Commercial SaaS license to use the Hireon platform
* **Monthly Fee**: **₹5,000 INR**

---

## 💰 Final Client Billing Summary

| Category | Monthly Cost (INR) |
| :--- | :--- |
| **Enterprise Infrastructure & APIs** | ₹7,000 |
| **Platform Licensing & Support Fee** | ₹5,000 |
| **TOTAL MONTHLY RETAINER** | **₹12,000 INR / month** |

### What You Get for ₹12,000/month:
✅ **Full Capacity**: Effortlessly manage up to 5,000 candidates.
✅ **Premium Speed**: Hosted on paid servers (zero lag, no slow loading).
✅ **Data Safety**: Enterprise database with daily automated backups.
✅ **Worry-Free Operations**: Full technical maintenance and monitoring included.
