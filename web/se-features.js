/* सब्ज़ी एक्सप्रेस — खरीद, सप्लायर, बिल-फोटो (Drive), रात का स्टॉक, दिन का पूरा हिसाब, बारकोड लेबल
   मुख्य ऐप (index.html) के S, $, esc, rs, r2, fq, item, toast… इस्तेमाल करता है। */
(function(){
"use strict";
const SF=window.SF={};
const CFG=window.SE_CONFIG||{};
const LS={get:k=>{try{return localStorage.getItem(k)||""}catch(e){return ""}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const dayAdd=(d,n)=>{const x=new Date(d+"T12:00:00");x.setDate(x.getDate()+n);return today(x)};
const num=v=>{const n=parseFloat(String(v??"").replace(",","."));return isFinite(n)?n:0};
const PAY={vikram:"विक्रम जी ने दिया",galla:"गल्ले से नकद",upi:"मेरे UPI से",udhar:"बाकी (उधार)"};

/* =============== डेटा =============== */
S.purch=[];S.purchHist=[];S.suppliers=[];S.supPay=[];S.prevStock={};
let unsubP=null;
SF.onDb=function(db){
  SF.watchCancelReqs(db);
  db.collection("suppliers").onSnapshot(s=>{S.suppliers=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.lastTs||0)-(a.lastTs||0));if(S.tab==="kharid")SF.renderKharid()},()=>{});
  db.collection("supPay").onSnapshot(s=>{S.supPay=s.docs.map(d=>({id:d.id,...d.data()}))},()=>{});
  loadHist();
  setTimeout(SF.flushPhotos,6000);setInterval(SF.flushPhotos,60000);
  window.addEventListener("online",()=>setTimeout(SF.flushPhotos,2000));
  if(S.isOwner)ensurePLU();
};
/* पिछले 20 दिन की खरीद — भाव की तुलना और संस्था का खरीद भाव */
async function loadHist(){
  if(S.demo||!S.db)return;
  try{const q=await S.db.collection("purchases").where("date",">=",dayAdd(today(),-20)).get();S.purchHist=q.docs.map(d=>({id:d.id,...d.data()}))}catch(e){}
}
SF.onDate=function(d){
  if(S.demo||!S.db)return;
  if(unsubP)try{unsubP()}catch(e){}
  unsubP=S.db.collection("purchases").where("date","==",d).onSnapshot(s=>{
    S.purch=s.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>a.ts-b.ts);
    S.purch.forEach(p=>{const i=S.purchHist.findIndex(h=>h.id===p.id);if(i>-1)S.purchHist[i]=p;else S.purchHist.push(p)});
    if(S.tab==="kharid")SF.renderKharid();else if(S.tab==="day"&&!$("#p-day").contains(document.activeElement))renderDay();
  },()=>{});
  S.prevStock={};
  S.db.doc("days/"+dayAdd(d,-1)+"/meta/stock").get().then(x=>{S.prevStock=(x.exists&&x.data().items)||{};if(S.tab==="day")renderDay()}).catch(()=>{});
};
const livePurch=()=>S.purch.filter(p=>!p.cancelled);
/* किसी सब्ज़ी का आज का खरीद (मात्रा, रकम) */
function buyOf(id,list){let q=0,a=0;(list||livePurch()).forEach(p=>(p.lines||[]).forEach(l=>{if(l.id===id){q+=num(l.qty);a+=num(l.amt)}}));return {q:r2(q*1000)/1000,a:r2(a)}}
/* पिछला खरीद भाव (इस खरीद से पहले का) */
function lastRate(id,beforeTs){
  let best=null;S.purchHist.forEach(p=>{if(p.cancelled||(beforeTs&&p.ts>=beforeTs))return;(p.lines||[]).forEach(l=>{if(l.id===id&&num(l.rate)>0&&(!best||p.ts>best.ts))best={rate:num(l.rate),ts:p.ts,date:p.date}})});
  if(best)return best;
  const it=item(id);if(it&&it.lastBuy&&num(it.lastBuy.rate)>0)return {rate:num(it.lastBuy.rate),date:it.lastBuy.date||"",ts:0};
  return it&&num(it.cost)>0?{rate:num(it.cost),date:"",ts:0}:null;
}
/* संस्था को किस भाव पर दें: आज की खरीद का औसत → पिछली खरीद → मालिक का खरीद भाव */
SF.costOf=function(it){if(!it)return 0;const b=buyOf(it.id,S.purchHist.filter(p=>!p.cancelled&&p.date===today()));if(b.q>0)return r2(b.a/b.q);const l=lastRate(it.id);return l?l.rate:(+it.cost||0)};
SF.gallaPaid=function(){return r2(livePurch().filter(p=>p.pay==="galla").reduce((a,p)=>a+num(p.paid),0))};

/* =============== बिल फोटो: फोन में कतार → Google Drive → फोन से मिटाओ =============== */
const IDB={db:null,
  open(){return this.db||(this.db=new Promise((res,rej)=>{const r=indexedDB.open("se-photos",1);r.onupgradeneeded=()=>r.result.createObjectStore("q",{keyPath:"k"});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))},
  async tx(mode,fn){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction("q",mode);const st=t.objectStore("q");const out=fn(st);t.oncomplete=()=>res(out&&out.result!==undefined?out.result:out);t.onerror=()=>rej(t.error)})},
  put(v){return this.tx("readwrite",s=>s.put(v))},del(k){return this.tx("readwrite",s=>s.delete(k))},all(){return this.tx("readonly",s=>s.getAll())}};
function shrinkPhoto(file,max=1600,q=.72){return new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const sc=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(b=>b?res(b):rej(new Error("photo")),"image/jpeg",q)};img.onerror=rej;img.src=u})}
const b64=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(blob)});
let flushing=false;
SF.pendingPhotos=async()=>{try{return (await IDB.all()).length}catch(e){return 0}};
SF.flushPhotos=async function(){
  if(flushing||S.demo||!S.db||!CFG.photoUrl||navigator.onLine===false)return;
  flushing=true;
  try{
    const list=await IDB.all();
    for(const ph of list){
      try{
        const tok=await firebase.auth().currentUser.getIdToken();
        const r=await fetch(CFG.photoUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},
          body:JSON.stringify({idToken:tok,apiKey:CFG.firebase.apiKey,pid:ph.pid,date:ph.date,name:ph.name,mime:"image/jpeg",b64:await b64(ph.blob)})});
        const j=await r.json();if(!j.ok)throw new Error(j.error||"upload");
        const F=firebase.firestore.FieldValue;
        await S.db.doc("purchases/"+ph.pid).update({photos:F.arrayUnion({id:j.id,url:j.url,ts:Date.now()}),photoPending:F.increment(-1)});
        await IDB.del(ph.k);
      }catch(e){break}
    }
  }catch(e){}
  flushing=false;
};

