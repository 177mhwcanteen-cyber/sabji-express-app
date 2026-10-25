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
  const st={pay:b._np||(b.mode==="udhar"&&b.partyId)?"udhar":"upi",given:"",cashPart:"",partyId:b._np||b.partyId||"",q:""};delete b._np;
  const draw=()=>{
    const party=S.parties.find(p=>p.id===st.partyId);
    const needParty=st.pay==="udhar"||st.pay==="split";
    let ui="";
    if(st.pay==="upi")ui=upiId()?`<div class="sb-qr"><div id="sbqr"></div><div><b>${rs(tot)}</b><span>${esc(UPI_FIXED.payee)}</span><span class="note">${esc(upiId())}</span><span class="note">पैसा आने का मैसेज देखकर ही "सेटल" दबाएँ</span></div></div>`:`<div class="warn">UPI ID सेटिंग में नहीं है</div>`;
    if(st.pay==="cash"){const g=num(st.given);ui=`<label class="fld">ग्राहक ने कितने दिए? (ज़रूरी नहीं)<input class="inp big-in" id="sbGiven" inputmode="decimal" value="${esc(st.given)}" placeholder="जैसे 500"></label>${g>0?`<p class="sb-change">लौटाने हैं: <b>${rs(Math.max(0,r2(g-tot)))}</b></p>`:""}`}
    if(st.pay==="split")ui=`<label class="fld">अभी कितना नकद मिला?<input class="inp big-in" id="sbCash" inputmode="decimal" value="${esc(st.cashPart)}"></label><p class="note">उधार में जाएगा: <b style="color:var(--chili)">${rs(Math.max(0,r2(tot-num(st.cashPart))))}</b></p>`;
    if(needParty){
      const q=st.q.trim().toLowerCase();const L=S.parties.filter(p=>!q||(p.name||"").toLowerCase().includes(q)||String(p.phone||"").includes(q)||String(p.qtr||"").toLowerCase().includes(q)).slice(0,6);
      ui+=party?`<div class="sb-party">📒 <b>${esc(party.name)}</b> <span class="note">अभी बाकी ${rs(bal(party.id))}</span><button class="lnk" data-sbpch>बदलें</button></div>`
        :`<div class="udbox"><b>उधार किसके नाम?</b><input class="inp" id="sbPq" placeholder="नाम, क्वार्टर या मोबाइल से खोजें" value="${esc(st.q)}" autocomplete="off">
          <div class="udlist">${L.map(p=>`<button data-sbp="${esc(p.id)}"><div>${esc(p.name)}<br><span>${p.qtr?"क्वार्टर "+esc(p.qtr)+" · ":""}${esc(p.phone||"नंबर नहीं")}</span></div><span>${bal(p.id)>0?"बाकी "+rs(bal(p.id)):"साफ़"}</span></button>`).join("")||'<p class="note" style="margin:4px">कोई नहीं मिला</p>'}</div>
          <button class="big ghost" data-sbnewp>+ नया उधार खाता</button></div>`;
    }
    const ok=!(needParty&&!party)&&!(st.pay==="upi"&&!upiId());
    $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="भुगतान"><div class="grab"></div>
    <div class="sh-head ppc-sh"><h3>💰 भुगतान <small class="note">· बिल ${esc(b.no)}</small></h3><button class="x" data-close aria-label="बंद करें">✕</button></div>
    ${offline||b.pending?'<p class="note" style="color:var(--chili);font-weight:700;margin:0 0 6px">📴 बिल फोन में सेव है — नेट आते ही सर्वर पर जाएगा</p>':""}
    <div class="settle-sum"><span>✓ बिल सेव हो गया · ${(b.lines||[]).length} सामान</span><b>${rs(tot)}</b></div>
    <div class="paym">${[["upi","📱 UPI / QR"],["cash","💵 नकद"],["udhar","📒 पूरा उधार"],["split","🔀 नकद + बाकी उधार"]].map(([k,v])=>`<button data-sbpay="${k}" aria-pressed="${st.pay===k}">${v}</button>`).join("")}</div>
    ${ui}
    <button class="big ${st.pay==="upi"?"haldi":""}" data-sbok ${ok?"":"disabled"}>${st.pay==="upi"?"✓ पैसा आ गया · सेटल करें":"✓ सेटल करें · "+rs(tot)}</button>
    <div class="sb-row"><button class="big ghost" data-sbedit2>✏️ बिल बदलें</button><button class="big ghost" data-sblater>⏳ बाद में</button></div>
    </div></div>`;
    if(st.pay==="upi"&&upiId()&&window.QRCode){const el=$("#sbqr");try{new QRCode(el,{text:`upi://pay?pa=${encodeURIComponent(upiId())}&pn=${encodeURIComponent(UPI_FIXED.payee)}&am=${tot.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Sabji Express | Bill No "+b.no)}`,width:150,height:150,correctLevel:QRCode.CorrectLevel.M})}catch(e){}}
  };
  draw();
  const sh=$("#sheet");
  sh.oninput=e=>{if(e.target.id==="sbPq"){st.q=e.target.value;const pos=e.target.selectionStart;draw();const f=$("#sbPq");if(f){f.focus();try{f.setSelectionRange(pos,pos)}catch(x){}}}};
  sh.onchange=e=>{if(e.target.id==="sbGiven"){st.given=e.target.value;draw()}if(e.target.id==="sbCash"){st.cashPart=e.target.value;draw()}};
  sh.onclick=async e=>{
    if(e.target.matches("[data-close]")||e.target.closest("[data-sblater]")){closeSheet();if(e.target.closest("[data-sblater]"))toast("⏳ बिल "+b.no+" का भुगतान बाकी — बिलिंग में ऊपर दिखेगा");try{renderPane()}catch(x){}return}
    const p=e.target.closest("[data-sbpay]");if(p){st.pay=p.dataset.sbpay;draw();return}
    const pp=e.target.closest("[data-sbp]");if(pp){st.partyId=pp.dataset.sbp;draw();return}
    if(e.target.closest("[data-sbpch]")){st.partyId="";draw();return}
    if(e.target.closest("[data-sbnewp]")){openNewParty(id=>{b._np=id;setTimeout(()=>SB.settleSheet(b),50)});return}
    if(e.target.closest("[data-sbedit2]")){SB.editSheet(b);return}
    if(e.target.closest("[data-sbok]"))await doSettle(b,st);
  };
};
async function doSettle(b,st){
  const tot=num(b.total);const pay={cash:0,upi:0,udhar:0};
  if(st.pay==="cash")pay.cash=tot;else if(st.pay==="upi")pay.upi=tot;else if(st.pay==="udhar")pay.udhar=tot;else{const cp=Math.min(tot,num(st.cashPart));pay.cash=r2(cp);pay.udhar=r2(tot-cp)}
  const party=S.parties.find(p=>p.id===st.partyId);
  const ch={pay,payMode:st.pay,settled:true,settleTs:Date.now()};
  if(pay.udhar>0&&party){ch.mode="udhar";ch.partyId=party.id;ch.partyName=party.name}
  try{
    await patchBill(b,ch);
    if(pay.udhar>0&&party){const ent={ts:b.ts,date:b.date,partyId:party.id,partyName:party.name,type:"udhar",amt:pay.udhar,billNo:b.no,by:S.uid||"",byName:biller()};
      if(S.demo)S.ledger.push({id:b.no,...ent});else{const o=outboxGet();const inBox=o.some(x=>x.bill.no===b.no&&!(x.done&&x.done.l));if(!inBox)await S.db.collection("ledger").doc(b.no).set(ent);if(!S.ledger.find(x=>x.id===b.no))S.ledger.push({id:b.no,...ent})}}
    beep(true);showReceipt(b,true,b.pending);try{renderPane()}catch(x){}
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
/* मालिक को सूचना: कोई बिल सेव के बाद बदला */
const seenEd={};let edInit=false;
setInterval(()=>{if(!S.isOwner)return;(S.dayBills||[]).forEach(b=>{const n=(b.edits||[]).length;if(edInit&&n>(seenEd[b.no]||0)){const x=b.edits[n-1];toast("✏️ "+x.byName+" ने बिल "+b.no+" बदला: "+rs(x.totalBefore)+" → "+rs(x.totalAfter)+" ("+x.diff+")")}seenEd[b.no]=n});edInit=true},15000);
})();
