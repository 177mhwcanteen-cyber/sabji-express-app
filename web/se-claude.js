/* 🧑‍💼 Claude से सीधी बात (28-11-2026, विक्रम जी: "Gemini नहीं, हर काम Claude से — मैनेजर ऐप जैसा अपने-आप")
   ऐप → Claude: मालिक के फोन से हर 30 मिनट (और बटन से) उस दिन का पूरा ऑडिट-पैक, ताले में (AES-GCM; चाबी Claude की
   सार्वजनिक चाबी RSA-OAEP से बंद) → pub/cx_<दिन> + pub/cx_idx → GitHub Action (claude-in.yml) → शाखा claude-data/claude/in/।
   Claude → ऐप: Claude का ऑडिट claude-data/claude/out/<दिन>.json (उसी फोन-चाबी से ताले में) → मालिक के फोन पर रिपोर्ट में कार्ड।
   साथी को कुछ नहीं; मालिक के फोन पर कोई आवाज़ नहीं (ऐप खुलने पर एक बार सूचना)। repo सार्वजनिक है — इसलिए सब ताले में। */
(function(){
const SCL=window.SCL={};
SCL.PUB="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA33kYWtxB83/pIAJZHjav35Uz4eX0+68mWj7VLtV8WWYjxda2FAArCEW01DCSo1V0s2kzyYYXX86qo5mntff55pZD8V5AhrMvDEaielwNCfwtJBJYEp9+3Jwu/8AfiIAflrmrcPfXWJlXQ88lPonBRJe42dSb/29zHmQA3OUdRDgWCTCNIPNfG24jc4OkrAcR7GxMokMXYqznhUKCqJhmyK+tZsTBGBOMAem6zBsS0n3WK/rwCmSwENvRhrW8ft5St1z4eZYtW/SrKdxcNP71rNAKBk0EORrigPuW4ZxDK9fERjMDrRWtJYET5aEdidGEti/gKoKYidB9PxayaiVKCQIDAQAB";
SCL.RAW="https://raw.githubusercontent.com/177mhwcanteen-cyber/sabji-express-app/claude-data/claude/out/";
/* Claude की सार्वजनिक चाबी हर नई चैट बदल सकती है (निजी चाबी कहीं सहेजी नहीं जाती) → claude-data/claude/pub.json से ताज़ा */
SCL.getPub=async function(){try{const r=await fetch(SCL.RAW.replace("/out/","/")+"pub.json?t="+Date.now(),{cache:"no-store"});
  if(r.ok){const j=await r.json();if(j&&j.pub){LS("se_cpub",JSON.stringify(j));return j}}}catch(e){}
  try{const j=JSON.parse(LS("se_cpub")||"null");if(j&&j.pub)return j}catch(e){}return {kid:"k0",pub:SCL.PUB}};
const b64=u=>{let s="";const a=new Uint8Array(u);for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode.apply(null,a.subarray(i,i+8192));return btoa(s)};
const unb=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}};
const cs=()=>window.crypto&&crypto.subtle;
SCL.key=async function(){
  let r=LS("se_ck");if(!r){const a=new Uint8Array(32);crypto.getRandomValues(a);r=b64(a);LS("se_ck",r)}
  return {raw:unb(r),k:await cs().importKey("raw",unb(r),"AES-GCM",false,["encrypt","decrypt"])};
};
/* टेक्स्ट को ताले में: {wk, iv, ct} */
SCL.pack=async function(text,P){
  P=P||{kid:"k0",pub:SCL.PUB};const K=await SCL.key(),iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await cs().encrypt({name:"AES-GCM",iv},K.k,new TextEncoder().encode(text));
  const pk=await cs().importKey("spki",unb(P.pub),{name:"RSA-OAEP",hash:"SHA-256"},false,["encrypt"]);
  const wk=await cs().encrypt({name:"RSA-OAEP"},pk,K.raw);
  return {v:1,kid:P.kid,wk:b64(wk),iv:b64(iv),ct:b64(ct)};
};
SCL.open=async function(o){const K=await SCL.key();
  const pt=await cs().decrypt({name:"AES-GCM",iv:unb(o.iv)},K.k,unb(o.ct));return new TextDecoder().decode(pt)};