/* =============== 🛒 खरीद स्क्रीन =============== */
let P=null;
function blankP(){return {supId:"",lines:[],pay:"vikram",paid:"",note:"",photos:0,q:""}}
function loadDraft(){try{P=JSON.parse(LS.get("se_pdraft")||"null")}catch(e){P=null}if(!P)P=blankP();if(!P.lines)P.lines=[]}
const saveDraft=()=>LS.set("se_pdraft",JSON.stringify({...P,photos:0}));
let draftPhotos=[];
const pTotal=()=>r2(P.lines.reduce((a,l)=>a+r2(num(l.qty)*num(l.rate)),0));
const pNo=(p,idx)=>{const [y,m,d]=(p?p.date:today()).split("-");return `ख-${d}/${m}-${String(idx).padStart(2,"0")}`};
function supDue(id){const due=S.purchHist.concat(S.purch).filter((p,i,a)=>!p.cancelled&&p.supId===id&&a.findIndex(x=>x.id===p.id)===i).reduce((a,p)=>a+num(p.due),0);const paid=S.supPay.filter(x=>x.supId===id).reduce((a,x)=>a+num(x.amt),0);return r2(due-paid)}
function rateBadge(id,rate){
  const l=lastRate(id);if(!l||!(rate>0))return "";const d=r2(rate-l.rate);
  const when=l.date?" ("+fdate(l.date).slice(0,5)+")":"";
  if(Math.abs(d)<0.5)return `<span class="pill green">पिछली बार भी ${rs(l.rate)}${when}</span>`;
  const pct=Math.round(d/l.rate*100);
  return d>0?`<span class="pill red">🔺 पिछली बार ${rs(l.rate)}${when} → ${rs(rate)} (+${pct}%)</span>`:`<span class="pill blue">🔻 पिछली बार ${rs(l.rate)}${when} → ${rs(rate)} (${pct}%)</span>`;
}
SF.renderKharid=function(force){
  if(!P)loadDraft();
  const el=$("#p-kharid");if(!el)return;
  if(!force&&el.contains(document.activeElement)&&document.activeElement.matches("input[data-pl],input#pq,input#pPaid,input#pNote"))return; // टाइप करते समय दोबारा न बनाओ
  const sup=S.suppliers.find(s=>s.id===P.supId),tot=pTotal();
  const list=livePurch(),nextNo=pNo(null,S.purch.length+1);
  const qq=(P.q||"").trim().toLowerCase();
  const pick=S.items.filter(i=>i.active!==false&&(!qq||(i.name+" "+(i.alias||"")+" "+i.id).toLowerCase().includes(qq))).slice(0,qq?24:60);
  const paidV=P.pay==="udhar"?num(P.paid):tot;
  el.innerHTML=`<div class="daterow"><h2 class="sec" style="margin:0;flex:1">🛒 मंडी खरीद</h2><span class="pill blue" style="font-size:14px">नया: ${nextNo}</span></div>
  <div class="card2">
    <h3>1. दुकान / आढ़तिया</h3>
    ${sup?`<div class="supsel"><b>🏪 ${esc(sup.name)}</b><span class="note">${esc(sup.phone||"")}${supDue(sup.id)>0?` · पहले का बाकी ${rs(supDue(sup.id))}`:""}</span><button class="lnk" data-psup="">बदलें</button></div>`
    :`<div class="seg" style="margin:0">${S.suppliers.slice(0,12).map(s=>`<button class="chip" data-psup="${esc(s.id)}">🏪 ${esc(s.name)}</button>`).join("")}</div>
      <div class="row2" style="margin:0"><input class="inp" id="nsName" placeholder="नई दुकान का नाम" aria-label="नई दुकान का नाम"><input class="inp" id="nsPhone" inputmode="tel" placeholder="मोबाइल (ज़रूरी नहीं)" aria-label="दुकान का मोबाइल"></div>
      <button class="big ghost" data-nsadd>+ नई दुकान जोड़ें</button>`}
  </div>
  <div class="card2">
    <h3>2. क्या-क्या लिया</h3>
    ${P.lines.length?`<div class="plines">${P.lines.map((l,i)=>{const it=item(l.id);const amt=r2(num(l.qty)*num(l.rate));const u=it?(UNITS[it.unit]||it.unit):"";
      return `<div class="pline" data-pi="${i}">${it?tileHTML(it):'<span class="tile"><span class="em">📦</span></span>'}<div style="min-width:0">
        <div class="stkmeta"><b style="color:var(--ink);font-size:16px">${esc(it?it.name:l.name)}</b><button class="lnk" data-prm="${i}" style="color:var(--chili)">हटाएँ</button></div>
        ${it?"":`<input class="inp" data-pl="name" value="${esc(l.name||"")}" placeholder="क्या लिया (जैसे पॉलीथीन)" aria-label="सामान का नाम" style="margin-bottom:6px">`}
        <div class="pf"><label class="fld">${it&&it.unit!=="kg"?"गिनती ("+u+")":"किलो"}<input class="inp" data-pl="qty" inputmode="decimal" value="${l.qty??""}" placeholder="0"></label>
        <label class="fld">भाव ₹/${it?u:"नग"}<input class="inp" data-pl="rate" inputmode="decimal" value="${l.rate??""}" placeholder="${it&&lastRate(it.id)?lastRate(it.id).rate:"0"}"></label>
        <div class="fld"><span>रकम</span><b class="pamt">${rs(amt)}</b></div></div>
        ${it?`<div class="pbadge">${rateBadge(it.id,num(l.rate))}</div>`:""}
      </div></div>`}).join("")}</div>`:'<p class="note" style="margin:0">नीचे से सब्ज़ी चुनें।</p>'}
    <input class="inp" id="pq" type="search" placeholder="🔍 सब्ज़ी खोजें" value="${esc(P.q||"")}" autocomplete="off" aria-label="सब्ज़ी खोजें">
    <div class="ppick">${pick.map(it=>`<button data-padd="${esc(it.id)}" aria-label="${esc(it.name)}">${tileHTML(it)}<span>${esc(it.name)}</span></button>`).join("")}
      <button data-padd="" aria-label="दूसरा सामान"><span class="tile"><span class="em">📦</span></span><span>दूसरा सामान</span></button></div>
  </div>
  <div class="card2">
    <h3>3. भुगतान</h3>
    <div class="amtline" style="margin:0"><span>कुल रकम (ऐप ने जोड़ी)</span><b>${rs(tot)}</b></div>
    <div class="paym" style="margin:0">${Object.entries(PAY).map(([k,v])=>`<button data-ppay="${k}" aria-pressed="${P.pay===k}">${v}</button>`).join("")}</div>
    ${P.pay==="udhar"?`<label class="fld">अभी कितना दिया ₹ (कुछ नहीं दिया तो 0)<input class="inp" id="pPaid" inputmode="decimal" value="${esc(P.paid??"")}" placeholder="0"></label><p class="note" style="margin:0">दुकान का बाकी: <b id="pDue" style="color:var(--chili)">${rs(r2(tot-Math.min(paidV,tot)))}</b></p>`:""}
    <input class="inp" id="pNote" placeholder="कुछ लिखना हो (ज़रूरी नहीं)" value="${esc(P.note||"")}" aria-label="नोट">
  </div>
  <div class="card2">
    <h3>4. बिल की फोटो</h3>
    <p class="note" style="margin:0">फोटो छोटी होकर फोन में रुकेगी और नेट मिलते ही Google Drive में चली जाएगी, फिर फोन से अपने-आप मिट जाएगी।</p>
    <button class="big ghost" data-pphoto>📷 बिल की फोटो लें ${draftPhotos.length?"("+draftPhotos.length+" ली गईं)":""}</button>
  </div>
  <button class="big" data-psave ${tot>0?"":"disabled"}>✓ खरीद सेव करें · ${rs(tot)}</button>
  <p class="note" style="text-align:center;margin:6px 0 16px">सेव करते ही माल आज के स्टॉक में जुड़ जाएगा।</p>
  ${list.length?`<h3 style="margin:8px 0 6px">आज की खरीद · ${list.length} बिल · ${rs(r2(list.reduce((a,p)=>a+num(p.total),0)))}</h3>
  <div class="list">${list.map((p,i)=>`<button class="li" data-pview="${esc(p.id)}"><div class="mid"><b>${pNo(p,i+1)} · ${esc(p.supName||"दुकान")}</b><span>${ftime(p.ts)} · ${esc(p.byName||"")} · ${PAY[p.pay]||""}${num(p.due)>0?" · बाकी "+rs(p.due):""} · ${(p.photos||[]).length?"📷 "+(p.photos||[]).length:num(p.photoPending)>0?"📷 भेजनी बाकी":"फोटो नहीं"}</span></div><div class="rt">${rs(p.total)}<small>${(p.lines||[]).length} सामान</small></div></button>`).join("")}</div>`:""}
  ${S.isOwner?supSummaryHTML():""}`;
};
function supSummaryHTML(){
  const rows=S.suppliers.map(s=>({s,due:supDue(s.id)})).filter(x=>Math.abs(x.due)>=1);
  if(!rows.length)return "";
  return `<h3 style="margin:14px 0 6px">दुकानों का बाकी (हमें देना है)</h3><div class="list">${rows.map(x=>`<div class="li"><div class="mid"><b>🏪 ${esc(x.s.name)}</b><span>${esc(x.s.phone||"")}</span></div><div class="rt" style="color:var(--chili)">${rs(x.due)}<small><button class="lnk" data-spay="${esc(x.s.id)}">भुगतान दर्ज करें</button></small></div></div>`).join("")}</div>`;
}
function addLine(id){const it=id?item(id):null;const ex=it&&P.lines.find(l=>l.id===it.id);if(ex){toast(it.name+" पहले से जुड़ा है — मात्रा बदलें");return}
  P.lines.push({id:id||"",name:it?it.name:"",qty:"",rate:""});P.q="";saveDraft();SF.renderKharid(1);
  setTimeout(()=>{const r=document.querySelectorAll('#p-kharid .pline');const last=r[r.length-1];const f=last&&last.querySelector(id?'[data-pl="qty"]':'[data-pl="name"]');if(f)f.focus()},30)}
async function savePurchase(){
  const tot=pTotal();if(!(tot>0)){toast("पहले सामान, किलो और भाव लिखें");return}
  const bad=P.lines.find(l=>!(num(l.qty)>0)||!(num(l.rate)>0)||(!l.id&&!String(l.name||"").trim()));if(bad){toast("हर लाइन में मात्रा और भाव दोनों लिखें");return}
  const sup=S.suppliers.find(s=>s.id===P.supId);if(!sup){toast("पहले दुकान/आढ़तिया चुनें");return}
  if(S.saving)return;S.saving=true;
  const ts=Date.now(),id="p"+uid(),paid=P.pay==="udhar"?Math.min(num(P.paid),tot):tot;
  const lines=P.lines.map(l=>{const it=item(l.id);const lr=it?lastRate(it.id):null;return {id:l.id||"",name:it?it.name:String(l.name).trim(),unit:it?it.unit:"pc",qty:r2(num(l.qty)*1000)/1000,rate:r2(num(l.rate)),amt:r2(num(l.qty)*num(l.rate)),prev:lr?lr.rate:0}});
  const doc={date:today(),ts,by:S.uid||"",byName:biller(),supId:sup.id,supName:sup.name,supPhone:sup.phone||"",lines,total:tot,pay:P.pay,paid:r2(paid),due:r2(tot-paid),note:String(P.note||"").trim(),photos:[],photoPending:draftPhotos.length,cancelled:false};
  try{
    if(S.demo){S.purch.push({id,...doc});}
    else{
      for(let i=0;i<draftPhotos.length;i++)await IDB.put({k:id+"_"+i,pid:id,date:doc.date,name:`${doc.date}_${sup.name}_${i+1}.jpg`,blob:draftPhotos[i],ts});
      S.db.collection("purchases").doc(id).set(doc).catch(e=>toast("खरीद सर्वर पर नहीं गई: "+(e.code||"")));
      S.db.collection("suppliers").doc(sup.id).update({lastTs:ts}).catch(()=>{});
    }
    S.purchHist.push({id,...doc});
    const n=pNo(doc,S.purch.filter(p=>p.date===doc.date).length+(S.purch.find(p=>p.id===id)?0:1));
    P=blankP();draftPhotos=[];saveDraft();S.saving=false;SF.renderKharid(1);beep(true);
    toast("✓ खरीद "+n+" सेव · "+rs(tot)+" · माल स्टॉक में जुड़ा");
    setTimeout(SF.flushPhotos,1500);
  }catch(e){S.saving=false;toast("सेव नहीं हुई: "+(e.message||e.code||""))}
}
function viewPurchase(p){
  const idx=S.purch.findIndex(x=>x.id===p.id)+1;
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="खरीद"><div class="grab"></div>
  <div class="sh-head"><div><h3>खरीद ${pNo(p,idx||1)}</h3><span class="note">${esc(p.supName)} · ${fdate(p.date)} ${ftime(p.ts)} · ${esc(p.byName||"")}</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div class="receipt"><table>${(p.lines||[]).map(l=>`<tr><td>${esc(l.name)} <span class="note">${fq(l.qty,l.unit)} × ${rs(l.rate)}</span>${l.prev&&l.rate>l.prev*1.03?` <span class="pill red">🔺 पहले ${rs(l.prev)}</span>`:l.prev&&l.rate<l.prev*0.97?` <span class="pill blue">🔻 पहले ${rs(l.prev)}</span>`:""}</td><td class="r">${rs(l.amt)}</td></tr>`).join("")}
  <tr class="tot"><td>कुल</td><td class="r">${rs(p.total)}</td></tr></table>
  <div class="meta"><span class="pill ${p.pay==="udhar"?"red":"green"}">${PAY[p.pay]||""}${p.pay==="udhar"?" · दिया "+rs(p.paid)+" · बाकी "+rs(p.due):""}</span></div>${p.note?`<p class="note">📝 ${esc(p.note)}</p>`:""}</div>
  <h4 style="margin:10px 0 6px">बिल की फोटो</h4>
  ${(p.photos||[]).length?(p.photos||[]).map((f,i)=>`<a class="big ghost" style="margin-bottom:6px" target="_blank" rel="noopener" href="${esc(f.url)}">📷 फोटो ${i+1} देखें (Google Drive)</a>`).join(""):`<p class="note">${num(p.photoPending)>0?"📷 फोटो अभी उस फोन से Drive पर जानी बाकी है":"इस खरीद की फोटो नहीं ली गई"}</p>`}
  ${p.by===S.uid&&!p.cancelled&&!S.demo?`<button class="big ghost" data-paddphoto style="margin-top:8px">📷 और फोटो जोड़ें</button>`:""}
  </div></div>`;
  $("#sheet").onclick=e=>{if(e.target.matches("[data-close]")){closeSheet();return}
    if(e.target.closest("[data-paddphoto]")){pickPhoto(async blob=>{const k=p.id+"_x"+Date.now();await IDB.put({k,pid:p.id,date:p.date,name:`${p.date}_${p.supName}_x.jpg`,blob,ts:Date.now()});S.db.doc("purchases/"+p.id).update({photoPending:firebase.firestore.FieldValue.increment(1)}).catch(()=>{});toast("फोटो जुड़ी — नेट मिलते ही Drive पर जाएगी");closeSheet();SF.flushPhotos()})}};
}
function pickPhoto(cb){const fi=document.createElement("input");fi.type="file";fi.accept="image/*";fi.capture="environment";
  fi.onchange=async()=>{const f=fi.files[0];if(!f)return;try{toast("फोटो छोटी कर रहे हैं…");cb(await shrinkPhoto(f))}catch(e){toast("फोटो नहीं ली जा सकी")}};fi.click()}
function supPaySheet(sid){
  const s=S.suppliers.find(x=>x.id===sid);if(!s)return;
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="दुकान को भुगतान"><div class="grab"></div>
  <div class="sh-head"><h3>🏪 ${esc(s.name)} को भुगतान</h3><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <p class="note">अभी बाकी: <b style="color:var(--chili)">${rs(supDue(sid))}</b></p>
  <label class="fld">कितना दिया ₹<input class="inp" id="spAmt" inputmode="decimal"></label>
  <div class="paym">${["vikram","galla","upi"].map((k,i)=>`<button data-spm="${k}" aria-pressed="${i===0}">${PAY[k]}</button>`).join("")}</div>
  <button class="big" data-spsave>सेव करें</button></div></div>`;
  let m="vikram";
  $("#sheet").onclick=async e=>{if(e.target.matches("[data-close]")){closeSheet();return}
    const b=e.target.closest("[data-spm]");if(b){m=b.dataset.spm;document.querySelectorAll("[data-spm]").forEach(x=>x.setAttribute("aria-pressed",x===b));return}
    if(e.target.closest("[data-spsave]")){const amt=num($("#spAmt").value);if(!(amt>0)){toast("रकम लिखें");return}
      const d={supId:sid,supName:s.name,amt:r2(amt),mode:m,date:today(),ts:Date.now(),by:S.uid||"",byName:biller()};
      if(S.demo)S.supPay.push({id:uid(),...d});else S.db.collection("supPay").doc("s"+uid()).set(d).catch(()=>toast("सेव नहीं हुआ"));
      S.supPay.push({id:"tmp",...d});closeSheet();toast(s.name+" को "+rs(amt)+" दर्ज");SF.renderKharid(1)}};
}
function updDue(){const d=$("#pDue");if(d){const tot=pTotal();d.textContent=rs(r2(tot-Math.min(num(P.paid),tot)))}}
SF.bindKharid=function(){
  const el=$("#p-kharid");
  el.addEventListener("input",e=>{const t=e.target;
    if(t.id==="pq"){P.q=t.value;const pos=t.selectionStart;SF.renderKharid._q=true;const v=t.value;
      // सिर्फ़ चुनने वाली सूची बदलो, कीबोर्ड बना रहे
      const qq=v.trim().toLowerCase();const box=el.querySelector(".ppick");if(box){const pick=S.items.filter(i=>i.active!==false&&(!qq||(i.name+" "+(i.alias||"")+" "+i.id).toLowerCase().includes(qq))).slice(0,qq?24:60);
        box.innerHTML=pick.map(it=>`<button data-padd="${esc(it.id)}" aria-label="${esc(it.name)}">${tileHTML(it)}<span>${esc(it.name)}</span></button>`).join("")+`<button data-padd="" aria-label="दूसरा सामान"><span class="tile"><span class="em">📦</span></span><span>दूसरा सामान</span></button>`}return}
    if(t.dataset.pl){const i=+t.closest("[data-pi]").dataset.pi;const l=P.lines[i];if(!l)return;l[t.dataset.pl]=t.value;saveDraft();
      const row=t.closest(".pline");const amt=r2(num(l.qty)*num(l.rate));const a=row.querySelector(".pamt");if(a)a.textContent=rs(amt);
      const bdg=row.querySelector(".pbadge");if(bdg&&l.id)bdg.innerHTML=rateBadge(l.id,num(l.rate));
      const tot=pTotal();const sv=el.querySelector("[data-psave]");if(sv){sv.disabled=!(tot>0);sv.textContent="✓ खरीद सेव करें · "+rs(tot)}
      const al=el.querySelector(".amtline b");if(al)al.textContent=rs(tot);updDue();return}
    if(t.id==="pPaid"){P.paid=t.value;saveDraft();updDue();return}
    if(t.id==="pNote"){P.note=t.value;saveDraft();return}
  });
  el.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.id==="pq"){e.preventDefault();const b=el.querySelector(".ppick [data-padd]");if(b&&b.dataset.padd)addLine(b.dataset.padd)}});
  el.addEventListener("click",async e=>{
    const a=e.target.closest("[data-padd]");if(a){addLine(a.dataset.padd);return}
    const rm=e.target.closest("[data-prm]");if(rm){P.lines.splice(+rm.dataset.prm,1);saveDraft();SF.renderKharid(1);return}
    const sp=e.target.closest("[data-psup]");if(sp){P.supId=sp.dataset.psup;saveDraft();SF.renderKharid(1);return}
    if(e.target.closest("[data-nsadd]")){const name=$("#nsName").value.trim(),phone=$("#nsPhone").value.replace(/\D/g,"").slice(-10);
      if(!name){toast("दुकान का नाम लिखें");return}
      const id="s"+uid(),d={name,phone,ts:Date.now(),lastTs:Date.now(),by:S.uid||"",byName:biller()};
      if(!S.demo)S.db.collection("suppliers").doc(id).set(d).catch(()=>toast("दुकान सेव नहीं हुई"));
      if(!S.suppliers.find(x=>x.id===id))S.suppliers.unshift({id,...d});P.supId=id;saveDraft();SF.renderKharid(1);toast("🏪 "+name+" जुड़ गई");return}
    const pp=e.target.closest("[data-ppay]");if(pp){P.pay=pp.dataset.ppay;if(P.pay==="udhar"&&P.paid==="")P.paid="0";saveDraft();SF.renderKharid(1);return}
    if(e.target.closest("[data-pphoto]")){pickPhoto(b=>{draftPhotos.push(b);SF.renderKharid(1);toast("📷 फोटो ली गई ("+Math.round(b.size/1024)+" KB)")});return}
    if(e.target.closest("[data-psave]")){savePurchase();return}
    const v=e.target.closest("[data-pview]");if(v){const p=S.purch.find(x=>x.id===v.dataset.pview);if(p)viewPurchase(p);return}
    const pay=e.target.closest("[data-spay]");if(pay){supPaySheet(pay.dataset.spay);return}
  });
};

