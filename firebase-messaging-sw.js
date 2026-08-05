try{self["workbox:core:7.4.0"]&&_()}catch{}const Rt=(t,...e)=>{let n=t;return e.length>0&&(n+=` :: ${JSON.stringify(e)}`),n},At=Rt;class f extends Error{constructor(e,n){const r=At(e,n);super(r),this.name=e,this.details=n}}const m={googleAnalytics:"googleAnalytics",precache:"precache-v2",prefix:"workbox",runtime:"runtime",suffix:typeof registration<"u"?registration.scope:""},G=t=>[m.prefix,t,m.suffix].filter(e=>e&&e.length>0).join("-"),kt=t=>{for(const e of Object.keys(m))t(e)},j={updateDetails:t=>{kt(e=>{typeof t[e]=="string"&&(m[e]=t[e])})},getGoogleAnalyticsName:t=>t||G(m.googleAnalytics),getPrecacheName:t=>t||G(m.precache),getPrefix:()=>m.prefix,getRuntimeName:t=>t||G(m.runtime),getSuffix:()=>m.suffix};function Te(t,e){const n=e();return t.waitUntil(n),n}try{self["workbox:precaching:7.4.0"]&&_()}catch{}const Dt="__WB_REVISION__";function vt(t){if(!t)throw new f("add-to-cache-list-unexpected-type",{entry:t});if(typeof t=="string"){const i=new URL(t,location.href);return{cacheKey:i.href,url:i.href}}const{revision:e,url:n}=t;if(!n)throw new f("add-to-cache-list-unexpected-type",{entry:t});if(!e){const i=new URL(n,location.href);return{cacheKey:i.href,url:i.href}}const r=new URL(n,location.href),s=new URL(n,location.href);return r.searchParams.set(Dt,e),{cacheKey:r.href,url:s.href}}class Nt{constructor(){this.updatedURLs=[],this.notUpdatedURLs=[],this.handlerWillStart=async({request:e,state:n})=>{n&&(n.originalRequest=e)},this.cachedResponseWillBeUsed=async({event:e,state:n,cachedResponse:r})=>{if(e.type==="install"&&n&&n.originalRequest&&n.originalRequest instanceof Request){const s=n.originalRequest.url;r?this.notUpdatedURLs.push(s):this.updatedURLs.push(s)}return r}}}class Ot{constructor({precacheController:e}){this.cacheKeyWillBeUsed=async({request:n,params:r})=>{const s=(r==null?void 0:r.cacheKey)||this._precacheController.getCacheKeyForURL(n.url);return s?new Request(s,{headers:n.headers}):n},this._precacheController=e}}let O;function Mt(){if(O===void 0){const t=new Response("");if("body"in t)try{new Response(t.body),O=!0}catch{O=!1}O=!1}return O}async function Pt(t,e){let n=null;if(t.url&&(n=new URL(t.url).origin),n!==self.location.origin)throw new f("cross-origin-copy-response",{origin:n});const r=t.clone(),i={headers:new Headers(r.headers),status:r.status,statusText:r.statusText},a=Mt()?r.body:await r.blob();return new Response(a,i)}const Lt=t=>new URL(String(t),location.href).href.replace(new RegExp(`^${location.origin}`),"");function Re(t,e){const n=new URL(t);for(const r of e)n.searchParams.delete(r);return n.href}async function Bt(t,e,n,r){const s=Re(e.url,n);if(e.url===s)return t.match(e,r);const i=Object.assign(Object.assign({},r),{ignoreSearch:!0}),a=await t.keys(e,i);for(const o of a){const l=Re(o.url,n);if(s===l)return t.match(o,r)}}let Ut=class{constructor(){this.promise=new Promise((e,n)=>{this.resolve=e,this.reject=n})}};const $t=new Set;async function xt(){for(const t of $t)await t()}function Ft(t){return new Promise(e=>setTimeout(e,t))}try{self["workbox:strategies:7.4.0"]&&_()}catch{}function U(t){return typeof t=="string"?new Request(t):t}class Ht{constructor(e,n){this._cacheKeys={},Object.assign(this,n),this.event=n.event,this._strategy=e,this._handlerDeferred=new Ut,this._extendLifetimePromises=[],this._plugins=[...e.plugins],this._pluginStateMap=new Map;for(const r of this._plugins)this._pluginStateMap.set(r,{});this.event.waitUntil(this._handlerDeferred.promise)}async fetch(e){const{event:n}=this;let r=U(e);if(r.mode==="navigate"&&n instanceof FetchEvent&&n.preloadResponse){const a=await n.preloadResponse;if(a)return a}const s=this.hasCallback("fetchDidFail")?r.clone():null;try{for(const a of this.iterateCallbacks("requestWillFetch"))r=await a({request:r.clone(),event:n})}catch(a){if(a instanceof Error)throw new f("plugin-error-request-will-fetch",{thrownErrorMessage:a.message})}const i=r.clone();try{let a;a=await fetch(r,r.mode==="navigate"?void 0:this._strategy.fetchOptions);for(const o of this.iterateCallbacks("fetchDidSucceed"))a=await o({event:n,request:i,response:a});return a}catch(a){throw s&&await this.runCallbacks("fetchDidFail",{error:a,event:n,originalRequest:s.clone(),request:i.clone()}),a}}async fetchAndCachePut(e){const n=await this.fetch(e),r=n.clone();return this.waitUntil(this.cachePut(e,r)),n}async cacheMatch(e){const n=U(e);let r;const{cacheName:s,matchOptions:i}=this._strategy,a=await this.getCacheKey(n,"read"),o=Object.assign(Object.assign({},i),{cacheName:s});r=await caches.match(a,o);for(const l of this.iterateCallbacks("cachedResponseWillBeUsed"))r=await l({cacheName:s,matchOptions:i,cachedResponse:r,request:a,event:this.event})||void 0;return r}async cachePut(e,n){const r=U(e);await Ft(0);const s=await this.getCacheKey(r,"write");if(!n)throw new f("cache-put-with-no-response",{url:Lt(s.url)});const i=await this._ensureResponseSafeToCache(n);if(!i)return!1;const{cacheName:a,matchOptions:o}=this._strategy,l=await self.caches.open(a),c=this.hasCallback("cacheDidUpdate"),p=c?await Bt(l,s.clone(),["__WB_REVISION__"],o):null;try{await l.put(s,c?i.clone():i)}catch(h){if(h instanceof Error)throw h.name==="QuotaExceededError"&&await xt(),h}for(const h of this.iterateCallbacks("cacheDidUpdate"))await h({cacheName:a,oldResponse:p,newResponse:i.clone(),request:s,event:this.event});return!0}async getCacheKey(e,n){const r=`${e.url} | ${n}`;if(!this._cacheKeys[r]){let s=e;for(const i of this.iterateCallbacks("cacheKeyWillBeUsed"))s=U(await i({mode:n,request:s,event:this.event,params:this.params}));this._cacheKeys[r]=s}return this._cacheKeys[r]}hasCallback(e){for(const n of this._strategy.plugins)if(e in n)return!0;return!1}async runCallbacks(e,n){for(const r of this.iterateCallbacks(e))await r(n)}*iterateCallbacks(e){for(const n of this._strategy.plugins)if(typeof n[e]=="function"){const r=this._pluginStateMap.get(n);yield i=>{const a=Object.assign(Object.assign({},i),{state:r});return n[e](a)}}}waitUntil(e){return this._extendLifetimePromises.push(e),e}async doneWaiting(){for(;this._extendLifetimePromises.length;){const e=this._extendLifetimePromises.splice(0),r=(await Promise.allSettled(e)).find(s=>s.status==="rejected");if(r)throw r.reason}}destroy(){this._handlerDeferred.resolve(null)}async _ensureResponseSafeToCache(e){let n=e,r=!1;for(const s of this.iterateCallbacks("cacheWillUpdate"))if(n=await s({request:this.request,response:n,event:this.event})||void 0,r=!0,!n)break;return r||n&&n.status!==200&&(n=void 0),n}}class Kt{constructor(e={}){this.cacheName=j.getRuntimeName(e.cacheName),this.plugins=e.plugins||[],this.fetchOptions=e.fetchOptions,this.matchOptions=e.matchOptions}handle(e){const[n]=this.handleAll(e);return n}handleAll(e){e instanceof FetchEvent&&(e={event:e,request:e.request});const n=e.event,r=typeof e.request=="string"?new Request(e.request):e.request,s="params"in e?e.params:void 0,i=new Ht(this,{event:n,request:r,params:s}),a=this._getResponse(i,r,n),o=this._awaitComplete(a,i,r,n);return[a,o]}async _getResponse(e,n,r){await e.runCallbacks("handlerWillStart",{event:r,request:n});let s;try{if(s=await this._handle(n,e),!s||s.type==="error")throw new f("no-response",{url:n.url})}catch(i){if(i instanceof Error){for(const a of e.iterateCallbacks("handlerDidError"))if(s=await a({error:i,event:r,request:n}),s)break}if(!s)throw i}for(const i of e.iterateCallbacks("handlerWillRespond"))s=await i({event:r,request:n,response:s});return s}async _awaitComplete(e,n,r,s){let i,a;try{i=await e}catch{}try{await n.runCallbacks("handlerDidRespond",{event:s,request:r,response:i}),await n.doneWaiting()}catch(o){o instanceof Error&&(a=o)}if(await n.runCallbacks("handlerDidComplete",{event:s,request:r,response:i,error:a}),n.destroy(),a)throw a}}class y extends Kt{constructor(e={}){e.cacheName=j.getPrecacheName(e.cacheName),super(e),this._fallbackToNetwork=e.fallbackToNetwork!==!1,this.plugins.push(y.copyRedirectedCacheableResponsesPlugin)}async _handle(e,n){const r=await n.cacheMatch(e);return r||(n.event&&n.event.type==="install"?await this._handleInstall(e,n):await this._handleFetch(e,n))}async _handleFetch(e,n){let r;const s=n.params||{};if(this._fallbackToNetwork){const i=s.integrity,a=e.integrity,o=!a||a===i;r=await n.fetch(new Request(e,{integrity:e.mode!=="no-cors"?a||i:void 0})),i&&o&&e.mode!=="no-cors"&&(this._useDefaultCacheabilityPluginIfNeeded(),await n.cachePut(e,r.clone()))}else throw new f("missing-precache-entry",{cacheName:this.cacheName,url:e.url});return r}async _handleInstall(e,n){this._useDefaultCacheabilityPluginIfNeeded();const r=await n.fetch(e);if(!await n.cachePut(e,r.clone()))throw new f("bad-precaching-response",{url:e.url,status:r.status});return r}_useDefaultCacheabilityPluginIfNeeded(){let e=null,n=0;for(const[r,s]of this.plugins.entries())s!==y.copyRedirectedCacheableResponsesPlugin&&(s===y.defaultPrecacheCacheabilityPlugin&&(e=r),s.cacheWillUpdate&&n++);n===0?this.plugins.push(y.defaultPrecacheCacheabilityPlugin):n>1&&e!==null&&this.plugins.splice(e,1)}}y.defaultPrecacheCacheabilityPlugin={async cacheWillUpdate({response:t}){return!t||t.status>=400?null:t}};y.copyRedirectedCacheableResponsesPlugin={async cacheWillUpdate({response:t}){return t.redirected?await Pt(t):t}};class jt{constructor({cacheName:e,plugins:n=[],fallbackToNetwork:r=!0}={}){this._urlsToCacheKeys=new Map,this._urlsToCacheModes=new Map,this._cacheKeysToIntegrities=new Map,this._strategy=new y({cacheName:j.getPrecacheName(e),plugins:[...n,new Ot({precacheController:this})],fallbackToNetwork:r}),this.install=this.install.bind(this),this.activate=this.activate.bind(this)}get strategy(){return this._strategy}precache(e){this.addToCacheList(e),this._installAndActiveListenersAdded||(self.addEventListener("install",this.install),self.addEventListener("activate",this.activate),this._installAndActiveListenersAdded=!0)}addToCacheList(e){const n=[];for(const r of e){typeof r=="string"?n.push(r):r&&r.revision===void 0&&n.push(r.url);const{cacheKey:s,url:i}=vt(r),a=typeof r!="string"&&r.revision?"reload":"default";if(this._urlsToCacheKeys.has(i)&&this._urlsToCacheKeys.get(i)!==s)throw new f("add-to-cache-list-conflicting-entries",{firstEntry:this._urlsToCacheKeys.get(i),secondEntry:s});if(typeof r!="string"&&r.integrity){if(this._cacheKeysToIntegrities.has(s)&&this._cacheKeysToIntegrities.get(s)!==r.integrity)throw new f("add-to-cache-list-conflicting-integrities",{url:i});this._cacheKeysToIntegrities.set(s,r.integrity)}if(this._urlsToCacheKeys.set(i,s),this._urlsToCacheModes.set(i,a),n.length>0){const o=`Workbox is precaching URLs without revision info: ${n.join(", ")}
This is generally NOT safe. Learn more at https://bit.ly/wb-precache`;console.warn(o)}}}install(e){return Te(e,async()=>{const n=new Nt;this.strategy.plugins.push(n);for(const[i,a]of this._urlsToCacheKeys){const o=this._cacheKeysToIntegrities.get(a),l=this._urlsToCacheModes.get(i),c=new Request(i,{integrity:o,cache:l,credentials:"same-origin"});await Promise.all(this.strategy.handleAll({params:{cacheKey:a},request:c,event:e}))}const{updatedURLs:r,notUpdatedURLs:s}=n;return{updatedURLs:r,notUpdatedURLs:s}})}activate(e){return Te(e,async()=>{const n=await self.caches.open(this.strategy.cacheName),r=await n.keys(),s=new Set(this._urlsToCacheKeys.values()),i=[];for(const a of r)s.has(a.url)||(await n.delete(a),i.push(a.url));return{deletedURLs:i}})}getURLsToCacheKeys(){return this._urlsToCacheKeys}getCachedURLs(){return[...this._urlsToCacheKeys.keys()]}getCacheKeyForURL(e){const n=new URL(e,location.href);return this._urlsToCacheKeys.get(n.href)}getIntegrityForCacheKey(e){return this._cacheKeysToIntegrities.get(e)}async matchPrecache(e){const n=e instanceof Request?e.url:e,r=this.getCacheKeyForURL(n);if(r)return(await self.caches.open(this.strategy.cacheName)).match(r)}createHandlerBoundToURL(e){const n=this.getCacheKeyForURL(e);if(!n)throw new f("non-precached-url",{url:e});return r=>(r.request=new Request(e),r.params=Object.assign({cacheKey:n},r.params),this.strategy.handle(r))}}let J;const Ke=()=>(J||(J=new jt),J);try{self["workbox:routing:7.4.0"]&&_()}catch{}const je="GET",$=t=>t&&typeof t=="object"?t:{handle:t};class P{constructor(e,n,r=je){this.handler=$(n),this.match=e,this.method=r}setCatchHandler(e){this.catchHandler=$(e)}}class Vt extends P{constructor(e,n,r){const s=({url:i})=>{const a=e.exec(i.href);if(a&&!(i.origin!==location.origin&&a.index!==0))return a.slice(1)};super(s,n,r)}}class Wt{constructor(){this._routes=new Map,this._defaultHandlerMap=new Map}get routes(){return this._routes}addFetchListener(){self.addEventListener("fetch",e=>{const{request:n}=e,r=this.handleRequest({request:n,event:e});r&&e.respondWith(r)})}addCacheListener(){self.addEventListener("message",e=>{if(e.data&&e.data.type==="CACHE_URLS"){const{payload:n}=e.data,r=Promise.all(n.urlsToCache.map(s=>{typeof s=="string"&&(s=[s]);const i=new Request(...s);return this.handleRequest({request:i,event:e})}));e.waitUntil(r),e.ports&&e.ports[0]&&r.then(()=>e.ports[0].postMessage(!0))}})}handleRequest({request:e,event:n}){const r=new URL(e.url,location.href);if(!r.protocol.startsWith("http"))return;const s=r.origin===location.origin,{params:i,route:a}=this.findMatchingRoute({event:n,request:e,sameOrigin:s,url:r});let o=a&&a.handler;const l=e.method;if(!o&&this._defaultHandlerMap.has(l)&&(o=this._defaultHandlerMap.get(l)),!o)return;let c;try{c=o.handle({url:r,request:e,event:n,params:i})}catch(h){c=Promise.reject(h)}const p=a&&a.catchHandler;return c instanceof Promise&&(this._catchHandler||p)&&(c=c.catch(async h=>{if(p)try{return await p.handle({url:r,request:e,event:n,params:i})}catch(E){E instanceof Error&&(h=E)}if(this._catchHandler)return this._catchHandler.handle({url:r,request:e,event:n});throw h})),c}findMatchingRoute({url:e,sameOrigin:n,request:r,event:s}){const i=this._routes.get(r.method)||[];for(const a of i){let o;const l=a.match({url:e,sameOrigin:n,request:r,event:s});if(l)return o=l,(Array.isArray(o)&&o.length===0||l.constructor===Object&&Object.keys(l).length===0||typeof l=="boolean")&&(o=void 0),{route:a,params:o}}return{}}setDefaultHandler(e,n=je){this._defaultHandlerMap.set(n,$(e))}setCatchHandler(e){this._catchHandler=$(e)}registerRoute(e){this._routes.has(e.method)||this._routes.set(e.method,[]),this._routes.get(e.method).push(e)}unregisterRoute(e){if(!this._routes.has(e.method))throw new f("unregister-route-but-not-found-with-method",{method:e.method});const n=this._routes.get(e.method).indexOf(e);if(n>-1)this._routes.get(e.method).splice(n,1);else throw new f("unregister-route-route-not-registered")}}let M;const qt=()=>(M||(M=new Wt,M.addFetchListener(),M.addCacheListener()),M);function zt(t,e,n){let r;if(typeof t=="string"){const i=new URL(t,location.href),a=({url:o})=>o.href===i.href;r=new P(a,e,n)}else if(t instanceof RegExp)r=new Vt(t,e,n);else if(typeof t=="function")r=new P(t,e,n);else if(t instanceof P)r=t;else throw new f("unsupported-route-type",{moduleName:"workbox-routing",funcName:"registerRoute",paramName:"capture"});return qt().registerRoute(r),r}function Gt(t,e=[]){for(const n of[...t.searchParams.keys()])e.some(r=>r.test(n))&&t.searchParams.delete(n);return t}function*Jt(t,{ignoreURLParametersMatching:e=[/^utm_/,/^fbclid$/],directoryIndex:n="index.html",cleanURLs:r=!0,urlManipulation:s}={}){const i=new URL(t,location.href);i.hash="",yield i.href;const a=Gt(i,e);if(yield a.href,n&&a.pathname.endsWith("/")){const o=new URL(a.href);o.pathname+=n,yield o.href}if(r){const o=new URL(a.href);o.pathname+=".html",yield o.href}if(s){const o=s({url:i});for(const l of o)yield l.href}}class Yt extends P{constructor(e,n){const r=({request:s})=>{const i=e.getURLsToCacheKeys();for(const a of Jt(s.url,n)){const o=i.get(a);if(o){const l=e.getIntegrityForCacheKey(o);return{cacheKey:o,integrity:l}}}};super(r,e.strategy)}}function Qt(t){const e=Ke(),n=new Yt(e,t);zt(n)}const Xt="-precache-",Zt=async(t,e=Xt)=>{const r=(await self.caches.keys()).filter(s=>s.includes(e)&&s.includes(self.registration.scope)&&s!==t);return await Promise.all(r.map(s=>self.caches.delete(s))),r};function en(){self.addEventListener("activate",t=>{const e=j.getPrecacheName();t.waitUntil(Zt(e).then(n=>{}))})}function tn(t){Ke().precache(t)}function nn(t,e){tn(t),Qt(e)}const rn=()=>{};var Ae={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ve=function(t){const e=[];let n=0;for(let r=0;r<t.length;r++){let s=t.charCodeAt(r);s<128?e[n++]=s:s<2048?(e[n++]=s>>6|192,e[n++]=s&63|128):(s&64512)===55296&&r+1<t.length&&(t.charCodeAt(r+1)&64512)===56320?(s=65536+((s&1023)<<10)+(t.charCodeAt(++r)&1023),e[n++]=s>>18|240,e[n++]=s>>12&63|128,e[n++]=s>>6&63|128,e[n++]=s&63|128):(e[n++]=s>>12|224,e[n++]=s>>6&63|128,e[n++]=s&63|128)}return e},sn=function(t){const e=[];let n=0,r=0;for(;n<t.length;){const s=t[n++];if(s<128)e[r++]=String.fromCharCode(s);else if(s>191&&s<224){const i=t[n++];e[r++]=String.fromCharCode((s&31)<<6|i&63)}else if(s>239&&s<365){const i=t[n++],a=t[n++],o=t[n++],l=((s&7)<<18|(i&63)<<12|(a&63)<<6|o&63)-65536;e[r++]=String.fromCharCode(55296+(l>>10)),e[r++]=String.fromCharCode(56320+(l&1023))}else{const i=t[n++],a=t[n++];e[r++]=String.fromCharCode((s&15)<<12|(i&63)<<6|a&63)}}return e.join("")},We={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(t,e){if(!Array.isArray(t))throw Error("encodeByteArray takes an array as a parameter");this.init_();const n=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let s=0;s<t.length;s+=3){const i=t[s],a=s+1<t.length,o=a?t[s+1]:0,l=s+2<t.length,c=l?t[s+2]:0,p=i>>2,h=(i&3)<<4|o>>4;let E=(o&15)<<2|c>>6,B=c&63;l||(B=64,a||(E=64)),r.push(n[p],n[h],n[E],n[B])}return r.join("")},encodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(t):this.encodeByteArray(Ve(t),e)},decodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(t):sn(this.decodeStringToByteArray(t,e))},decodeStringToByteArray(t,e){this.init_();const n=e?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let s=0;s<t.length;){const i=n[t.charAt(s++)],o=s<t.length?n[t.charAt(s)]:0;++s;const c=s<t.length?n[t.charAt(s)]:64;++s;const h=s<t.length?n[t.charAt(s)]:64;if(++s,i==null||o==null||c==null||h==null)throw new an;const E=i<<2|o>>4;if(r.push(E),c!==64){const B=o<<4&240|c>>2;if(r.push(B),h!==64){const Tt=c<<6&192|h;r.push(Tt)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let t=0;t<this.ENCODED_VALS.length;t++)this.byteToCharMap_[t]=this.ENCODED_VALS.charAt(t),this.charToByteMap_[this.byteToCharMap_[t]]=t,this.byteToCharMapWebSafe_[t]=this.ENCODED_VALS_WEBSAFE.charAt(t),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[t]]=t,t>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(t)]=t,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(t)]=t)}}};class an extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const on=function(t){const e=Ve(t);return We.encodeByteArray(e,!0)},qe=function(t){return on(t).replace(/\./g,"")},cn=function(t){try{return We.decodeString(t,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ln(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const un=()=>ln().__FIREBASE_DEFAULTS__,hn=()=>{if(typeof process>"u"||typeof Ae>"u")return;const t=Ae.__FIREBASE_DEFAULTS__;if(t)return JSON.parse(t)},fn=()=>{if(typeof document>"u")return;let t;try{t=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=t&&cn(t[1]);return e&&JSON.parse(e)},dn=()=>{try{return rn()||un()||hn()||fn()}catch(t){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${t}`);return}},ze=()=>{var t;return(t=dn())==null?void 0:t.config};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pn{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,n)=>{this.resolve=e,this.reject=n})}wrapCallback(e){return(n,r)=>{n?this.reject(n):this.resolve(r),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(n):e(n,r))}}}function Ge(){try{return typeof indexedDB=="object"}catch{return!1}}function Je(){return new Promise((t,e)=>{try{let n=!0;const r="validate-browser-context-for-indexeddb-analytics-module",s=self.indexedDB.open(r);s.onsuccess=()=>{s.result.close(),n||self.indexedDB.deleteDatabase(r),t(!0)},s.onupgradeneeded=()=>{n=!1},s.onerror=()=>{var i;e(((i=s.error)==null?void 0:i.message)||"")}}catch(n){e(n)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gn="FirebaseError";class N extends Error{constructor(e,n,r){super(n),this.code=e,this.customData=r,this.name=gn,Object.setPrototypeOf(this,N.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,V.prototype.create)}}class V{constructor(e,n,r){this.service=e,this.serviceName=n,this.errors=r}create(e,...n){const r=n[0]||{},s=`${this.service}/${e}`,i=this.errors[e],a=i?mn(i,r):"Error",o=`${this.serviceName}: ${a} (${s}).`;return new N(s,o,r)}}function mn(t,e){return t.replace(bn,(n,r)=>{const s=e[r];return s!=null?String(s):`<${r}?>`})}const bn=/\{\$([^}]+)}/g;function ae(t,e){if(t===e)return!0;const n=Object.keys(t),r=Object.keys(e);for(const s of n){if(!r.includes(s))return!1;const i=t[s],a=e[s];if(ke(i)&&ke(a)){if(!ae(i,a))return!1}else if(i!==a)return!1}for(const s of r)if(!n.includes(s))return!1;return!0}function ke(t){return t!==null&&typeof t=="object"}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ye(t){return t&&t._delegate?t._delegate:t}class T{constructor(e,n,r){this.name=e,this.instanceFactory=n,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const C="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wn{constructor(e,n){this.name=e,this.container=n,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const n=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(n)){const r=new pn;if(this.instancesDeferred.set(n,r),this.isInitialized(n)||this.shouldAutoInitialize())try{const s=this.getOrInitializeService({instanceIdentifier:n});s&&r.resolve(s)}catch{}}return this.instancesDeferred.get(n).promise}getImmediate(e){const n=this.normalizeInstanceIdentifier(e==null?void 0:e.identifier),r=(e==null?void 0:e.optional)??!1;if(this.isInitialized(n)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:n})}catch(s){if(r)return null;throw s}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(_n(e))try{this.getOrInitializeService({instanceIdentifier:C})}catch{}for(const[n,r]of this.instancesDeferred.entries()){const s=this.normalizeInstanceIdentifier(n);try{const i=this.getOrInitializeService({instanceIdentifier:s});r.resolve(i)}catch{}}}}clearInstance(e=C){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(n=>"INTERNAL"in n).map(n=>n.INTERNAL.delete()),...e.filter(n=>"_delete"in n).map(n=>n._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=C){return this.instances.has(e)}getOptions(e=C){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:n={}}=e,r=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const s=this.getOrInitializeService({instanceIdentifier:r,options:n});for(const[i,a]of this.instancesDeferred.entries()){const o=this.normalizeInstanceIdentifier(i);r===o&&a.resolve(s)}return s}onInit(e,n){const r=this.normalizeInstanceIdentifier(n),s=this.onInitCallbacks.get(r)??new Set;s.add(e),this.onInitCallbacks.set(r,s);const i=this.instances.get(r);return i&&e(i,r),()=>{s.delete(e)}}invokeOnInitCallbacks(e,n){const r=this.onInitCallbacks.get(n);if(r)for(const s of r)try{s(e,n)}catch{}}getOrInitializeService({instanceIdentifier:e,options:n={}}){let r=this.instances.get(e);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:yn(e),options:n}),this.instances.set(e,r),this.instancesOptions.set(e,n),this.invokeOnInitCallbacks(r,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,r)}catch{}return r||null}normalizeInstanceIdentifier(e=C){return this.component?this.component.multipleInstances?e:C:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function yn(t){return t===C?void 0:t}function _n(t){return t.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class In{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const n=this.getProvider(e.name);if(n.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);n.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const n=new wn(e,this);return this.providers.set(e,n),n}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var u;(function(t){t[t.DEBUG=0]="DEBUG",t[t.VERBOSE=1]="VERBOSE",t[t.INFO=2]="INFO",t[t.WARN=3]="WARN",t[t.ERROR=4]="ERROR",t[t.SILENT=5]="SILENT"})(u||(u={}));const En={debug:u.DEBUG,verbose:u.VERBOSE,info:u.INFO,warn:u.WARN,error:u.ERROR,silent:u.SILENT},Cn=u.INFO,Sn={[u.DEBUG]:"log",[u.VERBOSE]:"log",[u.INFO]:"info",[u.WARN]:"warn",[u.ERROR]:"error"},Tn=(t,e,...n)=>{if(e<t.logLevel)return;const r=new Date().toISOString(),s=Sn[e];if(s)console[s](`[${r}]  ${t.name}:`,...n);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class Rn{constructor(e){this.name=e,this._logLevel=Cn,this._logHandler=Tn,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in u))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?En[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,u.DEBUG,...e),this._logHandler(this,u.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,u.VERBOSE,...e),this._logHandler(this,u.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,u.INFO,...e),this._logHandler(this,u.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,u.WARN,...e),this._logHandler(this,u.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,u.ERROR,...e),this._logHandler(this,u.ERROR,...e)}}const An=(t,e)=>e.some(n=>t instanceof n);let De,ve;function kn(){return De||(De=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Dn(){return ve||(ve=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Qe=new WeakMap,oe=new WeakMap,Xe=new WeakMap,Y=new WeakMap,de=new WeakMap;function vn(t){const e=new Promise((n,r)=>{const s=()=>{t.removeEventListener("success",i),t.removeEventListener("error",a)},i=()=>{n(b(t.result)),s()},a=()=>{r(t.error),s()};t.addEventListener("success",i),t.addEventListener("error",a)});return e.then(n=>{n instanceof IDBCursor&&Qe.set(n,t)}).catch(()=>{}),de.set(e,t),e}function Nn(t){if(oe.has(t))return;const e=new Promise((n,r)=>{const s=()=>{t.removeEventListener("complete",i),t.removeEventListener("error",a),t.removeEventListener("abort",a)},i=()=>{n(),s()},a=()=>{r(t.error||new DOMException("AbortError","AbortError")),s()};t.addEventListener("complete",i),t.addEventListener("error",a),t.addEventListener("abort",a)});oe.set(t,e)}let ce={get(t,e,n){if(t instanceof IDBTransaction){if(e==="done")return oe.get(t);if(e==="objectStoreNames")return t.objectStoreNames||Xe.get(t);if(e==="store")return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return b(t[e])},set(t,e,n){return t[e]=n,!0},has(t,e){return t instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in t}};function On(t){ce=t(ce)}function Mn(t){return t===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...n){const r=t.call(Q(this),e,...n);return Xe.set(r,e.sort?e.sort():[e]),b(r)}:Dn().includes(t)?function(...e){return t.apply(Q(this),e),b(Qe.get(this))}:function(...e){return b(t.apply(Q(this),e))}}function Pn(t){return typeof t=="function"?Mn(t):(t instanceof IDBTransaction&&Nn(t),An(t,kn())?new Proxy(t,ce):t)}function b(t){if(t instanceof IDBRequest)return vn(t);if(Y.has(t))return Y.get(t);const e=Pn(t);return e!==t&&(Y.set(t,e),de.set(e,t)),e}const Q=t=>de.get(t);function W(t,e,{blocked:n,upgrade:r,blocking:s,terminated:i}={}){const a=indexedDB.open(t,e),o=b(a);return r&&a.addEventListener("upgradeneeded",l=>{r(b(a.result),l.oldVersion,l.newVersion,b(a.transaction),l)}),n&&a.addEventListener("blocked",l=>n(l.oldVersion,l.newVersion,l)),o.then(l=>{i&&l.addEventListener("close",()=>i()),s&&l.addEventListener("versionchange",c=>s(c.oldVersion,c.newVersion,c))}).catch(()=>{}),o}function X(t,{blocked:e}={}){const n=indexedDB.deleteDatabase(t);return e&&n.addEventListener("blocked",r=>e(r.oldVersion,r)),b(n).then(()=>{})}const Ln=["get","getKey","getAll","getAllKeys","count"],Bn=["put","add","delete","clear"],Z=new Map;function Ne(t,e){if(!(t instanceof IDBDatabase&&!(e in t)&&typeof e=="string"))return;if(Z.get(e))return Z.get(e);const n=e.replace(/FromIndex$/,""),r=e!==n,s=Bn.includes(n);if(!(n in(r?IDBIndex:IDBObjectStore).prototype)||!(s||Ln.includes(n)))return;const i=async function(a,...o){const l=this.transaction(a,s?"readwrite":"readonly");let c=l.store;return r&&(c=c.index(o.shift())),(await Promise.all([c[n](...o),s&&l.done]))[0]};return Z.set(e,i),i}On(t=>({...t,get:(e,n,r)=>Ne(e,n)||t.get(e,n,r),has:(e,n)=>!!Ne(e,n)||t.has(e,n)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Un{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(n=>{if($n(n)){const r=n.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(n=>n).join(" ")}}function $n(t){const e=t.getComponent();return(e==null?void 0:e.type)==="VERSION"}const le="@firebase/app",Oe="0.14.10";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const w=new Rn("@firebase/app"),xn="@firebase/app-compat",Fn="@firebase/analytics-compat",Hn="@firebase/analytics",Kn="@firebase/app-check-compat",jn="@firebase/app-check",Vn="@firebase/auth",Wn="@firebase/auth-compat",qn="@firebase/database",zn="@firebase/data-connect",Gn="@firebase/database-compat",Jn="@firebase/functions",Yn="@firebase/functions-compat",Qn="@firebase/installations",Xn="@firebase/installations-compat",Zn="@firebase/messaging",er="@firebase/messaging-compat",tr="@firebase/performance",nr="@firebase/performance-compat",rr="@firebase/remote-config",sr="@firebase/remote-config-compat",ir="@firebase/storage",ar="@firebase/storage-compat",or="@firebase/firestore",cr="@firebase/ai",lr="@firebase/firestore-compat",ur="firebase";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ue="[DEFAULT]",hr={[le]:"fire-core",[xn]:"fire-core-compat",[Hn]:"fire-analytics",[Fn]:"fire-analytics-compat",[jn]:"fire-app-check",[Kn]:"fire-app-check-compat",[Vn]:"fire-auth",[Wn]:"fire-auth-compat",[qn]:"fire-rtdb",[zn]:"fire-data-connect",[Gn]:"fire-rtdb-compat",[Jn]:"fire-fn",[Yn]:"fire-fn-compat",[Qn]:"fire-iid",[Xn]:"fire-iid-compat",[Zn]:"fire-fcm",[er]:"fire-fcm-compat",[tr]:"fire-perf",[nr]:"fire-perf-compat",[rr]:"fire-rc",[sr]:"fire-rc-compat",[ir]:"fire-gcs",[ar]:"fire-gcs-compat",[or]:"fire-fst",[lr]:"fire-fst-compat",[cr]:"fire-vertex","fire-js":"fire-js",[ur]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const x=new Map,fr=new Map,he=new Map;function Me(t,e){try{t.container.addComponent(e)}catch(n){w.debug(`Component ${e.name} failed to register with FirebaseApp ${t.name}`,n)}}function v(t){const e=t.name;if(he.has(e))return w.debug(`There were multiple attempts to register component ${e}.`),!1;he.set(e,t);for(const n of x.values())Me(n,t);for(const n of fr.values())Me(n,t);return!0}function pe(t,e){const n=t.container.getProvider("heartbeat").getImmediate({optional:!0});return n&&n.triggerHeartbeat(),t.container.getProvider(e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dr={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},I=new V("app","Firebase",dr);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pr{constructor(e,n,r){this._isDeleted=!1,this._options={...e},this._config={...n},this._name=n.name,this._automaticDataCollectionEnabled=n.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new T("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw I.create("app-deleted",{appName:this._name})}}function Ze(t,e={}){let n=t;typeof e!="object"&&(e={name:e});const r={name:ue,automaticDataCollectionEnabled:!0,...e},s=r.name;if(typeof s!="string"||!s)throw I.create("bad-app-name",{appName:String(s)});if(n||(n=ze()),!n)throw I.create("no-options");const i=x.get(s);if(i){if(ae(n,i.options)&&ae(r,i.config))return i;throw I.create("duplicate-app",{appName:s})}const a=new In(s);for(const l of he.values())a.addComponent(l);const o=new pr(n,r,a);return x.set(s,o),o}function gr(t=ue){const e=x.get(t);if(!e&&t===ue&&ze())return Ze();if(!e)throw I.create("no-app",{appName:t});return e}function D(t,e,n){let r=hr[t]??t;n&&(r+=`-${n}`);const s=r.match(/\s|\//),i=e.match(/\s|\//);if(s||i){const a=[`Unable to register library "${r}" with version "${e}":`];s&&a.push(`library name "${r}" contains illegal characters (whitespace or "/")`),s&&i&&a.push("and"),i&&a.push(`version name "${e}" contains illegal characters (whitespace or "/")`),w.warn(a.join(" "));return}v(new T(`${r}-version`,()=>({library:r,version:e}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const mr="firebase-heartbeat-database",br=1,L="firebase-heartbeat-store";let ee=null;function et(){return ee||(ee=W(mr,br,{upgrade:(t,e)=>{switch(e){case 0:try{t.createObjectStore(L)}catch(n){console.warn(n)}}}}).catch(t=>{throw I.create("idb-open",{originalErrorMessage:t.message})})),ee}async function wr(t){try{const n=(await et()).transaction(L),r=await n.objectStore(L).get(tt(t));return await n.done,r}catch(e){if(e instanceof N)w.warn(e.message);else{const n=I.create("idb-get",{originalErrorMessage:e==null?void 0:e.message});w.warn(n.message)}}}async function Pe(t,e){try{const r=(await et()).transaction(L,"readwrite");await r.objectStore(L).put(e,tt(t)),await r.done}catch(n){if(n instanceof N)w.warn(n.message);else{const r=I.create("idb-set",{originalErrorMessage:n==null?void 0:n.message});w.warn(r.message)}}}function tt(t){return`${t.name}!${t.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yr=1024,_r=30;class Ir{constructor(e){this.container=e,this._heartbeatsCache=null;const n=this.container.getProvider("app").getImmediate();this._storage=new Cr(n),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var e,n;try{const s=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),i=Le();if(((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((n=this._heartbeatsCache)==null?void 0:n.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===i||this._heartbeatsCache.heartbeats.some(a=>a.date===i))return;if(this._heartbeatsCache.heartbeats.push({date:i,agent:s}),this._heartbeatsCache.heartbeats.length>_r){const a=Sr(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(a,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(r){w.warn(r)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const n=Le(),{heartbeatsToSend:r,unsentEntries:s}=Er(this._heartbeatsCache.heartbeats),i=qe(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=n,s.length>0?(this._heartbeatsCache.heartbeats=s,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),i}catch(n){return w.warn(n),""}}}function Le(){return new Date().toISOString().substring(0,10)}function Er(t,e=yr){const n=[];let r=t.slice();for(const s of t){const i=n.find(a=>a.agent===s.agent);if(i){if(i.dates.push(s.date),Be(n)>e){i.dates.pop();break}}else if(n.push({agent:s.agent,dates:[s.date]}),Be(n)>e){n.pop();break}r=r.slice(1)}return{heartbeatsToSend:n,unsentEntries:r}}class Cr{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Ge()?Je().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const n=await wr(this.app);return n!=null&&n.heartbeats?n:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return Pe(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return Pe(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...e.heartbeats]})}else return}}function Be(t){return qe(JSON.stringify({version:2,heartbeats:t})).length}function Sr(t){if(t.length===0)return-1;let e=0,n=t[0].date;for(let r=1;r<t.length;r++)t[r].date<n&&(n=t[r].date,e=r);return e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Tr(t){v(new T("platform-logger",e=>new Un(e),"PRIVATE")),v(new T("heartbeat",e=>new Ir(e),"PRIVATE")),D(le,Oe,t),D(le,Oe,"esm2020"),D("fire-js","")}Tr("");var Rr="firebase",Ar="12.11.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */D(Rr,Ar,"app");const nt="@firebase/installations",ge="0.6.21";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const rt=1e4,st=`w:${ge}`,it="FIS_v2",kr="https://firebaseinstallations.googleapis.com/v1",Dr=60*60*1e3,vr="installations",Nr="Installations";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Or={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},R=new V(vr,Nr,Or);function at(t){return t instanceof N&&t.code.includes("request-failed")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ot({projectId:t}){return`${kr}/projects/${t}/installations`}function ct(t){return{token:t.token,requestStatus:2,expiresIn:Pr(t.expiresIn),creationTime:Date.now()}}async function lt(t,e){const r=(await e.json()).error;return R.create("request-failed",{requestName:t,serverCode:r.code,serverMessage:r.message,serverStatus:r.status})}function ut({apiKey:t}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":t})}function Mr(t,{refreshToken:e}){const n=ut(t);return n.append("Authorization",Lr(e)),n}async function ht(t){const e=await t();return e.status>=500&&e.status<600?t():e}function Pr(t){return Number(t.replace("s","000"))}function Lr(t){return`${it} ${t}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Br({appConfig:t,heartbeatServiceProvider:e},{fid:n}){const r=ot(t),s=ut(t),i=e.getImmediate({optional:!0});if(i){const c=await i.getHeartbeatsHeader();c&&s.append("x-firebase-client",c)}const a={fid:n,authVersion:it,appId:t.appId,sdkVersion:st},o={method:"POST",headers:s,body:JSON.stringify(a)},l=await ht(()=>fetch(r,o));if(l.ok){const c=await l.json();return{fid:c.fid||n,registrationStatus:2,refreshToken:c.refreshToken,authToken:ct(c.authToken)}}else throw await lt("Create Installation",l)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ft(t){return new Promise(e=>{setTimeout(e,t)})}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ur(t){return btoa(String.fromCharCode(...t)).replace(/\+/g,"-").replace(/\//g,"_")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $r=/^[cdef][\w-]{21}$/,fe="";function xr(){try{const t=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(t),t[0]=112+t[0]%16;const n=Fr(t);return $r.test(n)?n:fe}catch{return fe}}function Fr(t){return Ur(t).substr(0,22)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function q(t){return`${t.appName}!${t.appId}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dt=new Map;function pt(t,e){const n=q(t);gt(n,e),Hr(n,e)}function gt(t,e){const n=dt.get(t);if(n)for(const r of n)r(e)}function Hr(t,e){const n=Kr();n&&n.postMessage({key:t,fid:e}),jr()}let S=null;function Kr(){return!S&&"BroadcastChannel"in self&&(S=new BroadcastChannel("[Firebase] FID Change"),S.onmessage=t=>{gt(t.data.key,t.data.fid)}),S}function jr(){dt.size===0&&S&&(S.close(),S=null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Vr="firebase-installations-database",Wr=1,A="firebase-installations-store";let te=null;function me(){return te||(te=W(Vr,Wr,{upgrade:(t,e)=>{switch(e){case 0:t.createObjectStore(A)}}})),te}async function F(t,e){const n=q(t),s=(await me()).transaction(A,"readwrite"),i=s.objectStore(A),a=await i.get(n);return await i.put(e,n),await s.done,(!a||a.fid!==e.fid)&&pt(t,e.fid),e}async function mt(t){const e=q(t),r=(await me()).transaction(A,"readwrite");await r.objectStore(A).delete(e),await r.done}async function z(t,e){const n=q(t),s=(await me()).transaction(A,"readwrite"),i=s.objectStore(A),a=await i.get(n),o=e(a);return o===void 0?await i.delete(n):await i.put(o,n),await s.done,o&&(!a||a.fid!==o.fid)&&pt(t,o.fid),o}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function be(t){let e;const n=await z(t.appConfig,r=>{const s=qr(r),i=zr(t,s);return e=i.registrationPromise,i.installationEntry});return n.fid===fe?{installationEntry:await e}:{installationEntry:n,registrationPromise:e}}function qr(t){const e=t||{fid:xr(),registrationStatus:0};return bt(e)}function zr(t,e){if(e.registrationStatus===0){if(!navigator.onLine){const s=Promise.reject(R.create("app-offline"));return{installationEntry:e,registrationPromise:s}}const n={fid:e.fid,registrationStatus:1,registrationTime:Date.now()},r=Gr(t,n);return{installationEntry:n,registrationPromise:r}}else return e.registrationStatus===1?{installationEntry:e,registrationPromise:Jr(t)}:{installationEntry:e}}async function Gr(t,e){try{const n=await Br(t,e);return F(t.appConfig,n)}catch(n){throw at(n)&&n.customData.serverCode===409?await mt(t.appConfig):await F(t.appConfig,{fid:e.fid,registrationStatus:0}),n}}async function Jr(t){let e=await Ue(t.appConfig);for(;e.registrationStatus===1;)await ft(100),e=await Ue(t.appConfig);if(e.registrationStatus===0){const{installationEntry:n,registrationPromise:r}=await be(t);return r||n}return e}function Ue(t){return z(t,e=>{if(!e)throw R.create("installation-not-found");return bt(e)})}function bt(t){return Yr(t)?{fid:t.fid,registrationStatus:0}:t}function Yr(t){return t.registrationStatus===1&&t.registrationTime+rt<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Qr({appConfig:t,heartbeatServiceProvider:e},n){const r=Xr(t,n),s=Mr(t,n),i=e.getImmediate({optional:!0});if(i){const c=await i.getHeartbeatsHeader();c&&s.append("x-firebase-client",c)}const a={installation:{sdkVersion:st,appId:t.appId}},o={method:"POST",headers:s,body:JSON.stringify(a)},l=await ht(()=>fetch(r,o));if(l.ok){const c=await l.json();return ct(c)}else throw await lt("Generate Auth Token",l)}function Xr(t,{fid:e}){return`${ot(t)}/${e}/authTokens:generate`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function we(t,e=!1){let n;const r=await z(t.appConfig,i=>{if(!wt(i))throw R.create("not-registered");const a=i.authToken;if(!e&&ts(a))return i;if(a.requestStatus===1)return n=Zr(t,e),i;{if(!navigator.onLine)throw R.create("app-offline");const o=rs(i);return n=es(t,o),o}});return n?await n:r.authToken}async function Zr(t,e){let n=await $e(t.appConfig);for(;n.authToken.requestStatus===1;)await ft(100),n=await $e(t.appConfig);const r=n.authToken;return r.requestStatus===0?we(t,e):r}function $e(t){return z(t,e=>{if(!wt(e))throw R.create("not-registered");const n=e.authToken;return ss(n)?{...e,authToken:{requestStatus:0}}:e})}async function es(t,e){try{const n=await Qr(t,e),r={...e,authToken:n};return await F(t.appConfig,r),n}catch(n){if(at(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await mt(t.appConfig);else{const r={...e,authToken:{requestStatus:0}};await F(t.appConfig,r)}throw n}}function wt(t){return t!==void 0&&t.registrationStatus===2}function ts(t){return t.requestStatus===2&&!ns(t)}function ns(t){const e=Date.now();return e<t.creationTime||t.creationTime+t.expiresIn<e+Dr}function rs(t){const e={requestStatus:1,requestTime:Date.now()};return{...t,authToken:e}}function ss(t){return t.requestStatus===1&&t.requestTime+rt<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function is(t){const e=t,{installationEntry:n,registrationPromise:r}=await be(e);return r?r.catch(console.error):we(e).catch(console.error),n.fid}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function as(t,e=!1){const n=t;return await os(n),(await we(n,e)).token}async function os(t){const{registrationPromise:e}=await be(t);e&&await e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function cs(t){if(!t||!t.options)throw ne("App Configuration");if(!t.name)throw ne("App Name");const e=["projectId","apiKey","appId"];for(const n of e)if(!t.options[n])throw ne(n);return{appName:t.name,projectId:t.options.projectId,apiKey:t.options.apiKey,appId:t.options.appId}}function ne(t){return R.create("missing-app-config-values",{valueName:t})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yt="installations",ls="installations-internal",us=t=>{const e=t.getProvider("app").getImmediate(),n=cs(e),r=pe(e,"heartbeat");return{app:e,appConfig:n,heartbeatServiceProvider:r,_delete:()=>Promise.resolve()}},hs=t=>{const e=t.getProvider("app").getImmediate(),n=pe(e,yt).getImmediate();return{getId:()=>is(n),getToken:s=>as(n,s)}};function fs(){v(new T(yt,us,"PUBLIC")),v(new T(ls,hs,"PRIVATE"))}fs();D(nt,ge);D(nt,ge,"esm2020");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const _t="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",ds="https://fcmregistrations.googleapis.com/v1",It="FCM_MSG",ps="google.c.a.c_id",gs=3,ms=1;var H;(function(t){t[t.DATA_MESSAGE=1]="DATA_MESSAGE",t[t.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(H||(H={}));/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */var K;(function(t){t.PUSH_RECEIVED="push-received",t.NOTIFICATION_CLICKED="notification-clicked"})(K||(K={}));/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function g(t){const e=new Uint8Array(t);return btoa(String.fromCharCode(...e)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function bs(t){const e="=".repeat((4-t.length%4)%4),n=(t+e).replace(/\-/g,"+").replace(/_/g,"/"),r=atob(n),s=new Uint8Array(r.length);for(let i=0;i<r.length;++i)s[i]=r.charCodeAt(i);return s}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const re="fcm_token_details_db",ws=5,xe="fcm_token_object_Store";async function ys(t){if("databases"in indexedDB&&!(await indexedDB.databases()).map(i=>i.name).includes(re))return null;let e=null;return(await W(re,ws,{upgrade:async(r,s,i,a)=>{if(s<2||!r.objectStoreNames.contains(xe))return;const o=a.objectStore(xe),l=await o.index("fcmSenderId").get(t);if(await o.clear(),!!l){if(s===2){const c=l;if(!c.auth||!c.p256dh||!c.endpoint)return;e={token:c.fcmToken,createTime:c.createTime??Date.now(),subscriptionOptions:{auth:c.auth,p256dh:c.p256dh,endpoint:c.endpoint,swScope:c.swScope,vapidKey:typeof c.vapidKey=="string"?c.vapidKey:g(c.vapidKey)}}}else if(s===3){const c=l;e={token:c.fcmToken,createTime:c.createTime,subscriptionOptions:{auth:g(c.auth),p256dh:g(c.p256dh),endpoint:c.endpoint,swScope:c.swScope,vapidKey:g(c.vapidKey)}}}else if(s===4){const c=l;e={token:c.fcmToken,createTime:c.createTime,subscriptionOptions:{auth:g(c.auth),p256dh:g(c.p256dh),endpoint:c.endpoint,swScope:c.swScope,vapidKey:g(c.vapidKey)}}}}}})).close(),await X(re),await X("fcm_vapid_details_db"),await X("undefined"),_s(e)?e:null}function _s(t){if(!t||!t.subscriptionOptions)return!1;const{subscriptionOptions:e}=t;return typeof t.createTime=="number"&&t.createTime>0&&typeof t.token=="string"&&t.token.length>0&&typeof e.auth=="string"&&e.auth.length>0&&typeof e.p256dh=="string"&&e.p256dh.length>0&&typeof e.endpoint=="string"&&e.endpoint.length>0&&typeof e.swScope=="string"&&e.swScope.length>0&&typeof e.vapidKey=="string"&&e.vapidKey.length>0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Is="firebase-messaging-database",Es=1,k="firebase-messaging-store";let se=null;function ye(){return se||(se=W(Is,Es,{upgrade:(t,e)=>{switch(e){case 0:t.createObjectStore(k)}}})),se}async function _e(t){const e=Ee(t),r=await(await ye()).transaction(k).objectStore(k).get(e);if(r)return r;{const s=await ys(t.appConfig.senderId);if(s)return await Ie(t,s),s}}async function Ie(t,e){const n=Ee(t),s=(await ye()).transaction(k,"readwrite");return await s.objectStore(k).put(e,n),await s.done,e}async function Cs(t){const e=Ee(t),r=(await ye()).transaction(k,"readwrite");await r.objectStore(k).delete(e),await r.done}function Ee({appConfig:t}){return t.appId}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ss={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used."},d=new V("messaging","Messaging",Ss);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ts(t,e){const n=await Se(t),r=Ct(e),s={method:"POST",headers:n,body:JSON.stringify(r)};let i;try{i=await(await fetch(Ce(t.appConfig),s)).json()}catch(a){throw d.create("token-subscribe-failed",{errorInfo:a==null?void 0:a.toString()})}if(i.error){const a=i.error.message;throw d.create("token-subscribe-failed",{errorInfo:a})}if(!i.token)throw d.create("token-subscribe-no-token");return i.token}async function Rs(t,e){const n=await Se(t),r=Ct(e.subscriptionOptions),s={method:"PATCH",headers:n,body:JSON.stringify(r)};let i;try{i=await(await fetch(`${Ce(t.appConfig)}/${e.token}`,s)).json()}catch(a){throw d.create("token-update-failed",{errorInfo:a==null?void 0:a.toString()})}if(i.error){const a=i.error.message;throw d.create("token-update-failed",{errorInfo:a})}if(!i.token)throw d.create("token-update-no-token");return i.token}async function Et(t,e){const r={method:"DELETE",headers:await Se(t)};try{const i=await(await fetch(`${Ce(t.appConfig)}/${e}`,r)).json();if(i.error){const a=i.error.message;throw d.create("token-unsubscribe-failed",{errorInfo:a})}}catch(s){throw d.create("token-unsubscribe-failed",{errorInfo:s==null?void 0:s.toString()})}}function Ce({projectId:t}){return`${ds}/projects/${t}/registrations`}async function Se({appConfig:t,installations:e}){const n=await e.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":t.apiKey,"x-goog-firebase-installations-auth":`FIS ${n}`})}function Ct({p256dh:t,auth:e,endpoint:n,vapidKey:r}){const s={web:{endpoint:n,auth:e,p256dh:t}};return r!==_t&&(s.web.applicationPubKey=r),s}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const As=7*24*60*60*1e3;async function ks(t){const e=await vs(t.swRegistration,t.vapidKey),n={vapidKey:t.vapidKey,swScope:t.swRegistration.scope,endpoint:e.endpoint,auth:g(e.getKey("auth")),p256dh:g(e.getKey("p256dh"))},r=await _e(t.firebaseDependencies);if(r){if(Ns(r.subscriptionOptions,n))return Date.now()>=r.createTime+As?Ds(t,{token:r.token,createTime:Date.now(),subscriptionOptions:n}):r.token;try{await Et(t.firebaseDependencies,r.token)}catch(s){console.warn(s)}return He(t.firebaseDependencies,n)}else return He(t.firebaseDependencies,n)}async function Fe(t){const e=await _e(t.firebaseDependencies);e&&(await Et(t.firebaseDependencies,e.token),await Cs(t.firebaseDependencies));const n=await t.swRegistration.pushManager.getSubscription();return n?n.unsubscribe():!0}async function Ds(t,e){try{const n=await Rs(t.firebaseDependencies,e),r={...e,token:n,createTime:Date.now()};return await Ie(t.firebaseDependencies,r),n}catch(n){throw n}}async function He(t,e){const r={token:await Ts(t,e),createTime:Date.now(),subscriptionOptions:e};return await Ie(t,r),r.token}async function vs(t,e){const n=await t.pushManager.getSubscription();return n||t.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:bs(e)})}function Ns(t,e){const n=e.vapidKey===t.vapidKey,r=e.endpoint===t.endpoint,s=e.auth===t.auth,i=e.p256dh===t.p256dh;return n&&r&&s&&i}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Os(t){const e={from:t.from,collapseKey:t.collapse_key,messageId:t.fcmMessageId};return Ms(e,t),Ps(e,t),Ls(e,t),e}function Ms(t,e){if(!e.notification)return;t.notification={};const n=e.notification.title;n&&(t.notification.title=n);const r=e.notification.body;r&&(t.notification.body=r);const s=e.notification.image;s&&(t.notification.image=s);const i=e.notification.icon;i&&(t.notification.icon=i)}function Ps(t,e){e.data&&(t.data=e.data)}function Ls(t,e){var s,i,a,o;if(!e.fcmOptions&&!((s=e.notification)!=null&&s.click_action))return;t.fcmOptions={};const n=((i=e.fcmOptions)==null?void 0:i.link)??((a=e.notification)==null?void 0:a.click_action);n&&(t.fcmOptions.link=n);const r=(o=e.fcmOptions)==null?void 0:o.analytics_label;r&&(t.fcmOptions.analyticsLabel=r)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Bs(t){return typeof t=="object"&&!!t&&ps in t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Us(t){return new Promise(e=>{setTimeout(e,t)})}async function $s(t,e){const n=xs(e,await t.firebaseDependencies.installations.getId());Fs(t,n,e.productId)}function xs(t,e){var r,s;const n={};return t.from&&(n.project_number=t.from),t.fcmMessageId&&(n.message_id=t.fcmMessageId),n.instance_id=e,t.notification?n.message_type=H.DISPLAY_NOTIFICATION.toString():n.message_type=H.DATA_MESSAGE.toString(),n.sdk_platform=gs.toString(),n.package_name=self.origin.replace(/(^\w+:|^)\/\//,""),t.collapse_key&&(n.collapse_key=t.collapse_key),n.event=ms.toString(),(r=t.fcmOptions)!=null&&r.analytics_label&&(n.analytics_label=(s=t.fcmOptions)==null?void 0:s.analytics_label),n}function Fs(t,e,n){const r={};r.event_time_ms=Math.floor(Date.now()).toString(),r.source_extension_json_proto3=JSON.stringify({messaging_client_event:e}),n&&(r.compliance_data=Hs(n)),t.logEvents.push(r)}function Hs(t){return{privacy_context:{prequest:{origin_associated_product_id:t}}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ks(t,e){var s;const{newSubscription:n}=t;if(!n){await Fe(e);return}const r=await _e(e.firebaseDependencies);await Fe(e),e.vapidKey=((s=r==null?void 0:r.subscriptionOptions)==null?void 0:s.vapidKey)??_t,await ks(e)}async function js(t,e){const n=qs(t);if(!n)return;e.deliveryMetricsExportedToBigQueryEnabled&&await $s(e,n);const r=await St();if(Gs(r))return Js(r,n);if(n.notification&&await Ys(Ws(n)),!!e&&e.onBackgroundMessageHandler){const s=Os(n);typeof e.onBackgroundMessageHandler=="function"?await e.onBackgroundMessageHandler(s):e.onBackgroundMessageHandler.next(s)}}async function Vs(t){var a,o;const e=(o=(a=t.notification)==null?void 0:a.data)==null?void 0:o[It];if(e){if(t.action)return}else return;t.stopImmediatePropagation(),t.notification.close();const n=Qs(e);if(!n)return;const r=new URL(n,self.location.href),s=new URL(self.location.origin);if(r.host!==s.host)return;let i=await zs(r);if(i?i=await i.focus():(i=await self.clients.openWindow(n),await Us(3e3)),!!i)return e.messageType=K.NOTIFICATION_CLICKED,e.isFirebaseMessaging=!0,i.postMessage(e)}function Ws(t){const e={...t.notification};return e.data={[It]:t},e}function qs({data:t}){if(!t)return null;try{return t.json()}catch{return null}}async function zs(t){const e=await St();for(const n of e){const r=new URL(n.url,self.location.href);if(t.host===r.host)return n}return null}function Gs(t){return t.some(e=>e.visibilityState==="visible"&&!e.url.startsWith("chrome-extension://"))}function Js(t,e){e.isFirebaseMessaging=!0,e.messageType=K.PUSH_RECEIVED;for(const n of t)n.postMessage(e)}function St(){return self.clients.matchAll({type:"window",includeUncontrolled:!0})}function Ys(t){const{actions:e}=t,{maxActions:n}=Notification;return e&&n&&e.length>n&&console.warn(`This browser only supports ${n} actions. The remaining actions will not be displayed.`),self.registration.showNotification(t.title??"",t)}function Qs(t){var n,r;const e=((n=t.fcmOptions)==null?void 0:n.link)??((r=t.notification)==null?void 0:r.click_action);return e||(Bs(t.data)?self.location.origin:null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xs(t){if(!t||!t.options)throw ie("App Configuration Object");if(!t.name)throw ie("App Name");const e=["projectId","apiKey","appId","messagingSenderId"],{options:n}=t;for(const r of e)if(!n[r])throw ie(r);return{appName:t.name,projectId:n.projectId,apiKey:n.apiKey,appId:n.appId,senderId:n.messagingSenderId}}function ie(t){return d.create("missing-app-config-values",{valueName:t})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zs{constructor(e,n,r){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.logEvents=[],this.isLogServiceStarted=!1;const s=Xs(e);this.firebaseDependencies={app:e,appConfig:s,installations:n,analyticsProvider:r}}_delete(){return Promise.resolve()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ei=t=>{const e=new Zs(t.getProvider("app").getImmediate(),t.getProvider("installations-internal").getImmediate(),t.getProvider("analytics-internal"));return self.addEventListener("push",n=>{n.waitUntil(js(n,e))}),self.addEventListener("pushsubscriptionchange",n=>{n.waitUntil(Ks(n,e))}),self.addEventListener("notificationclick",n=>{n.waitUntil(Vs(n))}),e};function ti(){v(new T("messaging-sw",ei,"PUBLIC"))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ni(){return Ge()&&await Je()&&"PushManager"in self&&"Notification"in self&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ri(t,e){if(self.document!==void 0)throw d.create("only-available-in-sw");return t.onBackgroundMessageHandler=e,()=>{t.onBackgroundMessageHandler=null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function si(t=gr()){return ni().then(e=>{if(!e)throw d.create("unsupported-browser")},e=>{throw d.create("indexed-db-unsupported")}),pe(Ye(t),"messaging-sw").getImmediate()}function ii(t,e){return t=Ye(t),ri(t,e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */ti();en();nn([{"revision":"44aeb1815e14d1dc8527bbc8d23808f9","url":"registerSW.js"},{"revision":"cc6e78e1638ebf2b76a74ad230e32597","url":"index.html"},{"revision":"73688b5b832beb8e90a9cb100920061e","url":"404.html"},{"revision":null,"url":"assets/zod-ScW6sX9E.js"},{"revision":null,"url":"assets/vendor-utils-nviLaDDJ.js"},{"revision":null,"url":"assets/vendor-ui-DbnhtFAj.js"},{"revision":null,"url":"assets/vendor-react-DrKgErkG.js"},{"revision":null,"url":"assets/useProfile-DfVeWLC1.js"},{"revision":null,"url":"assets/useOverlay-B_xpqbxN.js"},{"revision":null,"url":"assets/useDocumentTitle-CT5sFDEm.css"},{"revision":null,"url":"assets/useDocumentTitle-B-5FWrW2.js"},{"revision":null,"url":"assets/useCopilotStore-DCgdrvaT.js"},{"revision":null,"url":"assets/useAuthProduct-Ochlb-8q.js"},{"revision":null,"url":"assets/useAuth-BxDjmDWV.js"},{"revision":null,"url":"assets/tiny-invariant-CH88cG8v.js"},{"revision":null,"url":"assets/talentPool-DHzA5ia_.js"},{"revision":null,"url":"assets/superAdmin-C7cB9ivj.js"},{"revision":null,"url":"assets/scorecards-BpdJiqRR.js"},{"revision":null,"url":"assets/preScreening-Psuwj_1i.js"},{"revision":null,"url":"assets/portal-BFMIM1yc.js"},{"revision":null,"url":"assets/notifications-Cwwl2Uyz.js"},{"revision":null,"url":"assets/notificationStore-D-nLLxWq.js"},{"revision":null,"url":"assets/messages-BRrSiTou.js"},{"revision":null,"url":"assets/messageStore-BaGxhavB.js"},{"revision":null,"url":"assets/jobs-1JRnjUvG.js"},{"revision":null,"url":"assets/interviews-B_NBvsr5.js"},{"revision":null,"url":"assets/interviewStore-BEYBYMHK.js"},{"revision":null,"url":"assets/index-Daqzxp87.js"},{"revision":null,"url":"assets/index-BUxud-Fa.css"},{"revision":null,"url":"assets/grouping-B8VvCJI3.js"},{"revision":null,"url":"assets/formatters-C0XtSNha.js"},{"revision":null,"url":"assets/firebase-DSeLpJwj.js"},{"revision":null,"url":"assets/dnd.esm-DuahFvRg.js"},{"revision":null,"url":"assets/cropImage-BgwchM1E.js"},{"revision":null,"url":"assets/chartTheme-bqTqH0E_.js"},{"revision":null,"url":"assets/candidates-qOR55C7s.js"},{"revision":null,"url":"assets/axios-okluCbaC.js"},{"revision":null,"url":"assets/auth-LAT5WpTU.js"},{"revision":null,"url":"assets/applications-Wzhcuz2b.js"},{"revision":null,"url":"assets/analytics-DfpOy1N5.js"},{"revision":null,"url":"assets/ai--PEsZhom.js"},{"revision":null,"url":"assets/admin-xhGDGI82.js"},{"revision":null,"url":"assets/activities-COEy53oB.js"},{"revision":null,"url":"assets/UsersPage-BZc_Ob6M.js"},{"revision":null,"url":"assets/UploadResumePage-AqhySIkn.js"},{"revision":null,"url":"assets/Toolbar-Cuu8zuDC.js"},{"revision":null,"url":"assets/TeamManagementPage-CdIHP-oT.js"},{"revision":null,"url":"assets/TalentPoolPage-Dy4ou5m3.js"},{"revision":null,"url":"assets/TagInput-DA5qb5_o.js"},{"revision":null,"url":"assets/Tabs-Ce6-A4sB.js"},{"revision":null,"url":"assets/Switch-BM8MT-bh.js"},{"revision":null,"url":"assets/SuperAdminRoutes-8OdJ5z1j.js"},{"revision":null,"url":"assets/StatusPill-DFVefYBO.js"},{"revision":null,"url":"assets/StatCard-D6kX6gCQ.js"},{"revision":null,"url":"assets/SplitHeading-CubFxg62.js"},{"revision":null,"url":"assets/SolutionsPage-hGcjZIne.js"},{"revision":null,"url":"assets/SiteView-Hl7LHFLW.js"},{"revision":null,"url":"assets/SettingsPage-CtYQAGXF.js"},{"revision":null,"url":"assets/SettingsDrawer-BqoOvHIC.js"},{"revision":null,"url":"assets/ServicesPage-DWKaZmbt.js"},{"revision":null,"url":"assets/SecurityPage-BEO_0fxx.js"},{"revision":null,"url":"assets/ScorecardPage-1f5FzsXQ.js"},{"revision":null,"url":"assets/ScorecardHubPage-ziHy3JFl.js"},{"revision":null,"url":"assets/ScoreRing-CRXwUZ6O.js"},{"revision":null,"url":"assets/ReportsPage-BAJgBVhn.js"},{"revision":null,"url":"assets/RecruiterSettingsPage-CUaSuhan.js"},{"revision":null,"url":"assets/RecruiterRoutes-BpGALFhG.js"},{"revision":null,"url":"assets/RecruiterProfilePage-Dm4Spf4e.js"},{"revision":null,"url":"assets/RecentActivityFeed-CAal8VR7.js"},{"revision":null,"url":"assets/ProfileFormCard-DBTa-XS7.js"},{"revision":null,"url":"assets/ProductsPage-DC8JI1uv.js"},{"revision":null,"url":"assets/PrivacyPage-DPIKP504.js"},{"revision":null,"url":"assets/PrepKitPage-C9nrJh3E.js"},{"revision":null,"url":"assets/PrepKitHubPage-BXJknkAF.js"},{"revision":null,"url":"assets/PreScreeningSessionView-DtlmA0kT.js"},{"revision":null,"url":"assets/PreScreeningReviewPage-CuPR8cyI.js"},{"revision":null,"url":"assets/PreScreeningPage-CUb8b4bp.js"},{"revision":null,"url":"assets/PortalShell-CK6sAojo.js"},{"revision":null,"url":"assets/PortalSettingsPage-BB6ziL84.js"},{"revision":null,"url":"assets/PortalRoutes-DxkJ3dSY.js"},{"revision":null,"url":"assets/PortalProfilePage-BwA7nXcF.js"},{"revision":null,"url":"assets/PortalPrepHub-nJd7FUq1.js"},{"revision":null,"url":"assets/PortalOpenings-DazGYkKc.js"},{"revision":null,"url":"assets/PortalOffersPage-DoxW4WRg.js"},{"revision":null,"url":"assets/PortalNotifications-CrQxcMxL.js"},{"revision":null,"url":"assets/PortalInterviewsPage-BuEQ0xVf.js"},{"revision":null,"url":"assets/PortalDashboard-47-61Mpr.js"},{"revision":null,"url":"assets/PortalApplicationsPage-BKBKavNO.js"},{"revision":null,"url":"assets/PlatformPage-CoWc0eCr.js"},{"revision":null,"url":"assets/PipelinePage-7cC33TZa.js"},{"revision":null,"url":"assets/Parallax-wWnwllfb.js"},{"revision":null,"url":"assets/Pagination-BwF36j6V.js"},{"revision":null,"url":"assets/PageHeader-CFeVX_5e.js"},{"revision":null,"url":"assets/OverviewPage-0pUB9k03.js"},{"revision":null,"url":"assets/OpenAIResponsesDemo-gfXJkJhu.js"},{"revision":null,"url":"assets/OnboardingPage-BbjxQusC.js"},{"revision":null,"url":"assets/OffersPage-CHqaaiBZ.js"},{"revision":null,"url":"assets/NotificationBell-CK3zohoV.js"},{"revision":null,"url":"assets/MyInterviewsPage-D67z8RaT.js"},{"revision":null,"url":"assets/Meter-CQ5RobiL.js"},{"revision":null,"url":"assets/MessageInbox-CfRjn9gf.js"},{"revision":null,"url":"assets/LiveRoomPage-B7nj7vFF.js"},{"revision":null,"url":"assets/LiveRoomHubPage-CcrkpX1W.js"},{"revision":null,"url":"assets/KeyboardShortcutsModal-BCvNy0U8.js"},{"revision":null,"url":"assets/JobsListPage-DIdar4Qz.js"},{"revision":null,"url":"assets/InterviewsListPage-CCSfV2ny.js"},{"revision":null,"url":"assets/InterviewerRoutes-BjWEt8jV.js"},{"revision":null,"url":"assets/InterviewerProfilePage-BTXGuaV-.js"},{"revision":null,"url":"assets/InterviewerDashboard-CHwRoV17.js"},{"revision":null,"url":"assets/InterviewHubPage-DI3Ygjz2.js"},{"revision":null,"url":"assets/IndustriesPage-DNeV-egt.js"},{"revision":null,"url":"assets/ImageCropperModal-B8fd5h2l.js"},{"revision":null,"url":"assets/IconTile-CmRDoUYH.js"},{"revision":null,"url":"assets/HybentVerifyEmailRoute-B49sVIXs.js"},{"revision":null,"url":"assets/HybentResetPasswordRoute-DD3eLeP3.js"},{"revision":null,"url":"assets/HybentRegisterRoute-DtuyN2ol.js"},{"revision":null,"url":"assets/HybentLoginRoute-CrLWekUs.js"},{"revision":null,"url":"assets/HybentCreatePasswordRoute-D909TEfQ.js"},{"revision":null,"url":"assets/HomePage-vtXrOxnO.js"},{"revision":null,"url":"assets/HiringHomePage-DMno_R_P.js"},{"revision":null,"url":"assets/HireTalentPage-noB5qfDs.js"},{"revision":null,"url":"assets/HealthPage-CP9rMHXs.js"},{"revision":null,"url":"assets/GlobalChatOverlay-BD_0o9Ch.js"},{"revision":null,"url":"assets/GenerateOfferModal-CBSh8yEg.js"},{"revision":null,"url":"assets/FeatureFlagsPage-CyoxX3_T.js"},{"revision":null,"url":"assets/FaqPage-BQcLlg2o.js"},{"revision":null,"url":"assets/EndSessionScreen-BSOdWk3s.js"},{"revision":null,"url":"assets/EmptyState-BnU8i-8Y.js"},{"revision":null,"url":"assets/Dropzone-Bt2-oUc0.js"},{"revision":null,"url":"assets/Dialog-CVvlCaqy.js"},{"revision":null,"url":"assets/DataTable-SEXc9KtD.js"},{"revision":null,"url":"assets/DashboardPage-Bzo5E4Jj.js"},{"revision":null,"url":"assets/CustomersPage-CNFIHRgH.js"},{"revision":null,"url":"assets/CopilotWidget-Cowc1SuN.js"},{"revision":null,"url":"assets/ConversationHistoryDrawer-DEgjgjpD.js"},{"revision":null,"url":"assets/ContextMenu-Bnst1cb4.js"},{"revision":null,"url":"assets/ContactPage-MYGIA8gw.js"},{"revision":null,"url":"assets/ClientsPage-DESknieA.js"},{"revision":null,"url":"assets/ClientDetailPage-Bmh3RQ6n.js"},{"revision":null,"url":"assets/CareersPage-CMwi3byU.js"},{"revision":null,"url":"assets/Card-0VqnFTp6.js"},{"revision":null,"url":"assets/CandidatesPage-ZXgw-AIj.js"},{"revision":null,"url":"assets/CandidateActionsPanel-CzkadQJ9.js"},{"revision":null,"url":"assets/BillingPage-CpmDSHSs.js"},{"revision":null,"url":"assets/BarChart-CsoN6vHD.js"},{"revision":null,"url":"assets/Badge-CEDsny7S.js"},{"revision":null,"url":"assets/Avatar-Des3n4ml.js"},{"revision":null,"url":"assets/AuditLogsPage-CmaL65qK.js"},{"revision":null,"url":"assets/AuditLogsPage-BiUsIkQs.js"},{"revision":null,"url":"assets/AreaChart-DTFAMHJp.js"},{"revision":null,"url":"assets/AppShell-EVkB1TbY.js"},{"revision":null,"url":"assets/AnalyticsPage-DnGxt7y_.js"},{"revision":null,"url":"assets/AnalyticsPage-BGbqsRqi.js"},{"revision":null,"url":"assets/AllTalentListPage-DYSuDk0y.js"},{"revision":null,"url":"assets/AiCapabilitiesPage-BcpeSOhC.js"},{"revision":null,"url":"assets/AdminRoutes-iHkTvlFU.js"},{"revision":null,"url":"assets/AdminProfilePage-BP0oPe4a.js"},{"revision":null,"url":"assets/AddToCalendarDropdown-B6jkNH5W.js"},{"revision":null,"url":"assets/AddJobPage-Dl0M76EI.js"},{"revision":null,"url":"assets/AboutPage-DgWTQaC_.js"},{"revision":null,"url":"assets/AICreditsPage-BmX3XlMl.js"},{"revision":"a562835e2de1c8fbd81ef44997ad1979","url":"favicon.svg"},{"revision":"2d008b9ee68cd21cfc7d667abd0db89e","url":"pwa-192x192.png"},{"revision":"493b4afc7dff65e6b1288c8fe3d53ec1","url":"pwa-512x512.png"},{"revision":"90b16cf0fcdbafd519797807fc6c5aaf","url":"manifest.json"}]);const ai={apiKey:"AIzaSyAIK4xKoyDyUr_1plCvs-pbMgHVisyQtSg",authDomain:"hybent-hiring-6e1f8.firebaseapp.com",projectId:"hybent-hiring-6e1f8",storageBucket:"hybent-hiring-6e1f8.firebasestorage.app",messagingSenderId:"277744446068",appId:"1:277744446068:web:2e55885ff0e9d137f6bf21",measurementId:"G-NJNB9B90PP"},oi=Ze(ai),ci=si(oi);ii(ci,t=>{console.log("[SW] Background message received:",t);const{title:e,body:n,icon:r}=t.notification??{};let i=(t.data??{}).sender_avatar||r;if(!i||i==="/favicon.svg"){const a=e==null?void 0:e.match(/from\s+([^💬]+)/iu),o=a?a[1].trim():"User";i=`https://ui-avatars.com/api/?name=${encodeURIComponent(o)}&background=6c47ff&color=fff&size=128`}else i.startsWith("/")&&(i=self.location.origin+i);self.registration.showNotification(e??"Hybent Hiring",{body:n??"",icon:i,badge:"/favicon.svg",data:t.data})});self.addEventListener("notificationclick",t=>{var n;t.notification.close();const e=new URL(((n=t.notification.data)==null?void 0:n.click_action)||"/",self.location.origin).href;t.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:!0}).then(r=>{for(const s of r)if(s.url===e&&"focus"in s)return s.focus();if(self.clients.openWindow)return self.clients.openWindow(e)}))});