SCL.ok=()=>typeof S!=="undefined"&&S.isOwner&&!S.demo&&S.db&&cs();
/* भेजो: अभी चुने दिन (S.billsDate) का पूरा पैक */
SCL.send=async function(loud){
  if(!SCL.ok()||!window.SF||!SF.auditPack)return false;
  try{const d=S.billsDate,t=await SF.auditPack(),P=await SCL.getPub(),o=await SCL.pack(t,P);
    const h=P.kid+"|"+t.length+"|"+t.slice(-400);if(!loud&&LS("se_cxh_"+d)===h)return true;
    o.ts=Date.now();o.d=d;o.ver=(window.SE&&SE.version)||"";
    await S.db.doc("pub/cx_"+d).set(o);
    await S.db.doc("pub/cx_idx").set({d:{[d]:o.ts},ts:o.ts},{merge:true});
    LS("se_cxh_"+d,h);SCL.st.sent=o.ts;SCL.st.sentD=d;SCL.st.serr="";LS("se_cxst",JSON.stringify(SCL.st));if(loud)setTimeout(SCL.pull,1500);if(loud)toast("✓ "+fdate(d)+" का हिसाब Claude को भेज दिया — Claude इसी चैट में जाँच करेगा");return true}
  catch(e){SCL.st.serr=String(e.message||e).slice(0,80);LS("se_cxst",JSON.stringify(SCL.st));if(loud)toast("भेज नहीं पाए: "+(e.message||e)+" — नेट आते ही ऐप फिर भेजेगा");return false}
};
/* Claude का जवाब लाओ */
SCL.out={};
SCL.st={};
const API="https://api.github.com/repos/177mhwcanteen-cyber/sabji-express-app/contents/claude/out/";
async function getJ(name,v){
  try{const r=await fetch(SCL.RAW+name+"?t="+(v||Date.now()),{cache:"no-store"});if(r.ok)return await r.json()}catch(e){}
  /* raw न खुले तो GitHub API (शाखा claude-data) */
  const r=await fetch(API+name+"?ref=claude-data&t="+Date.now(),{cache:"no-store",headers:{Accept:"application/vnd.github.raw+json"}});
  if(!r.ok)throw new Error("GitHub "+r.status);return await r.json()}
SCL.pull=async function(){
  if(!SCL.ok()||SCL._pulling)return;SCL._pulling=1;
  try{const ix=await getJ("index.json");let bad=0;
    const ds=Object.keys(ix.d||{}).sort().slice(-10);
    for(const d of ds){if(SCL.out[d]&&SCL.out[d]._ts===ix.d[d])continue;
      try{const o=JSON.parse(await SCL.open(await getJ(d+".json",ix.d[d])));o._ts=ix.d[d];SCL.out[d]=o;LS("se_cxo_"+d,JSON.stringify(o))}catch(e){bad++}}
    SCL.st.pull=Date.now();SCL.st.err=bad?bad+" जवाब इस फोन की चाबी से नहीं खुले (दूसरे फोन/पुरानी चाबी के)":"";
  }catch(e){SCL.st.err="जवाब नहीं ला पाए: "+(e.message||e)+" — नेट देखें"}
  SCL._pulling=0;try{LS("se_cxst",JSON.stringify(SCL.st))}catch(e){}
  if(typeof renderReport==="function"&&S.tab==="report"&&!document.querySelector(".sheet.open,.sheet.show"))renderReport()};
/* पिछले जवाब फोन में रखे — नेट न हो तब भी दिखें */
(function(){try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith("se_cxo_")){const o=JSON.parse(localStorage.getItem(k));if(o&&o._ts)SCL.out[k.slice(7)]=o}}
  SCL.st=JSON.parse(LS("se_cxst")||"{}")||{}}catch(e){}})();