/* =============== 🌙 रात का स्टॉक + 📊 दिन का पूरा हिसाब =============== */
function dayRows(){
  const st=S.stock.items||{},ps=S.prevStock||{},bills=liveBills();
  return S.items.filter(i=>!i.track).map(it=>{
    const o=st[it.id]||{},pv=ps[it.id]||{};
    const prev=pv.close!==undefined&&pv.close!==""?num(pv.close):0;
    const extra=num(o.open); // पुराने तरीके से हाथ से लिखा "सुबह आया"
    const b=buyOf(it.id);const buyQ=r2((b.q+extra)*1000)/1000,buyA=r2(b.a+num(o.amt));
    let instQ=0,saleQ=0;bills.forEach(x=>(x.lines||[]).forEach(l=>{if(l.id===it.id){if(x.mode==="inst")instQ+=num(l.qty);else saleQ+=num(l.qty)}}));
    instQ=r2(instQ*1000)/1000;saleQ=r2(saleQ*1000)/1000;
    const waste=num(o.waste),hasClose=o.close!==undefined&&o.close!=="",close=hasClose?num(o.close):null;
    const avail=r2((prev+buyQ)*1000)/1000,expect=r2((avail-instQ-saleQ-waste)*1000)/1000;
    const short=hasClose?r2((expect-close)*1000)/1000:null,tol=it.unit==="kg"?0.15:0.99;
    const rate=buyQ>0&&buyA>0?r2(buyA/buyQ):SF.costOf(it);
    return {it,prev,buyQ,buyA,instQ,saleQ,waste,close,expect,avail,short,rate,flag:short!=null&&short>tol,extra:short!=null&&short<-tol,active:avail>0||instQ>0||saleQ>0||hasClose};
  });
}
SF.dayStockHTML=function(){
  const rows=dayRows().filter(r=>r.active);
  const flags=rows.filter(r=>r.flag);
  const P2=dayMoney(rows);
  return `${S.isOwner?P2.html:""}
  <div class="card2"><h3>🌙 रात का स्टॉक</h3>
    <p class="note" style="margin:0">दुकान बंद करते समय बचा माल तौलकर डालें। "होना चाहिए" = कल रात का + आज की खरीद − बिका − संस्था।</p>
    <button class="big" data-night>🌙 रात का स्टॉक डालें</button></div>
  ${flags.length?`<div class="warn">⚠ ${flags.length} सब्ज़ियों में माल कम निकला: ${flags.map(r=>esc(r.it.name)+" "+fq(r.short,r.it.unit)).join(", ")}</div>`:""}
  <h3 style="margin:0 0 4px">माल का हिसाब (सब्ज़ी-वार)</h3>
  <div class="list">${rows.map(r=>{const it=r.it,id=esc(it.id);return `<div class="stkrow" data-sid="${id}">${tileHTML(it)}<div style="min-width:0">
    <div class="stkmeta"><b style="color:var(--ink);font-size:16px">${esc(it.name)}</b><span>${r.rate?`खरीद ${rs(r.rate)}/${UNITS[it.unit]||it.unit}`:""}</span></div>
    <div class="dgrid"><span>कल रात<b>${fq(r.prev,it.unit)}</b></span><span>+ खरीदा<b>${fq(r.buyQ,it.unit)}</b></span><span>− बिका<b>${fq(r.saleQ,it.unit)}</b></span><span>− संस्था<b>${fq(r.instQ,it.unit)}</b></span></div>
    <div class="stkf" style="grid-template-columns:1fr 1fr"><label class="fld">खराब हुआ<input class="inp" id="sw-${id}" data-sk="waste" inputmode="decimal" value="${r.waste||""}"></label>
    <label class="fld">रात बचा (होना चाहिए ${fq(Math.max(0,r.expect),it.unit)})<input class="inp ${r.flag?"bad":""}" id="sc-${id}" data-sk="close" inputmode="decimal" value="${r.close??""}"></label></div>
    ${r.short!=null?`<div class="stkmeta" style="margin-top:4px">${r.flag?`<span class="pill red">कमी ${fq(r.short,it.unit)} · ${rs(r2(r.short*(+it.sale||0)))}</span>`:r.extra?`<span class="pill blue">${fq(-r.short,it.unit)} ज़्यादा बचा</span>`:'<span class="pill green">✓ हिसाब मिला</span>'}</div>`:""}
  </div></div>`}).join("")||'<div class="empty">आज अभी कोई माल नहीं — "खरीद" में मंडी की खरीद डालें</div>'}</div>`;
};
function dayMoney(rows){
  const bills=liveBills(),sale=bills.filter(b=>b.mode!=="inst"),inst=bills.filter(b=>b.mode==="inst");
  const sum=(a,f)=>r2(a.reduce((x,y)=>x+f(y),0));
  const openVal=r2(rows.reduce((a,r)=>a+r.prev*r.rate,0));
  const buyAll=sum(livePurch(),p=>num(p.total))+r2(rows.reduce((a,r)=>a+num((S.stock.items||{})[r.it.id]?.amt),0));
  const instVal=sum(inst,b=>b.total);
  const allClosed=rows.length&&rows.every(r=>r.close!=null);
  const closeVal=r2(rows.reduce((a,r)=>a+(r.close!=null?r.close:Math.max(0,r.expect))*r.rate,0));
  const cogs=r2(openVal+buyAll-instVal-closeVal);
  const sales=sum(sale,b=>b.total),profit=r2(sales-cogs);
  const expSale=r2(rows.reduce((a,r)=>{const used=r.avail-r.instQ-(r.close!=null?r.close:Math.max(0,r.expect))-r.waste;return a+Math.max(0,used)*(+r.it.sale||0)},0));
  const gap=r2(expSale-sales);
  const html=`<div class="card2" style="border:1.5px solid var(--leaf)"><h3>📊 आज का पूरा हिसाब ${allClosed?"":'<span class="pill blue">रात का स्टॉक बाकी — अभी अंदाज़ा</span>'}</h3>
    <div class="stkmeta"><span>कल रात बचा माल (खरीद भाव)</span><b>${rs(openVal)}</b></div>
    <div class="stkmeta"><span>+ आज की खरीद (${livePurch().length} बिल)</span><b>${rs(buyAll)}</b></div>
    <div class="stkmeta"><span>− संस्थाओं को दिया</span><b>${rs(instVal)}</b></div>
    <div class="stkmeta"><span>− आज रात बचा माल</span><b>${rs(closeVal)}</b></div>
    <div class="amtline" style="margin:0"><span>= ग्राहकों को बिका माल (लागत)</span><b>${rs(cogs)}</b></div>
    <div class="stkmeta"><span>ग्राहकों से बिक्री</span><b>${rs(sales)}</b></div>
    <div class="amtline" style="margin:0;background:${profit>=0?"var(--leaf-bg,#e7f5ec)":"var(--chili-bg)"}"><span>असली मुनाफ़ा</span><b style="color:${profit>=0?"var(--leaf)":"var(--chili)"}">${rs(profit)}</b></div>
    <div class="stkmeta"><span>मैनेजर के भाव पर बिक्री होनी चाहिए थी</span><b>${rs(expSale)}</b></div>
    ${Math.abs(gap)>=20?`<div class="${gap>0?"warn":"note"}" style="margin:0">${gap>0?`⚠ ${rs(gap)} की बिक्री कम आई — कम भाव, मुफ्त, खराब या माल कम`:`बोर्ड भाव से ${rs(-gap)} ज़्यादा बिका`}</div>`:'<span class="pill green">✓ बिक्री भाव के हिसाब से ठीक</span>'}
  </div>`;
  return {html,openVal,buyAll,instVal,closeVal,cogs,sales,profit,expSale,gap};
}
SF.dayKpi=()=>{const rows=dayRows().filter(r=>r.active);return {buy:dayMoney(rows).buyAll,short:r2(rows.reduce((a,r)=>a+(r.flag?r.short*(+r.it.sale||0):0),0))}};
function nightSheet(){
  const rows=dayRows().filter(r=>r.active&&r.avail>0);
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="रात का स्टॉक"><div class="grab"></div>
  <div class="sh-head"><div><h3>🌙 रात का स्टॉक · ${fdate(S.billsDate)}</h3><span class="note">तौलकर असली बचा माल लिखें</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div class="list" style="margin:0">${rows.map(r=>`<div class="nrow">${tileHTML(r.it)}<div><b>${esc(r.it.name)}</b><span class="note">होना चाहिए ${fq(Math.max(0,r.expect),r.it.unit)}</span></div>
    <input class="inp" data-nclose="${esc(r.it.id)}" inputmode="decimal" placeholder="${r.it.unit==="kg"?"किलो":"गिनती"}" value="${r.close??""}" aria-label="${esc(r.it.name)} कितना बचा"></div>`).join("")||'<p class="note">आज कोई माल नहीं।</p>'}</div>
  <button class="big" data-nsave style="margin-top:12px">✓ रात का स्टॉक सेव करें</button></div></div>`;
  $("#sheet").onclick=async e=>{if(e.target.matches("[data-close]")){closeSheet();return}
    if(e.target.closest("[data-nsave]")){const items=S.stock.items||(S.stock.items={});let n=0;
      document.querySelectorAll("[data-nclose]").forEach(i=>{const v=i.value.trim();if(v==="")return;(items[i.dataset.nclose]||(items[i.dataset.nclose]={})).close=num(v);n++});
      await saveStock();closeSheet();renderDay();toast("🌙 "+n+" सब्ज़ियों का रात का स्टॉक सेव")}};
  $("#sheet").onkeydown=e=>{if(e.key==="Enter"&&e.target.dataset.nclose){e.preventDefault();const all=[...document.querySelectorAll("[data-nclose]")];const i=all.indexOf(e.target);if(all[i+1])all[i+1].focus();else e.target.blur()}};
  const f=document.querySelector("[data-nclose]");if(f)f.focus();
}
SF.bindDay=function(){$("#p-day").addEventListener("click",e=>{if(e.target.closest("[data-night]"))nightSheet()})};

/* =============== 🏷️ बारकोड लेबल =============== */
/* दुकान के अंदर वाला GS1 तरीका (20–29 सिर्फ़ अपनी दुकान के लिए): 20 + सामान कोड(5) + 00000 + जाँच अंक = पक्का कोड।
   (21 + कोड + वज़न ग्राम भी पढ़ लेता है — आगे तराज़ू वाले लेबल के लिए) */
function ean13check(d12){let s=0;for(let i=0;i<12;i++)s+=(+d12[i])*(i%2?3:1);return String((10-s%10)%10)}
SF.vwCode=(plu,kind,val)=>{const d=(kind==="wt"?"21":"20")+String(plu).padStart(5,"0").slice(-5)+String(kind==="wt"?Math.round(val):0).padStart(5,"0").slice(-5);return d+ean13check(d)};
SF.parseVW=function(code){
  code=String(code||"").trim();if(!/^2[01]\d{11}$/.test(code)||ean13check(code.slice(0,12))!==code[12])return null;
  const plu=+code.slice(2,7),v=+code.slice(7,12);const it=S.items.find(i=>+i.plu===plu);if(!it)return {bad:true,plu};
  return code[1]==="1"?{it,qty:r2(v/1000*1000)/1000,kind:"wt"}:{it,qty:1,kind:"fix"};
};
async function ensurePLU(){
  if(S.demo||!S.isOwner||ensurePLU.busy)return;ensurePLU.busy=true;try{
  const used=new Set(S.items.map(i=>+i.plu).filter(Boolean));let next=Math.max(100,...used)+1;
  for(const it of S.items.filter(i=>!i.plu)){while(used.has(next))next++;used.add(next);it.plu=next;try{await S.db.doc("items/"+it.id).update({plu:next})}catch(e){}next++}
  }finally{ensurePLU.busy=false}
}
SF.ensurePLU=ensurePLU;
const SIZES={"50x25":[50,25],"40x30":[40,30],"38x25":[38,25],"60x40":[60,40],"75x50":[75,50],"100x50":[100,50],"100x75":[100,75]};
/* दो तरह के लेबल:
   🥬 सब्ज़ी — टोकरी/लोरी के खाने पर एक बार चिपकाओ: नाम + भाव/किलो + बारकोड (स्कैन पर वज़न पूछेगा)
   🛒 किराना — हर पैकेट पर पक्का: दुकान का नाम, सामान, पैकेट की मात्रा, कीमत, एक्सपायरी, बारकोड */
let L={id:"",type:"",copies:"1",size:LS.get("se_lsize")||"50x25",pack:"",price:"",exp:"",mfg:"",q:""};
const isKirana=it=>it&&(it.cat==="packed"||it.unit==="pc"&&it.cat!=="sabzi"&&it.cat!=="patta"&&it.cat!=="fal");
function itemCode(it){
  const own=String(it.barcode||"").split(",").map(x=>x.trim()).filter(Boolean)[0];
  if(own)return own;                       // कंपनी का अपना बारकोड (पैकेट पर पहले से छपा)
  return it.plu?SF.vwCode(it.plu,"fix",0):""; // हमारा अपना पक्का कोड: 20 + सामान कोड + 00000
}
function labelSpec(){
  const it=item(L.id);if(!it)return null;
  const kir=L.type==="kirana";
  return {it,kir,code:itemCode(it),name:it.name,
    price:kir?(num(L.price)||+it.sale||0):(+it.sale||0),unit:it.unit,
    pack:kir?(String(L.pack||it.pack||"").trim()):"",
    exp:kir&&L.exp?fdate(L.exp):"",mfg:kir&&L.mfg?fdate(L.mfg):""};
}
SF.labelCanvas=function(sp,sizeKey){
  const [wmm,hmm]=SIZES[sizeKey||L.size]||SIZES["50x25"];const W=wmm*8,H=hmm*8,P=10;
  const c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  x.fillStyle="#fff";x.fillRect(0,0,W,H);x.fillStyle="#000";x.textBaseline="top";
  const F='"Baloo 2","Mukta","Noto Sans Devanagari",sans-serif';
  const font=(t,sz,maxW,w)=>{let s=sz;do{x.font=`${w||700} ${s}px ${F}`;s--}while(x.measureText(t).width>maxW&&s>9);return s+1};
  const ctr=(t,y,sz,w)=>{const s=font(t,sz,W-2*P,w);const tw=x.measureText(t).width;x.fillText(t,(W-tw)/2,y);return s};
  let y=4;
  if(sp.kir){
    y+=ctr("सब्ज़ी एक्सप्रेस · जालीपा कैंट",y,Math.round(H*.075),600)+1;x.fillRect(P,y,W-2*P,2);y+=4;
    y+=ctr(sp.name,y,Math.round(H*.13),800)+1;
    const row=[sp.pack,"₹"+sp.price].filter(Boolean);
    const s=font(row.join("    "),Math.round(H*.12),W-2*P,800);
    if(sp.pack)x.fillText(sp.pack,P,y);const pw=x.measureText("₹"+sp.price).width;x.fillText("₹"+sp.price,W-P-pw,y);y+=s+1;
    const dt=[sp.mfg?"पैक: "+sp.mfg:"",sp.exp?"एक्सपायरी: "+sp.exp:""].filter(Boolean).join("   ");
    if(dt)y+=ctr(dt,y,Math.round(H*.068),700)+2;
  }else{
    y+=ctr(sp.name,y,Math.round(H*.2),800)+1;
    y+=ctr("₹"+sp.price+" / "+(sp.unit==="kg"?"किलो":(UNITS[sp.unit]||sp.unit)),y,Math.round(H*.13),800)+2;
  }
  if(sp.code&&window.JsBarcode){const bc=document.createElement("canvas");const ean=/^\d{13}$/.test(sp.code)&&ean13check(sp.code.slice(0,12))===sp.code[12];
    try{JsBarcode(bc,sp.code,{format:ean?"EAN13":"CODE128",width:2,height:60,displayValue:true,fontSize:16,margin:0,textMargin:1,background:"#fff",lineColor:"#000",flat:true});
      const bh=H-y-3,sc=Math.min((W-2*P)/bc.width,bh/bc.height);const bw=Math.round(bc.width*sc),bhh=Math.round(bc.height*sc);x.imageSmoothingEnabled=false;x.drawImage(bc,Math.round((W-bw)/2),H-bhh-2,bw,bhh)}catch(e){}}
  return c;
};
/* TSPL लेबल प्रिंटर के लिए बाइट */
function tspl(cv,sizeKey,copies){const [w,h]=SIZES[sizeKey]||SIZES["50x25"];return SE.tspl(cv,{wmm:w,hmm:h,copies})}
SF.labelPrinter={get addr(){return LS.get("se_lbl")},get name(){return LS.get("se_lbl_n")},get type(){return LS.get("se_lbl_t")||"tspl"}};
async function printLabels(){
  const sp=labelSpec();if(!sp){toast("पहले सामान चुनें");return}
  if(!sp.code){toast("इस सामान का कोड नहीं बना — विक्रम जी एक बार ऐप खोलें");return}
  if(!(sp.price>0)){toast("कीमत लिखें");return}
  const n=Math.max(1,Math.min(300,Math.round(num(L.copies)||1)));const cv=SF.labelCanvas(sp,L.size);
  const how=LS.get("se_lout")||"label";
  try{
    if(how==="a4"){const url=cv.toDataURL("image/png");const [w,h]=SIZES[L.size];
      await SE.printA4("बारकोड लेबल · "+sp.name,`<style>.lg{display:flex;flex-wrap:wrap;gap:2mm}.lg img{width:${w}mm;height:${h}mm;border:0.2mm dashed #bbb}</style><div class="lg">${Array.from({length:n},()=>`<img src="${url}">`).join("")}</div>`)}
    else if(!SE.isNative){const url=cv.toDataURL("image/png");const [w,h]=SIZES[L.size];
      await SE.printA4("लेबल",`<style>@page{size:${w}mm ${h}mm;margin:0}body{margin:0}h1,.sub{display:none}img{width:${w}mm;height:${h}mm;display:block;page-break-after:always}</style>${Array.from({length:n},()=>`<img src="${url}">`).join("")}`)}
    else{const pr=SF.labelPrinter;if(!pr.addr)throw {msg:"पहले \"रेट व सेटिंग\" में लेबल प्रिंटर चुनें"};
      if(pr.type==="escpos"){const one=SE.escpos(cv);let all="";for(let i=0;i<n;i++)all+=atob(one);await SENative.BtPrinter.print({address:pr.addr,data:btoa(all)})}
      else await SENative.BtPrinter.print({address:pr.addr,data:tspl(cv,L.size,n)});
      toast("🏷️ "+n+" लेबल छप रहे हैं")}
    if(!S.demo)S.db.collection("labelLog").doc("l"+uid()).set({itemId:sp.it.id,name:sp.name,type:L.type,code:sp.code,price:sp.price,pack:sp.pack,exp:L.exp||"",copies:n,date:today(),ts:Date.now(),by:S.uid||"",byName:biller()}).catch(()=>{});
    // किराना: पैकेट की मात्रा याद रखो (मालिक के फोन से)
    if(sp.kir&&S.isOwner&&!S.demo&&sp.pack&&sp.pack!==(sp.it.pack||""))S.db.doc("items/"+sp.it.id).update({pack:sp.pack}).catch(()=>{});
  }catch(e){toast(e.msg||("प्रिंट नहीं हुआ: "+(e.message||"")))}
}
function pickList(type,qq){
  return S.items.filter(i=>i.active!==false&&(type==="kirana"?isKirana(i):!isKirana(i))&&(!qq||(i.name+" "+(i.alias||"")).toLowerCase().includes(qq))).slice(0,qq?24:60)
    .map(i=>`<button data-lpick="${esc(i.id)}">${tileHTML(i)}<span>${esc(i.name)}</span></button>`).join("");
}
SF.renderLabel=function(force){
  const el=$("#p-label");if(!el)return;
  if(!force&&el.contains(document.activeElement)&&document.activeElement.matches("input"))return SF.drawPreview();
  const it=item(L.id),qq=(L.q||"").trim().toLowerCase();
  const head=`<h2 class="sec">🏷️ बारकोड लेबल</h2>
  <div class="paym" style="margin:0 0 12px"><button data-ltype="sabzi" aria-pressed="${L.type==="sabzi"}">🥬 सब्ज़ी की टोकरी</button><button data-ltype="kirana" aria-pressed="${L.type==="kirana"}">🛒 किराना पैकेट</button></div>`;
  if(!L.type){el.innerHTML=head+`<div class="card2"><p class="note" style="margin:0"><b>🥬 सब्ज़ी:</b> लोरी/टोकरी के खाने पर एक बार चिपकाएँ — नाम, भाव और बारकोड। स्कैन करने पर ऐप वज़न पूछेगा।<br><b>🛒 किराना:</b> हर पैकेट पर पक्का लेबल — दुकान का नाम, सामान, मात्रा (जैसे ½ किलो), कीमत, एक्सपायरी और बारकोड। स्कैन करते ही बिल में।</p></div>`;return}
  if(!it){el.innerHTML=head+`<div class="card2"><h3>${L.type==="kirana"?"कौन-सा किराना सामान?":"कौन-सी सब्ज़ी?"}</h3>
    <input class="inp" id="lq" type="search" placeholder="🔍 खोजें" value="${esc(L.q||"")}" autocomplete="off" aria-label="खोजें">
    <div class="ppick">${pickList(L.type,qq)||'<p class="note">कोई सामान नहीं मिला।</p>'}</div></div>
    ${L.type==="kirana"&&S.isOwner?`<div class="card2"><h3>+ नया किराना सामान</h3>
      <input class="inp" id="kNm" placeholder="नाम (जैसे चीनी, मूंग दाल)">
      <div class="row2" style="margin:0"><input class="inp" id="kPk" placeholder="मात्रा (जैसे 500 ग्राम)"><input class="inp" id="kPr" inputmode="decimal" placeholder="बिक्री ₹"></div>
      <div class="row2" style="margin:0"><input class="inp" id="kCo" inputmode="decimal" placeholder="खरीद ₹ (ज़रूरी नहीं)"><input class="inp" id="kBc" inputmode="numeric" placeholder="कंपनी का बारकोड (हो तो)"></div>
      <button class="big ghost" data-knew>सामान जोड़ें</button></div>`:""}`;return}
  const kir=L.type==="kirana";
  el.innerHTML=head+`<div class="card2"><div class="supsel">${tileHTML(it)}<b>${esc(it.name)}</b><span class="note">${it.barcode?"कंपनी बारकोड":"कोड "+(it.plu||"—")} · ${rs(+it.sale||0)}${kir?"":"/"+(UNITS[it.unit]||it.unit)}</span><button class="lnk" data-lpick="">बदलें</button></div>
    ${kir?`<div class="row2" style="margin:0"><label class="fld">पैकेट की मात्रा<input class="inp" id="lPack" value="${esc(L.pack||it.pack||"")}" placeholder="जैसे 500 ग्राम"></label><label class="fld">कीमत ₹<input class="inp" id="lPrice" inputmode="decimal" value="${esc(L.price||it.sale||"")}"></label></div>
    <div class="row2" style="margin:0"><label class="fld">पैक तारीख (ज़रूरी नहीं)<input class="inp" id="lMfg" type="date" value="${esc(L.mfg)}"></label><label class="fld">एक्सपायरी<input class="inp" id="lExp" type="date" value="${esc(L.exp)}"></label></div>`
    :`<p class="note" style="margin:0">भाव "रेट व सेटिंग" वाला ही छपेगा। भाव बदले तो नया लेबल छापकर पुराने के ऊपर चिपका दें — बारकोड वही रहेगा।</p>`}
    <div class="row2" style="margin:0"><label class="fld">कितने लेबल<input class="inp" id="lCopies" inputmode="numeric" value="${esc(L.copies)}"></label><span></span></div>
    <div class="seg" style="margin:0">${Object.keys(SIZES).map(k=>`<button class="chip" data-lsize="${k}" aria-pressed="${L.size===k}">${k.replace("x","×")} mm</button>`).join("")}</div>
    <div class="lprev"><canvas id="lPrev"></canvas></div>
    <div class="paym" style="margin:0"><button data-lout="label" aria-pressed="${(LS.get("se_lout")||"label")==="label"}">🏷️ लेबल प्रिंटर</button><button data-lout="a4" aria-pressed="${LS.get("se_lout")==="a4"}">📄 A4 स्टिकर शीट</button></div>
    <button class="big" data-lprint>🖨️ लेबल छापें</button>
    <p class="note" style="margin:0">${kir?"बिलिंग में यह पैकेट स्कैन करते ही 1 पैकेट बिल में जुड़ जाएगा।":"बिलिंग में यह बारकोड स्कैन करते ही "+esc(it.name)+" का वज़न पूछेगा।"}</p></div>`;
  SF.drawPreview();
};
SF.drawPreview=function(){const cv=$("#lPrev");if(!cv)return;const sp=labelSpec();if(!sp)return;const src=SF.labelCanvas(sp,L.size);cv.width=src.width;cv.height=src.height;cv.getContext("2d").drawImage(src,0,0);
  const b=$("[data-lprint]");if(b)b.textContent=`🖨️ ${Math.max(1,Math.round(num(L.copies)||1))} लेबल छापें`};
