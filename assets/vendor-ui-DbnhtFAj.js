import{j as H}from"./vendor-utils-nviLaDDJ.js";import{r as m}from"./vendor-react-DrKgErkG.js";const Ge=m.createContext({});function re(t){const e=m.useRef(null);return e.current===null&&(e.current=t()),e.current}const ae=m.createContext(null),Dt=m.createContext({transformPagePoint:t=>t,isStatic:!1,reducedMotion:"never"});class Lo extends m.Component{getSnapshotBeforeUpdate(e){const n=this.props.childRef.current;if(n&&e.isPresent&&!this.props.isPresent){const s=this.props.sizeRef.current;s.height=n.offsetHeight||0,s.width=n.offsetWidth||0,s.top=n.offsetTop,s.left=n.offsetLeft}return null}componentDidUpdate(){}render(){return this.props.children}}function No({children:t,isPresent:e}){const n=m.useId(),s=m.useRef(null),i=m.useRef({width:0,height:0,top:0,left:0}),{nonce:r}=m.useContext(Dt);return m.useInsertionEffect(()=>{const{width:o,height:a,top:c,left:l}=i.current;if(e||!s.current||!o||!a)return;s.current.dataset.motionPopId=n;const u=document.createElement("style");return r&&(u.nonce=r),document.head.appendChild(u),u.sheet&&u.sheet.insertRule(`
          [data-motion-pop-id="${n}"] {
            position: absolute !important;
            width: ${o}px !important;
            height: ${a}px !important;
            top: ${c}px !important;
            left: ${l}px !important;
          }
        `),()=>{document.head.removeChild(u)}},[e]),H.jsx(Lo,{isPresent:e,childRef:s,sizeRef:i,children:m.cloneElement(t,{ref:s})})}const jo=({children:t,initial:e,isPresent:n,onExitComplete:s,custom:i,presenceAffectsLayout:r,mode:o})=>{const a=re($o),c=m.useId(),l=m.useCallback(h=>{a.set(h,!0);for(const d of a.values())if(!d)return;s&&s()},[a,s]),u=m.useMemo(()=>({id:c,initial:e,isPresent:n,custom:i,onExitComplete:l,register:h=>(a.set(h,!1),()=>a.delete(h))}),r?[Math.random(),l]:[n,l]);return m.useMemo(()=>{a.forEach((h,d)=>a.set(d,!1))},[n]),m.useEffect(()=>{!n&&!a.size&&s&&s()},[n]),o==="popLayout"&&(t=H.jsx(No,{isPresent:n,children:t})),H.jsx(ae.Provider,{value:u,children:t})};function $o(){return new Map}function Gs(t=!0){const e=m.useContext(ae);if(e===null)return[!0,null];const{isPresent:n,onExitComplete:s,register:i}=e,r=m.useId();m.useEffect(()=>{t&&i(r)},[t]);const o=m.useCallback(()=>t&&s&&s(r),[r,s,t]);return!n&&s?[!1,o]:[!0]}const zt=t=>t.key||"";function Dn(t){const e=[];return m.Children.forEach(t,n=>{m.isValidElement(n)&&e.push(n)}),e}const Xe=typeof window<"u",Xs=Xe?m.useLayoutEffect:m.useEffect,O1=({children:t,custom:e,initial:n=!0,onExitComplete:s,presenceAffectsLayout:i=!0,mode:r="sync",propagate:o=!1})=>{const[a,c]=Gs(o),l=m.useMemo(()=>Dn(t),[t]),u=o&&!a?[]:l.map(zt),h=m.useRef(!0),d=m.useRef(l),p=re(()=>new Map),[y,g]=m.useState(l),[v,x]=m.useState(l);Xs(()=>{h.current=!1,d.current=l;for(let T=0;T<v.length;T++){const b=zt(v[T]);u.includes(b)?p.delete(b):p.get(b)!==!0&&p.set(b,!1)}},[v,u.length,u.join("-")]);const M=[];if(l!==y){let T=[...l];for(let b=0;b<v.length;b++){const A=v[b],_=zt(A);u.includes(_)||(T.splice(b,0,A),M.push(A))}r==="wait"&&M.length&&(T=M),x(Dn(T)),g(l);return}const{forceRender:k}=m.useContext(Ge);return H.jsx(H.Fragment,{children:v.map(T=>{const b=zt(T),A=o&&!a?!1:l===v||u.includes(b),_=()=>{if(p.has(b))p.set(b,!0);else return;let P=!0;p.forEach(L=>{L||(P=!1)}),P&&(k==null||k(),x(d.current),o&&(c==null||c()),s&&s())};return H.jsx(jo,{isPresent:A,initial:!h.current||n?void 0:!1,custom:A?void 0:e,presenceAffectsLayout:i,mode:r,onExitComplete:A?void 0:_,children:T},b)})})},F=t=>t;let Ys=F;function Ye(t){let e;return()=>(e===void 0&&(e=t()),e)}const vt=(t,e,n)=>{const s=e-t;return s===0?1:(n-t)/s},Y=t=>t*1e3,Z=t=>t/1e3,Fo={useManualTiming:!1};function Bo(t){let e=new Set,n=new Set,s=!1,i=!1;const r=new WeakSet;let o={delta:0,timestamp:0,isProcessing:!1};function a(l){r.has(l)&&(c.schedule(l),t()),l(o)}const c={schedule:(l,u=!1,h=!1)=>{const p=h&&s?e:n;return u&&r.add(l),p.has(l)||p.add(l),l},cancel:l=>{n.delete(l),r.delete(l)},process:l=>{if(o=l,s){i=!0;return}s=!0,[e,n]=[n,e],e.forEach(a),e.clear(),s=!1,i&&(i=!1,c.process(l))}};return c}const Ut=["read","resolveKeyframes","update","preRender","render","postRender"],Oo=40;function Zs(t,e){let n=!1,s=!0;const i={delta:0,timestamp:0,isProcessing:!1},r=()=>n=!0,o=Ut.reduce((x,M)=>(x[M]=Bo(r),x),{}),{read:a,resolveKeyframes:c,update:l,preRender:u,render:h,postRender:d}=o,p=()=>{const x=performance.now();n=!1,i.delta=s?1e3/60:Math.max(Math.min(x-i.timestamp,Oo),1),i.timestamp=x,i.isProcessing=!0,a.process(i),c.process(i),l.process(i),u.process(i),h.process(i),d.process(i),i.isProcessing=!1,n&&e&&(s=!1,t(p))},y=()=>{n=!0,s=!0,i.isProcessing||t(p)};return{schedule:Ut.reduce((x,M)=>{const k=o[M];return x[M]=(T,b=!1,A=!1)=>(n||y(),k.schedule(T,b,A)),x},{}),cancel:x=>{for(let M=0;M<Ut.length;M++)o[Ut[M]].cancel(x)},state:i,steps:o}}const{schedule:S,cancel:nt,state:R,steps:ge}=Zs(typeof requestAnimationFrame<"u"?requestAnimationFrame:F,!0),Qs=m.createContext({strict:!1}),En={animation:["animate","variants","whileHover","whileTap","exit","whileInView","whileFocus","whileDrag"],exit:["exit"],drag:["drag","dragControls"],focus:["whileFocus"],hover:["whileHover","onHoverStart","onHoverEnd"],tap:["whileTap","onTap","onTapStart","onTapCancel"],pan:["onPan","onPanStart","onPanSessionStart","onPanEnd"],inView:["whileInView","onViewportEnter","onViewportLeave"],layout:["layout","layoutId"]},xt={};for(const t in En)xt[t]={isEnabled:e=>En[t].some(n=>!!e[n])};function Io(t){for(const e in t)xt[e]={...xt[e],...t[e]}}const zo=new Set(["animate","exit","variants","initial","style","values","variants","transition","transformTemplate","custom","inherit","onBeforeLayoutMeasure","onAnimationStart","onAnimationComplete","onUpdate","onDragStart","onDrag","onDragEnd","onMeasureDragConstraints","onDirectionLock","onDragTransitionEnd","_dragX","_dragY","onHoverStart","onHoverEnd","onViewportEnter","onViewportLeave","globalTapTarget","ignoreStrict","viewport"]);function Zt(t){return t.startsWith("while")||t.startsWith("drag")&&t!=="draggable"||t.startsWith("layout")||t.startsWith("onTap")||t.startsWith("onPan")||t.startsWith("onLayout")||zo.has(t)}let Js=t=>!Zt(t);function ti(t){t&&(Js=e=>e.startsWith("on")?!Zt(e):t(e))}try{ti(require("@emotion/is-prop-valid").default)}catch{}function Uo(t,e,n){const s={};for(const i in t)i==="values"&&typeof t.values=="object"||(Js(i)||n===!0&&Zt(i)||!e&&!Zt(i)||t.draggable&&i.startsWith("onDrag"))&&(s[i]=t[i]);return s}function I1({children:t,isValidProp:e,...n}){e&&ti(e),n={...m.useContext(Dt),...n},n.isStatic=re(()=>n.isStatic);const s=m.useMemo(()=>n,[JSON.stringify(n.transition),n.transformPagePoint,n.reducedMotion]);return H.jsx(Dt.Provider,{value:s,children:t})}function qo(t){if(typeof Proxy>"u")return t;const e=new Map,n=(...s)=>t(...s);return new Proxy(n,{get:(s,i)=>i==="create"?t:(e.has(i)||e.set(i,t(i)),e.get(i))})}const ce=m.createContext({});function Et(t){return typeof t=="string"||Array.isArray(t)}function le(t){return t!==null&&typeof t=="object"&&typeof t.start=="function"}const Ze=["animate","whileInView","whileFocus","whileHover","whileTap","whileDrag","exit"],Qe=["initial",...Ze];function ue(t){return le(t.animate)||Qe.some(e=>Et(t[e]))}function ei(t){return!!(ue(t)||t.variants)}function Ho(t,e){if(ue(t)){const{initial:n,animate:s}=t;return{initial:n===!1||Et(n)?n:void 0,animate:Et(s)?s:void 0}}return t.inherit!==!1?e:{}}function Ko(t){const{initial:e,animate:n}=Ho(t,m.useContext(ce));return m.useMemo(()=>({initial:e,animate:n}),[Rn(e),Rn(n)])}function Rn(t){return Array.isArray(t)?t.join(" "):t}const Wo=Symbol.for("motionComponentSymbol");function ft(t){return t&&typeof t=="object"&&Object.prototype.hasOwnProperty.call(t,"current")}function Go(t,e,n){return m.useCallback(s=>{s&&t.onMount&&t.onMount(s),e&&(s?e.mount(s):e.unmount()),n&&(typeof n=="function"?n(s):ft(n)&&(n.current=s))},[e])}const Je=t=>t.replace(/([a-z])([A-Z])/gu,"$1-$2").toLowerCase(),Xo="framerAppearId",ni="data-"+Je(Xo),{schedule:tn}=Zs(queueMicrotask,!1),si=m.createContext({});function Yo(t,e,n,s,i){var r,o;const{visualElement:a}=m.useContext(ce),c=m.useContext(Qs),l=m.useContext(ae),u=m.useContext(Dt).reducedMotion,h=m.useRef(null);s=s||c.renderer,!h.current&&s&&(h.current=s(t,{visualState:e,parent:a,props:n,presenceContext:l,blockInitialAnimation:l?l.initial===!1:!1,reducedMotionConfig:u}));const d=h.current,p=m.useContext(si);d&&!d.projection&&i&&(d.type==="html"||d.type==="svg")&&Zo(h.current,n,i,p);const y=m.useRef(!1);m.useInsertionEffect(()=>{d&&y.current&&d.update(n,l)});const g=n[ni],v=m.useRef(!!g&&!(!((r=window.MotionHandoffIsComplete)===null||r===void 0)&&r.call(window,g))&&((o=window.MotionHasOptimisedAnimation)===null||o===void 0?void 0:o.call(window,g)));return Xs(()=>{d&&(y.current=!0,window.MotionIsMounted=!0,d.updateFeatures(),tn.render(d.render),v.current&&d.animationState&&d.animationState.animateChanges())}),m.useEffect(()=>{d&&(!v.current&&d.animationState&&d.animationState.animateChanges(),v.current&&(queueMicrotask(()=>{var x;(x=window.MotionHandoffMarkAsComplete)===null||x===void 0||x.call(window,g)}),v.current=!1))}),d}function Zo(t,e,n,s){const{layoutId:i,layout:r,drag:o,dragConstraints:a,layoutScroll:c,layoutRoot:l}=e;t.projection=new n(t.latestValues,e["data-framer-portal-id"]?void 0:ii(t.parent)),t.projection.setOptions({layoutId:i,layout:r,alwaysMeasureLayout:!!o||a&&ft(a),visualElement:t,animationType:typeof r=="string"?r:"both",initialPromotionConfig:s,layoutScroll:c,layoutRoot:l})}function ii(t){if(t)return t.options.allowProjection!==!1?t.projection:ii(t.parent)}function Qo({preloadedFeatures:t,createVisualElement:e,useRender:n,useVisualState:s,Component:i}){var r,o;t&&Io(t);function a(l,u){let h;const d={...m.useContext(Dt),...l,layoutId:Jo(l)},{isStatic:p}=d,y=Ko(l),g=s(l,p);if(!p&&Xe){tr();const v=er(d);h=v.MeasureLayout,y.visualElement=Yo(i,g,d,e,v.ProjectionNode)}return H.jsxs(ce.Provider,{value:y,children:[h&&y.visualElement?H.jsx(h,{visualElement:y.visualElement,...d}):null,n(i,l,Go(g,y.visualElement,u),g,p,y.visualElement)]})}a.displayName=`motion.${typeof i=="string"?i:`create(${(o=(r=i.displayName)!==null&&r!==void 0?r:i.name)!==null&&o!==void 0?o:""})`}`;const c=m.forwardRef(a);return c[Wo]=i,c}function Jo({layoutId:t}){const e=m.useContext(Ge).id;return e&&t!==void 0?e+"-"+t:t}function tr(t,e){m.useContext(Qs).strict}function er(t){const{drag:e,layout:n}=xt;if(!e&&!n)return{};const s={...e,...n};return{MeasureLayout:e!=null&&e.isEnabled(t)||n!=null&&n.isEnabled(t)?s.MeasureLayout:void 0,ProjectionNode:s.ProjectionNode}}const nr=["animate","circle","defs","desc","ellipse","g","image","line","filter","marker","mask","metadata","path","pattern","polygon","polyline","rect","stop","switch","symbol","svg","text","tspan","use","view"];function en(t){return typeof t!="string"||t.includes("-")?!1:!!(nr.indexOf(t)>-1||/[A-Z]/u.test(t))}function Ln(t){const e=[{},{}];return t==null||t.values.forEach((n,s)=>{e[0][s]=n.get(),e[1][s]=n.getVelocity()}),e}function nn(t,e,n,s){if(typeof e=="function"){const[i,r]=Ln(s);e=e(n!==void 0?n:t.custom,i,r)}if(typeof e=="string"&&(e=t.variants&&t.variants[e]),typeof e=="function"){const[i,r]=Ln(s);e=e(n!==void 0?n:t.custom,i,r)}return e}const De=t=>Array.isArray(t),sr=t=>!!(t&&typeof t=="object"&&t.mix&&t.toValue),ir=t=>De(t)?t[t.length-1]||0:t,j=t=>!!(t&&t.getVelocity);function Wt(t){const e=j(t)?t.get():t;return sr(e)?e.toValue():e}function or({scrapeMotionValuesFromProps:t,createRenderState:e,onUpdate:n},s,i,r){const o={latestValues:rr(s,i,r,t),renderState:e()};return n&&(o.onMount=a=>n({props:s,current:a,...o}),o.onUpdate=a=>n(a)),o}const oi=t=>(e,n)=>{const s=m.useContext(ce),i=m.useContext(ae),r=()=>or(t,e,s,i);return n?r():re(r)};function rr(t,e,n,s){const i={},r=s(t,{});for(const d in r)i[d]=Wt(r[d]);let{initial:o,animate:a}=t;const c=ue(t),l=ei(t);e&&l&&!c&&t.inherit!==!1&&(o===void 0&&(o=e.initial),a===void 0&&(a=e.animate));let u=n?n.initial===!1:!1;u=u||o===!1;const h=u?a:o;if(h&&typeof h!="boolean"&&!le(h)){const d=Array.isArray(h)?h:[h];for(let p=0;p<d.length;p++){const y=nn(t,d[p]);if(y){const{transitionEnd:g,transition:v,...x}=y;for(const M in x){let k=x[M];if(Array.isArray(k)){const T=u?k.length-1:0;k=k[T]}k!==null&&(i[M]=k)}for(const M in g)i[M]=g[M]}}}return i}const Mt=["transformPerspective","x","y","z","translateX","translateY","translateZ","scale","scaleX","scaleY","rotate","rotateX","rotateY","rotateZ","skew","skewX","skewY"],ht=new Set(Mt),ri=t=>e=>typeof e=="string"&&e.startsWith(t),ai=ri("--"),ar=ri("var(--"),sn=t=>ar(t)?cr.test(t.split("/*")[0].trim()):!1,cr=/var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu,ci=(t,e)=>e&&typeof t=="number"?e.transform(t):t,Q=(t,e,n)=>n>e?e:n<t?t:n,bt={test:t=>typeof t=="number",parse:parseFloat,transform:t=>t},Rt={...bt,transform:t=>Q(0,1,t)},qt={...bt,default:1},$t=t=>({test:e=>typeof e=="string"&&e.endsWith(t)&&e.split(" ").length===1,parse:parseFloat,transform:e=>`${e}${t}`}),tt=$t("deg"),K=$t("%"),w=$t("px"),lr=$t("vh"),ur=$t("vw"),Nn={...K,parse:t=>K.parse(t)/100,transform:t=>K.transform(t*100)},hr={borderWidth:w,borderTopWidth:w,borderRightWidth:w,borderBottomWidth:w,borderLeftWidth:w,borderRadius:w,radius:w,borderTopLeftRadius:w,borderTopRightRadius:w,borderBottomRightRadius:w,borderBottomLeftRadius:w,width:w,maxWidth:w,height:w,maxHeight:w,top:w,right:w,bottom:w,left:w,padding:w,paddingTop:w,paddingRight:w,paddingBottom:w,paddingLeft:w,margin:w,marginTop:w,marginRight:w,marginBottom:w,marginLeft:w,backgroundPositionX:w,backgroundPositionY:w},dr={rotate:tt,rotateX:tt,rotateY:tt,rotateZ:tt,scale:qt,scaleX:qt,scaleY:qt,scaleZ:qt,skew:tt,skewX:tt,skewY:tt,distance:w,translateX:w,translateY:w,translateZ:w,x:w,y:w,z:w,perspective:w,transformPerspective:w,opacity:Rt,originX:Nn,originY:Nn,originZ:w},jn={...bt,transform:Math.round},on={...hr,...dr,zIndex:jn,size:w,fillOpacity:Rt,strokeOpacity:Rt,numOctaves:jn},fr={x:"translateX",y:"translateY",z:"translateZ",transformPerspective:"perspective"},pr=Mt.length;function mr(t,e,n){let s="",i=!0;for(let r=0;r<pr;r++){const o=Mt[r],a=t[o];if(a===void 0)continue;let c=!0;if(typeof a=="number"?c=a===(o.startsWith("scale")?1:0):c=parseFloat(a)===0,!c||n){const l=ci(a,on[o]);if(!c){i=!1;const u=fr[o]||o;s+=`${u}(${l}) `}n&&(e[o]=l)}}return s=s.trim(),n?s=n(e,i?"":s):i&&(s="none"),s}function rn(t,e,n){const{style:s,vars:i,transformOrigin:r}=t;let o=!1,a=!1;for(const c in e){const l=e[c];if(ht.has(c)){o=!0;continue}else if(ai(c)){i[c]=l;continue}else{const u=ci(l,on[c]);c.startsWith("origin")?(a=!0,r[c]=u):s[c]=u}}if(e.transform||(o||n?s.transform=mr(e,t.transform,n):s.transform&&(s.transform="none")),a){const{originX:c="50%",originY:l="50%",originZ:u=0}=r;s.transformOrigin=`${c} ${l} ${u}`}}const yr={offset:"stroke-dashoffset",array:"stroke-dasharray"},gr={offset:"strokeDashoffset",array:"strokeDasharray"};function vr(t,e,n=1,s=0,i=!0){t.pathLength=1;const r=i?yr:gr;t[r.offset]=w.transform(-s);const o=w.transform(e),a=w.transform(n);t[r.array]=`${o} ${a}`}function $n(t,e,n){return typeof t=="string"?t:w.transform(e+n*t)}function xr(t,e,n){const s=$n(e,t.x,t.width),i=$n(n,t.y,t.height);return`${s} ${i}`}function an(t,{attrX:e,attrY:n,attrScale:s,originX:i,originY:r,pathLength:o,pathSpacing:a=1,pathOffset:c=0,...l},u,h){if(rn(t,l,h),u){t.style.viewBox&&(t.attrs.viewBox=t.style.viewBox);return}t.attrs=t.style,t.style={};const{attrs:d,style:p,dimensions:y}=t;d.transform&&(y&&(p.transform=d.transform),delete d.transform),y&&(i!==void 0||r!==void 0||p.transform)&&(p.transformOrigin=xr(y,i!==void 0?i:.5,r!==void 0?r:.5)),e!==void 0&&(d.x=e),n!==void 0&&(d.y=n),s!==void 0&&(d.scale=s),o!==void 0&&vr(d,o,a,c,!1)}const cn=()=>({style:{},transform:{},transformOrigin:{},vars:{}}),li=()=>({...cn(),attrs:{}}),ln=t=>typeof t=="string"&&t.toLowerCase()==="svg";function ui(t,{style:e,vars:n},s,i){Object.assign(t.style,e,i&&i.getProjectionStyles(s));for(const r in n)t.style.setProperty(r,n[r])}const hi=new Set(["baseFrequency","diffuseConstant","kernelMatrix","kernelUnitLength","keySplines","keyTimes","limitingConeAngle","markerHeight","markerWidth","numOctaves","targetX","targetY","surfaceScale","specularConstant","specularExponent","stdDeviation","tableValues","viewBox","gradientTransform","pathLength","startOffset","textLength","lengthAdjust"]);function di(t,e,n,s){ui(t,e,void 0,s);for(const i in e.attrs)t.setAttribute(hi.has(i)?i:Je(i),e.attrs[i])}const Qt={};function kr(t){Object.assign(Qt,t)}function fi(t,{layout:e,layoutId:n}){return ht.has(t)||t.startsWith("origin")||(e||n!==void 0)&&(!!Qt[t]||t==="opacity")}function un(t,e,n){var s;const{style:i}=t,r={};for(const o in i)(j(i[o])||e.style&&j(e.style[o])||fi(o,t)||((s=n==null?void 0:n.getValue(o))===null||s===void 0?void 0:s.liveStyle)!==void 0)&&(r[o]=i[o]);return r}function pi(t,e,n){const s=un(t,e,n);for(const i in t)if(j(t[i])||j(e[i])){const r=Mt.indexOf(i)!==-1?"attr"+i.charAt(0).toUpperCase()+i.substring(1):i;s[r]=t[i]}return s}function Mr(t,e){try{e.dimensions=typeof t.getBBox=="function"?t.getBBox():t.getBoundingClientRect()}catch{e.dimensions={x:0,y:0,width:0,height:0}}}const Fn=["x","y","width","height","cx","cy","r"],br={useVisualState:oi({scrapeMotionValuesFromProps:pi,createRenderState:li,onUpdate:({props:t,prevProps:e,current:n,renderState:s,latestValues:i})=>{if(!n)return;let r=!!t.drag;if(!r){for(const a in i)if(ht.has(a)){r=!0;break}}if(!r)return;let o=!e;if(e)for(let a=0;a<Fn.length;a++){const c=Fn[a];t[c]!==e[c]&&(o=!0)}o&&S.read(()=>{Mr(n,s),S.render(()=>{an(s,i,ln(n.tagName),t.transformTemplate),di(n,s)})})}})},wr={useVisualState:oi({scrapeMotionValuesFromProps:un,createRenderState:cn})};function mi(t,e,n){for(const s in e)!j(e[s])&&!fi(s,n)&&(t[s]=e[s])}function Tr({transformTemplate:t},e){return m.useMemo(()=>{const n=cn();return rn(n,e,t),Object.assign({},n.vars,n.style)},[e])}function Pr(t,e){const n=t.style||{},s={};return mi(s,n,t),Object.assign(s,Tr(t,e)),s}function Ar(t,e){const n={},s=Pr(t,e);return t.drag&&t.dragListener!==!1&&(n.draggable=!1,s.userSelect=s.WebkitUserSelect=s.WebkitTouchCallout="none",s.touchAction=t.drag===!0?"none":`pan-${t.drag==="x"?"y":"x"}`),t.tabIndex===void 0&&(t.onTap||t.onTapStart||t.whileTap)&&(n.tabIndex=0),n.style=s,n}function Sr(t,e,n,s){const i=m.useMemo(()=>{const r=li();return an(r,e,ln(s),t.transformTemplate),{...r.attrs,style:{...r.style}}},[e]);if(t.style){const r={};mi(r,t.style,t),i.style={...r,...i.style}}return i}function Cr(t=!1){return(n,s,i,{latestValues:r},o)=>{const c=(en(n)?Sr:Ar)(s,r,o,n),l=Uo(s,typeof n=="string",t),u=n!==m.Fragment?{...l,...c,ref:i}:{},{children:h}=s,d=m.useMemo(()=>j(h)?h.get():h,[h]);return m.createElement(n,{...u,children:d})}}function Vr(t,e){return function(s,{forwardMotionProps:i}={forwardMotionProps:!1}){const o={...en(s)?br:wr,preloadedFeatures:t,useRender:Cr(i),createVisualElement:e,Component:s};return Qo(o)}}function yi(t,e){if(!Array.isArray(e))return!1;const n=e.length;if(n!==t.length)return!1;for(let s=0;s<n;s++)if(e[s]!==t[s])return!1;return!0}function he(t,e,n){const s=t.getProps();return nn(s,e,n!==void 0?n:s.custom,t)}const _r=Ye(()=>window.ScrollTimeline!==void 0);class Dr{constructor(e){this.stop=()=>this.runAll("stop"),this.animations=e.filter(Boolean)}get finished(){return Promise.all(this.animations.map(e=>"finished"in e?e.finished:e))}getAll(e){return this.animations[0][e]}setAll(e,n){for(let s=0;s<this.animations.length;s++)this.animations[s][e]=n}attachTimeline(e,n){const s=this.animations.map(i=>{if(_r()&&i.attachTimeline)return i.attachTimeline(e);if(typeof n=="function")return n(i)});return()=>{s.forEach((i,r)=>{i&&i(),this.animations[r].stop()})}}get time(){return this.getAll("time")}set time(e){this.setAll("time",e)}get speed(){return this.getAll("speed")}set speed(e){this.setAll("speed",e)}get startTime(){return this.getAll("startTime")}get duration(){let e=0;for(let n=0;n<this.animations.length;n++)e=Math.max(e,this.animations[n].duration);return e}runAll(e){this.animations.forEach(n=>n[e]())}flatten(){this.runAll("flatten")}play(){this.runAll("play")}pause(){this.runAll("pause")}cancel(){this.runAll("cancel")}complete(){this.runAll("complete")}}class Er extends Dr{then(e,n){return Promise.all(this.animations).then(e).catch(n)}}function hn(t,e){return t?t[e]||t.default||t:void 0}const Ee=2e4;function gi(t){let e=0;const n=50;let s=t.next(e);for(;!s.done&&e<Ee;)e+=n,s=t.next(e);return e>=Ee?1/0:e}function dn(t){return typeof t=="function"}function Bn(t,e){t.timeline=e,t.onfinish=null}const fn=t=>Array.isArray(t)&&typeof t[0]=="number",Rr={linearEasing:void 0};function Lr(t,e){const n=Ye(t);return()=>{var s;return(s=Rr[e])!==null&&s!==void 0?s:n()}}const Jt=Lr(()=>{try{document.createElement("div").animate({opacity:0},{easing:"linear(0, 1)"})}catch{return!1}return!0},"linearEasing"),vi=(t,e,n=10)=>{let s="";const i=Math.max(Math.round(e/n),2);for(let r=0;r<i;r++)s+=t(vt(0,i-1,r))+", ";return`linear(${s.substring(0,s.length-2)})`};function xi(t){return!!(typeof t=="function"&&Jt()||!t||typeof t=="string"&&(t in Re||Jt())||fn(t)||Array.isArray(t)&&t.every(xi))}const Tt=([t,e,n,s])=>`cubic-bezier(${t}, ${e}, ${n}, ${s})`,Re={linear:"linear",ease:"ease",easeIn:"ease-in",easeOut:"ease-out",easeInOut:"ease-in-out",circIn:Tt([0,.65,.55,1]),circOut:Tt([.55,0,1,.45]),backIn:Tt([.31,.01,.66,-.59]),backOut:Tt([.33,1.53,.69,.99])};function ki(t,e){if(t)return typeof t=="function"&&Jt()?vi(t,e):fn(t)?Tt(t):Array.isArray(t)?t.map(n=>ki(n,e)||Re.easeOut):Re[t]}const U={x:!1,y:!1};function Mi(){return U.x||U.y}function Nr(t,e,n){var s;if(t instanceof Element)return[t];if(typeof t=="string"){let i=document;const r=(s=void 0)!==null&&s!==void 0?s:i.querySelectorAll(t);return r?Array.from(r):[]}return Array.from(t)}function bi(t,e){const n=Nr(t),s=new AbortController,i={passive:!0,...e,signal:s.signal};return[n,i,()=>s.abort()]}function On(t){return e=>{e.pointerType==="touch"||Mi()||t(e)}}function jr(t,e,n={}){const[s,i,r]=bi(t,n),o=On(a=>{const{target:c}=a,l=e(a);if(typeof l!="function"||!c)return;const u=On(h=>{l(h),c.removeEventListener("pointerleave",u)});c.addEventListener("pointerleave",u,i)});return s.forEach(a=>{a.addEventListener("pointerenter",o,i)}),r}const wi=(t,e)=>e?t===e?!0:wi(t,e.parentElement):!1,pn=t=>t.pointerType==="mouse"?typeof t.button!="number"||t.button<=0:t.isPrimary!==!1,$r=new Set(["BUTTON","INPUT","SELECT","TEXTAREA","A"]);function Fr(t){return $r.has(t.tagName)||t.tabIndex!==-1}const Pt=new WeakSet;function In(t){return e=>{e.key==="Enter"&&t(e)}}function ve(t,e){t.dispatchEvent(new PointerEvent("pointer"+e,{isPrimary:!0,bubbles:!0}))}const Br=(t,e)=>{const n=t.currentTarget;if(!n)return;const s=In(()=>{if(Pt.has(n))return;ve(n,"down");const i=In(()=>{ve(n,"up")}),r=()=>ve(n,"cancel");n.addEventListener("keyup",i,e),n.addEventListener("blur",r,e)});n.addEventListener("keydown",s,e),n.addEventListener("blur",()=>n.removeEventListener("keydown",s),e)};function zn(t){return pn(t)&&!Mi()}function Or(t,e,n={}){const[s,i,r]=bi(t,n),o=a=>{const c=a.currentTarget;if(!zn(a)||Pt.has(c))return;Pt.add(c);const l=e(a),u=(p,y)=>{window.removeEventListener("pointerup",h),window.removeEventListener("pointercancel",d),!(!zn(p)||!Pt.has(c))&&(Pt.delete(c),typeof l=="function"&&l(p,{success:y}))},h=p=>{u(p,n.useGlobalTarget||wi(c,p.target))},d=p=>{u(p,!1)};window.addEventListener("pointerup",h,i),window.addEventListener("pointercancel",d,i)};return s.forEach(a=>{!Fr(a)&&a.getAttribute("tabindex")===null&&(a.tabIndex=0),(n.useGlobalTarget?window:a).addEventListener("pointerdown",o,i),a.addEventListener("focus",l=>Br(l,i),i)}),r}function Ir(t){return t==="x"||t==="y"?U[t]?null:(U[t]=!0,()=>{U[t]=!1}):U.x||U.y?null:(U.x=U.y=!0,()=>{U.x=U.y=!1})}const Ti=new Set(["width","height","top","left","right","bottom",...Mt]);let Gt;function zr(){Gt=void 0}const W={now:()=>(Gt===void 0&&W.set(R.isProcessing||Fo.useManualTiming?R.timestamp:performance.now()),Gt),set:t=>{Gt=t,queueMicrotask(zr)}};function mn(t,e){t.indexOf(e)===-1&&t.push(e)}function yn(t,e){const n=t.indexOf(e);n>-1&&t.splice(n,1)}class gn{constructor(){this.subscriptions=[]}add(e){return mn(this.subscriptions,e),()=>yn(this.subscriptions,e)}notify(e,n,s){const i=this.subscriptions.length;if(i)if(i===1)this.subscriptions[0](e,n,s);else for(let r=0;r<i;r++){const o=this.subscriptions[r];o&&o(e,n,s)}}getSize(){return this.subscriptions.length}clear(){this.subscriptions.length=0}}function Pi(t,e){return e?t*(1e3/e):0}const Un=30,Ur=t=>!isNaN(parseFloat(t));class qr{constructor(e,n={}){this.version="11.18.2",this.canTrackVelocity=null,this.events={},this.updateAndNotify=(s,i=!0)=>{const r=W.now();this.updatedAt!==r&&this.setPrevFrameValue(),this.prev=this.current,this.setCurrent(s),this.current!==this.prev&&this.events.change&&this.events.change.notify(this.current),i&&this.events.renderRequest&&this.events.renderRequest.notify(this.current)},this.hasAnimated=!1,this.setCurrent(e),this.owner=n.owner}setCurrent(e){this.current=e,this.updatedAt=W.now(),this.canTrackVelocity===null&&e!==void 0&&(this.canTrackVelocity=Ur(this.current))}setPrevFrameValue(e=this.current){this.prevFrameValue=e,this.prevUpdatedAt=this.updatedAt}onChange(e){return this.on("change",e)}on(e,n){this.events[e]||(this.events[e]=new gn);const s=this.events[e].add(n);return e==="change"?()=>{s(),S.read(()=>{this.events.change.getSize()||this.stop()})}:s}clearListeners(){for(const e in this.events)this.events[e].clear()}attach(e,n){this.passiveEffect=e,this.stopPassiveEffect=n}set(e,n=!0){!n||!this.passiveEffect?this.updateAndNotify(e,n):this.passiveEffect(e,this.updateAndNotify)}setWithVelocity(e,n,s){this.set(n),this.prev=void 0,this.prevFrameValue=e,this.prevUpdatedAt=this.updatedAt-s}jump(e,n=!0){this.updateAndNotify(e),this.prev=e,this.prevUpdatedAt=this.prevFrameValue=void 0,n&&this.stop(),this.stopPassiveEffect&&this.stopPassiveEffect()}get(){return this.current}getPrevious(){return this.prev}getVelocity(){const e=W.now();if(!this.canTrackVelocity||this.prevFrameValue===void 0||e-this.updatedAt>Un)return 0;const n=Math.min(this.updatedAt-this.prevUpdatedAt,Un);return Pi(parseFloat(this.current)-parseFloat(this.prevFrameValue),n)}start(e){return this.stop(),new Promise(n=>{this.hasAnimated=!0,this.animation=e(n),this.events.animationStart&&this.events.animationStart.notify()}).then(()=>{this.events.animationComplete&&this.events.animationComplete.notify(),this.clearAnimation()})}stop(){this.animation&&(this.animation.stop(),this.events.animationCancel&&this.events.animationCancel.notify()),this.clearAnimation()}isAnimating(){return!!this.animation}clearAnimation(){delete this.animation}destroy(){this.clearListeners(),this.stop(),this.stopPassiveEffect&&this.stopPassiveEffect()}}function Lt(t,e){return new qr(t,e)}function Hr(t,e,n){t.hasValue(e)?t.getValue(e).set(n):t.addValue(e,Lt(n))}function Kr(t,e){const n=he(t,e);let{transitionEnd:s={},transition:i={},...r}=n||{};r={...r,...s};for(const o in r){const a=ir(r[o]);Hr(t,o,a)}}function Wr(t){return!!(j(t)&&t.add)}function Le(t,e){const n=t.getValue("willChange");if(Wr(n))return n.add(e)}function Ai(t){return t.props[ni]}const Si=(t,e,n)=>(((1-3*n+3*e)*t+(3*n-6*e))*t+3*e)*t,Gr=1e-7,Xr=12;function Yr(t,e,n,s,i){let r,o,a=0;do o=e+(n-e)/2,r=Si(o,s,i)-t,r>0?n=o:e=o;while(Math.abs(r)>Gr&&++a<Xr);return o}function Ft(t,e,n,s){if(t===e&&n===s)return F;const i=r=>Yr(r,0,1,t,n);return r=>r===0||r===1?r:Si(i(r),e,s)}const Ci=t=>e=>e<=.5?t(2*e)/2:(2-t(2*(1-e)))/2,Vi=t=>e=>1-t(1-e),_i=Ft(.33,1.53,.69,.99),vn=Vi(_i),Di=Ci(vn),Ei=t=>(t*=2)<1?.5*vn(t):.5*(2-Math.pow(2,-10*(t-1))),xn=t=>1-Math.sin(Math.acos(t)),Ri=Vi(xn),Li=Ci(xn),Ni=t=>/^0[^.\s]+$/u.test(t);function Zr(t){return typeof t=="number"?t===0:t!==null?t==="none"||t==="0"||Ni(t):!0}const St=t=>Math.round(t*1e5)/1e5,kn=/-?(?:\d+(?:\.\d+)?|\.\d+)/gu;function Qr(t){return t==null}const Jr=/^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu,Mn=(t,e)=>n=>!!(typeof n=="string"&&Jr.test(n)&&n.startsWith(t)||e&&!Qr(n)&&Object.prototype.hasOwnProperty.call(n,e)),ji=(t,e,n)=>s=>{if(typeof s!="string")return s;const[i,r,o,a]=s.match(kn);return{[t]:parseFloat(i),[e]:parseFloat(r),[n]:parseFloat(o),alpha:a!==void 0?parseFloat(a):1}},ta=t=>Q(0,255,t),xe={...bt,transform:t=>Math.round(ta(t))},lt={test:Mn("rgb","red"),parse:ji("red","green","blue"),transform:({red:t,green:e,blue:n,alpha:s=1})=>"rgba("+xe.transform(t)+", "+xe.transform(e)+", "+xe.transform(n)+", "+St(Rt.transform(s))+")"};function ea(t){let e="",n="",s="",i="";return t.length>5?(e=t.substring(1,3),n=t.substring(3,5),s=t.substring(5,7),i=t.substring(7,9)):(e=t.substring(1,2),n=t.substring(2,3),s=t.substring(3,4),i=t.substring(4,5),e+=e,n+=n,s+=s,i+=i),{red:parseInt(e,16),green:parseInt(n,16),blue:parseInt(s,16),alpha:i?parseInt(i,16)/255:1}}const Ne={test:Mn("#"),parse:ea,transform:lt.transform},pt={test:Mn("hsl","hue"),parse:ji("hue","saturation","lightness"),transform:({hue:t,saturation:e,lightness:n,alpha:s=1})=>"hsla("+Math.round(t)+", "+K.transform(St(e))+", "+K.transform(St(n))+", "+St(Rt.transform(s))+")"},N={test:t=>lt.test(t)||Ne.test(t)||pt.test(t),parse:t=>lt.test(t)?lt.parse(t):pt.test(t)?pt.parse(t):Ne.parse(t),transform:t=>typeof t=="string"?t:t.hasOwnProperty("red")?lt.transform(t):pt.transform(t)},na=/(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;function sa(t){var e,n;return isNaN(t)&&typeof t=="string"&&(((e=t.match(kn))===null||e===void 0?void 0:e.length)||0)+(((n=t.match(na))===null||n===void 0?void 0:n.length)||0)>0}const $i="number",Fi="color",ia="var",oa="var(",qn="${}",ra=/var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;function Nt(t){const e=t.toString(),n=[],s={color:[],number:[],var:[]},i=[];let r=0;const a=e.replace(ra,c=>(N.test(c)?(s.color.push(r),i.push(Fi),n.push(N.parse(c))):c.startsWith(oa)?(s.var.push(r),i.push(ia),n.push(c)):(s.number.push(r),i.push($i),n.push(parseFloat(c))),++r,qn)).split(qn);return{values:n,split:a,indexes:s,types:i}}function Bi(t){return Nt(t).values}function Oi(t){const{split:e,types:n}=Nt(t),s=e.length;return i=>{let r="";for(let o=0;o<s;o++)if(r+=e[o],i[o]!==void 0){const a=n[o];a===$i?r+=St(i[o]):a===Fi?r+=N.transform(i[o]):r+=i[o]}return r}}const aa=t=>typeof t=="number"?0:t;function ca(t){const e=Bi(t);return Oi(t)(e.map(aa))}const st={test:sa,parse:Bi,createTransformer:Oi,getAnimatableNone:ca},la=new Set(["brightness","contrast","saturate","opacity"]);function ua(t){const[e,n]=t.slice(0,-1).split("(");if(e==="drop-shadow")return t;const[s]=n.match(kn)||[];if(!s)return t;const i=n.replace(s,"");let r=la.has(e)?1:0;return s!==n&&(r*=100),e+"("+r+i+")"}const ha=/\b([a-z-]*)\(.*?\)/gu,je={...st,getAnimatableNone:t=>{const e=t.match(ha);return e?e.map(ua).join(" "):t}},da={...on,color:N,backgroundColor:N,outlineColor:N,fill:N,stroke:N,borderColor:N,borderTopColor:N,borderRightColor:N,borderBottomColor:N,borderLeftColor:N,filter:je,WebkitFilter:je},bn=t=>da[t];function Ii(t,e){let n=bn(t);return n!==je&&(n=st),n.getAnimatableNone?n.getAnimatableNone(e):void 0}const fa=new Set(["auto","none","0"]);function pa(t,e,n){let s=0,i;for(;s<t.length&&!i;){const r=t[s];typeof r=="string"&&!fa.has(r)&&Nt(r).values.length&&(i=t[s]),s++}if(i&&n)for(const r of e)t[r]=Ii(n,i)}const Hn=t=>t===bt||t===w,Kn=(t,e)=>parseFloat(t.split(", ")[e]),Wn=(t,e)=>(n,{transform:s})=>{if(s==="none"||!s)return 0;const i=s.match(/^matrix3d\((.+)\)$/u);if(i)return Kn(i[1],e);{const r=s.match(/^matrix\((.+)\)$/u);return r?Kn(r[1],t):0}},ma=new Set(["x","y","z"]),ya=Mt.filter(t=>!ma.has(t));function ga(t){const e=[];return ya.forEach(n=>{const s=t.getValue(n);s!==void 0&&(e.push([n,s.get()]),s.set(n.startsWith("scale")?1:0))}),e}const kt={width:({x:t},{paddingLeft:e="0",paddingRight:n="0"})=>t.max-t.min-parseFloat(e)-parseFloat(n),height:({y:t},{paddingTop:e="0",paddingBottom:n="0"})=>t.max-t.min-parseFloat(e)-parseFloat(n),top:(t,{top:e})=>parseFloat(e),left:(t,{left:e})=>parseFloat(e),bottom:({y:t},{top:e})=>parseFloat(e)+(t.max-t.min),right:({x:t},{left:e})=>parseFloat(e)+(t.max-t.min),x:Wn(4,13),y:Wn(5,14)};kt.translateX=kt.x;kt.translateY=kt.y;const ut=new Set;let $e=!1,Fe=!1;function zi(){if(Fe){const t=Array.from(ut).filter(s=>s.needsMeasurement),e=new Set(t.map(s=>s.element)),n=new Map;e.forEach(s=>{const i=ga(s);i.length&&(n.set(s,i),s.render())}),t.forEach(s=>s.measureInitialState()),e.forEach(s=>{s.render();const i=n.get(s);i&&i.forEach(([r,o])=>{var a;(a=s.getValue(r))===null||a===void 0||a.set(o)})}),t.forEach(s=>s.measureEndState()),t.forEach(s=>{s.suspendedScrollY!==void 0&&window.scrollTo(0,s.suspendedScrollY)})}Fe=!1,$e=!1,ut.forEach(t=>t.complete()),ut.clear()}function Ui(){ut.forEach(t=>{t.readKeyframes(),t.needsMeasurement&&(Fe=!0)})}function va(){Ui(),zi()}class wn{constructor(e,n,s,i,r,o=!1){this.isComplete=!1,this.isAsync=!1,this.needsMeasurement=!1,this.isScheduled=!1,this.unresolvedKeyframes=[...e],this.onComplete=n,this.name=s,this.motionValue=i,this.element=r,this.isAsync=o}scheduleResolve(){this.isScheduled=!0,this.isAsync?(ut.add(this),$e||($e=!0,S.read(Ui),S.resolveKeyframes(zi))):(this.readKeyframes(),this.complete())}readKeyframes(){const{unresolvedKeyframes:e,name:n,element:s,motionValue:i}=this;for(let r=0;r<e.length;r++)if(e[r]===null)if(r===0){const o=i==null?void 0:i.get(),a=e[e.length-1];if(o!==void 0)e[0]=o;else if(s&&n){const c=s.readValue(n,a);c!=null&&(e[0]=c)}e[0]===void 0&&(e[0]=a),i&&o===void 0&&i.set(e[0])}else e[r]=e[r-1]}setFinalKeyframe(){}measureInitialState(){}renderEndStyles(){}measureEndState(){}complete(){this.isComplete=!0,this.onComplete(this.unresolvedKeyframes,this.finalKeyframe),ut.delete(this)}cancel(){this.isComplete||(this.isScheduled=!1,ut.delete(this))}resume(){this.isComplete||this.scheduleResolve()}}const qi=t=>/^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(t),xa=/^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;function ka(t){const e=xa.exec(t);if(!e)return[,];const[,n,s,i]=e;return[`--${n??s}`,i]}function Hi(t,e,n=1){const[s,i]=ka(t);if(!s)return;const r=window.getComputedStyle(e).getPropertyValue(s);if(r){const o=r.trim();return qi(o)?parseFloat(o):o}return sn(i)?Hi(i,e,n+1):i}const Ki=t=>e=>e.test(t),Ma={test:t=>t==="auto",parse:t=>t},Wi=[bt,w,K,tt,ur,lr,Ma],Gn=t=>Wi.find(Ki(t));class Gi extends wn{constructor(e,n,s,i,r){super(e,n,s,i,r,!0)}readKeyframes(){const{unresolvedKeyframes:e,element:n,name:s}=this;if(!n||!n.current)return;super.readKeyframes();for(let c=0;c<e.length;c++){let l=e[c];if(typeof l=="string"&&(l=l.trim(),sn(l))){const u=Hi(l,n.current);u!==void 0&&(e[c]=u),c===e.length-1&&(this.finalKeyframe=l)}}if(this.resolveNoneKeyframes(),!Ti.has(s)||e.length!==2)return;const[i,r]=e,o=Gn(i),a=Gn(r);if(o!==a)if(Hn(o)&&Hn(a))for(let c=0;c<e.length;c++){const l=e[c];typeof l=="string"&&(e[c]=parseFloat(l))}else this.needsMeasurement=!0}resolveNoneKeyframes(){const{unresolvedKeyframes:e,name:n}=this,s=[];for(let i=0;i<e.length;i++)Zr(e[i])&&s.push(i);s.length&&pa(e,s,n)}measureInitialState(){const{element:e,unresolvedKeyframes:n,name:s}=this;if(!e||!e.current)return;s==="height"&&(this.suspendedScrollY=window.pageYOffset),this.measuredOrigin=kt[s](e.measureViewportBox(),window.getComputedStyle(e.current)),n[0]=this.measuredOrigin;const i=n[n.length-1];i!==void 0&&e.getValue(s,i).jump(i,!1)}measureEndState(){var e;const{element:n,name:s,unresolvedKeyframes:i}=this;if(!n||!n.current)return;const r=n.getValue(s);r&&r.jump(this.measuredOrigin,!1);const o=i.length-1,a=i[o];i[o]=kt[s](n.measureViewportBox(),window.getComputedStyle(n.current)),a!==null&&this.finalKeyframe===void 0&&(this.finalKeyframe=a),!((e=this.removedTransforms)===null||e===void 0)&&e.length&&this.removedTransforms.forEach(([c,l])=>{n.getValue(c).set(l)}),this.resolveNoneKeyframes()}}const Xn=(t,e)=>e==="zIndex"?!1:!!(typeof t=="number"||Array.isArray(t)||typeof t=="string"&&(st.test(t)||t==="0")&&!t.startsWith("url("));function ba(t){const e=t[0];if(t.length===1)return!0;for(let n=0;n<t.length;n++)if(t[n]!==e)return!0}function wa(t,e,n,s){const i=t[0];if(i===null)return!1;if(e==="display"||e==="visibility")return!0;const r=t[t.length-1],o=Xn(i,e),a=Xn(r,e);return!o||!a?!1:ba(t)||(n==="spring"||dn(n))&&s}const Ta=t=>t!==null;function de(t,{repeat:e,repeatType:n="loop"},s){const i=t.filter(Ta),r=e&&n!=="loop"&&e%2===1?0:i.length-1;return!r||s===void 0?i[r]:s}const Pa=40;class Xi{constructor({autoplay:e=!0,delay:n=0,type:s="keyframes",repeat:i=0,repeatDelay:r=0,repeatType:o="loop",...a}){this.isStopped=!1,this.hasAttemptedResolve=!1,this.createdAt=W.now(),this.options={autoplay:e,delay:n,type:s,repeat:i,repeatDelay:r,repeatType:o,...a},this.updateFinishedPromise()}calcStartTime(){return this.resolvedAt?this.resolvedAt-this.createdAt>Pa?this.resolvedAt:this.createdAt:this.createdAt}get resolved(){return!this._resolved&&!this.hasAttemptedResolve&&va(),this._resolved}onKeyframesResolved(e,n){this.resolvedAt=W.now(),this.hasAttemptedResolve=!0;const{name:s,type:i,velocity:r,delay:o,onComplete:a,onUpdate:c,isGenerator:l}=this.options;if(!l&&!wa(e,s,i,r))if(o)this.options.duration=0;else{c&&c(de(e,this.options,n)),a&&a(),this.resolveFinishedPromise();return}const u=this.initPlayback(e,n);u!==!1&&(this._resolved={keyframes:e,finalKeyframe:n,...u},this.onPostResolved())}onPostResolved(){}then(e,n){return this.currentFinishedPromise.then(e,n)}flatten(){this.options.type="keyframes",this.options.ease="linear"}updateFinishedPromise(){this.currentFinishedPromise=new Promise(e=>{this.resolveFinishedPromise=e})}}const C=(t,e,n)=>t+(e-t)*n;function ke(t,e,n){return n<0&&(n+=1),n>1&&(n-=1),n<1/6?t+(e-t)*6*n:n<1/2?e:n<2/3?t+(e-t)*(2/3-n)*6:t}function Aa({hue:t,saturation:e,lightness:n,alpha:s}){t/=360,e/=100,n/=100;let i=0,r=0,o=0;if(!e)i=r=o=n;else{const a=n<.5?n*(1+e):n+e-n*e,c=2*n-a;i=ke(c,a,t+1/3),r=ke(c,a,t),o=ke(c,a,t-1/3)}return{red:Math.round(i*255),green:Math.round(r*255),blue:Math.round(o*255),alpha:s}}function te(t,e){return n=>n>0?e:t}const Me=(t,e,n)=>{const s=t*t,i=n*(e*e-s)+s;return i<0?0:Math.sqrt(i)},Sa=[Ne,lt,pt],Ca=t=>Sa.find(e=>e.test(t));function Yn(t){const e=Ca(t);if(!e)return!1;let n=e.parse(t);return e===pt&&(n=Aa(n)),n}const Zn=(t,e)=>{const n=Yn(t),s=Yn(e);if(!n||!s)return te(t,e);const i={...n};return r=>(i.red=Me(n.red,s.red,r),i.green=Me(n.green,s.green,r),i.blue=Me(n.blue,s.blue,r),i.alpha=C(n.alpha,s.alpha,r),lt.transform(i))},Va=(t,e)=>n=>e(t(n)),Bt=(...t)=>t.reduce(Va),Be=new Set(["none","hidden"]);function _a(t,e){return Be.has(t)?n=>n<=0?t:e:n=>n>=1?e:t}function Da(t,e){return n=>C(t,e,n)}function Tn(t){return typeof t=="number"?Da:typeof t=="string"?sn(t)?te:N.test(t)?Zn:La:Array.isArray(t)?Yi:typeof t=="object"?N.test(t)?Zn:Ea:te}function Yi(t,e){const n=[...t],s=n.length,i=t.map((r,o)=>Tn(r)(r,e[o]));return r=>{for(let o=0;o<s;o++)n[o]=i[o](r);return n}}function Ea(t,e){const n={...t,...e},s={};for(const i in n)t[i]!==void 0&&e[i]!==void 0&&(s[i]=Tn(t[i])(t[i],e[i]));return i=>{for(const r in s)n[r]=s[r](i);return n}}function Ra(t,e){var n;const s=[],i={color:0,var:0,number:0};for(let r=0;r<e.values.length;r++){const o=e.types[r],a=t.indexes[o][i[o]],c=(n=t.values[a])!==null&&n!==void 0?n:0;s[r]=c,i[o]++}return s}const La=(t,e)=>{const n=st.createTransformer(e),s=Nt(t),i=Nt(e);return s.indexes.var.length===i.indexes.var.length&&s.indexes.color.length===i.indexes.color.length&&s.indexes.number.length>=i.indexes.number.length?Be.has(t)&&!i.values.length||Be.has(e)&&!s.values.length?_a(t,e):Bt(Yi(Ra(s,i),i.values),n):te(t,e)};function Zi(t,e,n){return typeof t=="number"&&typeof e=="number"&&typeof n=="number"?C(t,e,n):Tn(t)(t,e)}const Na=5;function Qi(t,e,n){const s=Math.max(e-Na,0);return Pi(n-t(s),e-s)}const V={stiffness:100,damping:10,mass:1,velocity:0,duration:800,bounce:.3,visualDuration:.3,restSpeed:{granular:.01,default:2},restDelta:{granular:.005,default:.5},minDuration:.01,maxDuration:10,minDamping:.05,maxDamping:1},be=.001;function ja({duration:t=V.duration,bounce:e=V.bounce,velocity:n=V.velocity,mass:s=V.mass}){let i,r,o=1-e;o=Q(V.minDamping,V.maxDamping,o),t=Q(V.minDuration,V.maxDuration,Z(t)),o<1?(i=l=>{const u=l*o,h=u*t,d=u-n,p=Oe(l,o),y=Math.exp(-h);return be-d/p*y},r=l=>{const h=l*o*t,d=h*n+n,p=Math.pow(o,2)*Math.pow(l,2)*t,y=Math.exp(-h),g=Oe(Math.pow(l,2),o);return(-i(l)+be>0?-1:1)*((d-p)*y)/g}):(i=l=>{const u=Math.exp(-l*t),h=(l-n)*t+1;return-be+u*h},r=l=>{const u=Math.exp(-l*t),h=(n-l)*(t*t);return u*h});const a=5/t,c=Fa(i,r,a);if(t=Y(t),isNaN(c))return{stiffness:V.stiffness,damping:V.damping,duration:t};{const l=Math.pow(c,2)*s;return{stiffness:l,damping:o*2*Math.sqrt(s*l),duration:t}}}const $a=12;function Fa(t,e,n){let s=n;for(let i=1;i<$a;i++)s=s-t(s)/e(s);return s}function Oe(t,e){return t*Math.sqrt(1-e*e)}const Ba=["duration","bounce"],Oa=["stiffness","damping","mass"];function Qn(t,e){return e.some(n=>t[n]!==void 0)}function Ia(t){let e={velocity:V.velocity,stiffness:V.stiffness,damping:V.damping,mass:V.mass,isResolvedFromDuration:!1,...t};if(!Qn(t,Oa)&&Qn(t,Ba))if(t.visualDuration){const n=t.visualDuration,s=2*Math.PI/(n*1.2),i=s*s,r=2*Q(.05,1,1-(t.bounce||0))*Math.sqrt(i);e={...e,mass:V.mass,stiffness:i,damping:r}}else{const n=ja(t);e={...e,...n,mass:V.mass},e.isResolvedFromDuration=!0}return e}function Ji(t=V.visualDuration,e=V.bounce){const n=typeof t!="object"?{visualDuration:t,keyframes:[0,1],bounce:e}:t;let{restSpeed:s,restDelta:i}=n;const r=n.keyframes[0],o=n.keyframes[n.keyframes.length-1],a={done:!1,value:r},{stiffness:c,damping:l,mass:u,duration:h,velocity:d,isResolvedFromDuration:p}=Ia({...n,velocity:-Z(n.velocity||0)}),y=d||0,g=l/(2*Math.sqrt(c*u)),v=o-r,x=Z(Math.sqrt(c/u)),M=Math.abs(v)<5;s||(s=M?V.restSpeed.granular:V.restSpeed.default),i||(i=M?V.restDelta.granular:V.restDelta.default);let k;if(g<1){const b=Oe(x,g);k=A=>{const _=Math.exp(-g*x*A);return o-_*((y+g*x*v)/b*Math.sin(b*A)+v*Math.cos(b*A))}}else if(g===1)k=b=>o-Math.exp(-x*b)*(v+(y+x*v)*b);else{const b=x*Math.sqrt(g*g-1);k=A=>{const _=Math.exp(-g*x*A),P=Math.min(b*A,300);return o-_*((y+g*x*v)*Math.sinh(P)+b*v*Math.cosh(P))/b}}const T={calculatedDuration:p&&h||null,next:b=>{const A=k(b);if(p)a.done=b>=h;else{let _=0;g<1&&(_=b===0?Y(y):Qi(k,b,A));const P=Math.abs(_)<=s,L=Math.abs(o-A)<=i;a.done=P&&L}return a.value=a.done?o:A,a},toString:()=>{const b=Math.min(gi(T),Ee),A=vi(_=>T.next(b*_).value,b,30);return b+"ms "+A}};return T}function Jn({keyframes:t,velocity:e=0,power:n=.8,timeConstant:s=325,bounceDamping:i=10,bounceStiffness:r=500,modifyTarget:o,min:a,max:c,restDelta:l=.5,restSpeed:u}){const h=t[0],d={done:!1,value:h},p=P=>a!==void 0&&P<a||c!==void 0&&P>c,y=P=>a===void 0?c:c===void 0||Math.abs(a-P)<Math.abs(c-P)?a:c;let g=n*e;const v=h+g,x=o===void 0?v:o(v);x!==v&&(g=x-h);const M=P=>-g*Math.exp(-P/s),k=P=>x+M(P),T=P=>{const L=M(P),O=k(P);d.done=Math.abs(L)<=l,d.value=d.done?x:O};let b,A;const _=P=>{p(d.value)&&(b=P,A=Ji({keyframes:[d.value,y(d.value)],velocity:Qi(k,P,d.value),damping:i,stiffness:r,restDelta:l,restSpeed:u}))};return _(0),{calculatedDuration:null,next:P=>{let L=!1;return!A&&b===void 0&&(L=!0,T(P),_(P)),b!==void 0&&P>=b?A.next(P-b):(!L&&T(P),d)}}}const za=Ft(.42,0,1,1),Ua=Ft(0,0,.58,1),to=Ft(.42,0,.58,1),qa=t=>Array.isArray(t)&&typeof t[0]!="number",Ha={linear:F,easeIn:za,easeInOut:to,easeOut:Ua,circIn:xn,circInOut:Li,circOut:Ri,backIn:vn,backInOut:Di,backOut:_i,anticipate:Ei},ts=t=>{if(fn(t)){Ys(t.length===4);const[e,n,s,i]=t;return Ft(e,n,s,i)}else if(typeof t=="string")return Ha[t];return t};function Ka(t,e,n){const s=[],i=n||Zi,r=t.length-1;for(let o=0;o<r;o++){let a=i(t[o],t[o+1]);if(e){const c=Array.isArray(e)?e[o]||F:e;a=Bt(c,a)}s.push(a)}return s}function Wa(t,e,{clamp:n=!0,ease:s,mixer:i}={}){const r=t.length;if(Ys(r===e.length),r===1)return()=>e[0];if(r===2&&e[0]===e[1])return()=>e[1];const o=t[0]===t[1];t[0]>t[r-1]&&(t=[...t].reverse(),e=[...e].reverse());const a=Ka(e,s,i),c=a.length,l=u=>{if(o&&u<t[0])return e[0];let h=0;if(c>1)for(;h<t.length-2&&!(u<t[h+1]);h++);const d=vt(t[h],t[h+1],u);return a[h](d)};return n?u=>l(Q(t[0],t[r-1],u)):l}function Ga(t,e){const n=t[t.length-1];for(let s=1;s<=e;s++){const i=vt(0,e,s);t.push(C(n,1,i))}}function Xa(t){const e=[0];return Ga(e,t.length-1),e}function Ya(t,e){return t.map(n=>n*e)}function Za(t,e){return t.map(()=>e||to).splice(0,t.length-1)}function ee({duration:t=300,keyframes:e,times:n,ease:s="easeInOut"}){const i=qa(s)?s.map(ts):ts(s),r={done:!1,value:e[0]},o=Ya(n&&n.length===e.length?n:Xa(e),t),a=Wa(o,e,{ease:Array.isArray(i)?i:Za(e,i)});return{calculatedDuration:t,next:c=>(r.value=a(c),r.done=c>=t,r)}}const Qa=t=>{const e=({timestamp:n})=>t(n);return{start:()=>S.update(e,!0),stop:()=>nt(e),now:()=>R.isProcessing?R.timestamp:W.now()}},Ja={decay:Jn,inertia:Jn,tween:ee,keyframes:ee,spring:Ji},tc=t=>t/100;class Pn extends Xi{constructor(e){super(e),this.holdTime=null,this.cancelTime=null,this.currentTime=0,this.playbackSpeed=1,this.pendingPlayState="running",this.startTime=null,this.state="idle",this.stop=()=>{if(this.resolver.cancel(),this.isStopped=!0,this.state==="idle")return;this.teardown();const{onStop:c}=this.options;c&&c()};const{name:n,motionValue:s,element:i,keyframes:r}=this.options,o=(i==null?void 0:i.KeyframeResolver)||wn,a=(c,l)=>this.onKeyframesResolved(c,l);this.resolver=new o(r,a,n,s,i),this.resolver.scheduleResolve()}flatten(){super.flatten(),this._resolved&&Object.assign(this._resolved,this.initPlayback(this._resolved.keyframes))}initPlayback(e){const{type:n="keyframes",repeat:s=0,repeatDelay:i=0,repeatType:r,velocity:o=0}=this.options,a=dn(n)?n:Ja[n]||ee;let c,l;a!==ee&&typeof e[0]!="number"&&(c=Bt(tc,Zi(e[0],e[1])),e=[0,100]);const u=a({...this.options,keyframes:e});r==="mirror"&&(l=a({...this.options,keyframes:[...e].reverse(),velocity:-o})),u.calculatedDuration===null&&(u.calculatedDuration=gi(u));const{calculatedDuration:h}=u,d=h+i,p=d*(s+1)-i;return{generator:u,mirroredGenerator:l,mapPercentToKeyframes:c,calculatedDuration:h,resolvedDuration:d,totalDuration:p}}onPostResolved(){const{autoplay:e=!0}=this.options;this.play(),this.pendingPlayState==="paused"||!e?this.pause():this.state=this.pendingPlayState}tick(e,n=!1){const{resolved:s}=this;if(!s){const{keyframes:P}=this.options;return{done:!0,value:P[P.length-1]}}const{finalKeyframe:i,generator:r,mirroredGenerator:o,mapPercentToKeyframes:a,keyframes:c,calculatedDuration:l,totalDuration:u,resolvedDuration:h}=s;if(this.startTime===null)return r.next(0);const{delay:d,repeat:p,repeatType:y,repeatDelay:g,onUpdate:v}=this.options;this.speed>0?this.startTime=Math.min(this.startTime,e):this.speed<0&&(this.startTime=Math.min(e-u/this.speed,this.startTime)),n?this.currentTime=e:this.holdTime!==null?this.currentTime=this.holdTime:this.currentTime=Math.round(e-this.startTime)*this.speed;const x=this.currentTime-d*(this.speed>=0?1:-1),M=this.speed>=0?x<0:x>u;this.currentTime=Math.max(x,0),this.state==="finished"&&this.holdTime===null&&(this.currentTime=u);let k=this.currentTime,T=r;if(p){const P=Math.min(this.currentTime,u)/h;let L=Math.floor(P),O=P%1;!O&&P>=1&&(O=1),O===1&&L--,L=Math.min(L,p+1),!!(L%2)&&(y==="reverse"?(O=1-O,g&&(O-=g/h)):y==="mirror"&&(T=o)),k=Q(0,1,O)*h}const b=M?{done:!1,value:c[0]}:T.next(k);a&&(b.value=a(b.value));let{done:A}=b;!M&&l!==null&&(A=this.speed>=0?this.currentTime>=u:this.currentTime<=0);const _=this.holdTime===null&&(this.state==="finished"||this.state==="running"&&A);return _&&i!==void 0&&(b.value=de(c,this.options,i)),v&&v(b.value),_&&this.finish(),b}get duration(){const{resolved:e}=this;return e?Z(e.calculatedDuration):0}get time(){return Z(this.currentTime)}set time(e){e=Y(e),this.currentTime=e,this.holdTime!==null||this.speed===0?this.holdTime=e:this.driver&&(this.startTime=this.driver.now()-e/this.speed)}get speed(){return this.playbackSpeed}set speed(e){const n=this.playbackSpeed!==e;this.playbackSpeed=e,n&&(this.time=Z(this.currentTime))}play(){if(this.resolver.isScheduled||this.resolver.resume(),!this._resolved){this.pendingPlayState="running";return}if(this.isStopped)return;const{driver:e=Qa,onPlay:n,startTime:s}=this.options;this.driver||(this.driver=e(r=>this.tick(r))),n&&n();const i=this.driver.now();this.holdTime!==null?this.startTime=i-this.holdTime:this.startTime?this.state==="finished"&&(this.startTime=i):this.startTime=s??this.calcStartTime(),this.state==="finished"&&this.updateFinishedPromise(),this.cancelTime=this.startTime,this.holdTime=null,this.state="running",this.driver.start()}pause(){var e;if(!this._resolved){this.pendingPlayState="paused";return}this.state="paused",this.holdTime=(e=this.currentTime)!==null&&e!==void 0?e:0}complete(){this.state!=="running"&&this.play(),this.pendingPlayState=this.state="finished",this.holdTime=null}finish(){this.teardown(),this.state="finished";const{onComplete:e}=this.options;e&&e()}cancel(){this.cancelTime!==null&&this.tick(this.cancelTime),this.teardown(),this.updateFinishedPromise()}teardown(){this.state="idle",this.stopDriver(),this.resolveFinishedPromise(),this.updateFinishedPromise(),this.startTime=this.cancelTime=null,this.resolver.cancel()}stopDriver(){this.driver&&(this.driver.stop(),this.driver=void 0)}sample(e){return this.startTime=0,this.tick(e,!0)}}const ec=new Set(["opacity","clipPath","filter","transform"]);function nc(t,e,n,{delay:s=0,duration:i=300,repeat:r=0,repeatType:o="loop",ease:a="easeInOut",times:c}={}){const l={[e]:n};c&&(l.offset=c);const u=ki(a,i);return Array.isArray(u)&&(l.easing=u),t.animate(l,{delay:s,duration:i,easing:Array.isArray(u)?"linear":u,fill:"both",iterations:r+1,direction:o==="reverse"?"alternate":"normal"})}const sc=Ye(()=>Object.hasOwnProperty.call(Element.prototype,"animate")),ne=10,ic=2e4;function oc(t){return dn(t.type)||t.type==="spring"||!xi(t.ease)}function rc(t,e){const n=new Pn({...e,keyframes:t,repeat:0,delay:0,isGenerator:!0});let s={done:!1,value:t[0]};const i=[];let r=0;for(;!s.done&&r<ic;)s=n.sample(r),i.push(s.value),r+=ne;return{times:void 0,keyframes:i,duration:r-ne,ease:"linear"}}const eo={anticipate:Ei,backInOut:Di,circInOut:Li};function ac(t){return t in eo}class es extends Xi{constructor(e){super(e);const{name:n,motionValue:s,element:i,keyframes:r}=this.options;this.resolver=new Gi(r,(o,a)=>this.onKeyframesResolved(o,a),n,s,i),this.resolver.scheduleResolve()}initPlayback(e,n){let{duration:s=300,times:i,ease:r,type:o,motionValue:a,name:c,startTime:l}=this.options;if(!a.owner||!a.owner.current)return!1;if(typeof r=="string"&&Jt()&&ac(r)&&(r=eo[r]),oc(this.options)){const{onComplete:h,onUpdate:d,motionValue:p,element:y,...g}=this.options,v=rc(e,g);e=v.keyframes,e.length===1&&(e[1]=e[0]),s=v.duration,i=v.times,r=v.ease,o="keyframes"}const u=nc(a.owner.current,c,e,{...this.options,duration:s,times:i,ease:r});return u.startTime=l??this.calcStartTime(),this.pendingTimeline?(Bn(u,this.pendingTimeline),this.pendingTimeline=void 0):u.onfinish=()=>{const{onComplete:h}=this.options;a.set(de(e,this.options,n)),h&&h(),this.cancel(),this.resolveFinishedPromise()},{animation:u,duration:s,times:i,type:o,ease:r,keyframes:e}}get duration(){const{resolved:e}=this;if(!e)return 0;const{duration:n}=e;return Z(n)}get time(){const{resolved:e}=this;if(!e)return 0;const{animation:n}=e;return Z(n.currentTime||0)}set time(e){const{resolved:n}=this;if(!n)return;const{animation:s}=n;s.currentTime=Y(e)}get speed(){const{resolved:e}=this;if(!e)return 1;const{animation:n}=e;return n.playbackRate}set speed(e){const{resolved:n}=this;if(!n)return;const{animation:s}=n;s.playbackRate=e}get state(){const{resolved:e}=this;if(!e)return"idle";const{animation:n}=e;return n.playState}get startTime(){const{resolved:e}=this;if(!e)return null;const{animation:n}=e;return n.startTime}attachTimeline(e){if(!this._resolved)this.pendingTimeline=e;else{const{resolved:n}=this;if(!n)return F;const{animation:s}=n;Bn(s,e)}return F}play(){if(this.isStopped)return;const{resolved:e}=this;if(!e)return;const{animation:n}=e;n.playState==="finished"&&this.updateFinishedPromise(),n.play()}pause(){const{resolved:e}=this;if(!e)return;const{animation:n}=e;n.pause()}stop(){if(this.resolver.cancel(),this.isStopped=!0,this.state==="idle")return;this.resolveFinishedPromise(),this.updateFinishedPromise();const{resolved:e}=this;if(!e)return;const{animation:n,keyframes:s,duration:i,type:r,ease:o,times:a}=e;if(n.playState==="idle"||n.playState==="finished")return;if(this.time){const{motionValue:l,onUpdate:u,onComplete:h,element:d,...p}=this.options,y=new Pn({...p,keyframes:s,duration:i,type:r,ease:o,times:a,isGenerator:!0}),g=Y(this.time);l.setWithVelocity(y.sample(g-ne).value,y.sample(g).value,ne)}const{onStop:c}=this.options;c&&c(),this.cancel()}complete(){const{resolved:e}=this;e&&e.animation.finish()}cancel(){const{resolved:e}=this;e&&e.animation.cancel()}static supports(e){const{motionValue:n,name:s,repeatDelay:i,repeatType:r,damping:o,type:a}=e;if(!n||!n.owner||!(n.owner.current instanceof HTMLElement))return!1;const{onUpdate:c,transformTemplate:l}=n.owner.getProps();return sc()&&s&&ec.has(s)&&!c&&!l&&!i&&r!=="mirror"&&o!==0&&a!=="inertia"}}const cc={type:"spring",stiffness:500,damping:25,restSpeed:10},lc=t=>({type:"spring",stiffness:550,damping:t===0?2*Math.sqrt(550):30,restSpeed:10}),uc={type:"keyframes",duration:.8},hc={type:"keyframes",ease:[.25,.1,.35,1],duration:.3},dc=(t,{keyframes:e})=>e.length>2?uc:ht.has(t)?t.startsWith("scale")?lc(e[1]):cc:hc;function fc({when:t,delay:e,delayChildren:n,staggerChildren:s,staggerDirection:i,repeat:r,repeatType:o,repeatDelay:a,from:c,elapsed:l,...u}){return!!Object.keys(u).length}const An=(t,e,n,s={},i,r)=>o=>{const a=hn(s,t)||{},c=a.delay||s.delay||0;let{elapsed:l=0}=s;l=l-Y(c);let u={keyframes:Array.isArray(n)?n:[null,n],ease:"easeOut",velocity:e.getVelocity(),...a,delay:-l,onUpdate:d=>{e.set(d),a.onUpdate&&a.onUpdate(d)},onComplete:()=>{o(),a.onComplete&&a.onComplete()},name:t,motionValue:e,element:r?void 0:i};fc(a)||(u={...u,...dc(t,u)}),u.duration&&(u.duration=Y(u.duration)),u.repeatDelay&&(u.repeatDelay=Y(u.repeatDelay)),u.from!==void 0&&(u.keyframes[0]=u.from);let h=!1;if((u.type===!1||u.duration===0&&!u.repeatDelay)&&(u.duration=0,u.delay===0&&(h=!0)),h&&!r&&e.get()!==void 0){const d=de(u.keyframes,a);if(d!==void 0)return S.update(()=>{u.onUpdate(d),u.onComplete()}),new Er([])}return!r&&es.supports(u)?new es(u):new Pn(u)};function pc({protectedKeys:t,needsAnimating:e},n){const s=t.hasOwnProperty(n)&&e[n]!==!0;return e[n]=!1,s}function no(t,e,{delay:n=0,transitionOverride:s,type:i}={}){var r;let{transition:o=t.getDefaultTransition(),transitionEnd:a,...c}=e;s&&(o=s);const l=[],u=i&&t.animationState&&t.animationState.getState()[i];for(const h in c){const d=t.getValue(h,(r=t.latestValues[h])!==null&&r!==void 0?r:null),p=c[h];if(p===void 0||u&&pc(u,h))continue;const y={delay:n,...hn(o||{},h)};let g=!1;if(window.MotionHandoffAnimation){const x=Ai(t);if(x){const M=window.MotionHandoffAnimation(x,h,S);M!==null&&(y.startTime=M,g=!0)}}Le(t,h),d.start(An(h,d,p,t.shouldReduceMotion&&Ti.has(h)?{type:!1}:y,t,g));const v=d.animation;v&&l.push(v)}return a&&Promise.all(l).then(()=>{S.update(()=>{a&&Kr(t,a)})}),l}function Ie(t,e,n={}){var s;const i=he(t,e,n.type==="exit"?(s=t.presenceContext)===null||s===void 0?void 0:s.custom:void 0);let{transition:r=t.getDefaultTransition()||{}}=i||{};n.transitionOverride&&(r=n.transitionOverride);const o=i?()=>Promise.all(no(t,i,n)):()=>Promise.resolve(),a=t.variantChildren&&t.variantChildren.size?(l=0)=>{const{delayChildren:u=0,staggerChildren:h,staggerDirection:d}=r;return mc(t,e,u+l,h,d,n)}:()=>Promise.resolve(),{when:c}=r;if(c){const[l,u]=c==="beforeChildren"?[o,a]:[a,o];return l().then(()=>u())}else return Promise.all([o(),a(n.delay)])}function mc(t,e,n=0,s=0,i=1,r){const o=[],a=(t.variantChildren.size-1)*s,c=i===1?(l=0)=>l*s:(l=0)=>a-l*s;return Array.from(t.variantChildren).sort(yc).forEach((l,u)=>{l.notify("AnimationStart",e),o.push(Ie(l,e,{...r,delay:n+c(u)}).then(()=>l.notify("AnimationComplete",e)))}),Promise.all(o)}function yc(t,e){return t.sortNodePosition(e)}function gc(t,e,n={}){t.notify("AnimationStart",e);let s;if(Array.isArray(e)){const i=e.map(r=>Ie(t,r,n));s=Promise.all(i)}else if(typeof e=="string")s=Ie(t,e,n);else{const i=typeof e=="function"?he(t,e,n.custom):e;s=Promise.all(no(t,i,n))}return s.then(()=>{t.notify("AnimationComplete",e)})}const vc=Qe.length;function so(t){if(!t)return;if(!t.isControllingVariants){const n=t.parent?so(t.parent)||{}:{};return t.props.initial!==void 0&&(n.initial=t.props.initial),n}const e={};for(let n=0;n<vc;n++){const s=Qe[n],i=t.props[s];(Et(i)||i===!1)&&(e[s]=i)}return e}const xc=[...Ze].reverse(),kc=Ze.length;function Mc(t){return e=>Promise.all(e.map(({animation:n,options:s})=>gc(t,n,s)))}function bc(t){let e=Mc(t),n=ns(),s=!0;const i=c=>(l,u)=>{var h;const d=he(t,u,c==="exit"?(h=t.presenceContext)===null||h===void 0?void 0:h.custom:void 0);if(d){const{transition:p,transitionEnd:y,...g}=d;l={...l,...g,...y}}return l};function r(c){e=c(t)}function o(c){const{props:l}=t,u=so(t.parent)||{},h=[],d=new Set;let p={},y=1/0;for(let v=0;v<kc;v++){const x=xc[v],M=n[x],k=l[x]!==void 0?l[x]:u[x],T=Et(k),b=x===c?M.isActive:null;b===!1&&(y=v);let A=k===u[x]&&k!==l[x]&&T;if(A&&s&&t.manuallyAnimateOnMount&&(A=!1),M.protectedKeys={...p},!M.isActive&&b===null||!k&&!M.prevProp||le(k)||typeof k=="boolean")continue;const _=wc(M.prevProp,k);let P=_||x===c&&M.isActive&&!A&&T||v>y&&T,L=!1;const O=Array.isArray(k)?k:[k];let dt=O.reduce(i(x),{});b===!1&&(dt={});const{prevResolvedValues:Vn={}}=M,Ro={...Vn,...dt},_n=$=>{P=!0,d.has($)&&(L=!0,d.delete($)),M.needsAnimating[$]=!0;const G=t.getValue($);G&&(G.liveStyle=!1)};for(const $ in Ro){const G=dt[$],me=Vn[$];if(p.hasOwnProperty($))continue;let ye=!1;De(G)&&De(me)?ye=!yi(G,me):ye=G!==me,ye?G!=null?_n($):d.add($):G!==void 0&&d.has($)?_n($):M.protectedKeys[$]=!0}M.prevProp=k,M.prevResolvedValues=dt,M.isActive&&(p={...p,...dt}),s&&t.blockInitialAnimation&&(P=!1),P&&(!(A&&_)||L)&&h.push(...O.map($=>({animation:$,options:{type:x}})))}if(d.size){const v={};d.forEach(x=>{const M=t.getBaseTarget(x),k=t.getValue(x);k&&(k.liveStyle=!0),v[x]=M??null}),h.push({animation:v})}let g=!!h.length;return s&&(l.initial===!1||l.initial===l.animate)&&!t.manuallyAnimateOnMount&&(g=!1),s=!1,g?e(h):Promise.resolve()}function a(c,l){var u;if(n[c].isActive===l)return Promise.resolve();(u=t.variantChildren)===null||u===void 0||u.forEach(d=>{var p;return(p=d.animationState)===null||p===void 0?void 0:p.setActive(c,l)}),n[c].isActive=l;const h=o(c);for(const d in n)n[d].protectedKeys={};return h}return{animateChanges:o,setActive:a,setAnimateFunction:r,getState:()=>n,reset:()=>{n=ns(),s=!0}}}function wc(t,e){return typeof e=="string"?e!==t:Array.isArray(e)?!yi(e,t):!1}function rt(t=!1){return{isActive:t,protectedKeys:{},needsAnimating:{},prevResolvedValues:{}}}function ns(){return{animate:rt(!0),whileInView:rt(),whileHover:rt(),whileTap:rt(),whileDrag:rt(),whileFocus:rt(),exit:rt()}}class it{constructor(e){this.isMounted=!1,this.node=e}update(){}}class Tc extends it{constructor(e){super(e),e.animationState||(e.animationState=bc(e))}updateAnimationControlsSubscription(){const{animate:e}=this.node.getProps();le(e)&&(this.unmountControls=e.subscribe(this.node))}mount(){this.updateAnimationControlsSubscription()}update(){const{animate:e}=this.node.getProps(),{animate:n}=this.node.prevProps||{};e!==n&&this.updateAnimationControlsSubscription()}unmount(){var e;this.node.animationState.reset(),(e=this.unmountControls)===null||e===void 0||e.call(this)}}let Pc=0;class Ac extends it{constructor(){super(...arguments),this.id=Pc++}update(){if(!this.node.presenceContext)return;const{isPresent:e,onExitComplete:n}=this.node.presenceContext,{isPresent:s}=this.node.prevPresenceContext||{};if(!this.node.animationState||e===s)return;const i=this.node.animationState.setActive("exit",!e);n&&!e&&i.then(()=>n(this.id))}mount(){const{register:e}=this.node.presenceContext||{};e&&(this.unmount=e(this.id))}unmount(){}}const Sc={animation:{Feature:Tc},exit:{Feature:Ac}};function jt(t,e,n,s={passive:!0}){return t.addEventListener(e,n,s),()=>t.removeEventListener(e,n)}function Ot(t){return{point:{x:t.pageX,y:t.pageY}}}const Cc=t=>e=>pn(e)&&t(e,Ot(e));function Ct(t,e,n,s){return jt(t,e,Cc(n),s)}const ss=(t,e)=>Math.abs(t-e);function Vc(t,e){const n=ss(t.x,e.x),s=ss(t.y,e.y);return Math.sqrt(n**2+s**2)}class io{constructor(e,n,{transformPagePoint:s,contextWindow:i,dragSnapToOrigin:r=!1}={}){if(this.startEvent=null,this.lastMoveEvent=null,this.lastMoveEventInfo=null,this.handlers={},this.contextWindow=window,this.updatePoint=()=>{if(!(this.lastMoveEvent&&this.lastMoveEventInfo))return;const h=Te(this.lastMoveEventInfo,this.history),d=this.startEvent!==null,p=Vc(h.offset,{x:0,y:0})>=3;if(!d&&!p)return;const{point:y}=h,{timestamp:g}=R;this.history.push({...y,timestamp:g});const{onStart:v,onMove:x}=this.handlers;d||(v&&v(this.lastMoveEvent,h),this.startEvent=this.lastMoveEvent),x&&x(this.lastMoveEvent,h)},this.handlePointerMove=(h,d)=>{this.lastMoveEvent=h,this.lastMoveEventInfo=we(d,this.transformPagePoint),S.update(this.updatePoint,!0)},this.handlePointerUp=(h,d)=>{this.end();const{onEnd:p,onSessionEnd:y,resumeAnimation:g}=this.handlers;if(this.dragSnapToOrigin&&g&&g(),!(this.lastMoveEvent&&this.lastMoveEventInfo))return;const v=Te(h.type==="pointercancel"?this.lastMoveEventInfo:we(d,this.transformPagePoint),this.history);this.startEvent&&p&&p(h,v),y&&y(h,v)},!pn(e))return;this.dragSnapToOrigin=r,this.handlers=n,this.transformPagePoint=s,this.contextWindow=i||window;const o=Ot(e),a=we(o,this.transformPagePoint),{point:c}=a,{timestamp:l}=R;this.history=[{...c,timestamp:l}];const{onSessionStart:u}=n;u&&u(e,Te(a,this.history)),this.removeListeners=Bt(Ct(this.contextWindow,"pointermove",this.handlePointerMove),Ct(this.contextWindow,"pointerup",this.handlePointerUp),Ct(this.contextWindow,"pointercancel",this.handlePointerUp))}updateHandlers(e){this.handlers=e}end(){this.removeListeners&&this.removeListeners(),nt(this.updatePoint)}}function we(t,e){return e?{point:e(t.point)}:t}function is(t,e){return{x:t.x-e.x,y:t.y-e.y}}function Te({point:t},e){return{point:t,delta:is(t,oo(e)),offset:is(t,_c(e)),velocity:Dc(e,.1)}}function _c(t){return t[0]}function oo(t){return t[t.length-1]}function Dc(t,e){if(t.length<2)return{x:0,y:0};let n=t.length-1,s=null;const i=oo(t);for(;n>=0&&(s=t[n],!(i.timestamp-s.timestamp>Y(e)));)n--;if(!s)return{x:0,y:0};const r=Z(i.timestamp-s.timestamp);if(r===0)return{x:0,y:0};const o={x:(i.x-s.x)/r,y:(i.y-s.y)/r};return o.x===1/0&&(o.x=0),o.y===1/0&&(o.y=0),o}const ro=1e-4,Ec=1-ro,Rc=1+ro,ao=.01,Lc=0-ao,Nc=0+ao;function B(t){return t.max-t.min}function jc(t,e,n){return Math.abs(t-e)<=n}function os(t,e,n,s=.5){t.origin=s,t.originPoint=C(e.min,e.max,t.origin),t.scale=B(n)/B(e),t.translate=C(n.min,n.max,t.origin)-t.originPoint,(t.scale>=Ec&&t.scale<=Rc||isNaN(t.scale))&&(t.scale=1),(t.translate>=Lc&&t.translate<=Nc||isNaN(t.translate))&&(t.translate=0)}function Vt(t,e,n,s){os(t.x,e.x,n.x,s?s.originX:void 0),os(t.y,e.y,n.y,s?s.originY:void 0)}function rs(t,e,n){t.min=n.min+e.min,t.max=t.min+B(e)}function $c(t,e,n){rs(t.x,e.x,n.x),rs(t.y,e.y,n.y)}function as(t,e,n){t.min=e.min-n.min,t.max=t.min+B(e)}function _t(t,e,n){as(t.x,e.x,n.x),as(t.y,e.y,n.y)}function Fc(t,{min:e,max:n},s){return e!==void 0&&t<e?t=s?C(e,t,s.min):Math.max(t,e):n!==void 0&&t>n&&(t=s?C(n,t,s.max):Math.min(t,n)),t}function cs(t,e,n){return{min:e!==void 0?t.min+e:void 0,max:n!==void 0?t.max+n-(t.max-t.min):void 0}}function Bc(t,{top:e,left:n,bottom:s,right:i}){return{x:cs(t.x,n,i),y:cs(t.y,e,s)}}function ls(t,e){let n=e.min-t.min,s=e.max-t.max;return e.max-e.min<t.max-t.min&&([n,s]=[s,n]),{min:n,max:s}}function Oc(t,e){return{x:ls(t.x,e.x),y:ls(t.y,e.y)}}function Ic(t,e){let n=.5;const s=B(t),i=B(e);return i>s?n=vt(e.min,e.max-s,t.min):s>i&&(n=vt(t.min,t.max-i,e.min)),Q(0,1,n)}function zc(t,e){const n={};return e.min!==void 0&&(n.min=e.min-t.min),e.max!==void 0&&(n.max=e.max-t.min),n}const ze=.35;function Uc(t=ze){return t===!1?t=0:t===!0&&(t=ze),{x:us(t,"left","right"),y:us(t,"top","bottom")}}function us(t,e,n){return{min:hs(t,e),max:hs(t,n)}}function hs(t,e){return typeof t=="number"?t:t[e]||0}const ds=()=>({translate:0,scale:1,origin:0,originPoint:0}),mt=()=>({x:ds(),y:ds()}),fs=()=>({min:0,max:0}),D=()=>({x:fs(),y:fs()});function z(t){return[t("x"),t("y")]}function co({top:t,left:e,right:n,bottom:s}){return{x:{min:e,max:n},y:{min:t,max:s}}}function qc({x:t,y:e}){return{top:e.min,right:t.max,bottom:e.max,left:t.min}}function Hc(t,e){if(!e)return t;const n=e({x:t.left,y:t.top}),s=e({x:t.right,y:t.bottom});return{top:n.y,left:n.x,bottom:s.y,right:s.x}}function Pe(t){return t===void 0||t===1}function Ue({scale:t,scaleX:e,scaleY:n}){return!Pe(t)||!Pe(e)||!Pe(n)}function at(t){return Ue(t)||lo(t)||t.z||t.rotate||t.rotateX||t.rotateY||t.skewX||t.skewY}function lo(t){return ps(t.x)||ps(t.y)}function ps(t){return t&&t!=="0%"}function se(t,e,n){const s=t-n,i=e*s;return n+i}function ms(t,e,n,s,i){return i!==void 0&&(t=se(t,i,s)),se(t,n,s)+e}function qe(t,e=0,n=1,s,i){t.min=ms(t.min,e,n,s,i),t.max=ms(t.max,e,n,s,i)}function uo(t,{x:e,y:n}){qe(t.x,e.translate,e.scale,e.originPoint),qe(t.y,n.translate,n.scale,n.originPoint)}const ys=.999999999999,gs=1.0000000000001;function Kc(t,e,n,s=!1){const i=n.length;if(!i)return;e.x=e.y=1;let r,o;for(let a=0;a<i;a++){r=n[a],o=r.projectionDelta;const{visualElement:c}=r.options;c&&c.props.style&&c.props.style.display==="contents"||(s&&r.options.layoutScroll&&r.scroll&&r!==r.root&&gt(t,{x:-r.scroll.offset.x,y:-r.scroll.offset.y}),o&&(e.x*=o.x.scale,e.y*=o.y.scale,uo(t,o)),s&&at(r.latestValues)&&gt(t,r.latestValues))}e.x<gs&&e.x>ys&&(e.x=1),e.y<gs&&e.y>ys&&(e.y=1)}function yt(t,e){t.min=t.min+e,t.max=t.max+e}function vs(t,e,n,s,i=.5){const r=C(t.min,t.max,i);qe(t,e,n,r,s)}function gt(t,e){vs(t.x,e.x,e.scaleX,e.scale,e.originX),vs(t.y,e.y,e.scaleY,e.scale,e.originY)}function ho(t,e){return co(Hc(t.getBoundingClientRect(),e))}function Wc(t,e,n){const s=ho(t,n),{scroll:i}=e;return i&&(yt(s.x,i.offset.x),yt(s.y,i.offset.y)),s}const fo=({current:t})=>t?t.ownerDocument.defaultView:null,Gc=new WeakMap;class Xc{constructor(e){this.openDragLock=null,this.isDragging=!1,this.currentDirection=null,this.originPoint={x:0,y:0},this.constraints=!1,this.hasMutatedConstraints=!1,this.elastic=D(),this.visualElement=e}start(e,{snapToCursor:n=!1}={}){const{presenceContext:s}=this.visualElement;if(s&&s.isPresent===!1)return;const i=u=>{const{dragSnapToOrigin:h}=this.getProps();h?this.pauseAnimation():this.stopAnimation(),n&&this.snapToCursor(Ot(u).point)},r=(u,h)=>{const{drag:d,dragPropagation:p,onDragStart:y}=this.getProps();if(d&&!p&&(this.openDragLock&&this.openDragLock(),this.openDragLock=Ir(d),!this.openDragLock))return;this.isDragging=!0,this.currentDirection=null,this.resolveConstraints(),this.visualElement.projection&&(this.visualElement.projection.isAnimationBlocked=!0,this.visualElement.projection.target=void 0),z(v=>{let x=this.getAxisMotionValue(v).get()||0;if(K.test(x)){const{projection:M}=this.visualElement;if(M&&M.layout){const k=M.layout.layoutBox[v];k&&(x=B(k)*(parseFloat(x)/100))}}this.originPoint[v]=x}),y&&S.postRender(()=>y(u,h)),Le(this.visualElement,"transform");const{animationState:g}=this.visualElement;g&&g.setActive("whileDrag",!0)},o=(u,h)=>{const{dragPropagation:d,dragDirectionLock:p,onDirectionLock:y,onDrag:g}=this.getProps();if(!d&&!this.openDragLock)return;const{offset:v}=h;if(p&&this.currentDirection===null){this.currentDirection=Yc(v),this.currentDirection!==null&&y&&y(this.currentDirection);return}this.updateAxis("x",h.point,v),this.updateAxis("y",h.point,v),this.visualElement.render(),g&&g(u,h)},a=(u,h)=>this.stop(u,h),c=()=>z(u=>{var h;return this.getAnimationState(u)==="paused"&&((h=this.getAxisMotionValue(u).animation)===null||h===void 0?void 0:h.play())}),{dragSnapToOrigin:l}=this.getProps();this.panSession=new io(e,{onSessionStart:i,onStart:r,onMove:o,onSessionEnd:a,resumeAnimation:c},{transformPagePoint:this.visualElement.getTransformPagePoint(),dragSnapToOrigin:l,contextWindow:fo(this.visualElement)})}stop(e,n){const s=this.isDragging;if(this.cancel(),!s)return;const{velocity:i}=n;this.startAnimation(i);const{onDragEnd:r}=this.getProps();r&&S.postRender(()=>r(e,n))}cancel(){this.isDragging=!1;const{projection:e,animationState:n}=this.visualElement;e&&(e.isAnimationBlocked=!1),this.panSession&&this.panSession.end(),this.panSession=void 0;const{dragPropagation:s}=this.getProps();!s&&this.openDragLock&&(this.openDragLock(),this.openDragLock=null),n&&n.setActive("whileDrag",!1)}updateAxis(e,n,s){const{drag:i}=this.getProps();if(!s||!Ht(e,i,this.currentDirection))return;const r=this.getAxisMotionValue(e);let o=this.originPoint[e]+s[e];this.constraints&&this.constraints[e]&&(o=Fc(o,this.constraints[e],this.elastic[e])),r.set(o)}resolveConstraints(){var e;const{dragConstraints:n,dragElastic:s}=this.getProps(),i=this.visualElement.projection&&!this.visualElement.projection.layout?this.visualElement.projection.measure(!1):(e=this.visualElement.projection)===null||e===void 0?void 0:e.layout,r=this.constraints;n&&ft(n)?this.constraints||(this.constraints=this.resolveRefConstraints()):n&&i?this.constraints=Bc(i.layoutBox,n):this.constraints=!1,this.elastic=Uc(s),r!==this.constraints&&i&&this.constraints&&!this.hasMutatedConstraints&&z(o=>{this.constraints!==!1&&this.getAxisMotionValue(o)&&(this.constraints[o]=zc(i.layoutBox[o],this.constraints[o]))})}resolveRefConstraints(){const{dragConstraints:e,onMeasureDragConstraints:n}=this.getProps();if(!e||!ft(e))return!1;const s=e.current,{projection:i}=this.visualElement;if(!i||!i.layout)return!1;const r=Wc(s,i.root,this.visualElement.getTransformPagePoint());let o=Oc(i.layout.layoutBox,r);if(n){const a=n(qc(o));this.hasMutatedConstraints=!!a,a&&(o=co(a))}return o}startAnimation(e){const{drag:n,dragMomentum:s,dragElastic:i,dragTransition:r,dragSnapToOrigin:o,onDragTransitionEnd:a}=this.getProps(),c=this.constraints||{},l=z(u=>{if(!Ht(u,n,this.currentDirection))return;let h=c&&c[u]||{};o&&(h={min:0,max:0});const d=i?200:1e6,p=i?40:1e7,y={type:"inertia",velocity:s?e[u]:0,bounceStiffness:d,bounceDamping:p,timeConstant:750,restDelta:1,restSpeed:10,...r,...h};return this.startAxisValueAnimation(u,y)});return Promise.all(l).then(a)}startAxisValueAnimation(e,n){const s=this.getAxisMotionValue(e);return Le(this.visualElement,e),s.start(An(e,s,0,n,this.visualElement,!1))}stopAnimation(){z(e=>this.getAxisMotionValue(e).stop())}pauseAnimation(){z(e=>{var n;return(n=this.getAxisMotionValue(e).animation)===null||n===void 0?void 0:n.pause()})}getAnimationState(e){var n;return(n=this.getAxisMotionValue(e).animation)===null||n===void 0?void 0:n.state}getAxisMotionValue(e){const n=`_drag${e.toUpperCase()}`,s=this.visualElement.getProps(),i=s[n];return i||this.visualElement.getValue(e,(s.initial?s.initial[e]:void 0)||0)}snapToCursor(e){z(n=>{const{drag:s}=this.getProps();if(!Ht(n,s,this.currentDirection))return;const{projection:i}=this.visualElement,r=this.getAxisMotionValue(n);if(i&&i.layout){const{min:o,max:a}=i.layout.layoutBox[n];r.set(e[n]-C(o,a,.5))}})}scalePositionWithinConstraints(){if(!this.visualElement.current)return;const{drag:e,dragConstraints:n}=this.getProps(),{projection:s}=this.visualElement;if(!ft(n)||!s||!this.constraints)return;this.stopAnimation();const i={x:0,y:0};z(o=>{const a=this.getAxisMotionValue(o);if(a&&this.constraints!==!1){const c=a.get();i[o]=Ic({min:c,max:c},this.constraints[o])}});const{transformTemplate:r}=this.visualElement.getProps();this.visualElement.current.style.transform=r?r({},""):"none",s.root&&s.root.updateScroll(),s.updateLayout(),this.resolveConstraints(),z(o=>{if(!Ht(o,e,null))return;const a=this.getAxisMotionValue(o),{min:c,max:l}=this.constraints[o];a.set(C(c,l,i[o]))})}addListeners(){if(!this.visualElement.current)return;Gc.set(this.visualElement,this);const e=this.visualElement.current,n=Ct(e,"pointerdown",c=>{const{drag:l,dragListener:u=!0}=this.getProps();l&&u&&this.start(c)}),s=()=>{const{dragConstraints:c}=this.getProps();ft(c)&&c.current&&(this.constraints=this.resolveRefConstraints())},{projection:i}=this.visualElement,r=i.addEventListener("measure",s);i&&!i.layout&&(i.root&&i.root.updateScroll(),i.updateLayout()),S.read(s);const o=jt(window,"resize",()=>this.scalePositionWithinConstraints()),a=i.addEventListener("didUpdate",({delta:c,hasLayoutChanged:l})=>{this.isDragging&&l&&(z(u=>{const h=this.getAxisMotionValue(u);h&&(this.originPoint[u]+=c[u].translate,h.set(h.get()+c[u].translate))}),this.visualElement.render())});return()=>{o(),n(),r(),a&&a()}}getProps(){const e=this.visualElement.getProps(),{drag:n=!1,dragDirectionLock:s=!1,dragPropagation:i=!1,dragConstraints:r=!1,dragElastic:o=ze,dragMomentum:a=!0}=e;return{...e,drag:n,dragDirectionLock:s,dragPropagation:i,dragConstraints:r,dragElastic:o,dragMomentum:a}}}function Ht(t,e,n){return(e===!0||e===t)&&(n===null||n===t)}function Yc(t,e=10){let n=null;return Math.abs(t.y)>e?n="y":Math.abs(t.x)>e&&(n="x"),n}class Zc extends it{constructor(e){super(e),this.removeGroupControls=F,this.removeListeners=F,this.controls=new Xc(e)}mount(){const{dragControls:e}=this.node.getProps();e&&(this.removeGroupControls=e.subscribe(this.controls)),this.removeListeners=this.controls.addListeners()||F}unmount(){this.removeGroupControls(),this.removeListeners()}}const xs=t=>(e,n)=>{t&&S.postRender(()=>t(e,n))};class Qc extends it{constructor(){super(...arguments),this.removePointerDownListener=F}onPointerDown(e){this.session=new io(e,this.createPanHandlers(),{transformPagePoint:this.node.getTransformPagePoint(),contextWindow:fo(this.node)})}createPanHandlers(){const{onPanSessionStart:e,onPanStart:n,onPan:s,onPanEnd:i}=this.node.getProps();return{onSessionStart:xs(e),onStart:xs(n),onMove:s,onEnd:(r,o)=>{delete this.session,i&&S.postRender(()=>i(r,o))}}}mount(){this.removePointerDownListener=Ct(this.node.current,"pointerdown",e=>this.onPointerDown(e))}update(){this.session&&this.session.updateHandlers(this.createPanHandlers())}unmount(){this.removePointerDownListener(),this.session&&this.session.end()}}const Xt={hasAnimatedSinceResize:!0,hasEverUpdated:!1};function ks(t,e){return e.max===e.min?0:t/(e.max-e.min)*100}const wt={correct:(t,e)=>{if(!e.target)return t;if(typeof t=="string")if(w.test(t))t=parseFloat(t);else return t;const n=ks(t,e.target.x),s=ks(t,e.target.y);return`${n}% ${s}%`}},Jc={correct:(t,{treeScale:e,projectionDelta:n})=>{const s=t,i=st.parse(t);if(i.length>5)return s;const r=st.createTransformer(t),o=typeof i[0]!="number"?1:0,a=n.x.scale*e.x,c=n.y.scale*e.y;i[0+o]/=a,i[1+o]/=c;const l=C(a,c,.5);return typeof i[2+o]=="number"&&(i[2+o]/=l),typeof i[3+o]=="number"&&(i[3+o]/=l),r(i)}};class tl extends m.Component{componentDidMount(){const{visualElement:e,layoutGroup:n,switchLayoutGroup:s,layoutId:i}=this.props,{projection:r}=e;kr(el),r&&(n.group&&n.group.add(r),s&&s.register&&i&&s.register(r),r.root.didUpdate(),r.addEventListener("animationComplete",()=>{this.safeToRemove()}),r.setOptions({...r.options,onExitComplete:()=>this.safeToRemove()})),Xt.hasEverUpdated=!0}getSnapshotBeforeUpdate(e){const{layoutDependency:n,visualElement:s,drag:i,isPresent:r}=this.props,o=s.projection;return o&&(o.isPresent=r,i||e.layoutDependency!==n||n===void 0?o.willUpdate():this.safeToRemove(),e.isPresent!==r&&(r?o.promote():o.relegate()||S.postRender(()=>{const a=o.getStack();(!a||!a.members.length)&&this.safeToRemove()}))),null}componentDidUpdate(){const{projection:e}=this.props.visualElement;e&&(e.root.didUpdate(),tn.postRender(()=>{!e.currentAnimation&&e.isLead()&&this.safeToRemove()}))}componentWillUnmount(){const{visualElement:e,layoutGroup:n,switchLayoutGroup:s}=this.props,{projection:i}=e;i&&(i.scheduleCheckAfterUnmount(),n&&n.group&&n.group.remove(i),s&&s.deregister&&s.deregister(i))}safeToRemove(){const{safeToRemove:e}=this.props;e&&e()}render(){return null}}function po(t){const[e,n]=Gs(),s=m.useContext(Ge);return H.jsx(tl,{...t,layoutGroup:s,switchLayoutGroup:m.useContext(si),isPresent:e,safeToRemove:n})}const el={borderRadius:{...wt,applyTo:["borderTopLeftRadius","borderTopRightRadius","borderBottomLeftRadius","borderBottomRightRadius"]},borderTopLeftRadius:wt,borderTopRightRadius:wt,borderBottomLeftRadius:wt,borderBottomRightRadius:wt,boxShadow:Jc};function nl(t,e,n){const s=j(t)?t:Lt(t);return s.start(An("",s,e,n)),s.animation}function sl(t){return t instanceof SVGElement&&t.tagName!=="svg"}const il=(t,e)=>t.depth-e.depth;class ol{constructor(){this.children=[],this.isDirty=!1}add(e){mn(this.children,e),this.isDirty=!0}remove(e){yn(this.children,e),this.isDirty=!0}forEach(e){this.isDirty&&this.children.sort(il),this.isDirty=!1,this.children.forEach(e)}}function rl(t,e){const n=W.now(),s=({timestamp:i})=>{const r=i-n;r>=e&&(nt(s),t(r-e))};return S.read(s,!0),()=>nt(s)}const mo=["TopLeft","TopRight","BottomLeft","BottomRight"],al=mo.length,Ms=t=>typeof t=="string"?parseFloat(t):t,bs=t=>typeof t=="number"||w.test(t);function cl(t,e,n,s,i,r){i?(t.opacity=C(0,n.opacity!==void 0?n.opacity:1,ll(s)),t.opacityExit=C(e.opacity!==void 0?e.opacity:1,0,ul(s))):r&&(t.opacity=C(e.opacity!==void 0?e.opacity:1,n.opacity!==void 0?n.opacity:1,s));for(let o=0;o<al;o++){const a=`border${mo[o]}Radius`;let c=ws(e,a),l=ws(n,a);if(c===void 0&&l===void 0)continue;c||(c=0),l||(l=0),c===0||l===0||bs(c)===bs(l)?(t[a]=Math.max(C(Ms(c),Ms(l),s),0),(K.test(l)||K.test(c))&&(t[a]+="%")):t[a]=l}(e.rotate||n.rotate)&&(t.rotate=C(e.rotate||0,n.rotate||0,s))}function ws(t,e){return t[e]!==void 0?t[e]:t.borderRadius}const ll=yo(0,.5,Ri),ul=yo(.5,.95,F);function yo(t,e,n){return s=>s<t?0:s>e?1:n(vt(t,e,s))}function Ts(t,e){t.min=e.min,t.max=e.max}function I(t,e){Ts(t.x,e.x),Ts(t.y,e.y)}function Ps(t,e){t.translate=e.translate,t.scale=e.scale,t.originPoint=e.originPoint,t.origin=e.origin}function As(t,e,n,s,i){return t-=e,t=se(t,1/n,s),i!==void 0&&(t=se(t,1/i,s)),t}function hl(t,e=0,n=1,s=.5,i,r=t,o=t){if(K.test(e)&&(e=parseFloat(e),e=C(o.min,o.max,e/100)-o.min),typeof e!="number")return;let a=C(r.min,r.max,s);t===r&&(a-=e),t.min=As(t.min,e,n,a,i),t.max=As(t.max,e,n,a,i)}function Ss(t,e,[n,s,i],r,o){hl(t,e[n],e[s],e[i],e.scale,r,o)}const dl=["x","scaleX","originX"],fl=["y","scaleY","originY"];function Cs(t,e,n,s){Ss(t.x,e,dl,n?n.x:void 0,s?s.x:void 0),Ss(t.y,e,fl,n?n.y:void 0,s?s.y:void 0)}function Vs(t){return t.translate===0&&t.scale===1}function go(t){return Vs(t.x)&&Vs(t.y)}function _s(t,e){return t.min===e.min&&t.max===e.max}function pl(t,e){return _s(t.x,e.x)&&_s(t.y,e.y)}function Ds(t,e){return Math.round(t.min)===Math.round(e.min)&&Math.round(t.max)===Math.round(e.max)}function vo(t,e){return Ds(t.x,e.x)&&Ds(t.y,e.y)}function Es(t){return B(t.x)/B(t.y)}function Rs(t,e){return t.translate===e.translate&&t.scale===e.scale&&t.originPoint===e.originPoint}class ml{constructor(){this.members=[]}add(e){mn(this.members,e),e.scheduleRender()}remove(e){if(yn(this.members,e),e===this.prevLead&&(this.prevLead=void 0),e===this.lead){const n=this.members[this.members.length-1];n&&this.promote(n)}}relegate(e){const n=this.members.findIndex(i=>e===i);if(n===0)return!1;let s;for(let i=n;i>=0;i--){const r=this.members[i];if(r.isPresent!==!1){s=r;break}}return s?(this.promote(s),!0):!1}promote(e,n){const s=this.lead;if(e!==s&&(this.prevLead=s,this.lead=e,e.show(),s)){s.instance&&s.scheduleRender(),e.scheduleRender(),e.resumeFrom=s,n&&(e.resumeFrom.preserveOpacity=!0),s.snapshot&&(e.snapshot=s.snapshot,e.snapshot.latestValues=s.animationValues||s.latestValues),e.root&&e.root.isUpdating&&(e.isLayoutDirty=!0);const{crossfade:i}=e.options;i===!1&&s.hide()}}exitAnimationComplete(){this.members.forEach(e=>{const{options:n,resumingFrom:s}=e;n.onExitComplete&&n.onExitComplete(),s&&s.options.onExitComplete&&s.options.onExitComplete()})}scheduleRender(){this.members.forEach(e=>{e.instance&&e.scheduleRender(!1)})}removeLeadSnapshot(){this.lead&&this.lead.snapshot&&(this.lead.snapshot=void 0)}}function yl(t,e,n){let s="";const i=t.x.translate/e.x,r=t.y.translate/e.y,o=(n==null?void 0:n.z)||0;if((i||r||o)&&(s=`translate3d(${i}px, ${r}px, ${o}px) `),(e.x!==1||e.y!==1)&&(s+=`scale(${1/e.x}, ${1/e.y}) `),n){const{transformPerspective:l,rotate:u,rotateX:h,rotateY:d,skewX:p,skewY:y}=n;l&&(s=`perspective(${l}px) ${s}`),u&&(s+=`rotate(${u}deg) `),h&&(s+=`rotateX(${h}deg) `),d&&(s+=`rotateY(${d}deg) `),p&&(s+=`skewX(${p}deg) `),y&&(s+=`skewY(${y}deg) `)}const a=t.x.scale*e.x,c=t.y.scale*e.y;return(a!==1||c!==1)&&(s+=`scale(${a}, ${c})`),s||"none"}const ct={type:"projectionFrame",totalNodes:0,resolvedTargetDeltas:0,recalculatedProjection:0},At=typeof window<"u"&&window.MotionDebug!==void 0,Ae=["","X","Y","Z"],gl={visibility:"hidden"},Ls=1e3;let vl=0;function Se(t,e,n,s){const{latestValues:i}=e;i[t]&&(n[t]=i[t],e.setStaticValue(t,0),s&&(s[t]=0))}function xo(t){if(t.hasCheckedOptimisedAppear=!0,t.root===t)return;const{visualElement:e}=t.options;if(!e)return;const n=Ai(e);if(window.MotionHasOptimisedAnimation(n,"transform")){const{layout:i,layoutId:r}=t.options;window.MotionCancelOptimisedAnimation(n,"transform",S,!(i||r))}const{parent:s}=t;s&&!s.hasCheckedOptimisedAppear&&xo(s)}function ko({attachResizeListener:t,defaultParent:e,measureScroll:n,checkIsScrollRoot:s,resetTransform:i}){return class{constructor(o={},a=e==null?void 0:e()){this.id=vl++,this.animationId=0,this.children=new Set,this.options={},this.isTreeAnimating=!1,this.isAnimationBlocked=!1,this.isLayoutDirty=!1,this.isProjectionDirty=!1,this.isSharedProjectionDirty=!1,this.isTransformDirty=!1,this.updateManuallyBlocked=!1,this.updateBlockedByResize=!1,this.isUpdating=!1,this.isSVG=!1,this.needsReset=!1,this.shouldResetTransform=!1,this.hasCheckedOptimisedAppear=!1,this.treeScale={x:1,y:1},this.eventHandlers=new Map,this.hasTreeAnimated=!1,this.updateScheduled=!1,this.scheduleUpdate=()=>this.update(),this.projectionUpdateScheduled=!1,this.checkUpdateFailed=()=>{this.isUpdating&&(this.isUpdating=!1,this.clearAllSnapshots())},this.updateProjection=()=>{this.projectionUpdateScheduled=!1,At&&(ct.totalNodes=ct.resolvedTargetDeltas=ct.recalculatedProjection=0),this.nodes.forEach(Ml),this.nodes.forEach(Al),this.nodes.forEach(Sl),this.nodes.forEach(bl),At&&window.MotionDebug.record(ct)},this.resolvedRelativeTargetAt=0,this.hasProjected=!1,this.isVisible=!0,this.animationProgress=0,this.sharedNodes=new Map,this.latestValues=o,this.root=a?a.root||a:this,this.path=a?[...a.path,a]:[],this.parent=a,this.depth=a?a.depth+1:0;for(let c=0;c<this.path.length;c++)this.path[c].shouldResetTransform=!0;this.root===this&&(this.nodes=new ol)}addEventListener(o,a){return this.eventHandlers.has(o)||this.eventHandlers.set(o,new gn),this.eventHandlers.get(o).add(a)}notifyListeners(o,...a){const c=this.eventHandlers.get(o);c&&c.notify(...a)}hasListeners(o){return this.eventHandlers.has(o)}mount(o,a=this.root.hasTreeAnimated){if(this.instance)return;this.isSVG=sl(o),this.instance=o;const{layoutId:c,layout:l,visualElement:u}=this.options;if(u&&!u.current&&u.mount(o),this.root.nodes.add(this),this.parent&&this.parent.children.add(this),a&&(l||c)&&(this.isLayoutDirty=!0),t){let h;const d=()=>this.root.updateBlockedByResize=!1;t(o,()=>{this.root.updateBlockedByResize=!0,h&&h(),h=rl(d,250),Xt.hasAnimatedSinceResize&&(Xt.hasAnimatedSinceResize=!1,this.nodes.forEach(js))})}c&&this.root.registerSharedNode(c,this),this.options.animate!==!1&&u&&(c||l)&&this.addEventListener("didUpdate",({delta:h,hasLayoutChanged:d,hasRelativeTargetChanged:p,layout:y})=>{if(this.isTreeAnimationBlocked()){this.target=void 0,this.relativeTarget=void 0;return}const g=this.options.transition||u.getDefaultTransition()||El,{onLayoutAnimationStart:v,onLayoutAnimationComplete:x}=u.getProps(),M=!this.targetLayout||!vo(this.targetLayout,y)||p,k=!d&&p;if(this.options.layoutRoot||this.resumeFrom&&this.resumeFrom.instance||k||d&&(M||!this.currentAnimation)){this.resumeFrom&&(this.resumingFrom=this.resumeFrom,this.resumingFrom.resumingFrom=void 0),this.setAnimationOrigin(h,k);const T={...hn(g,"layout"),onPlay:v,onComplete:x};(u.shouldReduceMotion||this.options.layoutRoot)&&(T.delay=0,T.type=!1),this.startAnimation(T)}else d||js(this),this.isLead()&&this.options.onExitComplete&&this.options.onExitComplete();this.targetLayout=y})}unmount(){this.options.layoutId&&this.willUpdate(),this.root.nodes.remove(this);const o=this.getStack();o&&o.remove(this),this.parent&&this.parent.children.delete(this),this.instance=void 0,nt(this.updateProjection)}blockUpdate(){this.updateManuallyBlocked=!0}unblockUpdate(){this.updateManuallyBlocked=!1}isUpdateBlocked(){return this.updateManuallyBlocked||this.updateBlockedByResize}isTreeAnimationBlocked(){return this.isAnimationBlocked||this.parent&&this.parent.isTreeAnimationBlocked()||!1}startUpdate(){this.isUpdateBlocked()||(this.isUpdating=!0,this.nodes&&this.nodes.forEach(Cl),this.animationId++)}getTransformTemplate(){const{visualElement:o}=this.options;return o&&o.getProps().transformTemplate}willUpdate(o=!0){if(this.root.hasTreeAnimated=!0,this.root.isUpdateBlocked()){this.options.onExitComplete&&this.options.onExitComplete();return}if(window.MotionCancelOptimisedAnimation&&!this.hasCheckedOptimisedAppear&&xo(this),!this.root.isUpdating&&this.root.startUpdate(),this.isLayoutDirty)return;this.isLayoutDirty=!0;for(let u=0;u<this.path.length;u++){const h=this.path[u];h.shouldResetTransform=!0,h.updateScroll("snapshot"),h.options.layoutRoot&&h.willUpdate(!1)}const{layoutId:a,layout:c}=this.options;if(a===void 0&&!c)return;const l=this.getTransformTemplate();this.prevTransformTemplateValue=l?l(this.latestValues,""):void 0,this.updateSnapshot(),o&&this.notifyListeners("willUpdate")}update(){if(this.updateScheduled=!1,this.isUpdateBlocked()){this.unblockUpdate(),this.clearAllSnapshots(),this.nodes.forEach(Ns);return}this.isUpdating||this.nodes.forEach(Tl),this.isUpdating=!1,this.nodes.forEach(Pl),this.nodes.forEach(xl),this.nodes.forEach(kl),this.clearAllSnapshots();const a=W.now();R.delta=Q(0,1e3/60,a-R.timestamp),R.timestamp=a,R.isProcessing=!0,ge.update.process(R),ge.preRender.process(R),ge.render.process(R),R.isProcessing=!1}didUpdate(){this.updateScheduled||(this.updateScheduled=!0,tn.read(this.scheduleUpdate))}clearAllSnapshots(){this.nodes.forEach(wl),this.sharedNodes.forEach(Vl)}scheduleUpdateProjection(){this.projectionUpdateScheduled||(this.projectionUpdateScheduled=!0,S.preRender(this.updateProjection,!1,!0))}scheduleCheckAfterUnmount(){S.postRender(()=>{this.isLayoutDirty?this.root.didUpdate():this.root.checkUpdateFailed()})}updateSnapshot(){this.snapshot||!this.instance||(this.snapshot=this.measure())}updateLayout(){if(!this.instance||(this.updateScroll(),!(this.options.alwaysMeasureLayout&&this.isLead())&&!this.isLayoutDirty))return;if(this.resumeFrom&&!this.resumeFrom.instance)for(let c=0;c<this.path.length;c++)this.path[c].updateScroll();const o=this.layout;this.layout=this.measure(!1),this.layoutCorrected=D(),this.isLayoutDirty=!1,this.projectionDelta=void 0,this.notifyListeners("measure",this.layout.layoutBox);const{visualElement:a}=this.options;a&&a.notify("LayoutMeasure",this.layout.layoutBox,o?o.layoutBox:void 0)}updateScroll(o="measure"){let a=!!(this.options.layoutScroll&&this.instance);if(this.scroll&&this.scroll.animationId===this.root.animationId&&this.scroll.phase===o&&(a=!1),a){const c=s(this.instance);this.scroll={animationId:this.root.animationId,phase:o,isRoot:c,offset:n(this.instance),wasRoot:this.scroll?this.scroll.isRoot:c}}}resetTransform(){if(!i)return;const o=this.isLayoutDirty||this.shouldResetTransform||this.options.alwaysMeasureLayout,a=this.projectionDelta&&!go(this.projectionDelta),c=this.getTransformTemplate(),l=c?c(this.latestValues,""):void 0,u=l!==this.prevTransformTemplateValue;o&&(a||at(this.latestValues)||u)&&(i(this.instance,l),this.shouldResetTransform=!1,this.scheduleRender())}measure(o=!0){const a=this.measurePageBox();let c=this.removeElementScroll(a);return o&&(c=this.removeTransform(c)),Rl(c),{animationId:this.root.animationId,measuredBox:a,layoutBox:c,latestValues:{},source:this.id}}measurePageBox(){var o;const{visualElement:a}=this.options;if(!a)return D();const c=a.measureViewportBox();if(!(((o=this.scroll)===null||o===void 0?void 0:o.wasRoot)||this.path.some(Ll))){const{scroll:u}=this.root;u&&(yt(c.x,u.offset.x),yt(c.y,u.offset.y))}return c}removeElementScroll(o){var a;const c=D();if(I(c,o),!((a=this.scroll)===null||a===void 0)&&a.wasRoot)return c;for(let l=0;l<this.path.length;l++){const u=this.path[l],{scroll:h,options:d}=u;u!==this.root&&h&&d.layoutScroll&&(h.wasRoot&&I(c,o),yt(c.x,h.offset.x),yt(c.y,h.offset.y))}return c}applyTransform(o,a=!1){const c=D();I(c,o);for(let l=0;l<this.path.length;l++){const u=this.path[l];!a&&u.options.layoutScroll&&u.scroll&&u!==u.root&&gt(c,{x:-u.scroll.offset.x,y:-u.scroll.offset.y}),at(u.latestValues)&&gt(c,u.latestValues)}return at(this.latestValues)&&gt(c,this.latestValues),c}removeTransform(o){const a=D();I(a,o);for(let c=0;c<this.path.length;c++){const l=this.path[c];if(!l.instance||!at(l.latestValues))continue;Ue(l.latestValues)&&l.updateSnapshot();const u=D(),h=l.measurePageBox();I(u,h),Cs(a,l.latestValues,l.snapshot?l.snapshot.layoutBox:void 0,u)}return at(this.latestValues)&&Cs(a,this.latestValues),a}setTargetDelta(o){this.targetDelta=o,this.root.scheduleUpdateProjection(),this.isProjectionDirty=!0}setOptions(o){this.options={...this.options,...o,crossfade:o.crossfade!==void 0?o.crossfade:!0}}clearMeasurements(){this.scroll=void 0,this.layout=void 0,this.snapshot=void 0,this.prevTransformTemplateValue=void 0,this.targetDelta=void 0,this.target=void 0,this.isLayoutDirty=!1}forceRelativeParentToResolveTarget(){this.relativeParent&&this.relativeParent.resolvedRelativeTargetAt!==R.timestamp&&this.relativeParent.resolveTargetDelta(!0)}resolveTargetDelta(o=!1){var a;const c=this.getLead();this.isProjectionDirty||(this.isProjectionDirty=c.isProjectionDirty),this.isTransformDirty||(this.isTransformDirty=c.isTransformDirty),this.isSharedProjectionDirty||(this.isSharedProjectionDirty=c.isSharedProjectionDirty);const l=!!this.resumingFrom||this!==c;if(!(o||l&&this.isSharedProjectionDirty||this.isProjectionDirty||!((a=this.parent)===null||a===void 0)&&a.isProjectionDirty||this.attemptToResolveRelativeTarget||this.root.updateBlockedByResize))return;const{layout:h,layoutId:d}=this.options;if(!(!this.layout||!(h||d))){if(this.resolvedRelativeTargetAt=R.timestamp,!this.targetDelta&&!this.relativeTarget){const p=this.getClosestProjectingParent();p&&p.layout&&this.animationProgress!==1?(this.relativeParent=p,this.forceRelativeParentToResolveTarget(),this.relativeTarget=D(),this.relativeTargetOrigin=D(),_t(this.relativeTargetOrigin,this.layout.layoutBox,p.layout.layoutBox),I(this.relativeTarget,this.relativeTargetOrigin)):this.relativeParent=this.relativeTarget=void 0}if(!(!this.relativeTarget&&!this.targetDelta)){if(this.target||(this.target=D(),this.targetWithTransforms=D()),this.relativeTarget&&this.relativeTargetOrigin&&this.relativeParent&&this.relativeParent.target?(this.forceRelativeParentToResolveTarget(),$c(this.target,this.relativeTarget,this.relativeParent.target)):this.targetDelta?(this.resumingFrom?this.target=this.applyTransform(this.layout.layoutBox):I(this.target,this.layout.layoutBox),uo(this.target,this.targetDelta)):I(this.target,this.layout.layoutBox),this.attemptToResolveRelativeTarget){this.attemptToResolveRelativeTarget=!1;const p=this.getClosestProjectingParent();p&&!!p.resumingFrom==!!this.resumingFrom&&!p.options.layoutScroll&&p.target&&this.animationProgress!==1?(this.relativeParent=p,this.forceRelativeParentToResolveTarget(),this.relativeTarget=D(),this.relativeTargetOrigin=D(),_t(this.relativeTargetOrigin,this.target,p.target),I(this.relativeTarget,this.relativeTargetOrigin)):this.relativeParent=this.relativeTarget=void 0}At&&ct.resolvedTargetDeltas++}}}getClosestProjectingParent(){if(!(!this.parent||Ue(this.parent.latestValues)||lo(this.parent.latestValues)))return this.parent.isProjecting()?this.parent:this.parent.getClosestProjectingParent()}isProjecting(){return!!((this.relativeTarget||this.targetDelta||this.options.layoutRoot)&&this.layout)}calcProjection(){var o;const a=this.getLead(),c=!!this.resumingFrom||this!==a;let l=!0;if((this.isProjectionDirty||!((o=this.parent)===null||o===void 0)&&o.isProjectionDirty)&&(l=!1),c&&(this.isSharedProjectionDirty||this.isTransformDirty)&&(l=!1),this.resolvedRelativeTargetAt===R.timestamp&&(l=!1),l)return;const{layout:u,layoutId:h}=this.options;if(this.isTreeAnimating=!!(this.parent&&this.parent.isTreeAnimating||this.currentAnimation||this.pendingAnimation),this.isTreeAnimating||(this.targetDelta=this.relativeTarget=void 0),!this.layout||!(u||h))return;I(this.layoutCorrected,this.layout.layoutBox);const d=this.treeScale.x,p=this.treeScale.y;Kc(this.layoutCorrected,this.treeScale,this.path,c),a.layout&&!a.target&&(this.treeScale.x!==1||this.treeScale.y!==1)&&(a.target=a.layout.layoutBox,a.targetWithTransforms=D());const{target:y}=a;if(!y){this.prevProjectionDelta&&(this.createProjectionDeltas(),this.scheduleRender());return}!this.projectionDelta||!this.prevProjectionDelta?this.createProjectionDeltas():(Ps(this.prevProjectionDelta.x,this.projectionDelta.x),Ps(this.prevProjectionDelta.y,this.projectionDelta.y)),Vt(this.projectionDelta,this.layoutCorrected,y,this.latestValues),(this.treeScale.x!==d||this.treeScale.y!==p||!Rs(this.projectionDelta.x,this.prevProjectionDelta.x)||!Rs(this.projectionDelta.y,this.prevProjectionDelta.y))&&(this.hasProjected=!0,this.scheduleRender(),this.notifyListeners("projectionUpdate",y)),At&&ct.recalculatedProjection++}hide(){this.isVisible=!1}show(){this.isVisible=!0}scheduleRender(o=!0){var a;if((a=this.options.visualElement)===null||a===void 0||a.scheduleRender(),o){const c=this.getStack();c&&c.scheduleRender()}this.resumingFrom&&!this.resumingFrom.instance&&(this.resumingFrom=void 0)}createProjectionDeltas(){this.prevProjectionDelta=mt(),this.projectionDelta=mt(),this.projectionDeltaWithTransform=mt()}setAnimationOrigin(o,a=!1){const c=this.snapshot,l=c?c.latestValues:{},u={...this.latestValues},h=mt();(!this.relativeParent||!this.relativeParent.options.layoutRoot)&&(this.relativeTarget=this.relativeTargetOrigin=void 0),this.attemptToResolveRelativeTarget=!a;const d=D(),p=c?c.source:void 0,y=this.layout?this.layout.source:void 0,g=p!==y,v=this.getStack(),x=!v||v.members.length<=1,M=!!(g&&!x&&this.options.crossfade===!0&&!this.path.some(Dl));this.animationProgress=0;let k;this.mixTargetDelta=T=>{const b=T/1e3;$s(h.x,o.x,b),$s(h.y,o.y,b),this.setTargetDelta(h),this.relativeTarget&&this.relativeTargetOrigin&&this.layout&&this.relativeParent&&this.relativeParent.layout&&(_t(d,this.layout.layoutBox,this.relativeParent.layout.layoutBox),_l(this.relativeTarget,this.relativeTargetOrigin,d,b),k&&pl(this.relativeTarget,k)&&(this.isProjectionDirty=!1),k||(k=D()),I(k,this.relativeTarget)),g&&(this.animationValues=u,cl(u,l,this.latestValues,b,M,x)),this.root.scheduleUpdateProjection(),this.scheduleRender(),this.animationProgress=b},this.mixTargetDelta(this.options.layoutRoot?1e3:0)}startAnimation(o){this.notifyListeners("animationStart"),this.currentAnimation&&this.currentAnimation.stop(),this.resumingFrom&&this.resumingFrom.currentAnimation&&this.resumingFrom.currentAnimation.stop(),this.pendingAnimation&&(nt(this.pendingAnimation),this.pendingAnimation=void 0),this.pendingAnimation=S.update(()=>{Xt.hasAnimatedSinceResize=!0,this.currentAnimation=nl(0,Ls,{...o,onUpdate:a=>{this.mixTargetDelta(a),o.onUpdate&&o.onUpdate(a)},onComplete:()=>{o.onComplete&&o.onComplete(),this.completeAnimation()}}),this.resumingFrom&&(this.resumingFrom.currentAnimation=this.currentAnimation),this.pendingAnimation=void 0})}completeAnimation(){this.resumingFrom&&(this.resumingFrom.currentAnimation=void 0,this.resumingFrom.preserveOpacity=void 0);const o=this.getStack();o&&o.exitAnimationComplete(),this.resumingFrom=this.currentAnimation=this.animationValues=void 0,this.notifyListeners("animationComplete")}finishAnimation(){this.currentAnimation&&(this.mixTargetDelta&&this.mixTargetDelta(Ls),this.currentAnimation.stop()),this.completeAnimation()}applyTransformsToTarget(){const o=this.getLead();let{targetWithTransforms:a,target:c,layout:l,latestValues:u}=o;if(!(!a||!c||!l)){if(this!==o&&this.layout&&l&&Mo(this.options.animationType,this.layout.layoutBox,l.layoutBox)){c=this.target||D();const h=B(this.layout.layoutBox.x);c.x.min=o.target.x.min,c.x.max=c.x.min+h;const d=B(this.layout.layoutBox.y);c.y.min=o.target.y.min,c.y.max=c.y.min+d}I(a,c),gt(a,u),Vt(this.projectionDeltaWithTransform,this.layoutCorrected,a,u)}}registerSharedNode(o,a){this.sharedNodes.has(o)||this.sharedNodes.set(o,new ml),this.sharedNodes.get(o).add(a);const l=a.options.initialPromotionConfig;a.promote({transition:l?l.transition:void 0,preserveFollowOpacity:l&&l.shouldPreserveFollowOpacity?l.shouldPreserveFollowOpacity(a):void 0})}isLead(){const o=this.getStack();return o?o.lead===this:!0}getLead(){var o;const{layoutId:a}=this.options;return a?((o=this.getStack())===null||o===void 0?void 0:o.lead)||this:this}getPrevLead(){var o;const{layoutId:a}=this.options;return a?(o=this.getStack())===null||o===void 0?void 0:o.prevLead:void 0}getStack(){const{layoutId:o}=this.options;if(o)return this.root.sharedNodes.get(o)}promote({needsReset:o,transition:a,preserveFollowOpacity:c}={}){const l=this.getStack();l&&l.promote(this,c),o&&(this.projectionDelta=void 0,this.needsReset=!0),a&&this.setOptions({transition:a})}relegate(){const o=this.getStack();return o?o.relegate(this):!1}resetSkewAndRotation(){const{visualElement:o}=this.options;if(!o)return;let a=!1;const{latestValues:c}=o;if((c.z||c.rotate||c.rotateX||c.rotateY||c.rotateZ||c.skewX||c.skewY)&&(a=!0),!a)return;const l={};c.z&&Se("z",o,l,this.animationValues);for(let u=0;u<Ae.length;u++)Se(`rotate${Ae[u]}`,o,l,this.animationValues),Se(`skew${Ae[u]}`,o,l,this.animationValues);o.render();for(const u in l)o.setStaticValue(u,l[u]),this.animationValues&&(this.animationValues[u]=l[u]);o.scheduleRender()}getProjectionStyles(o){var a,c;if(!this.instance||this.isSVG)return;if(!this.isVisible)return gl;const l={visibility:""},u=this.getTransformTemplate();if(this.needsReset)return this.needsReset=!1,l.opacity="",l.pointerEvents=Wt(o==null?void 0:o.pointerEvents)||"",l.transform=u?u(this.latestValues,""):"none",l;const h=this.getLead();if(!this.projectionDelta||!this.layout||!h.target){const g={};return this.options.layoutId&&(g.opacity=this.latestValues.opacity!==void 0?this.latestValues.opacity:1,g.pointerEvents=Wt(o==null?void 0:o.pointerEvents)||""),this.hasProjected&&!at(this.latestValues)&&(g.transform=u?u({},""):"none",this.hasProjected=!1),g}const d=h.animationValues||h.latestValues;this.applyTransformsToTarget(),l.transform=yl(this.projectionDeltaWithTransform,this.treeScale,d),u&&(l.transform=u(d,l.transform));const{x:p,y}=this.projectionDelta;l.transformOrigin=`${p.origin*100}% ${y.origin*100}% 0`,h.animationValues?l.opacity=h===this?(c=(a=d.opacity)!==null&&a!==void 0?a:this.latestValues.opacity)!==null&&c!==void 0?c:1:this.preserveOpacity?this.latestValues.opacity:d.opacityExit:l.opacity=h===this?d.opacity!==void 0?d.opacity:"":d.opacityExit!==void 0?d.opacityExit:0;for(const g in Qt){if(d[g]===void 0)continue;const{correct:v,applyTo:x}=Qt[g],M=l.transform==="none"?d[g]:v(d[g],h);if(x){const k=x.length;for(let T=0;T<k;T++)l[x[T]]=M}else l[g]=M}return this.options.layoutId&&(l.pointerEvents=h===this?Wt(o==null?void 0:o.pointerEvents)||"":"none"),l}clearSnapshot(){this.resumeFrom=this.snapshot=void 0}resetTree(){this.root.nodes.forEach(o=>{var a;return(a=o.currentAnimation)===null||a===void 0?void 0:a.stop()}),this.root.nodes.forEach(Ns),this.root.sharedNodes.clear()}}}function xl(t){t.updateLayout()}function kl(t){var e;const n=((e=t.resumeFrom)===null||e===void 0?void 0:e.snapshot)||t.snapshot;if(t.isLead()&&t.layout&&n&&t.hasListeners("didUpdate")){const{layoutBox:s,measuredBox:i}=t.layout,{animationType:r}=t.options,o=n.source!==t.layout.source;r==="size"?z(h=>{const d=o?n.measuredBox[h]:n.layoutBox[h],p=B(d);d.min=s[h].min,d.max=d.min+p}):Mo(r,n.layoutBox,s)&&z(h=>{const d=o?n.measuredBox[h]:n.layoutBox[h],p=B(s[h]);d.max=d.min+p,t.relativeTarget&&!t.currentAnimation&&(t.isProjectionDirty=!0,t.relativeTarget[h].max=t.relativeTarget[h].min+p)});const a=mt();Vt(a,s,n.layoutBox);const c=mt();o?Vt(c,t.applyTransform(i,!0),n.measuredBox):Vt(c,s,n.layoutBox);const l=!go(a);let u=!1;if(!t.resumeFrom){const h=t.getClosestProjectingParent();if(h&&!h.resumeFrom){const{snapshot:d,layout:p}=h;if(d&&p){const y=D();_t(y,n.layoutBox,d.layoutBox);const g=D();_t(g,s,p.layoutBox),vo(y,g)||(u=!0),h.options.layoutRoot&&(t.relativeTarget=g,t.relativeTargetOrigin=y,t.relativeParent=h)}}}t.notifyListeners("didUpdate",{layout:s,snapshot:n,delta:c,layoutDelta:a,hasLayoutChanged:l,hasRelativeTargetChanged:u})}else if(t.isLead()){const{onExitComplete:s}=t.options;s&&s()}t.options.transition=void 0}function Ml(t){At&&ct.totalNodes++,t.parent&&(t.isProjecting()||(t.isProjectionDirty=t.parent.isProjectionDirty),t.isSharedProjectionDirty||(t.isSharedProjectionDirty=!!(t.isProjectionDirty||t.parent.isProjectionDirty||t.parent.isSharedProjectionDirty)),t.isTransformDirty||(t.isTransformDirty=t.parent.isTransformDirty))}function bl(t){t.isProjectionDirty=t.isSharedProjectionDirty=t.isTransformDirty=!1}function wl(t){t.clearSnapshot()}function Ns(t){t.clearMeasurements()}function Tl(t){t.isLayoutDirty=!1}function Pl(t){const{visualElement:e}=t.options;e&&e.getProps().onBeforeLayoutMeasure&&e.notify("BeforeLayoutMeasure"),t.resetTransform()}function js(t){t.finishAnimation(),t.targetDelta=t.relativeTarget=t.target=void 0,t.isProjectionDirty=!0}function Al(t){t.resolveTargetDelta()}function Sl(t){t.calcProjection()}function Cl(t){t.resetSkewAndRotation()}function Vl(t){t.removeLeadSnapshot()}function $s(t,e,n){t.translate=C(e.translate,0,n),t.scale=C(e.scale,1,n),t.origin=e.origin,t.originPoint=e.originPoint}function Fs(t,e,n,s){t.min=C(e.min,n.min,s),t.max=C(e.max,n.max,s)}function _l(t,e,n,s){Fs(t.x,e.x,n.x,s),Fs(t.y,e.y,n.y,s)}function Dl(t){return t.animationValues&&t.animationValues.opacityExit!==void 0}const El={duration:.45,ease:[.4,0,.1,1]},Bs=t=>typeof navigator<"u"&&navigator.userAgent&&navigator.userAgent.toLowerCase().includes(t),Os=Bs("applewebkit/")&&!Bs("chrome/")?Math.round:F;function Is(t){t.min=Os(t.min),t.max=Os(t.max)}function Rl(t){Is(t.x),Is(t.y)}function Mo(t,e,n){return t==="position"||t==="preserve-aspect"&&!jc(Es(e),Es(n),.2)}function Ll(t){var e;return t!==t.root&&((e=t.scroll)===null||e===void 0?void 0:e.wasRoot)}const Nl=ko({attachResizeListener:(t,e)=>jt(t,"resize",e),measureScroll:()=>({x:document.documentElement.scrollLeft||document.body.scrollLeft,y:document.documentElement.scrollTop||document.body.scrollTop}),checkIsScrollRoot:()=>!0}),Ce={current:void 0},bo=ko({measureScroll:t=>({x:t.scrollLeft,y:t.scrollTop}),defaultParent:()=>{if(!Ce.current){const t=new Nl({});t.mount(window),t.setOptions({layoutScroll:!0}),Ce.current=t}return Ce.current},resetTransform:(t,e)=>{t.style.transform=e!==void 0?e:"none"},checkIsScrollRoot:t=>window.getComputedStyle(t).position==="fixed"}),jl={pan:{Feature:Qc},drag:{Feature:Zc,ProjectionNode:bo,MeasureLayout:po}};function zs(t,e,n){const{props:s}=t;t.animationState&&s.whileHover&&t.animationState.setActive("whileHover",n==="Start");const i="onHover"+n,r=s[i];r&&S.postRender(()=>r(e,Ot(e)))}class $l extends it{mount(){const{current:e}=this.node;e&&(this.unmount=jr(e,n=>(zs(this.node,n,"Start"),s=>zs(this.node,s,"End"))))}unmount(){}}class Fl extends it{constructor(){super(...arguments),this.isActive=!1}onFocus(){let e=!1;try{e=this.node.current.matches(":focus-visible")}catch{e=!0}!e||!this.node.animationState||(this.node.animationState.setActive("whileFocus",!0),this.isActive=!0)}onBlur(){!this.isActive||!this.node.animationState||(this.node.animationState.setActive("whileFocus",!1),this.isActive=!1)}mount(){this.unmount=Bt(jt(this.node.current,"focus",()=>this.onFocus()),jt(this.node.current,"blur",()=>this.onBlur()))}unmount(){}}function Us(t,e,n){const{props:s}=t;t.animationState&&s.whileTap&&t.animationState.setActive("whileTap",n==="Start");const i="onTap"+(n==="End"?"":n),r=s[i];r&&S.postRender(()=>r(e,Ot(e)))}class Bl extends it{mount(){const{current:e}=this.node;e&&(this.unmount=Or(e,n=>(Us(this.node,n,"Start"),(s,{success:i})=>Us(this.node,s,i?"End":"Cancel")),{useGlobalTarget:this.node.props.globalTapTarget}))}unmount(){}}const He=new WeakMap,Ve=new WeakMap,Ol=t=>{const e=He.get(t.target);e&&e(t)},Il=t=>{t.forEach(Ol)};function zl({root:t,...e}){const n=t||document;Ve.has(n)||Ve.set(n,{});const s=Ve.get(n),i=JSON.stringify(e);return s[i]||(s[i]=new IntersectionObserver(Il,{root:t,...e})),s[i]}function Ul(t,e,n){const s=zl(e);return He.set(t,n),s.observe(t),()=>{He.delete(t),s.unobserve(t)}}const ql={some:0,all:1};class Hl extends it{constructor(){super(...arguments),this.hasEnteredView=!1,this.isInView=!1}startObserver(){this.unmount();const{viewport:e={}}=this.node.getProps(),{root:n,margin:s,amount:i="some",once:r}=e,o={root:n?n.current:void 0,rootMargin:s,threshold:typeof i=="number"?i:ql[i]},a=c=>{const{isIntersecting:l}=c;if(this.isInView===l||(this.isInView=l,r&&!l&&this.hasEnteredView))return;l&&(this.hasEnteredView=!0),this.node.animationState&&this.node.animationState.setActive("whileInView",l);const{onViewportEnter:u,onViewportLeave:h}=this.node.getProps(),d=l?u:h;d&&d(c)};return Ul(this.node.current,o,a)}mount(){this.startObserver()}update(){if(typeof IntersectionObserver>"u")return;const{props:e,prevProps:n}=this.node;["amount","margin","root"].some(Kl(e,n))&&this.startObserver()}unmount(){}}function Kl({viewport:t={}},{viewport:e={}}={}){return n=>t[n]!==e[n]}const Wl={inView:{Feature:Hl},tap:{Feature:Bl},focus:{Feature:Fl},hover:{Feature:$l}},Gl={layout:{ProjectionNode:bo,MeasureLayout:po}},ie={current:null},Sn={current:!1};function wo(){if(Sn.current=!0,!!Xe)if(window.matchMedia){const t=window.matchMedia("(prefers-reduced-motion)"),e=()=>ie.current=t.matches;t.addListener(e),e()}else ie.current=!1}const Xl=[...Wi,N,st],Yl=t=>Xl.find(Ki(t)),qs=new WeakMap;function Zl(t,e,n){for(const s in e){const i=e[s],r=n[s];if(j(i))t.addValue(s,i);else if(j(r))t.addValue(s,Lt(i,{owner:t}));else if(r!==i)if(t.hasValue(s)){const o=t.getValue(s);o.liveStyle===!0?o.jump(i):o.hasAnimated||o.set(i)}else{const o=t.getStaticValue(s);t.addValue(s,Lt(o!==void 0?o:i,{owner:t}))}}for(const s in n)e[s]===void 0&&t.removeValue(s);return e}const Hs=["AnimationStart","AnimationComplete","Update","BeforeLayoutMeasure","LayoutMeasure","LayoutAnimationStart","LayoutAnimationComplete"];class Ql{scrapeMotionValuesFromProps(e,n,s){return{}}constructor({parent:e,props:n,presenceContext:s,reducedMotionConfig:i,blockInitialAnimation:r,visualState:o},a={}){this.current=null,this.children=new Set,this.isVariantNode=!1,this.isControllingVariants=!1,this.shouldReduceMotion=null,this.values=new Map,this.KeyframeResolver=wn,this.features={},this.valueSubscriptions=new Map,this.prevMotionValues={},this.events={},this.propEventSubscriptions={},this.notifyUpdate=()=>this.notify("Update",this.latestValues),this.render=()=>{this.current&&(this.triggerBuild(),this.renderInstance(this.current,this.renderState,this.props.style,this.projection))},this.renderScheduledAt=0,this.scheduleRender=()=>{const p=W.now();this.renderScheduledAt<p&&(this.renderScheduledAt=p,S.render(this.render,!1,!0))};const{latestValues:c,renderState:l,onUpdate:u}=o;this.onUpdate=u,this.latestValues=c,this.baseTarget={...c},this.initialValues=n.initial?{...c}:{},this.renderState=l,this.parent=e,this.props=n,this.presenceContext=s,this.depth=e?e.depth+1:0,this.reducedMotionConfig=i,this.options=a,this.blockInitialAnimation=!!r,this.isControllingVariants=ue(n),this.isVariantNode=ei(n),this.isVariantNode&&(this.variantChildren=new Set),this.manuallyAnimateOnMount=!!(e&&e.current);const{willChange:h,...d}=this.scrapeMotionValuesFromProps(n,{},this);for(const p in d){const y=d[p];c[p]!==void 0&&j(y)&&y.set(c[p],!1)}}mount(e){this.current=e,qs.set(e,this),this.projection&&!this.projection.instance&&this.projection.mount(e),this.parent&&this.isVariantNode&&!this.isControllingVariants&&(this.removeFromVariantTree=this.parent.addVariantChild(this)),this.values.forEach((n,s)=>this.bindToMotionValue(s,n)),Sn.current||wo(),this.shouldReduceMotion=this.reducedMotionConfig==="never"?!1:this.reducedMotionConfig==="always"?!0:ie.current,this.parent&&this.parent.children.add(this),this.update(this.props,this.presenceContext)}unmount(){qs.delete(this.current),this.projection&&this.projection.unmount(),nt(this.notifyUpdate),nt(this.render),this.valueSubscriptions.forEach(e=>e()),this.valueSubscriptions.clear(),this.removeFromVariantTree&&this.removeFromVariantTree(),this.parent&&this.parent.children.delete(this);for(const e in this.events)this.events[e].clear();for(const e in this.features){const n=this.features[e];n&&(n.unmount(),n.isMounted=!1)}this.current=null}bindToMotionValue(e,n){this.valueSubscriptions.has(e)&&this.valueSubscriptions.get(e)();const s=ht.has(e),i=n.on("change",a=>{this.latestValues[e]=a,this.props.onUpdate&&S.preRender(this.notifyUpdate),s&&this.projection&&(this.projection.isTransformDirty=!0)}),r=n.on("renderRequest",this.scheduleRender);let o;window.MotionCheckAppearSync&&(o=window.MotionCheckAppearSync(this,e,n)),this.valueSubscriptions.set(e,()=>{i(),r(),o&&o(),n.owner&&n.stop()})}sortNodePosition(e){return!this.current||!this.sortInstanceNodePosition||this.type!==e.type?0:this.sortInstanceNodePosition(this.current,e.current)}updateFeatures(){let e="animation";for(e in xt){const n=xt[e];if(!n)continue;const{isEnabled:s,Feature:i}=n;if(!this.features[e]&&i&&s(this.props)&&(this.features[e]=new i(this)),this.features[e]){const r=this.features[e];r.isMounted?r.update():(r.mount(),r.isMounted=!0)}}}triggerBuild(){this.build(this.renderState,this.latestValues,this.props)}measureViewportBox(){return this.current?this.measureInstanceViewportBox(this.current,this.props):D()}getStaticValue(e){return this.latestValues[e]}setStaticValue(e,n){this.latestValues[e]=n}update(e,n){(e.transformTemplate||this.props.transformTemplate)&&this.scheduleRender(),this.prevProps=this.props,this.props=e,this.prevPresenceContext=this.presenceContext,this.presenceContext=n;for(let s=0;s<Hs.length;s++){const i=Hs[s];this.propEventSubscriptions[i]&&(this.propEventSubscriptions[i](),delete this.propEventSubscriptions[i]);const r="on"+i,o=e[r];o&&(this.propEventSubscriptions[i]=this.on(i,o))}this.prevMotionValues=Zl(this,this.scrapeMotionValuesFromProps(e,this.prevProps,this),this.prevMotionValues),this.handleChildMotionValue&&this.handleChildMotionValue(),this.onUpdate&&this.onUpdate(this)}getProps(){return this.props}getVariant(e){return this.props.variants?this.props.variants[e]:void 0}getDefaultTransition(){return this.props.transition}getTransformPagePoint(){return this.props.transformPagePoint}getClosestVariantNode(){return this.isVariantNode?this:this.parent?this.parent.getClosestVariantNode():void 0}addVariantChild(e){const n=this.getClosestVariantNode();if(n)return n.variantChildren&&n.variantChildren.add(e),()=>n.variantChildren.delete(e)}addValue(e,n){const s=this.values.get(e);n!==s&&(s&&this.removeValue(e),this.bindToMotionValue(e,n),this.values.set(e,n),this.latestValues[e]=n.get())}removeValue(e){this.values.delete(e);const n=this.valueSubscriptions.get(e);n&&(n(),this.valueSubscriptions.delete(e)),delete this.latestValues[e],this.removeValueFromRenderState(e,this.renderState)}hasValue(e){return this.values.has(e)}getValue(e,n){if(this.props.values&&this.props.values[e])return this.props.values[e];let s=this.values.get(e);return s===void 0&&n!==void 0&&(s=Lt(n===null?void 0:n,{owner:this}),this.addValue(e,s)),s}readValue(e,n){var s;let i=this.latestValues[e]!==void 0||!this.current?this.latestValues[e]:(s=this.getBaseTargetFromProps(this.props,e))!==null&&s!==void 0?s:this.readValueFromInstance(this.current,e,this.options);return i!=null&&(typeof i=="string"&&(qi(i)||Ni(i))?i=parseFloat(i):!Yl(i)&&st.test(n)&&(i=Ii(e,n)),this.setBaseTarget(e,j(i)?i.get():i)),j(i)?i.get():i}setBaseTarget(e,n){this.baseTarget[e]=n}getBaseTarget(e){var n;const{initial:s}=this.props;let i;if(typeof s=="string"||typeof s=="object"){const o=nn(this.props,s,(n=this.presenceContext)===null||n===void 0?void 0:n.custom);o&&(i=o[e])}if(s&&i!==void 0)return i;const r=this.getBaseTargetFromProps(this.props,e);return r!==void 0&&!j(r)?r:this.initialValues[e]!==void 0&&i===void 0?void 0:this.baseTarget[e]}on(e,n){return this.events[e]||(this.events[e]=new gn),this.events[e].add(n)}notify(e,...n){this.events[e]&&this.events[e].notify(...n)}}class To extends Ql{constructor(){super(...arguments),this.KeyframeResolver=Gi}sortInstanceNodePosition(e,n){return e.compareDocumentPosition(n)&2?1:-1}getBaseTargetFromProps(e,n){return e.style?e.style[n]:void 0}removeValueFromRenderState(e,{vars:n,style:s}){delete n[e],delete s[e]}handleChildMotionValue(){this.childSubscription&&(this.childSubscription(),delete this.childSubscription);const{children:e}=this.props;j(e)&&(this.childSubscription=e.on("change",n=>{this.current&&(this.current.textContent=`${n}`)}))}}function Jl(t){return window.getComputedStyle(t)}class tu extends To{constructor(){super(...arguments),this.type="html",this.renderInstance=ui}readValueFromInstance(e,n){if(ht.has(n)){const s=bn(n);return s&&s.default||0}else{const s=Jl(e),i=(ai(n)?s.getPropertyValue(n):s[n])||0;return typeof i=="string"?i.trim():i}}measureInstanceViewportBox(e,{transformPagePoint:n}){return ho(e,n)}build(e,n,s){rn(e,n,s.transformTemplate)}scrapeMotionValuesFromProps(e,n,s){return un(e,n,s)}}class eu extends To{constructor(){super(...arguments),this.type="svg",this.isSVGTag=!1,this.measureInstanceViewportBox=D}getBaseTargetFromProps(e,n){return e[n]}readValueFromInstance(e,n){if(ht.has(n)){const s=bn(n);return s&&s.default||0}return n=hi.has(n)?n:Je(n),e.getAttribute(n)}scrapeMotionValuesFromProps(e,n,s){return pi(e,n,s)}build(e,n,s){an(e,n,this.isSVGTag,s.transformTemplate)}renderInstance(e,n,s,i){di(e,n,s,i)}mount(e){this.isSVGTag=ln(e.tagName),super.mount(e)}}const nu=(t,e)=>en(t)?new eu(e):new tu(e,{allowProjection:t!==m.Fragment}),su=Vr({...Sc,...Wl,...jl,...Gl},nu),U1=qo(su);function q1(){!Sn.current&&wo();const[t]=m.useState(ie.current);return t}let iu={data:""},ou=t=>{if(typeof window=="object"){let e=(t?t.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return e.nonce=window.__nonce__,e.parentNode||(t||document.head).appendChild(e),e.firstChild}return t||iu},ru=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,au=/\/\*[^]*?\*\/|  +/g,Ks=/\n+/g,et=(t,e)=>{let n="",s="",i="";for(let r in t){let o=t[r];r[0]=="@"?r[1]=="i"?n=r+" "+o+";":s+=r[1]=="f"?et(o,r):r+"{"+et(o,r[1]=="k"?"":e)+"}":typeof o=="object"?s+=et(o,e?e.replace(/([^,])+/g,a=>r.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,c=>/&/.test(c)?c.replace(/&/g,a):a?a+" "+c:c)):r):o!=null&&(r=/^--/.test(r)?r:r.replace(/[A-Z]/g,"-$&").toLowerCase(),i+=et.p?et.p(r,o):r+":"+o+";")}return n+(e&&i?e+"{"+i+"}":i)+s},X={},Po=t=>{if(typeof t=="object"){let e="";for(let n in t)e+=n+Po(t[n]);return e}return t},cu=(t,e,n,s,i)=>{let r=Po(t),o=X[r]||(X[r]=(c=>{let l=0,u=11;for(;l<c.length;)u=101*u+c.charCodeAt(l++)>>>0;return"go"+u})(r));if(!X[o]){let c=r!==t?t:(l=>{let u,h,d=[{}];for(;u=ru.exec(l.replace(au,""));)u[4]?d.shift():u[3]?(h=u[3].replace(Ks," ").trim(),d.unshift(d[0][h]=d[0][h]||{})):d[0][u[1]]=u[2].replace(Ks," ").trim();return d[0]})(t);X[o]=et(i?{["@keyframes "+o]:c}:c,n?"":"."+o)}let a=n&&X.g?X.g:null;return n&&(X.g=X[o]),((c,l,u,h)=>{h?l.data=l.data.replace(h,c):l.data.indexOf(c)===-1&&(l.data=u?c+l.data:l.data+c)})(X[o],e,s,a),o},lu=(t,e,n)=>t.reduce((s,i,r)=>{let o=e[r];if(o&&o.call){let a=o(n),c=a&&a.props&&a.props.className||/^go/.test(a)&&a;o=c?"."+c:a&&typeof a=="object"?a.props?"":et(a,""):a===!1?"":a}return s+i+(o??"")},"");function fe(t){let e=this||{},n=t.call?t(e.p):t;return cu(n.unshift?n.raw?lu(n,[].slice.call(arguments,1),e.p):n.reduce((s,i)=>Object.assign(s,i&&i.call?i(e.p):i),{}):n,ou(e.target),e.g,e.o,e.k)}let Ao,Ke,We;fe.bind({g:1});let J=fe.bind({k:1});function uu(t,e,n,s){et.p=e,Ao=t,Ke=n,We=s}function ot(t,e){let n=this||{};return function(){let s=arguments;function i(r,o){let a=Object.assign({},r),c=a.className||i.className;n.p=Object.assign({theme:Ke&&Ke()},a),n.o=/ *go\d+/.test(c),a.className=fe.apply(n,s)+(c?" "+c:"");let l=t;return t[0]&&(l=a.as||t,delete a.as),We&&l[0]&&We(a),Ao(l,a)}return i}}var hu=t=>typeof t=="function",oe=(t,e)=>hu(t)?t(e):t,du=(()=>{let t=0;return()=>(++t).toString()})(),So=(()=>{let t;return()=>{if(t===void 0&&typeof window<"u"){let e=matchMedia("(prefers-reduced-motion: reduce)");t=!e||e.matches}return t}})(),fu=20,Cn="default",Co=(t,e)=>{let{toastLimit:n}=t.settings;switch(e.type){case 0:return{...t,toasts:[e.toast,...t.toasts].slice(0,n)};case 1:return{...t,toasts:t.toasts.map(o=>o.id===e.toast.id?{...o,...e.toast}:o)};case 2:let{toast:s}=e;return Co(t,{type:t.toasts.find(o=>o.id===s.id)?1:0,toast:s});case 3:let{toastId:i}=e;return{...t,toasts:t.toasts.map(o=>o.id===i||i===void 0?{...o,dismissed:!0,visible:!1}:o)};case 4:return e.toastId===void 0?{...t,toasts:[]}:{...t,toasts:t.toasts.filter(o=>o.id!==e.toastId)};case 5:return{...t,pausedAt:e.time};case 6:let r=e.time-(t.pausedAt||0);return{...t,pausedAt:void 0,toasts:t.toasts.map(o=>({...o,pauseDuration:o.pauseDuration+r}))}}},Yt=[],Vo={toasts:[],pausedAt:void 0,settings:{toastLimit:fu}},q={},_o=(t,e=Cn)=>{q[e]=Co(q[e]||Vo,t),Yt.forEach(([n,s])=>{n===e&&s(q[e])})},Do=t=>Object.keys(q).forEach(e=>_o(t,e)),pu=t=>Object.keys(q).find(e=>q[e].toasts.some(n=>n.id===t)),pe=(t=Cn)=>e=>{_o(e,t)},mu={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},yu=(t={},e=Cn)=>{let[n,s]=m.useState(q[e]||Vo),i=m.useRef(q[e]);m.useEffect(()=>(i.current!==q[e]&&s(q[e]),Yt.push([e,s]),()=>{let o=Yt.findIndex(([a])=>a===e);o>-1&&Yt.splice(o,1)}),[e]);let r=n.toasts.map(o=>{var a,c,l;return{...t,...t[o.type],...o,removeDelay:o.removeDelay||((a=t[o.type])==null?void 0:a.removeDelay)||(t==null?void 0:t.removeDelay),duration:o.duration||((c=t[o.type])==null?void 0:c.duration)||(t==null?void 0:t.duration)||mu[o.type],style:{...t.style,...(l=t[o.type])==null?void 0:l.style,...o.style}}});return{...n,toasts:r}},gu=(t,e="blank",n)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:e,ariaProps:{role:"status","aria-live":"polite"},message:t,pauseDuration:0,...n,id:(n==null?void 0:n.id)||du()}),It=t=>(e,n)=>{let s=gu(e,t,n);return pe(s.toasterId||pu(s.id))({type:2,toast:s}),s.id},E=(t,e)=>It("blank")(t,e);E.error=It("error");E.success=It("success");E.loading=It("loading");E.custom=It("custom");E.dismiss=(t,e)=>{let n={type:3,toastId:t};e?pe(e)(n):Do(n)};E.dismissAll=t=>E.dismiss(void 0,t);E.remove=(t,e)=>{let n={type:4,toastId:t};e?pe(e)(n):Do(n)};E.removeAll=t=>E.remove(void 0,t);E.promise=(t,e,n)=>{let s=E.loading(e.loading,{...n,...n==null?void 0:n.loading});return typeof t=="function"&&(t=t()),t.then(i=>{let r=e.success?oe(e.success,i):void 0;return r?E.success(r,{id:s,...n,...n==null?void 0:n.success}):E.dismiss(s),i}).catch(i=>{let r=e.error?oe(e.error,i):void 0;r?E.error(r,{id:s,...n,...n==null?void 0:n.error}):E.dismiss(s)}),t};var vu=1e3,xu=(t,e="default")=>{let{toasts:n,pausedAt:s}=yu(t,e),i=m.useRef(new Map).current,r=m.useCallback((h,d=vu)=>{if(i.has(h))return;let p=setTimeout(()=>{i.delete(h),o({type:4,toastId:h})},d);i.set(h,p)},[]);m.useEffect(()=>{if(s)return;let h=Date.now(),d=n.map(p=>{if(p.duration===1/0)return;let y=(p.duration||0)+p.pauseDuration-(h-p.createdAt);if(y<0){p.visible&&E.dismiss(p.id);return}return setTimeout(()=>E.dismiss(p.id,e),y)});return()=>{d.forEach(p=>p&&clearTimeout(p))}},[n,s,e]);let o=m.useCallback(pe(e),[e]),a=m.useCallback(()=>{o({type:5,time:Date.now()})},[o]),c=m.useCallback((h,d)=>{o({type:1,toast:{id:h,height:d}})},[o]),l=m.useCallback(()=>{s&&o({type:6,time:Date.now()})},[s,o]),u=m.useCallback((h,d)=>{let{reverseOrder:p=!1,gutter:y=8,defaultPosition:g}=d||{},v=n.filter(k=>(k.position||g)===(h.position||g)&&k.height),x=v.findIndex(k=>k.id===h.id),M=v.filter((k,T)=>T<x&&k.visible).length;return v.filter(k=>k.visible).slice(...p?[M+1]:[0,M]).reduce((k,T)=>k+(T.height||0)+y,0)},[n]);return m.useEffect(()=>{n.forEach(h=>{if(h.dismissed)r(h.id,h.removeDelay);else{let d=i.get(h.id);d&&(clearTimeout(d),i.delete(h.id))}})},[n,r]),{toasts:n,handlers:{updateHeight:c,startPause:a,endPause:l,calculateOffset:u}}},ku=J`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,Mu=J`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,bu=J`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,wu=ot("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${t=>t.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${ku} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${Mu} 0.15s ease-out forwards;
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
    animation: ${bu} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,Tu=J`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,Pu=ot("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${t=>t.secondary||"#e0e0e0"};
  border-right-color: ${t=>t.primary||"#616161"};
  animation: ${Tu} 1s linear infinite;
`,Au=J`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,Su=J`
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
}`,Cu=ot("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${t=>t.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${Au} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${Su} 0.2s ease-out forwards;
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
`,Vu=ot("div")`
  position: absolute;
`,_u=ot("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,Du=J`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,Eu=ot("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${Du} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,Ru=({toast:t})=>{let{icon:e,type:n,iconTheme:s}=t;return e!==void 0?typeof e=="string"?m.createElement(Eu,null,e):e:n==="blank"?null:m.createElement(_u,null,m.createElement(Pu,{...s}),n!=="loading"&&m.createElement(Vu,null,n==="error"?m.createElement(wu,{...s}):m.createElement(Cu,{...s})))},Lu=t=>`
0% {transform: translate3d(0,${t*-200}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,Nu=t=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${t*-150}%,-1px) scale(.6); opacity:0;}
`,ju="0%{opacity:0;} 100%{opacity:1;}",$u="0%{opacity:1;} 100%{opacity:0;}",Fu=ot("div")`
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
`,Bu=ot("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,Ou=(t,e)=>{let n=t.includes("top")?1:-1,[s,i]=So()?[ju,$u]:[Lu(n),Nu(n)];return{animation:e?`${J(s)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${J(i)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},Iu=m.memo(({toast:t,position:e,style:n,children:s})=>{let i=t.height?Ou(t.position||e||"top-center",t.visible):{opacity:0},r=m.createElement(Ru,{toast:t}),o=m.createElement(Bu,{...t.ariaProps},oe(t.message,t));return m.createElement(Fu,{className:t.className,style:{...i,...n,...t.style}},typeof s=="function"?s({icon:r,message:o}):m.createElement(m.Fragment,null,r,o))});uu(m.createElement);var zu=({id:t,className:e,style:n,onHeightUpdate:s,children:i})=>{let r=m.useCallback(o=>{if(o){let a=()=>{let c=o.getBoundingClientRect().height;s(t,c)};a(),new MutationObserver(a).observe(o,{subtree:!0,childList:!0,characterData:!0})}},[t,s]);return m.createElement("div",{ref:r,className:e,style:n},i)},Uu=(t,e)=>{let n=t.includes("top"),s=n?{top:0}:{bottom:0},i=t.includes("center")?{justifyContent:"center"}:t.includes("right")?{justifyContent:"flex-end"}:{};return{left:0,right:0,display:"flex",position:"absolute",transition:So()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${e*(n?1:-1)}px)`,...s,...i}},qu=fe`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,Kt=16,H1=({reverseOrder:t,position:e="top-center",toastOptions:n,gutter:s,children:i,toasterId:r,containerStyle:o,containerClassName:a})=>{let{toasts:c,handlers:l}=xu(n,r);return m.createElement("div",{"data-rht-toaster":r||"",style:{position:"fixed",zIndex:9999,top:Kt,left:Kt,right:Kt,bottom:Kt,pointerEvents:"none",...o},className:a,onMouseEnter:l.startPause,onMouseLeave:l.endPause},c.map(u=>{let h=u.position||e,d=l.calculateOffset(u,{reverseOrder:t,gutter:s,defaultPosition:e}),p=Uu(h,d);return m.createElement(zu,{id:u.id,key:u.id,onHeightUpdate:l.updateHeight,className:u.visible?qu:"",style:p},u.type==="custom"?oe(u.message,u):i?i(u):m.createElement(Iu,{toast:u,position:h}))}))},K1=E;/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Eo=(...t)=>t.filter((e,n,s)=>!!e&&e.trim()!==""&&s.indexOf(e)===n).join(" ").trim();/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Hu=t=>t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ku=t=>t.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,n,s)=>s?s.toUpperCase():n.toLowerCase());/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ws=t=>{const e=Ku(t);return e.charAt(0).toUpperCase()+e.slice(1)};/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var _e={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wu=t=>{for(const e in t)if(e.startsWith("aria-")||e==="role"||e==="title")return!0;return!1},Gu=m.createContext({}),Xu=()=>m.useContext(Gu),Yu=m.forwardRef(({color:t,size:e,strokeWidth:n,absoluteStrokeWidth:s,className:i="",children:r,iconNode:o,...a},c)=>{const{size:l=24,strokeWidth:u=2,absoluteStrokeWidth:h=!1,color:d="currentColor",className:p=""}=Xu()??{},y=s??h?Number(n??u)*24/Number(e??l):n??u;return m.createElement("svg",{ref:c,..._e,width:e??l??_e.width,height:e??l??_e.height,stroke:t??d,strokeWidth:y,className:Eo("lucide",p,i),...!r&&!Wu(a)&&{"aria-hidden":"true"},...a},[...o.map(([g,v])=>m.createElement(g,v)),...Array.isArray(r)?r:[r]])});/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=(t,e)=>{const n=m.forwardRef(({className:s,...i},r)=>m.createElement(Yu,{ref:r,iconNode:e,className:Eo(`lucide-${Hu(Ws(t))}`,`lucide-${t}`,s),...i}));return n.displayName=Ws(t),n};/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zu=[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]],W1=f("activity",Zu);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qu=[["rect",{width:"20",height:"5",x:"2",y:"3",rx:"1",key:"1wp1u1"}],["path",{d:"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8",key:"1s80jp"}],["path",{d:"M10 12h4",key:"a56b0p"}]],G1=f("archive",Qu);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ju=[["path",{d:"M12 5v14",key:"s699le"}],["path",{d:"m19 12-7 7-7-7",key:"1idqje"}]],X1=f("arrow-down",Ju);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const th=[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]],Y1=f("arrow-left",th);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const eh=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]],Z1=f("arrow-right",eh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const nh=[["path",{d:"m21 16-4 4-4-4",key:"f6ql7i"}],["path",{d:"M17 20V4",key:"1ejh1v"}],["path",{d:"m3 8 4-4 4 4",key:"11wl7u"}],["path",{d:"M7 4v16",key:"1glfcx"}]],Q1=f("arrow-up-down",nh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sh=[["path",{d:"M7 7h10v10",key:"1tivn9"}],["path",{d:"M7 17 17 7",key:"1vkiza"}]],J1=f("arrow-up-right",sh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ih=[["path",{d:"m5 12 7-7 7 7",key:"hav0vg"}],["path",{d:"M12 19V5",key:"x0mq9r"}]],tf=f("arrow-up",ih);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oh=[["path",{d:"m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526",key:"1yiouv"}],["circle",{cx:"12",cy:"8",r:"6",key:"1vp47v"}]],ef=f("award",oh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rh=[["path",{d:"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",key:"3c2336"}],["path",{d:"M12 7v10",key:"jspqdw"}],["path",{d:"M15.4 10a4 4 0 1 0 0 4",key:"2eqtx8"}]],nf=f("badge-cent",rh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ah=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M4.929 4.929 19.07 19.071",key:"196cmz"}]],sf=f("ban",ah);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ch=[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]],of=f("banknote",ch);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const lh=[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",key:"11g9vi"}]],rf=f("bell",lh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const uh=[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]],af=f("book-open",uh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hh=[["path",{d:"M12 8V4H8",key:"hb8ula"}],["rect",{width:"16",height:"12",x:"4",y:"8",rx:"2",key:"enze0r"}],["path",{d:"M2 14h2",key:"vft8re"}],["path",{d:"M20 14h2",key:"4cs60a"}],["path",{d:"M15 13v2",key:"1xurst"}],["path",{d:"M9 13v2",key:"rq6x2g"}]],cf=f("bot",hh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const dh=[["path",{d:"M12 18V5",key:"adv99a"}],["path",{d:"M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4",key:"1e3is1"}],["path",{d:"M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5",key:"1gqd8o"}],["path",{d:"M17.997 5.125a4 4 0 0 1 2.526 5.77",key:"iwvgf7"}],["path",{d:"M18 18a4 4 0 0 0 2-7.464",key:"efp6ie"}],["path",{d:"M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517",key:"1gq6am"}],["path",{d:"M6 18a4 4 0 0 1-2-7.464",key:"k1g0md"}],["path",{d:"M6.003 5.125a4 4 0 0 0-2.526 5.77",key:"q97ue3"}]],lf=f("brain",dh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fh=[["path",{d:"M12 12h.01",key:"1mp3jc"}],["path",{d:"M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",key:"1ksdt3"}],["path",{d:"M22 13a18.15 18.15 0 0 1-20 0",key:"12hx5q"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],uf=f("briefcase-business",fh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ph=[["path",{d:"M12 11v4",key:"a6ujw6"}],["path",{d:"M14 13h-4",key:"1pl8zg"}],["path",{d:"M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",key:"1ksdt3"}],["path",{d:"M18 6v14",key:"1mu4gy"}],["path",{d:"M6 6v14",key:"1s15cj"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],hf=f("briefcase-medical",ph);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const mh=[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],df=f("briefcase",mh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yh=[["path",{d:"M10 12h4",key:"a56b0p"}],["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",key:"secmi2"}],["path",{d:"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",key:"16ra0t"}]],ff=f("building-2",yh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const gh=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"m9 16 2 2 4-4",key:"19s6y9"}]],pf=f("calendar-check",gh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vh=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"M8 14h.01",key:"6423bh"}],["path",{d:"M12 14h.01",key:"1etili"}],["path",{d:"M16 14h.01",key:"1gbofw"}],["path",{d:"M8 18h.01",key:"lrp35t"}],["path",{d:"M12 18h.01",key:"mhygvu"}],["path",{d:"M16 18h.01",key:"kzsmim"}]],mf=f("calendar-days",vh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xh=[["path",{d:"M16 19h6",key:"xwg31i"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M19 16v6",key:"tddt3s"}],["path",{d:"M21 12.598V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.5",key:"1glfrc"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"M8 2v4",key:"1cmpym"}]],yf=f("calendar-plus",xh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const kh=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]],gf=f("calendar",kh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Mh=[["path",{d:"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z",key:"18u6gg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]],vf=f("camera",Mh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bh=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]],xf=f("chart-column",bh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wh=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"m19 9-5 5-4-4-3 3",key:"2osh9i"}]],kf=f("chart-line",wh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Th=[["path",{d:"M5 21v-6",key:"1hz6c0"}],["path",{d:"M12 21V3",key:"1lcnhd"}],["path",{d:"M19 21V9",key:"unv183"}]],Mf=f("chart-no-axes-column",Th);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ph=[["path",{d:"M18 6 7 17l-5-5",key:"116fxf"}],["path",{d:"m22 10-7.5 7.5L13 16",key:"ke71qq"}]],bf=f("check-check",Ph);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ah=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],wf=f("check",Ah);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sh=[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]],Tf=f("chevron-down",Sh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ch=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],Pf=f("chevron-left",Ch);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vh=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],Af=f("chevron-right",Vh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _h=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],Sf=f("chevron-up",_h);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Dh=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],Cf=f("circle-alert",Dh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Eh=[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]],Vf=f("circle-check-big",Eh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Rh=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],_f=f("circle-check",Rh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Lh=[["path",{d:"M10.1 2.182a10 10 0 0 1 3.8 0",key:"5ilxe3"}],["path",{d:"M13.9 21.818a10 10 0 0 1-3.8 0",key:"11zvb9"}],["path",{d:"M17.609 3.721a10 10 0 0 1 2.69 2.7",key:"1iw5b2"}],["path",{d:"M2.182 13.9a10 10 0 0 1 0-3.8",key:"c0bmvh"}],["path",{d:"M20.279 17.609a10 10 0 0 1-2.7 2.69",key:"1ruxm7"}],["path",{d:"M21.818 10.1a10 10 0 0 1 0 3.8",key:"qkgqxc"}],["path",{d:"M3.721 6.391a10 10 0 0 1 2.7-2.69",key:"1mcia2"}],["path",{d:"M6.391 20.279a10 10 0 0 1-2.69-2.7",key:"1fvljs"}]],Df=f("circle-dashed",Lh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Nh=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",key:"1u773s"}],["path",{d:"M12 17h.01",key:"p32p05"}]],Ef=f("circle-question-mark",Nh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const jh=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]],Rf=f("circle-x",jh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $h=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],Lf=f("circle",$h);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fh=[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"m9 14 2 2 4-4",key:"df797q"}]],Nf=f("clipboard-check",Fh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Bh=[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"M12 11h4",key:"1jrz19"}],["path",{d:"M12 16h4",key:"n85exb"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 16h.01",key:"18s6g9"}]],jf=f("clipboard-list",Bh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oh=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6h4",key:"135r8i"}]],$f=f("clock-3",Oh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ih=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6l4 2",key:"mmk7yg"}]],Ff=f("clock",Ih);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zh=[["path",{d:"M12 13v8",key:"1l5pq0"}],["path",{d:"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242",key:"1pljnt"}],["path",{d:"m8 17 4-4 4 4",key:"1quai1"}]],Bf=f("cloud-upload",zh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Uh=[["path",{d:"M13.744 17.736a6 6 0 1 1-7.48-7.48",key:"bq4yh3"}],["path",{d:"M15 6h1v4",key:"11y1tn"}],["path",{d:"m6.134 14.768.866-.5 2 3.464",key:"17snzx"}],["circle",{cx:"16",cy:"8",r:"6",key:"14bfc9"}]],Of=f("coins",Uh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qh=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],If=f("copy",qh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Hh=[["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M17 20v2",key:"1rnc9c"}],["path",{d:"M17 2v2",key:"11trls"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M2 17h2",key:"7oei6x"}],["path",{d:"M2 7h2",key:"asdhe0"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"M20 17h2",key:"1fpfkl"}],["path",{d:"M20 7h2",key:"1o8tra"}],["path",{d:"M7 20v2",key:"4gnj0m"}],["path",{d:"M7 2v2",key:"1i4yhu"}],["rect",{x:"4",y:"4",width:"16",height:"16",rx:"2",key:"1vbyd7"}],["rect",{x:"8",y:"8",width:"8",height:"8",rx:"1",key:"z9xiuo"}]],zf=f("cpu",Hh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Kh=[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]],Uf=f("credit-card",Kh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wh=[["ellipse",{cx:"12",cy:"5",rx:"9",ry:"3",key:"msslwz"}],["path",{d:"M3 5V19A9 3 0 0 0 21 19V5",key:"1wlel7"}],["path",{d:"M3 12A9 3 0 0 0 21 12",key:"mv7ke4"}]],qf=f("database",Wh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Gh=[["line",{x1:"12",x2:"12",y1:"2",y2:"22",key:"7eqyqh"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",key:"1b0p4s"}]],Hf=f("dollar-sign",Gh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xh=[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]],Kf=f("download",Xh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yh=[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"12",cy:"5",r:"1",key:"gxeob9"}],["circle",{cx:"12",cy:"19",r:"1",key:"lyex9k"}]],Wf=f("ellipsis-vertical",Yh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zh=[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"19",cy:"12",r:"1",key:"1wjl8i"}],["circle",{cx:"5",cy:"12",r:"1",key:"1pcz8c"}]],Gf=f("ellipsis",Zh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qh=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]],Xf=f("external-link",Qh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Jh=[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],Yf=f("eye",Jh);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const td=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M10 12.5 8 15l2 2.5",key:"1tg20x"}],["path",{d:"m14 12.5 2 2.5-2 2.5",key:"yinavb"}]],Zf=f("file-code",td);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ed=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M12 18v-6",key:"17g6i2"}],["path",{d:"m9 15 3 3 3-3",key:"1npd3o"}]],Qf=f("file-down",ed);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const nd=[["path",{d:"M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z",key:"ukzhwg"}],["path",{d:"M14.487 7.858A1 1 0 0 1 14 7V2",key:"1klhew"}],["path",{d:"M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516",key:"rxaxab"}],["path",{d:"M8 18h1",key:"13wk12"}]],Jf=f("file-pen-line",nd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sd=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["circle",{cx:"11.5",cy:"14.5",r:"2.5",key:"1bq0ko"}],["path",{d:"M13.3 16.3 15 18",key:"2quom7"}]],t0=f("file-search",sd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const id=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M8 13h2",key:"yr2amv"}],["path",{d:"M14 13h2",key:"un5t4a"}],["path",{d:"M8 17h2",key:"2yhykz"}],["path",{d:"M14 17h2",key:"10kma7"}]],e0=f("file-spreadsheet",id);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const od=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]],n0=f("file-text",od);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rd=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M11 18h2",key:"12mj7e"}],["path",{d:"M12 12v6",key:"3ahymv"}],["path",{d:"M9 13v-.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.5",key:"qbrxap"}]],s0=f("file-type",rd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ad=[["path",{d:"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",key:"usdka0"}]],i0=f("folder-open",ad);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const cd=[["path",{d:"m12 14 4-4",key:"9kzdfg"}],["path",{d:"M3.34 19a10 10 0 1 1 17.32 0",key:"19p75a"}]],o0=f("gauge",cd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ld=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]],r0=f("globe",ld);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ud=[["path",{d:"m11 17 2 2a1 1 0 1 0 3-3",key:"efffak"}],["path",{d:"m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4",key:"9pr0kb"}],["path",{d:"m21 3 1 11h-2",key:"1tisrp"}],["path",{d:"M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3",key:"1uvwmv"}],["path",{d:"M3 4h8",key:"1ep09j"}]],a0=f("handshake",ud);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hd=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]],c0=f("history",hd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const dd=[["polyline",{points:"22 12 16 12 14 15 10 15 8 12 2 12",key:"o97t9d"}],["path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",key:"oot6mr"}]],l0=f("inbox",dd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fd=[["path",{d:"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4",key:"g0fldk"}],["path",{d:"m21 2-9.6 9.6",key:"1j0ho8"}],["circle",{cx:"7.5",cy:"15.5",r:"5.5",key:"yqb3hr"}]],u0=f("key",fd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pd=[["path",{d:"M10 8h.01",key:"1r9ogq"}],["path",{d:"M12 12h.01",key:"1mp3jc"}],["path",{d:"M14 8h.01",key:"1primd"}],["path",{d:"M16 12h.01",key:"1l6xoz"}],["path",{d:"M18 8h.01",key:"emo2bl"}],["path",{d:"M6 8h.01",key:"x9i8wu"}],["path",{d:"M7 16h10",key:"wp8him"}],["path",{d:"M8 12h.01",key:"czm47f"}],["rect",{width:"20",height:"16",x:"2",y:"4",rx:"2",key:"18n3k1"}]],h0=f("keyboard",pd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const md=[["path",{d:"M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z",key:"1pdavp"}],["path",{d:"M20.054 15.987H3.946",key:"14rxg9"}]],d0=f("laptop",md);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yd=[["path",{d:"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",key:"zw3jo"}],["path",{d:"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12",key:"1wduqc"}],["path",{d:"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17",key:"kqbvx6"}]],f0=f("layers",yd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const gd=[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1",key:"6d4xhi"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1",key:"nxv5o0"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}]],p0=f("layout-grid",gd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vd=[["path",{d:"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",key:"1gvzjb"}],["path",{d:"M9 18h6",key:"x1upvd"}],["path",{d:"M10 22h4",key:"ceow96"}]],m0=f("lightbulb",vd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xd=[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]],y0=f("link-2",xd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const kd=[["path",{d:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",key:"1cjeqo"}],["path",{d:"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",key:"19qd67"}]],g0=f("link",kd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Md=[["path",{d:"M3 5h.01",key:"18ugdj"}],["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M3 19h.01",key:"noohij"}],["path",{d:"M8 5h13",key:"1pao27"}],["path",{d:"M8 12h13",key:"1za7za"}],["path",{d:"M8 19h13",key:"m83p4d"}]],v0=f("list",Md);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bd=[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]],x0=f("loader-circle",bd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wd=[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]],k0=f("lock",wd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Td=[["path",{d:"m16 17 5-5-5-5",key:"1bji2h"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}]],M0=f("log-out",Td);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pd=[["path",{d:"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7",key:"132q7q"}],["rect",{x:"2",y:"4",width:"20",height:"16",rx:"2",key:"izxlao"}]],b0=f("mail",Pd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ad=[["path",{d:"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",key:"1r0f0z"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]],w0=f("map-pin",Ad);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sd=[["path",{d:"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",key:"169xi5"}],["path",{d:"M15 5.764v15",key:"1pn4in"}],["path",{d:"M9 3.236v15",key:"1uimfh"}]],T0=f("map",Sd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Cd=[["path",{d:"M4 5h16",key:"1tepv9"}],["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 19h16",key:"1djgab"}]],P0=f("menu",Cd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vd=[["path",{d:"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719",key:"1sd12s"}]],A0=f("message-circle",Vd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _d=[["path",{d:"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",key:"18887p"}]],S0=f("message-square",_d);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Dd=[["path",{d:"M12 19v3",key:"npa21l"}],["path",{d:"M19 10v2a7 7 0 0 1-14 0v-2",key:"1vc78b"}],["rect",{x:"9",y:"2",width:"6",height:"13",rx:"3",key:"s6n7sd"}]],C0=f("mic",Dd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ed=[["path",{d:"M5 12h14",key:"1ays0h"}]],V0=f("minus",Ed);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Rd=[["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["line",{x1:"8",x2:"16",y1:"21",y2:"21",key:"1svkeh"}],["line",{x1:"12",x2:"12",y1:"17",y2:"21",key:"vw1qmm"}]],_0=f("monitor",Rd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ld=[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]],D0=f("moon",Ld);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Nd=[["path",{d:"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",key:"e79jfc"}],["circle",{cx:"13.5",cy:"6.5",r:".5",fill:"currentColor",key:"1okk4w"}],["circle",{cx:"17.5",cy:"10.5",r:".5",fill:"currentColor",key:"f64h9f"}],["circle",{cx:"6.5",cy:"12.5",r:".5",fill:"currentColor",key:"qy21gx"}],["circle",{cx:"8.5",cy:"7.5",r:".5",fill:"currentColor",key:"fotxhn"}]],E0=f("palette",Nd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const jd=[["path",{d:"m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551",key:"1miecu"}]],R0=f("paperclip",jd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $d=[["rect",{x:"14",y:"3",width:"5",height:"18",rx:"1",key:"kaeet6"}],["rect",{x:"5",y:"3",width:"5",height:"18",rx:"1",key:"1wsw3u"}]],L0=f("pause",$d);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fd=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]],N0=f("pen",Fd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Bd=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]],j0=f("pencil",Bd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Od=[["path",{d:"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",key:"9njp5v"}]],$0=f("phone",Od);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Id=[["path",{d:"M12 17v5",key:"bb1du9"}],["path",{d:"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",key:"1nkz8b"}]],F0=f("pin",Id);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zd=[["path",{d:"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",key:"10ikf1"}]],B0=f("play",zd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ud=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],O0=f("plus",Ud);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qd=[["path",{d:"M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z",key:"w46dr5"}]],I0=f("puzzle",qd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Hd=[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]],z0=f("refresh-cw",Hd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Kd=[["path",{d:"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",key:"qeys4"}],["path",{d:"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09",key:"u4xsad"}],["path",{d:"M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z",key:"676m9"}],["path",{d:"M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05",key:"92ym6u"}]],U0=f("rocket",Kd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wd=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]],q0=f("rotate-ccw",Wd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Gd=[["path",{d:"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",key:"1c8476"}],["path",{d:"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",key:"1ydtos"}],["path",{d:"M7 3v4a1 1 0 0 0 1 1h7",key:"t51u73"}]],H0=f("save",Gd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xd=[["path",{d:"m13.5 8.5-5 5",key:"1cs55j"}],["path",{d:"m8.5 8.5 5 5",key:"a8mexj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]],K0=f("search-x",Xd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yd=[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]],W0=f("search",Yd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zd=[["path",{d:"M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z",key:"117uat"}],["path",{d:"M6 12h16",key:"s4cdu5"}]],G0=f("send-horizontal",Zd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qd=[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]],X0=f("send",Qd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Jd=[["rect",{width:"20",height:"8",x:"2",y:"2",rx:"2",ry:"2",key:"ngkwjq"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",ry:"2",key:"iecqi9"}],["line",{x1:"6",x2:"6.01",y1:"6",y2:"6",key:"16zg32"}],["line",{x1:"6",x2:"6.01",y1:"18",y2:"18",key:"nzw8ys"}]],Y0=f("server",Jd);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const t1=[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],Z0=f("settings",t1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const e1=[["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}],["circle",{cx:"6",cy:"12",r:"3",key:"w7nqdw"}],["circle",{cx:"18",cy:"19",r:"3",key:"1xt0gg"}],["line",{x1:"8.59",x2:"15.42",y1:"13.51",y2:"17.49",key:"47mynk"}],["line",{x1:"15.41",x2:"8.59",y1:"6.51",y2:"10.49",key:"1n3mei"}]],Q0=f("share-2",e1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const n1=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"M12 8v4",key:"1got3b"}],["path",{d:"M12 16h.01",key:"1drbdi"}]],J0=f("shield-alert",n1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s1=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],tp=f("shield-check",s1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i1=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]],ep=f("shield",i1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o1=[["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M12 21v-9",key:"17s77i"}],["path",{d:"M12 8V3",key:"13r4qs"}],["path",{d:"M17 16h4",key:"h1uq16"}],["path",{d:"M19 12V3",key:"o1uvq1"}],["path",{d:"M19 21v-5",key:"qua636"}],["path",{d:"M3 14h4",key:"bcjad9"}],["path",{d:"M5 10V3",key:"cb8scm"}],["path",{d:"M5 21v-7",key:"1w1uti"}]],np=f("sliders-vertical",o1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r1=[["rect",{width:"14",height:"20",x:"5",y:"2",rx:"2",ry:"2",key:"1yt0o3"}],["path",{d:"M12 18h.01",key:"mhygvu"}]],sp=f("smartphone",r1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a1=[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",key:"1s2grr"}],["path",{d:"M20 2v4",key:"1rf3ol"}],["path",{d:"M22 4h-4",key:"gwowj6"}],["circle",{cx:"4",cy:"20",r:"2",key:"6kqj1y"}]],ip=f("sparkles",a1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c1=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]],op=f("square",c1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l1=[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]],rp=f("star",l1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u1=[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]],ap=f("sun",u1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h1=[["path",{d:"M12 3v18",key:"108xh3"}],["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M3 9h18",key:"1pudct"}],["path",{d:"M3 15h18",key:"5xshup"}]],cp=f("table",h1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d1=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["circle",{cx:"12",cy:"12",r:"6",key:"1vlfrh"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}]],lp=f("target",d1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f1=[["path",{d:"M12 19h8",key:"baeox8"}],["path",{d:"m4 17 6-6-6-6",key:"1yngyt"}]],up=f("terminal",f1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p1=[["path",{d:"M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",key:"m61m77"}],["path",{d:"M17 14V2",key:"8ymqnk"}]],hp=f("thumbs-down",p1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m1=[["path",{d:"M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",key:"emmmcr"}],["path",{d:"M7 10v12",key:"1qc93n"}]],dp=f("thumbs-up",m1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y1=[["circle",{cx:"9",cy:"12",r:"3",key:"u3jwor"}],["rect",{width:"20",height:"14",x:"2",y:"5",rx:"7",key:"g7kal2"}]],fp=f("toggle-left",y1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g1=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],pp=f("trash-2",g1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v1=[["path",{d:"M16 17h6v-6",key:"t6n2it"}],["path",{d:"m22 17-8.5-8.5-5 5L2 7",key:"x473p"}]],mp=f("trending-down",v1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x1=[["path",{d:"M16 7h6v6",key:"box55l"}],["path",{d:"m22 7-8.5 8.5-5-5L2 17",key:"1t1m79"}]],yp=f("trending-up",x1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k1=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],gp=f("triangle-alert",k1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M1=[["path",{d:"M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978",key:"1n3hpd"}],["path",{d:"M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978",key:"rfe1zi"}],["path",{d:"M18 9h1.5a1 1 0 0 0 0-5H18",key:"7xy6bh"}],["path",{d:"M4 22h16",key:"57wxv0"}],["path",{d:"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",key:"1mhfuq"}],["path",{d:"M6 9H4.5a1 1 0 0 1 0-5H6",key:"tex48p"}]],vp=f("trophy",M1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b1=[["path",{d:"m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71",key:"yqzxt4"}],["path",{d:"m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71",key:"4qinb0"}],["line",{x1:"8",x2:"8",y1:"2",y2:"5",key:"1041cp"}],["line",{x1:"2",x2:"5",y1:"8",y2:"8",key:"14m1p5"}],["line",{x1:"16",x2:"16",y1:"19",y2:"22",key:"rzdirn"}],["line",{x1:"19",x2:"22",y1:"16",y2:"16",key:"ox905f"}]],xp=f("unlink",b1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w1=[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]],kp=f("upload",w1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T1=[["path",{d:"m16 11 2 2 4-4",key:"9rsbq5"}],["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}]],Mp=f("user-check",T1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P1=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"19",x2:"19",y1:"8",y2:"14",key:"1bvyxn"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]],bp=f("user-plus",P1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A1=[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]],wp=f("user",A1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S1=[["path",{d:"M18 21a8 8 0 0 0-16 0",key:"3ypg7q"}],["circle",{cx:"10",cy:"8",r:"5",key:"o932ke"}],["path",{d:"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3",key:"10s06x"}]],Tp=f("users-round",S1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C1=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["path",{d:"M16 3.128a4 4 0 0 1 0 7.744",key:"16gr8j"}],["path",{d:"M22 21v-2a4 4 0 0 0-3-3.87",key:"kshegd"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}]],Pp=f("users",C1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const V1=[["path",{d:"m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",key:"ftymec"}],["rect",{x:"2",y:"6",width:"14",height:"12",rx:"2",key:"158x01"}]],Ap=f("video",V1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _1=[["path",{d:"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",key:"uqj9uw"}],["path",{d:"M16 9a5 5 0 0 1 0 6",key:"1q6k2b"}],["path",{d:"M19.364 18.364a9 9 0 0 0 0-12.728",key:"ijwkga"}]],Sp=f("volume-2",_1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D1=[["path",{d:"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",key:"uqj9uw"}],["line",{x1:"22",x2:"16",y1:"9",y2:"15",key:"1ewh16"}],["line",{x1:"16",x2:"22",y1:"9",y2:"15",key:"5ykzw1"}]],Cp=f("volume-x",D1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E1=[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]],Vp=f("wallet",E1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const R1=[["path",{d:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",key:"1ngwbx"}]],_p=f("wrench",R1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L1=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],Dp=f("x",L1);/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N1=[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",key:"1xq2db"}]],Ep=f("zap",N1);export{np as $,O1 as A,df as B,Tf as C,Hf as D,q1 as E,n0 as F,r0 as G,c0 as H,x0 as I,H1 as J,I1 as K,f0 as L,V0 as M,zf as N,xf as O,O0 as P,Af as Q,q0 as R,ip as S,up as T,bp as U,Cp as V,Mp as W,Dp as X,yp as Y,Ep as Z,tp as _,Z0 as a,Gf as a$,Sf as a0,pp as a1,_p as a2,qf as a3,op as a4,Rf as a5,K1 as a6,L0 as a7,B0 as a8,Vf as a9,lf as aA,Ap as aB,hf as aC,a0 as aD,Tp as aE,Of as aF,kp as aG,P0 as aH,K0 as aI,uf as aJ,l0 as aK,Yf as aL,b0 as aM,mp as aN,Y1 as aO,Xf as aP,xp as aQ,E0 as aR,y0 as aS,Pf as aT,Q1 as aU,tf as aV,X1 as aW,Qf as aX,k0 as aY,Bf as aZ,yf as a_,Kf as aa,s0 as ab,Zf as ac,i0 as ad,W0 as ae,S0 as af,F0 as ag,Wf as ah,G1 as ai,ap as aj,D0 as ak,_0 as al,o0 as am,h0 as an,mf as ao,vp as ap,rf as aq,J0 as ar,M0 as as,p0 as at,ff as au,Uf as av,fp as aw,jf as ax,W1 as ay,Nf as az,gf as b,E as b0,rp as b1,Jf as b2,sf as b3,lp as b4,pf as b5,v0 as b6,g0 as b7,d0 as b8,$0 as b9,of as ba,e0 as bb,$f as bc,j0 as bd,vf as be,Vp as bf,I0 as bg,Ef as bh,af as bi,Mf as bj,T0 as bk,t0 as bl,Lf as bm,Df as bn,w0 as bo,H0 as bp,m0 as bq,ef as br,nf as bs,kf as bt,u0 as bu,Y0 as bv,ep as bw,bf as bx,G0 as by,A0 as bz,wf as c,If as d,Z1 as e,cp as f,Ff as g,Pp as h,J1 as i,dp as j,hp as k,Q0 as l,U1 as m,Sp as n,N0 as o,wp as p,R0 as q,C0 as r,X0 as s,gp as t,U0 as u,sp as v,cf as w,Cf as x,_f as y,z0 as z};
