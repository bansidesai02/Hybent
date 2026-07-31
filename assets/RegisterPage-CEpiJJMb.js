import{j as e,o as j,s as n}from"./vendor-utils-cuRKiDNy.js";import{b as k,e as v,r as d,L as m}from"./vendor-react-Dq7nlNew.js";import{u as N,t as w}from"./zod-3xZCBPY2.js";import{u as z}from"./useDocumentTitle-1m1Rmero.js";import{C as _,T as S,A as f}from"./vendor-ui-Ccl-jF0q.js";const H=j({full_name:n().min(2,"Full name must be at least 2 characters"),email:n().email("Enter a valid email"),organization_name:n().min(2,"Organization name must be at least 2 characters")});function P(){z("Create an account — Hybent Hiring | HYBENT","Start using Hybent Hiring, the AI recruitment platform from HYBENT.");const p=k(),[x]=v(),r=x.get("demo")==="true",[l,i]=d.useState(""),[g,b]=d.useState(!1),{register:s,handleSubmit:h,formState:{errors:t,isSubmitting:a}}=N({resolver:w(H),defaultValues:{full_name:"",email:"",organization_name:""}}),u=async o=>{i("");try{const c=await(await fetch("https://hybent-hiring-ai.onrender.com/api/public/demo-request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({first_name:o.full_name.split(" ")[0]||o.full_name,last_name:o.full_name.split(" ").slice(1).join(" ")||"User",work_email:o.email,company_name:o.organization_name,team_size:"Lead from Register",monthly_hires:"Lead from Register",hiring_challenge:r?"Book a Demo Request":"Get Started Free Request"})})).json();c.success?b(!0):i(c.message||"Something went wrong.")}catch{i("Submission failed. Please try again.")}};return e.jsxs("div",{className:"register-container",children:[e.jsx("style",{children:`
    .register-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      font-family: 'Poppins', sans-serif;
      background: #fff;
    }
    :root[data-theme="dark"] .register-container {
      background: var(--color-bg-page, #16132a);
    }
    .aurora { position: fixed; inset: 0; background: linear-gradient(135deg, #f0eeff 0%, #ffe8f8 35%, #e8f0ff 65%, #f0fff8 100%); z-index: 0; }
    :root[data-theme="dark"] .aurora {
      background: linear-gradient(135deg, #16132a 0%, #0a0818 100%);
    }
    .aura { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; will-change: transform; }
    .a1 { width: 700px; height: 700px; background: radial-gradient(circle, rgba(108,71,255,.28), transparent 70%); top: -250px; right: -150px; animation: drift1 16s ease-in-out infinite alternate; }
    .a2 { width: 600px; height: 600px; background: radial-gradient(circle, rgba(255,107,198,.22), transparent 70%); bottom: -200px; left: -150px; animation: drift2 20s ease-in-out infinite alternate; }
    .a3 { width: 350px; height: 350px; background: radial-gradient(circle, rgba(0,212,200,.18), transparent 70%); top: 40%; left: 35%; animation: drift3 12s ease-in-out infinite alternate; }
    .a4 { width: 250px; height: 250px; background: radial-gradient(circle, rgba(251,191,36,.14), transparent 70%); bottom: 20%; right: 25%; animation: drift1 9s ease-in-out infinite alternate; }
    @keyframes drift1 { from { transform: translate(0, 0); } to { transform: translate(40px, -50px); } }
    @keyframes drift2 { from { transform: translate(0, 0); } to { transform: translate(-30px, 40px); } }
    @keyframes drift3 { from { transform: translate(0, 0); } to { transform: translate(50px, -30px); } }
    .float-card { position: absolute; background: rgba(255,255,255,.55); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,.8); border-radius: 16px; padding: 14px 18px; box-shadow: 0 8px 32px rgba(108,71,255,.12); font-size: 12px; font-weight: 600; color: #5a4e7a; display: flex; align-items: center; gap: 9px; animation: floatAnim 6s ease-in-out infinite alternate; z-index: 1; }
    :root[data-theme="dark"] .float-card {
      background: var(--color-bg-card, #1f1b36);
      border-color: var(--color-border, #2e2855);
      color: var(--text-mid, #6b6393);
    }
    .fc1 { top: 12%; left: 6%; animation-delay: 0s; }
    .fc2 { top: 18%; right: 8%; animation-delay: 1.5s; }
    .fc3 { bottom: 18%; left: 7%; animation-delay: 2.5s; }
    .fc4 { bottom: 12%; right: 6%; animation-delay: 0.8s; }
    @keyframes floatAnim { from { transform: translateY(0); } to { transform: translateY(-12px); } }
    .fc-dot { width: 8px; height: 8px; border-radius: 50%; }
    .glass-card { position: relative; z-index: 2; width: 440px; background: rgba(255,255,255,.65); border: 1px solid rgba(255,255,255,.9); border-radius: 28px; padding: 46px 42px; backdrop-filter: blur(40px); box-shadow: 0 24px 80px rgba(108,71,255,.16), 0 2px 0 rgba(255,255,255,.9) inset; animation: cardIn .7s cubic-bezier(.16,1,.3,1) both; }
    :root[data-theme="dark"] .glass-card {
      background: rgba(31, 27, 54, 0.7);
      border-color: rgba(46, 40, 85, 0.8);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
    }
    @keyframes cardIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    .logo-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; justify-content: center; }
    .form-h1 { font-family: 'Poppins', sans-serif; font-size: 26px; font-weight: 800; color: #1a1040; text-align: center; margin-bottom: 5px; letter-spacing: -.4px; }
    :root[data-theme="dark"] .form-h1 { color: var(--color-text-main, #ede9ff); }
    .form-h2 { font-size: 13px; color: #9689bb; text-align: center; margin-bottom: 30px; line-height: 1.5; }
    :root[data-theme="dark"] .form-h2 { color: var(--text-mid, #6b6393); }
    .field-box { margin-bottom: 16px; position: relative; }
    .field-label { display: block; font-size: 11px; font-weight: 700; color: #5a4e7a; letter-spacing: .7px; text-transform: uppercase; margin-bottom: 7px; text-align: left; }
    :root[data-theme="dark"] .field-label { color: var(--text-mid, #6b6393); }
    .input-ctrl { width: 100%; padding: 12px 16px; background: rgba(255,255,255,.8); border: 1.5px solid rgba(108,71,255,.14); border-radius: 12px; color: #1a1040; font-family: 'Poppins', sans-serif; font-size: 13px; outline: none; transition: all .2s; backdrop-filter: blur(8px); box-sizing: border-box; }
    :root[data-theme="dark"] .input-ctrl { background: rgba(31, 27, 54, 0.4); border-color: var(--color-border, #2e2855); color: var(--color-text-main, #ede9ff); }
    .input-ctrl:focus { border-color: #6c47ff; background: rgba(255,255,255,.95); box-shadow: 0 0 0 3px rgba(108,71,255,.1); }
    :root[data-theme="dark"] .input-ctrl:focus { border-color: var(--color-text-link, #a78bfa); }
    .input-ctrl::placeholder { color: #c4b9de; }
    .error-txt { margin-top: 4px; font-size: 11px; color: #ef4444; text-align: left; }
    .btn-submit { width: 100%; padding: 13px; border-radius: 13px; background: linear-gradient(135deg, var(--violet, #6c47ff), var(--brand2, #9b6bff)); color: #fff; font-family: 'Poppins', sans-serif; font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: all .25s; box-shadow: 0 8px 24px rgba(108,71,255,.38), 0 1px 0 rgba(255,255,255,.2) inset; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-submit:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(108,71,255,.5); }
    .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
    .foot-note { text-align: center; margin-top: 20px; font-size: 12px; color: #9689bb; }
    :root[data-theme="dark"] .foot-note { color: var(--text-mid, #6b6393); }
    .foot-note a { color: #6c47ff; font-weight: 700; text-decoration: none; }
    :root[data-theme="dark"] .foot-note a { color: var(--color-text-link, #a78bfa); }
    .server-err { margin-bottom: 20px; padding: 12px; border-radius: 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; font-size: 13px; text-align: left; }
    .sent-icon { width: 64px; height: 64px; border-radius: 20px; background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(16,185,129,.06)); border: 1px solid rgba(16,185,129,.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    @media (max-width: 640px) { .glass-card { width: 90%; padding: 32px 24px; } .float-card { display: none; } }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `}),e.jsxs("div",{className:"aurora",children:[e.jsx("div",{className:"aura a1"}),e.jsx("div",{className:"aura a2"}),e.jsx("div",{className:"aura a3"}),e.jsx("div",{className:"aura a4"})]}),r?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"float-card fc1",children:[e.jsx("div",{className:"fc-dot",style:{background:"#10b981"}})," ⚡ Live product tour"]}),e.jsxs("div",{className:"float-card fc2",children:[e.jsx("div",{className:"fc-dot",style:{background:"#6c47ff"}})," 💼 Enterprise features"]}),e.jsxs("div",{className:"float-card fc3",children:[e.jsx("div",{className:"fc-dot",style:{background:"#ff6bc6"}})," 🤖 AI agents demo"]}),e.jsxs("div",{className:"float-card fc4",children:[e.jsx("div",{className:"fc-dot",style:{background:"#00d4c8"}})," 📊 Custom workflow"]})]}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"float-card fc1",children:[e.jsx("div",{className:"fc-dot",style:{background:"#10b981"}})," 🚀 Free 14-day trial"]}),e.jsxs("div",{className:"float-card fc2",children:[e.jsx("div",{className:"fc-dot",style:{background:"#6c47ff"}})," ✨ No credit card"]}),e.jsxs("div",{className:"float-card fc3",children:[e.jsx("div",{className:"fc-dot",style:{background:"#ff6bc6"}})," 🎯 Set up in 2 mins"]}),e.jsxs("div",{className:"float-card fc4",children:[e.jsx("div",{className:"fc-dot",style:{background:"#00d4c8"}})," 💼 Hire top 1% talent"]})]}),e.jsxs("div",{className:"glass-card",children:[e.jsxs(m,{to:"/",className:"logo-wrap",style:{textDecoration:"none",color:"inherit"},children:[e.jsxs("div",{className:"logo-orbit",children:[e.jsx("div",{className:"logo-orbit-ring"}),e.jsx("div",{className:"logo-box",style:{background:"none",boxShadow:"none"},children:e.jsx("img",{src:"/hybent_logo.webp",alt:"Hybent Logo",style:{width:"38px",height:"38px",objectFit:"contain"}})})]}),e.jsx("img",{src:"/hybent_wordmark_dark.webp",alt:"HYBENT",className:"wordmark-image wordmark-dark",style:{height:"22px"}}),e.jsx("img",{src:"/hybent_wordmark_light.webp",alt:"HYBENT",className:"wordmark-image wordmark-light",style:{height:"22px"}})]}),g?e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("div",{className:"sent-icon",children:e.jsx(_,{size:28,style:{color:"#10b981"}})}),e.jsx("h1",{className:"form-h1",style:{marginBottom:10},children:r?"Demo Requested!":"Request Received!"}),e.jsx("p",{className:"form-h2",children:r?"Thank you for scheduling a demo. Our team will reach out to you within 24 hours to set up your session.":"Thank you for your interest in Hybent Hiring. Our team will reach out to you shortly to get your workspace ready."}),e.jsx("button",{className:"btn-submit",type:"button",onClick:()=>p("/products/hiring"),style:{marginTop:24},children:"Return Home"})]}):e.jsxs(e.Fragment,{children:[e.jsx("h1",{className:"form-h1",children:r?"Book a Demo":"Get early access."}),e.jsx("p",{className:"form-h2",children:r?"Experience the power of Hybent Hiring AI. Schedule a personalized walkthrough with our team.":"Fill in your details and we'll get back to you within 24 hours to set up your account."}),l&&e.jsxs("div",{className:"server-err",children:[e.jsx(S,{size:14,className:"inline mr-2"}),l]}),e.jsxs("form",{onSubmit:h(u),children:[e.jsxs("div",{className:"field-box",children:[e.jsx("label",{className:"field-label",children:"Full Name"}),e.jsx("input",{type:"text",placeholder:"Jane Smith",className:"input-ctrl",...s("full_name"),disabled:a,style:{border:t.full_name?"1.5px solid #ef4444":"",opacity:a?.7:1,cursor:a?"not-allowed":"text"}}),t.full_name&&e.jsx("div",{className:"error-txt",children:t.full_name.message})]}),e.jsxs("div",{className:"field-box",children:[e.jsx("label",{className:"field-label",children:"Work Email"}),e.jsx("input",{type:"email",placeholder:"jane@company.com",className:"input-ctrl",...s("email"),disabled:a,style:{border:t.email?"1.5px solid #ef4444":"",opacity:a?.7:1,cursor:a?"not-allowed":"text"}}),t.email&&e.jsx("div",{className:"error-txt",children:t.email.message})]}),e.jsxs("div",{className:"field-box",children:[e.jsx("label",{className:"field-label",children:"Organization Name"}),e.jsx("input",{type:"text",placeholder:"Acme Corp",className:"input-ctrl",...s("organization_name"),disabled:a,style:{border:t.organization_name?"1.5px solid #ef4444":"",opacity:a?.7:1,cursor:a?"not-allowed":"text"}}),t.organization_name&&e.jsx("div",{className:"error-txt",children:t.organization_name.message})]}),e.jsx("div",{style:{height:8}}),e.jsx("button",{className:"btn-submit",type:"submit",disabled:a,children:a?e.jsxs(e.Fragment,{children:[e.jsxs("svg",{className:"animate-spin",style:{width:16,height:16},fill:"none",viewBox:"0 0 24 24",children:[e.jsx("circle",{style:{opacity:.25},cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4"}),e.jsx("path",{style:{opacity:.75},fill:"currentColor",d:"M4 12a8 8 0 018-8v8H4z"})]}),"Sending..."]}):e.jsxs(e.Fragment,{children:[r?"Book Demo":"Create Account"," ",e.jsx(f,{size:16,className:"ml-1 inline"})]})})]}),e.jsxs("div",{className:"foot-note",style:{pointerEvents:a?"none":"auto",opacity:a?.6:1},children:["Already have an account? ",e.jsxs(m,{to:"/login",children:["Sign In ",e.jsx(f,{size:14,className:"ml-1 inline"})]})]}),e.jsxs("p",{className:"foot-note",style:{fontSize:"11px",marginTop:"24px",opacity:.8,pointerEvents:a?"none":"auto"},children:["By clicking ",r?"Book Demo":"Create Account",", you agree to our ",e.jsx("a",{href:"#",target:"_blank",rel:"noreferrer",children:"Terms of Service"}),"."]})]})]})]})}export{P as default};