SCL.unseen=()=>Object.keys(SCL.out).filter(d=>LS("se_cxs_"+d)!==String(SCL.out[d]._ts));
const lv=l=>l==="पक्का"?"#c0392b":l==="शक"?"#e67e22":"#7f8c8d";
SCL.cardHTML=function(){
  if(typeof S==="undefined"||!S.isOwner)return "";
  if(SCL.ok()&&Date.now()-((SCL.st&&SCL.st.pull)||0)>60000)setTimeout(SCL.pull,300);
  const ds=Object.keys(SCL.out).sort().reverse();
  const head=`<div class="card2" id="sclCard" style="border-left:4px solid #f39c12"><h3>🧑‍💼 Claude का ऑडिट</h3>`;
  const tm=t=>t?new Date(t).toLocaleTimeString("hi-IN",{hour:"2-digit",minute:"2-digit"})+(new Date(t).toDateString()===new Date().toDateString()?"":" ("+new Date(t).toLocaleDateString("hi-IN",{day:"2-digit",month:"2-digit"})+")"):"—";
  const st=SCL.st||{};
  const stat=`<p class="note" style="margin:6px 0 0">📤 भेजा: <b>${tm(st.sent)}</b> · 📥 जाँचा: <b>${tm(st.pull)}</b>${st.serr?` · <span style="color:#c0392b">भेजने में दिक्कत: ${esc(st.serr)}</span>`:""}${st.err?` · <span style="color:#c0392b">${esc(st.err)}</span>`:""}</p>`;
  const btn=stat+`<div class="row2" style="margin:8px 0 0"><button class="big" data-sclsend>📤 ${fdate(S.billsDate)} का हिसाब भेजें</button><button class="big ghost" data-sclpull>🔄 जवाब देखें</button></div>
  <p class="note" style="margin:6px 0 0">ऐप हर 15 मिनट अपने-आप भेजता है, हर 5 मिनट जवाब देखता है। कॉपी के पन्नों की फोटो Claude की चैट में दें — जवाब यहीं आएगा।</p>`;
  if(!ds.length)return head+`<p class="note" style="margin:0">अभी कोई जवाब नहीं।</p>`+btn+"</div>";
  const one=d=>{const o=SCL.out[d],nw=LS("se_cxs_"+d)!==String(o._ts);
    return `<details ${d===ds[0]?"open":""} style="margin:6px 0"><summary><b>${esc(fdate(d))}</b> ${nw?"🔴 नया":""} — ${esc(o.verdict||"")}</summary>
    ${(o.rows||[]).length?`<table class="mini" style="width:100%;margin:6px 0">${o.rows.map(r=>`<tr><td>${esc(r[0])}</td><td style="text-align:right"><b>${esc(r[1])}</b></td></tr>`).join("")}</table>`:""}
    ${(o.issues||[]).map((x,i)=>`<div style="margin:4px 0;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.04);border-left:3px solid ${lv(x.lvl)}"><b>${i+1}. ${esc(x.t)}</b>${x.amt?` · ₹${esc(x.amt)}`:""} <span style="color:${lv(x.lvl)}">(${esc(x.lvl||"")})</span>${x.why?`<div class="note" style="margin:2px 0 0">${esc(x.why)}</div>`:""}</div>`).join("")}
    ${(o.ask||[]).length?`<p style="margin:6px 0 2px"><b>❓ कमल भाई से पूछें</b></p><ol style="margin:0 0 4px 18px;padding:0">${o.ask.map(a=>`<li>${esc(a)}</li>`).join("")}</ol>`:""}
    ${o.note?`<p class="note" style="margin:4px 0">${esc(o.note)}</p>`:""}
    ${nw?`<button class="big ghost" data-sclseen="${esc(d)}">✓ देख लिया</button>`:""}</details>`};
  return head+ds.map(one).join("")+btn+"</div>";
};
document.addEventListener("click",e=>{const a=e.target.closest("[data-sclsend]");if(a){SCL.send(true);return}
  if(e.target.closest("[data-sclpull]")){toast("🔄 Claude का जवाब देख रहे हैं…");SCL.pull().then(()=>toast(SCL.st.err||"✓ ताज़ा"));return}
  const b=e.target.closest("[data-sclseen]");if(b){const d=b.dataset.sclseen;LS("se_cxs_"+d,String(SCL.out[d]._ts));if(typeof renderReport==="function")renderReport()}});
SCL.note=()=>{const n=SCL.unseen().length;return n?"🧑‍💼 Claude का "+n+" नया ऑडिट":""};
SCL.start=function(){if(SCL._st||!SCL.ok())return;SCL._st=1;
  setTimeout(()=>{SCL.pull();if(S.billsDate===today())SCL.send(false)},20000);
  setInterval(()=>{if(document.hidden)return;if(S.billsDate===today())SCL.send(false)},15*60000);
  setInterval(()=>{if(!document.hidden)SCL.pull()},5*60000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)SCL.pull()})};
setTimeout(function w(){if(typeof S!=="undefined"&&S.isOwner&&S.db)SCL.start();else setTimeout(w,5000)},4000);
})();
