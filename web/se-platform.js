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
  get width(){return ls.get("se_prn_w")==="80"?576:384},
  async list(){if(!SE.isNative)throw {msg:"प्रिंटर सिर्फ़ Android ऐप में जुड़ता है"};const r=await N.BtPrinter.list();return r.devices||[]},
  pick(addr,name,w){ls.set("se_prn",addr);ls.set("se_prn_n",name||addr);if(w)ls.set("se_prn_w",String(w))},
};
function wrapLines(ctx,text,maxW){const words=String(text).split(" ");const out=[];let cur="";for(const w of words){const t=cur?cur+" "+w:w;if(ctx.measureText(t).width>maxW&&cur){out.push(cur);cur=w}else cur=t}if(cur)out.push(cur);return out}
SE.receiptCanvas=function(b,o){
  const W=SE.printer.width,P=8,F='"Noto Sans Devanagari","Noto Sans",sans-serif';
  const c=document.createElement("canvas");c.width=W;c.height=4000;const x=c.getContext("2d");
  x.fillStyle="#fff";x.fillRect(0,0,W,c.height);x.fillStyle="#000";x.textBaseline="top";
  let y=6;
  const T=(t,sz,al,bold)=>{x.font=`${bold?"700 ":""}${sz}px ${F}`;for(const ln of wrapLines(x,t,W-2*P)){const w=x.measureText(ln).width;x.fillText(ln,al==="c"?(W-w)/2:al==="r"?W-P-w:P,y);y+=Math.round(sz*1.35)}};
  const LR=(l,r,sz,bold)=>{x.font=`${bold?"700 ":""}${sz}px ${F}`;const rw=x.measureText(r).width;const ls2=wrapLines(x,l,W-2*P-rw-10);ls2.forEach((ln,i)=>{x.fillText(ln,P,y);if(i===ls2.length-1)x.fillText(r,W-P-rw,y);y+=Math.round(sz*1.35)})};
  const HR=()=>{y+=4;x.fillRect(P,y,W-2*P,2);y+=8};
  const big=W>400?1.25:1;
  T(o.shop||"सब्ज़ी एक्सप्रेस",Math.round(30*big),"c",true);
  if(o.tag)T(o.tag,Math.round(18*big),"c");
  if(o.addr)T(o.addr,Math.round(18*big),"c");
  if(o.phone)T("📞 "+o.phone,Math.round(18*big),"c");
  HR();
  LR("बिल: "+b.no,o.date||"",Math.round(18*big));
  T("ग्राहक: "+(b.partyName||"")+(b.custPhone?" ("+b.custPhone+")":""),Math.round(18*big));
  HR();
  (b.lines||[]).forEach((l,i)=>{T(`${i+1}. ${l.name}`,Math.round(20*big),"l",true);LR(`   ${o.fq(l.qty,l.unit)} × ${l.free?"मुफ्त":"₹"+l.rate}`,"₹"+l.amt,Math.round(20*big))});
  HR();
  if(b.disc)LR("छूट","−₹"+b.disc,Math.round(20*big));
  LR("कुल रकम","₹"+b.total,Math.round(28*big),true);
  if(b.pay){if(b.pay.cash)LR("नकद","₹"+b.pay.cash,Math.round(20*big));if(b.pay.upi)LR("UPI","₹"+b.pay.upi,Math.round(20*big));if(b.pay.udhar)LR("उधार","₹"+b.pay.udhar,Math.round(20*big),true)}
  if(o.balance!=null)LR("खाते में कुल बाकी","₹"+o.balance,Math.round(20*big),true);
  if(o.qr){HR();T("UPI से भुगतान करें",Math.round(18*big),"c");const q=o.qr,s=Math.min(q.width,Math.round(W*0.55));x.drawImage(q,(W-s)/2,y,s,s);y+=s+4;if(o.upi)T(o.upi,Math.round(16*big),"c")}
  HR();T("🙏 धन्यवाद! फिर पधारें",Math.round(20*big),"c",true);
  if(b.byName)T("बिलर: "+b.byName,Math.round(16*big),"c");
  y+=30;
  const out=document.createElement("canvas");out.width=W;out.height=y;out.getContext("2d").drawImage(c,0,0);return out;
};
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
  let n=0;parts.forEach(p=>n+=p.length);const all=new Uint8Array(n);let o=0;parts.forEach(p=>{all.set(p,o);o+=p.length});
  let s="";for(let i=0;i<all.length;i+=0x8000)s+=String.fromCharCode.apply(null,all.subarray(i,i+0x8000));return btoa(s);
}
SE.escpos=canvasToEscPos;
SE.printReceipt=async function(b,o){
  const cv=SE.receiptCanvas(b,o);
  if(SE.isNative){
    if(!SE.printer.addr)throw {code:"noprinter",msg:"पहले \"रेट व सेटिंग\" में प्रिंटर चुनें"};
    await N.BtPrinter.print({address:SE.printer.addr,data:canvasToEscPos(cv)});return "bt"}
  // वेब: फोन/कंप्यूटर का प्रिंट (RawBT या कोई भी प्रिंटर)
  const url=cv.toDataURL("image/png");
  printHTMLWeb(`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${SE.printer.width>400?"80mm":"58mm"} auto;margin:0}body{margin:0}img{width:100%;display:block}</style></head><body><img src="${url}"></body></html>`);
  return "web";
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