SF.bindLabel=function(){
  const el=$("#p-label");
  el.addEventListener("input",e=>{const t=e.target;
    if(t.id==="lq"){L.q=t.value;const box=el.querySelector(".ppick");if(box)box.innerHTML=pickList(L.type,t.value.trim().toLowerCase());return}
    const map={lPack:"pack",lPrice:"price",lCopies:"copies",lExp:"exp",lMfg:"mfg"};if(map[t.id]){L[map[t.id]]=t.value;SF.drawPreview()}});
  el.addEventListener("click",async e=>{
    const ty=e.target.closest("[data-ltype]");if(ty){L.type=ty.dataset.ltype;L.id="";L.q="";SF.renderLabel(1);return}
    const p=e.target.closest("[data-lpick]");if(p){L.id=p.dataset.lpick;L.q="";const it=item(L.id);L.pack=it&&it.pack||"";L.price="";SF.renderLabel(1);return}
    const s=e.target.closest("[data-lsize]");if(s){L.size=s.dataset.lsize;LS.set("se_lsize",L.size);SF.renderLabel(1);return}
    const o=e.target.closest("[data-lout]");if(o){LS.set("se_lout",o.dataset.lout);SF.renderLabel(1);return}
    if(e.target.closest("[data-lprint]")){printLabels();return}
    if(e.target.closest("[data-knew]")){
      const name=$("#kNm").value.trim(),pack=$("#kPk").value.trim(),sale=num($("#kPr").value),cost=num($("#kCo").value),bc=$("#kBc").value.replace(/\s/g,"");
      if(!name||!(sale>0)){toast("नाम और बिक्री ₹ लिखें");return}
      if(bc&&findByCode(bc)){toast("यह बारकोड पहले से "+findByCode(bc).name+" में है");return}
      const id="k"+uid(),used=S.items.map(i=>+i.plu||0);
      const it={name,pack,emoji:"🛒",cat:"packed",unit:"pc",sale,cost,hue:210,order:S.items.length+1,active:true,barcode:bc,track:true,alias:"",plu:Math.max(100,...used)+1};
      try{if(!S.demo)await S.db.collection("items").doc(id).set(it);if(!item(id))S.items.push({id,...it});if(!S.demo&&window.logPrice)logPrice(id,"sale",0,sale);
        L.id=id;L.pack=pack;SF.renderLabel(1);toast(name+" जुड़ गया — अब लेबल छापें")}catch(err){toast("नहीं जुड़ा — सिर्फ़ विक्रम जी जोड़ सकते हैं")}}
  });
};
/* सेटिंग में लेबल प्रिंटर */
SF.labelSettingsHTML=function(){
  const pr=SF.labelPrinter;
  return `<div class="card2"><h3>🏷️ बारकोड लेबल प्रिंटर</h3>
  <p class="note" style="margin:0">${SE.isNative?(pr.addr?`चुना हुआ: <b>${esc(pr.name)}</b> · ${pr.type==="escpos"?"रसीद वाला (ESC/POS)":"लेबल वाला (TSPL)"}`:"पहले फोन की Bluetooth सेटिंग में लेबल प्रिंटर pair करें।"):"लेबल प्रिंटर Android ऐप में चुना जाता है।"}</p>
  ${SE.isNative?`<div class="row2" style="margin:0"><button class="big ghost" data-lprn="tspl">लेबल प्रिंटर (TSC/Xprinter)</button><button class="big ghost" data-lprn="escpos">रसीद प्रिंटर पर लेबल</button></div><div id="lprnList"></div>
  <div class="row2" style="margin:0"><label class="fld">लेबल के बीच गैप (mm)<input class="inp" id="lGap" inputmode="decimal" value="${esc(LS.get("se_lgap")||"2")}"></label>
  <label class="note lsw" style="align-self:end"><input type="checkbox" id="lInv" ${LS.get("se_linv")==="1"?"checked":""}> लेबल उल्टा (काला-सफ़ेद) छपे तो</label></div>`:""}</div>`;
};
SF.bindLabelSettings=function(){
  $("#p-set").addEventListener("click",async e=>{
    const b=e.target.closest("[data-lprn]");if(b){try{const list=await SE.printer.list();$("#lprnList").innerHTML=list.map(d=>`<button class="big ghost" data-lprnset="${esc(d.address)}" data-n="${esc(d.name||d.address)}" data-t="${b.dataset.lprn}">🏷️ ${esc(d.name||d.address)}</button>`).join("")||'<p class="note">कोई pair किया प्रिंटर नहीं मिला।</p>'}catch(err){toast(err.msg||err.message||"Bluetooth की अनुमति दें")}return}
    const s=e.target.closest("[data-lprnset]");if(s){LS.set("se_lbl",s.dataset.lprnset);LS.set("se_lbl_n",s.dataset.n);LS.set("se_lbl_t",s.dataset.t);renderSettings();toast("लेबल प्रिंटर चुना: "+s.dataset.n)}});
  $("#p-set").addEventListener("change",e=>{if(e.target.id==="lGap")LS.set("se_lgap",e.target.value.trim()||"2");if(e.target.id==="lInv")LS.set("se_linv",e.target.checked?"1":"0")});
};
/* =============== 📈 रिपोर्ट के ग्राफ़ (हल्के SVG, कोई भारी लाइब्रेरी नहीं) =============== */
const CH={data:null,at:0,busy:false};
async function loadWeek(){
  if(CH.busy||S.demo||!S.db)return;CH.busy=true;
  try{const end=S.repDate||today(),days=[];for(let i=6;i>=0;i--)days.push(dayAdd(end,-i));
    const bills=await Promise.all(days.map(d=>d===S.billsDate?Promise.resolve(S.dayBills):S.db.collection("days/"+d+"/bills").get().then(q=>q.docs.map(x=>x.data())).catch(()=>[])));
    const pur=await S.db.collection("purchases").where("date",">=",days[0]).get().then(q=>q.docs.map(x=>x.data())).catch(()=>[]);
    CH.data=days.map((d,i)=>{const b=bills[i].filter(x=>!x.cancelled);const sale=r2(b.filter(x=>x.mode!=="inst").reduce((a,x)=>a+(x.total||0),0));
      const cost=r2(b.filter(x=>x.mode!=="inst").reduce((a,x)=>a+(x.lines||[]).reduce((y,l)=>y+(l.cost||0)*(l.qty||0),0),0));
      const buy=r2(pur.filter(p=>p.date===d&&!p.cancelled).reduce((a,p)=>a+num(p.total),0));return {d,sale,buy,gm:r2(sale-cost),n:b.length}});
    CH.at=Date.now();CH.end=end;
  }catch(e){}
  CH.busy=false;if(S.tab==="report")renderReport();
}
function weekSVG(rows){
  const W=340,H=170,L=34,B=24,T=10,max=Math.max(100,...rows.map(r=>Math.max(r.sale,r.buy)));
  const bw=(W-L-6)/rows.length,y=v=>T+(H-T-B)*(1-v/max),ticks=[0,max/2,max];
  const k=v=>v>=1000?(Math.round(v/100)/10)+"k":Math.round(v);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="7 दिन की बिक्री और खरीद">
  ${ticks.map(t=>`<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="currentColor" opacity=".12"/><text x="${L-4}" y="${y(t)+4}" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">${k(t)}</text>`).join("")}
  ${rows.map((r,i)=>{const x=L+i*bw+bw*.12,w=bw*.36;const [,m,dd]=r.d.split("-");const tod=r.d===today();
    return `<rect x="${x}" y="${y(r.sale)}" width="${w}" height="${Math.max(0,H-B-y(r.sale))}" rx="3" fill="#1f8a4c"><title>${fdate(r.d)} बिक्री ${rs(r.sale)}</title></rect>
    <rect x="${x+w+2}" y="${y(r.buy)}" width="${w}" height="${Math.max(0,H-B-y(r.buy))}" rx="3" fill="#f0a500"><title>${fdate(r.d)} खरीद ${rs(r.buy)}</title></rect>
    ${r.sale?`<text x="${x+w/2}" y="${y(r.sale)-3}" font-size="9" text-anchor="middle" fill="currentColor">${k(r.sale)}</text>`:""}
    <text x="${x+w+1}" y="${H-8}" font-size="10" text-anchor="middle" fill="currentColor" font-weight="${tod?800:400}">${dd}/${m}</text>`}).join("")}
  </svg>`;
}
SF.chartsHTML=function(){
  if(!S.isOwner)return "";
  const end=S.repDate||today();
  if(!CH.data||CH.end!==end||Date.now()-CH.at>120000)setTimeout(loadWeek,0);
  const bills=liveBills(),sale=bills.filter(b=>b.mode!=="inst"),inst=bills.filter(b=>b.mode==="inst");
  const sum=(a,f)=>r2(a.reduce((x,y)=>x+f(y),0));
  const mix=[["नकद",sum(sale,b=>b.pay.cash||0),"#1f8a4c"],["UPI",sum(sale,b=>b.pay.upi||0),"#2f6fdb"],["उधार",sum(sale,b=>b.pay.udhar||0),"#d64545"],["संस्था",sum(inst,b=>b.total),"#8a63d2"]];
  const mt=mix.reduce((a,m)=>a+m[1],0);
  const per={};sale.forEach(b=>(b.lines||[]).forEach(l=>{per[l.name]=r2((per[l.name]||0)+(l.amt||0))}));
  const top=Object.entries(per).sort((a,b)=>b[1]-a[1]).slice(0,8),tmax=top.length?top[0][1]:1;
  const hours=new Array(24).fill(0);sale.forEach(b=>{hours[new Date(b.ts).getHours()]+=b.total||0});
  const hs=hours.map((v,h)=>({h,v})).filter(x=>x.h>=6&&x.h<=22),hmax=Math.max(1,...hs.map(x=>x.v));
  const wk=CH.data&&CH.end===end?CH.data:null;
  const wkSale=wk?r2(wk.reduce((a,r)=>a+r.sale,0)):0,wkBuy=wk?r2(wk.reduce((a,r)=>a+r.buy,0)):0;
  return `<div class="chart"><h3>📊 पिछले 7 दिन</h3><p class="note">${wk?`कुल बिक्री ${rs(wkSale)} · कुल मंडी खरीद ${rs(wkBuy)}`:"लोड हो रहा है…"}</p>
    ${wk?weekSVG(wk):'<div style="height:170px"></div>'}
    <div class="legend"><span><i style="background:#1f8a4c"></i>बिक्री (ग्राहक)</span><span><i style="background:#f0a500"></i>मंडी खरीद</span></div></div>
  ${mt>0?`<div class="chart"><h3>💳 आज पैसा कैसे आया</h3>
    <div class="mixbar">${mix.filter(m=>m[1]>0).map(m=>`<span style="flex:${m[1]};background:${m[2]}">${Math.round(m[1]/mt*100)}%</span>`).join("")}</div>
    <div class="legend">${mix.map(m=>`<span><i style="background:${m[2]}"></i>${m[0]} ${rs(m[1])}</span>`).join("")}</div></div>`:""}
  ${top.length?`<div class="chart"><h3>🥇 आज सबसे ज़्यादा बिकी</h3>${top.map(([n,v])=>`<div class="hbar"><span>${esc(n)}</span><span class="t"><i style="width:${Math.max(3,v/tmax*100)}%"></i></span><b>${rs(v)}</b></div>`).join("")}</div>`:""}
  ${sale.length?`<div class="chart"><h3>⏰ किस समय कितनी बिक्री</h3>
    <svg viewBox="0 0 340 90" role="img" aria-label="घंटे के हिसाब से बिक्री">${hs.map((x,i)=>{const bw=340/hs.length,hh=x.v/hmax*62;return `<rect x="${i*bw+2}" y="${70-hh}" width="${bw-4}" height="${hh}" rx="2" fill="#1f8a4c" opacity="${x.v?1:.15}"><title>${x.h}–${x.h+1} बजे: ${rs(x.v)}</title></rect>${x.h%3===0?`<text x="${i*bw+bw/2}" y="85" font-size="9" text-anchor="middle" fill="currentColor">${x.h>12?x.h-12:x.h}${x.h>=12?"pm":"am"}</text>`:""}`}).join("")}</svg></div>`:""}`;
};

/* =============== बिल नंबर: हर दिन 1 से, पर ग्राहक/बाहर वाले को तारीख या गिनती नहीं दिखती =============== */
/* अंदर: (दिन-क्रमांक × 10 + फोन) × 1000 + आज का क्रम → गुप्त गुणा → 6 अक्षर।  ऐप वापस खोलकर तारीख और क्रम बता देता है। */
const BN={M:2176782336n,A:1000000007n,B:777777777n,AI:1863926711n,E:Date.UTC(2026,0,1)};
const dayIdx=d=>Math.round((Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))-BN.E)/864e5);
SF.encodeBill=function(date,serial,dev){const x=BigInt((dayIdx(date)*10+(dev||0))*1000+serial);const y=(BN.A*x+BN.B)%BN.M;return "SE-"+y.toString(36).toUpperCase().padStart(6,"0")};
SF.decodeBill=function(no){const m=/^SE-([0-9A-Z]{6})$/.exec(String(no||""));if(!m)return null;
  const y=BigInt(parseInt(m[1],36));const x=Number((((y-BN.B)%BN.M+BN.M)%BN.M*BN.AI)%BN.M);
  const serial=x%1000,dev=Math.floor(x/1000)%10,di=Math.floor(x/10000);if(di<0||di>40000||serial<1)return null;
  const dt=new Date(BN.E+di*864e5);const date=dt.getUTCFullYear()+"-"+String(dt.getUTCMonth()+1).padStart(2,"0")+"-"+String(dt.getUTCDate()).padStart(2,"0");
  return {date,serial,dev}};
SF.billLabel=no=>{const d=SF.decodeBill(no);return d?`${fdate(d.date)} का बिल #${d.serial}${d.dev?" · बिना नेट बना":""}`:""};
function devSlot(){let v=LS.get("se_dev");if(!v){v=String(1+Math.floor(Math.random()*9));LS.set("se_dev",v)}return +v}
SF.reserveBillNo=async function(){
  const d=today(),k="se_cnt_"+d,loc=+LS.get(k)||0;
  if(!S.demo&&S.db&&navigator.onLine!==false){
    try{const ref=S.db.doc("days/"+d+"/meta/counter");
      const n=await Promise.race([S.db.runTransaction(async t=>{const g=await t.get(ref);const n=Math.max(g.exists?(+g.data().n||0):0,loc)+1;t.set(ref,{n,ts:Date.now()},{merge:true});return n}),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),5000))]);
      if(n>=1&&n<=999){LS.set(k,String(n));return SF.encodeBill(d,n,0)}
    }catch(e){}
  }
  // बिना नेट: आगे का क्रम इसी फोन से; फोन-निशान अलग ताकि दो फोन का कोड कभी न टकराए। नेट आने पर सर्वर का क्रम इससे आगे बढ़ेगा।
  const n=loc+1;LS.set(k,String(n));
  return SF.encodeBill(d,Math.min(n,999),devSlot());
};

