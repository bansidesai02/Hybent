import{r as m}from"./vendor-react-D1UjmWoG.js";import{j as X}from"./vendor-utils-5jnbnV8p.js";let Eo={data:""},Ro=t=>{if(typeof window=="object"){let e=(t?t.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return e.nonce=window.__nonce__,e.parentNode||(t||document.head).appendChild(e),e.firstChild}return t||Eo},Lo=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,No=/\/\*[^]*?\*\/|  +/g,_n=/\n+/g,et=(t,e)=>{let n="",s="",i="";for(let r in t){let o=t[r];r[0]=="@"?r[1]=="i"?n=r+" "+o+";":s+=r[1]=="f"?et(o,r):r+"{"+et(o,r[1]=="k"?"":e)+"}":typeof o=="object"?s+=et(o,e?e.replace(/([^,])+/g,a=>r.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,c=>/&/.test(c)?c.replace(/&/g,a):a?a+" "+c:c)):r):o!=null&&(r=/^--/.test(r)?r:r.replace(/[A-Z]/g,"-$&").toLowerCase(),i+=et.p?et.p(r,o):r+":"+o+";")}return n+(e&&i?e+"{"+i+"}":i)+s},G={},Ws=t=>{if(typeof t=="object"){let e="";for(let n in t)e+=n+Ws(t[n]);return e}return t},jo=(t,e,n,s,i)=>{let r=Ws(t),o=G[r]||(G[r]=(c=>{let l=0,u=11;for(;l<c.length;)u=101*u+c.charCodeAt(l++)>>>0;return"go"+u})(r));if(!G[o]){let c=r!==t?t:(l=>{let u,h,d=[{}];for(;u=Lo.exec(l.replace(No,""));)u[4]?d.shift():u[3]?(h=u[3].replace(_n," ").trim(),d.unshift(d[0][h]=d[0][h]||{})):d[0][u[1]]=u[2].replace(_n," ").trim();return d[0]})(t);G[o]=et(i?{["@keyframes "+o]:c}:c,n?"":"."+o)}let a=n&&G.g?G.g:null;return n&&(G.g=G[o]),((c,l,u,h)=>{h?l.data=l.data.replace(h,c):l.data.indexOf(c)===-1&&(l.data=u?c+l.data:l.data+c)})(G[o],e,s,a),o},$o=(t,e,n)=>t.reduce((s,i,r)=>{let o=e[r];if(o&&o.call){let a=o(n),c=a&&a.props&&a.props.className||/^go/.test(a)&&a;o=c?"."+c:a&&typeof a=="object"?a.props?"":et(a,""):a===!1?"":a}return s+i+(o??"")},"");function ie(t){let e=this||{},n=t.call?t(e.p):t;return jo(n.unshift?n.raw?$o(n,[].slice.call(arguments,1),e.p):n.reduce((s,i)=>Object.assign(s,i&&i.call?i(e.p):i),{}):n,Ro(e.target),e.g,e.o,e.k)}let Gs,Ce,Ve;ie.bind({g:1});let Q=ie.bind({k:1});function Fo(t,e,n,s){et.p=e,Gs=t,Ce=n,Ve=s}function it(t,e){let n=this||{};return function(){let s=arguments;function i(r,o){let a=Object.assign({},r),c=a.className||i.className;n.p=Object.assign({theme:Ce&&Ce()},a),n.o=/ *go\d+/.test(c),a.className=ie.apply(n,s)+(c?" "+c:"");let l=t;return t[0]&&(l=a.as||t,delete a.as),Ve&&l[0]&&Ve(a),Gs(l,a)}return i}}var Bo=t=>typeof t=="function",Yt=(t,e)=>Bo(t)?t(e):t,Oo=(()=>{let t=0;return()=>(++t).toString()})(),Xs=(()=>{let t;return()=>{if(t===void 0&&typeof window<"u"){let e=matchMedia("(prefers-reduced-motion: reduce)");t=!e||e.matches}return t}})(),Io=20,Ke="default",Ys=(t,e)=>{let{toastLimit:n}=t.settings;switch(e.type){case 0:return{...t,toasts:[e.toast,...t.toasts].slice(0,n)};case 1:return{...t,toasts:t.toasts.map(o=>o.id===e.toast.id?{...o,...e.toast}:o)};case 2:let{toast:s}=e;return Ys(t,{type:t.toasts.find(o=>o.id===s.id)?1:0,toast:s});case 3:let{toastId:i}=e;return{...t,toasts:t.toasts.map(o=>o.id===i||i===void 0?{...o,dismissed:!0,visible:!1}:o)};case 4:return e.toastId===void 0?{...t,toasts:[]}:{...t,toasts:t.toasts.filter(o=>o.id!==e.toastId)};case 5:return{...t,pausedAt:e.time};case 6:let r=e.time-(t.pausedAt||0);return{...t,pausedAt:void 0,toasts:t.toasts.map(o=>({...o,pauseDuration:o.pauseDuration+r}))}}},Kt=[],Zs={toasts:[],pausedAt:void 0,settings:{toastLimit:Io}},q={},Qs=(t,e=Ke)=>{q[e]=Ys(q[e]||Zs,t),Kt.forEach(([n,s])=>{n===e&&s(q[e])})},Js=t=>Object.keys(q).forEach(e=>Qs(t,e)),zo=t=>Object.keys(q).find(e=>q[e].toasts.some(n=>n.id===t)),oe=(t=Ke)=>e=>{Qs(e,t)},Uo={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},qo=(t={},e=Ke)=>{let[n,s]=m.useState(q[e]||Zs),i=m.useRef(q[e]);m.useEffect(()=>(i.current!==q[e]&&s(q[e]),Kt.push([e,s]),()=>{let o=Kt.findIndex(([a])=>a===e);o>-1&&Kt.splice(o,1)}),[e]);let r=n.toasts.map(o=>{var a,c,l;return{...t,...t[o.type],...o,removeDelay:o.removeDelay||((a=t[o.type])==null?void 0:a.removeDelay)||(t==null?void 0:t.removeDelay),duration:o.duration||((c=t[o.type])==null?void 0:c.duration)||(t==null?void 0:t.duration)||Uo[o.type],style:{...t.style,...(l=t[o.type])==null?void 0:l.style,...o.style}}});return{...n,toasts:r}},Ho=(t,e="blank",n)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:e,ariaProps:{role:"status","aria-live":"polite"},message:t,pauseDuration:0,...n,id:(n==null?void 0:n.id)||Oo()}),jt=t=>(e,n)=>{let s=Ho(e,t,n);return oe(s.toasterId||zo(s.id))({type:2,toast:s}),s.id},E=(t,e)=>jt("blank")(t,e);E.error=jt("error");E.success=jt("success");E.loading=jt("loading");E.custom=jt("custom");E.dismiss=(t,e)=>{let n={type:3,toastId:t};e?oe(e)(n):Js(n)};E.dismissAll=t=>E.dismiss(void 0,t);E.remove=(t,e)=>{let n={type:4,toastId:t};e?oe(e)(n):Js(n)};E.removeAll=t=>E.remove(void 0,t);E.promise=(t,e,n)=>{let s=E.loading(e.loading,{...n,...n==null?void 0:n.loading});return typeof t=="function"&&(t=t()),t.then(i=>{let r=e.success?Yt(e.success,i):void 0;return r?E.success(r,{id:s,...n,...n==null?void 0:n.success}):E.dismiss(s),i}).catch(i=>{let r=e.error?Yt(e.error,i):void 0;r?E.error(r,{id:s,...n,...n==null?void 0:n.error}):E.dismiss(s)}),t};var Ko=1e3,Wo=(t,e="default")=>{let{toasts:n,pausedAt:s}=qo(t,e),i=m.useRef(new Map).current,r=m.useCallback((h,d=Ko)=>{if(i.has(h))return;let p=setTimeout(()=>{i.delete(h),o({type:4,toastId:h})},d);i.set(h,p)},[]);m.useEffect(()=>{if(s)return;let h=Date.now(),d=n.map(p=>{if(p.duration===1/0)return;let y=(p.duration||0)+p.pauseDuration-(h-p.createdAt);if(y<0){p.visible&&E.dismiss(p.id);return}return setTimeout(()=>E.dismiss(p.id,e),y)});return()=>{d.forEach(p=>p&&clearTimeout(p))}},[n,s,e]);let o=m.useCallback(oe(e),[e]),a=m.useCallback(()=>{o({type:5,time:Date.now()})},[o]),c=m.useCallback((h,d)=>{o({type:1,toast:{id:h,height:d}})},[o]),l=m.useCallback(()=>{s&&o({type:6,time:Date.now()})},[s,o]),u=m.useCallback((h,d)=>{let{reverseOrder:p=!1,gutter:y=8,defaultPosition:g}=d||{},v=n.filter(k=>(k.position||g)===(h.position||g)&&k.height),x=v.findIndex(k=>k.id===h.id),M=v.filter((k,T)=>T<x&&k.visible).length;return v.filter(k=>k.visible).slice(...p?[M+1]:[0,M]).reduce((k,T)=>k+(T.height||0)+y,0)},[n]);return m.useEffect(()=>{n.forEach(h=>{if(h.dismissed)r(h.id,h.removeDelay);else{let d=i.get(h.id);d&&(clearTimeout(d),i.delete(h.id))}})},[n,r]),{toasts:n,handlers:{updateHeight:c,startPause:a,endPause:l,calculateOffset:u}}},Go=Q`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,Xo=Q`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,Yo=Q`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,Zo=it("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${t=>t.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${Go} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${Xo} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${t=>t.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${Yo} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,Qo=Q`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,Jo=it("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${t=>t.secondary||"#e0e0e0"};
  border-right-color: ${t=>t.primary||"#616161"};
  animation: ${Qo} 1s linear infinite;
`,tr=Q`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,er=Q`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,nr=it("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${t=>t.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${tr} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${er} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${t=>t.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,sr=it("div")`
  position: absolute;
`,ir=it("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,or=Q`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,rr=it("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${or} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,ar=({toast:t})=>{let{icon:e,type:n,iconTheme:s}=t;return e!==void 0?typeof e=="string"?m.createElement(rr,null,e):e:n==="blank"?null:m.createElement(ir,null,m.createElement(Jo,{...s}),n!=="loading"&&m.createElement(sr,null,n==="error"?m.createElement(Zo,{...s}):m.createElement(nr,{...s})))},cr=t=>`
0% {transform: translate3d(0,${t*-200}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,lr=t=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${t*-150}%,-1px) scale(.6); opacity:0;}
`,ur="0%{opacity:0;} 100%{opacity:1;}",hr="0%{opacity:1;} 100%{opacity:0;}",dr=it("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,fr=it("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,pr=(t,e)=>{let n=t.includes("top")?1:-1,[s,i]=Xs()?[ur,hr]:[cr(n),lr(n)];return{animation:e?`${Q(s)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${Q(i)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},mr=m.memo(({toast:t,position:e,style:n,children:s})=>{let i=t.height?pr(t.position||e||"top-center",t.visible):{opacity:0},r=m.createElement(ar,{toast:t}),o=m.createElement(fr,{...t.ariaProps},Yt(t.message,t));return m.createElement(dr,{className:t.className,style:{...i,...n,...t.style}},typeof s=="function"?s({icon:r,message:o}):m.createElement(m.Fragment,null,r,o))});Fo(m.createElement);var yr=({id:t,className:e,style:n,onHeightUpdate:s,children:i})=>{let r=m.useCallback(o=>{if(o){let a=()=>{let c=o.getBoundingClientRect().height;s(t,c)};a(),new MutationObserver(a).observe(o,{subtree:!0,childList:!0,characterData:!0})}},[t,s]);return m.createElement("div",{ref:r,className:e,style:n},i)},gr=(t,e)=>{let n=t.includes("top"),s=n?{top:0}:{bottom:0},i=t.includes("center")?{justifyContent:"center"}:t.includes("right")?{justifyContent:"flex-end"}:{};return{left:0,right:0,display:"flex",position:"absolute",transition:Xs()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${e*(n?1:-1)}px)`,...s,...i}},vr=ie`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,It=16,O1=({reverseOrder:t,position:e="top-center",toastOptions:n,gutter:s,children:i,toasterId:r,containerStyle:o,containerClassName:a})=>{let{toasts:c,handlers:l}=Wo(n,r);return m.createElement("div",{"data-rht-toaster":r||"",style:{position:"fixed",zIndex:9999,top:It,left:It,right:It,bottom:It,pointerEvents:"none",...o},className:a,onMouseEnter:l.startPause,onMouseLeave:l.endPause},c.map(u=>{let h=u.position||e,d=l.calculateOffset(u,{reverseOrder:t,gutter:s,defaultPosition:e}),p=gr(h,d);return m.createElement(yr,{id:u.id,key:u.id,onHeightUpdate:l.updateHeight,className:u.visible?vr:"",style:p},u.type==="custom"?Yt(u.message,u):i?i(u):m.createElement(mr,{toast:u,position:h}))}))},I1=E;/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ti=(...t)=>t.filter((e,n,s)=>!!e&&e.trim()!==""&&s.indexOf(e)===n).join(" ").trim();/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xr=t=>t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const kr=t=>t.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,n,s)=>s?s.toUpperCase():n.toLowerCase());/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Dn=t=>{const e=kr(t);return e.charAt(0).toUpperCase()+e.slice(1)};/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var pe={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Mr=t=>{for(const e in t)if(e.startsWith("aria-")||e==="role"||e==="title")return!0;return!1},br=m.createContext({}),wr=()=>m.useContext(br),Tr=m.forwardRef(({color:t,size:e,strokeWidth:n,absoluteStrokeWidth:s,className:i="",children:r,iconNode:o,...a},c)=>{const{size:l=24,strokeWidth:u=2,absoluteStrokeWidth:h=!1,color:d="currentColor",className:p=""}=wr()??{},y=s??h?Number(n??u)*24/Number(e??l):n??u;return m.createElement("svg",{ref:c,...pe,width:e??l??pe.width,height:e??l??pe.height,stroke:t??d,strokeWidth:y,className:ti("lucide",p,i),...!r&&!Mr(a)&&{"aria-hidden":"true"},...a},[...o.map(([g,v])=>m.createElement(g,v)),...Array.isArray(r)?r:[r]])});/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=(t,e)=>{const n=m.forwardRef(({className:s,...i},r)=>m.createElement(Tr,{ref:r,iconNode:e,className:ti(`lucide-${xr(Dn(t))}`,`lucide-${t}`,s),...i}));return n.displayName=Dn(t),n};/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pr=[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]],z1=f("activity",Pr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ar=[["rect",{width:"20",height:"5",x:"2",y:"3",rx:"1",key:"1wp1u1"}],["path",{d:"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8",key:"1s80jp"}],["path",{d:"M10 12h4",key:"a56b0p"}]],U1=f("archive",Ar);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sr=[["path",{d:"M12 5v14",key:"s699le"}],["path",{d:"m19 12-7 7-7-7",key:"1idqje"}]],q1=f("arrow-down",Sr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Cr=[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]],H1=f("arrow-left",Cr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vr=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]],K1=f("arrow-right",Vr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _r=[["path",{d:"m21 16-4 4-4-4",key:"f6ql7i"}],["path",{d:"M17 20V4",key:"1ejh1v"}],["path",{d:"m3 8 4-4 4 4",key:"11wl7u"}],["path",{d:"M7 4v16",key:"1glfcx"}]],W1=f("arrow-up-down",_r);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Dr=[["path",{d:"M7 7h10v10",key:"1tivn9"}],["path",{d:"M7 17 17 7",key:"1vkiza"}]],G1=f("arrow-up-right",Dr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Er=[["path",{d:"m5 12 7-7 7 7",key:"hav0vg"}],["path",{d:"M12 19V5",key:"x0mq9r"}]],X1=f("arrow-up",Er);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Rr=[["path",{d:"m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526",key:"1yiouv"}],["circle",{cx:"12",cy:"8",r:"6",key:"1vp47v"}]],Y1=f("award",Rr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Lr=[["path",{d:"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",key:"3c2336"}],["path",{d:"M12 7v10",key:"jspqdw"}],["path",{d:"M15.4 10a4 4 0 1 0 0 4",key:"2eqtx8"}]],Z1=f("badge-cent",Lr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Nr=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M4.929 4.929 19.07 19.071",key:"196cmz"}]],Q1=f("ban",Nr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const jr=[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]],J1=f("banknote",jr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $r=[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",key:"11g9vi"}]],tf=f("bell",$r);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fr=[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]],ef=f("book-open",Fr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Br=[["path",{d:"M12 8V4H8",key:"hb8ula"}],["rect",{width:"16",height:"12",x:"4",y:"8",rx:"2",key:"enze0r"}],["path",{d:"M2 14h2",key:"vft8re"}],["path",{d:"M20 14h2",key:"4cs60a"}],["path",{d:"M15 13v2",key:"1xurst"}],["path",{d:"M9 13v2",key:"rq6x2g"}]],nf=f("bot",Br);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Or=[["path",{d:"M12 18V5",key:"adv99a"}],["path",{d:"M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4",key:"1e3is1"}],["path",{d:"M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5",key:"1gqd8o"}],["path",{d:"M17.997 5.125a4 4 0 0 1 2.526 5.77",key:"iwvgf7"}],["path",{d:"M18 18a4 4 0 0 0 2-7.464",key:"efp6ie"}],["path",{d:"M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517",key:"1gq6am"}],["path",{d:"M6 18a4 4 0 0 1-2-7.464",key:"k1g0md"}],["path",{d:"M6.003 5.125a4 4 0 0 0-2.526 5.77",key:"q97ue3"}]],sf=f("brain",Or);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ir=[["path",{d:"M12 12h.01",key:"1mp3jc"}],["path",{d:"M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",key:"1ksdt3"}],["path",{d:"M22 13a18.15 18.15 0 0 1-20 0",key:"12hx5q"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],of=f("briefcase-business",Ir);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zr=[["path",{d:"M12 11v4",key:"a6ujw6"}],["path",{d:"M14 13h-4",key:"1pl8zg"}],["path",{d:"M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",key:"1ksdt3"}],["path",{d:"M18 6v14",key:"1mu4gy"}],["path",{d:"M6 6v14",key:"1s15cj"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],rf=f("briefcase-medical",zr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ur=[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],af=f("briefcase",Ur);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qr=[["path",{d:"M10 12h4",key:"a56b0p"}],["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",key:"secmi2"}],["path",{d:"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",key:"16ra0t"}]],cf=f("building-2",qr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Hr=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"m9 16 2 2 4-4",key:"19s6y9"}]],lf=f("calendar-check",Hr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Kr=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"M8 14h.01",key:"6423bh"}],["path",{d:"M12 14h.01",key:"1etili"}],["path",{d:"M16 14h.01",key:"1gbofw"}],["path",{d:"M8 18h.01",key:"lrp35t"}],["path",{d:"M12 18h.01",key:"mhygvu"}],["path",{d:"M16 18h.01",key:"kzsmim"}]],uf=f("calendar-days",Kr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wr=[["path",{d:"M16 19h6",key:"xwg31i"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M19 16v6",key:"tddt3s"}],["path",{d:"M21 12.598V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.5",key:"1glfrc"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"M8 2v4",key:"1cmpym"}]],hf=f("calendar-plus",Wr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Gr=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]],df=f("calendar",Gr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xr=[["path",{d:"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z",key:"18u6gg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]],ff=f("camera",Xr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yr=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]],pf=f("chart-column",Yr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zr=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"m19 9-5 5-4-4-3 3",key:"2osh9i"}]],mf=f("chart-line",Zr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qr=[["path",{d:"M5 21v-6",key:"1hz6c0"}],["path",{d:"M12 21V3",key:"1lcnhd"}],["path",{d:"M19 21V9",key:"unv183"}]],yf=f("chart-no-axes-column",Qr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Jr=[["path",{d:"M18 6 7 17l-5-5",key:"116fxf"}],["path",{d:"m22 10-7.5 7.5L13 16",key:"ke71qq"}]],gf=f("check-check",Jr);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ta=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],vf=f("check",ta);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ea=[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]],xf=f("chevron-down",ea);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const na=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],kf=f("chevron-left",na);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sa=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],Mf=f("chevron-right",sa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ia=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],bf=f("chevron-up",ia);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oa=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],wf=f("circle-alert",oa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ra=[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]],Tf=f("circle-check-big",ra);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const aa=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],Pf=f("circle-check",aa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ca=[["path",{d:"M10.1 2.182a10 10 0 0 1 3.8 0",key:"5ilxe3"}],["path",{d:"M13.9 21.818a10 10 0 0 1-3.8 0",key:"11zvb9"}],["path",{d:"M17.609 3.721a10 10 0 0 1 2.69 2.7",key:"1iw5b2"}],["path",{d:"M2.182 13.9a10 10 0 0 1 0-3.8",key:"c0bmvh"}],["path",{d:"M20.279 17.609a10 10 0 0 1-2.7 2.69",key:"1ruxm7"}],["path",{d:"M21.818 10.1a10 10 0 0 1 0 3.8",key:"qkgqxc"}],["path",{d:"M3.721 6.391a10 10 0 0 1 2.7-2.69",key:"1mcia2"}],["path",{d:"M6.391 20.279a10 10 0 0 1-2.69-2.7",key:"1fvljs"}]],Af=f("circle-dashed",ca);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const la=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",key:"1u773s"}],["path",{d:"M12 17h.01",key:"p32p05"}]],Sf=f("circle-question-mark",la);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ua=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]],Cf=f("circle-x",ua);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ha=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],Vf=f("circle",ha);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const da=[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"m9 14 2 2 4-4",key:"df797q"}]],_f=f("clipboard-check",da);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fa=[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"M12 11h4",key:"1jrz19"}],["path",{d:"M12 16h4",key:"n85exb"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 16h.01",key:"18s6g9"}]],Df=f("clipboard-list",fa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pa=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6h4",key:"135r8i"}]],Ef=f("clock-3",pa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ma=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6l4 2",key:"mmk7yg"}]],Rf=f("clock",ma);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ya=[["path",{d:"M12 13v8",key:"1l5pq0"}],["path",{d:"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242",key:"1pljnt"}],["path",{d:"m8 17 4-4 4 4",key:"1quai1"}]],Lf=f("cloud-upload",ya);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ga=[["path",{d:"M13.744 17.736a6 6 0 1 1-7.48-7.48",key:"bq4yh3"}],["path",{d:"M15 6h1v4",key:"11y1tn"}],["path",{d:"m6.134 14.768.866-.5 2 3.464",key:"17snzx"}],["circle",{cx:"16",cy:"8",r:"6",key:"14bfc9"}]],Nf=f("coins",ga);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const va=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],jf=f("copy",va);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xa=[["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M17 20v2",key:"1rnc9c"}],["path",{d:"M17 2v2",key:"11trls"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M2 17h2",key:"7oei6x"}],["path",{d:"M2 7h2",key:"asdhe0"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"M20 17h2",key:"1fpfkl"}],["path",{d:"M20 7h2",key:"1o8tra"}],["path",{d:"M7 20v2",key:"4gnj0m"}],["path",{d:"M7 2v2",key:"1i4yhu"}],["rect",{x:"4",y:"4",width:"16",height:"16",rx:"2",key:"1vbyd7"}],["rect",{x:"8",y:"8",width:"8",height:"8",rx:"1",key:"z9xiuo"}]],$f=f("cpu",xa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ka=[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]],Ff=f("credit-card",ka);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ma=[["ellipse",{cx:"12",cy:"5",rx:"9",ry:"3",key:"msslwz"}],["path",{d:"M3 5V19A9 3 0 0 0 21 19V5",key:"1wlel7"}],["path",{d:"M3 12A9 3 0 0 0 21 12",key:"mv7ke4"}]],Bf=f("database",Ma);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ba=[["line",{x1:"12",x2:"12",y1:"2",y2:"22",key:"7eqyqh"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",key:"1b0p4s"}]],Of=f("dollar-sign",ba);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wa=[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]],If=f("download",wa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ta=[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"12",cy:"5",r:"1",key:"gxeob9"}],["circle",{cx:"12",cy:"19",r:"1",key:"lyex9k"}]],zf=f("ellipsis-vertical",Ta);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pa=[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"19",cy:"12",r:"1",key:"1wjl8i"}],["circle",{cx:"5",cy:"12",r:"1",key:"1pcz8c"}]],Uf=f("ellipsis",Pa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Aa=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]],qf=f("external-link",Aa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sa=[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],Hf=f("eye",Sa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ca=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M10 12.5 8 15l2 2.5",key:"1tg20x"}],["path",{d:"m14 12.5 2 2.5-2 2.5",key:"yinavb"}]],Kf=f("file-code",Ca);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Va=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M12 18v-6",key:"17g6i2"}],["path",{d:"m9 15 3 3 3-3",key:"1npd3o"}]],Wf=f("file-down",Va);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _a=[["path",{d:"M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z",key:"ukzhwg"}],["path",{d:"M14.487 7.858A1 1 0 0 1 14 7V2",key:"1klhew"}],["path",{d:"M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516",key:"rxaxab"}],["path",{d:"M8 18h1",key:"13wk12"}]],Gf=f("file-pen-line",_a);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Da=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["circle",{cx:"11.5",cy:"14.5",r:"2.5",key:"1bq0ko"}],["path",{d:"M13.3 16.3 15 18",key:"2quom7"}]],Xf=f("file-search",Da);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ea=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M8 13h2",key:"yr2amv"}],["path",{d:"M14 13h2",key:"un5t4a"}],["path",{d:"M8 17h2",key:"2yhykz"}],["path",{d:"M14 17h2",key:"10kma7"}]],Yf=f("file-spreadsheet",Ea);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ra=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]],Zf=f("file-text",Ra);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const La=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M11 18h2",key:"12mj7e"}],["path",{d:"M12 12v6",key:"3ahymv"}],["path",{d:"M9 13v-.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.5",key:"qbrxap"}]],Qf=f("file-type",La);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Na=[["path",{d:"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",key:"usdka0"}]],Jf=f("folder-open",Na);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ja=[["path",{d:"m12 14 4-4",key:"9kzdfg"}],["path",{d:"M3.34 19a10 10 0 1 1 17.32 0",key:"19p75a"}]],t0=f("gauge",ja);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $a=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]],e0=f("globe",$a);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fa=[["path",{d:"m11 17 2 2a1 1 0 1 0 3-3",key:"efffak"}],["path",{d:"m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4",key:"9pr0kb"}],["path",{d:"m21 3 1 11h-2",key:"1tisrp"}],["path",{d:"M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3",key:"1uvwmv"}],["path",{d:"M3 4h8",key:"1ep09j"}]],n0=f("handshake",Fa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ba=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]],s0=f("history",Ba);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oa=[["polyline",{points:"22 12 16 12 14 15 10 15 8 12 2 12",key:"o97t9d"}],["path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",key:"oot6mr"}]],i0=f("inbox",Oa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ia=[["path",{d:"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4",key:"g0fldk"}],["path",{d:"m21 2-9.6 9.6",key:"1j0ho8"}],["circle",{cx:"7.5",cy:"15.5",r:"5.5",key:"yqb3hr"}]],o0=f("key",Ia);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const za=[["path",{d:"M10 8h.01",key:"1r9ogq"}],["path",{d:"M12 12h.01",key:"1mp3jc"}],["path",{d:"M14 8h.01",key:"1primd"}],["path",{d:"M16 12h.01",key:"1l6xoz"}],["path",{d:"M18 8h.01",key:"emo2bl"}],["path",{d:"M6 8h.01",key:"x9i8wu"}],["path",{d:"M7 16h10",key:"wp8him"}],["path",{d:"M8 12h.01",key:"czm47f"}],["rect",{width:"20",height:"16",x:"2",y:"4",rx:"2",key:"18n3k1"}]],r0=f("keyboard",za);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ua=[["path",{d:"M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z",key:"1pdavp"}],["path",{d:"M20.054 15.987H3.946",key:"14rxg9"}]],a0=f("laptop",Ua);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qa=[["path",{d:"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",key:"zw3jo"}],["path",{d:"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12",key:"1wduqc"}],["path",{d:"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17",key:"kqbvx6"}]],c0=f("layers",qa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ha=[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1",key:"6d4xhi"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1",key:"nxv5o0"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}]],l0=f("layout-grid",Ha);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ka=[["path",{d:"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",key:"1gvzjb"}],["path",{d:"M9 18h6",key:"x1upvd"}],["path",{d:"M10 22h4",key:"ceow96"}]],u0=f("lightbulb",Ka);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wa=[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]],h0=f("link-2",Wa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ga=[["path",{d:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",key:"1cjeqo"}],["path",{d:"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",key:"19qd67"}]],d0=f("link",Ga);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xa=[["path",{d:"M3 5h.01",key:"18ugdj"}],["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M3 19h.01",key:"noohij"}],["path",{d:"M8 5h13",key:"1pao27"}],["path",{d:"M8 12h13",key:"1za7za"}],["path",{d:"M8 19h13",key:"m83p4d"}]],f0=f("list",Xa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ya=[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]],p0=f("loader-circle",Ya);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Za=[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]],m0=f("lock",Za);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qa=[["path",{d:"m16 17 5-5-5-5",key:"1bji2h"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}]],y0=f("log-out",Qa);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ja=[["path",{d:"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7",key:"132q7q"}],["rect",{x:"2",y:"4",width:"20",height:"16",rx:"2",key:"izxlao"}]],g0=f("mail",Ja);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const tc=[["path",{d:"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",key:"1r0f0z"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]],v0=f("map-pin",tc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ec=[["path",{d:"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",key:"169xi5"}],["path",{d:"M15 5.764v15",key:"1pn4in"}],["path",{d:"M9 3.236v15",key:"1uimfh"}]],x0=f("map",ec);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const nc=[["path",{d:"M4 5h16",key:"1tepv9"}],["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 19h16",key:"1djgab"}]],k0=f("menu",nc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sc=[["path",{d:"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719",key:"1sd12s"}]],M0=f("message-circle",sc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ic=[["path",{d:"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",key:"18887p"}]],b0=f("message-square",ic);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oc=[["path",{d:"M12 19v3",key:"npa21l"}],["path",{d:"M19 10v2a7 7 0 0 1-14 0v-2",key:"1vc78b"}],["rect",{x:"9",y:"2",width:"6",height:"13",rx:"3",key:"s6n7sd"}]],w0=f("mic",oc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rc=[["path",{d:"M5 12h14",key:"1ays0h"}]],T0=f("minus",rc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ac=[["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["line",{x1:"8",x2:"16",y1:"21",y2:"21",key:"1svkeh"}],["line",{x1:"12",x2:"12",y1:"17",y2:"21",key:"vw1qmm"}]],P0=f("monitor",ac);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const cc=[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]],A0=f("moon",cc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const lc=[["path",{d:"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",key:"e79jfc"}],["circle",{cx:"13.5",cy:"6.5",r:".5",fill:"currentColor",key:"1okk4w"}],["circle",{cx:"17.5",cy:"10.5",r:".5",fill:"currentColor",key:"f64h9f"}],["circle",{cx:"6.5",cy:"12.5",r:".5",fill:"currentColor",key:"qy21gx"}],["circle",{cx:"8.5",cy:"7.5",r:".5",fill:"currentColor",key:"fotxhn"}]],S0=f("palette",lc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const uc=[["path",{d:"m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551",key:"1miecu"}]],C0=f("paperclip",uc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hc=[["rect",{x:"14",y:"3",width:"5",height:"18",rx:"1",key:"kaeet6"}],["rect",{x:"5",y:"3",width:"5",height:"18",rx:"1",key:"1wsw3u"}]],V0=f("pause",hc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const dc=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]],_0=f("pen",dc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fc=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]],D0=f("pencil",fc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pc=[["path",{d:"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",key:"9njp5v"}]],E0=f("phone",pc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const mc=[["path",{d:"M12 17v5",key:"bb1du9"}],["path",{d:"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",key:"1nkz8b"}]],R0=f("pin",mc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yc=[["path",{d:"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",key:"10ikf1"}]],L0=f("play",yc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const gc=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],N0=f("plus",gc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vc=[["path",{d:"M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z",key:"w46dr5"}]],j0=f("puzzle",vc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xc=[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]],$0=f("refresh-cw",xc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const kc=[["path",{d:"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",key:"qeys4"}],["path",{d:"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09",key:"u4xsad"}],["path",{d:"M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z",key:"676m9"}],["path",{d:"M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05",key:"92ym6u"}]],F0=f("rocket",kc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Mc=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]],B0=f("rotate-ccw",Mc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bc=[["path",{d:"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",key:"1c8476"}],["path",{d:"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",key:"1ydtos"}],["path",{d:"M7 3v4a1 1 0 0 0 1 1h7",key:"t51u73"}]],O0=f("save",bc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wc=[["path",{d:"m13.5 8.5-5 5",key:"1cs55j"}],["path",{d:"m8.5 8.5 5 5",key:"a8mexj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]],I0=f("search-x",wc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Tc=[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]],z0=f("search",Tc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pc=[["path",{d:"M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z",key:"117uat"}],["path",{d:"M6 12h16",key:"s4cdu5"}]],U0=f("send-horizontal",Pc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ac=[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]],q0=f("send",Ac);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sc=[["rect",{width:"20",height:"8",x:"2",y:"2",rx:"2",ry:"2",key:"ngkwjq"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",ry:"2",key:"iecqi9"}],["line",{x1:"6",x2:"6.01",y1:"6",y2:"6",key:"16zg32"}],["line",{x1:"6",x2:"6.01",y1:"18",y2:"18",key:"nzw8ys"}]],H0=f("server",Sc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Cc=[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],K0=f("settings",Cc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vc=[["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}],["circle",{cx:"6",cy:"12",r:"3",key:"w7nqdw"}],["circle",{cx:"18",cy:"19",r:"3",key:"1xt0gg"}],["line",{x1:"8.59",x2:"15.42",y1:"13.51",y2:"17.49",key:"47mynk"}],["line",{x1:"15.41",x2:"8.59",y1:"6.51",y2:"10.49",key:"1n3mei"}]],W0=f("share-2",Vc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _c=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"M12 8v4",key:"1got3b"}],["path",{d:"M12 16h.01",key:"1drbdi"}]],G0=f("shield-alert",_c);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Dc=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],X0=f("shield-check",Dc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ec=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]],Y0=f("shield",Ec);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Rc=[["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M12 21v-9",key:"17s77i"}],["path",{d:"M12 8V3",key:"13r4qs"}],["path",{d:"M17 16h4",key:"h1uq16"}],["path",{d:"M19 12V3",key:"o1uvq1"}],["path",{d:"M19 21v-5",key:"qua636"}],["path",{d:"M3 14h4",key:"bcjad9"}],["path",{d:"M5 10V3",key:"cb8scm"}],["path",{d:"M5 21v-7",key:"1w1uti"}]],Z0=f("sliders-vertical",Rc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Lc=[["rect",{width:"14",height:"20",x:"5",y:"2",rx:"2",ry:"2",key:"1yt0o3"}],["path",{d:"M12 18h.01",key:"mhygvu"}]],Q0=f("smartphone",Lc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Nc=[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",key:"1s2grr"}],["path",{d:"M20 2v4",key:"1rf3ol"}],["path",{d:"M22 4h-4",key:"gwowj6"}],["circle",{cx:"4",cy:"20",r:"2",key:"6kqj1y"}]],J0=f("sparkles",Nc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const jc=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]],tp=f("square",jc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $c=[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]],ep=f("star",$c);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fc=[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]],np=f("sun",Fc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Bc=[["path",{d:"M12 3v18",key:"108xh3"}],["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M3 9h18",key:"1pudct"}],["path",{d:"M3 15h18",key:"5xshup"}]],sp=f("table",Bc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oc=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["circle",{cx:"12",cy:"12",r:"6",key:"1vlfrh"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}]],ip=f("target",Oc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ic=[["path",{d:"M12 19h8",key:"baeox8"}],["path",{d:"m4 17 6-6-6-6",key:"1yngyt"}]],op=f("terminal",Ic);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zc=[["path",{d:"M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",key:"m61m77"}],["path",{d:"M17 14V2",key:"8ymqnk"}]],rp=f("thumbs-down",zc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Uc=[["path",{d:"M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",key:"emmmcr"}],["path",{d:"M7 10v12",key:"1qc93n"}]],ap=f("thumbs-up",Uc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qc=[["circle",{cx:"9",cy:"12",r:"3",key:"u3jwor"}],["rect",{width:"20",height:"14",x:"2",y:"5",rx:"7",key:"g7kal2"}]],cp=f("toggle-left",qc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Hc=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],lp=f("trash-2",Hc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Kc=[["path",{d:"M16 17h6v-6",key:"t6n2it"}],["path",{d:"m22 17-8.5-8.5-5 5L2 7",key:"x473p"}]],up=f("trending-down",Kc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wc=[["path",{d:"M16 7h6v6",key:"box55l"}],["path",{d:"m22 7-8.5 8.5-5-5L2 17",key:"1t1m79"}]],hp=f("trending-up",Wc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Gc=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],dp=f("triangle-alert",Gc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xc=[["path",{d:"M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978",key:"1n3hpd"}],["path",{d:"M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978",key:"rfe1zi"}],["path",{d:"M18 9h1.5a1 1 0 0 0 0-5H18",key:"7xy6bh"}],["path",{d:"M4 22h16",key:"57wxv0"}],["path",{d:"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",key:"1mhfuq"}],["path",{d:"M6 9H4.5a1 1 0 0 1 0-5H6",key:"tex48p"}]],fp=f("trophy",Xc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yc=[["path",{d:"m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71",key:"yqzxt4"}],["path",{d:"m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71",key:"4qinb0"}],["line",{x1:"8",x2:"8",y1:"2",y2:"5",key:"1041cp"}],["line",{x1:"2",x2:"5",y1:"8",y2:"8",key:"14m1p5"}],["line",{x1:"16",x2:"16",y1:"19",y2:"22",key:"rzdirn"}],["line",{x1:"19",x2:"22",y1:"16",y2:"16",key:"ox905f"}]],pp=f("unlink",Yc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zc=[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]],mp=f("upload",Zc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qc=[["path",{d:"m16 11 2 2 4-4",key:"9rsbq5"}],["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}]],yp=f("user-check",Qc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Jc=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"19",x2:"19",y1:"8",y2:"14",key:"1bvyxn"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]],gp=f("user-plus",Jc);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const tl=[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]],vp=f("user",tl);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const el=[["path",{d:"M18 21a8 8 0 0 0-16 0",key:"3ypg7q"}],["circle",{cx:"10",cy:"8",r:"5",key:"o932ke"}],["path",{d:"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3",key:"10s06x"}]],xp=f("users-round",el);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const nl=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["path",{d:"M16 3.128a4 4 0 0 1 0 7.744",key:"16gr8j"}],["path",{d:"M22 21v-2a4 4 0 0 0-3-3.87",key:"kshegd"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}]],kp=f("users",nl);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sl=[["path",{d:"m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",key:"ftymec"}],["rect",{x:"2",y:"6",width:"14",height:"12",rx:"2",key:"158x01"}]],Mp=f("video",sl);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const il=[["path",{d:"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",key:"uqj9uw"}],["path",{d:"M16 9a5 5 0 0 1 0 6",key:"1q6k2b"}],["path",{d:"M19.364 18.364a9 9 0 0 0 0-12.728",key:"ijwkga"}]],bp=f("volume-2",il);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ol=[["path",{d:"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",key:"uqj9uw"}],["line",{x1:"22",x2:"16",y1:"9",y2:"15",key:"1ewh16"}],["line",{x1:"16",x2:"22",y1:"9",y2:"15",key:"5ykzw1"}]],wp=f("volume-x",ol);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rl=[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]],Tp=f("wallet",rl);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const al=[["path",{d:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",key:"1ngwbx"}]],Pp=f("wrench",al);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const cl=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],Ap=f("x",cl);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ll=[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",key:"1xq2db"}]],Sp=f("zap",ll),We=m.createContext({});function Ge(t){const e=m.useRef(null);return e.current===null&&(e.current=t()),e.current}const re=m.createContext(null),Xe=m.createContext({transformPagePoint:t=>t,isStatic:!1,reducedMotion:"never"});class ul extends m.Component{getSnapshotBeforeUpdate(e){const n=this.props.childRef.current;if(n&&e.isPresent&&!this.props.isPresent){const s=this.props.sizeRef.current;s.height=n.offsetHeight||0,s.width=n.offsetWidth||0,s.top=n.offsetTop,s.left=n.offsetLeft}return null}componentDidUpdate(){}render(){return this.props.children}}function hl({children:t,isPresent:e}){const n=m.useId(),s=m.useRef(null),i=m.useRef({width:0,height:0,top:0,left:0}),{nonce:r}=m.useContext(Xe);return m.useInsertionEffect(()=>{const{width:o,height:a,top:c,left:l}=i.current;if(e||!s.current||!o||!a)return;s.current.dataset.motionPopId=n;const u=document.createElement("style");return r&&(u.nonce=r),document.head.appendChild(u),u.sheet&&u.sheet.insertRule(`
          [data-motion-pop-id="${n}"] {
            position: absolute !important;
            width: ${o}px !important;
            height: ${a}px !important;
            top: ${c}px !important;
            left: ${l}px !important;
          }
        `),()=>{document.head.removeChild(u)}},[e]),X.jsx(ul,{isPresent:e,childRef:s,sizeRef:i,children:m.cloneElement(t,{ref:s})})}const dl=({children:t,initial:e,isPresent:n,onExitComplete:s,custom:i,presenceAffectsLayout:r,mode:o})=>{const a=Ge(fl),c=m.useId(),l=m.useCallback(h=>{a.set(h,!0);for(const d of a.values())if(!d)return;s&&s()},[a,s]),u=m.useMemo(()=>({id:c,initial:e,isPresent:n,custom:i,onExitComplete:l,register:h=>(a.set(h,!1),()=>a.delete(h))}),r?[Math.random(),l]:[n,l]);return m.useMemo(()=>{a.forEach((h,d)=>a.set(d,!1))},[n]),m.useEffect(()=>{!n&&!a.size&&s&&s()},[n]),o==="popLayout"&&(t=X.jsx(hl,{isPresent:n,children:t})),X.jsx(re.Provider,{value:u,children:t})};function fl(){return new Map}function ei(t=!0){const e=m.useContext(re);if(e===null)return[!0,null];const{isPresent:n,onExitComplete:s,register:i}=e,r=m.useId();m.useEffect(()=>{t&&i(r)},[t]);const o=m.useCallback(()=>t&&s&&s(r),[r,s,t]);return!n&&s?[!1,o]:[!0]}const zt=t=>t.key||"";function En(t){const e=[];return m.Children.forEach(t,n=>{m.isValidElement(n)&&e.push(n)}),e}const Ye=typeof window<"u",ni=Ye?m.useLayoutEffect:m.useEffect,Cp=({children:t,custom:e,initial:n=!0,onExitComplete:s,presenceAffectsLayout:i=!0,mode:r="sync",propagate:o=!1})=>{const[a,c]=ei(o),l=m.useMemo(()=>En(t),[t]),u=o&&!a?[]:l.map(zt),h=m.useRef(!0),d=m.useRef(l),p=Ge(()=>new Map),[y,g]=m.useState(l),[v,x]=m.useState(l);ni(()=>{h.current=!1,d.current=l;for(let T=0;T<v.length;T++){const b=zt(v[T]);u.includes(b)?p.delete(b):p.get(b)!==!0&&p.set(b,!1)}},[v,u.length,u.join("-")]);const M=[];if(l!==y){let T=[...l];for(let b=0;b<v.length;b++){const A=v[b],_=zt(A);u.includes(_)||(T.splice(b,0,A),M.push(A))}r==="wait"&&M.length&&(T=M),x(En(T)),g(l);return}const{forceRender:k}=m.useContext(We);return X.jsx(X.Fragment,{children:v.map(T=>{const b=zt(T),A=o&&!a?!1:l===v||u.includes(b),_=()=>{if(p.has(b))p.set(b,!0);else return;let P=!0;p.forEach(L=>{L||(P=!1)}),P&&(k==null||k(),x(d.current),o&&(c==null||c()),s&&s())};return X.jsx(dl,{isPresent:A,initial:!h.current||n?void 0:!1,custom:A?void 0:e,presenceAffectsLayout:i,mode:r,onExitComplete:A?void 0:_,children:T},b)})})},F=t=>t;let si=F;function Ze(t){let e;return()=>(e===void 0&&(e=t()),e)}const vt=(t,e,n)=>{const s=e-t;return s===0?1:(n-t)/s},Y=t=>t*1e3,Z=t=>t/1e3,pl={useManualTiming:!1};function ml(t){let e=new Set,n=new Set,s=!1,i=!1;const r=new WeakSet;let o={delta:0,timestamp:0,isProcessing:!1};function a(l){r.has(l)&&(c.schedule(l),t()),l(o)}const c={schedule:(l,u=!1,h=!1)=>{const p=h&&s?e:n;return u&&r.add(l),p.has(l)||p.add(l),l},cancel:l=>{n.delete(l),r.delete(l)},process:l=>{if(o=l,s){i=!0;return}s=!0,[e,n]=[n,e],e.forEach(a),e.clear(),s=!1,i&&(i=!1,c.process(l))}};return c}const Ut=["read","resolveKeyframes","update","preRender","render","postRender"],yl=40;function ii(t,e){let n=!1,s=!0;const i={delta:0,timestamp:0,isProcessing:!1},r=()=>n=!0,o=Ut.reduce((x,M)=>(x[M]=ml(r),x),{}),{read:a,resolveKeyframes:c,update:l,preRender:u,render:h,postRender:d}=o,p=()=>{const x=performance.now();n=!1,i.delta=s?1e3/60:Math.max(Math.min(x-i.timestamp,yl),1),i.timestamp=x,i.isProcessing=!0,a.process(i),c.process(i),l.process(i),u.process(i),h.process(i),d.process(i),i.isProcessing=!1,n&&e&&(s=!1,t(p))},y=()=>{n=!0,s=!0,i.isProcessing||t(p)};return{schedule:Ut.reduce((x,M)=>{const k=o[M];return x[M]=(T,b=!1,A=!1)=>(n||y(),k.schedule(T,b,A)),x},{}),cancel:x=>{for(let M=0;M<Ut.length;M++)o[Ut[M]].cancel(x)},state:i,steps:o}}const{schedule:S,cancel:nt,state:R,steps:me}=ii(typeof requestAnimationFrame<"u"?requestAnimationFrame:F,!0),oi=m.createContext({strict:!1}),Rn={animation:["animate","variants","whileHover","whileTap","exit","whileInView","whileFocus","whileDrag"],exit:["exit"],drag:["drag","dragControls"],focus:["whileFocus"],hover:["whileHover","onHoverStart","onHoverEnd"],tap:["whileTap","onTap","onTapStart","onTapCancel"],pan:["onPan","onPanStart","onPanSessionStart","onPanEnd"],inView:["whileInView","onViewportEnter","onViewportLeave"],layout:["layout","layoutId"]},xt={};for(const t in Rn)xt[t]={isEnabled:e=>Rn[t].some(n=>!!e[n])};function gl(t){for(const e in t)xt[e]={...xt[e],...t[e]}}const vl=new Set(["animate","exit","variants","initial","style","values","variants","transition","transformTemplate","custom","inherit","onBeforeLayoutMeasure","onAnimationStart","onAnimationComplete","onUpdate","onDragStart","onDrag","onDragEnd","onMeasureDragConstraints","onDirectionLock","onDragTransitionEnd","_dragX","_dragY","onHoverStart","onHoverEnd","onViewportEnter","onViewportLeave","globalTapTarget","ignoreStrict","viewport"]);function Zt(t){return t.startsWith("while")||t.startsWith("drag")&&t!=="draggable"||t.startsWith("layout")||t.startsWith("onTap")||t.startsWith("onPan")||t.startsWith("onLayout")||vl.has(t)}let ri=t=>!Zt(t);function xl(t){t&&(ri=e=>e.startsWith("on")?!Zt(e):t(e))}try{xl(require("@emotion/is-prop-valid").default)}catch{}function kl(t,e,n){const s={};for(const i in t)i==="values"&&typeof t.values=="object"||(ri(i)||n===!0&&Zt(i)||!e&&!Zt(i)||t.draggable&&i.startsWith("onDrag"))&&(s[i]=t[i]);return s}function Ml(t){if(typeof Proxy>"u")return t;const e=new Map,n=(...s)=>t(...s);return new Proxy(n,{get:(s,i)=>i==="create"?t:(e.has(i)||e.set(i,t(i)),e.get(i))})}const ae=m.createContext({});function Dt(t){return typeof t=="string"||Array.isArray(t)}function ce(t){return t!==null&&typeof t=="object"&&typeof t.start=="function"}const Qe=["animate","whileInView","whileFocus","whileHover","whileTap","whileDrag","exit"],Je=["initial",...Qe];function le(t){return ce(t.animate)||Je.some(e=>Dt(t[e]))}function ai(t){return!!(le(t)||t.variants)}function bl(t,e){if(le(t)){const{initial:n,animate:s}=t;return{initial:n===!1||Dt(n)?n:void 0,animate:Dt(s)?s:void 0}}return t.inherit!==!1?e:{}}function wl(t){const{initial:e,animate:n}=bl(t,m.useContext(ae));return m.useMemo(()=>({initial:e,animate:n}),[Ln(e),Ln(n)])}function Ln(t){return Array.isArray(t)?t.join(" "):t}const Tl=Symbol.for("motionComponentSymbol");function ft(t){return t&&typeof t=="object"&&Object.prototype.hasOwnProperty.call(t,"current")}function Pl(t,e,n){return m.useCallback(s=>{s&&t.onMount&&t.onMount(s),e&&(s?e.mount(s):e.unmount()),n&&(typeof n=="function"?n(s):ft(n)&&(n.current=s))},[e])}const tn=t=>t.replace(/([a-z])([A-Z])/gu,"$1-$2").toLowerCase(),Al="framerAppearId",ci="data-"+tn(Al),{schedule:en}=ii(queueMicrotask,!1),li=m.createContext({});function Sl(t,e,n,s,i){var r,o;const{visualElement:a}=m.useContext(ae),c=m.useContext(oi),l=m.useContext(re),u=m.useContext(Xe).reducedMotion,h=m.useRef(null);s=s||c.renderer,!h.current&&s&&(h.current=s(t,{visualState:e,parent:a,props:n,presenceContext:l,blockInitialAnimation:l?l.initial===!1:!1,reducedMotionConfig:u}));const d=h.current,p=m.useContext(li);d&&!d.projection&&i&&(d.type==="html"||d.type==="svg")&&Cl(h.current,n,i,p);const y=m.useRef(!1);m.useInsertionEffect(()=>{d&&y.current&&d.update(n,l)});const g=n[ci],v=m.useRef(!!g&&!(!((r=window.MotionHandoffIsComplete)===null||r===void 0)&&r.call(window,g))&&((o=window.MotionHasOptimisedAnimation)===null||o===void 0?void 0:o.call(window,g)));return ni(()=>{d&&(y.current=!0,window.MotionIsMounted=!0,d.updateFeatures(),en.render(d.render),v.current&&d.animationState&&d.animationState.animateChanges())}),m.useEffect(()=>{d&&(!v.current&&d.animationState&&d.animationState.animateChanges(),v.current&&(queueMicrotask(()=>{var x;(x=window.MotionHandoffMarkAsComplete)===null||x===void 0||x.call(window,g)}),v.current=!1))}),d}function Cl(t,e,n,s){const{layoutId:i,layout:r,drag:o,dragConstraints:a,layoutScroll:c,layoutRoot:l}=e;t.projection=new n(t.latestValues,e["data-framer-portal-id"]?void 0:ui(t.parent)),t.projection.setOptions({layoutId:i,layout:r,alwaysMeasureLayout:!!o||a&&ft(a),visualElement:t,animationType:typeof r=="string"?r:"both",initialPromotionConfig:s,layoutScroll:c,layoutRoot:l})}function ui(t){if(t)return t.options.allowProjection!==!1?t.projection:ui(t.parent)}function Vl({preloadedFeatures:t,createVisualElement:e,useRender:n,useVisualState:s,Component:i}){var r,o;t&&gl(t);function a(l,u){let h;const d={...m.useContext(Xe),...l,layoutId:_l(l)},{isStatic:p}=d,y=wl(l),g=s(l,p);if(!p&&Ye){Dl();const v=El(d);h=v.MeasureLayout,y.visualElement=Sl(i,g,d,e,v.ProjectionNode)}return X.jsxs(ae.Provider,{value:y,children:[h&&y.visualElement?X.jsx(h,{visualElement:y.visualElement,...d}):null,n(i,l,Pl(g,y.visualElement,u),g,p,y.visualElement)]})}a.displayName=`motion.${typeof i=="string"?i:`create(${(o=(r=i.displayName)!==null&&r!==void 0?r:i.name)!==null&&o!==void 0?o:""})`}`;const c=m.forwardRef(a);return c[Tl]=i,c}function _l({layoutId:t}){const e=m.useContext(We).id;return e&&t!==void 0?e+"-"+t:t}function Dl(t,e){m.useContext(oi).strict}function El(t){const{drag:e,layout:n}=xt;if(!e&&!n)return{};const s={...e,...n};return{MeasureLayout:e!=null&&e.isEnabled(t)||n!=null&&n.isEnabled(t)?s.MeasureLayout:void 0,ProjectionNode:s.ProjectionNode}}const Rl=["animate","circle","defs","desc","ellipse","g","image","line","filter","marker","mask","metadata","path","pattern","polygon","polyline","rect","stop","switch","symbol","svg","text","tspan","use","view"];function nn(t){return typeof t!="string"||t.includes("-")?!1:!!(Rl.indexOf(t)>-1||/[A-Z]/u.test(t))}function Nn(t){const e=[{},{}];return t==null||t.values.forEach((n,s)=>{e[0][s]=n.get(),e[1][s]=n.getVelocity()}),e}function sn(t,e,n,s){if(typeof e=="function"){const[i,r]=Nn(s);e=e(n!==void 0?n:t.custom,i,r)}if(typeof e=="string"&&(e=t.variants&&t.variants[e]),typeof e=="function"){const[i,r]=Nn(s);e=e(n!==void 0?n:t.custom,i,r)}return e}const _e=t=>Array.isArray(t),Ll=t=>!!(t&&typeof t=="object"&&t.mix&&t.toValue),Nl=t=>_e(t)?t[t.length-1]||0:t,j=t=>!!(t&&t.getVelocity);function Wt(t){const e=j(t)?t.get():t;return Ll(e)?e.toValue():e}function jl({scrapeMotionValuesFromProps:t,createRenderState:e,onUpdate:n},s,i,r){const o={latestValues:$l(s,i,r,t),renderState:e()};return n&&(o.onMount=a=>n({props:s,current:a,...o}),o.onUpdate=a=>n(a)),o}const hi=t=>(e,n)=>{const s=m.useContext(ae),i=m.useContext(re),r=()=>jl(t,e,s,i);return n?r():Ge(r)};function $l(t,e,n,s){const i={},r=s(t,{});for(const d in r)i[d]=Wt(r[d]);let{initial:o,animate:a}=t;const c=le(t),l=ai(t);e&&l&&!c&&t.inherit!==!1&&(o===void 0&&(o=e.initial),a===void 0&&(a=e.animate));let u=n?n.initial===!1:!1;u=u||o===!1;const h=u?a:o;if(h&&typeof h!="boolean"&&!ce(h)){const d=Array.isArray(h)?h:[h];for(let p=0;p<d.length;p++){const y=sn(t,d[p]);if(y){const{transitionEnd:g,transition:v,...x}=y;for(const M in x){let k=x[M];if(Array.isArray(k)){const T=u?k.length-1:0;k=k[T]}k!==null&&(i[M]=k)}for(const M in g)i[M]=g[M]}}}return i}const Mt=["transformPerspective","x","y","z","translateX","translateY","translateZ","scale","scaleX","scaleY","rotate","rotateX","rotateY","rotateZ","skew","skewX","skewY"],ht=new Set(Mt),di=t=>e=>typeof e=="string"&&e.startsWith(t),fi=di("--"),Fl=di("var(--"),on=t=>Fl(t)?Bl.test(t.split("/*")[0].trim()):!1,Bl=/var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu,pi=(t,e)=>e&&typeof t=="number"?e.transform(t):t,J=(t,e,n)=>n>e?e:n<t?t:n,bt={test:t=>typeof t=="number",parse:parseFloat,transform:t=>t},Et={...bt,transform:t=>J(0,1,t)},qt={...bt,default:1},$t=t=>({test:e=>typeof e=="string"&&e.endsWith(t)&&e.split(" ").length===1,parse:parseFloat,transform:e=>`${e}${t}`}),tt=$t("deg"),H=$t("%"),w=$t("px"),Ol=$t("vh"),Il=$t("vw"),jn={...H,parse:t=>H.parse(t)/100,transform:t=>H.transform(t*100)},zl={borderWidth:w,borderTopWidth:w,borderRightWidth:w,borderBottomWidth:w,borderLeftWidth:w,borderRadius:w,radius:w,borderTopLeftRadius:w,borderTopRightRadius:w,borderBottomRightRadius:w,borderBottomLeftRadius:w,width:w,maxWidth:w,height:w,maxHeight:w,top:w,right:w,bottom:w,left:w,padding:w,paddingTop:w,paddingRight:w,paddingBottom:w,paddingLeft:w,margin:w,marginTop:w,marginRight:w,marginBottom:w,marginLeft:w,backgroundPositionX:w,backgroundPositionY:w},Ul={rotate:tt,rotateX:tt,rotateY:tt,rotateZ:tt,scale:qt,scaleX:qt,scaleY:qt,scaleZ:qt,skew:tt,skewX:tt,skewY:tt,distance:w,translateX:w,translateY:w,translateZ:w,x:w,y:w,z:w,perspective:w,transformPerspective:w,opacity:Et,originX:jn,originY:jn,originZ:w},$n={...bt,transform:Math.round},rn={...zl,...Ul,zIndex:$n,size:w,fillOpacity:Et,strokeOpacity:Et,numOctaves:$n},ql={x:"translateX",y:"translateY",z:"translateZ",transformPerspective:"perspective"},Hl=Mt.length;function Kl(t,e,n){let s="",i=!0;for(let r=0;r<Hl;r++){const o=Mt[r],a=t[o];if(a===void 0)continue;let c=!0;if(typeof a=="number"?c=a===(o.startsWith("scale")?1:0):c=parseFloat(a)===0,!c||n){const l=pi(a,rn[o]);if(!c){i=!1;const u=ql[o]||o;s+=`${u}(${l}) `}n&&(e[o]=l)}}return s=s.trim(),n?s=n(e,i?"":s):i&&(s="none"),s}function an(t,e,n){const{style:s,vars:i,transformOrigin:r}=t;let o=!1,a=!1;for(const c in e){const l=e[c];if(ht.has(c)){o=!0;continue}else if(fi(c)){i[c]=l;continue}else{const u=pi(l,rn[c]);c.startsWith("origin")?(a=!0,r[c]=u):s[c]=u}}if(e.transform||(o||n?s.transform=Kl(e,t.transform,n):s.transform&&(s.transform="none")),a){const{originX:c="50%",originY:l="50%",originZ:u=0}=r;s.transformOrigin=`${c} ${l} ${u}`}}const Wl={offset:"stroke-dashoffset",array:"stroke-dasharray"},Gl={offset:"strokeDashoffset",array:"strokeDasharray"};function Xl(t,e,n=1,s=0,i=!0){t.pathLength=1;const r=i?Wl:Gl;t[r.offset]=w.transform(-s);const o=w.transform(e),a=w.transform(n);t[r.array]=`${o} ${a}`}function Fn(t,e,n){return typeof t=="string"?t:w.transform(e+n*t)}function Yl(t,e,n){const s=Fn(e,t.x,t.width),i=Fn(n,t.y,t.height);return`${s} ${i}`}function cn(t,{attrX:e,attrY:n,attrScale:s,originX:i,originY:r,pathLength:o,pathSpacing:a=1,pathOffset:c=0,...l},u,h){if(an(t,l,h),u){t.style.viewBox&&(t.attrs.viewBox=t.style.viewBox);return}t.attrs=t.style,t.style={};const{attrs:d,style:p,dimensions:y}=t;d.transform&&(y&&(p.transform=d.transform),delete d.transform),y&&(i!==void 0||r!==void 0||p.transform)&&(p.transformOrigin=Yl(y,i!==void 0?i:.5,r!==void 0?r:.5)),e!==void 0&&(d.x=e),n!==void 0&&(d.y=n),s!==void 0&&(d.scale=s),o!==void 0&&Xl(d,o,a,c,!1)}const ln=()=>({style:{},transform:{},transformOrigin:{},vars:{}}),mi=()=>({...ln(),attrs:{}}),un=t=>typeof t=="string"&&t.toLowerCase()==="svg";function yi(t,{style:e,vars:n},s,i){Object.assign(t.style,e,i&&i.getProjectionStyles(s));for(const r in n)t.style.setProperty(r,n[r])}const gi=new Set(["baseFrequency","diffuseConstant","kernelMatrix","kernelUnitLength","keySplines","keyTimes","limitingConeAngle","markerHeight","markerWidth","numOctaves","targetX","targetY","surfaceScale","specularConstant","specularExponent","stdDeviation","tableValues","viewBox","gradientTransform","pathLength","startOffset","textLength","lengthAdjust"]);function vi(t,e,n,s){yi(t,e,void 0,s);for(const i in e.attrs)t.setAttribute(gi.has(i)?i:tn(i),e.attrs[i])}const Qt={};function Zl(t){Object.assign(Qt,t)}function xi(t,{layout:e,layoutId:n}){return ht.has(t)||t.startsWith("origin")||(e||n!==void 0)&&(!!Qt[t]||t==="opacity")}function hn(t,e,n){var s;const{style:i}=t,r={};for(const o in i)(j(i[o])||e.style&&j(e.style[o])||xi(o,t)||((s=n==null?void 0:n.getValue(o))===null||s===void 0?void 0:s.liveStyle)!==void 0)&&(r[o]=i[o]);return r}function ki(t,e,n){const s=hn(t,e,n);for(const i in t)if(j(t[i])||j(e[i])){const r=Mt.indexOf(i)!==-1?"attr"+i.charAt(0).toUpperCase()+i.substring(1):i;s[r]=t[i]}return s}function Ql(t,e){try{e.dimensions=typeof t.getBBox=="function"?t.getBBox():t.getBoundingClientRect()}catch{e.dimensions={x:0,y:0,width:0,height:0}}}const Bn=["x","y","width","height","cx","cy","r"],Jl={useVisualState:hi({scrapeMotionValuesFromProps:ki,createRenderState:mi,onUpdate:({props:t,prevProps:e,current:n,renderState:s,latestValues:i})=>{if(!n)return;let r=!!t.drag;if(!r){for(const a in i)if(ht.has(a)){r=!0;break}}if(!r)return;let o=!e;if(e)for(let a=0;a<Bn.length;a++){const c=Bn[a];t[c]!==e[c]&&(o=!0)}o&&S.read(()=>{Ql(n,s),S.render(()=>{cn(s,i,un(n.tagName),t.transformTemplate),vi(n,s)})})}})},tu={useVisualState:hi({scrapeMotionValuesFromProps:hn,createRenderState:ln})};function Mi(t,e,n){for(const s in e)!j(e[s])&&!xi(s,n)&&(t[s]=e[s])}function eu({transformTemplate:t},e){return m.useMemo(()=>{const n=ln();return an(n,e,t),Object.assign({},n.vars,n.style)},[e])}function nu(t,e){const n=t.style||{},s={};return Mi(s,n,t),Object.assign(s,eu(t,e)),s}function su(t,e){const n={},s=nu(t,e);return t.drag&&t.dragListener!==!1&&(n.draggable=!1,s.userSelect=s.WebkitUserSelect=s.WebkitTouchCallout="none",s.touchAction=t.drag===!0?"none":`pan-${t.drag==="x"?"y":"x"}`),t.tabIndex===void 0&&(t.onTap||t.onTapStart||t.whileTap)&&(n.tabIndex=0),n.style=s,n}function iu(t,e,n,s){const i=m.useMemo(()=>{const r=mi();return cn(r,e,un(s),t.transformTemplate),{...r.attrs,style:{...r.style}}},[e]);if(t.style){const r={};Mi(r,t.style,t),i.style={...r,...i.style}}return i}function ou(t=!1){return(n,s,i,{latestValues:r},o)=>{const c=(nn(n)?iu:su)(s,r,o,n),l=kl(s,typeof n=="string",t),u=n!==m.Fragment?{...l,...c,ref:i}:{},{children:h}=s,d=m.useMemo(()=>j(h)?h.get():h,[h]);return m.createElement(n,{...u,children:d})}}function ru(t,e){return function(s,{forwardMotionProps:i}={forwardMotionProps:!1}){const o={...nn(s)?Jl:tu,preloadedFeatures:t,useRender:ou(i),createVisualElement:e,Component:s};return Vl(o)}}function bi(t,e){if(!Array.isArray(e))return!1;const n=e.length;if(n!==t.length)return!1;for(let s=0;s<n;s++)if(e[s]!==t[s])return!1;return!0}function ue(t,e,n){const s=t.getProps();return sn(s,e,n!==void 0?n:s.custom,t)}const au=Ze(()=>window.ScrollTimeline!==void 0);class cu{constructor(e){this.stop=()=>this.runAll("stop"),this.animations=e.filter(Boolean)}get finished(){return Promise.all(this.animations.map(e=>"finished"in e?e.finished:e))}getAll(e){return this.animations[0][e]}setAll(e,n){for(let s=0;s<this.animations.length;s++)this.animations[s][e]=n}attachTimeline(e,n){const s=this.animations.map(i=>{if(au()&&i.attachTimeline)return i.attachTimeline(e);if(typeof n=="function")return n(i)});return()=>{s.forEach((i,r)=>{i&&i(),this.animations[r].stop()})}}get time(){return this.getAll("time")}set time(e){this.setAll("time",e)}get speed(){return this.getAll("speed")}set speed(e){this.setAll("speed",e)}get startTime(){return this.getAll("startTime")}get duration(){let e=0;for(let n=0;n<this.animations.length;n++)e=Math.max(e,this.animations[n].duration);return e}runAll(e){this.animations.forEach(n=>n[e]())}flatten(){this.runAll("flatten")}play(){this.runAll("play")}pause(){this.runAll("pause")}cancel(){this.runAll("cancel")}complete(){this.runAll("complete")}}class lu extends cu{then(e,n){return Promise.all(this.animations).then(e).catch(n)}}function dn(t,e){return t?t[e]||t.default||t:void 0}const De=2e4;function wi(t){let e=0;const n=50;let s=t.next(e);for(;!s.done&&e<De;)e+=n,s=t.next(e);return e>=De?1/0:e}function fn(t){return typeof t=="function"}function On(t,e){t.timeline=e,t.onfinish=null}const pn=t=>Array.isArray(t)&&typeof t[0]=="number",uu={linearEasing:void 0};function hu(t,e){const n=Ze(t);return()=>{var s;return(s=uu[e])!==null&&s!==void 0?s:n()}}const Jt=hu(()=>{try{document.createElement("div").animate({opacity:0},{easing:"linear(0, 1)"})}catch{return!1}return!0},"linearEasing"),Ti=(t,e,n=10)=>{let s="";const i=Math.max(Math.round(e/n),2);for(let r=0;r<i;r++)s+=t(vt(0,i-1,r))+", ";return`linear(${s.substring(0,s.length-2)})`};function Pi(t){return!!(typeof t=="function"&&Jt()||!t||typeof t=="string"&&(t in Ee||Jt())||pn(t)||Array.isArray(t)&&t.every(Pi))}const Tt=([t,e,n,s])=>`cubic-bezier(${t}, ${e}, ${n}, ${s})`,Ee={linear:"linear",ease:"ease",easeIn:"ease-in",easeOut:"ease-out",easeInOut:"ease-in-out",circIn:Tt([0,.65,.55,1]),circOut:Tt([.55,0,1,.45]),backIn:Tt([.31,.01,.66,-.59]),backOut:Tt([.33,1.53,.69,.99])};function Ai(t,e){if(t)return typeof t=="function"&&Jt()?Ti(t,e):pn(t)?Tt(t):Array.isArray(t)?t.map(n=>Ai(n,e)||Ee.easeOut):Ee[t]}const U={x:!1,y:!1};function Si(){return U.x||U.y}function du(t,e,n){var s;if(t instanceof Element)return[t];if(typeof t=="string"){let i=document;const r=(s=void 0)!==null&&s!==void 0?s:i.querySelectorAll(t);return r?Array.from(r):[]}return Array.from(t)}function Ci(t,e){const n=du(t),s=new AbortController,i={passive:!0,...e,signal:s.signal};return[n,i,()=>s.abort()]}function In(t){return e=>{e.pointerType==="touch"||Si()||t(e)}}function fu(t,e,n={}){const[s,i,r]=Ci(t,n),o=In(a=>{const{target:c}=a,l=e(a);if(typeof l!="function"||!c)return;const u=In(h=>{l(h),c.removeEventListener("pointerleave",u)});c.addEventListener("pointerleave",u,i)});return s.forEach(a=>{a.addEventListener("pointerenter",o,i)}),r}const Vi=(t,e)=>e?t===e?!0:Vi(t,e.parentElement):!1,mn=t=>t.pointerType==="mouse"?typeof t.button!="number"||t.button<=0:t.isPrimary!==!1,pu=new Set(["BUTTON","INPUT","SELECT","TEXTAREA","A"]);function mu(t){return pu.has(t.tagName)||t.tabIndex!==-1}const Pt=new WeakSet;function zn(t){return e=>{e.key==="Enter"&&t(e)}}function ye(t,e){t.dispatchEvent(new PointerEvent("pointer"+e,{isPrimary:!0,bubbles:!0}))}const yu=(t,e)=>{const n=t.currentTarget;if(!n)return;const s=zn(()=>{if(Pt.has(n))return;ye(n,"down");const i=zn(()=>{ye(n,"up")}),r=()=>ye(n,"cancel");n.addEventListener("keyup",i,e),n.addEventListener("blur",r,e)});n.addEventListener("keydown",s,e),n.addEventListener("blur",()=>n.removeEventListener("keydown",s),e)};function Un(t){return mn(t)&&!Si()}function gu(t,e,n={}){const[s,i,r]=Ci(t,n),o=a=>{const c=a.currentTarget;if(!Un(a)||Pt.has(c))return;Pt.add(c);const l=e(a),u=(p,y)=>{window.removeEventListener("pointerup",h),window.removeEventListener("pointercancel",d),!(!Un(p)||!Pt.has(c))&&(Pt.delete(c),typeof l=="function"&&l(p,{success:y}))},h=p=>{u(p,n.useGlobalTarget||Vi(c,p.target))},d=p=>{u(p,!1)};window.addEventListener("pointerup",h,i),window.addEventListener("pointercancel",d,i)};return s.forEach(a=>{!mu(a)&&a.getAttribute("tabindex")===null&&(a.tabIndex=0),(n.useGlobalTarget?window:a).addEventListener("pointerdown",o,i),a.addEventListener("focus",l=>yu(l,i),i)}),r}function vu(t){return t==="x"||t==="y"?U[t]?null:(U[t]=!0,()=>{U[t]=!1}):U.x||U.y?null:(U.x=U.y=!0,()=>{U.x=U.y=!1})}const _i=new Set(["width","height","top","left","right","bottom",...Mt]);let Gt;function xu(){Gt=void 0}const K={now:()=>(Gt===void 0&&K.set(R.isProcessing||pl.useManualTiming?R.timestamp:performance.now()),Gt),set:t=>{Gt=t,queueMicrotask(xu)}};function yn(t,e){t.indexOf(e)===-1&&t.push(e)}function gn(t,e){const n=t.indexOf(e);n>-1&&t.splice(n,1)}class vn{constructor(){this.subscriptions=[]}add(e){return yn(this.subscriptions,e),()=>gn(this.subscriptions,e)}notify(e,n,s){const i=this.subscriptions.length;if(i)if(i===1)this.subscriptions[0](e,n,s);else for(let r=0;r<i;r++){const o=this.subscriptions[r];o&&o(e,n,s)}}getSize(){return this.subscriptions.length}clear(){this.subscriptions.length=0}}function Di(t,e){return e?t*(1e3/e):0}const qn=30,ku=t=>!isNaN(parseFloat(t));class Mu{constructor(e,n={}){this.version="11.18.2",this.canTrackVelocity=null,this.events={},this.updateAndNotify=(s,i=!0)=>{const r=K.now();this.updatedAt!==r&&this.setPrevFrameValue(),this.prev=this.current,this.setCurrent(s),this.current!==this.prev&&this.events.change&&this.events.change.notify(this.current),i&&this.events.renderRequest&&this.events.renderRequest.notify(this.current)},this.hasAnimated=!1,this.setCurrent(e),this.owner=n.owner}setCurrent(e){this.current=e,this.updatedAt=K.now(),this.canTrackVelocity===null&&e!==void 0&&(this.canTrackVelocity=ku(this.current))}setPrevFrameValue(e=this.current){this.prevFrameValue=e,this.prevUpdatedAt=this.updatedAt}onChange(e){return this.on("change",e)}on(e,n){this.events[e]||(this.events[e]=new vn);const s=this.events[e].add(n);return e==="change"?()=>{s(),S.read(()=>{this.events.change.getSize()||this.stop()})}:s}clearListeners(){for(const e in this.events)this.events[e].clear()}attach(e,n){this.passiveEffect=e,this.stopPassiveEffect=n}set(e,n=!0){!n||!this.passiveEffect?this.updateAndNotify(e,n):this.passiveEffect(e,this.updateAndNotify)}setWithVelocity(e,n,s){this.set(n),this.prev=void 0,this.prevFrameValue=e,this.prevUpdatedAt=this.updatedAt-s}jump(e,n=!0){this.updateAndNotify(e),this.prev=e,this.prevUpdatedAt=this.prevFrameValue=void 0,n&&this.stop(),this.stopPassiveEffect&&this.stopPassiveEffect()}get(){return this.current}getPrevious(){return this.prev}getVelocity(){const e=K.now();if(!this.canTrackVelocity||this.prevFrameValue===void 0||e-this.updatedAt>qn)return 0;const n=Math.min(this.updatedAt-this.prevUpdatedAt,qn);return Di(parseFloat(this.current)-parseFloat(this.prevFrameValue),n)}start(e){return this.stop(),new Promise(n=>{this.hasAnimated=!0,this.animation=e(n),this.events.animationStart&&this.events.animationStart.notify()}).then(()=>{this.events.animationComplete&&this.events.animationComplete.notify(),this.clearAnimation()})}stop(){this.animation&&(this.animation.stop(),this.events.animationCancel&&this.events.animationCancel.notify()),this.clearAnimation()}isAnimating(){return!!this.animation}clearAnimation(){delete this.animation}destroy(){this.clearListeners(),this.stop(),this.stopPassiveEffect&&this.stopPassiveEffect()}}function Rt(t,e){return new Mu(t,e)}function bu(t,e,n){t.hasValue(e)?t.getValue(e).set(n):t.addValue(e,Rt(n))}function wu(t,e){const n=ue(t,e);let{transitionEnd:s={},transition:i={},...r}=n||{};r={...r,...s};for(const o in r){const a=Nl(r[o]);bu(t,o,a)}}function Tu(t){return!!(j(t)&&t.add)}function Re(t,e){const n=t.getValue("willChange");if(Tu(n))return n.add(e)}function Ei(t){return t.props[ci]}const Ri=(t,e,n)=>(((1-3*n+3*e)*t+(3*n-6*e))*t+3*e)*t,Pu=1e-7,Au=12;function Su(t,e,n,s,i){let r,o,a=0;do o=e+(n-e)/2,r=Ri(o,s,i)-t,r>0?n=o:e=o;while(Math.abs(r)>Pu&&++a<Au);return o}function Ft(t,e,n,s){if(t===e&&n===s)return F;const i=r=>Su(r,0,1,t,n);return r=>r===0||r===1?r:Ri(i(r),e,s)}const Li=t=>e=>e<=.5?t(2*e)/2:(2-t(2*(1-e)))/2,Ni=t=>e=>1-t(1-e),ji=Ft(.33,1.53,.69,.99),xn=Ni(ji),$i=Li(xn),Fi=t=>(t*=2)<1?.5*xn(t):.5*(2-Math.pow(2,-10*(t-1))),kn=t=>1-Math.sin(Math.acos(t)),Bi=Ni(kn),Oi=Li(kn),Ii=t=>/^0[^.\s]+$/u.test(t);function Cu(t){return typeof t=="number"?t===0:t!==null?t==="none"||t==="0"||Ii(t):!0}const St=t=>Math.round(t*1e5)/1e5,Mn=/-?(?:\d+(?:\.\d+)?|\.\d+)/gu;function Vu(t){return t==null}const _u=/^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu,bn=(t,e)=>n=>!!(typeof n=="string"&&_u.test(n)&&n.startsWith(t)||e&&!Vu(n)&&Object.prototype.hasOwnProperty.call(n,e)),zi=(t,e,n)=>s=>{if(typeof s!="string")return s;const[i,r,o,a]=s.match(Mn);return{[t]:parseFloat(i),[e]:parseFloat(r),[n]:parseFloat(o),alpha:a!==void 0?parseFloat(a):1}},Du=t=>J(0,255,t),ge={...bt,transform:t=>Math.round(Du(t))},lt={test:bn("rgb","red"),parse:zi("red","green","blue"),transform:({red:t,green:e,blue:n,alpha:s=1})=>"rgba("+ge.transform(t)+", "+ge.transform(e)+", "+ge.transform(n)+", "+St(Et.transform(s))+")"};function Eu(t){let e="",n="",s="",i="";return t.length>5?(e=t.substring(1,3),n=t.substring(3,5),s=t.substring(5,7),i=t.substring(7,9)):(e=t.substring(1,2),n=t.substring(2,3),s=t.substring(3,4),i=t.substring(4,5),e+=e,n+=n,s+=s,i+=i),{red:parseInt(e,16),green:parseInt(n,16),blue:parseInt(s,16),alpha:i?parseInt(i,16)/255:1}}const Le={test:bn("#"),parse:Eu,transform:lt.transform},pt={test:bn("hsl","hue"),parse:zi("hue","saturation","lightness"),transform:({hue:t,saturation:e,lightness:n,alpha:s=1})=>"hsla("+Math.round(t)+", "+H.transform(St(e))+", "+H.transform(St(n))+", "+St(Et.transform(s))+")"},N={test:t=>lt.test(t)||Le.test(t)||pt.test(t),parse:t=>lt.test(t)?lt.parse(t):pt.test(t)?pt.parse(t):Le.parse(t),transform:t=>typeof t=="string"?t:t.hasOwnProperty("red")?lt.transform(t):pt.transform(t)},Ru=/(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;function Lu(t){var e,n;return isNaN(t)&&typeof t=="string"&&(((e=t.match(Mn))===null||e===void 0?void 0:e.length)||0)+(((n=t.match(Ru))===null||n===void 0?void 0:n.length)||0)>0}const Ui="number",qi="color",Nu="var",ju="var(",Hn="${}",$u=/var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;function Lt(t){const e=t.toString(),n=[],s={color:[],number:[],var:[]},i=[];let r=0;const a=e.replace($u,c=>(N.test(c)?(s.color.push(r),i.push(qi),n.push(N.parse(c))):c.startsWith(ju)?(s.var.push(r),i.push(Nu),n.push(c)):(s.number.push(r),i.push(Ui),n.push(parseFloat(c))),++r,Hn)).split(Hn);return{values:n,split:a,indexes:s,types:i}}function Hi(t){return Lt(t).values}function Ki(t){const{split:e,types:n}=Lt(t),s=e.length;return i=>{let r="";for(let o=0;o<s;o++)if(r+=e[o],i[o]!==void 0){const a=n[o];a===Ui?r+=St(i[o]):a===qi?r+=N.transform(i[o]):r+=i[o]}return r}}const Fu=t=>typeof t=="number"?0:t;function Bu(t){const e=Hi(t);return Ki(t)(e.map(Fu))}const st={test:Lu,parse:Hi,createTransformer:Ki,getAnimatableNone:Bu},Ou=new Set(["brightness","contrast","saturate","opacity"]);function Iu(t){const[e,n]=t.slice(0,-1).split("(");if(e==="drop-shadow")return t;const[s]=n.match(Mn)||[];if(!s)return t;const i=n.replace(s,"");let r=Ou.has(e)?1:0;return s!==n&&(r*=100),e+"("+r+i+")"}const zu=/\b([a-z-]*)\(.*?\)/gu,Ne={...st,getAnimatableNone:t=>{const e=t.match(zu);return e?e.map(Iu).join(" "):t}},Uu={...rn,color:N,backgroundColor:N,outlineColor:N,fill:N,stroke:N,borderColor:N,borderTopColor:N,borderRightColor:N,borderBottomColor:N,borderLeftColor:N,filter:Ne,WebkitFilter:Ne},wn=t=>Uu[t];function Wi(t,e){let n=wn(t);return n!==Ne&&(n=st),n.getAnimatableNone?n.getAnimatableNone(e):void 0}const qu=new Set(["auto","none","0"]);function Hu(t,e,n){let s=0,i;for(;s<t.length&&!i;){const r=t[s];typeof r=="string"&&!qu.has(r)&&Lt(r).values.length&&(i=t[s]),s++}if(i&&n)for(const r of e)t[r]=Wi(n,i)}const Kn=t=>t===bt||t===w,Wn=(t,e)=>parseFloat(t.split(", ")[e]),Gn=(t,e)=>(n,{transform:s})=>{if(s==="none"||!s)return 0;const i=s.match(/^matrix3d\((.+)\)$/u);if(i)return Wn(i[1],e);{const r=s.match(/^matrix\((.+)\)$/u);return r?Wn(r[1],t):0}},Ku=new Set(["x","y","z"]),Wu=Mt.filter(t=>!Ku.has(t));function Gu(t){const e=[];return Wu.forEach(n=>{const s=t.getValue(n);s!==void 0&&(e.push([n,s.get()]),s.set(n.startsWith("scale")?1:0))}),e}const kt={width:({x:t},{paddingLeft:e="0",paddingRight:n="0"})=>t.max-t.min-parseFloat(e)-parseFloat(n),height:({y:t},{paddingTop:e="0",paddingBottom:n="0"})=>t.max-t.min-parseFloat(e)-parseFloat(n),top:(t,{top:e})=>parseFloat(e),left:(t,{left:e})=>parseFloat(e),bottom:({y:t},{top:e})=>parseFloat(e)+(t.max-t.min),right:({x:t},{left:e})=>parseFloat(e)+(t.max-t.min),x:Gn(4,13),y:Gn(5,14)};kt.translateX=kt.x;kt.translateY=kt.y;const ut=new Set;let je=!1,$e=!1;function Gi(){if($e){const t=Array.from(ut).filter(s=>s.needsMeasurement),e=new Set(t.map(s=>s.element)),n=new Map;e.forEach(s=>{const i=Gu(s);i.length&&(n.set(s,i),s.render())}),t.forEach(s=>s.measureInitialState()),e.forEach(s=>{s.render();const i=n.get(s);i&&i.forEach(([r,o])=>{var a;(a=s.getValue(r))===null||a===void 0||a.set(o)})}),t.forEach(s=>s.measureEndState()),t.forEach(s=>{s.suspendedScrollY!==void 0&&window.scrollTo(0,s.suspendedScrollY)})}$e=!1,je=!1,ut.forEach(t=>t.complete()),ut.clear()}function Xi(){ut.forEach(t=>{t.readKeyframes(),t.needsMeasurement&&($e=!0)})}function Xu(){Xi(),Gi()}class Tn{constructor(e,n,s,i,r,o=!1){this.isComplete=!1,this.isAsync=!1,this.needsMeasurement=!1,this.isScheduled=!1,this.unresolvedKeyframes=[...e],this.onComplete=n,this.name=s,this.motionValue=i,this.element=r,this.isAsync=o}scheduleResolve(){this.isScheduled=!0,this.isAsync?(ut.add(this),je||(je=!0,S.read(Xi),S.resolveKeyframes(Gi))):(this.readKeyframes(),this.complete())}readKeyframes(){const{unresolvedKeyframes:e,name:n,element:s,motionValue:i}=this;for(let r=0;r<e.length;r++)if(e[r]===null)if(r===0){const o=i==null?void 0:i.get(),a=e[e.length-1];if(o!==void 0)e[0]=o;else if(s&&n){const c=s.readValue(n,a);c!=null&&(e[0]=c)}e[0]===void 0&&(e[0]=a),i&&o===void 0&&i.set(e[0])}else e[r]=e[r-1]}setFinalKeyframe(){}measureInitialState(){}renderEndStyles(){}measureEndState(){}complete(){this.isComplete=!0,this.onComplete(this.unresolvedKeyframes,this.finalKeyframe),ut.delete(this)}cancel(){this.isComplete||(this.isScheduled=!1,ut.delete(this))}resume(){this.isComplete||this.scheduleResolve()}}const Yi=t=>/^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(t),Yu=/^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;function Zu(t){const e=Yu.exec(t);if(!e)return[,];const[,n,s,i]=e;return[`--${n??s}`,i]}function Zi(t,e,n=1){const[s,i]=Zu(t);if(!s)return;const r=window.getComputedStyle(e).getPropertyValue(s);if(r){const o=r.trim();return Yi(o)?parseFloat(o):o}return on(i)?Zi(i,e,n+1):i}const Qi=t=>e=>e.test(t),Qu={test:t=>t==="auto",parse:t=>t},Ji=[bt,w,H,tt,Il,Ol,Qu],Xn=t=>Ji.find(Qi(t));class to extends Tn{constructor(e,n,s,i,r){super(e,n,s,i,r,!0)}readKeyframes(){const{unresolvedKeyframes:e,element:n,name:s}=this;if(!n||!n.current)return;super.readKeyframes();for(let c=0;c<e.length;c++){let l=e[c];if(typeof l=="string"&&(l=l.trim(),on(l))){const u=Zi(l,n.current);u!==void 0&&(e[c]=u),c===e.length-1&&(this.finalKeyframe=l)}}if(this.resolveNoneKeyframes(),!_i.has(s)||e.length!==2)return;const[i,r]=e,o=Xn(i),a=Xn(r);if(o!==a)if(Kn(o)&&Kn(a))for(let c=0;c<e.length;c++){const l=e[c];typeof l=="string"&&(e[c]=parseFloat(l))}else this.needsMeasurement=!0}resolveNoneKeyframes(){const{unresolvedKeyframes:e,name:n}=this,s=[];for(let i=0;i<e.length;i++)Cu(e[i])&&s.push(i);s.length&&Hu(e,s,n)}measureInitialState(){const{element:e,unresolvedKeyframes:n,name:s}=this;if(!e||!e.current)return;s==="height"&&(this.suspendedScrollY=window.pageYOffset),this.measuredOrigin=kt[s](e.measureViewportBox(),window.getComputedStyle(e.current)),n[0]=this.measuredOrigin;const i=n[n.length-1];i!==void 0&&e.getValue(s,i).jump(i,!1)}measureEndState(){var e;const{element:n,name:s,unresolvedKeyframes:i}=this;if(!n||!n.current)return;const r=n.getValue(s);r&&r.jump(this.measuredOrigin,!1);const o=i.length-1,a=i[o];i[o]=kt[s](n.measureViewportBox(),window.getComputedStyle(n.current)),a!==null&&this.finalKeyframe===void 0&&(this.finalKeyframe=a),!((e=this.removedTransforms)===null||e===void 0)&&e.length&&this.removedTransforms.forEach(([c,l])=>{n.getValue(c).set(l)}),this.resolveNoneKeyframes()}}const Yn=(t,e)=>e==="zIndex"?!1:!!(typeof t=="number"||Array.isArray(t)||typeof t=="string"&&(st.test(t)||t==="0")&&!t.startsWith("url("));function Ju(t){const e=t[0];if(t.length===1)return!0;for(let n=0;n<t.length;n++)if(t[n]!==e)return!0}function th(t,e,n,s){const i=t[0];if(i===null)return!1;if(e==="display"||e==="visibility")return!0;const r=t[t.length-1],o=Yn(i,e),a=Yn(r,e);return!o||!a?!1:Ju(t)||(n==="spring"||fn(n))&&s}const eh=t=>t!==null;function he(t,{repeat:e,repeatType:n="loop"},s){const i=t.filter(eh),r=e&&n!=="loop"&&e%2===1?0:i.length-1;return!r||s===void 0?i[r]:s}const nh=40;class eo{constructor({autoplay:e=!0,delay:n=0,type:s="keyframes",repeat:i=0,repeatDelay:r=0,repeatType:o="loop",...a}){this.isStopped=!1,this.hasAttemptedResolve=!1,this.createdAt=K.now(),this.options={autoplay:e,delay:n,type:s,repeat:i,repeatDelay:r,repeatType:o,...a},this.updateFinishedPromise()}calcStartTime(){return this.resolvedAt?this.resolvedAt-this.createdAt>nh?this.resolvedAt:this.createdAt:this.createdAt}get resolved(){return!this._resolved&&!this.hasAttemptedResolve&&Xu(),this._resolved}onKeyframesResolved(e,n){this.resolvedAt=K.now(),this.hasAttemptedResolve=!0;const{name:s,type:i,velocity:r,delay:o,onComplete:a,onUpdate:c,isGenerator:l}=this.options;if(!l&&!th(e,s,i,r))if(o)this.options.duration=0;else{c&&c(he(e,this.options,n)),a&&a(),this.resolveFinishedPromise();return}const u=this.initPlayback(e,n);u!==!1&&(this._resolved={keyframes:e,finalKeyframe:n,...u},this.onPostResolved())}onPostResolved(){}then(e,n){return this.currentFinishedPromise.then(e,n)}flatten(){this.options.type="keyframes",this.options.ease="linear"}updateFinishedPromise(){this.currentFinishedPromise=new Promise(e=>{this.resolveFinishedPromise=e})}}const C=(t,e,n)=>t+(e-t)*n;function ve(t,e,n){return n<0&&(n+=1),n>1&&(n-=1),n<1/6?t+(e-t)*6*n:n<1/2?e:n<2/3?t+(e-t)*(2/3-n)*6:t}function sh({hue:t,saturation:e,lightness:n,alpha:s}){t/=360,e/=100,n/=100;let i=0,r=0,o=0;if(!e)i=r=o=n;else{const a=n<.5?n*(1+e):n+e-n*e,c=2*n-a;i=ve(c,a,t+1/3),r=ve(c,a,t),o=ve(c,a,t-1/3)}return{red:Math.round(i*255),green:Math.round(r*255),blue:Math.round(o*255),alpha:s}}function te(t,e){return n=>n>0?e:t}const xe=(t,e,n)=>{const s=t*t,i=n*(e*e-s)+s;return i<0?0:Math.sqrt(i)},ih=[Le,lt,pt],oh=t=>ih.find(e=>e.test(t));function Zn(t){const e=oh(t);if(!e)return!1;let n=e.parse(t);return e===pt&&(n=sh(n)),n}const Qn=(t,e)=>{const n=Zn(t),s=Zn(e);if(!n||!s)return te(t,e);const i={...n};return r=>(i.red=xe(n.red,s.red,r),i.green=xe(n.green,s.green,r),i.blue=xe(n.blue,s.blue,r),i.alpha=C(n.alpha,s.alpha,r),lt.transform(i))},rh=(t,e)=>n=>e(t(n)),Bt=(...t)=>t.reduce(rh),Fe=new Set(["none","hidden"]);function ah(t,e){return Fe.has(t)?n=>n<=0?t:e:n=>n>=1?e:t}function ch(t,e){return n=>C(t,e,n)}function Pn(t){return typeof t=="number"?ch:typeof t=="string"?on(t)?te:N.test(t)?Qn:hh:Array.isArray(t)?no:typeof t=="object"?N.test(t)?Qn:lh:te}function no(t,e){const n=[...t],s=n.length,i=t.map((r,o)=>Pn(r)(r,e[o]));return r=>{for(let o=0;o<s;o++)n[o]=i[o](r);return n}}function lh(t,e){const n={...t,...e},s={};for(const i in n)t[i]!==void 0&&e[i]!==void 0&&(s[i]=Pn(t[i])(t[i],e[i]));return i=>{for(const r in s)n[r]=s[r](i);return n}}function uh(t,e){var n;const s=[],i={color:0,var:0,number:0};for(let r=0;r<e.values.length;r++){const o=e.types[r],a=t.indexes[o][i[o]],c=(n=t.values[a])!==null&&n!==void 0?n:0;s[r]=c,i[o]++}return s}const hh=(t,e)=>{const n=st.createTransformer(e),s=Lt(t),i=Lt(e);return s.indexes.var.length===i.indexes.var.length&&s.indexes.color.length===i.indexes.color.length&&s.indexes.number.length>=i.indexes.number.length?Fe.has(t)&&!i.values.length||Fe.has(e)&&!s.values.length?ah(t,e):Bt(no(uh(s,i),i.values),n):te(t,e)};function so(t,e,n){return typeof t=="number"&&typeof e=="number"&&typeof n=="number"?C(t,e,n):Pn(t)(t,e)}const dh=5;function io(t,e,n){const s=Math.max(e-dh,0);return Di(n-t(s),e-s)}const V={stiffness:100,damping:10,mass:1,velocity:0,duration:800,bounce:.3,visualDuration:.3,restSpeed:{granular:.01,default:2},restDelta:{granular:.005,default:.5},minDuration:.01,maxDuration:10,minDamping:.05,maxDamping:1},ke=.001;function fh({duration:t=V.duration,bounce:e=V.bounce,velocity:n=V.velocity,mass:s=V.mass}){let i,r,o=1-e;o=J(V.minDamping,V.maxDamping,o),t=J(V.minDuration,V.maxDuration,Z(t)),o<1?(i=l=>{const u=l*o,h=u*t,d=u-n,p=Be(l,o),y=Math.exp(-h);return ke-d/p*y},r=l=>{const h=l*o*t,d=h*n+n,p=Math.pow(o,2)*Math.pow(l,2)*t,y=Math.exp(-h),g=Be(Math.pow(l,2),o);return(-i(l)+ke>0?-1:1)*((d-p)*y)/g}):(i=l=>{const u=Math.exp(-l*t),h=(l-n)*t+1;return-ke+u*h},r=l=>{const u=Math.exp(-l*t),h=(n-l)*(t*t);return u*h});const a=5/t,c=mh(i,r,a);if(t=Y(t),isNaN(c))return{stiffness:V.stiffness,damping:V.damping,duration:t};{const l=Math.pow(c,2)*s;return{stiffness:l,damping:o*2*Math.sqrt(s*l),duration:t}}}const ph=12;function mh(t,e,n){let s=n;for(let i=1;i<ph;i++)s=s-t(s)/e(s);return s}function Be(t,e){return t*Math.sqrt(1-e*e)}const yh=["duration","bounce"],gh=["stiffness","damping","mass"];function Jn(t,e){return e.some(n=>t[n]!==void 0)}function vh(t){let e={velocity:V.velocity,stiffness:V.stiffness,damping:V.damping,mass:V.mass,isResolvedFromDuration:!1,...t};if(!Jn(t,gh)&&Jn(t,yh))if(t.visualDuration){const n=t.visualDuration,s=2*Math.PI/(n*1.2),i=s*s,r=2*J(.05,1,1-(t.bounce||0))*Math.sqrt(i);e={...e,mass:V.mass,stiffness:i,damping:r}}else{const n=fh(t);e={...e,...n,mass:V.mass},e.isResolvedFromDuration=!0}return e}function oo(t=V.visualDuration,e=V.bounce){const n=typeof t!="object"?{visualDuration:t,keyframes:[0,1],bounce:e}:t;let{restSpeed:s,restDelta:i}=n;const r=n.keyframes[0],o=n.keyframes[n.keyframes.length-1],a={done:!1,value:r},{stiffness:c,damping:l,mass:u,duration:h,velocity:d,isResolvedFromDuration:p}=vh({...n,velocity:-Z(n.velocity||0)}),y=d||0,g=l/(2*Math.sqrt(c*u)),v=o-r,x=Z(Math.sqrt(c/u)),M=Math.abs(v)<5;s||(s=M?V.restSpeed.granular:V.restSpeed.default),i||(i=M?V.restDelta.granular:V.restDelta.default);let k;if(g<1){const b=Be(x,g);k=A=>{const _=Math.exp(-g*x*A);return o-_*((y+g*x*v)/b*Math.sin(b*A)+v*Math.cos(b*A))}}else if(g===1)k=b=>o-Math.exp(-x*b)*(v+(y+x*v)*b);else{const b=x*Math.sqrt(g*g-1);k=A=>{const _=Math.exp(-g*x*A),P=Math.min(b*A,300);return o-_*((y+g*x*v)*Math.sinh(P)+b*v*Math.cosh(P))/b}}const T={calculatedDuration:p&&h||null,next:b=>{const A=k(b);if(p)a.done=b>=h;else{let _=0;g<1&&(_=b===0?Y(y):io(k,b,A));const P=Math.abs(_)<=s,L=Math.abs(o-A)<=i;a.done=P&&L}return a.value=a.done?o:A,a},toString:()=>{const b=Math.min(wi(T),De),A=Ti(_=>T.next(b*_).value,b,30);return b+"ms "+A}};return T}function ts({keyframes:t,velocity:e=0,power:n=.8,timeConstant:s=325,bounceDamping:i=10,bounceStiffness:r=500,modifyTarget:o,min:a,max:c,restDelta:l=.5,restSpeed:u}){const h=t[0],d={done:!1,value:h},p=P=>a!==void 0&&P<a||c!==void 0&&P>c,y=P=>a===void 0?c:c===void 0||Math.abs(a-P)<Math.abs(c-P)?a:c;let g=n*e;const v=h+g,x=o===void 0?v:o(v);x!==v&&(g=x-h);const M=P=>-g*Math.exp(-P/s),k=P=>x+M(P),T=P=>{const L=M(P),O=k(P);d.done=Math.abs(L)<=l,d.value=d.done?x:O};let b,A;const _=P=>{p(d.value)&&(b=P,A=oo({keyframes:[d.value,y(d.value)],velocity:io(k,P,d.value),damping:i,stiffness:r,restDelta:l,restSpeed:u}))};return _(0),{calculatedDuration:null,next:P=>{let L=!1;return!A&&b===void 0&&(L=!0,T(P),_(P)),b!==void 0&&P>=b?A.next(P-b):(!L&&T(P),d)}}}const xh=Ft(.42,0,1,1),kh=Ft(0,0,.58,1),ro=Ft(.42,0,.58,1),Mh=t=>Array.isArray(t)&&typeof t[0]!="number",bh={linear:F,easeIn:xh,easeInOut:ro,easeOut:kh,circIn:kn,circInOut:Oi,circOut:Bi,backIn:xn,backInOut:$i,backOut:ji,anticipate:Fi},es=t=>{if(pn(t)){si(t.length===4);const[e,n,s,i]=t;return Ft(e,n,s,i)}else if(typeof t=="string")return bh[t];return t};function wh(t,e,n){const s=[],i=n||so,r=t.length-1;for(let o=0;o<r;o++){let a=i(t[o],t[o+1]);if(e){const c=Array.isArray(e)?e[o]||F:e;a=Bt(c,a)}s.push(a)}return s}function Th(t,e,{clamp:n=!0,ease:s,mixer:i}={}){const r=t.length;if(si(r===e.length),r===1)return()=>e[0];if(r===2&&e[0]===e[1])return()=>e[1];const o=t[0]===t[1];t[0]>t[r-1]&&(t=[...t].reverse(),e=[...e].reverse());const a=wh(e,s,i),c=a.length,l=u=>{if(o&&u<t[0])return e[0];let h=0;if(c>1)for(;h<t.length-2&&!(u<t[h+1]);h++);const d=vt(t[h],t[h+1],u);return a[h](d)};return n?u=>l(J(t[0],t[r-1],u)):l}function Ph(t,e){const n=t[t.length-1];for(let s=1;s<=e;s++){const i=vt(0,e,s);t.push(C(n,1,i))}}function Ah(t){const e=[0];return Ph(e,t.length-1),e}function Sh(t,e){return t.map(n=>n*e)}function Ch(t,e){return t.map(()=>e||ro).splice(0,t.length-1)}function ee({duration:t=300,keyframes:e,times:n,ease:s="easeInOut"}){const i=Mh(s)?s.map(es):es(s),r={done:!1,value:e[0]},o=Sh(n&&n.length===e.length?n:Ah(e),t),a=Th(o,e,{ease:Array.isArray(i)?i:Ch(e,i)});return{calculatedDuration:t,next:c=>(r.value=a(c),r.done=c>=t,r)}}const Vh=t=>{const e=({timestamp:n})=>t(n);return{start:()=>S.update(e,!0),stop:()=>nt(e),now:()=>R.isProcessing?R.timestamp:K.now()}},_h={decay:ts,inertia:ts,tween:ee,keyframes:ee,spring:oo},Dh=t=>t/100;class An extends eo{constructor(e){super(e),this.holdTime=null,this.cancelTime=null,this.currentTime=0,this.playbackSpeed=1,this.pendingPlayState="running",this.startTime=null,this.state="idle",this.stop=()=>{if(this.resolver.cancel(),this.isStopped=!0,this.state==="idle")return;this.teardown();const{onStop:c}=this.options;c&&c()};const{name:n,motionValue:s,element:i,keyframes:r}=this.options,o=(i==null?void 0:i.KeyframeResolver)||Tn,a=(c,l)=>this.onKeyframesResolved(c,l);this.resolver=new o(r,a,n,s,i),this.resolver.scheduleResolve()}flatten(){super.flatten(),this._resolved&&Object.assign(this._resolved,this.initPlayback(this._resolved.keyframes))}initPlayback(e){const{type:n="keyframes",repeat:s=0,repeatDelay:i=0,repeatType:r,velocity:o=0}=this.options,a=fn(n)?n:_h[n]||ee;let c,l;a!==ee&&typeof e[0]!="number"&&(c=Bt(Dh,so(e[0],e[1])),e=[0,100]);const u=a({...this.options,keyframes:e});r==="mirror"&&(l=a({...this.options,keyframes:[...e].reverse(),velocity:-o})),u.calculatedDuration===null&&(u.calculatedDuration=wi(u));const{calculatedDuration:h}=u,d=h+i,p=d*(s+1)-i;return{generator:u,mirroredGenerator:l,mapPercentToKeyframes:c,calculatedDuration:h,resolvedDuration:d,totalDuration:p}}onPostResolved(){const{autoplay:e=!0}=this.options;this.play(),this.pendingPlayState==="paused"||!e?this.pause():this.state=this.pendingPlayState}tick(e,n=!1){const{resolved:s}=this;if(!s){const{keyframes:P}=this.options;return{done:!0,value:P[P.length-1]}}const{finalKeyframe:i,generator:r,mirroredGenerator:o,mapPercentToKeyframes:a,keyframes:c,calculatedDuration:l,totalDuration:u,resolvedDuration:h}=s;if(this.startTime===null)return r.next(0);const{delay:d,repeat:p,repeatType:y,repeatDelay:g,onUpdate:v}=this.options;this.speed>0?this.startTime=Math.min(this.startTime,e):this.speed<0&&(this.startTime=Math.min(e-u/this.speed,this.startTime)),n?this.currentTime=e:this.holdTime!==null?this.currentTime=this.holdTime:this.currentTime=Math.round(e-this.startTime)*this.speed;const x=this.currentTime-d*(this.speed>=0?1:-1),M=this.speed>=0?x<0:x>u;this.currentTime=Math.max(x,0),this.state==="finished"&&this.holdTime===null&&(this.currentTime=u);let k=this.currentTime,T=r;if(p){const P=Math.min(this.currentTime,u)/h;let L=Math.floor(P),O=P%1;!O&&P>=1&&(O=1),O===1&&L--,L=Math.min(L,p+1),!!(L%2)&&(y==="reverse"?(O=1-O,g&&(O-=g/h)):y==="mirror"&&(T=o)),k=J(0,1,O)*h}const b=M?{done:!1,value:c[0]}:T.next(k);a&&(b.value=a(b.value));let{done:A}=b;!M&&l!==null&&(A=this.speed>=0?this.currentTime>=u:this.currentTime<=0);const _=this.holdTime===null&&(this.state==="finished"||this.state==="running"&&A);return _&&i!==void 0&&(b.value=he(c,this.options,i)),v&&v(b.value),_&&this.finish(),b}get duration(){const{resolved:e}=this;return e?Z(e.calculatedDuration):0}get time(){return Z(this.currentTime)}set time(e){e=Y(e),this.currentTime=e,this.holdTime!==null||this.speed===0?this.holdTime=e:this.driver&&(this.startTime=this.driver.now()-e/this.speed)}get speed(){return this.playbackSpeed}set speed(e){const n=this.playbackSpeed!==e;this.playbackSpeed=e,n&&(this.time=Z(this.currentTime))}play(){if(this.resolver.isScheduled||this.resolver.resume(),!this._resolved){this.pendingPlayState="running";return}if(this.isStopped)return;const{driver:e=Vh,onPlay:n,startTime:s}=this.options;this.driver||(this.driver=e(r=>this.tick(r))),n&&n();const i=this.driver.now();this.holdTime!==null?this.startTime=i-this.holdTime:this.startTime?this.state==="finished"&&(this.startTime=i):this.startTime=s??this.calcStartTime(),this.state==="finished"&&this.updateFinishedPromise(),this.cancelTime=this.startTime,this.holdTime=null,this.state="running",this.driver.start()}pause(){var e;if(!this._resolved){this.pendingPlayState="paused";return}this.state="paused",this.holdTime=(e=this.currentTime)!==null&&e!==void 0?e:0}complete(){this.state!=="running"&&this.play(),this.pendingPlayState=this.state="finished",this.holdTime=null}finish(){this.teardown(),this.state="finished";const{onComplete:e}=this.options;e&&e()}cancel(){this.cancelTime!==null&&this.tick(this.cancelTime),this.teardown(),this.updateFinishedPromise()}teardown(){this.state="idle",this.stopDriver(),this.resolveFinishedPromise(),this.updateFinishedPromise(),this.startTime=this.cancelTime=null,this.resolver.cancel()}stopDriver(){this.driver&&(this.driver.stop(),this.driver=void 0)}sample(e){return this.startTime=0,this.tick(e,!0)}}const Eh=new Set(["opacity","clipPath","filter","transform"]);function Rh(t,e,n,{delay:s=0,duration:i=300,repeat:r=0,repeatType:o="loop",ease:a="easeInOut",times:c}={}){const l={[e]:n};c&&(l.offset=c);const u=Ai(a,i);return Array.isArray(u)&&(l.easing=u),t.animate(l,{delay:s,duration:i,easing:Array.isArray(u)?"linear":u,fill:"both",iterations:r+1,direction:o==="reverse"?"alternate":"normal"})}const Lh=Ze(()=>Object.hasOwnProperty.call(Element.prototype,"animate")),ne=10,Nh=2e4;function jh(t){return fn(t.type)||t.type==="spring"||!Pi(t.ease)}function $h(t,e){const n=new An({...e,keyframes:t,repeat:0,delay:0,isGenerator:!0});let s={done:!1,value:t[0]};const i=[];let r=0;for(;!s.done&&r<Nh;)s=n.sample(r),i.push(s.value),r+=ne;return{times:void 0,keyframes:i,duration:r-ne,ease:"linear"}}const ao={anticipate:Fi,backInOut:$i,circInOut:Oi};function Fh(t){return t in ao}class ns extends eo{constructor(e){super(e);const{name:n,motionValue:s,element:i,keyframes:r}=this.options;this.resolver=new to(r,(o,a)=>this.onKeyframesResolved(o,a),n,s,i),this.resolver.scheduleResolve()}initPlayback(e,n){let{duration:s=300,times:i,ease:r,type:o,motionValue:a,name:c,startTime:l}=this.options;if(!a.owner||!a.owner.current)return!1;if(typeof r=="string"&&Jt()&&Fh(r)&&(r=ao[r]),jh(this.options)){const{onComplete:h,onUpdate:d,motionValue:p,element:y,...g}=this.options,v=$h(e,g);e=v.keyframes,e.length===1&&(e[1]=e[0]),s=v.duration,i=v.times,r=v.ease,o="keyframes"}const u=Rh(a.owner.current,c,e,{...this.options,duration:s,times:i,ease:r});return u.startTime=l??this.calcStartTime(),this.pendingTimeline?(On(u,this.pendingTimeline),this.pendingTimeline=void 0):u.onfinish=()=>{const{onComplete:h}=this.options;a.set(he(e,this.options,n)),h&&h(),this.cancel(),this.resolveFinishedPromise()},{animation:u,duration:s,times:i,type:o,ease:r,keyframes:e}}get duration(){const{resolved:e}=this;if(!e)return 0;const{duration:n}=e;return Z(n)}get time(){const{resolved:e}=this;if(!e)return 0;const{animation:n}=e;return Z(n.currentTime||0)}set time(e){const{resolved:n}=this;if(!n)return;const{animation:s}=n;s.currentTime=Y(e)}get speed(){const{resolved:e}=this;if(!e)return 1;const{animation:n}=e;return n.playbackRate}set speed(e){const{resolved:n}=this;if(!n)return;const{animation:s}=n;s.playbackRate=e}get state(){const{resolved:e}=this;if(!e)return"idle";const{animation:n}=e;return n.playState}get startTime(){const{resolved:e}=this;if(!e)return null;const{animation:n}=e;return n.startTime}attachTimeline(e){if(!this._resolved)this.pendingTimeline=e;else{const{resolved:n}=this;if(!n)return F;const{animation:s}=n;On(s,e)}return F}play(){if(this.isStopped)return;const{resolved:e}=this;if(!e)return;const{animation:n}=e;n.playState==="finished"&&this.updateFinishedPromise(),n.play()}pause(){const{resolved:e}=this;if(!e)return;const{animation:n}=e;n.pause()}stop(){if(this.resolver.cancel(),this.isStopped=!0,this.state==="idle")return;this.resolveFinishedPromise(),this.updateFinishedPromise();const{resolved:e}=this;if(!e)return;const{animation:n,keyframes:s,duration:i,type:r,ease:o,times:a}=e;if(n.playState==="idle"||n.playState==="finished")return;if(this.time){const{motionValue:l,onUpdate:u,onComplete:h,element:d,...p}=this.options,y=new An({...p,keyframes:s,duration:i,type:r,ease:o,times:a,isGenerator:!0}),g=Y(this.time);l.setWithVelocity(y.sample(g-ne).value,y.sample(g).value,ne)}const{onStop:c}=this.options;c&&c(),this.cancel()}complete(){const{resolved:e}=this;e&&e.animation.finish()}cancel(){const{resolved:e}=this;e&&e.animation.cancel()}static supports(e){const{motionValue:n,name:s,repeatDelay:i,repeatType:r,damping:o,type:a}=e;if(!n||!n.owner||!(n.owner.current instanceof HTMLElement))return!1;const{onUpdate:c,transformTemplate:l}=n.owner.getProps();return Lh()&&s&&Eh.has(s)&&!c&&!l&&!i&&r!=="mirror"&&o!==0&&a!=="inertia"}}const Bh={type:"spring",stiffness:500,damping:25,restSpeed:10},Oh=t=>({type:"spring",stiffness:550,damping:t===0?2*Math.sqrt(550):30,restSpeed:10}),Ih={type:"keyframes",duration:.8},zh={type:"keyframes",ease:[.25,.1,.35,1],duration:.3},Uh=(t,{keyframes:e})=>e.length>2?Ih:ht.has(t)?t.startsWith("scale")?Oh(e[1]):Bh:zh;function qh({when:t,delay:e,delayChildren:n,staggerChildren:s,staggerDirection:i,repeat:r,repeatType:o,repeatDelay:a,from:c,elapsed:l,...u}){return!!Object.keys(u).length}const Sn=(t,e,n,s={},i,r)=>o=>{const a=dn(s,t)||{},c=a.delay||s.delay||0;let{elapsed:l=0}=s;l=l-Y(c);let u={keyframes:Array.isArray(n)?n:[null,n],ease:"easeOut",velocity:e.getVelocity(),...a,delay:-l,onUpdate:d=>{e.set(d),a.onUpdate&&a.onUpdate(d)},onComplete:()=>{o(),a.onComplete&&a.onComplete()},name:t,motionValue:e,element:r?void 0:i};qh(a)||(u={...u,...Uh(t,u)}),u.duration&&(u.duration=Y(u.duration)),u.repeatDelay&&(u.repeatDelay=Y(u.repeatDelay)),u.from!==void 0&&(u.keyframes[0]=u.from);let h=!1;if((u.type===!1||u.duration===0&&!u.repeatDelay)&&(u.duration=0,u.delay===0&&(h=!0)),h&&!r&&e.get()!==void 0){const d=he(u.keyframes,a);if(d!==void 0)return S.update(()=>{u.onUpdate(d),u.onComplete()}),new lu([])}return!r&&ns.supports(u)?new ns(u):new An(u)};function Hh({protectedKeys:t,needsAnimating:e},n){const s=t.hasOwnProperty(n)&&e[n]!==!0;return e[n]=!1,s}function co(t,e,{delay:n=0,transitionOverride:s,type:i}={}){var r;let{transition:o=t.getDefaultTransition(),transitionEnd:a,...c}=e;s&&(o=s);const l=[],u=i&&t.animationState&&t.animationState.getState()[i];for(const h in c){const d=t.getValue(h,(r=t.latestValues[h])!==null&&r!==void 0?r:null),p=c[h];if(p===void 0||u&&Hh(u,h))continue;const y={delay:n,...dn(o||{},h)};let g=!1;if(window.MotionHandoffAnimation){const x=Ei(t);if(x){const M=window.MotionHandoffAnimation(x,h,S);M!==null&&(y.startTime=M,g=!0)}}Re(t,h),d.start(Sn(h,d,p,t.shouldReduceMotion&&_i.has(h)?{type:!1}:y,t,g));const v=d.animation;v&&l.push(v)}return a&&Promise.all(l).then(()=>{S.update(()=>{a&&wu(t,a)})}),l}function Oe(t,e,n={}){var s;const i=ue(t,e,n.type==="exit"?(s=t.presenceContext)===null||s===void 0?void 0:s.custom:void 0);let{transition:r=t.getDefaultTransition()||{}}=i||{};n.transitionOverride&&(r=n.transitionOverride);const o=i?()=>Promise.all(co(t,i,n)):()=>Promise.resolve(),a=t.variantChildren&&t.variantChildren.size?(l=0)=>{const{delayChildren:u=0,staggerChildren:h,staggerDirection:d}=r;return Kh(t,e,u+l,h,d,n)}:()=>Promise.resolve(),{when:c}=r;if(c){const[l,u]=c==="beforeChildren"?[o,a]:[a,o];return l().then(()=>u())}else return Promise.all([o(),a(n.delay)])}function Kh(t,e,n=0,s=0,i=1,r){const o=[],a=(t.variantChildren.size-1)*s,c=i===1?(l=0)=>l*s:(l=0)=>a-l*s;return Array.from(t.variantChildren).sort(Wh).forEach((l,u)=>{l.notify("AnimationStart",e),o.push(Oe(l,e,{...r,delay:n+c(u)}).then(()=>l.notify("AnimationComplete",e)))}),Promise.all(o)}function Wh(t,e){return t.sortNodePosition(e)}function Gh(t,e,n={}){t.notify("AnimationStart",e);let s;if(Array.isArray(e)){const i=e.map(r=>Oe(t,r,n));s=Promise.all(i)}else if(typeof e=="string")s=Oe(t,e,n);else{const i=typeof e=="function"?ue(t,e,n.custom):e;s=Promise.all(co(t,i,n))}return s.then(()=>{t.notify("AnimationComplete",e)})}const Xh=Je.length;function lo(t){if(!t)return;if(!t.isControllingVariants){const n=t.parent?lo(t.parent)||{}:{};return t.props.initial!==void 0&&(n.initial=t.props.initial),n}const e={};for(let n=0;n<Xh;n++){const s=Je[n],i=t.props[s];(Dt(i)||i===!1)&&(e[s]=i)}return e}const Yh=[...Qe].reverse(),Zh=Qe.length;function Qh(t){return e=>Promise.all(e.map(({animation:n,options:s})=>Gh(t,n,s)))}function Jh(t){let e=Qh(t),n=ss(),s=!0;const i=c=>(l,u)=>{var h;const d=ue(t,u,c==="exit"?(h=t.presenceContext)===null||h===void 0?void 0:h.custom:void 0);if(d){const{transition:p,transitionEnd:y,...g}=d;l={...l,...g,...y}}return l};function r(c){e=c(t)}function o(c){const{props:l}=t,u=lo(t.parent)||{},h=[],d=new Set;let p={},y=1/0;for(let v=0;v<Zh;v++){const x=Yh[v],M=n[x],k=l[x]!==void 0?l[x]:u[x],T=Dt(k),b=x===c?M.isActive:null;b===!1&&(y=v);let A=k===u[x]&&k!==l[x]&&T;if(A&&s&&t.manuallyAnimateOnMount&&(A=!1),M.protectedKeys={...p},!M.isActive&&b===null||!k&&!M.prevProp||ce(k)||typeof k=="boolean")continue;const _=td(M.prevProp,k);let P=_||x===c&&M.isActive&&!A&&T||v>y&&T,L=!1;const O=Array.isArray(k)?k:[k];let dt=O.reduce(i(x),{});b===!1&&(dt={});const{prevResolvedValues:Cn={}}=M,Do={...Cn,...dt},Vn=$=>{P=!0,d.has($)&&(L=!0,d.delete($)),M.needsAnimating[$]=!0;const W=t.getValue($);W&&(W.liveStyle=!1)};for(const $ in Do){const W=dt[$],de=Cn[$];if(p.hasOwnProperty($))continue;let fe=!1;_e(W)&&_e(de)?fe=!bi(W,de):fe=W!==de,fe?W!=null?Vn($):d.add($):W!==void 0&&d.has($)?Vn($):M.protectedKeys[$]=!0}M.prevProp=k,M.prevResolvedValues=dt,M.isActive&&(p={...p,...dt}),s&&t.blockInitialAnimation&&(P=!1),P&&(!(A&&_)||L)&&h.push(...O.map($=>({animation:$,options:{type:x}})))}if(d.size){const v={};d.forEach(x=>{const M=t.getBaseTarget(x),k=t.getValue(x);k&&(k.liveStyle=!0),v[x]=M??null}),h.push({animation:v})}let g=!!h.length;return s&&(l.initial===!1||l.initial===l.animate)&&!t.manuallyAnimateOnMount&&(g=!1),s=!1,g?e(h):Promise.resolve()}function a(c,l){var u;if(n[c].isActive===l)return Promise.resolve();(u=t.variantChildren)===null||u===void 0||u.forEach(d=>{var p;return(p=d.animationState)===null||p===void 0?void 0:p.setActive(c,l)}),n[c].isActive=l;const h=o(c);for(const d in n)n[d].protectedKeys={};return h}return{animateChanges:o,setActive:a,setAnimateFunction:r,getState:()=>n,reset:()=>{n=ss(),s=!0}}}function td(t,e){return typeof e=="string"?e!==t:Array.isArray(e)?!bi(e,t):!1}function rt(t=!1){return{isActive:t,protectedKeys:{},needsAnimating:{},prevResolvedValues:{}}}function ss(){return{animate:rt(!0),whileInView:rt(),whileHover:rt(),whileTap:rt(),whileDrag:rt(),whileFocus:rt(),exit:rt()}}class ot{constructor(e){this.isMounted=!1,this.node=e}update(){}}class ed extends ot{constructor(e){super(e),e.animationState||(e.animationState=Jh(e))}updateAnimationControlsSubscription(){const{animate:e}=this.node.getProps();ce(e)&&(this.unmountControls=e.subscribe(this.node))}mount(){this.updateAnimationControlsSubscription()}update(){const{animate:e}=this.node.getProps(),{animate:n}=this.node.prevProps||{};e!==n&&this.updateAnimationControlsSubscription()}unmount(){var e;this.node.animationState.reset(),(e=this.unmountControls)===null||e===void 0||e.call(this)}}let nd=0;class sd extends ot{constructor(){super(...arguments),this.id=nd++}update(){if(!this.node.presenceContext)return;const{isPresent:e,onExitComplete:n}=this.node.presenceContext,{isPresent:s}=this.node.prevPresenceContext||{};if(!this.node.animationState||e===s)return;const i=this.node.animationState.setActive("exit",!e);n&&!e&&i.then(()=>n(this.id))}mount(){const{register:e}=this.node.presenceContext||{};e&&(this.unmount=e(this.id))}unmount(){}}const id={animation:{Feature:ed},exit:{Feature:sd}};function Nt(t,e,n,s={passive:!0}){return t.addEventListener(e,n,s),()=>t.removeEventListener(e,n)}function Ot(t){return{point:{x:t.pageX,y:t.pageY}}}const od=t=>e=>mn(e)&&t(e,Ot(e));function Ct(t,e,n,s){return Nt(t,e,od(n),s)}const is=(t,e)=>Math.abs(t-e);function rd(t,e){const n=is(t.x,e.x),s=is(t.y,e.y);return Math.sqrt(n**2+s**2)}class uo{constructor(e,n,{transformPagePoint:s,contextWindow:i,dragSnapToOrigin:r=!1}={}){if(this.startEvent=null,this.lastMoveEvent=null,this.lastMoveEventInfo=null,this.handlers={},this.contextWindow=window,this.updatePoint=()=>{if(!(this.lastMoveEvent&&this.lastMoveEventInfo))return;const h=be(this.lastMoveEventInfo,this.history),d=this.startEvent!==null,p=rd(h.offset,{x:0,y:0})>=3;if(!d&&!p)return;const{point:y}=h,{timestamp:g}=R;this.history.push({...y,timestamp:g});const{onStart:v,onMove:x}=this.handlers;d||(v&&v(this.lastMoveEvent,h),this.startEvent=this.lastMoveEvent),x&&x(this.lastMoveEvent,h)},this.handlePointerMove=(h,d)=>{this.lastMoveEvent=h,this.lastMoveEventInfo=Me(d,this.transformPagePoint),S.update(this.updatePoint,!0)},this.handlePointerUp=(h,d)=>{this.end();const{onEnd:p,onSessionEnd:y,resumeAnimation:g}=this.handlers;if(this.dragSnapToOrigin&&g&&g(),!(this.lastMoveEvent&&this.lastMoveEventInfo))return;const v=be(h.type==="pointercancel"?this.lastMoveEventInfo:Me(d,this.transformPagePoint),this.history);this.startEvent&&p&&p(h,v),y&&y(h,v)},!mn(e))return;this.dragSnapToOrigin=r,this.handlers=n,this.transformPagePoint=s,this.contextWindow=i||window;const o=Ot(e),a=Me(o,this.transformPagePoint),{point:c}=a,{timestamp:l}=R;this.history=[{...c,timestamp:l}];const{onSessionStart:u}=n;u&&u(e,be(a,this.history)),this.removeListeners=Bt(Ct(this.contextWindow,"pointermove",this.handlePointerMove),Ct(this.contextWindow,"pointerup",this.handlePointerUp),Ct(this.contextWindow,"pointercancel",this.handlePointerUp))}updateHandlers(e){this.handlers=e}end(){this.removeListeners&&this.removeListeners(),nt(this.updatePoint)}}function Me(t,e){return e?{point:e(t.point)}:t}function os(t,e){return{x:t.x-e.x,y:t.y-e.y}}function be({point:t},e){return{point:t,delta:os(t,ho(e)),offset:os(t,ad(e)),velocity:cd(e,.1)}}function ad(t){return t[0]}function ho(t){return t[t.length-1]}function cd(t,e){if(t.length<2)return{x:0,y:0};let n=t.length-1,s=null;const i=ho(t);for(;n>=0&&(s=t[n],!(i.timestamp-s.timestamp>Y(e)));)n--;if(!s)return{x:0,y:0};const r=Z(i.timestamp-s.timestamp);if(r===0)return{x:0,y:0};const o={x:(i.x-s.x)/r,y:(i.y-s.y)/r};return o.x===1/0&&(o.x=0),o.y===1/0&&(o.y=0),o}const fo=1e-4,ld=1-fo,ud=1+fo,po=.01,hd=0-po,dd=0+po;function B(t){return t.max-t.min}function fd(t,e,n){return Math.abs(t-e)<=n}function rs(t,e,n,s=.5){t.origin=s,t.originPoint=C(e.min,e.max,t.origin),t.scale=B(n)/B(e),t.translate=C(n.min,n.max,t.origin)-t.originPoint,(t.scale>=ld&&t.scale<=ud||isNaN(t.scale))&&(t.scale=1),(t.translate>=hd&&t.translate<=dd||isNaN(t.translate))&&(t.translate=0)}function Vt(t,e,n,s){rs(t.x,e.x,n.x,s?s.originX:void 0),rs(t.y,e.y,n.y,s?s.originY:void 0)}function as(t,e,n){t.min=n.min+e.min,t.max=t.min+B(e)}function pd(t,e,n){as(t.x,e.x,n.x),as(t.y,e.y,n.y)}function cs(t,e,n){t.min=e.min-n.min,t.max=t.min+B(e)}function _t(t,e,n){cs(t.x,e.x,n.x),cs(t.y,e.y,n.y)}function md(t,{min:e,max:n},s){return e!==void 0&&t<e?t=s?C(e,t,s.min):Math.max(t,e):n!==void 0&&t>n&&(t=s?C(n,t,s.max):Math.min(t,n)),t}function ls(t,e,n){return{min:e!==void 0?t.min+e:void 0,max:n!==void 0?t.max+n-(t.max-t.min):void 0}}function yd(t,{top:e,left:n,bottom:s,right:i}){return{x:ls(t.x,n,i),y:ls(t.y,e,s)}}function us(t,e){let n=e.min-t.min,s=e.max-t.max;return e.max-e.min<t.max-t.min&&([n,s]=[s,n]),{min:n,max:s}}function gd(t,e){return{x:us(t.x,e.x),y:us(t.y,e.y)}}function vd(t,e){let n=.5;const s=B(t),i=B(e);return i>s?n=vt(e.min,e.max-s,t.min):s>i&&(n=vt(t.min,t.max-i,e.min)),J(0,1,n)}function xd(t,e){const n={};return e.min!==void 0&&(n.min=e.min-t.min),e.max!==void 0&&(n.max=e.max-t.min),n}const Ie=.35;function kd(t=Ie){return t===!1?t=0:t===!0&&(t=Ie),{x:hs(t,"left","right"),y:hs(t,"top","bottom")}}function hs(t,e,n){return{min:ds(t,e),max:ds(t,n)}}function ds(t,e){return typeof t=="number"?t:t[e]||0}const fs=()=>({translate:0,scale:1,origin:0,originPoint:0}),mt=()=>({x:fs(),y:fs()}),ps=()=>({min:0,max:0}),D=()=>({x:ps(),y:ps()});function z(t){return[t("x"),t("y")]}function mo({top:t,left:e,right:n,bottom:s}){return{x:{min:e,max:n},y:{min:t,max:s}}}function Md({x:t,y:e}){return{top:e.min,right:t.max,bottom:e.max,left:t.min}}function bd(t,e){if(!e)return t;const n=e({x:t.left,y:t.top}),s=e({x:t.right,y:t.bottom});return{top:n.y,left:n.x,bottom:s.y,right:s.x}}function we(t){return t===void 0||t===1}function ze({scale:t,scaleX:e,scaleY:n}){return!we(t)||!we(e)||!we(n)}function at(t){return ze(t)||yo(t)||t.z||t.rotate||t.rotateX||t.rotateY||t.skewX||t.skewY}function yo(t){return ms(t.x)||ms(t.y)}function ms(t){return t&&t!=="0%"}function se(t,e,n){const s=t-n,i=e*s;return n+i}function ys(t,e,n,s,i){return i!==void 0&&(t=se(t,i,s)),se(t,n,s)+e}function Ue(t,e=0,n=1,s,i){t.min=ys(t.min,e,n,s,i),t.max=ys(t.max,e,n,s,i)}function go(t,{x:e,y:n}){Ue(t.x,e.translate,e.scale,e.originPoint),Ue(t.y,n.translate,n.scale,n.originPoint)}const gs=.999999999999,vs=1.0000000000001;function wd(t,e,n,s=!1){const i=n.length;if(!i)return;e.x=e.y=1;let r,o;for(let a=0;a<i;a++){r=n[a],o=r.projectionDelta;const{visualElement:c}=r.options;c&&c.props.style&&c.props.style.display==="contents"||(s&&r.options.layoutScroll&&r.scroll&&r!==r.root&&gt(t,{x:-r.scroll.offset.x,y:-r.scroll.offset.y}),o&&(e.x*=o.x.scale,e.y*=o.y.scale,go(t,o)),s&&at(r.latestValues)&&gt(t,r.latestValues))}e.x<vs&&e.x>gs&&(e.x=1),e.y<vs&&e.y>gs&&(e.y=1)}function yt(t,e){t.min=t.min+e,t.max=t.max+e}function xs(t,e,n,s,i=.5){const r=C(t.min,t.max,i);Ue(t,e,n,r,s)}function gt(t,e){xs(t.x,e.x,e.scaleX,e.scale,e.originX),xs(t.y,e.y,e.scaleY,e.scale,e.originY)}function vo(t,e){return mo(bd(t.getBoundingClientRect(),e))}function Td(t,e,n){const s=vo(t,n),{scroll:i}=e;return i&&(yt(s.x,i.offset.x),yt(s.y,i.offset.y)),s}const xo=({current:t})=>t?t.ownerDocument.defaultView:null,Pd=new WeakMap;class Ad{constructor(e){this.openDragLock=null,this.isDragging=!1,this.currentDirection=null,this.originPoint={x:0,y:0},this.constraints=!1,this.hasMutatedConstraints=!1,this.elastic=D(),this.visualElement=e}start(e,{snapToCursor:n=!1}={}){const{presenceContext:s}=this.visualElement;if(s&&s.isPresent===!1)return;const i=u=>{const{dragSnapToOrigin:h}=this.getProps();h?this.pauseAnimation():this.stopAnimation(),n&&this.snapToCursor(Ot(u).point)},r=(u,h)=>{const{drag:d,dragPropagation:p,onDragStart:y}=this.getProps();if(d&&!p&&(this.openDragLock&&this.openDragLock(),this.openDragLock=vu(d),!this.openDragLock))return;this.isDragging=!0,this.currentDirection=null,this.resolveConstraints(),this.visualElement.projection&&(this.visualElement.projection.isAnimationBlocked=!0,this.visualElement.projection.target=void 0),z(v=>{let x=this.getAxisMotionValue(v).get()||0;if(H.test(x)){const{projection:M}=this.visualElement;if(M&&M.layout){const k=M.layout.layoutBox[v];k&&(x=B(k)*(parseFloat(x)/100))}}this.originPoint[v]=x}),y&&S.postRender(()=>y(u,h)),Re(this.visualElement,"transform");const{animationState:g}=this.visualElement;g&&g.setActive("whileDrag",!0)},o=(u,h)=>{const{dragPropagation:d,dragDirectionLock:p,onDirectionLock:y,onDrag:g}=this.getProps();if(!d&&!this.openDragLock)return;const{offset:v}=h;if(p&&this.currentDirection===null){this.currentDirection=Sd(v),this.currentDirection!==null&&y&&y(this.currentDirection);return}this.updateAxis("x",h.point,v),this.updateAxis("y",h.point,v),this.visualElement.render(),g&&g(u,h)},a=(u,h)=>this.stop(u,h),c=()=>z(u=>{var h;return this.getAnimationState(u)==="paused"&&((h=this.getAxisMotionValue(u).animation)===null||h===void 0?void 0:h.play())}),{dragSnapToOrigin:l}=this.getProps();this.panSession=new uo(e,{onSessionStart:i,onStart:r,onMove:o,onSessionEnd:a,resumeAnimation:c},{transformPagePoint:this.visualElement.getTransformPagePoint(),dragSnapToOrigin:l,contextWindow:xo(this.visualElement)})}stop(e,n){const s=this.isDragging;if(this.cancel(),!s)return;const{velocity:i}=n;this.startAnimation(i);const{onDragEnd:r}=this.getProps();r&&S.postRender(()=>r(e,n))}cancel(){this.isDragging=!1;const{projection:e,animationState:n}=this.visualElement;e&&(e.isAnimationBlocked=!1),this.panSession&&this.panSession.end(),this.panSession=void 0;const{dragPropagation:s}=this.getProps();!s&&this.openDragLock&&(this.openDragLock(),this.openDragLock=null),n&&n.setActive("whileDrag",!1)}updateAxis(e,n,s){const{drag:i}=this.getProps();if(!s||!Ht(e,i,this.currentDirection))return;const r=this.getAxisMotionValue(e);let o=this.originPoint[e]+s[e];this.constraints&&this.constraints[e]&&(o=md(o,this.constraints[e],this.elastic[e])),r.set(o)}resolveConstraints(){var e;const{dragConstraints:n,dragElastic:s}=this.getProps(),i=this.visualElement.projection&&!this.visualElement.projection.layout?this.visualElement.projection.measure(!1):(e=this.visualElement.projection)===null||e===void 0?void 0:e.layout,r=this.constraints;n&&ft(n)?this.constraints||(this.constraints=this.resolveRefConstraints()):n&&i?this.constraints=yd(i.layoutBox,n):this.constraints=!1,this.elastic=kd(s),r!==this.constraints&&i&&this.constraints&&!this.hasMutatedConstraints&&z(o=>{this.constraints!==!1&&this.getAxisMotionValue(o)&&(this.constraints[o]=xd(i.layoutBox[o],this.constraints[o]))})}resolveRefConstraints(){const{dragConstraints:e,onMeasureDragConstraints:n}=this.getProps();if(!e||!ft(e))return!1;const s=e.current,{projection:i}=this.visualElement;if(!i||!i.layout)return!1;const r=Td(s,i.root,this.visualElement.getTransformPagePoint());let o=gd(i.layout.layoutBox,r);if(n){const a=n(Md(o));this.hasMutatedConstraints=!!a,a&&(o=mo(a))}return o}startAnimation(e){const{drag:n,dragMomentum:s,dragElastic:i,dragTransition:r,dragSnapToOrigin:o,onDragTransitionEnd:a}=this.getProps(),c=this.constraints||{},l=z(u=>{if(!Ht(u,n,this.currentDirection))return;let h=c&&c[u]||{};o&&(h={min:0,max:0});const d=i?200:1e6,p=i?40:1e7,y={type:"inertia",velocity:s?e[u]:0,bounceStiffness:d,bounceDamping:p,timeConstant:750,restDelta:1,restSpeed:10,...r,...h};return this.startAxisValueAnimation(u,y)});return Promise.all(l).then(a)}startAxisValueAnimation(e,n){const s=this.getAxisMotionValue(e);return Re(this.visualElement,e),s.start(Sn(e,s,0,n,this.visualElement,!1))}stopAnimation(){z(e=>this.getAxisMotionValue(e).stop())}pauseAnimation(){z(e=>{var n;return(n=this.getAxisMotionValue(e).animation)===null||n===void 0?void 0:n.pause()})}getAnimationState(e){var n;return(n=this.getAxisMotionValue(e).animation)===null||n===void 0?void 0:n.state}getAxisMotionValue(e){const n=`_drag${e.toUpperCase()}`,s=this.visualElement.getProps(),i=s[n];return i||this.visualElement.getValue(e,(s.initial?s.initial[e]:void 0)||0)}snapToCursor(e){z(n=>{const{drag:s}=this.getProps();if(!Ht(n,s,this.currentDirection))return;const{projection:i}=this.visualElement,r=this.getAxisMotionValue(n);if(i&&i.layout){const{min:o,max:a}=i.layout.layoutBox[n];r.set(e[n]-C(o,a,.5))}})}scalePositionWithinConstraints(){if(!this.visualElement.current)return;const{drag:e,dragConstraints:n}=this.getProps(),{projection:s}=this.visualElement;if(!ft(n)||!s||!this.constraints)return;this.stopAnimation();const i={x:0,y:0};z(o=>{const a=this.getAxisMotionValue(o);if(a&&this.constraints!==!1){const c=a.get();i[o]=vd({min:c,max:c},this.constraints[o])}});const{transformTemplate:r}=this.visualElement.getProps();this.visualElement.current.style.transform=r?r({},""):"none",s.root&&s.root.updateScroll(),s.updateLayout(),this.resolveConstraints(),z(o=>{if(!Ht(o,e,null))return;const a=this.getAxisMotionValue(o),{min:c,max:l}=this.constraints[o];a.set(C(c,l,i[o]))})}addListeners(){if(!this.visualElement.current)return;Pd.set(this.visualElement,this);const e=this.visualElement.current,n=Ct(e,"pointerdown",c=>{const{drag:l,dragListener:u=!0}=this.getProps();l&&u&&this.start(c)}),s=()=>{const{dragConstraints:c}=this.getProps();ft(c)&&c.current&&(this.constraints=this.resolveRefConstraints())},{projection:i}=this.visualElement,r=i.addEventListener("measure",s);i&&!i.layout&&(i.root&&i.root.updateScroll(),i.updateLayout()),S.read(s);const o=Nt(window,"resize",()=>this.scalePositionWithinConstraints()),a=i.addEventListener("didUpdate",({delta:c,hasLayoutChanged:l})=>{this.isDragging&&l&&(z(u=>{const h=this.getAxisMotionValue(u);h&&(this.originPoint[u]+=c[u].translate,h.set(h.get()+c[u].translate))}),this.visualElement.render())});return()=>{o(),n(),r(),a&&a()}}getProps(){const e=this.visualElement.getProps(),{drag:n=!1,dragDirectionLock:s=!1,dragPropagation:i=!1,dragConstraints:r=!1,dragElastic:o=Ie,dragMomentum:a=!0}=e;return{...e,drag:n,dragDirectionLock:s,dragPropagation:i,dragConstraints:r,dragElastic:o,dragMomentum:a}}}function Ht(t,e,n){return(e===!0||e===t)&&(n===null||n===t)}function Sd(t,e=10){let n=null;return Math.abs(t.y)>e?n="y":Math.abs(t.x)>e&&(n="x"),n}class Cd extends ot{constructor(e){super(e),this.removeGroupControls=F,this.removeListeners=F,this.controls=new Ad(e)}mount(){const{dragControls:e}=this.node.getProps();e&&(this.removeGroupControls=e.subscribe(this.controls)),this.removeListeners=this.controls.addListeners()||F}unmount(){this.removeGroupControls(),this.removeListeners()}}const ks=t=>(e,n)=>{t&&S.postRender(()=>t(e,n))};class Vd extends ot{constructor(){super(...arguments),this.removePointerDownListener=F}onPointerDown(e){this.session=new uo(e,this.createPanHandlers(),{transformPagePoint:this.node.getTransformPagePoint(),contextWindow:xo(this.node)})}createPanHandlers(){const{onPanSessionStart:e,onPanStart:n,onPan:s,onPanEnd:i}=this.node.getProps();return{onSessionStart:ks(e),onStart:ks(n),onMove:s,onEnd:(r,o)=>{delete this.session,i&&S.postRender(()=>i(r,o))}}}mount(){this.removePointerDownListener=Ct(this.node.current,"pointerdown",e=>this.onPointerDown(e))}update(){this.session&&this.session.updateHandlers(this.createPanHandlers())}unmount(){this.removePointerDownListener(),this.session&&this.session.end()}}const Xt={hasAnimatedSinceResize:!0,hasEverUpdated:!1};function Ms(t,e){return e.max===e.min?0:t/(e.max-e.min)*100}const wt={correct:(t,e)=>{if(!e.target)return t;if(typeof t=="string")if(w.test(t))t=parseFloat(t);else return t;const n=Ms(t,e.target.x),s=Ms(t,e.target.y);return`${n}% ${s}%`}},_d={correct:(t,{treeScale:e,projectionDelta:n})=>{const s=t,i=st.parse(t);if(i.length>5)return s;const r=st.createTransformer(t),o=typeof i[0]!="number"?1:0,a=n.x.scale*e.x,c=n.y.scale*e.y;i[0+o]/=a,i[1+o]/=c;const l=C(a,c,.5);return typeof i[2+o]=="number"&&(i[2+o]/=l),typeof i[3+o]=="number"&&(i[3+o]/=l),r(i)}};class Dd extends m.Component{componentDidMount(){const{visualElement:e,layoutGroup:n,switchLayoutGroup:s,layoutId:i}=this.props,{projection:r}=e;Zl(Ed),r&&(n.group&&n.group.add(r),s&&s.register&&i&&s.register(r),r.root.didUpdate(),r.addEventListener("animationComplete",()=>{this.safeToRemove()}),r.setOptions({...r.options,onExitComplete:()=>this.safeToRemove()})),Xt.hasEverUpdated=!0}getSnapshotBeforeUpdate(e){const{layoutDependency:n,visualElement:s,drag:i,isPresent:r}=this.props,o=s.projection;return o&&(o.isPresent=r,i||e.layoutDependency!==n||n===void 0?o.willUpdate():this.safeToRemove(),e.isPresent!==r&&(r?o.promote():o.relegate()||S.postRender(()=>{const a=o.getStack();(!a||!a.members.length)&&this.safeToRemove()}))),null}componentDidUpdate(){const{projection:e}=this.props.visualElement;e&&(e.root.didUpdate(),en.postRender(()=>{!e.currentAnimation&&e.isLead()&&this.safeToRemove()}))}componentWillUnmount(){const{visualElement:e,layoutGroup:n,switchLayoutGroup:s}=this.props,{projection:i}=e;i&&(i.scheduleCheckAfterUnmount(),n&&n.group&&n.group.remove(i),s&&s.deregister&&s.deregister(i))}safeToRemove(){const{safeToRemove:e}=this.props;e&&e()}render(){return null}}function ko(t){const[e,n]=ei(),s=m.useContext(We);return X.jsx(Dd,{...t,layoutGroup:s,switchLayoutGroup:m.useContext(li),isPresent:e,safeToRemove:n})}const Ed={borderRadius:{...wt,applyTo:["borderTopLeftRadius","borderTopRightRadius","borderBottomLeftRadius","borderBottomRightRadius"]},borderTopLeftRadius:wt,borderTopRightRadius:wt,borderBottomLeftRadius:wt,borderBottomRightRadius:wt,boxShadow:_d};function Rd(t,e,n){const s=j(t)?t:Rt(t);return s.start(Sn("",s,e,n)),s.animation}function Ld(t){return t instanceof SVGElement&&t.tagName!=="svg"}const Nd=(t,e)=>t.depth-e.depth;class jd{constructor(){this.children=[],this.isDirty=!1}add(e){yn(this.children,e),this.isDirty=!0}remove(e){gn(this.children,e),this.isDirty=!0}forEach(e){this.isDirty&&this.children.sort(Nd),this.isDirty=!1,this.children.forEach(e)}}function $d(t,e){const n=K.now(),s=({timestamp:i})=>{const r=i-n;r>=e&&(nt(s),t(r-e))};return S.read(s,!0),()=>nt(s)}const Mo=["TopLeft","TopRight","BottomLeft","BottomRight"],Fd=Mo.length,bs=t=>typeof t=="string"?parseFloat(t):t,ws=t=>typeof t=="number"||w.test(t);function Bd(t,e,n,s,i,r){i?(t.opacity=C(0,n.opacity!==void 0?n.opacity:1,Od(s)),t.opacityExit=C(e.opacity!==void 0?e.opacity:1,0,Id(s))):r&&(t.opacity=C(e.opacity!==void 0?e.opacity:1,n.opacity!==void 0?n.opacity:1,s));for(let o=0;o<Fd;o++){const a=`border${Mo[o]}Radius`;let c=Ts(e,a),l=Ts(n,a);if(c===void 0&&l===void 0)continue;c||(c=0),l||(l=0),c===0||l===0||ws(c)===ws(l)?(t[a]=Math.max(C(bs(c),bs(l),s),0),(H.test(l)||H.test(c))&&(t[a]+="%")):t[a]=l}(e.rotate||n.rotate)&&(t.rotate=C(e.rotate||0,n.rotate||0,s))}function Ts(t,e){return t[e]!==void 0?t[e]:t.borderRadius}const Od=bo(0,.5,Bi),Id=bo(.5,.95,F);function bo(t,e,n){return s=>s<t?0:s>e?1:n(vt(t,e,s))}function Ps(t,e){t.min=e.min,t.max=e.max}function I(t,e){Ps(t.x,e.x),Ps(t.y,e.y)}function As(t,e){t.translate=e.translate,t.scale=e.scale,t.originPoint=e.originPoint,t.origin=e.origin}function Ss(t,e,n,s,i){return t-=e,t=se(t,1/n,s),i!==void 0&&(t=se(t,1/i,s)),t}function zd(t,e=0,n=1,s=.5,i,r=t,o=t){if(H.test(e)&&(e=parseFloat(e),e=C(o.min,o.max,e/100)-o.min),typeof e!="number")return;let a=C(r.min,r.max,s);t===r&&(a-=e),t.min=Ss(t.min,e,n,a,i),t.max=Ss(t.max,e,n,a,i)}function Cs(t,e,[n,s,i],r,o){zd(t,e[n],e[s],e[i],e.scale,r,o)}const Ud=["x","scaleX","originX"],qd=["y","scaleY","originY"];function Vs(t,e,n,s){Cs(t.x,e,Ud,n?n.x:void 0,s?s.x:void 0),Cs(t.y,e,qd,n?n.y:void 0,s?s.y:void 0)}function _s(t){return t.translate===0&&t.scale===1}function wo(t){return _s(t.x)&&_s(t.y)}function Ds(t,e){return t.min===e.min&&t.max===e.max}function Hd(t,e){return Ds(t.x,e.x)&&Ds(t.y,e.y)}function Es(t,e){return Math.round(t.min)===Math.round(e.min)&&Math.round(t.max)===Math.round(e.max)}function To(t,e){return Es(t.x,e.x)&&Es(t.y,e.y)}function Rs(t){return B(t.x)/B(t.y)}function Ls(t,e){return t.translate===e.translate&&t.scale===e.scale&&t.originPoint===e.originPoint}class Kd{constructor(){this.members=[]}add(e){yn(this.members,e),e.scheduleRender()}remove(e){if(gn(this.members,e),e===this.prevLead&&(this.prevLead=void 0),e===this.lead){const n=this.members[this.members.length-1];n&&this.promote(n)}}relegate(e){const n=this.members.findIndex(i=>e===i);if(n===0)return!1;let s;for(let i=n;i>=0;i--){const r=this.members[i];if(r.isPresent!==!1){s=r;break}}return s?(this.promote(s),!0):!1}promote(e,n){const s=this.lead;if(e!==s&&(this.prevLead=s,this.lead=e,e.show(),s)){s.instance&&s.scheduleRender(),e.scheduleRender(),e.resumeFrom=s,n&&(e.resumeFrom.preserveOpacity=!0),s.snapshot&&(e.snapshot=s.snapshot,e.snapshot.latestValues=s.animationValues||s.latestValues),e.root&&e.root.isUpdating&&(e.isLayoutDirty=!0);const{crossfade:i}=e.options;i===!1&&s.hide()}}exitAnimationComplete(){this.members.forEach(e=>{const{options:n,resumingFrom:s}=e;n.onExitComplete&&n.onExitComplete(),s&&s.options.onExitComplete&&s.options.onExitComplete()})}scheduleRender(){this.members.forEach(e=>{e.instance&&e.scheduleRender(!1)})}removeLeadSnapshot(){this.lead&&this.lead.snapshot&&(this.lead.snapshot=void 0)}}function Wd(t,e,n){let s="";const i=t.x.translate/e.x,r=t.y.translate/e.y,o=(n==null?void 0:n.z)||0;if((i||r||o)&&(s=`translate3d(${i}px, ${r}px, ${o}px) `),(e.x!==1||e.y!==1)&&(s+=`scale(${1/e.x}, ${1/e.y}) `),n){const{transformPerspective:l,rotate:u,rotateX:h,rotateY:d,skewX:p,skewY:y}=n;l&&(s=`perspective(${l}px) ${s}`),u&&(s+=`rotate(${u}deg) `),h&&(s+=`rotateX(${h}deg) `),d&&(s+=`rotateY(${d}deg) `),p&&(s+=`skewX(${p}deg) `),y&&(s+=`skewY(${y}deg) `)}const a=t.x.scale*e.x,c=t.y.scale*e.y;return(a!==1||c!==1)&&(s+=`scale(${a}, ${c})`),s||"none"}const ct={type:"projectionFrame",totalNodes:0,resolvedTargetDeltas:0,recalculatedProjection:0},At=typeof window<"u"&&window.MotionDebug!==void 0,Te=["","X","Y","Z"],Gd={visibility:"hidden"},Ns=1e3;let Xd=0;function Pe(t,e,n,s){const{latestValues:i}=e;i[t]&&(n[t]=i[t],e.setStaticValue(t,0),s&&(s[t]=0))}function Po(t){if(t.hasCheckedOptimisedAppear=!0,t.root===t)return;const{visualElement:e}=t.options;if(!e)return;const n=Ei(e);if(window.MotionHasOptimisedAnimation(n,"transform")){const{layout:i,layoutId:r}=t.options;window.MotionCancelOptimisedAnimation(n,"transform",S,!(i||r))}const{parent:s}=t;s&&!s.hasCheckedOptimisedAppear&&Po(s)}function Ao({attachResizeListener:t,defaultParent:e,measureScroll:n,checkIsScrollRoot:s,resetTransform:i}){return class{constructor(o={},a=e==null?void 0:e()){this.id=Xd++,this.animationId=0,this.children=new Set,this.options={},this.isTreeAnimating=!1,this.isAnimationBlocked=!1,this.isLayoutDirty=!1,this.isProjectionDirty=!1,this.isSharedProjectionDirty=!1,this.isTransformDirty=!1,this.updateManuallyBlocked=!1,this.updateBlockedByResize=!1,this.isUpdating=!1,this.isSVG=!1,this.needsReset=!1,this.shouldResetTransform=!1,this.hasCheckedOptimisedAppear=!1,this.treeScale={x:1,y:1},this.eventHandlers=new Map,this.hasTreeAnimated=!1,this.updateScheduled=!1,this.scheduleUpdate=()=>this.update(),this.projectionUpdateScheduled=!1,this.checkUpdateFailed=()=>{this.isUpdating&&(this.isUpdating=!1,this.clearAllSnapshots())},this.updateProjection=()=>{this.projectionUpdateScheduled=!1,At&&(ct.totalNodes=ct.resolvedTargetDeltas=ct.recalculatedProjection=0),this.nodes.forEach(Qd),this.nodes.forEach(s1),this.nodes.forEach(i1),this.nodes.forEach(Jd),At&&window.MotionDebug.record(ct)},this.resolvedRelativeTargetAt=0,this.hasProjected=!1,this.isVisible=!0,this.animationProgress=0,this.sharedNodes=new Map,this.latestValues=o,this.root=a?a.root||a:this,this.path=a?[...a.path,a]:[],this.parent=a,this.depth=a?a.depth+1:0;for(let c=0;c<this.path.length;c++)this.path[c].shouldResetTransform=!0;this.root===this&&(this.nodes=new jd)}addEventListener(o,a){return this.eventHandlers.has(o)||this.eventHandlers.set(o,new vn),this.eventHandlers.get(o).add(a)}notifyListeners(o,...a){const c=this.eventHandlers.get(o);c&&c.notify(...a)}hasListeners(o){return this.eventHandlers.has(o)}mount(o,a=this.root.hasTreeAnimated){if(this.instance)return;this.isSVG=Ld(o),this.instance=o;const{layoutId:c,layout:l,visualElement:u}=this.options;if(u&&!u.current&&u.mount(o),this.root.nodes.add(this),this.parent&&this.parent.children.add(this),a&&(l||c)&&(this.isLayoutDirty=!0),t){let h;const d=()=>this.root.updateBlockedByResize=!1;t(o,()=>{this.root.updateBlockedByResize=!0,h&&h(),h=$d(d,250),Xt.hasAnimatedSinceResize&&(Xt.hasAnimatedSinceResize=!1,this.nodes.forEach($s))})}c&&this.root.registerSharedNode(c,this),this.options.animate!==!1&&u&&(c||l)&&this.addEventListener("didUpdate",({delta:h,hasLayoutChanged:d,hasRelativeTargetChanged:p,layout:y})=>{if(this.isTreeAnimationBlocked()){this.target=void 0,this.relativeTarget=void 0;return}const g=this.options.transition||u.getDefaultTransition()||l1,{onLayoutAnimationStart:v,onLayoutAnimationComplete:x}=u.getProps(),M=!this.targetLayout||!To(this.targetLayout,y)||p,k=!d&&p;if(this.options.layoutRoot||this.resumeFrom&&this.resumeFrom.instance||k||d&&(M||!this.currentAnimation)){this.resumeFrom&&(this.resumingFrom=this.resumeFrom,this.resumingFrom.resumingFrom=void 0),this.setAnimationOrigin(h,k);const T={...dn(g,"layout"),onPlay:v,onComplete:x};(u.shouldReduceMotion||this.options.layoutRoot)&&(T.delay=0,T.type=!1),this.startAnimation(T)}else d||$s(this),this.isLead()&&this.options.onExitComplete&&this.options.onExitComplete();this.targetLayout=y})}unmount(){this.options.layoutId&&this.willUpdate(),this.root.nodes.remove(this);const o=this.getStack();o&&o.remove(this),this.parent&&this.parent.children.delete(this),this.instance=void 0,nt(this.updateProjection)}blockUpdate(){this.updateManuallyBlocked=!0}unblockUpdate(){this.updateManuallyBlocked=!1}isUpdateBlocked(){return this.updateManuallyBlocked||this.updateBlockedByResize}isTreeAnimationBlocked(){return this.isAnimationBlocked||this.parent&&this.parent.isTreeAnimationBlocked()||!1}startUpdate(){this.isUpdateBlocked()||(this.isUpdating=!0,this.nodes&&this.nodes.forEach(o1),this.animationId++)}getTransformTemplate(){const{visualElement:o}=this.options;return o&&o.getProps().transformTemplate}willUpdate(o=!0){if(this.root.hasTreeAnimated=!0,this.root.isUpdateBlocked()){this.options.onExitComplete&&this.options.onExitComplete();return}if(window.MotionCancelOptimisedAnimation&&!this.hasCheckedOptimisedAppear&&Po(this),!this.root.isUpdating&&this.root.startUpdate(),this.isLayoutDirty)return;this.isLayoutDirty=!0;for(let u=0;u<this.path.length;u++){const h=this.path[u];h.shouldResetTransform=!0,h.updateScroll("snapshot"),h.options.layoutRoot&&h.willUpdate(!1)}const{layoutId:a,layout:c}=this.options;if(a===void 0&&!c)return;const l=this.getTransformTemplate();this.prevTransformTemplateValue=l?l(this.latestValues,""):void 0,this.updateSnapshot(),o&&this.notifyListeners("willUpdate")}update(){if(this.updateScheduled=!1,this.isUpdateBlocked()){this.unblockUpdate(),this.clearAllSnapshots(),this.nodes.forEach(js);return}this.isUpdating||this.nodes.forEach(e1),this.isUpdating=!1,this.nodes.forEach(n1),this.nodes.forEach(Yd),this.nodes.forEach(Zd),this.clearAllSnapshots();const a=K.now();R.delta=J(0,1e3/60,a-R.timestamp),R.timestamp=a,R.isProcessing=!0,me.update.process(R),me.preRender.process(R),me.render.process(R),R.isProcessing=!1}didUpdate(){this.updateScheduled||(this.updateScheduled=!0,en.read(this.scheduleUpdate))}clearAllSnapshots(){this.nodes.forEach(t1),this.sharedNodes.forEach(r1)}scheduleUpdateProjection(){this.projectionUpdateScheduled||(this.projectionUpdateScheduled=!0,S.preRender(this.updateProjection,!1,!0))}scheduleCheckAfterUnmount(){S.postRender(()=>{this.isLayoutDirty?this.root.didUpdate():this.root.checkUpdateFailed()})}updateSnapshot(){this.snapshot||!this.instance||(this.snapshot=this.measure())}updateLayout(){if(!this.instance||(this.updateScroll(),!(this.options.alwaysMeasureLayout&&this.isLead())&&!this.isLayoutDirty))return;if(this.resumeFrom&&!this.resumeFrom.instance)for(let c=0;c<this.path.length;c++)this.path[c].updateScroll();const o=this.layout;this.layout=this.measure(!1),this.layoutCorrected=D(),this.isLayoutDirty=!1,this.projectionDelta=void 0,this.notifyListeners("measure",this.layout.layoutBox);const{visualElement:a}=this.options;a&&a.notify("LayoutMeasure",this.layout.layoutBox,o?o.layoutBox:void 0)}updateScroll(o="measure"){let a=!!(this.options.layoutScroll&&this.instance);if(this.scroll&&this.scroll.animationId===this.root.animationId&&this.scroll.phase===o&&(a=!1),a){const c=s(this.instance);this.scroll={animationId:this.root.animationId,phase:o,isRoot:c,offset:n(this.instance),wasRoot:this.scroll?this.scroll.isRoot:c}}}resetTransform(){if(!i)return;const o=this.isLayoutDirty||this.shouldResetTransform||this.options.alwaysMeasureLayout,a=this.projectionDelta&&!wo(this.projectionDelta),c=this.getTransformTemplate(),l=c?c(this.latestValues,""):void 0,u=l!==this.prevTransformTemplateValue;o&&(a||at(this.latestValues)||u)&&(i(this.instance,l),this.shouldResetTransform=!1,this.scheduleRender())}measure(o=!0){const a=this.measurePageBox();let c=this.removeElementScroll(a);return o&&(c=this.removeTransform(c)),u1(c),{animationId:this.root.animationId,measuredBox:a,layoutBox:c,latestValues:{},source:this.id}}measurePageBox(){var o;const{visualElement:a}=this.options;if(!a)return D();const c=a.measureViewportBox();if(!(((o=this.scroll)===null||o===void 0?void 0:o.wasRoot)||this.path.some(h1))){const{scroll:u}=this.root;u&&(yt(c.x,u.offset.x),yt(c.y,u.offset.y))}return c}removeElementScroll(o){var a;const c=D();if(I(c,o),!((a=this.scroll)===null||a===void 0)&&a.wasRoot)return c;for(let l=0;l<this.path.length;l++){const u=this.path[l],{scroll:h,options:d}=u;u!==this.root&&h&&d.layoutScroll&&(h.wasRoot&&I(c,o),yt(c.x,h.offset.x),yt(c.y,h.offset.y))}return c}applyTransform(o,a=!1){const c=D();I(c,o);for(let l=0;l<this.path.length;l++){const u=this.path[l];!a&&u.options.layoutScroll&&u.scroll&&u!==u.root&&gt(c,{x:-u.scroll.offset.x,y:-u.scroll.offset.y}),at(u.latestValues)&&gt(c,u.latestValues)}return at(this.latestValues)&&gt(c,this.latestValues),c}removeTransform(o){const a=D();I(a,o);for(let c=0;c<this.path.length;c++){const l=this.path[c];if(!l.instance||!at(l.latestValues))continue;ze(l.latestValues)&&l.updateSnapshot();const u=D(),h=l.measurePageBox();I(u,h),Vs(a,l.latestValues,l.snapshot?l.snapshot.layoutBox:void 0,u)}return at(this.latestValues)&&Vs(a,this.latestValues),a}setTargetDelta(o){this.targetDelta=o,this.root.scheduleUpdateProjection(),this.isProjectionDirty=!0}setOptions(o){this.options={...this.options,...o,crossfade:o.crossfade!==void 0?o.crossfade:!0}}clearMeasurements(){this.scroll=void 0,this.layout=void 0,this.snapshot=void 0,this.prevTransformTemplateValue=void 0,this.targetDelta=void 0,this.target=void 0,this.isLayoutDirty=!1}forceRelativeParentToResolveTarget(){this.relativeParent&&this.relativeParent.resolvedRelativeTargetAt!==R.timestamp&&this.relativeParent.resolveTargetDelta(!0)}resolveTargetDelta(o=!1){var a;const c=this.getLead();this.isProjectionDirty||(this.isProjectionDirty=c.isProjectionDirty),this.isTransformDirty||(this.isTransformDirty=c.isTransformDirty),this.isSharedProjectionDirty||(this.isSharedProjectionDirty=c.isSharedProjectionDirty);const l=!!this.resumingFrom||this!==c;if(!(o||l&&this.isSharedProjectionDirty||this.isProjectionDirty||!((a=this.parent)===null||a===void 0)&&a.isProjectionDirty||this.attemptToResolveRelativeTarget||this.root.updateBlockedByResize))return;const{layout:h,layoutId:d}=this.options;if(!(!this.layout||!(h||d))){if(this.resolvedRelativeTargetAt=R.timestamp,!this.targetDelta&&!this.relativeTarget){const p=this.getClosestProjectingParent();p&&p.layout&&this.animationProgress!==1?(this.relativeParent=p,this.forceRelativeParentToResolveTarget(),this.relativeTarget=D(),this.relativeTargetOrigin=D(),_t(this.relativeTargetOrigin,this.layout.layoutBox,p.layout.layoutBox),I(this.relativeTarget,this.relativeTargetOrigin)):this.relativeParent=this.relativeTarget=void 0}if(!(!this.relativeTarget&&!this.targetDelta)){if(this.target||(this.target=D(),this.targetWithTransforms=D()),this.relativeTarget&&this.relativeTargetOrigin&&this.relativeParent&&this.relativeParent.target?(this.forceRelativeParentToResolveTarget(),pd(this.target,this.relativeTarget,this.relativeParent.target)):this.targetDelta?(this.resumingFrom?this.target=this.applyTransform(this.layout.layoutBox):I(this.target,this.layout.layoutBox),go(this.target,this.targetDelta)):I(this.target,this.layout.layoutBox),this.attemptToResolveRelativeTarget){this.attemptToResolveRelativeTarget=!1;const p=this.getClosestProjectingParent();p&&!!p.resumingFrom==!!this.resumingFrom&&!p.options.layoutScroll&&p.target&&this.animationProgress!==1?(this.relativeParent=p,this.forceRelativeParentToResolveTarget(),this.relativeTarget=D(),this.relativeTargetOrigin=D(),_t(this.relativeTargetOrigin,this.target,p.target),I(this.relativeTarget,this.relativeTargetOrigin)):this.relativeParent=this.relativeTarget=void 0}At&&ct.resolvedTargetDeltas++}}}getClosestProjectingParent(){if(!(!this.parent||ze(this.parent.latestValues)||yo(this.parent.latestValues)))return this.parent.isProjecting()?this.parent:this.parent.getClosestProjectingParent()}isProjecting(){return!!((this.relativeTarget||this.targetDelta||this.options.layoutRoot)&&this.layout)}calcProjection(){var o;const a=this.getLead(),c=!!this.resumingFrom||this!==a;let l=!0;if((this.isProjectionDirty||!((o=this.parent)===null||o===void 0)&&o.isProjectionDirty)&&(l=!1),c&&(this.isSharedProjectionDirty||this.isTransformDirty)&&(l=!1),this.resolvedRelativeTargetAt===R.timestamp&&(l=!1),l)return;const{layout:u,layoutId:h}=this.options;if(this.isTreeAnimating=!!(this.parent&&this.parent.isTreeAnimating||this.currentAnimation||this.pendingAnimation),this.isTreeAnimating||(this.targetDelta=this.relativeTarget=void 0),!this.layout||!(u||h))return;I(this.layoutCorrected,this.layout.layoutBox);const d=this.treeScale.x,p=this.treeScale.y;wd(this.layoutCorrected,this.treeScale,this.path,c),a.layout&&!a.target&&(this.treeScale.x!==1||this.treeScale.y!==1)&&(a.target=a.layout.layoutBox,a.targetWithTransforms=D());const{target:y}=a;if(!y){this.prevProjectionDelta&&(this.createProjectionDeltas(),this.scheduleRender());return}!this.projectionDelta||!this.prevProjectionDelta?this.createProjectionDeltas():(As(this.prevProjectionDelta.x,this.projectionDelta.x),As(this.prevProjectionDelta.y,this.projectionDelta.y)),Vt(this.projectionDelta,this.layoutCorrected,y,this.latestValues),(this.treeScale.x!==d||this.treeScale.y!==p||!Ls(this.projectionDelta.x,this.prevProjectionDelta.x)||!Ls(this.projectionDelta.y,this.prevProjectionDelta.y))&&(this.hasProjected=!0,this.scheduleRender(),this.notifyListeners("projectionUpdate",y)),At&&ct.recalculatedProjection++}hide(){this.isVisible=!1}show(){this.isVisible=!0}scheduleRender(o=!0){var a;if((a=this.options.visualElement)===null||a===void 0||a.scheduleRender(),o){const c=this.getStack();c&&c.scheduleRender()}this.resumingFrom&&!this.resumingFrom.instance&&(this.resumingFrom=void 0)}createProjectionDeltas(){this.prevProjectionDelta=mt(),this.projectionDelta=mt(),this.projectionDeltaWithTransform=mt()}setAnimationOrigin(o,a=!1){const c=this.snapshot,l=c?c.latestValues:{},u={...this.latestValues},h=mt();(!this.relativeParent||!this.relativeParent.options.layoutRoot)&&(this.relativeTarget=this.relativeTargetOrigin=void 0),this.attemptToResolveRelativeTarget=!a;const d=D(),p=c?c.source:void 0,y=this.layout?this.layout.source:void 0,g=p!==y,v=this.getStack(),x=!v||v.members.length<=1,M=!!(g&&!x&&this.options.crossfade===!0&&!this.path.some(c1));this.animationProgress=0;let k;this.mixTargetDelta=T=>{const b=T/1e3;Fs(h.x,o.x,b),Fs(h.y,o.y,b),this.setTargetDelta(h),this.relativeTarget&&this.relativeTargetOrigin&&this.layout&&this.relativeParent&&this.relativeParent.layout&&(_t(d,this.layout.layoutBox,this.relativeParent.layout.layoutBox),a1(this.relativeTarget,this.relativeTargetOrigin,d,b),k&&Hd(this.relativeTarget,k)&&(this.isProjectionDirty=!1),k||(k=D()),I(k,this.relativeTarget)),g&&(this.animationValues=u,Bd(u,l,this.latestValues,b,M,x)),this.root.scheduleUpdateProjection(),this.scheduleRender(),this.animationProgress=b},this.mixTargetDelta(this.options.layoutRoot?1e3:0)}startAnimation(o){this.notifyListeners("animationStart"),this.currentAnimation&&this.currentAnimation.stop(),this.resumingFrom&&this.resumingFrom.currentAnimation&&this.resumingFrom.currentAnimation.stop(),this.pendingAnimation&&(nt(this.pendingAnimation),this.pendingAnimation=void 0),this.pendingAnimation=S.update(()=>{Xt.hasAnimatedSinceResize=!0,this.currentAnimation=Rd(0,Ns,{...o,onUpdate:a=>{this.mixTargetDelta(a),o.onUpdate&&o.onUpdate(a)},onComplete:()=>{o.onComplete&&o.onComplete(),this.completeAnimation()}}),this.resumingFrom&&(this.resumingFrom.currentAnimation=this.currentAnimation),this.pendingAnimation=void 0})}completeAnimation(){this.resumingFrom&&(this.resumingFrom.currentAnimation=void 0,this.resumingFrom.preserveOpacity=void 0);const o=this.getStack();o&&o.exitAnimationComplete(),this.resumingFrom=this.currentAnimation=this.animationValues=void 0,this.notifyListeners("animationComplete")}finishAnimation(){this.currentAnimation&&(this.mixTargetDelta&&this.mixTargetDelta(Ns),this.currentAnimation.stop()),this.completeAnimation()}applyTransformsToTarget(){const o=this.getLead();let{targetWithTransforms:a,target:c,layout:l,latestValues:u}=o;if(!(!a||!c||!l)){if(this!==o&&this.layout&&l&&So(this.options.animationType,this.layout.layoutBox,l.layoutBox)){c=this.target||D();const h=B(this.layout.layoutBox.x);c.x.min=o.target.x.min,c.x.max=c.x.min+h;const d=B(this.layout.layoutBox.y);c.y.min=o.target.y.min,c.y.max=c.y.min+d}I(a,c),gt(a,u),Vt(this.projectionDeltaWithTransform,this.layoutCorrected,a,u)}}registerSharedNode(o,a){this.sharedNodes.has(o)||this.sharedNodes.set(o,new Kd),this.sharedNodes.get(o).add(a);const l=a.options.initialPromotionConfig;a.promote({transition:l?l.transition:void 0,preserveFollowOpacity:l&&l.shouldPreserveFollowOpacity?l.shouldPreserveFollowOpacity(a):void 0})}isLead(){const o=this.getStack();return o?o.lead===this:!0}getLead(){var o;const{layoutId:a}=this.options;return a?((o=this.getStack())===null||o===void 0?void 0:o.lead)||this:this}getPrevLead(){var o;const{layoutId:a}=this.options;return a?(o=this.getStack())===null||o===void 0?void 0:o.prevLead:void 0}getStack(){const{layoutId:o}=this.options;if(o)return this.root.sharedNodes.get(o)}promote({needsReset:o,transition:a,preserveFollowOpacity:c}={}){const l=this.getStack();l&&l.promote(this,c),o&&(this.projectionDelta=void 0,this.needsReset=!0),a&&this.setOptions({transition:a})}relegate(){const o=this.getStack();return o?o.relegate(this):!1}resetSkewAndRotation(){const{visualElement:o}=this.options;if(!o)return;let a=!1;const{latestValues:c}=o;if((c.z||c.rotate||c.rotateX||c.rotateY||c.rotateZ||c.skewX||c.skewY)&&(a=!0),!a)return;const l={};c.z&&Pe("z",o,l,this.animationValues);for(let u=0;u<Te.length;u++)Pe(`rotate${Te[u]}`,o,l,this.animationValues),Pe(`skew${Te[u]}`,o,l,this.animationValues);o.render();for(const u in l)o.setStaticValue(u,l[u]),this.animationValues&&(this.animationValues[u]=l[u]);o.scheduleRender()}getProjectionStyles(o){var a,c;if(!this.instance||this.isSVG)return;if(!this.isVisible)return Gd;const l={visibility:""},u=this.getTransformTemplate();if(this.needsReset)return this.needsReset=!1,l.opacity="",l.pointerEvents=Wt(o==null?void 0:o.pointerEvents)||"",l.transform=u?u(this.latestValues,""):"none",l;const h=this.getLead();if(!this.projectionDelta||!this.layout||!h.target){const g={};return this.options.layoutId&&(g.opacity=this.latestValues.opacity!==void 0?this.latestValues.opacity:1,g.pointerEvents=Wt(o==null?void 0:o.pointerEvents)||""),this.hasProjected&&!at(this.latestValues)&&(g.transform=u?u({},""):"none",this.hasProjected=!1),g}const d=h.animationValues||h.latestValues;this.applyTransformsToTarget(),l.transform=Wd(this.projectionDeltaWithTransform,this.treeScale,d),u&&(l.transform=u(d,l.transform));const{x:p,y}=this.projectionDelta;l.transformOrigin=`${p.origin*100}% ${y.origin*100}% 0`,h.animationValues?l.opacity=h===this?(c=(a=d.opacity)!==null&&a!==void 0?a:this.latestValues.opacity)!==null&&c!==void 0?c:1:this.preserveOpacity?this.latestValues.opacity:d.opacityExit:l.opacity=h===this?d.opacity!==void 0?d.opacity:"":d.opacityExit!==void 0?d.opacityExit:0;for(const g in Qt){if(d[g]===void 0)continue;const{correct:v,applyTo:x}=Qt[g],M=l.transform==="none"?d[g]:v(d[g],h);if(x){const k=x.length;for(let T=0;T<k;T++)l[x[T]]=M}else l[g]=M}return this.options.layoutId&&(l.pointerEvents=h===this?Wt(o==null?void 0:o.pointerEvents)||"":"none"),l}clearSnapshot(){this.resumeFrom=this.snapshot=void 0}resetTree(){this.root.nodes.forEach(o=>{var a;return(a=o.currentAnimation)===null||a===void 0?void 0:a.stop()}),this.root.nodes.forEach(js),this.root.sharedNodes.clear()}}}function Yd(t){t.updateLayout()}function Zd(t){var e;const n=((e=t.resumeFrom)===null||e===void 0?void 0:e.snapshot)||t.snapshot;if(t.isLead()&&t.layout&&n&&t.hasListeners("didUpdate")){const{layoutBox:s,measuredBox:i}=t.layout,{animationType:r}=t.options,o=n.source!==t.layout.source;r==="size"?z(h=>{const d=o?n.measuredBox[h]:n.layoutBox[h],p=B(d);d.min=s[h].min,d.max=d.min+p}):So(r,n.layoutBox,s)&&z(h=>{const d=o?n.measuredBox[h]:n.layoutBox[h],p=B(s[h]);d.max=d.min+p,t.relativeTarget&&!t.currentAnimation&&(t.isProjectionDirty=!0,t.relativeTarget[h].max=t.relativeTarget[h].min+p)});const a=mt();Vt(a,s,n.layoutBox);const c=mt();o?Vt(c,t.applyTransform(i,!0),n.measuredBox):Vt(c,s,n.layoutBox);const l=!wo(a);let u=!1;if(!t.resumeFrom){const h=t.getClosestProjectingParent();if(h&&!h.resumeFrom){const{snapshot:d,layout:p}=h;if(d&&p){const y=D();_t(y,n.layoutBox,d.layoutBox);const g=D();_t(g,s,p.layoutBox),To(y,g)||(u=!0),h.options.layoutRoot&&(t.relativeTarget=g,t.relativeTargetOrigin=y,t.relativeParent=h)}}}t.notifyListeners("didUpdate",{layout:s,snapshot:n,delta:c,layoutDelta:a,hasLayoutChanged:l,hasRelativeTargetChanged:u})}else if(t.isLead()){const{onExitComplete:s}=t.options;s&&s()}t.options.transition=void 0}function Qd(t){At&&ct.totalNodes++,t.parent&&(t.isProjecting()||(t.isProjectionDirty=t.parent.isProjectionDirty),t.isSharedProjectionDirty||(t.isSharedProjectionDirty=!!(t.isProjectionDirty||t.parent.isProjectionDirty||t.parent.isSharedProjectionDirty)),t.isTransformDirty||(t.isTransformDirty=t.parent.isTransformDirty))}function Jd(t){t.isProjectionDirty=t.isSharedProjectionDirty=t.isTransformDirty=!1}function t1(t){t.clearSnapshot()}function js(t){t.clearMeasurements()}function e1(t){t.isLayoutDirty=!1}function n1(t){const{visualElement:e}=t.options;e&&e.getProps().onBeforeLayoutMeasure&&e.notify("BeforeLayoutMeasure"),t.resetTransform()}function $s(t){t.finishAnimation(),t.targetDelta=t.relativeTarget=t.target=void 0,t.isProjectionDirty=!0}function s1(t){t.resolveTargetDelta()}function i1(t){t.calcProjection()}function o1(t){t.resetSkewAndRotation()}function r1(t){t.removeLeadSnapshot()}function Fs(t,e,n){t.translate=C(e.translate,0,n),t.scale=C(e.scale,1,n),t.origin=e.origin,t.originPoint=e.originPoint}function Bs(t,e,n,s){t.min=C(e.min,n.min,s),t.max=C(e.max,n.max,s)}function a1(t,e,n,s){Bs(t.x,e.x,n.x,s),Bs(t.y,e.y,n.y,s)}function c1(t){return t.animationValues&&t.animationValues.opacityExit!==void 0}const l1={duration:.45,ease:[.4,0,.1,1]},Os=t=>typeof navigator<"u"&&navigator.userAgent&&navigator.userAgent.toLowerCase().includes(t),Is=Os("applewebkit/")&&!Os("chrome/")?Math.round:F;function zs(t){t.min=Is(t.min),t.max=Is(t.max)}function u1(t){zs(t.x),zs(t.y)}function So(t,e,n){return t==="position"||t==="preserve-aspect"&&!fd(Rs(e),Rs(n),.2)}function h1(t){var e;return t!==t.root&&((e=t.scroll)===null||e===void 0?void 0:e.wasRoot)}const d1=Ao({attachResizeListener:(t,e)=>Nt(t,"resize",e),measureScroll:()=>({x:document.documentElement.scrollLeft||document.body.scrollLeft,y:document.documentElement.scrollTop||document.body.scrollTop}),checkIsScrollRoot:()=>!0}),Ae={current:void 0},Co=Ao({measureScroll:t=>({x:t.scrollLeft,y:t.scrollTop}),defaultParent:()=>{if(!Ae.current){const t=new d1({});t.mount(window),t.setOptions({layoutScroll:!0}),Ae.current=t}return Ae.current},resetTransform:(t,e)=>{t.style.transform=e!==void 0?e:"none"},checkIsScrollRoot:t=>window.getComputedStyle(t).position==="fixed"}),f1={pan:{Feature:Vd},drag:{Feature:Cd,ProjectionNode:Co,MeasureLayout:ko}};function Us(t,e,n){const{props:s}=t;t.animationState&&s.whileHover&&t.animationState.setActive("whileHover",n==="Start");const i="onHover"+n,r=s[i];r&&S.postRender(()=>r(e,Ot(e)))}class p1 extends ot{mount(){const{current:e}=this.node;e&&(this.unmount=fu(e,n=>(Us(this.node,n,"Start"),s=>Us(this.node,s,"End"))))}unmount(){}}class m1 extends ot{constructor(){super(...arguments),this.isActive=!1}onFocus(){let e=!1;try{e=this.node.current.matches(":focus-visible")}catch{e=!0}!e||!this.node.animationState||(this.node.animationState.setActive("whileFocus",!0),this.isActive=!0)}onBlur(){!this.isActive||!this.node.animationState||(this.node.animationState.setActive("whileFocus",!1),this.isActive=!1)}mount(){this.unmount=Bt(Nt(this.node.current,"focus",()=>this.onFocus()),Nt(this.node.current,"blur",()=>this.onBlur()))}unmount(){}}function qs(t,e,n){const{props:s}=t;t.animationState&&s.whileTap&&t.animationState.setActive("whileTap",n==="Start");const i="onTap"+(n==="End"?"":n),r=s[i];r&&S.postRender(()=>r(e,Ot(e)))}class y1 extends ot{mount(){const{current:e}=this.node;e&&(this.unmount=gu(e,n=>(qs(this.node,n,"Start"),(s,{success:i})=>qs(this.node,s,i?"End":"Cancel")),{useGlobalTarget:this.node.props.globalTapTarget}))}unmount(){}}const qe=new WeakMap,Se=new WeakMap,g1=t=>{const e=qe.get(t.target);e&&e(t)},v1=t=>{t.forEach(g1)};function x1({root:t,...e}){const n=t||document;Se.has(n)||Se.set(n,{});const s=Se.get(n),i=JSON.stringify(e);return s[i]||(s[i]=new IntersectionObserver(v1,{root:t,...e})),s[i]}function k1(t,e,n){const s=x1(e);return qe.set(t,n),s.observe(t),()=>{qe.delete(t),s.unobserve(t)}}const M1={some:0,all:1};class b1 extends ot{constructor(){super(...arguments),this.hasEnteredView=!1,this.isInView=!1}startObserver(){this.unmount();const{viewport:e={}}=this.node.getProps(),{root:n,margin:s,amount:i="some",once:r}=e,o={root:n?n.current:void 0,rootMargin:s,threshold:typeof i=="number"?i:M1[i]},a=c=>{const{isIntersecting:l}=c;if(this.isInView===l||(this.isInView=l,r&&!l&&this.hasEnteredView))return;l&&(this.hasEnteredView=!0),this.node.animationState&&this.node.animationState.setActive("whileInView",l);const{onViewportEnter:u,onViewportLeave:h}=this.node.getProps(),d=l?u:h;d&&d(c)};return k1(this.node.current,o,a)}mount(){this.startObserver()}update(){if(typeof IntersectionObserver>"u")return;const{props:e,prevProps:n}=this.node;["amount","margin","root"].some(w1(e,n))&&this.startObserver()}unmount(){}}function w1({viewport:t={}},{viewport:e={}}={}){return n=>t[n]!==e[n]}const T1={inView:{Feature:b1},tap:{Feature:y1},focus:{Feature:m1},hover:{Feature:p1}},P1={layout:{ProjectionNode:Co,MeasureLayout:ko}},He={current:null},Vo={current:!1};function A1(){if(Vo.current=!0,!!Ye)if(window.matchMedia){const t=window.matchMedia("(prefers-reduced-motion)"),e=()=>He.current=t.matches;t.addListener(e),e()}else He.current=!1}const S1=[...Ji,N,st],C1=t=>S1.find(Qi(t)),Hs=new WeakMap;function V1(t,e,n){for(const s in e){const i=e[s],r=n[s];if(j(i))t.addValue(s,i);else if(j(r))t.addValue(s,Rt(i,{owner:t}));else if(r!==i)if(t.hasValue(s)){const o=t.getValue(s);o.liveStyle===!0?o.jump(i):o.hasAnimated||o.set(i)}else{const o=t.getStaticValue(s);t.addValue(s,Rt(o!==void 0?o:i,{owner:t}))}}for(const s in n)e[s]===void 0&&t.removeValue(s);return e}const Ks=["AnimationStart","AnimationComplete","Update","BeforeLayoutMeasure","LayoutMeasure","LayoutAnimationStart","LayoutAnimationComplete"];class _1{scrapeMotionValuesFromProps(e,n,s){return{}}constructor({parent:e,props:n,presenceContext:s,reducedMotionConfig:i,blockInitialAnimation:r,visualState:o},a={}){this.current=null,this.children=new Set,this.isVariantNode=!1,this.isControllingVariants=!1,this.shouldReduceMotion=null,this.values=new Map,this.KeyframeResolver=Tn,this.features={},this.valueSubscriptions=new Map,this.prevMotionValues={},this.events={},this.propEventSubscriptions={},this.notifyUpdate=()=>this.notify("Update",this.latestValues),this.render=()=>{this.current&&(this.triggerBuild(),this.renderInstance(this.current,this.renderState,this.props.style,this.projection))},this.renderScheduledAt=0,this.scheduleRender=()=>{const p=K.now();this.renderScheduledAt<p&&(this.renderScheduledAt=p,S.render(this.render,!1,!0))};const{latestValues:c,renderState:l,onUpdate:u}=o;this.onUpdate=u,this.latestValues=c,this.baseTarget={...c},this.initialValues=n.initial?{...c}:{},this.renderState=l,this.parent=e,this.props=n,this.presenceContext=s,this.depth=e?e.depth+1:0,this.reducedMotionConfig=i,this.options=a,this.blockInitialAnimation=!!r,this.isControllingVariants=le(n),this.isVariantNode=ai(n),this.isVariantNode&&(this.variantChildren=new Set),this.manuallyAnimateOnMount=!!(e&&e.current);const{willChange:h,...d}=this.scrapeMotionValuesFromProps(n,{},this);for(const p in d){const y=d[p];c[p]!==void 0&&j(y)&&y.set(c[p],!1)}}mount(e){this.current=e,Hs.set(e,this),this.projection&&!this.projection.instance&&this.projection.mount(e),this.parent&&this.isVariantNode&&!this.isControllingVariants&&(this.removeFromVariantTree=this.parent.addVariantChild(this)),this.values.forEach((n,s)=>this.bindToMotionValue(s,n)),Vo.current||A1(),this.shouldReduceMotion=this.reducedMotionConfig==="never"?!1:this.reducedMotionConfig==="always"?!0:He.current,this.parent&&this.parent.children.add(this),this.update(this.props,this.presenceContext)}unmount(){Hs.delete(this.current),this.projection&&this.projection.unmount(),nt(this.notifyUpdate),nt(this.render),this.valueSubscriptions.forEach(e=>e()),this.valueSubscriptions.clear(),this.removeFromVariantTree&&this.removeFromVariantTree(),this.parent&&this.parent.children.delete(this);for(const e in this.events)this.events[e].clear();for(const e in this.features){const n=this.features[e];n&&(n.unmount(),n.isMounted=!1)}this.current=null}bindToMotionValue(e,n){this.valueSubscriptions.has(e)&&this.valueSubscriptions.get(e)();const s=ht.has(e),i=n.on("change",a=>{this.latestValues[e]=a,this.props.onUpdate&&S.preRender(this.notifyUpdate),s&&this.projection&&(this.projection.isTransformDirty=!0)}),r=n.on("renderRequest",this.scheduleRender);let o;window.MotionCheckAppearSync&&(o=window.MotionCheckAppearSync(this,e,n)),this.valueSubscriptions.set(e,()=>{i(),r(),o&&o(),n.owner&&n.stop()})}sortNodePosition(e){return!this.current||!this.sortInstanceNodePosition||this.type!==e.type?0:this.sortInstanceNodePosition(this.current,e.current)}updateFeatures(){let e="animation";for(e in xt){const n=xt[e];if(!n)continue;const{isEnabled:s,Feature:i}=n;if(!this.features[e]&&i&&s(this.props)&&(this.features[e]=new i(this)),this.features[e]){const r=this.features[e];r.isMounted?r.update():(r.mount(),r.isMounted=!0)}}}triggerBuild(){this.build(this.renderState,this.latestValues,this.props)}measureViewportBox(){return this.current?this.measureInstanceViewportBox(this.current,this.props):D()}getStaticValue(e){return this.latestValues[e]}setStaticValue(e,n){this.latestValues[e]=n}update(e,n){(e.transformTemplate||this.props.transformTemplate)&&this.scheduleRender(),this.prevProps=this.props,this.props=e,this.prevPresenceContext=this.presenceContext,this.presenceContext=n;for(let s=0;s<Ks.length;s++){const i=Ks[s];this.propEventSubscriptions[i]&&(this.propEventSubscriptions[i](),delete this.propEventSubscriptions[i]);const r="on"+i,o=e[r];o&&(this.propEventSubscriptions[i]=this.on(i,o))}this.prevMotionValues=V1(this,this.scrapeMotionValuesFromProps(e,this.prevProps,this),this.prevMotionValues),this.handleChildMotionValue&&this.handleChildMotionValue(),this.onUpdate&&this.onUpdate(this)}getProps(){return this.props}getVariant(e){return this.props.variants?this.props.variants[e]:void 0}getDefaultTransition(){return this.props.transition}getTransformPagePoint(){return this.props.transformPagePoint}getClosestVariantNode(){return this.isVariantNode?this:this.parent?this.parent.getClosestVariantNode():void 0}addVariantChild(e){const n=this.getClosestVariantNode();if(n)return n.variantChildren&&n.variantChildren.add(e),()=>n.variantChildren.delete(e)}addValue(e,n){const s=this.values.get(e);n!==s&&(s&&this.removeValue(e),this.bindToMotionValue(e,n),this.values.set(e,n),this.latestValues[e]=n.get())}removeValue(e){this.values.delete(e);const n=this.valueSubscriptions.get(e);n&&(n(),this.valueSubscriptions.delete(e)),delete this.latestValues[e],this.removeValueFromRenderState(e,this.renderState)}hasValue(e){return this.values.has(e)}getValue(e,n){if(this.props.values&&this.props.values[e])return this.props.values[e];let s=this.values.get(e);return s===void 0&&n!==void 0&&(s=Rt(n===null?void 0:n,{owner:this}),this.addValue(e,s)),s}readValue(e,n){var s;let i=this.latestValues[e]!==void 0||!this.current?this.latestValues[e]:(s=this.getBaseTargetFromProps(this.props,e))!==null&&s!==void 0?s:this.readValueFromInstance(this.current,e,this.options);return i!=null&&(typeof i=="string"&&(Yi(i)||Ii(i))?i=parseFloat(i):!C1(i)&&st.test(n)&&(i=Wi(e,n)),this.setBaseTarget(e,j(i)?i.get():i)),j(i)?i.get():i}setBaseTarget(e,n){this.baseTarget[e]=n}getBaseTarget(e){var n;const{initial:s}=this.props;let i;if(typeof s=="string"||typeof s=="object"){const o=sn(this.props,s,(n=this.presenceContext)===null||n===void 0?void 0:n.custom);o&&(i=o[e])}if(s&&i!==void 0)return i;const r=this.getBaseTargetFromProps(this.props,e);return r!==void 0&&!j(r)?r:this.initialValues[e]!==void 0&&i===void 0?void 0:this.baseTarget[e]}on(e,n){return this.events[e]||(this.events[e]=new vn),this.events[e].add(n)}notify(e,...n){this.events[e]&&this.events[e].notify(...n)}}class _o extends _1{constructor(){super(...arguments),this.KeyframeResolver=to}sortInstanceNodePosition(e,n){return e.compareDocumentPosition(n)&2?1:-1}getBaseTargetFromProps(e,n){return e.style?e.style[n]:void 0}removeValueFromRenderState(e,{vars:n,style:s}){delete n[e],delete s[e]}handleChildMotionValue(){this.childSubscription&&(this.childSubscription(),delete this.childSubscription);const{children:e}=this.props;j(e)&&(this.childSubscription=e.on("change",n=>{this.current&&(this.current.textContent=`${n}`)}))}}function D1(t){return window.getComputedStyle(t)}class E1 extends _o{constructor(){super(...arguments),this.type="html",this.renderInstance=yi}readValueFromInstance(e,n){if(ht.has(n)){const s=wn(n);return s&&s.default||0}else{const s=D1(e),i=(fi(n)?s.getPropertyValue(n):s[n])||0;return typeof i=="string"?i.trim():i}}measureInstanceViewportBox(e,{transformPagePoint:n}){return vo(e,n)}build(e,n,s){an(e,n,s.transformTemplate)}scrapeMotionValuesFromProps(e,n,s){return hn(e,n,s)}}class R1 extends _o{constructor(){super(...arguments),this.type="svg",this.isSVGTag=!1,this.measureInstanceViewportBox=D}getBaseTargetFromProps(e,n){return e[n]}readValueFromInstance(e,n){if(ht.has(n)){const s=wn(n);return s&&s.default||0}return n=gi.has(n)?n:tn(n),e.getAttribute(n)}scrapeMotionValuesFromProps(e,n,s){return ki(e,n,s)}build(e,n,s){cn(e,n,this.isSVGTag,s.transformTemplate)}renderInstance(e,n,s,i){vi(e,n,s,i)}mount(e){this.isSVGTag=un(e.tagName),super.mount(e)}}const L1=(t,e)=>nn(t)?new R1(e):new E1(e,{allowProjection:t!==m.Fragment}),N1=ru({...id,...T1,...f1,...P1},L1),_p=Ml(N1);export{Cf as $,Cp as A,af as B,xf as C,Of as D,p0 as E,Zf as F,e0 as G,s0 as H,O1 as I,X0 as J,$f as K,c0 as L,T0 as M,Z0 as N,bf as O,N0 as P,lp as Q,B0 as R,J0 as S,op as T,gp as U,wp as V,Pp as W,Ap as X,Bf as Y,Sp as Z,tp as _,K0 as a,Q1 as a$,I1 as a0,V0 as a1,L0 as a2,Tf as a3,Mf as a4,If as a5,Qf as a6,Kf as a7,Jf as a8,z0 as a9,xp as aA,Nf as aB,mp as aC,k0 as aD,I0 as aE,of as aF,i0 as aG,Hf as aH,g0 as aI,up as aJ,H1 as aK,qf as aL,pp as aM,S0 as aN,h0 as aO,kf as aP,W1 as aQ,X1 as aR,q1 as aS,Wf as aT,m0 as aU,Lf as aV,hf as aW,Uf as aX,E as aY,ep as aZ,Gf as a_,b0 as aa,R0 as ab,zf as ac,U1 as ad,np as ae,A0 as af,P0 as ag,t0 as ah,r0 as ai,uf as aj,fp as ak,tf as al,G0 as am,y0 as an,l0 as ao,hp as ap,cf as aq,Ff as ar,cp as as,Df as at,z1 as au,_f as av,sf as aw,Mp as ax,rf as ay,n0 as az,df as b,ip as b0,lf as b1,f0 as b2,d0 as b3,a0 as b4,E0 as b5,J1 as b6,Yf as b7,Ef as b8,D0 as b9,ff as ba,Tp as bb,pf as bc,j0 as bd,Sf as be,ef as bf,yf as bg,x0 as bh,Xf as bi,Vf as bj,Af as bk,v0 as bl,yp as bm,O0 as bn,u0 as bo,Y1 as bp,Z1 as bq,mf as br,o0 as bs,H0 as bt,Y0 as bu,gf as bv,U0 as bw,M0 as bx,vf as c,jf as d,K1 as e,sp as f,Rf as g,kp as h,G1 as i,ap as j,rp as k,W0 as l,_p as m,bp as n,_0 as o,vp as p,C0 as q,w0 as r,q0 as s,dp as t,F0 as u,Q0 as v,nf as w,wf as x,Pf as y,$0 as z};
