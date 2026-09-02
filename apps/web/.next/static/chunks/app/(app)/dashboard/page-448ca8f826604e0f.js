(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[40],{1413:function(e,t,n){Promise.resolve().then(n.bind(n,5225))},5225:function(e,t,n){"use strict";n.r(t),n.d(t,{default:function(){return p}});var a=n(7573),s=n(7653),r=n(4835),i=n(6561),c=n(6782),o=n(9565);/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let l=(0,o.Z)("TriangleAlert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);var d=n(1804),u=n(6023),h=n(276);/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let m=(0,o.Z)("Inbox",[["polyline",{points:"22 12 16 12 14 15 10 15 8 12 2 12",key:"o97t9d"}],["path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",key:"oot6mr"}]]),f=(0,o.Z)("UserCheck",[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["polyline",{points:"16 11 18 13 22 9",key:"1pwet4"}]]);var y=n(7439),x=n(6067),g=n(8230);function p(){let[e,t]=(0,s.useState)(null),[n,o]=(0,s.useState)(null);return(0,s.useEffect)(()=>{(0,x.hi)("/dashboard/summary").then(t).catch(e=>o(e.message))},[]),(0,a.jsxs)("div",{children:[(0,a.jsx)("h1",{className:"text-2xl font-semibold mb-1",children:"Dashboard"}),(0,a.jsx)("p",{className:"text-muted mb-6",children:"Vis\xe3o geral das suas inst\xe2ncias e automa\xe7\xf5es."}),n&&(0,a.jsx)("p",{className:"text-red-400 text-sm mb-4",children:n}),e?(0,a.jsxs)("div",{className:"grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-8",children:[(0,a.jsx)(g.R,{label:"Total de inst\xe2ncias",value:e.totalInstances,icon:r.Z}),(0,a.jsx)(g.R,{label:"Inst\xe2ncias conectadas",value:e.connectedInstances,icon:i.Z,accent:"bg-green-500/15 text-green-400"}),(0,a.jsx)(g.R,{label:"Inst\xe2ncias desconectadas",value:e.disconnectedInstances,icon:c.Z,accent:"bg-gray-500/15 text-gray-400"}),(0,a.jsx)(g.R,{label:"Inst\xe2ncias com erro",value:e.errorInstances,icon:l,accent:"bg-red-500/15 text-red-400"}),(0,a.jsx)(g.R,{label:"Sess\xf5es em andamento",value:e.activeSessions,icon:d.Z,accent:"bg-yellow-500/15 text-yellow-400"}),(0,a.jsx)(g.R,{label:"Sess\xf5es conclu\xeddas",value:e.completedSessions,icon:u.Z}),(0,a.jsx)(g.R,{label:"Mensagens processadas",value:e.messagesProcessed,icon:h.Z}),(0,a.jsx)(g.R,{label:"Mensagens pendentes",value:e.messagesPending,icon:m,accent:"bg-yellow-500/15 text-yellow-400"}),(0,a.jsx)(g.R,{label:"Convites enviados",value:e.invitesSent,icon:f}),(0,a.jsx)(g.R,{label:"Convites aceitos",value:e.invitesAccepted,icon:f,accent:"bg-green-500/15 text-green-400"}),(0,a.jsx)(g.R,{label:"Contatos ativos",value:e.activeContacts,icon:f}),(0,a.jsx)(g.R,{label:"Automa\xe7\xf5es ativas",value:e.activeAutomations,icon:y.Z})]}):(0,a.jsx)("p",{className:"text-muted text-sm",children:"Carregando indicadores..."}),(0,a.jsxs)("div",{className:"bg-surface border border-border rounded-xl p-6",children:[(0,a.jsx)("h2",{className:"font-medium mb-2",children:"Tempo real"}),(0,a.jsxs)("p",{className:"text-sm text-muted",children:["Os indicadores acima s\xe3o atualizados via WebSocket sempre que uma inst\xe2ncia muda de status, uma sess\xe3o avan\xe7a de etapa ou uma automa\xe7\xe3o \xe9 conclu\xedda. Conecte-se a uma inst\xe2ncia na p\xe1gina"," ",(0,a.jsx)("a",{href:"/instances",className:"text-primary hover:underline",children:"Inst\xe2ncias"})," ","para come\xe7ar."]})]})]})}},8230:function(e,t,n){"use strict";n.d(t,{R:function(){return l}});var a=n(7573),s=n(9565);/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let r=(0,s.Z)("TrendingUp",[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]]),i=(0,s.Z)("TrendingDown",[["polyline",{points:"22 17 13.5 8.5 8.5 13.5 2 7",key:"1r2t7k"}],["polyline",{points:"16 17 22 17 22 11",key:"11uiuu"}]]);var c=n(7908);let o={primary:"bg-primary/15 text-primary",success:"bg-success/15 text-success",warning:"bg-warning/15 text-warning",danger:"bg-danger/15 text-danger",info:"bg-info/15 text-info",fire:"bg-fire/15 text-fire",neutral:"bg-gray-500/15 text-gray-400"};function l(e){let{label:t,value:n,icon:s,accent:l,variant:d="primary",trend:u,hint:h}=e;return(0,a.jsxs)("div",{className:"bg-surface border border-border rounded-xl p-4 flex items-start gap-4",children:[(0,a.jsx)("div",{className:(0,c.Z)("w-10 h-10 rounded-lg flex items-center justify-center shrink-0",null!=l?l:o[d]),children:(0,a.jsx)(s,{size:20})}),(0,a.jsxs)("div",{className:"min-w-0",children:[(0,a.jsxs)("div",{className:"flex items-center gap-2",children:[(0,a.jsx)("div",{className:"text-2xl font-semibold leading-tight",children:n}),void 0!==u&&(0,a.jsxs)("span",{className:(0,c.Z)("flex items-center gap-0.5 text-xs font-medium",u>=0?"text-success":"text-danger"),children:[u>=0?(0,a.jsx)(r,{size:12}):(0,a.jsx)(i,{size:12}),Math.abs(u),"%"]})]}),(0,a.jsx)("div",{className:"text-sm text-muted truncate",children:t}),h&&(0,a.jsx)("div",{className:"text-xs text-muted/70 mt-0.5",children:h})]})]})}},6067:function(e,t,n){"use strict";n.d(t,{d0:function(){return r},hi:function(){return o},yE:function(){return i}});let a="http://localhost:4000";function s(){return{accessToken:localStorage.getItem("accessToken"),refreshToken:localStorage.getItem("refreshToken")}}function r(e,t){localStorage.setItem("accessToken",e),localStorage.setItem("refreshToken",t)}function i(){localStorage.removeItem("accessToken"),localStorage.removeItem("refreshToken")}async function c(){let{refreshToken:e}=s();if(!e)return null;let t=await fetch("".concat(a,"/auth/refresh"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refreshToken:e})});if(!t.ok)return null;let n=await t.json();return r(n.accessToken,n.refreshToken),n.accessToken}async function o(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},{accessToken:n}=s(),r=async n=>{var s;return fetch("".concat(a).concat(e),{method:null!==(s=t.method)&&void 0!==s?s:"GET",headers:{"Content-Type":"application/json",...n?{Authorization:"Bearer ".concat(n)}:{},...t.headers},body:t.body?JSON.stringify(t.body):void 0})},i=await r(n);if(401===i.status&&n){let e=await c();e&&(i=await r(e))}if(!i.ok){let e="Erro ".concat(i.status);try{var o;let t=await i.json();e=null!==(o=t.message)&&void 0!==o?o:e}catch(e){}throw Error(e)}if(204!==i.status)return i.json()}},9565:function(e,t,n){"use strict";n.d(t,{Z:function(){return o}});var a=n(7653);/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),r=function(){for(var e=arguments.length,t=Array(e),n=0;n<e;n++)t[n]=arguments[n];return t.filter((e,t,n)=>!!e&&n.indexOf(e)===t).join(" ")};/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var i={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let c=(0,a.forwardRef)((e,t)=>{let{color:n="currentColor",size:s=24,strokeWidth:c=2,absoluteStrokeWidth:o,className:l="",children:d,iconNode:u,...h}=e;return(0,a.createElement)("svg",{ref:t,...i,width:s,height:s,stroke:n,strokeWidth:o?24*Number(c)/Number(s):c,className:r("lucide",l),...h},[...u.map(e=>{let[t,n]=e;return(0,a.createElement)(t,n)}),...Array.isArray(d)?d:[d]])}),o=(e,t)=>{let n=(0,a.forwardRef)((n,i)=>{let{className:o,...l}=n;return(0,a.createElement)(c,{ref:i,iconNode:t,className:r("lucide-".concat(s(e)),o),...l})});return n.displayName="".concat(e),n}},6023:function(e,t,n){"use strict";n.d(t,{Z:function(){return a}});/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,n(9565).Z)("CircleCheck",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]])},1804:function(e,t,n){"use strict";n.d(t,{Z:function(){return a}});/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,n(9565).Z)("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]])},276:function(e,t,n){"use strict";n.d(t,{Z:function(){return a}});/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,n(9565).Z)("Send",[["path",{d:"m22 2-7 20-4-9-9-4Z",key:"1q3vgg"}],["path",{d:"M22 2 11 13",key:"nzbqef"}]])},4835:function(e,t,n){"use strict";n.d(t,{Z:function(){return a}});/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,n(9565).Z)("Smartphone",[["rect",{width:"14",height:"20",x:"5",y:"2",rx:"2",ry:"2",key:"1yt0o3"}],["path",{d:"M12 18h.01",key:"mhygvu"}]])},6782:function(e,t,n){"use strict";n.d(t,{Z:function(){return a}});/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,n(9565).Z)("WifiOff",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}],["path",{d:"M5 12.859a10 10 0 0 1 5.17-2.69",key:"1dl1wf"}],["path",{d:"M19 12.859a10 10 0 0 0-2.007-1.523",key:"4k23kn"}],["path",{d:"M2 8.82a15 15 0 0 1 4.177-2.643",key:"1grhjp"}],["path",{d:"M22 8.82a15 15 0 0 0-11.288-3.764",key:"z3jwby"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]])},6561:function(e,t,n){"use strict";n.d(t,{Z:function(){return a}});/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,n(9565).Z)("Wifi",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M2 8.82a15 15 0 0 1 20 0",key:"dnpr2z"}],["path",{d:"M5 12.859a10 10 0 0 1 14 0",key:"1x1e6c"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}]])},7439:function(e,t,n){"use strict";n.d(t,{Z:function(){return a}});/**
 * @license lucide-react v0.436.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,n(9565).Z)("Workflow",[["rect",{width:"8",height:"8",x:"3",y:"3",rx:"2",key:"by2w9f"}],["path",{d:"M7 11v4a2 2 0 0 0 2 2h4",key:"xkn7yn"}],["rect",{width:"8",height:"8",x:"13",y:"13",rx:"2",key:"1cgmvn"}]])},7908:function(e,t,n){"use strict";t.Z=function(){for(var e,t,n=0,a="",s=arguments.length;n<s;n++)(e=arguments[n])&&(t=function e(t){var n,a,s="";if("string"==typeof t||"number"==typeof t)s+=t;else if("object"==typeof t){if(Array.isArray(t)){var r=t.length;for(n=0;n<r;n++)t[n]&&(a=e(t[n]))&&(s&&(s+=" "),s+=a)}else for(a in t)t[a]&&(s&&(s+=" "),s+=a)}return s}(e))&&(a&&(a+=" "),a+=t);return a}}},function(e){e.O(0,[293,286,744],function(){return e(e.s=1413)}),_N_E=e.O()}]);