/* सब्ज़ी एक्सप्रेस — प्लेटफ़ॉर्म परत
   Firebase लॉगिन, अपने-आप अपडेट, कैमरा स्कैनर, ब्लूटूथ प्रिंटर, A4 प्रिंट, फोटो।
   ऐप का बाकी कोड (index.html) पहले जैसा ही S.db.collection(...) API इस्तेमाल करता है। */
(function(){
"use strict";
const CFG=window.SE_CONFIG||{};
const N=window.SENative||{isNative:false};
const SE=window.SE={version:window.SE_BUILD||"dev",isNative:!!N.isNative,cfg:CFG};
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const STAFF_DOMAIN="staff.sabjiexpress.in";
const staffEmail=(ph,v)=>`${ph}.v${v||1}@${STAFF_DOMAIN}`;
const staffPass=(ph,pin)=>`se-${pin}-${ph}`;
// मालिक की ईमेल कोड में साफ़ नहीं लिखी — सिर्फ़ उसकी "छाप" (SHA-256), ताकि Public कोड में ईमेल न दिखे
const OH={};
async function isOwnerMail(email){email=String(email||"").trim().toLowerCase();if(!email||!CFG.ownerHash)return false;if(email in OH)return OH[email];
  try{const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(email));OH[email]=[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join("")===String(CFG.ownerHash).toLowerCase()}catch(e){OH[email]=false}return OH[email]}
SE.configured=!!(CFG.firebase&&CFG.firebase.apiKey&&!/^PASTE/.test(CFG.firebase.apiKey));

/* ---------- Firebase शुरू ---------- */
let app=null,db=null,auth=null;
function initFB(){
  if(app)return;
  app=firebase.initializeApp(CFG.firebase);
  db=firebase.firestore();
  try{db.settings({ignoreUndefinedProperties:true,merge:true})}catch(e){}
  // फोन में पक्की कॉपी: इंटरनेट न हो तब भी पुराना डेटा दिखे और नए बिल जुड़ते रहें
  db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
  auth=firebase.auth();
  SE.db=db;SE.auth=auth;SE.FieldValue=firebase.firestore.FieldValue;
}
SE.inc=n=>firebase.firestore.FieldValue.increment(n);

/* ---------- लॉगिन स्क्रीन ---------- */
function lockEl(){return $("#lock")}
function drawLogin(st){
  const L=lockEl();L.hidden=false;
  if(st.mode==="owner"){
    L.innerHTML=`<div style="font-size:44px">🥬</div><h2>सब्ज़ी एक्सप्रेस</h2>
    <p class="note" style="margin:-8px 0 0">${st.create?"मालिक का नया खाता बनाएँ":"मालिक लॉगिन"}</p>
    <div class="lgform">
      <input class="inp" id="lgEmail" type="email" autocomplete="username" placeholder="ईमेल" value="${esc(st.email||"")}">
      <input class="inp" id="lgPass" type="password" autocomplete="${st.create?"new-password":"current-password"}" placeholder="पासवर्ड (कम से कम 6 अक्षर)">
      ${st.err?`<p class="lgerr">${esc(st.err)}</p>`:""}${st.msg?`<p class="lgmsg">${esc(st.msg)}</p>`:""}
      <button class="big" data-lg="owner-go">${st.busy?"रुकिए…":st.create?"खाता बनाएँ":"लॉगिन करें"}</button>
      <button class="lnk" data-lg="owner-toggle">${st.create?"पहले से खाता है? लॉगिन करें":"पहली बार? नया खाता बनाएँ"}</button>
      ${st.create?"":`<button class="lnk" data-lg="owner-reset">पासवर्ड भूल गए?</button>`}
      <button class="lnk" data-lg="to-staff">← कर्मचारी लॉगिन</button></div>`;
    return}
  if(st.mode==="verify"){
    L.innerHTML=`<div style="font-size:44px">📧</div><h2>ईमेल पक्का करें</h2>
    <p class="note">${esc(st.email)} पर एक लिंक भेजा है। Gmail खोलकर लिंक दबाएँ, फिर यहाँ "हो गया" दबाएँ।</p>
    ${st.err?`<p class="lgerr">${esc(st.err)}</p>`:""}
    <div class="lgform"><button class="big" data-lg="verify-done">हो गया</button><button class="lnk" data-lg="verify-resend">लिंक दोबारा भेजें</button><button class="lnk" data-lg="logout">दूसरा खाता</button></div>`;
    return}
  L.innerHTML=`<div style="font-size:44px">🥬</div><h2>सब्ज़ी एक्सप्रेस</h2>
    ${st.step==="pin"?`<p class="note" style="margin:-8px 0 0">📱 ${esc(st.phone)} — अपना 4 अंक का PIN डालें</p>
      <div class="dots ${st.err?"bad":""}" aria-label="PIN">${[0,1,2,3].map(i=>`<i class="${i<st.pin.length?"f":""}"></i>`).join("")}</div>`
    :`<p class="note" style="margin:-8px 0 0">अपना मोबाइल नंबर डालें</p><div class="lgphone" aria-live="polite">${esc(st.phone||"")||'<span class="note">10 अंक</span>'}</div>`}
    ${st.err?`<p class="lgerr">${esc(st.err)}</p>`:""}${st.busy?'<p class="note">जाँच रहे हैं…</p>':""}
    <div class="pad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-k="${n}">${n}</button>`).join("")}<button class="t" data-k="c">साफ़</button><button data-k="0">0</button><button class="t" data-k="b" aria-label="एक अंक हटाएँ">⌫</button></div>
    ${st.step==="pin"?`<button class="lnk" data-lg="back">← नंबर बदलें</button>`:""}
    <button class="lnk" data-lg="to-owner">मालिक लॉगिन</button>`;
}
const errHi=e=>{const c=(e&&e.code)||"";
  if(/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c))return "गलत नंबर/PIN या पासवर्ड";
  if(/too-many-requests/.test(c))return "बहुत बार गलत हुआ — थोड़ी देर बाद कोशिश करें";
  if(/network/.test(c))return "इंटरनेट नहीं है — पहली बार लॉगिन के लिए नेट चाहिए";
  if(/email-already-in-use/.test(c))return "यह ईमेल पहले से है — लॉगिन करें";
  if(/weak-password/.test(c))return "पासवर्ड कम से कम 6 अक्षर का रखें";
  if(/invalid-email/.test(c))return "ईमेल सही लिखें";
  return "नहीं हुआ ("+(c||"error")+")"};

function loginFlow(){
  return new Promise(resolve=>{
    const st={mode:"staff",step:"phone",phone:"",pin:"",err:"",busy:false};
    const L=lockEl();
    const draw=()=>drawLogin(st);
    draw();
    const tryStaff=async()=>{
      st.busy=true;st.err="";draw();
      try{
        let v=1;try{const x=await db.doc("staffIndex/"+st.phone).get();if(x.exists)v=+x.data().v||1}catch(e){}
        await auth.signInWithEmailAndPassword(staffEmail(st.phone,v),staffPass(st.phone,st.pin));
      }catch(e){st.busy=false;st.pin="";st.err=errHi(e);draw()}
    };
    L.onclick=async e=>{
      const lg=e.target.closest("[data-lg]");
      if(lg){const a=lg.dataset.lg;st.err="";st.msg="";
        if(a==="to-owner"){st.mode="owner";draw();return}
        if(a==="to-staff"){st.mode="staff";st.step="phone";draw();return}
        if(a==="back"){st.step="phone";st.pin="";draw();return}
        if(a==="owner-toggle"){st.create=!st.create;draw();return}
        if(a==="logout"){await auth.signOut();st.mode="owner";draw();return}
        if(a==="owner-reset"){const em=$("#lgEmail").value.trim();if(!em){st.err="पहले ईमेल लिखें";draw();return}
          try{await auth.sendPasswordResetEmail(em);st.msg="पासवर्ड बदलने का लिंक "+em+" पर भेज दिया"}catch(x){st.err=errHi(x)}draw();return}
        if(a==="owner-go"){const em=$("#lgEmail").value.trim(),pw=$("#lgPass").value;st.email=em;
          if(!em||pw.length<6){st.err="ईमेल और 6+ अक्षर का पासवर्ड डालें";draw();return}
          st.busy=true;draw();
          try{if(st.create){const r=await auth.createUserWithEmailAndPassword(em,pw);await r.user.sendEmailVerification()}else await auth.signInWithEmailAndPassword(em,pw)}
          catch(x){st.err=errHi(x)}st.busy=false;if(st.err)draw();return}
        if(a==="verify-resend"){try{await auth.currentUser.sendEmailVerification();st.err="लिंक दोबारा भेजा"}catch(x){st.err=errHi(x)}draw();return}
        if(a==="verify-done"){try{await auth.currentUser.reload();await auth.currentUser.getIdToken(true)}catch(x){}
          if(auth.currentUser&&auth.currentUser.emailVerified){done(auth.currentUser)}else{st.err="अभी पक्का नहीं हुआ — Gmail में लिंक दबाएँ";draw()}return}
        return}
      const k=e.target.closest("[data-k]");if(!k||st.mode!=="staff"||st.busy)return;
      const v=k.dataset.k;st.err="";
      if(st.step==="phone"){
        if(v==="c")st.phone="";else if(v==="b")st.phone=st.phone.slice(0,-1);else if(st.phone.length<10)st.phone+=v;
        if(st.phone.length===10){st.step="pin";st.pin=""}
        draw();return}
      if(v==="c")st.pin="";else if(v==="b")st.pin=st.pin.slice(0,-1);else if(st.pin.length<4)st.pin+=v;
      draw();if(st.pin.length===4)tryStaff();
    };
    let finished=false;
    const done=u=>{if(finished)return;finished=true;L.onclick=null;resolve(u)};
    SE._loginWait=async u=>{
      if(!u)return;
      if(u.email&&!u.emailVerified&&await isOwnerMail(u.email)){st.mode="verify";st.email=u.email;draw();return}
      done(u)};
  });
}

/* लॉगिन के बाद तय करें: मालिक या कर्मचारी */
async function resolveRole(u){
  const isOwner=!!(u.email&&u.emailVerified&&await isOwnerMail(u.email));
  if(isOwner){
    try{await u.getIdToken(true)}catch(e){} // ईमेल पक्की होने के बाद नया टिकट — वरना सर्वर पुराना "पक्की नहीं" वाला देखता है
    try{await db.doc("staff/"+u.uid).set({name:CFG.ownerName||"विक्रम जी",owner:true,active:true,email:u.email,ts:Date.now()},{merge:true})}catch(e){}
    return {uid:u.uid,name:CFG.ownerName||"विक्रम जी",isOwner:true}}
  let d=null;
  try{const x=await db.doc("staff/"+u.uid).get({source:"default"});d=x.exists?x.data():null}catch(e){
    try{const x=await db.doc("staff/"+u.uid).get({source:"cache"});d=x.exists?x.data():null}catch(e2){}}
  if(!d||d.active===false){await auth.signOut();return null}
  return {uid:u.uid,name:d.name||"कर्मचारी",phone:d.phone||"",isOwner:false};
}

SE.start=async function(){
  if(!SE.configured||!window.firebase)return null;
  initFB();
  for(;;){
    const first=await new Promise(r=>{const un=auth.onAuthStateChanged(u=>{un();r(u)})});
    let u=first;
    if(!u||(u.email&&!u.emailVerified&&await isOwnerMail(u.email))){
      const p=loginFlow();
      const un=auth.onAuthStateChanged(x=>{if(x&&SE._loginWait)SE._loginWait(x)});
      if(u)SE._loginWait(u);
      u=await p;un();
    }
    const who=await resolveRole(u);
    if(who){const L=lockEl();L.hidden=true;L.innerHTML="";SE.me=who;
      auth.onAuthStateChanged(x=>{if(!x&&SE.me){SE.me=null;location.reload()}});
      return {db,...who}}
    const L=lockEl();L.hidden=false;
    L.innerHTML=`<div style="font-size:44px">⛔</div><h2>खाता चालू नहीं है</h2><p class="note">यह नंबर अभी चालू नहीं है। विक्रम जी से कहें कि "रेट व सेटिंग" में आपका नाम जोड़ें।</p><button class="big" onclick="location.reload()">दोबारा कोशिश करें</button>`;
    await new Promise(()=>{});
  }
};
/* मालिक को सर्वर से अनुमति मिल रही है या नहीं — गड़बड़ हो तो साफ़ कारण */
SE.ownerDiag=async function(){
  const u=auth&&auth.currentUser;if(!u)return {ok:false,why:"लॉगिन नहीं"};
  let cl={};try{cl=(await u.getIdTokenResult(true)).claims||{}}catch(e){}
  try{await db.collection("settings").doc("main").get({source:"server"});return {ok:true,cl}}
  catch(e){return {ok:false,code:e.code||"",cl,why:!cl.email_verified?"ईमेल अभी पक्की नहीं (Gmail का लिंक दबाएँ, फिर लॉग-आउट करके दोबारा लॉगिन)":"Firestore के Rules में नया कोड Publish नहीं हुआ या गलत चिपका है"}}
};
SE.logout=async()=>{try{await auth.signOut()}catch(e){}location.reload()};

/* मालिक नया कर्मचारी जोड़े — मोबाइल + 4 अंक PIN */
SE.addStaff=async function(name,phone,pin){
  phone=String(phone).replace(/\D/g,"").slice(-10);
  if(!name||phone.length!==10||!/^\d{4}$/.test(pin))throw {msg:"नाम, 10 अंक का मोबाइल और 4 अंक का PIN डालें"};
  let v=1;try{const x=await db.doc("staffIndex/"+phone).get();if(x.exists)v=(+x.data().v||1)+1}catch(e){}
  const sec=firebase.apps.find(a=>a.name==="sec")||firebase.initializeApp(CFG.firebase,"sec");
  const r=await sec.auth().createUserWithEmailAndPassword(staffEmail(phone,v),staffPass(phone,pin));
  const uid=r.user.uid;await sec.auth().signOut();
  // पुराने खाते (उसी नंबर के) बंद — PIN बदलने पर पुराना PIN काम नहीं करेगा
  try{const old=await db.collection("staff").where("phone","==",phone).get();for(const d of old.docs)if(d.id!==uid&&d.data().active!==false)await d.ref.update({active:false,offTs:Date.now(),offWhy:"नया PIN"})}catch(e){}
  await db.doc("staff/"+uid).set({name,phone,active:true,owner:false,ts:Date.now(),by:auth.currentUser.uid});
  await db.doc("staffIndex/"+phone).set({v});
  return uid;
};
SE.setStaffActive=(uid,on)=>db.doc("staff/"+uid).update({active:!!on,[on?"onTs":"offTs"]:Date.now()});

/* ---------- फोटो ---------- */
SE.bundled=new Set(window.SE_PHOTOS||[]);
SE.photos={};
SE.photoSrc=function(it){if(!it)return "";if(SE.photos[it.id])return SE.photos[it.id];if(it.photo&&SE.bundled.has(it.id))return "img/"+it.id+".jpg";return ""};
SE.watchPhotos=function(onChange){if(!db)return;db.collection("photos").onSnapshot(s=>{SE.photos={};s.docs.forEach(d=>{const x=d.data();if(x&&x.d)SE.photos[d.id]=x.d});onChange&&onChange()},()=>{})};
SE.savePhoto=async function(id,blob){
  const url=await new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(blob);img.onload=()=>{const m=420,sc=Math.min(1,m/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL("image/jpeg",.8))};img.onerror=rej;img.src=u});
  await db.doc("photos/"+id).set({d:url,ts:Date.now()});SE.photos[id]=url;return "fs"+Date.now();
};

/* ---------- कैमरा स्कैनर ---------- */
let mlReady=null;
async function nativeScan(){
  const B=N.BarcodeScanner;
  if(!mlReady)mlReady=(async()=>{try{const a=await B.isGoogleBarcodeScannerModuleAvailable();if(!a.available){await B.installGoogleBarcodeScannerModule();await new Promise(r=>setTimeout(r,2500))}}catch(e){}})();
  await mlReady;
  const F=N.BarcodeFormat;
  const r=await B.scan({formats:[F.Ean13,F.Ean8,F.UpcA,F.UpcE,F.Code128,F.Code39,F.Code93,F.Itf,F.QrCode]});
  return (r&&r.barcodes&&r.barcodes[0]&&r.barcodes[0].rawValue)||null;
}
/* Chrome (वेब) में लाइव कैमरा — BarcodeDetector */
function webLiveScan(){
  return new Promise(async resolve=>{
    let stream=null,stop=false;
    const ov=document.createElement("div");ov.className="camov";
    ov.innerHTML=`<video playsinline muted></video><div class="camframe"></div><p>बारकोड को चौखटे में लाएँ — अपने-आप पढ़ लेगा</p><button class="big ghost">बंद करें</button>`;
    document.body.appendChild(ov);
    const end=v=>{stop=true;try{stream&&stream.getTracks().forEach(t=>t.stop())}catch(e){}ov.remove();resolve(v)};
    ov.querySelector("button").onclick=()=>end(null);
    try{
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:{ideal:1280}},audio:false});
      const v=ov.querySelector("video");v.srcObject=stream;await v.play();
      const bd=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","itf","qr_code"]});
      const tick=async()=>{if(stop)return;try{const r=await bd.detect(v);if(r&&r.length){end(r[0].rawValue);return}}catch(e){}setTimeout(tick,120)};tick();
    }catch(e){end(undefined)}
  });
}
SE.canLiveScan=()=>SE.isNative||("BarcodeDetector" in window&&!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia));
/* null = बंद किया, undefined = यह फोन लाइव स्कैन नहीं कर सकता */
SE.scan=async function(){
  if(SE.isNative){try{return await nativeScan()}catch(e){const m=String(e&&e.message||"");if(/cancel/i.test(m))return null;throw e}}
  if("BarcodeDetector" in window)return webLiveScan();
  return undefined;
};

/* ---------- ब्लूटूथ थर्मल प्रिंटर (58/80mm, ESC/POS इमेज) ---------- */
SE.printer={
  get addr(){return ls.get("se_prn")||""},get name(){return ls.get("se_prn_n")||""},
  /* चौड़ाई डॉट में: 58mm=384, 80mm=576, 4 इंच (Xprinter XP-D4601B जैसे)=800 */
  get mm(){return ls.get("se_prn_w")||"58"},
  get width(){const m=this.mm;return m==="100"?800:m==="80"?576:384},
  get type(){return ls.get("se_prn_t")||(this.mm==="100"?"tspl":"escpos")},
  async list(){if(!SE.isNative)throw {msg:"प्रिंटर सिर्फ़ Android ऐप में जुड़ता है"};const r=await N.BtPrinter.list();return r.devices||[]},
  pick(addr,name,w,t){ls.set("se_prn",addr);ls.set("se_prn_n",name||addr);if(w)ls.set("se_prn_w",String(w));ls.set("se_prn_t",t||(String(w)==="100"?"tspl":"escpos"))},
};
function wrapLines(ctx,text,maxW){const words=String(text).split(" ");const out=[];let cur="";for(const w of words){const t=cur?cur+" "+w:w;if(ctx.measureText(t).width>maxW&&cur){out.push(cur);cur=w}else cur=t}if(cur)out.push(cur);return out}
/* कागज़ जैसी रसीद की तस्वीर — प्रिंट, PDF और WhatsApp तीनों में यही */
SE.receiptCanvas=function(b,o,widthPx){
  const W=widthPx||SE.printer.width,P=Math.round(W*0.03),F='"Mukta","Noto Sans Devanagari","Noto Sans",sans-serif',FB='"Baloo 2","Mukta","Noto Sans Devanagari",sans-serif';
  const k=W/384;const fs=n=>Math.round(n*k);
  const c=document.createElement("canvas");c.width=W;c.height=6000;const x=c.getContext("2d");
  x.fillStyle="#fff";x.fillRect(0,0,W,c.height);x.fillStyle="#000";x.textBaseline="top";
  let y=fs(8);
  const T=(t,sz,al,bold,fam)=>{x.font=`${bold?"800 ":"500 "}${sz}px ${fam||F}`;for(const ln of wrapLines(x,t,W-2*P)){const w=x.measureText(ln).width;x.fillText(ln,al==="c"?(W-w)/2:al==="r"?W-P-w:P,y);y+=Math.round(sz*1.3)}};
  const LR=(l,r,sz,bold)=>{x.font=`${bold?"800 ":"500 "}${sz}px ${F}`;const rw=x.measureText(r).width;x.fillText(l,P,y);x.fillText(r,W-P-rw,y);y+=Math.round(sz*1.35)};
  const DASH=()=>{y+=fs(3);for(let i=P;i<W-P;i+=fs(10))x.fillRect(i,y,fs(6),Math.max(1,fs(1.6)));y+=fs(7)};
  const LINE=()=>{y+=fs(3);x.fillRect(P,y,W-2*P,Math.max(2,fs(2)));y+=fs(7)};
  T("🥬 "+(o.shop||"सब्ज़ी एक्सप्रेस"),fs(30),"c",true,FB);
  if(o.tag)T(o.tag,fs(15),"c");
  if(o.addr)T(o.addr,fs(16),"c");
  if(o.phone)T("📞 ऑर्डर: "+o.phone,fs(16),"c");
  LINE();
  if(o.custTag){const h=fs(34);x.fillStyle="#000";if(o.vip){x.fillRect(P,y,W-2*P,h);x.fillStyle="#fff"}else{x.lineWidth=Math.max(2,fs(2));x.strokeRect(P,y,W-2*P,h)}
    x.font=`800 ${fs(20)}px ${FB}`;const tw=x.measureText(o.custTag).width;x.fillText(o.custTag,(W-tw)/2,y+fs(6));x.fillStyle="#000";y+=h+fs(8)}
  LR("बिल नं: "+b.no,"",fs(19),true);
  LR("तारीख: "+(o.date||""),"",fs(17));
  if((b.partyName&&b.partyName!=="VIP ग्राहक")||b.custPhone)LR("ग्राहक: "+(b.partyName||"")+(b.custPhone?" · "+b.custPhone:""),"",fs(17));
  DASH();
  // टेबल: क्र. | सामान | मात्रा | भाव | रकम
  const cS=P,cN=P+W*0.07,cQ=W*0.58,cR=W*0.765,cA=W-P,sz=fs(17);
  const row=(a,bn,q,r,am,bold)=>{x.font=`${bold?"800 ":"500 "}${sz}px ${F}`;const lines=wrapLines(x,bn,cQ-cN-fs(30));const h=Math.round(sz*1.32);
    x.fillText(a,cS,y);lines.forEach((ln,i)=>x.fillText(ln,cN,y+i*h));
    const rt=(t,xr)=>{const w=x.measureText(t).width;x.fillText(t,xr-w,y)};rt(q,cQ+fs(18));rt(r,cR+fs(14));rt(am,cA);y+=h*lines.length+fs(3)};
  row("क्र.","सामान","मात्रा","भाव","रकम",true);DASH();
  (b.lines||[]).forEach((l,i)=>row(String(i+1),l.name,o.fq(l.qty,l.unit).replace(" कि.ग्रा"," kg"),l.free?"मुफ्त":"₹"+l.rate,"₹"+l.amt));
  DASH();
  const sub=r2(b.sub!=null?b.sub:(b.lines||[]).reduce((a,l)=>a+(l.amt||0),0));
  if(b.disc){LR("जोड़",`₹${sub}`,fs(18));LR("छूट",`−₹${b.disc}`,fs(18))}
  LR("कुल रकम",`₹${b.total}`,fs(30),true);
  if(b.pay&&o.paid!==false){const p=b.pay;const parts=[p.cash?"नकद ₹"+p.cash:"",p.upi?"UPI ₹"+p.upi:"",p.udhar?"उधार ₹"+p.udhar:""].filter(Boolean);if(parts.length)T("भुगतान: "+parts.join(" · "),fs(16),"l")}
  if(o.balance!=null)LR("खाते में कुल बाकी",`₹${o.balance}`,fs(18),true);
  if(o.qr){DASH();T("स्कैन करके भुगतान करें",fs(17),"c",true);const q=o.qr,s=Math.min(W*0.55,q.width*3);x.imageSmoothingEnabled=false;x.drawImage(q,(W-s)/2,y,s,s);y+=s+fs(4);if(o.upi)T(o.upi+(o.payee?" · "+o.payee:""),fs(14),"c")}
  DASH();
  if(o.phone){const y0=y;y+=fs(8);T("📲 घर बैठे ताज़ी सब्ज़ी मँगाएँ",fs(18),"c",true);T("WhatsApp या कॉल करें",fs(15),"c");T(o.phone,fs(28),"c",true,FB);y+=fs(4);
    x.lineWidth=Math.max(2,fs(2));x.strokeRect(P,y0,W-2*P,y-y0);y+=fs(8)}
  T("🙏 धन्यवाद! फिर पधारें",fs(19),"c",true);
  if(b.byName)T("बिलर: "+b.byName,fs(14),"c");
  y+=fs(24);
  const out=document.createElement("canvas");out.width=W;out.height=Math.ceil(y);out.getContext("2d").drawImage(c,0,0);return out;
};
const r2=n=>Math.round((+n||0)*100)/100;
function canvasToEscPos(cv){
  const W=cv.width,H=cv.height,bw=W>>3;const d=cv.getContext("2d").getImageData(0,0,W,H).data;
  const parts=[[0x1b,0x40]];
  for(let y0=0;y0<H;y0+=24){
    const h=Math.min(24,H-y0);const blk=new Uint8Array(8+bw*h);
    blk.set([0x1d,0x76,0x30,0x00,bw&255,bw>>8,h&255,h>>8]);
    for(let yy=0;yy<h;yy++)for(let xb=0;xb<bw;xb++){let v=0;for(let bit=0;bit<8;bit++){const i=((y0+yy)*W+xb*8+bit)*4;const lum=d[i]*.3+d[i+1]*.59+d[i+2]*.11;if(lum<150&&d[i+3]>100)v|=0x80>>bit}blk[8+yy*bw+xb]=v}
    parts.push(blk);
  }
  parts.push([0x1b,0x64,0x04],[0x1d,0x56,0x42,0x00]);
  return toB64(parts);
}
function toB64(parts){let n=0;parts.forEach(p=>n+=p.length);const all=new Uint8Array(n);let o=0;parts.forEach(p=>{all.set(p,o);o+=p.length});
  let s="";for(let i=0;i<all.length;i+=0x8000)s+=String.fromCharCode.apply(null,all.subarray(i,i+0x8000));return btoa(s)}
/* TSPL (लेबल प्रिंटर, जैसे Xprinter XP-D4601B) — कोई भी तस्वीर छापो */
SE.tspl=function(cv,opt){
  opt=opt||{};const W=cv.width,H=cv.height,wb=Math.ceil(W/8);const d=cv.getContext("2d").getImageData(0,0,W,H).data;
  const inv=ls.get("se_linv")==="1";const bmp=new Uint8Array(wb*H);
  for(let y=0;y<H;y++)for(let xb=0;xb<wb;xb++){let v=0;for(let b=0;b<8;b++){const px=xb*8+b;let black=false;if(px<W){const i=(y*W+px)*4;black=(d[i]*.3+d[i+1]*.59+d[i+2]*.11)<150}
      const bit=inv?black:!black;if(bit)v|=0x80>>b}bmp[y*wb+xb]=v} // TSPL में 0 = काला डॉट
  const wmm=opt.wmm||Math.round(W/8),hmm=opt.hmm||Math.ceil(H/8);
  const enc=s=>new TextEncoder().encode(s);
  const head=enc(`SIZE ${wmm} mm,${hmm} mm\r\nGAP ${opt.gap!=null?opt.gap:(ls.get("se_lgap")||"2")} mm,0 mm\r\nDIRECTION 1\r\nREFERENCE 0,0\r\nDENSITY 10\r\nCLS\r\nBITMAP 0,0,${wb},${H},0,`);
  const tail=enc(`\r\nPRINT ${opt.copies||1},1\r\nEND\r\n`);
  return toB64([head,bmp,tail]);
};
SE.escpos=canvasToEscPos;
SE.printReceipt=async function(b,o){
  const cv=SE.receiptCanvas(b,o);
  if(SE.isNative){
    if(!SE.printer.addr)throw {code:"noprinter",msg:"पहले \"रेट व सेटिंग\" में प्रिंटर चुनें"};
    const data=SE.printer.type==="tspl"?SE.tspl(cv,{gap:0}):canvasToEscPos(cv);
    await N.BtPrinter.print({address:SE.printer.addr,data});return "bt"}
  const url=cv.toDataURL("image/png");
  printHTMLWeb(`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${SE.printer.mm}mm auto;margin:0}body{margin:0}img{width:100%;display:block}</style></head><body><img src="${url}"></body></html>`);
  return "web";
};
/* बिल PDF बनाकर ग्राहक के WhatsApp पर */
SE.shareReceipt=async function(b,o,phone,text){
  const cv=SE.receiptCanvas(b,o,768);const png=cv.toDataURL("image/png").split(",")[1];
  const name="SabjiExpress_"+String(b.no||"bill").replace(/[^A-Za-z0-9]/g,"");
  if(SE.isNative){
    try{await N.BtPrinter.shareFile({data:png,name,pdf:true,phone:phone||"",text:text||""});return "pdf"}
    catch(e){const m=String(e&&e.message||"");if(/not implemented|UNIMPLEMENTED/i.test(m))throw {code:"oldapk",msg:"PDF शेयर के लिए नई APK इंस्टॉल करें (लिंक वही है)"};throw e}
  }
  // वेब: फोन का शेयर (WhatsApp चुनें) — न चले तो फोटो डाउनलोड
  const blob=await new Promise(r=>cv.toBlob(r,"image/png"));const file=new File([blob],name+".png",{type:"image/png"});
  if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text:text||""});return "share"}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name+".png";document.body.appendChild(a);a.click();a.remove();
  return "download";
};
function printHTMLWeb(html){
  const f=document.createElement("iframe");f.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0";document.body.appendChild(f);
  const d=f.contentWindow.document;d.open();d.write(html);d.close();
  const go=()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){}setTimeout(()=>f.remove(),60000)};
  const imgs=[...d.images];if(!imgs.length)setTimeout(go,300);else Promise.all(imgs.map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))).then(()=>setTimeout(go,200));
}
/* A4 रिपोर्ट — प्रिंट या PDF सेव */
SE.printA4=async function(title,bodyHTML){
  const html=`<!doctype html><html lang="hi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page{size:A4;margin:14mm}body{font-family:"Noto Sans Devanagari","Noto Sans",sans-serif;color:#111;font-size:15px;line-height:1.45}
  h1{font-size:24px;margin:0 0 2px}h2,h3{font-size:18px;margin:14px 0 6px}.sub{color:#555;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;margin:6px 0 12px}th,td{border:1px solid #bbb;padding:5px 7px;text-align:left;vertical-align:top}th{background:#eef5ee}
  td.r,th.r{text-align:right}.tot td{font-weight:700;background:#f6f6f6}button,input,select,.noprint{display:none!important}
  </style></head><body><h1>🥬 सब्ज़ी एक्सप्रेस</h1><p class="sub">${esc(title)} · छपा: ${new Date().toLocaleString("hi-IN")}</p>${bodyHTML}</body></html>`;
  if(SE.isNative){await N.BtPrinter.printHtml({html,name:title});return}
  printHTMLWeb(html);
};

/* ---------- अपने-आप अपडेट (APK दोबारा नहीं भेजनी पड़ेगी) ---------- */
SE.checkUpdate=async function(toast){
  if(!SE.isNative||!N.CapacitorUpdater||!CFG.updateUrl)return;
  const U=N.CapacitorUpdater;
  try{await U.notifyAppReady()}catch(e){}
  try{
    const r=await fetch(CFG.updateUrl.replace(/\/?$/,"/")+"update/version.json?t="+Date.now(),{cache:"no-store"});
    if(!r.ok)return;const v=await r.json();
    if(!v||!v.version||v.version===SE.version)return;
    if(v.minNative&&+v.minNative>+(window.SE_NATIVE_MIN||1)){toast&&toast("नई APK आई है — विक्रम जी से नया ऐप लें");return}
    const pend=ls.get("se_upd_ready");
    let b;
    if(pend===v.version){try{const l=await U.list();b=(l.bundles||[]).find(x=>x.version===v.version)}catch(e){}}
    // पिछली बार डाउनलोड हो चुका — ऐप खुलते ही (कोई बिल चालू न हो तो) तुरंत लगा दो
    if(b&&!SE._busy()){toast&&toast("✨ नया अपडेट "+v.version+" लग रहा है…");try{await U.set({id:b.id});return}catch(e){}}
    if(!b){b=await U.download({url:new URL(v.url,CFG.updateUrl.replace(/\/?$/,"/")).href,version:v.version});ls.set("se_upd_ready",v.version)}
    SE._pendingBundle=b;
    toast&&toast("✨ नया अपडेट "+v.version+" आ गया — ऐप बंद करके खोलते ही लग जाएगा");
    N.App.addListener("appStateChange",async s=>{if(!s.isActive&&SE._pendingBundle&&!SE._busy()){try{await U.set({id:SE._pendingBundle.id})}catch(e){}}});
  }catch(e){}
};
SE._busy=()=>false;
SE.applyUpdateNow=async()=>{if(SE._pendingBundle)try{await N.CapacitorUpdater.set({id:SE._pendingBundle.id})}catch(e){}};

/* वेब (Chrome) के लिए ऑफ़लाइन कैश */
if(!SE.isNative&&"serviceWorker" in navigator&&location.protocol==="https:"){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}))}
})();
