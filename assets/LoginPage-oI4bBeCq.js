import{j as e,o as H,s as I}from"./vendor-utils-DrKH1fKA.js";import{u as W,r as i}from"./vendor-react-BM2WfUpP.js";import{u as M,t as q}from"./zod-BNvP6qKf.js";import{a as C}from"./auth-cOoSm6Cx.js";import{u as D}from"./index-ByzFguu5.js";import{I as G,A as O,T as x,a as F,E as V,b as J}from"./vendor-ui-S2SPZItl.js";import"./axios-CtNRU1ov.js";const K=H({email:I().email("Enter a valid email"),password:I().min(1,"Password is required")});function ie(){const s=W(),{setTokens:A,isAuthenticated:m,user:n}=D(),[b,f]=i.useState(""),[Q,U]=i.useState("pass"),[h,B]=i.useState(!1),[u,_]=i.useState(!1),[g,p]=i.useState("login"),[d,y]=i.useState(""),[k,v]=i.useState(!1),[j,c]=i.useState(""),[w,T]=i.useState(null);i.useEffect(()=>{const a=sessionStorage.getItem("logout_reason");(a==="account_deleted"||a==="session_expired")&&(T(a),sessionStorage.removeItem("logout_reason"))},[]),i.useEffect(()=>{m&&n&&(n.role==="super_admin"?s("/super-admin"):n.role==="candidate"?s("/portal"):n.role==="interviewer"?s("/interviewer"):n.role==="admin"?s("/admin"):s("/recruiter"))},[m,n,s]);const{register:N,handleSubmit:Y,formState:{errors:l,isSubmitting:t}}=M({resolver:q(K)}),L=async a=>{var S,z,E,P;f("");try{const{data:r}=await C.login(a.email,a.password),o=r.user;A(r.access_token,r.refresh_token,o,u),(o==null?void 0:o.role)==="candidate"?s("/portal"):(o==null?void 0:o.role)==="interviewer"?s("/interviewer"):(o==null?void 0:o.role)==="admin"?s("/admin"):s("/recruiter")}catch(r){const o=((z=(S=r==null?void 0:r.response)==null?void 0:S.data)==null?void 0:z.message)||((P=(E=r==null?void 0:r.response)==null?void 0:E.data)==null?void 0:P.detail)||(r==null?void 0:r.message)||"Invalid email or password. Please try again.";f(o)}},R=async a=>{if(a.preventDefault(),c(""),!d||!/\S+@\S+\.\S+/.test(d)){c("Enter a valid email address");return}v(!0);try{await C.forgotPassword(d),p("forgot_sent")}catch{c("Something went wrong. Please try again.")}finally{v(!1)}};return e.jsxs("div",{className:"login-container",children:[e.jsx("style",{children:`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      font-family: 'Poppins', sans-serif;
      background: #fff;
    }
    :root[data-theme="dark"] .login-container {
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
    .logo-mark { width: 40px; height: 40px; background: linear-gradient(135deg, #6c47ff, #ff6bc6); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(108,71,255,.35); }
    .logo-text { font-family: 'Poppins', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -.5px; background: linear-gradient(135deg, #6c47ff, #ff6bc6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .form-h1 { font-family: 'Poppins', sans-serif; font-size: 26px; font-weight: 800; color: #1a1040; text-align: center; margin-bottom: 5px; letter-spacing: -.4px; }
    :root[data-theme="dark"] .form-h1 { color: var(--color-text-main, #ede9ff); }
    .form-h2 { font-size: 13px; color: #9689bb; text-align: center; margin-bottom: 30px; }
    :root[data-theme="dark"] .form-h2 { color: var(--text-mid, #6b6393); }
    .tabs-list { display: flex; background: rgba(108,71,255,.07); border-radius: 12px; padding: 4px; margin-bottom: 24px; }
    .tab-btn { flex: 1; padding: 9px; text-align: center; font-size: 13px; font-weight: 600; color: #9689bb; border-radius: 9px; cursor: pointer; transition: all .22s; border: none; background: transparent; }
    .tab-btn.active { background: #fff; color: #6c47ff; box-shadow: 0 2px 8px rgba(108,71,255,.15); }
    .field-box { margin-bottom: 14px; position: relative; }
    .field-label { display: block; font-size: 11px; font-weight: 700; color: #5a4e7a; letter-spacing: .7px; text-transform: uppercase; margin-bottom: 7px; text-align: left; }
    :root[data-theme="dark"] .field-label { color: var(--text-mid, #6b6393); }
    .input-ctrl { width: 100%; padding: 12px 16px; background: rgba(255,255,255,.8); border: 1.5px solid rgba(108,71,255,.14); border-radius: 12px; color: #1a1040; font-family: 'Poppins', sans-serif; font-size: 13px; outline: none; transition: all .2s; backdrop-filter: blur(8px); box-sizing: border-box; }
    :root[data-theme="dark"] .input-ctrl { background: rgba(31, 27, 54, 0.4); border-color: var(--color-border, #2e2855); color: var(--color-text-main, #ede9ff); }
    .input-ctrl:focus { border-color: #6c47ff; background: rgba(255,255,255,.95); box-shadow: 0 0 0 3px rgba(108,71,255,.1); }
    :root[data-theme="dark"] .input-ctrl:focus { border-color: var(--color-text-link, #a78bfa); }
    .input-ctrl::placeholder { color: #c4b9de; }
    .input-ctrl.with-toggle { padding-right: 44px; }
    .input-wrap { position: relative; }
    .eye-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #9689bb; padding: 4px; display: flex; align-items: center; justify-content: center; transition: color .2s; }
    .eye-btn:hover { color: #6c47ff; }
    .error-txt { margin-top: 4px; font-size: 11px; color: #ef4444; text-align: left; }
    .row-utils { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; font-size: 12px; }
    .remember-chk { display: flex; align-items: center; gap: 7px; color: #9689bb; cursor: pointer; }
    :root[data-theme="dark"] .remember-chk { color: var(--text-mid, #6b6393); }
    .forgot-link { color: #6c47ff; font-weight: 600; text-decoration: none; background: none; border: none; cursor: pointer; font-family: 'Poppins', sans-serif; font-size: 12px; padding: 0; }
    :root[data-theme="dark"] .forgot-link { color: var(--color-text-link, #a78bfa); }
    .forgot-link:hover { text-decoration: underline; }
    .btn-submit { width: 100%; padding: 13px; border-radius: 13px; background: linear-gradient(135deg, var(--violet, #6c47ff), var(--brand2, #9b6bff)); color: #fff; font-family: 'Poppins', sans-serif; font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: all .25s; box-shadow: 0 8px 24px rgba(108,71,255,.38), 0 1px 0 rgba(255,255,255,.2) inset; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-submit:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(108,71,255,.5); }
    .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
    .btn-back { background: none; border: none; cursor: pointer; color: #9689bb; font-size: 12px; font-weight: 600; font-family: 'Poppins', sans-serif; display: flex; align-items: center; gap: 5px; padding: 0; margin-bottom: 20px; transition: color .2s; }
    :root[data-theme="dark"] .btn-back { color: var(--text-mid, #6b6393); }
    .btn-back:hover { color: #6c47ff; }
    :root[data-theme="dark"] .btn-back:hover { color: var(--color-text-link, #a78bfa); }
    .or-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; font-size: 11px; color: #c4b9de; font-weight: 600; }
    .or-divider::before, .or-divider::after { content: ''; flex: 1; height: 1px; background: rgba(108,71,255,.1); }
    .socials-grid { display: flex; gap: 10px; }
    .social-btn { flex: 1; padding: 11px; border-radius: 12px; border: 1.5px solid rgba(108,71,255,.15); background: rgba(255,255,255,.7); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; font-weight: 600; color: #5a4e7a; transition: all .2s; backdrop-filter: blur(8px); }
    .social-btn:hover { border-color: rgba(108,71,255,.4); background: rgba(255,255,255,.9); transform: translateY(-1px); }
    .foot-note { text-align: center; margin-top: 20px; font-size: 12px; color: #9689bb; }
    :root[data-theme="dark"] .foot-note { color: var(--text-mid, #6b6393); }
    .foot-note a { color: #6c47ff; font-weight: 700; text-decoration: none; }
    :root[data-theme="dark"] .foot-note a { color: var(--color-text-link, #a78bfa); }
    .server-err { margin-bottom: 20px; padding: 12px; border-radius: 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; font-size: 13px; text-align: left; }
    .sent-icon { width: 64px; height: 64px; border-radius: 20px; background: linear-gradient(135deg, rgba(108,71,255,.12), rgba(108,71,255,.06)); border: 1px solid rgba(108,71,255,.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    @media (max-width: 640px) { .glass-card { width: 90%; padding: 32px 24px; } .float-card { display: none; } }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `}),e.jsxs("div",{className:"aurora",children:[e.jsx("div",{className:"aura a1"}),e.jsx("div",{className:"aura a2"}),e.jsx("div",{className:"aura a3"}),e.jsx("div",{className:"aura a4"})]}),e.jsxs("div",{className:"float-card fc1",children:[e.jsx("div",{className:"fc-dot",style:{background:"#10b981"}})," 24 shortlisted today"]}),e.jsxs("div",{className:"float-card fc2",children:[e.jsx("div",{className:"fc-dot",style:{background:"#6c47ff"}})," AI scoring live"]}),e.jsxs("div",{className:"float-card fc3",children:[e.jsx("div",{className:"fc-dot",style:{background:"#ff6bc6"}})," 3 interviews scheduled"]}),e.jsxs("div",{className:"float-card fc4",children:[e.jsx("div",{className:"fc-dot",style:{background:"#00d4c8"}})," 97% match accuracy"]}),e.jsxs("div",{className:"glass-card",children:[e.jsxs("div",{className:"logo-wrap",children:[e.jsxs("div",{className:"logo-orbit",children:[e.jsx("div",{className:"logo-orbit-ring"}),e.jsx("div",{className:"logo-box",children:e.jsxs("svg",{width:"22",height:"22",viewBox:"0 0 22 22",fill:"none",children:[e.jsx("rect",{x:"2",y:"3",width:"4",height:"16",rx:"2",fill:"white",opacity:"0.95"}),e.jsx("rect",{x:"16",y:"3",width:"4",height:"16",rx:"2",fill:"white",opacity:"0.95"}),e.jsx("rect",{x:"2",y:"9",width:"18",height:"4",rx:"2",fill:"white",opacity:"0.95"})]})})]}),e.jsx("span",{className:"logo-wordmark lwl",style:{fontSize:"22px"},children:"Hybent Hiring"})]}),g==="forgot_sent"||g==="magic_sent"?e.jsxs("div",{style:{textAlign:"center"},children:[e.jsx("div",{className:"sent-icon",children:e.jsx(G,{size:28,className:"text-[#6c47ff]"})}),e.jsx("h1",{className:"form-h1",style:{marginBottom:10},children:"Check your inbox"}),e.jsxs("p",{className:"form-h2",style:{marginBottom:32},children:["We sent a reset link to ",e.jsx("strong",{style:{color:"#1a1040"},children:d}),".",e.jsx("br",{}),"Link expires in 30 minutes."]}),e.jsx("button",{className:"btn-submit",type:"button",onClick:()=>{p("login"),y("")},children:"Back to Sign In"})]}):g==="forgot"?e.jsxs("div",{children:[e.jsxs("button",{className:"btn-back",onClick:()=>{p("login"),c("")},children:[e.jsx(O,{size:16}),"Back to Sign In"]}),e.jsx("h1",{className:"form-h1",children:"Forgot password?"}),e.jsx("p",{className:"form-h2",style:{marginBottom:28},children:"Enter your email and we'll send a reset link."}),j&&e.jsxs("div",{className:"server-err",children:[e.jsx(x,{size:14,className:"inline mr-2"}),j]}),e.jsxs("form",{onSubmit:R,children:[e.jsxs("div",{className:"field-box",children:[e.jsx("label",{className:"field-label",children:"Email"}),e.jsx("input",{type:"email",placeholder:"you@company.com",className:"input-ctrl",value:d,onChange:a=>y(a.target.value),autoFocus:!0})]}),e.jsx("div",{style:{height:8}}),e.jsx("button",{className:"btn-submit",type:"submit",disabled:k,children:k?e.jsxs(e.Fragment,{children:[e.jsxs("svg",{className:"animate-spin",style:{width:16,height:16},fill:"none",viewBox:"0 0 24 24",children:[e.jsx("circle",{style:{opacity:.25},cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4"}),e.jsx("path",{style:{opacity:.75},fill:"currentColor",d:"M4 12a8 8 0 018-8v8H4z"})]}),"Sending..."]}):e.jsxs(e.Fragment,{children:["Send Reset Link ",e.jsx(F,{size:16,className:"ml-1 inline"})]})})]})]}):e.jsxs(e.Fragment,{children:[e.jsx("h1",{className:"form-h1",children:"Good to see you"}),e.jsx("p",{className:"form-h2",children:"Sign in to your hiring dashboard"}),w==="account_deleted"&&e.jsxs("div",{style:{display:"flex",alignItems:"flex-start",gap:10,background:"rgba(239,68,68,0.08)",border:"1.5px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"12px 14px",marginBottom:16,color:"#dc2626",fontSize:13,fontWeight:500,lineHeight:1.5},children:[e.jsx(x,{size:16,style:{marginTop:1,flexShrink:0}}),e.jsxs("span",{children:[e.jsx("strong",{children:"Your account has been removed."}),e.jsx("br",{}),"You have been logged out because your account was deleted by an administrator. Please contact your admin if this was a mistake."]})]}),w==="session_expired"&&e.jsxs("div",{style:{display:"flex",alignItems:"flex-start",gap:10,background:"rgba(245,158,11,0.08)",border:"1.5px solid rgba(245,158,11,0.3)",borderRadius:12,padding:"12px 14px",marginBottom:16,color:"#b45309",fontSize:13,fontWeight:500,lineHeight:1.5},children:[e.jsx(x,{size:16,style:{marginTop:1,flexShrink:0}}),e.jsxs("span",{children:[e.jsx("strong",{children:"Session expired."})," Please sign in again."]})]}),b&&e.jsxs("div",{className:"server-err",children:[e.jsx(x,{size:14,className:"inline mr-2"}),b]}),e.jsxs("form",{onSubmit:Y(L),children:[e.jsxs("div",{className:"field-box",children:[e.jsx("label",{className:"field-label",children:"Email"}),e.jsx("input",{type:"email",placeholder:"you@company.com",className:"input-ctrl",...N("email"),disabled:t,style:{border:l.email?"1.5px solid #ef4444":"",opacity:t?.7:1,cursor:t?"not-allowed":"text"}}),l.email&&e.jsx("div",{className:"error-txt",children:l.email.message})]}),e.jsxs("div",{className:"field-box",children:[e.jsx("label",{className:"field-label",children:"Password"}),e.jsxs("div",{className:"input-wrap",children:[e.jsx("input",{type:h?"text":"password",placeholder:"••••••••••",className:"input-ctrl with-toggle",...N("password"),disabled:t,style:{border:l.password?"1.5px solid #ef4444":"",opacity:t?.7:1,cursor:t?"not-allowed":"text"}}),e.jsx("button",{type:"button",className:"eye-btn",onClick:()=>B(a=>!a),tabIndex:-1,disabled:t,children:h?e.jsx(V,{size:16}):e.jsx(J,{size:16})})]}),l.password&&e.jsx("div",{className:"error-txt",children:l.password.message})]}),e.jsxs("div",{className:"row-utils",children:[e.jsxs("label",{className:"remember-chk",style:{opacity:t?.6:1,cursor:t?"not-allowed":"pointer"},children:[e.jsx("input",{type:"checkbox",style:{accentColor:"#6c47ff"},disabled:t,checked:u,onChange:a=>_(a.target.checked)})," Remember me"]}),e.jsx("button",{type:"button",className:"forgot-link",disabled:t,style:{opacity:t?.6:1,cursor:t?"not-allowed":"pointer"},onClick:()=>{p("forgot"),f(""),c("")},children:"Forgot password?"})]}),e.jsx("button",{className:"btn-submit",type:"submit",disabled:t,children:t?e.jsxs(e.Fragment,{children:[e.jsxs("svg",{className:"animate-spin",style:{width:16,height:16},fill:"none",viewBox:"0 0 24 24",children:[e.jsx("circle",{style:{opacity:.25},cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4"}),e.jsx("path",{style:{opacity:.75},fill:"currentColor",d:"M4 12a8 8 0 018-8v8H4z"})]}),"Signing In..."]}):e.jsxs(e.Fragment,{children:["Sign In ",e.jsx(F,{size:16,className:"ml-1 inline"})]})})]})]})]})]})}export{ie as default};