/* =============== 🧾 कागज़ जैसी रसीद + सेटल + शेयर =============== */
SF.qrCanvas=function(amount,no){
  if(!window.QRCode||!upiId())return null;const box=document.createElement("div");
  const upi=`upi://pay?pa=${encodeURIComponent(upiId())}&pn=${encodeURIComponent(UPI_FIXED.payee)}${amount>0?"&am="+(+amount).toFixed(2):""}&cu=INR&tn=${encodeURIComponent("Sabji Express | Bill No "+no)}`;
  try{new QRCode(box,{text:upi,width:240,height:240,correctLevel:QRCode.CorrectLevel.M})}catch(e){return null}
  return box.querySelector("canvas");
};
SF.rcptOpts=function(b,withQr){
  const due=b.pay?(b.pay.udhar||0):b.total;
  return {shop:"सब्ज़ी एक्सप्रेस",tag:"ताज़ी सब्ज़ी, आपके दरवाज़े पर",addr:"जालीपा कैंट, बाड़मेर",phone:S.settings.shopPh||"",
    date:fdate(b.date||today())+"  "+ftime(b.ts||Date.now()),fq,qr:withQr&&b.mode!=="inst"?SF.qrCanvas(due,b.no):null,upi:upiId(),payee:UPI_FIXED.payee,
    balance:b.partyId?r2(bal(b.partyId)+(b.pay?0:0)):null,paid:!!b.pay};
};
SF.paperHTML=function(b,o){
  o=o||{};const ed=!!o.editable;const sub=r2((b.lines||[]).reduce((a,l)=>a+(l.amt||0),0));
  const pay=b.pay;const stamp=pay?[pay.cash?"नकद "+rs(pay.cash):"",pay.upi?"UPI "+rs(pay.upi):"",pay.udhar?"उधार "+rs(pay.udhar):"",b.mode==="inst"?"संस्था · खरीद भाव":""].filter(Boolean).join(" · "):"";
  return `<div class="paper${o.anim?" pp-anim":""}">
  <div class="pp-head"><div class="pp-logo">🥬</div><b>सब्ज़ी एक्सप्रेस</b><small>ताज़ी सब्ज़ी, आपके दरवाज़े पर · जालीपा कैंट, बाड़मेर${S.settings.shopPh?" · 📞 "+esc(S.settings.shopPh):""}</small></div>
  <div class="pp-rule"></div>
  <div class="pp-meta"><span>बिल नं <b>${esc(b.no||"…")}</b></span><span>${fdate(b.date||today())} · ${ftime(b.ts||Date.now())}</span></div>
  <div class="pp-meta"><span>ग्राहक: <b>${esc(b.partyName||"आम ग्राहक")}</b>${b.custPhone?" · "+esc(b.custPhone):""}</span><span>बिलर: ${esc(b.byName||"")}</span></div>
  <div class="pp-dash"></div>
  <table class="pp-t"><thead><tr><th>क्र.</th><th>सामान</th><th class="r">मात्रा</th><th class="r">भाव</th><th class="r">रकम</th>${ed?"<th></th>":""}</tr></thead><tbody>
  ${(b.lines||[]).map((l,i)=>`<tr${ed?` data-edit="${i}"`:""}><td>${i+1}</td><td>${esc(l.name)}${l.changed?' <span class="pp-chg">भाव बदला</span>':""}${l.free?' <span class="pp-chg">मुफ्त</span>':""}</td><td class="r">${fq(l.qty,l.unit).replace(" कि.ग्रा"," kg")}</td><td class="r">${l.free?"—":"₹"+l.rate}</td><td class="r"><b>₹${l.amt}</b></td>${ed?`<td><button class="pp-x" data-del="${i}" aria-label="${esc(l.name)} हटाएँ">✕</button></td>`:""}</tr>`).join("")}
  </tbody></table>
  <div class="pp-dash"></div>
  ${b.disc?`<div class="pp-row"><span>जोड़</span><span>₹${sub}</span></div><div class="pp-row"><span>छूट</span><span>−₹${b.disc}</span></div>`:""}
  <div class="pp-total"><span>कुल रकम</span><b>₹${b.total}</b></div>
  <div class="pp-row note"><span>${(b.lines||[]).length} सामान</span><span>${b.partyId&&!ed?"खाते में कुल बाकी ₹"+r2(bal(b.partyId)):""}</span></div>
  ${stamp?`<div class="pp-stamp${b.cancelled?" red":""}">${b.cancelled?"रद्द · "+esc(b.cancelReason||""):"✓ "+esc(stamp)}</div>`:""}
  ${o.qr&&b.mode!=="inst"&&upiId()?`<div class="pp-qr"><div id="${o.qrId||"ppqr"}"></div><b>स्कैन करके भुगतान करें · ₹${o.qrAmt!=null?o.qrAmt:b.total}</b><span>${esc(UPI_FIXED.payee)} · ${esc(upiId())}</span></div>`:""}
  <div class="pp-dash"></div>
  <div class="pp-thanks">🙏 धन्यवाद! फिर पधारें</div>
  </div>`;
};
function drawQR(id,amt,no){const el=document.getElementById(id);if(!el||!window.QRCode||!upiId())return;el.innerHTML="";
  try{new QRCode(el,{text:`upi://pay?pa=${encodeURIComponent(upiId())}&pn=${encodeURIComponent(UPI_FIXED.payee)}&am=${(+amt).toFixed(2)}&cu=INR&tn=${encodeURIComponent("Sabji Express | Bill No "+no)}`,width:190,height:190,correctLevel:QRCode.CorrectLevel.M})}catch(e){}}
