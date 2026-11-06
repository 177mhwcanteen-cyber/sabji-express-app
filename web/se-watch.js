/* 🛡️ ऐप-पहरेदार (Sentry) — किसी भी फोन में ऐप की गलती आए तो उसकी रिपोर्ट अपने-आप Claude/विक्रम जी के Sentry में
   • कोई ग्राहक/बिल/रकम/मोबाइल नंबर नहीं भेजा जाता — सिर्फ़ गलती का संदेश, कौन-सी स्क्रीन, ऐप का वर्ज़न, फोन का प्रकार
   • एक फोन से एक बार में ज़्यादा से ज़्यादा 15 रिपोर्ट, एक जैसी गलती एक ही बार; टेस्ट/लोकल पर बंद
   • बिना SDK — सीधे Sentry के envelope पते पर (ऐप हल्का रहे) */
(function(){
"use strict";
const DSN={host:"o4512374822797312.ingest.us.sentry.io",pid:"4512374836559872",key:"43706bc0b739a0a6488a0f0f4b609736"};
const off=/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)||/[?&]nowatch/.test(location.search);
const seen={};let sent=0;const crumbs=[];
const uid=()=>([1e7]+1e3+4e3+8e3+1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)).replace(/-/g,"");
const clean=s=>String(s||"").replace(/\b\d{10}\b/g,"<phone>").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g,"<email>").slice(0,900);
function frames(stack){return String(stack||"").split("\n").slice(0,30).map(l=>{const m=/(?:at\s+)?(?:(\S+)\s+\()?(?:.*\/)?([^/\s():]+):(\d+):(\d+)\)?/.exec(l);return m?{function:m[1]||"?",filename:m[2],lineno:+m[3],colno:+m[4],in_app:true}:null}).filter(Boolean).reverse()}
function ctx(){const G=window.__S__||(typeof S!=="undefined"?S:{});return {tab:G.tab||"",owner:!!G.isOwner,demo:!!G.demo,online:navigator.onLine,native:!!(window.SENative&&window.SENative.isNative)}}
function send(type,value,stack,extra){
  if(off||sent>=15)return;const k=type+"|"+value;if(seen[k])return;seen[k]=1;sent++;
  const id=uid(),c=ctx();if(c.demo)return;
  const ev={event_id:id,timestamp:Date.now()/1000,platform:"javascript",level:"error",logger:"sabji",
    release:"sabji@"+(window.SE_BUILD||"dev"),environment:c.native?"android":"web",
    tags:{app:"sabji",tab:c.tab,owner:String(c.owner),online:String(c.online)},
    user:{id:(()=>{try{let v=localStorage.getItem("sx_wid");if(!v){v=uid().slice(0,12);localStorage.setItem("sx_wid",v)}return v}catch(e){return "x"}})()},
    request:{url:location.pathname,headers:{"User-Agent":navigator.userAgent}},
    exception:{values:[{type:type||"Error",value:clean(value),stacktrace:{frames:frames(stack)}}]},
    breadcrumbs:{values:crumbs.slice(-20)},extra:extra||{}};
  const body=JSON.stringify({event_id:id,sent_at:new Date().toISOString()})+"\n"+JSON.stringify({type:"event"})+"\n"+JSON.stringify(ev);
  const url=`https://${DSN.host}/api/${DSN.pid}/envelope/?sentry_key=${DSN.key}&sentry_version=7`;
  try{fetch(url,{method:"POST",body,headers:{"Content-Type":"text/plain;charset=UTF-8"},keepalive:true,mode:"cors"}).catch(()=>{})}catch(e){}
}
window.addEventListener("error",e=>{if(!e)return;const er=e.error;send(er&&er.name||"Error",(er&&er.message)||e.message||"script error",er&&er.stack||((e.filename||"")+":"+(e.lineno||0)+":"+(e.colno||0)))});
window.addEventListener("unhandledrejection",e=>{const r=e&&e.reason;if(r&&(r.code==="unavailable"||/offline|network/i.test(r.message||"")))return;send(r&&r.name||"UnhandledRejection",r&&(r.message||r.msg)||String(r),r&&r.stack)});
/* टैब/बटन की हल्की पगडंडी — गलती से पहले क्या दबाया */
document.addEventListener("click",e=>{const b=e.target&&e.target.closest&&e.target.closest("button,[data-tab],a");if(!b)return;
  crumbs.push({timestamp:Date.now()/1000,category:"ui.click",message:clean((b.dataset&&b.dataset.tab)||b.getAttribute("aria-label")||b.textContent).slice(0,40)});if(crumbs.length>40)crumbs.shift()},true);
window.SEW={report:(msg,extra)=>send("AppReport",msg,new Error(msg).stack,extra),off};
})();
