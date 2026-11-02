/* सब्ज़ी एक्सप्रेस — 💾 पहले बिल सेव, फिर 💰 भुगतान (सेटल); ✏️ सेव के बाद बिल बदलना (सिर्फ़ मात्रा/नया सामान, भाव पक्के) + बदलाव का पूरा हिसाब */
(function(){
"use strict";
const SB=window.SB={};
const num=v=>{const n=parseFloat(String(v??"").replace(",","."));return isFinite(n)?n:0};
const FV=()=>window.firebase&&firebase.firestore&&firebase.firestore.FieldValue;
const outboxGet=()=>{try{return JSON.parse(localStorage.getItem("se_outbox")||"[]")}catch(e){return []}};
const outboxSet=o=>{try{localStorage.setItem("se_outbox",JSON.stringify(o))}catch(e){}};
const findBill=no=>(S.dayBills||[]).find(b=>b.no===no);
const unpaid=()=>(S.dayBills||[]).filter(b=>b.settled===false&&!b.cancelled&&b.date===today());
SB.unpaid=unpaid;
/* सर्वर पर या फोन (बिना नेट) में बिल बदलो */
async function patchBill(b,ch){
  Object.assign(b,ch);
  const o=outboxGet();const i=o.findIndex(x=>x.bill.no===b.no);
  if(i>-1&&!(o[i].done&&o[i].done.b)){Object.assign(o[i].bill,ch);outboxSet(o);return}
  if(S.demo||!S.db)return;
  await S.db.doc("days/"+b.date+"/bills/"+b.no).update(ch);
}
const sumLines=L=>r2(L.reduce((a,l)=>a+num(l.amt),0));
const lineTxt=l=>l.name+" "+fq(l.qty,l.unit);

/* ================= 💰 भुगतान (सेटल) ================= */
SB.settleSheet=function(b,offline){
  if(!b)return;const tot=num(b.total);
  const st={pay:b._np||(b.mode==="udhar"&&b.partyId)?"udhar":"upi",given:"",cashPart:"",partyId:b._np||b.partyId||"",q:"",ph:"",why:""};delete b._np;
  const draw=()=>{
    const party=S.parties.find(p=>p.id===st.partyId);
    const needParty=st.pay==="udhar"||st.pay==="split";
    let ui="";
    if(st.pay==="upi")ui=upiId()?`<p class="note sb-upin">📱 QR से स्कैन करवाएँ · पैसा आने का मैसेज देखकर ही नीचे दबाएँ</p>`:`<div class="warn">UPI ID सेटिंग में नहीं है</div>`;
    if(st.pay==="cash"){const g=num(st.given);ui=`<div class="sb-line">💵 दिए ₹<input class="inp" id="sbGiven" inputmode="decimal" value="${esc(st.given)}" placeholder="ज़रूरी नहीं" aria-label="ग्राहक ने कितने दिए"><span>→ लौटाने <b id="sbChg">${g>0?rs(Math.max(0,r2(g-tot))):"—"}</b></span></div>`}
    if(st.pay==="split")ui=`<div class="sb-line">💵 अभी नकद ₹<input class="inp" id="sbCash" inputmode="decimal" value="${esc(st.cashPart)}" aria-label="अभी कितना नकद मिला"><span>→ उधार <b style="color:var(--chili)">${rs(Math.max(0,r2(tot-num(st.cashPart))))}</b></span></div>`;
    if(needParty){
      const q=st.q.trim().toLowerCase();const L=S.parties.filter(p=>!q||(p.name||"").toLowerCase().includes(q)||String(p.phone||"").includes(q)||String(p.qtr||"").toLowerCase().includes(q)).slice(0,6);
      ui+=party?SB.udCheckHTML(party,SB.udAmt(b,st),st)
        :`<div class="udbox"><b>उधार किसके नाम?</b><input class="inp" id="sbPq" placeholder="नाम, क्वार्टर या मोबाइल से खोजें" value="${esc(st.q)}" autocomplete="off">
          <div class="udlist">${L.map(p=>`<button data-sbp="${esc(p.id)}"><div>${esc(p.name)}<br><span>${p.qtr?"क्वार्टर "+esc(p.qtr)+" · ":""}${esc(p.phone||"नंबर नहीं")}</span></div><span>${bal(p.id)>0?"बाकी "+rs(bal(p.id)):"साफ़"}</span></button>`).join("")||'<p class="note" style="margin:4px">कोई नहीं मिला</p>'}</div>
          <button class="big ghost" data-sbnewp>+ नया उधार खाता</button></div>`;
    }
    const ok=!(needParty&&!party)&&!(st.pay==="upi"&&!upiId());
    const udBtn=needParty&&party?"📒 "+rs(SB.udAmt(b,st))+" उधार पक्का करें — "+party.name:"";
    const big=st.pay==="upi"?"✓ पैसा आ गया · सेव "+rs(tot):udBtn?udBtn:st.pay==="split"?"✓ सेव + सेटल · नकद "+rs(Math.min(tot,num(st.cashPart)))+" + उधार":"✓ सेव + सेटल "+rs(tot);
    $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px sb1" role="dialog" aria-label="बिल और भुगतान"><div class="grab"></div>
    <div class="sh-head ppc-sh"><h3>🧾 बिल <small class="note">· ${esc(b.no)}</small> <span class="sb-ok">${offline||b.pending?"📴 फोन में सेव":"✓ सेव"}</span></h3><button class="x" data-close aria-label="बंद करें">✕</button></div>
    ${SF.compactPaperHTML(b,{qr:true,qrId:"sbqr",tap:true})}
    <div class="paym paym4" role="group" aria-label="भुगतान का तरीका">${[["upi","📱","UPI"],["cash","💵","नकद"],["udhar","📒","उधार"],["split","🔀","नकद+उधार"]].map(([k,i,v])=>`<button data-sbpay="${k}" aria-pressed="${st.pay===k}"><i>${i}</i>${v}</button>`).join("")}</div>
    ${ui}
    <div class="sb-act4"><button data-sbedit2><i>✏️</i>एडिट</button><button data-sbphoto><i>📷</i>फोटो${b.photoN?" ("+b.photoN+")":""}</button><button data-sbshare><i>📤</i>शेयर</button><button data-sbprint><i>🖨️</i>प्रिंट</button></div>
    <div class="sb-bot"><button class="big ghost" data-sblater>➕ नया ग्राहक</button><button class="big ${st.pay==="upi"?"haldi":""}" data-sbok ${ok?"":"disabled"}>${esc(big)}</button></div>
    </div></div>`;
    if(window.SF&&SF.drawPaperQR)SF.drawPaperQR(b,"sbqr",150);
  };
  draw();
  const sh=$("#sheet");
  sh.oninput=e=>{if(e.target.id==="sbUph"){st.ph=e.target.value;return}if(e.target.id==="sbUwhy"){st.why=e.target.value;return}if(e.target.id==="sbPq"){st.q=e.target.value;const pos=e.target.selectionStart;draw();const f=$("#sbPq");if(f){f.focus();try{f.setSelectionRange(pos,pos)}catch(x){}}}};
  sh.onchange=e=>{if(e.target.id==="sbCash"){st.cashPart=e.target.value;draw()}};
  const _oi=sh.oninput;sh.oninput=e=>{if(e.target.id==="sbGiven"){st.given=e.target.value;const g=num(st.given),c=$("#sbChg");if(c)c.textContent=g>0?rs(Math.max(0,r2(g-tot))):"—";return}_oi(e)};
  sh.onclick=async e=>{
    if(e.target.matches("[data-close]")||e.target.closest("[data-sblater]")){closeSheet();if(e.target.closest("[data-sblater]"))toast("⏳ बिल "+b.no+" रुका है — ऊपर \"भुगतान बाकी\" में · नया ग्राहक शुरू करें");try{renderPane()}catch(x){}return}
    const rw=e.target.closest("[data-sbrow]");if(rw){SB.editSheet(b);return}
    if(e.target.closest("[data-sbphoto]")){if(window.SF&&SF.addBillPhoto)SF.addBillPhoto(b,()=>{const x=sh.querySelector("[data-sbphoto]");if(x)x.innerHTML="<i>📷</i>फोटो ("+b.photoN+")"});return}
    if(e.target.closest("[data-sbshare]")){const p=S.parties.find(x=>x.id===st.partyId);if(window.SF)SF.shareBill(b,(p&&p.phone)||b.custPhone,false);return}
    if(e.target.closest("[data-sbprint]")){if(typeof printBill==="function")printBill(b);return}
    const p=e.target.closest("[data-sbpay]");if(p){st.pay=p.dataset.sbpay;draw();return}
    const pp=e.target.closest("[data-sbp]");if(pp){st.partyId=pp.dataset.sbp;draw();return}
    if(e.target.closest("[data-sbpch]")){st.partyId="";st.ph="";st.why="";draw();return}
    if(e.target.closest("[data-sbnewp]")){openNewParty(id=>{b._np=id;setTimeout(()=>SB.settleSheet(b),50)});return}
    if(e.target.closest("[data-sbedit2]")){SB.editSheet(b);return}
    if(e.target.closest("[data-sbok]")){
      const party=S.parties.find(p=>p.id===st.partyId);
      if((st.pay==="udhar"||st.pay==="split")&&party){const c=SB.udCheck(party,SB.udAmt(b,st));
        if(st.pay==="split"&&!(SB.udAmt(b,st)>0)){toast("नकद पूरा मिल गया — 💵 नकद चुनें");return}
        if(c.noPh&&SB.ph10(st.ph).length!==10){toast("📱 "+party.name+" का 10 अंक का मोबाइल नंबर डालें");const f=$("#sbUph");if(f)f.focus();return}
        if((c.over||c.stale)&&String(st.why).trim().length<3){toast("⚠ उधार क्यों दिया — वजह लिखें");const f=$("#sbUwhy");if(f)f.focus();return}}
      await doSettle(b,st)}
  };
};
/* ================= 📒 उधार का पक्का रास्ता ================= */
SB.ph10=v=>String(v||"").replace(/\D/g,"").slice(-10);
SB.udAmt=(b,st)=>st.pay==="udhar"?num(b.total):st.pay==="split"?Math.max(0,r2(num(b.total)-Math.min(num(b.total),num(st.cashPart)))):0;
SB.udLimit=p=>+p.limit>0?+p.limit:(+(S.settings&&S.settings.udLimit)>0?+S.settings.udLimit:2000);
SB.udCheck=function(p,amt){
  const L=(S.ledger||[]).filter(l=>l.partyId===p.id);const before=bal(p.id),after=r2(before+num(amt)),lim=SB.udLimit(p);
  const lj=L.filter(l=>l.type!=="udhar").sort((a,b)=>(b.ts||0)-(a.ts||0))[0];
  const first=L.filter(l=>l.type==="udhar").sort((a,b)=>(a.ts||0)-(b.ts||0))[0];
  const since=lj?lj.ts:(first?first.ts:0);const days=since?Math.floor((Date.now()-since)/864e5):0;
  return {before,after,lim,lastJama:lj||null,days,noPh:SB.ph10(p.phone).length!==10,over:after>lim,stale:before>0&&days>30};
};
SB.udCheckHTML=function(p,amt,st){
  const c=SB.udCheck(p,amt);
  return `<div class="ud-chk ${c.over||c.stale?"bad":""}">
    <div class="ud-h">📒 <b>${esc(p.name)}</b>${p.qtr?` <span class="note">· क्वार्टर ${esc(p.qtr)}</span>`:""}<button class="lnk" data-sbpch>बदलें</button></div>
    <div class="ud-g"><span>अभी बाकी<b>${rs(c.before)}</b></span><span>+ यह उधार<b>${rs(amt)}</b></span><span>बिल के बाद<b class="${c.over?"red":""}">${rs(c.after)}</b></span></div>
    <p class="note" style="margin:4px 0 0">💵 आख़िरी जमा: ${c.lastJama?`<b>${fdate(c.lastJama.date)}</b> (${c.days} दिन पहले) · ${rs(c.lastJama.amt)}`:`<b>कभी नहीं</b>${c.days?` · पहला उधार ${c.days} दिन पहले`:""}`} · सीमा ${rs(c.lim)}</p>
    ${c.noPh?`<label class="fld" style="margin-top:6px">📱 मोबाइल नंबर (ज़रूरी — पर्ची इसी पर जाएगी)<input class="inp" id="sbUph" inputmode="tel" maxlength="14" placeholder="10 अंक" value="${esc(st.ph)}" autocomplete="off"></label>`:`<p class="note" style="margin:2px 0 0">📱 ${esc(p.phone)}</p>`}
    ${c.over?`<p class="ud-w">⚠ बिल के बाद बाकी ${rs(c.after)} — सीमा ${rs(c.lim)} से ज़्यादा</p>`:""}
    ${c.stale?`<p class="ud-w">⚠ ${c.lastJama?c.days+" दिन से कुछ जमा नहीं हुआ":"इन्होंने आज तक कुछ जमा नहीं किया"} — ${rs(c.before)} पहले से बाकी</p>`:""}
    ${c.over||c.stale?`<label class="fld" style="margin-top:4px">फिर भी उधार क्यों दे रहे हैं? (विक्रम जी देखेंगे)<input class="inp" id="sbUwhy" placeholder="जैसे विक्रम जी ने हाँ कहा / कल पैसे देंगे" value="${esc(st.why)}" autocomplete="off"></label>`:""}
  </div>`;
};
SB.udSendHTML=function(b){
  const p=S.parties.find(x=>x.id===b.partyId);const ph=SB.ph10(p&&p.phone);
  if(!(num(b.pay&&b.pay.udhar)>0)||!p)return "";
  if(ph.length!==10)return `<div class="ud-send"><p class="ud-w" style="margin:0">⚠ ${esc(p.name)} का नंबर नहीं है — पर्ची नहीं जा सकती</p></div>`;
  return `<div class="ud-send">${b.udSent?`<p class="note" style="margin:0 0 6px;color:#0b7a35;font-weight:700">✓ उधार की पर्ची ${ftime(b.udSent)} पर भेजी गई</p>`:`<p class="ud-w" style="margin:0 0 6px">ग्राहक को पर्ची ज़रूर भेजें — यही उधार का सबूत है</p>`}
    <a class="big" data-udsend="${esc(b.no)}" style="background:#25d366;color:#04230f" target="_blank" rel="noopener" href="${waLink(receiptText(b),ph)}">💬 ${esc(p.name)} को उधार की पर्ची ${b.udSent?"फिर ":""}भेजें</a></div>`;
};
document.addEventListener("click",e=>{const a=e.target.closest("[data-udsend]");if(!a)return;const b=findBill(a.dataset.udsend)||SB._lastUd;if(b&&!b.udSent){patchBill(b,{udSent:Date.now()}).catch(()=>{})}});
SB.udharHTML=function(){
  if(!S.isOwner)return "";
  const L=(S.dayBills||[]).filter(b=>!b.cancelled&&num(b.pay&&b.pay.udhar)>0);if(!L.length)return "";
  const nos=L.filter(b=>!b.udSent).length,fl=L.filter(b=>b.udChk&&(b.udChk.over||b.udChk.stale)).length;
  return `<div class="card2" style="border:2px solid var(--chili)"><h3>📒 आज का उधार — जाँच (${L.length} बिल · ${rs(r2(L.reduce((a,b)=>a+num(b.pay.udhar),0)))})</h3>
  ${nos||fl?`<p class="ud-w" style="margin:0 0 6px">${nos?nos+" बिल की पर्ची ग्राहक को नहीं गई":""}${nos&&fl?" · ":""}${fl?fl+" बिल सीमा/पुराने बकाये के बाद भी दिए":""}</p>`:""}
  ${L.map(b=>{const c=b.udChk||{};return `<div class="creq-row"><div><b>${esc(b.partyName||"")} · ${rs(b.pay.udhar)}</b><span class="note">${esc(b.no)} · ${ftime(b.ts)} · बिल ${esc(b.byName||"")}${c.after!=null?" · अब बाकी "+rs(c.after):""}</span>
    <span>${b.udSent?"✅ पर्ची गई":"❌ पर्ची नहीं गई"}${c.over?" · ⚠ सीमा "+rs(c.lim)+" पार":""}${c.stale?" · ⚠ "+(c.days||"")+" दिन से जमा नहीं":""}${c.newPh?" · 📱 नंबर अभी डाला":""}</span>${c.why?`<span>📝 ${esc(c.why)}</span>`:""}</div></div>`}).join("")}</div>`;
};
/* सेव होते ही: अलग रसीद वाली स्क्रीन नहीं — सीधे खाली बिलिंग, संदेश + बीप + कंपन; उधार हो तो सिर्फ़ "पर्ची भेजें" की छोटी पट्टी */
SB.afterSettle=function(b){
  const p=b.pay||{};const how=[p.upi?"UPI "+rs(p.upi):"",p.cash?"नकद "+rs(p.cash):"",p.udhar?"उधार "+rs(p.udhar):""].filter(Boolean).join(" + ");
  closeSheet();try{renderPane()}catch(x){}
  try{beep(true)}catch(x){}try{navigator.vibrate&&navigator.vibrate(60)}catch(x){}
  toast("✓ बिल "+b.no+" सेव · "+how+(b.pending?" · 📴 नेट आते ही जाएगा":""));
  if(num(p.udhar)>0)SB.udSlipSheet(b);
};
SB.udSlipSheet=function(b){
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="उधार की पर्ची"><div class="grab"></div>
  <div class="sh-head"><div><h3>📒 ${rs(b.pay.udhar)} उधार चढ़ा</h3><span class="note">${esc(b.partyName||"")} · खाते में कुल बाकी ${rs(bal(b.partyId))}</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  ${SB.udSendHTML(b)}
  <button class="big ghost" data-close style="margin-top:8px">आगे बढ़ें → नया बिल</button></div></div>`;
  $("#sheet").onclick=e=>{if(e.target.matches("[data-close]"))closeSheet()};
};
async function doSettle(b,st){
  const tot=num(b.total);const pay={cash:0,upi:0,udhar:0};
  if(st.pay==="cash")pay.cash=tot;else if(st.pay==="upi")pay.upi=tot;else if(st.pay==="udhar")pay.udhar=tot;else{const cp=Math.min(tot,num(st.cashPart));pay.cash=r2(cp);pay.udhar=r2(tot-cp)}
  const party=S.parties.find(p=>p.id===st.partyId);
  const ch={pay,payMode:st.pay,settled:true,settleTs:Date.now()};
  if(pay.udhar>0&&party){ch.mode="udhar";ch.partyId=party.id;ch.partyName=party.name;
    const c=SB.udCheck(party,pay.udhar),ph=SB.ph10(st.ph);
    ch.udChk={before:c.before,after:c.after,lim:c.lim,days:c.days,over:c.over,stale:c.stale,...(c.over||c.stale?{why:String(st.why||"").trim()}:{}),...(c.noPh&&ph.length===10?{newPh:ph}:{})};
    if(c.noPh&&ph.length===10){party.phone=ph;try{if(!S.demo&&S.db)await S.db.collection("parties").doc(party.id).update({phone:ph})}catch(x){}}}
  try{
    await patchBill(b,ch);
    if(pay.udhar>0&&party){const ent={ts:b.ts,date:b.date,partyId:party.id,partyName:party.name,type:"udhar",amt:pay.udhar,billNo:b.no,by:S.uid||"",byName:biller()};
      if(S.demo)S.ledger.push({id:b.no,...ent});else{const o=outboxGet();const inBox=o.some(x=>x.bill.no===b.no&&!(x.done&&x.done.l));if(!inBox)await S.db.collection("ledger").doc(b.no).set(ent);if(!S.ledger.find(x=>x.id===b.no))S.ledger.push({id:b.no,...ent})}}
    if(pay.udhar>0)SB._lastUd=b;
    SB.afterSettle(b);
  }catch(err){toast("सेटल नहीं हुआ: "+(err.code||err.message||""))}
}

/* ================= ✏️ सेव के बाद बिल बदलें ================= */
SB.editSheet=function(b){
  if(!b||b.settled!==false){toast("भुगतान हो चुका है — अब बिल नहीं बदल सकते, रद्द की अर्ज़ी भेजें");return}
  const E=(b.lines||[]).map(l=>({...l}));let q="";
  const step=l=>l.unit==="kg"?0.25:1;
  const draw=()=>{
    const tot=sumLines(E);
    const L=q?S.items.filter(i=>i.active!==false&&!i.virtual&&(+i.sale||0)>0&&(i.name+" "+(window.SN?SN.en(i):"")+" "+i.id).toLowerCase().includes(q.toLowerCase())).slice(0,12):[];
    $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="बिल बदलें"><div class="grab"></div>
    <div class="sh-head ppc-sh"><h3>✏️ बिल बदलें <small class="note">· ${esc(b.no)}</small></h3><button class="x" data-close aria-label="बंद करें">✕</button></div>
    <p class="note" style="margin:0 0 8px">🔒 भाव पक्के हैं — सिर्फ़ मात्रा बदलें या नया सामान जोड़ें। हर बदलाव दर्ज होगा।</p>
    <div class="sbe-list">${E.map((l,i)=>`<div class="sbe-row ${l.qty<=0?"gone":""}"><div class="sbe-n"><b>${esc(l.name)}</b><span>₹${l.rate}/${UNITS[l.unit]||l.unit} 🔒</span></div>
      <div class="sbe-q"><button data-sbm="${i}" aria-label="कम">−</button><input data-sbq="${i}" inputmode="decimal" value="${+(+l.qty).toFixed(3)}" aria-label="${esc(l.name)} मात्रा"><button data-sbp2="${i}" aria-label="ज़्यादा">+</button></div>
      <b class="sbe-a">₹${r2(l.qty*l.rate)}</b></div>`).join("")}</div>
    <div class="sbe-add"><input class="inp" id="sbeQ" type="search" placeholder="➕ और सामान — खोजें (जैसे टमाटर)" value="${esc(q)}" autocomplete="off">
      ${L.length?`<div class="ppick" style="margin-top:6px">${L.map(i=>`<button data-sbadd="${esc(i.id)}">${tileHTML(i)}<span>${esc(i.name)} ₹${i.sale}</span></button>`).join("")}</div>`:""}</div>
    <div class="settle-sum" style="margin-top:10px"><span>पहले ${rs(b.total)} → अब</span><b>${rs(tot)}</b></div>
    <button class="big" data-sbsave>💾 बदलाव सेव करें · ${rs(tot)}</button>
    <button class="big ghost" data-sbback style="margin-top:8px">← बिना बदले वापस</button></div></div>`;
  };
  const setQ=(i,v)=>{const l=E[i];if(!l)return;l.qty=Math.max(0,Math.round(v*1000)/1000);l.amt=r2(l.qty*l.rate)};
  draw();
  const sh=$("#sheet");
  sh.oninput=e=>{
    if(e.target.id==="sbeQ"){q=e.target.value;draw();const f=$("#sbeQ");if(f){f.focus();try{f.setSelectionRange(q.length,q.length)}catch(x){}}return}
    const qi=e.target.closest("[data-sbq]");if(qi){setQ(+qi.dataset.sbq,num(qi.value));const row=qi.closest(".sbe-row");row.querySelector(".sbe-a").textContent="₹"+r2(E[+qi.dataset.sbq].amt);row.classList.toggle("gone",E[+qi.dataset.sbq].qty<=0);
      const t=sumLines(E);sh.querySelector(".settle-sum b").textContent=rs(t);sh.querySelector("[data-sbsave]").textContent="💾 बदलाव सेव करें · "+rs(t)}
  };
  sh.onclick=async e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    if(e.target.closest("[data-sbback]")){SB.settleSheet(b);return}
    const m=e.target.closest("[data-sbm]");if(m){const i=+m.dataset.sbm;setQ(i,E[i].qty-step(E[i]));draw();return}
    const p=e.target.closest("[data-sbp2]");if(p){const i=+p.dataset.sbp2;setQ(i,E[i].qty+step(E[i]));draw();return}
    const a=e.target.closest("[data-sbadd]");if(a){const it=item(a.dataset.sbadd);if(!it)return;const ex=E.findIndex(l=>l.id===it.id&&!l.changed&&!l.free);
      if(ex>-1)setQ(ex,E[ex].qty+(it.unit==="kg"?0.5:1));else{const r=+it.sale||0,qty=it.unit==="kg"?0.5:1;E.push({id:it.id,name:it.name,emoji:it.emoji||"",unit:it.unit,qty,rate:r,board:r,cost:(window.SF?SF.costOf(it):(+it.cost||0)),amt:r2(qty*r),changed:false,free:false,added:true})}
      q="";draw();toast("➕ "+it.name+" जुड़ा — मात्रा ठीक कर लें");return}
    if(e.target.closest("[data-sbsave]"))await saveEdit(b,E);
  };
};
async function saveEdit(b,E){
  const before=(b.lines||[]).map(l=>({id:l.id,name:l.name,unit:l.unit,qty:l.qty,amt:l.amt}));
  const lines=E.filter(l=>l.qty>0).map(l=>{const o={...l};delete o.added;return o});
  if(!lines.length){toast("सारे सामान हटाने हैं तो बिल रद्द की अर्ज़ी भेजें");return}
  const sig=L=>L.map(l=>l.id+":"+(+l.qty).toFixed(3)).sort().join("|");
  if(sig(lines)===sig(before)){toast("कुछ नहीं बदला");SB.settleSheet(b);return}
  const total=sumLines(lines),totalBefore=num(b.total);
  const diff=[];const bm=new Map(before.map(l=>[l.id+"|"+l.name,l]));
  lines.forEach(l=>{const o=bm.get(l.id+"|"+l.name);if(!o)diff.push("+ "+lineTxt(l));else if(Math.abs(o.qty-l.qty)>0.0005)diff.push(l.name+" "+fq(o.qty,l.unit)+" → "+fq(l.qty,l.unit));bm.delete(l.id+"|"+l.name)});
  bm.forEach(o=>diff.push("− "+o.name+" "+fq(o.qty,o.unit)+" हटाया"));
  const ed={ts:Date.now(),by:S.uid||"",byName:biller(),before:before.map(lineTxt).join(", "),after:lines.map(lineTxt).join(", "),diff:diff.join("; "),totalBefore,totalAfter:total};
  const edits=[...(b.edits||[]),ed];
  const ch={lines,sub:total,total,cost:r2(lines.reduce((a,l)=>a+num(l.cost)*num(l.qty),0)),rateChanged:lines.some(l=>l.changed),edits,editCount:edits.length};
  try{
    // गिने हुए (पीस) सामान का स्टॉक: पुराना वापस, नया घटाओ
    const oldP=trackedPairs(b.lines||[],1),newP=trackedPairs(lines,-1);
    await patchBill(b,ch);
    if(!b.pending)try{await adjStock(oldP.concat(newP),"बिल बदला "+b.no)}catch(x){}
    toast("✏️ बदलाव दर्ज: "+rs(totalBefore)+" → "+rs(total));SB.settleSheet(b);
  }catch(err){toast("बदलाव सेव नहीं हुआ: "+(err.code||err.message||""))}
}

/* ================= जगह-जगह जुड़ाव ================= */
SB.pendingHTML=function(){
  const U=unpaid();if(!U.length)return "";
  return `<div class="sb-pend"><b>⏳ ${U.length} बिल का भुगतान बाकी</b><div>${U.slice(0,6).map(b=>`<button data-sbopen="${esc(b.no)}">${esc(b.partyName&&b.partyName!=="VIP ग्राहक"?b.partyName:b.no)} · ${rs(b.total)}</button>`).join("")}</div></div>`;
};
SB.receiptActionsHTML=function(b){
  if(b.cancelled)return "";
  if(b.mode==="inst")return `<div data-icb="${esc(b.no)}">${SB.instContactsHTML(b)}</div>`;
  if(b.settled!==false&&num(b.pay&&b.pay.udhar)>0)return SB.udSendHTML(b)+((b.edits&&b.edits.length&&S.isOwner)?`<div class="sb-ract"><p class="note" style="margin:0">✏️ सेव के बाद ${b.edits.length} बार बदला</p></div>`:"");
  if(b.settled===false)return `<div class="sb-ract"><span class="pill blue">⏳ भुगतान बाकी</span><div class="sb-row"><button class="big" data-sbopen="${esc(b.no)}">💰 सेटल करें</button><button class="big ghost" data-sbeditno="${esc(b.no)}">✏️ बिल बदलें</button></div></div>`;
  return (b.edits&&b.edits.length&&S.isOwner)?`<div class="sb-ract"><p class="note" style="margin:0">✏️ सेव के बाद ${b.edits.length} बार बदला: ${b.edits.map(x=>esc(x.byName)+" "+ftime(x.ts)+" · "+esc(x.diff)+" ("+rs(x.totalBefore)+" → "+rs(x.totalAfter)+")").join(" | ")}</p></div>`:"";
};
SB.editsHTML=function(){
  if(!S.isOwner)return "";const L=(S.dayBills||[]).filter(b=>b.edits&&b.edits.length);const U=unpaid();
  if(!L.length&&!U.length)return "";
  return `<div class="card2" style="border:2px solid #7c3aed">${L.length?`<h3>✏️ सेव के बाद बदले गए बिल (${L.length})</h3>${L.map(b=>`<div class="creq-row"><div><b>${esc(b.no)} · ${esc(b.partyName||"")} · अब ${rs(b.total)}</b>${b.edits.map(x=>`<span class="note">${esc(x.byName)} · ${ftime(x.ts)} · ${esc(x.diff)} · ${rs(x.totalBefore)} → ${rs(x.totalAfter)}</span>`).join("")}</div></div>`).join("")}`:""}
  ${U.length?`<p style="margin:8px 0 0"><b>⏳ ${U.length} बिल का भुगतान अभी बाकी:</b> ${U.map(b=>esc(b.no)+" "+rs(b.total)+" ("+esc(b.byName||"")+")").join(", ")}</p>`:""}</div>`;
};
document.addEventListener("click",e=>{
  const o=e.target.closest("[data-sbopen]");if(o){const b=findBill(o.dataset.sbopen);if(b)SB.settleSheet(b);return}
  const ed=e.target.closest("[data-sbeditno]");if(ed){const b=findBill(ed.dataset.sbeditno);if(b)SB.editSheet(b);return}
});
/* ================= 💾 "बिल देखें" = बिल पक्का सेव ================= */
SB.autoSave=function(){
  if(S.saving)return;
  if(!(S.cart||[]).length){toast("पहले सब्ज़ी चुनें");return}
  if(S.mode!=="inst"&&!(cartTotal()>0)){toast("बिल ₹0 का है — मात्रा देखें");return}
  if(S.mode==="inst"){const miss=S.cart.filter(l=>!l.free&&!(SB.instCost(l)>0));if(miss.length){SB.costAsk(miss);return}}
  saveBill();
};
/* संस्था: जिस सामान का खरीद भाव ऐप को नहीं पता, वह बिलर उसी समय लिखे — चालान कभी ₹0 या बिक्री भाव पर न बने */
SB.instCost=function(l){const it=item(l.id);let pr=it&&window.SF?num(SF.costOf(it)):0;if(!(pr>0))pr=num(l.cost);if(!(pr>0))pr=num(it&&it.cost);return pr};
SB.costAsk=function(miss){
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="खरीद भाव"><div class="grab"></div>
  <div class="sh-head"><div><h3>🏢 खरीद भाव लिखें</h3><span class="note">${esc(S.inst||"संस्था")} को माल खरीद भाव पर जाता है। इनका खरीद भाव ऐप में नहीं है:</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div class="sbe-list">${miss.map((l,i)=>`<div class="sbe-row"><div class="sbe-n"><b>${esc(l.name)}</b><span>${fq(l.qty,l.unit)} · बिक्री भाव ₹${l.rate}</span></div>
    <label class="ic-cost">₹<input class="inp" id="icc${i}" data-icc="${i}" inputmode="decimal" placeholder="खरीद" aria-label="${esc(l.name)} का खरीद भाव"> /${esc(UNITS[l.unit]||l.unit)}</label></div>`).join("")}</div>
  <button class="big" data-iccsave style="margin-top:10px">💾 चालान सेव करें</button></div></div>`;
  const f=$("#icc0");if(f)f.focus();
  $("#sheet").onclick=e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    if(!e.target.closest("[data-iccsave]"))return;
    const vals=miss.map((l,i)=>num(($("#icc"+i)||{}).value));
    const bad=vals.findIndex(v=>!(v>0));if(bad>-1){toast(miss[bad].name+" का खरीद भाव लिखें");const x=$("#icc"+bad);if(x)x.focus();return}
    const over=miss.findIndex((l,i)=>vals[i]>num(l.rate));if(over>-1&&!e.target.dataset.sure){e.target.dataset.sure="1";e.target.textContent="⚠ "+miss[over].name+" का खरीद भाव बिक्री भाव से ज़्यादा — फिर भी सेव करें?";return}
    miss.forEach((l,i)=>{l.cost=vals[i];l.costTyped=biller()||"बिलर"});
    saveBill();
  };
};
/* सेव होते समय (या सेव न हो पाए तो) दिखने वाली खिड़की — इसमें कुछ हटाने/बदलने का बटन नहीं */
SB.savingHTML=function(b){
  const fail=!S.saving;
  return `${SF.compactPaperHTML(b,{qr:false})}
  ${fail?`<div class="warn">⚠ बिल अभी सेव नहीं हुआ — दोबारा दबाएँ</div><button class="big" data-billsave>💾 बिल सेव करें · ${rs(b.total)}</button>`:`<div class="sb-saving"><span class="sb-spin"></span><b>बिल सेव हो रहा है…</b></div>`}`;
};

/* ================= 🏢 संस्था: खरीद भाव पर चालान ================= */
/* चुनते समय बिक्री भाव दिखता है; सेव होते ही हर लाइन खरीद भाव पर (आज की मंडी खरीद का औसत → पिछली खरीद → सामान का खरीद भाव) */
SB.instReprice=function(bill){
  (bill.lines||[]).forEach(l=>{
    const it=item(l.id);const sale=r2(num(it&&it.sale)||num(l.board)||num(l.rate));
    let pr=it&&window.SF?num(SF.costOf(it)):0;if(l.costTyped&&num(l.cost)>0&&!(it&&num(it.cost)>0))pr=num(l.cost);if(!(pr>0))pr=num(l.cost);
    l.saleRate=sale;
    if(pr>0)l.rate=r2(pr);else{l.rate=sale;l.noCost=true}
    l.board=l.rate;l.cost=l.rate;l.changed=false;l.amt=l.free?0:r2(num(l.qty)*l.rate);
  });
  const L=bill.lines||[];
  bill.sub=bill.total=r2(L.reduce((a,l)=>a+num(l.amt),0));bill.cost=bill.total;bill.disc=0;
  bill.saleTotal=r2(L.reduce((a,l)=>a+(l.free?0:num(l.qty)*num(l.saleRate)),0));
  bill.rateChanged=false;bill.instRate="purchase";
};
const saleOf=l=>num(l.saleRate)||num((item(l.id)||{}).sale);
const qtxt=l=>fq(l.qty,l.unit).replace(" कि.ग्रा"," kg");
SB.challanHTML=function(b,o){
  o=o||{};const L=b.lines||[];const miss=L.filter(l=>l.noCost);
  return `<div class="paper pp-ch${o.anim?" pp-anim":""}">
  <div class="pp-head"><div class="pp-logo">🥬</div><b>सब्ज़ी एक्सप्रेस</b><small>माल चालान · जालीपा कैंट, बाड़मेर</small></div>
  <div class="pp-rule"></div>
  <div class="ch-to">🏢 ${esc(b.partyName||"संस्था")}</div>
  <div class="pp-meta"><span>चालान नं <b>${esc(b.no||"…")}</b></span><span>${fdate(b.date||today())} · ${ftime(b.ts||Date.now())}</span></div>
  <div class="pp-meta"><span>माल लाए: <b>${esc(b.byName||"")}</b></span><span>${L.length} सामान</span></div>
  <div class="pp-dash"></div>
  <table class="pp-t"><thead><tr><th>क्र.</th><th>सामान</th><th class="r">मात्रा</th><th class="r">खरीद भाव</th><th class="r">रकम</th></tr></thead><tbody>
  ${L.map((l,i)=>`<tr><td>${i+1}</td><td>${esc(l.name)}${l.noCost?' <span class="pp-chg">⚠ खरीद भाव नहीं मिला</span>':""}${l.costTyped?` <span class="pp-chg">✍️ भाव ${esc(l.costTyped)} ने लिखा</span>`:""}</td><td class="r">${qtxt(l)}</td><td class="r">₹${l.rate}</td><td class="r"><b>₹${l.amt}</b></td></tr>`).join("")}
  </tbody></table>
  <div class="pp-dash"></div>
  <div class="ch-tot"><span>${esc(b.partyName||"संस्था")} — कुल सब्ज़ी</span><b>₹${b.total}</b><small>(खरीद भाव पर · कोई मुनाफ़ा नहीं)</small></div>
  ${miss.length?`<p class="ch-warn">⚠ ${miss.map(l=>esc(l.name)).join(", ")} — ऐप में खरीद भाव नहीं मिला, इसलिए बिक्री भाव लगा। विक्रम जी जाँच लें।</p>`:""}
  ${SB.editNoteHTML(b)}
  ${b.cancelled?`<div class="pp-stamp red">रद्द · ${esc(b.cancelReason||"")}</div>`:""}
  <div class="ch-sign"><span>माल देने वाले</span><span>माल लेने वाले ✍️</span></div>
  </div>`;
};
SB.editNoteHTML=function(b){
  const E=b.edits||[];if(!E.length)return "";const x=E[E.length-1];
  return `<div class="pp-edit">✏️ सेव के बाद ${E.length} बार बदला · आख़िरी: ${esc(x.byName||"")} ${ftime(x.ts)} · ${esc(x.diff||"")} (₹${x.totalBefore} → ₹${x.totalAfter})</div>`;
};

/* ---- 📇 संस्था के लोग: किसे कौन-सी रिपोर्ट ---- */
/* kind: chef = सिर्फ़ सब्ज़ी+मात्रा · manager = मात्रा × खरीद भाव · resale = खरीद भाव + बेचने का भाव + पूरा बिकने पर मुनाफ़ा */
const KINDS={chef:"हलवाई/रसोइया — सिर्फ़ मात्रा",manager:"मैनेजर — मात्रा, भाव, रकम",resale:"आगे बेचने वाले — खरीद, बिक्री भाव, मुनाफ़ा"};
const DEF_PEOPLE=[
  [/मारवाड़|marwar/i,[{n:"गणेश भाई",role:"मुख्य हलवाई (शेफ)",ph:"",kind:"chef"},{n:"स्वरूप जी",role:"मैनेजर",ph:"9166753417",kind:"manager"}]],
  [/177|\bMH\b|एमएच/i,[{n:"मनोज सुमालिया जी",role:"मैनेजर, 177 MH कैंटीन",ph:"8619845800",kind:"resale",place:"177 MH कैंटीन"}]],
  [/डोसा|dosa/i,[{n:"रामू जी",role:"डोसा पॉइंट",ph:"8528629338",kind:"manager"}]],
  [/भैरव|bhairav/i,[{n:"दिनेश जी",role:"मैनेजर, 15 भैरव कैंटीन",ph:"8209593527",kind:"resale",place:"भैरव बटालियन"}]]
];
SB.peopleFor=function(inst){
  const cfg=S.settings&&S.settings.instPeople;
  if(cfg&&Array.isArray(cfg[inst]))return cfg[inst];
  const d=DEF_PEOPLE.find(x=>x[0].test(inst||""));return d?d[1].map(p=>({...p})):[];
};
SB.instText=function(b,p){
  const L=b.lines||[],LN="━━━━━━━━━━━━━━";const kind=p?p.kind:"manager";
  let t=`🙏 नमस्ते${p?" "+p.n:""},\n🥬 *सब्ज़ी एक्सप्रेस* से *${b.partyName}* के लिए सब्ज़ी भेजी गई है।\n🧾 चालान: ${b.no}\n📅 ${fdate(b.date)} · ${ftime(b.ts)}\n🚚 माल लाए: ${b.byName||""}\n${LN}\n`;
  if(kind==="chef"){
    L.forEach((l,i)=>t+=`${i+1}. ${l.name} — *${qtxt(l)}*\n`);
    t+=`${LN}\nकुल ${L.length} सब्ज़ी\n\n✅ कृपया तौलकर/गिनकर मिलान करें और *"मिल गई ✓"* लिखकर जवाब दें।\nकुछ कम, ज़्यादा या खराब हो तो अभी फोटो के साथ बताएँ।\n`;
  }else if(kind==="resale"){
    let st=0,pf=0;
    L.forEach((l,i)=>{const s=saleOf(l),m=r2((s-num(l.rate))*num(l.qty));st+=num(l.qty)*s;pf+=m;
      t+=`${i+1}. ${l.name} — *${qtxt(l)}*\n    खरीद ₹${l.rate} → बेचना *₹${s}*${m>0?" · मुनाफ़ा ₹"+m:" ⚠ मुनाफ़ा नहीं"}\n`});
    st=r2(st);pf=r2(pf);
    t+=`${LN}\n📦 माल की कीमत (खरीद भाव): *₹${b.total}*\n🏷️ सब्ज़ी एक्सप्रेस के भाव से पूरी बिक्री: *₹${st}*\n💚 *${p?p.n+", ":""}यह सब्ज़ी ${(p&&p.place)||b.partyName} में इन्हीं भाव पर पूरी बिक गई तो ₹${pf} का मुनाफ़ा होगा।*\n\n📌 बिक्री भाव वही रखें जो ऊपर लिखा है (सब्ज़ी एक्सप्रेस का भाव) — न कम, न ज़्यादा।\n🌙 रोज़ शाम बिकी और बची सब्ज़ी की जानकारी भेजें।\n✅ माल मिलान करके *"मिल गई ✓"* लिखकर जवाब दें।\n`;
  }else{
    L.forEach((l,i)=>t+=`${i+1}. ${l.name}\n    ${qtxt(l)} × ₹${l.rate} = *₹${l.amt}*\n`);
    t+=`${LN}\n💰 *कुल: ₹${b.total}* (खरीद भाव पर)\n\n✅ कृपया मिलान करके *"मिल गई ✓"* लिखकर जवाब दें। कुछ फर्क हो तो अभी बताएँ।\n`;
  }
  if((b.edits||[]).length)t+=`✏️ यह चालान सेव के बाद ${b.edits.length} बार बदला गया।\n`;
  return t+`— विक्रम चारण, सब्ज़ी एक्सप्रेस 🙏`;
};
const sentKey=b=>"se_isent_"+b.no;
const sentGet=b=>{try{return JSON.parse(localStorage.getItem(sentKey(b))||"{}")}catch(e){return {}}};
SB.instContactsHTML=function(b){
  if(b.mode!=="inst"||b.cancelled)return "";
  const P=SB.peopleFor(b.partyName),sent=sentGet(b);
  const own=S.isOwner?`<p class="note" style="margin:6px 0 0">🔐 बिक्री भाव से यही माल ₹${r2((b.lines||[]).reduce((a,l)=>a+num(l.qty)*saleOf(l),0))} का होता — संस्था को ₹${r2((b.lines||[]).reduce((a,l)=>a+num(l.qty)*saleOf(l),0)-num(b.total))} का फायदा (सिर्फ़ आपको दिखता है)</p>`:"";
  return `<div class="ic-box"><b>📤 ${esc(b.partyName)} के लोगों को रिपोर्ट भेजें</b>
  ${P.length?P.map((p,i)=>{const ph=String(p.ph||"").replace(/\D/g,"").slice(-10);
    return ph.length===10?`<a class="ic-btn" target="_blank" rel="noopener" data-icsent="${i}" href="${waLink(SB.instText(b,p),ph)}"><span>🟢 ${esc(p.n)}<small>${esc(p.role||"")} · ${esc((KINDS[p.kind]||"").split(" — ")[1]||"")}</small></span><i>${sent[i]?"✓ भेजा "+ftime(sent[i]):"भेजें"}</i></a>`
      :`<button class="ic-btn off" data-icnoph="1"><span>⚪ ${esc(p.n)}<small>${esc(p.role||"")} · नंबर नहीं है</small></span><i>नंबर डालें</i></button>`}).join(""):`<p class="note" style="margin:4px 0">इस संस्था के लोग अभी नहीं जुड़े</p>`}
  ${own}</div>`;
};
document.addEventListener("click",e=>{
  const a=e.target.closest("[data-icsent]");if(a){const bno=a.closest("[data-icb]")?.dataset.icb;if(!bno)return;const b={no:bno};const m=sentGet(b);m[a.dataset.icsent]=Date.now();try{localStorage.setItem(sentKey(b),JSON.stringify(m))}catch(x){}setTimeout(()=>{const i=a.querySelector("i");if(i)i.textContent="✓ भेजा "+ftime(Date.now())},300);return}
  if(e.target.closest("[data-icnoph]")){if(S.isOwner)SB.peopleSheet();else toast("इस व्यक्ति का नंबर विक्रम जी सेटिंग में डालेंगे");return}
  if(e.target.closest("[data-icpeople]")){SB.peopleSheet();return}
});
SB.peopleBtnHTML=function(){return S.isOwner?`<button class="big ghost" data-icpeople style="margin:6px 0 10px">📇 संस्था के लोग (किसे रिपोर्ट जाए) — नाम, नंबर</button>`:""};
SB.peopleSheet=function(){
  if(!S.isOwner)return;
  const IN=insts();const D={};IN.forEach(n=>D[n]=SB.peopleFor(n).map(p=>({...p})));
  const draw=()=>{
    $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="संस्था के लोग"><div class="grab"></div>
    <div class="sh-head"><div><h3>📇 संस्था के लोग</h3><span class="note">संस्था का चालान बनते ही इन्हें WhatsApp रिपोर्ट का बटन मिलेगा</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
    ${IN.map((n,gi)=>`<div class="ic-grp"><b>🏢 ${esc(n)}</b>${D[n].map((p,i)=>`<div class="ic-row">
      <input class="inp" data-icf="n" data-g="${gi}" data-i="${i}" value="${esc(p.n||"")}" placeholder="नाम" aria-label="नाम">
      <input class="inp" data-icf="ph" data-g="${gi}" data-i="${i}" value="${esc(p.ph||"")}" inputmode="tel" placeholder="मोबाइल 10 अंक" aria-label="मोबाइल">
      <input class="inp" data-icf="role" data-g="${gi}" data-i="${i}" value="${esc(p.role||"")}" placeholder="पद (जैसे मैनेजर)" aria-label="पद">
      <select class="inp" data-icf="kind" data-g="${gi}" data-i="${i}" aria-label="रिपोर्ट किस तरह की">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}" ${p.kind===k?"selected":""}>${v}</option>`).join("")}</select>
      ${p.kind==="resale"?`<input class="inp" data-icf="place" data-g="${gi}" data-i="${i}" value="${esc(p.place||"")}" placeholder="कहाँ बेचेंगे (जैसे भैरव बटालियन)" aria-label="कहाँ बेचेंगे">`:""}
      <button class="lnk" data-icdel="${gi}:${i}" style="color:var(--chili)">हटाएँ</button></div>`).join("")}
      <button class="lnk" data-icadd="${gi}">+ व्यक्ति जोड़ें</button></div>`).join("")}
    <button class="big" data-icsave>💾 सेव करें</button></div></div>`;
  };
  draw();const sh=$("#sheet");
  const set=e=>{const f=e.target.closest("[data-icf]");if(!f)return;const p=D[IN[+f.dataset.g]][+f.dataset.i];p[f.dataset.icf]=f.dataset.icf==="ph"?f.value.replace(/\D/g,"").slice(-10):f.value;return f.dataset.icf};
  sh.oninput=set;sh.onchange=e=>{if(set(e)==="kind"){const y=$("#sheet .sheet").scrollTop;draw();$("#sheet .sheet").scrollTop=y}};
  sh.onclick=async e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    const a=e.target.closest("[data-icadd]");if(a){D[IN[+a.dataset.icadd]].push({n:"",role:"",ph:"",kind:"manager"});draw();return}
    const d=e.target.closest("[data-icdel]");if(d){const [g,i]=d.dataset.icdel.split(":").map(Number);D[IN[g]].splice(i,1);draw();return}
    if(e.target.closest("[data-icsave]")){
      const bad=Object.values(D).flat().find(p=>p.ph&&p.ph.length!==10);if(bad){toast(bad.n+" का नंबर 10 अंक का नहीं");return}
      const out={};IN.forEach(n=>out[n]=D[n].filter(p=>p.n.trim()).map(p=>({n:p.n.trim(),role:(p.role||"").trim(),ph:p.ph||"",kind:p.kind||"manager",...(p.place?{place:p.place.trim()}:{})})));
      await saveSetting({instPeople:out});S.settings.instPeople=out;closeSheet();
    }
  };
};

/* मालिक को सूचना: कोई बिल सेव के बाद बदला */
const seenEd={};let edInit=false;
setInterval(()=>{if(!S.isOwner)return;(S.dayBills||[]).forEach(b=>{const n=(b.edits||[]).length;if(edInit&&n>(seenEd[b.no]||0)){const x=b.edits[n-1];toast("✏️ "+x.byName+" ने बिल "+b.no+" बदला: "+rs(x.totalBefore)+" → "+rs(x.totalAfter)+" ("+x.diff+")")}seenEd[b.no]=n});edInit=true},15000);
})();