function draftBill(){
  const c=S.chk,party=S.parties.find(p=>p.id===S.partyId);
  const custName=S.mode==="inst"?S.inst:S.mode==="udhar"?(party?party.name:""):(S.cust.name||(S.cust.phone?"ग्राहक "+S.cust.phone:"आम ग्राहक"));
  return {no:c.no,date:today(),ts:c.ts||(c.ts=Date.now()),mode:S.mode,partyId:S.mode==="udhar"?S.partyId:"",partyName:custName,custPhone:S.cust.phone||(party&&party.phone)||"",
    byName:biller(),lines:S.cart,sub:cartTotal(),disc:+c.disc||0,total:chkTotal()};
}
SF.shareBill=async function(b,phone,saved){
  try{toast("📄 बिल का PDF बन रहा है…");
    const how=await SE.shareReceipt(b,SF.rcptOpts(b,!saved||(b.pay&&b.pay.udhar>0)),phone,receiptText(b));
    if(how==="download")toast("बिल की फोटो डाउनलोड हुई — WhatsApp में भेज दें")}
  catch(e){if(e&&e.code==="oldapk"){toast(e.msg);location.href=waLink(receiptText(b),phone);return}toast(e.msg||("शेयर नहीं हुआ: "+(e.message||"")))}
};
SF.drawCheckout=function(){
  const c=S.chk,tot=chkTotal(),party=S.parties.find(p=>p.id===S.partyId),b=draftBill();
  const anyChg=S.cart.some(l=>l.changed);
  const overLim=S.mode==="udhar"&&party&&(+party.limit>0)&&(bal(party.id)+tot>+party.limit);
  const st=c.stage||"bill";
  let body="";
  if(st==="bill"){
    body=`${anyChg?`<div class="warn">⚠ इस बिल में किसी सब्ज़ी का भाव बदला गया है। मालिक को रिपोर्ट में दिखेगा।</div>`:""}
    ${overLim?`<div class="warn">⚠ ${esc(party.name)} की उधार सीमा ${rs(party.limit)} है। इस बिल के बाद बाकी ${rs(bal(party.id)+tot)} हो जाएगा।</div>`:""}
    <div class="pp-slot"><div class="pp-printer"></div>${SF.paperHTML(b,{editable:true,qr:S.mode!=="inst",anim:!c.shown})}</div>
    <p class="note" style="text-align:center;margin:6px 0 10px">किसी सामान पर टैप करके मात्रा बदलें · ✕ से हटाएँ</p>
    ${S.mode==="inst"?"":`<label class="fld" style="margin-bottom:10px">छूट (₹) — ज़रूरी हो तभी<input class="inp ${(+c.disc)>0?"bad":""}" id="discIn" inputmode="decimal" value="${c.disc||""}" placeholder="0"></label>`}
    <div class="pp-actions"><button data-ckedit>✏️<span>एडिट</span></button><button data-ckshare>📤<span>शेयर (PDF)</span></button><button data-ckprint>🖨️<span>प्रिंट</span></button></div>
    <button class="big" data-settle ${tot<=0&&S.mode!=="inst"?"disabled":""}>✓ बिल सेटल करें · ${rs(tot)}</button>
    <button class="big ghost" data-hold style="margin-top:8px">+ दूसरा ग्राहक (यह बिल ऊपर टैब में खुला रहेगा)</button>`;
  }else{
    const pays=S.mode==="inst"?[["inst","🏠 संस्था खाते में"]]:[["upi","📱 UPI / QR"],["cash","💵 नकद"],["udhar","📒 पूरा उधार"],["split","🔀 नकद + बाकी उधार"]];
    let payUI="";
    if(c.pay==="cash"){const g=parseFloat(c.given)||0;payUI=`<label class="fld">ग्राहक ने कितने दिए? (बाकी लौटाने का हिसाब)<input class="inp" id="givenIn" inputmode="decimal" value="${esc(c.given)}" placeholder="जैसे 500"></label>${g>0?`<p style="font-size:18px;margin:8px 0 12px">लौटाने हैं: <b style="color:${g>=tot?"var(--leaf)":"var(--chili)"}">${g>=tot?rs(g-tot):"₹"+(tot-g)+" कम दिए"}</b></p>`:"<div style='height:12px'></div>"}`}
    if(c.pay==="upi")payUI=upiId()?`<div class="qrbox"><div class="qr" id="qr"></div><b>${rs(tot)}</b><span class="note">${esc(UPI_FIXED.payee)} · ${esc(upiId())}</span><span class="note">पैसा आने का मैसेज देखकर ही नीचे बटन दबाएँ।</span></div>`:`<div class="warn">UPI ID नहीं है।</div>`;
    if(c.pay==="split"){const cp=parseFloat(c.cashPart)||0;payUI=`<label class="fld">अभी कितना नकद मिला?<input class="inp" id="cashIn" inputmode="decimal" value="${esc(c.cashPart)}"></label><p style="margin:8px 0 12px">उधार में जाएगा: <b style="color:var(--chili)">${rs(Math.max(0,tot-cp))}</b></p>`}
    if(c.pay==="udhar")payUI=`<p style="margin:0 0 12px">पूरे <b style="color:var(--chili)">${rs(tot)}</b> ${esc(b.partyName)} के खाते में उधार चढ़ेंगे।</p>`;
    if(c.pay==="inst")payUI=`<p style="margin:0 0 12px" class="note">${esc(b.partyName)} को खरीद भाव पर माल। पैसा नहीं लिया जाएगा।</p>`;
    body=`<div class="settle-sum"><span>बिल ${esc(c.no)} · ${(b.lines||[]).length} सामान</span><b>${rs(tot)}</b></div>
    <h3 style="margin:4px 0 8px">पैसा कैसे मिला?</h3>
    <div class="paym">${pays.map(([k,v])=>`<button data-pay="${k}" aria-pressed="${c.pay===k||c.udPick===k}">${v}</button>`).join("")}</div>
    ${c.udPick?udBoxHTML():""}
    ${payUI}
    <button class="big ${c.pay==="upi"?"haldi":""}" data-save ${c.udPick||S.saving||(c.pay==="upi"&&!upiId())||tot<=0&&S.mode!=="inst"||c.no==="…"?"disabled":""}>${S.saving?"सेव हो रहा है…":c.pay==="upi"?"✓ पैसा आ गया · बिल सेव करें":"✓ बिल सेव करें"}</button>
    <button class="big ghost" data-unsettle style="margin-top:8px">← बिल पर वापस</button>`;
  }
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="बिल"><div class="grab"></div>
    <div class="sh-head"><div><h3>${st==="bill"?"🧾 आपका बिल":"💰 बिल सेटल करें"}</h3><span class="note">बिलर: ${esc(biller())}</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
    ${body}</div></div>`;
  c.shown=true;
  if(st==="bill"&&S.mode!=="inst")drawQR("ppqr",tot,c.no);
  if(st==="settle"&&c.pay==="upi")drawQR("qr",tot,c.no);
  const sh=$("#sheet");
  sh.oninput=e=>{if(e.target.id==="udQ"){c.udQ=e.target.value;const l=$("#udList");if(l)l.innerHTML=udListHTML(c.udQ)}};
  sh.onclick=async e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    if(e.target.closest("[data-settle]")){c.stage="settle";if(!c.payPicked)c.pay=S.mode==="inst"?"inst":"upi";SF.drawCheckout();return}
    if(e.target.closest("[data-unsettle]")){c.stage="bill";c.udPick=null;SF.drawCheckout();return}
    if(e.target.closest("[data-ckedit]")){closeSheet();toast("✏️ सामान जोड़ें/बदलें, फिर नीचे 'बिल देखें' दबाएँ");return}
    if(e.target.closest("[data-ckshare]")){if(c.no==="…"){toast("बिल नंबर बन रहा है, एक पल…");return}SF.shareBill(draftBill(),b.custPhone,false);return}
    if(e.target.closest("[data-ckprint]")){if(c.no==="…"){toast("बिल नंबर बन रहा है, एक पल…");return}printBill(draftBill());return}
    const p=e.target.closest("[data-pay]");if(p&&!p.disabled){const k=p.dataset.pay;c.payPicked=true;if((k==="udhar"||k==="split")&&S.mode==="walk"){c.udPick=k;c.udQ=S.cust.phone||S.cust.name||"";SF.drawCheckout();const f=$("#udQ");if(f)f.focus();return}c.udPick=null;c.pay=k;SF.drawCheckout();return}
    const up=e.target.closest("[data-udp]");if(up){pickUdhar(up.dataset.udp);return}
    if(e.target.closest("[data-udnew]")){const name=$("#udName").value.trim(),phone=$("#udPh").value.replace(/\D/g,"").slice(-10),qtr=$("#udQtr").value.trim();
      if(!name){toast("नाम लिखें");return}if(phone&&phone.length!==10){toast("मोबाइल नंबर 10 अंक का होना चाहिए");return}
      const id="p"+Date.now().toString(36);
      try{if(S.demo)S.parties.push({id,name,phone,qtr});else{await S.db.collection("parties").doc(id).set({name,phone,qtr,ts:Date.now(),by:S.uid||"",byName:biller()});if(!S.parties.find(x=>x.id===id))S.parties.push({id,name,phone,qtr})}toast(name+" का उधार खाता बना");pickUdhar(id)}catch(err){toast("खाता नहीं बना, दोबारा कोशिश करें")}return}
    const d=e.target.closest("[data-del]");if(d){e.stopPropagation();S.cart.splice(+d.dataset.del,1);refreshAfterCart();if(!S.cart.length)closeSheet();else SF.drawCheckout();return}
    const edr=e.target.closest("[data-edit]");if(edr){const l=S.cart[+edr.dataset.edit];const it=item(l.id);if(it)openQty(it,+edr.dataset.edit);return}
    if(e.target.closest("[data-hold]")){holdCurrent();return}
    if(e.target.closest("[data-save]"))saveBill();
  };
  sh.onchange=e=>{
    if(e.target.id==="discIn"){c.disc=Math.max(0,parseFloat(e.target.value)||0);SF.drawCheckout()}
    if(e.target.id==="givenIn"){c.given=e.target.value;SF.drawCheckout()}
    if(e.target.id==="cashIn"){c.cashPart=e.target.value;SF.drawCheckout()}
  };
};

/* =============== 🚫 बिल रद्द करने की अर्ज़ी → विक्रम जी के WhatsApp + ऐप में =============== */
S.cancelReqs=[];
SF.watchCancelReqs=function(db){
  db.collection("cancelReq").where("status","==","pending").onSnapshot(s=>{S.cancelReqs=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.ts-a.ts);
    if(S.isOwner){renderTabs();if(S.tab==="report")renderReport();if(S.cancelReqs.length&&!SF._crToast){SF._crToast=1;toast("🚫 "+S.cancelReqs.length+" बिल रद्द करने की अर्ज़ी आई है — रिपोर्ट में देखें")}}},()=>{});
};
SF.cancelReqHTML=function(b,fresh){
  if(S.isOwner||S.demo||b.cancelled||b.pending)return "";
  const mine=S.cancelReqs.find(r=>r.no===b.no);
  if(mine)return `<div class="warn" style="margin-top:10px">⏳ इस बिल को रद्द करने की अर्ज़ी विक्रम जी के पास गई है — उनके फैसले का इंतज़ार</div>`;
  return `<details class="creq"><summary>🚫 यह बिल रद्द करवाना है? (विक्रम जी को अर्ज़ी)</summary>
    <label class="fld">रद्द करने की वजह<input class="inp" id="crWhy" placeholder="जैसे ग्राहक ने सामान लौटाया / गलत बिल बना"></label>
    <button class="big ghost" data-creq style="margin-top:8px;color:var(--chili)">📩 अर्ज़ी विक्रम जी को भेजें</button></details>`;
};
SF.sendCancelReq=async function(b){
  const why=($("#crWhy")?.value||"").trim();if(!why){toast("पहले रद्द करने की वजह लिखें");return}
  const req={no:b.no,date:b.date,total:b.total,partyName:b.partyName||"",byName:biller(),by:S.uid||"",reason:why,ts:Date.now(),status:"pending",billBy:b.byName||""};
  try{await S.db.collection("cancelReq").doc(b.no).set(req)}catch(e){toast("अर्ज़ी सेव नहीं हुई: "+(e.code||""));return}
  S.cancelReqs.push({id:b.no,...req});
  const lbl=SF.billLabel(b.no);
  const txt=`🚫 *बिल रद्द करने की अर्ज़ी*\nसब्ज़ी एक्सप्रेस\n━━━━━━━━━━━━\n🧾 बिल नं: ${b.no}\n📅 ${fdate(b.date)} · ${ftime(b.ts)}\n👤 ग्राहक: ${b.partyName||""}\n💰 रकम: ₹${b.total}\n📝 वजह: ${why}\n🧑‍🌾 अर्ज़ी: ${biller()}\n━━━━━━━━━━━━\nविक्रम जी, कृपया ऐप की "रिपोर्ट" में जाकर मंज़ूर या मना करें।`;
  const ph=String(S.settings.ownerPh||"").replace(/\D/g,"").slice(-10);
  closeSheet();toast("📩 अर्ज़ी ऐप में दर्ज हो गई");
  if(ph.length===10)location.href=waLink(txt,ph);else toast("विक्रम जी का WhatsApp नंबर सेटिंग में नहीं है — अर्ज़ी सिर्फ़ ऐप में गई");
};
SF.cancelReqsHTML=function(){
  if(!S.isOwner||!S.cancelReqs.length)return "";
  return `<div class="card2" style="border:2px solid var(--chili)"><h3 style="color:var(--chili)">🚫 बिल रद्द करने की अर्ज़ियाँ (${S.cancelReqs.length})</h3>
  ${S.cancelReqs.map(r=>`<div class="creq-row"><div><b>${esc(r.no)} · ${rs(r.total)}</b><span class="note">${fdate(r.date)} · ग्राहक ${esc(r.partyName)} · बिल ${esc(r.billBy)} · अर्ज़ी ${esc(r.byName)}</span><span>📝 ${esc(r.reason)}</span></div>
    <div class="row2" style="margin:0"><button class="big" data-crok="${esc(r.id)}" style="background:var(--chili);color:#fff">✓ रद्द करें</button><button class="big ghost" data-crno="${esc(r.id)}">✗ मना करें</button></div></div>`).join("")}</div>`;
};
SF.decideCancel=async function(id,ok){
  const r=S.cancelReqs.find(x=>x.id===id);if(!r)return;
  try{
    if(ok){const ref=S.db.doc("days/"+r.date+"/bills/"+r.no);const g=await ref.get();if(!g.exists){toast("बिल नहीं मिला");return}const b=g.data();
      if(!b.cancelled){await ref.update({cancelled:true,cancelledBy:S.uid||"",cancelReason:"अर्ज़ी: "+r.reason+" ("+r.byName+")",cancelTs:Date.now()});
        if(b.pay&&b.pay.udhar>0){try{await S.db.doc("ledger/"+b.no).delete()}catch(e){}}
        await adjStock(trackedPairs(b.lines||[],1),"रद्द बिल "+b.no)}}
    await S.db.doc("cancelReq/"+id).update({status:ok?"approved":"rejected",decidedTs:Date.now()});
    S.cancelReqs=S.cancelReqs.filter(x=>x.id!==id);renderTabs();renderReport();toast(ok?"बिल रद्द किया":"अर्ज़ी मना की — बिल वैसा ही रहेगा");
  }catch(e){toast("नहीं हुआ: "+(e.code||e.message||""))}
};

/* A4 रिपोर्ट में खरीद */
SF.purchA4HTML=function(){
  const list=livePurch();if(!list.length)return "";
  const tot=r2(list.reduce((a,p)=>a+num(p.total),0));
  const by={};list.forEach(p=>{by[p.pay]=r2((by[p.pay]||0)+num(p.paid));});
  return `<h2>मंडी खरीद (${list.length} बिल · ${rs(tot)})</h2><table><tr><th>नं</th><th>दुकान</th><th>किसने</th><th>सामान</th><th class="r">रकम</th><th>भुगतान</th><th>फोटो</th></tr>
  ${list.map((p,i)=>`<tr><td>${pNo(p,i+1)}</td><td>${esc(p.supName||"")}</td><td>${esc(p.byName||"")}</td><td>${(p.lines||[]).map(l=>`${esc(l.name)} ${fq(l.qty,l.unit)}×${rs(l.rate)}${l.prev&&l.rate>l.prev*1.03?" 🔺":""}`).join(", ")}</td><td class="r">${rs(p.total)}</td><td>${PAY[p.pay]||""}${num(p.due)>0?" · बाकी "+rs(p.due):""}</td><td>${(p.photos||[]).length?(p.photos||[]).map((f,j)=>`<a href="${esc(f.url)}">${j+1}</a>`).join(" "):"—"}</td></tr>`).join("")}</table>
  <p>भुगतान: ${Object.entries(by).map(([k,v])=>`${PAY[k]||k} ${rs(v)}`).join(" · ")}</p>`;
};
SF.bindKharid();SF.bindLabel();SF.bindDay();SF.bindLabelSettings();
})();
