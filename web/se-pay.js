/* सब्ज़ी एक्सप्रेस — 🔐 मालिक का UPI भुगतान मिलान (सिर्फ़ विक्रम जी को दिखता है)
   खरीद ↔ UPI स्क्रीनशॉट: AI फाइल (HTML) बनाओ → Claude से पढ़वाओ → जवाब चिपकाओ → हर बिल पर पक्का नाम, UTR, खाता।
   डेटा: pay/{id}, payees/{id}, ownerCfg/accounts — Firestore नियमों में सिर्फ़ मालिक पढ़/लिख सकते हैं। */
(function(){
"use strict";
const SP=window.SP={};
const num=v=>{const n=parseFloat(String(v??"").replace(/,/g,""));return isFinite(n)?n:0};
const dOf=ts=>today(new Date(ts));
const dayAdd=(d,n)=>{const x=new Date(d+"T12:00:00");x.setDate(x.getDate()+n);return today(x)};
const PAYN={vikram:"विक्रम जी ने दिया",galla:"गल्ले से नकद",upi:"मेरे UPI से",udhar:"बाकी (उधार)"};
const ST={pay:[],payees:[],accts:[],ready:false,purch:[],supPay:[],loaded:0};
SP.st=ST;
const slug=s=>String(s||"").toLowerCase().replace(/[^a-z0-9\u0900-\u097f@.]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||("p"+Date.now().toString(36));
const acctLabel=l4=>{l4=String(l4||"").replace(/\D/g,"").slice(-4);if(!l4)return "";const a=ST.accts.find(x=>String(x.last4)===l4);return a?`${a.label} (…${l4})`:`खाता …${l4}`};

SP.onDb=function(db){
  if(!S.isOwner||S.demo&&!db)return;
  db.collection("pay").onSnapshot(s=>{ST.pay=s.docs.map(d=>({id:d.id,...d.data()}));ST.ready=true;rer()},()=>{});
  db.collection("payees").onSnapshot(s=>{ST.payees=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.total||0)-(a.total||0));rer()},()=>{});
  db.doc("ownerCfg/accounts").onSnapshot(s=>{ST.accts=(s.exists&&s.data().list)||[];rer()},()=>{});
  loadPurch();
};
function rer(){if(S.tab==="kharid"&&window.SF)SF.renderKharid(1)}
/* पिछले 30 दिन की खरीद + दुकानों को बाद में किए भुगतान */
async function loadPurch(){
  if(!S.db)return;
  try{const from=dayAdd(today(),-30);
    const q=await S.db.collection("purchases").where("date",">=",from).get();ST.purch=q.docs.map(d=>({id:d.id,...d.data()})).filter(p=>!p.cancelled);
    const q2=await S.db.collection("supPay").where("date",">=",from).get();ST.supPay=q2.docs.map(d=>({id:d.id,...d.data()}));
    ST.loaded=Date.now();rer();
  }catch(e){}
}
const allPurch=()=>{const m=new Map();ST.purch.concat(S.purch||[]).forEach(p=>{if(!p.cancelled)m.set(p.id,p)});return [...m.values()]};
/* जिनका स्क्रीनशॉट चाहिए: विक्रम जी या UPI से दिया गया पैसा (खरीद पर या बाद में दुकान को) */
function need(){
  const done=new Set(ST.pay.map(x=>x.ref));
  const L=[];
  allPurch().forEach(p=>{if((p.pay==="vikram"||p.pay==="upi")&&num(p.paid)>0&&!done.has("p:"+p.id))L.push({ref:"p:"+p.id,kind:"खरीद",p,date:p.date,ts:p.ts,amt:num(p.paid),shop:p.supName||"",phone:p.supPhone||"",by:p.byName||"",mode:p.pay,items:(p.lines||[]).map(l=>l.name+" "+fq(l.qty,l.unit)+"×₹"+l.rate).join(", ")})});
  ST.supPay.forEach(x=>{if((x.mode==="vikram"||x.mode==="upi")&&!done.has("s:"+x.id))L.push({ref:"s:"+x.id,kind:"बाकी का भुगतान",date:x.date,ts:x.ts,amt:num(x.amt),shop:x.supName||"",phone:"",by:x.byName||"",mode:x.mode,items:"पुराना बाकी"})});
  return L.sort((a,b)=>b.ts-a.ts);
}
SP.need=need;
const billNo=p=>{const same=allPurch().filter(x=>x.date===p.date).sort((a,b)=>a.ts-b.ts);const i=same.findIndex(x=>x.id===p.id)+1;const [y,m,d]=p.date.split("-");return `ख-${d}/${m}-${String(i||1).padStart(2,"0")}`};

SP.cardHTML=function(){
  if(!S.isOwner)return "";
  const N=need(),amt=r2(N.reduce((a,x)=>a+x.amt,0)),un=ST.pay.filter(x=>x.kind==="unmatched"&&!x.resolved);
  return `<div class="spcard"><div class="sp-h"><b>🔐 UPI भुगतान मिलान</b><span class="note">सिर्फ़ आपको दिखता है</span></div>
  ${N.length?`<p style="margin:4px 0"><b>विक्रम जी, ${N.length} भुगतान के स्क्रीनशॉट चाहिए · ${rs(amt)}</b></p>
    <div class="sp-need">${N.slice(0,6).map(x=>`<span>${fdate(x.date).slice(0,5)} ${ftime(x.ts)} · ${esc(x.shop||"दुकान")} · <b>${rs(x.amt)}</b></span>`).join("")}${N.length>6?`<span>…और ${N.length-6}</span>`:""}</div>`
  :`<p class="note" style="margin:4px 0">✓ सभी UPI भुगतान मिल गए${ST.pay.length?" ("+ST.pay.filter(x=>x.kind!=="unmatched").length+" बिल पक्के)":""}</p>`}
  ${un.length?`<div class="warn" style="margin:6px 0">⚠ ${un.length} भुगतान ऐसे हैं जिनकी खरीद एंट्री नहीं मिली · ${rs(r2(un.reduce((a,x)=>a+num(x.amt),0)))} — "दुकानदार" में देखें</div>`:""}
  <div class="sp-btns"><button class="big" data-spai>📄 AI फाइल बनाएँ</button><button class="big ghost" data-sppaste>📋 AI का जवाब चिपकाएँ</button>
  <button class="big ghost" data-sppayees>👥 दुकानदार (${ST.payees.length})</button><button class="big ghost" data-spaccts>🏦 मेरे खाते (${ST.accts.length})</button></div></div>`;
};

/* ---------- 📄 AI के लिए HTML फाइल ---------- */
SP.aiHTML=function(){
  const N=need();const rows=N.map((x,i)=>({n:i+1,ref:x.ref,bill:x.p?billNo(x.p):"बाकी",date:x.date,time:ftime(x.ts),kind:x.kind,shop_typed:x.shop,phone_typed:x.phone,items:x.items,amount:x.amt,paid_by:PAYN[x.mode]||x.mode,entered_by:x.by}));
  const data={app:"sabji-express",made:new Date().toISOString(),purchases:rows,known_payees:ST.payees.map(p=>({name:p.name,upi:p.upiIds||[],phones:p.phones||[],shops:p.shops||[]})),owner_accounts:ST.accts};
  const e=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  return `<!doctype html><html lang="hi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>सब्ज़ी एक्सप्रेस — UPI भुगतान मिलान</title>
<style>body{font-family:"Noto Sans Devanagari",system-ui,sans-serif;margin:16px;color:#111;line-height:1.5}h1{font-size:22px;margin:0}h2{font-size:18px;margin:18px 0 6px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #bbb;padding:5px 6px;text-align:left;vertical-align:top}th{background:#f1ecff}.r{text-align:right}
.box{background:#fff8e1;border:1px solid #f0c36d;border-radius:10px;padding:10px 12px}pre{background:#f5f5f5;padding:10px;border-radius:8px;white-space:pre-wrap;font-size:12px}</style></head><body>
<h1>🔐 सब्ज़ी एक्सप्रेस — UPI भुगतान मिलान</h1><p>बनाया: ${e(new Date().toLocaleString("hi-IN"))} · ${rows.length} भुगतान · कुल ₹${r2(N.reduce((a,x)=>a+x.amt,0))}</p>

<h2>🤖 AI के लिए हिदायत (INSTRUCTIONS FOR THE AI)</h2>
<div class="box">
<p>इस फाइल के साथ विक्रम जी कुछ <b>UPI भुगतान के स्क्रीनशॉट</b> (PhonePe / Google Pay / Paytm / BHIM / बैंक ऐप) देंगे। आप एक सावधान मुनीम की तरह काम करें:</p>
<ol>
<li>हर स्क्रीनशॉट से पढ़ें: <b>पाने वाले का नाम</b> (बैंक में दर्ज नाम), <b>UPI ID या मोबाइल</b>, <b>रकम</b>, <b>तारीख-समय</b>, <b>UTR / Transaction ID</b>, <b>किस खाते से गया</b> (बैंक का नाम + खाते के आखिरी 4 अंक), कौन सा ऐप।</li>
<li>हर स्क्रीनशॉट को नीचे की तालिका की किसी एक पंक्ति (<code>ref</code>) से मिलाएँ: रकम बराबर (±₹1) हो, तारीख वही हो, समय खरीद के आस-पास हो (आम तौर पर ±3 घंटे), और दुकान का नाम/मोबाइल मिलता-जुलता हो तो और पक्का। एक स्क्रीनशॉट सिर्फ़ एक पंक्ति से।</li>
<li>जो स्क्रीनशॉट किसी पंक्ति से न मिले, उसे <code>unmatched</code> में डालें — यह बहुत ज़रूरी है (पैसा गया पर खरीद एंट्री नहीं)।</li>
<li>अंदाज़ा न लगाएँ। जो पढ़ा न जाए वह खाली छोड़ें। पक्का न हो तो <code>"conf":"low"</code>।</li>
<li>पहले हिंदी में 3-4 लाइन का छोटा सार दें, फिर <b>सिर्फ़ एक</b> कोड-ब्लॉक में नीचे वाले ढाँचे का JSON दें — विक्रम जी इसे ऐप में चिपकाएँगे।</li>
</ol>
<pre>{"sabji_match":1,
 "items":[{"ref":"p:...","payee":"PAWAN KUMAR","upi":"pawan@ybl","phone":"98290xxxxx","amt":5000,"time":"2026-10-25 08:12","utr":"429812345678","from_bank":"SBI","from_last4":"0499","app":"PhonePe","conf":"high","note":""}],
 "unmatched":[{"payee":"","upi":"","amt":0,"time":"","utr":"","from_bank":"","from_last4":"","app":"","note":""}]}</pre>
</div>

<h2>🧾 जिन भुगतानों का मिलान करना है</h2>
<table><thead><tr><th>#</th><th>ref</th><th>बिल</th><th>तारीख</th><th>समय</th><th>किस्म</th><th>दुकान (कर्मचारी ने लिखा)</th><th>मोबाइल</th><th>सामान</th><th class="r">रकम ₹</th><th>किसने दिया</th><th>एंट्री</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${r.n}</td><td><code>${e(r.ref)}</code></td><td>${e(r.bill)}</td><td>${e(r.date)}</td><td>${e(r.time)}</td><td>${e(r.kind)}</td><td>${e(r.shop_typed)}</td><td>${e(r.phone_typed)}</td><td>${e(r.items)}</td><td class="r"><b>${r.amount}</b></td><td>${e(r.paid_by)}</td><td>${e(r.entered_by)}</td></tr>`).join("")||'<tr><td colspan="12">अभी कोई भुगतान बाकी नहीं</td></tr>'}
</tbody></table>

<h2>👥 पहले से पहचाने दुकानदार</h2>
<table><thead><tr><th>नाम</th><th>UPI</th><th>मोबाइल</th><th>दुकान के नाम (कर्मचारी ने लिखे)</th></tr></thead><tbody>
${ST.payees.map(p=>`<tr><td>${e(p.name)}</td><td>${e((p.upiIds||[]).join(", "))}</td><td>${e((p.phones||[]).join(", "))}</td><td>${e((p.shops||[]).join(", "))}</td></tr>`).join("")||'<tr><td colspan="4">अभी कोई नहीं</td></tr>'}</tbody></table>

<h2>🏦 विक्रम जी के खाते</h2>
<table><thead><tr><th>आखिरी 4 अंक</th><th>खाता</th></tr></thead><tbody>
${ST.accts.map(a=>`<tr><td>…${e(a.last4)}</td><td>${e(a.label)}</td></tr>`).join("")||'<tr><td colspan="2">अभी नहीं जोड़े — स्क्रीनशॉट से जो दिखे वही लिखें</td></tr>'}</tbody></table>

<script type="application/json" id="sabji-data">${JSON.stringify(data).replace(/</g,"\\u003c")}</script>
</body></html>`;
};
SP.makeFile=async function(){
  if(Date.now()-ST.loaded>60000)await loadPurch();
  const N=need();if(!N.length){toast("✓ अभी कोई भुगतान मिलान के लिए बाकी नहीं");return}
  const name="SabjiExpress_UPI_Milan_"+today()+".html";
  if(window.SR&&SR.saveFile)await SR.saveFile(name,SP.aiHTML(),"text/html");
  toast("📄 फाइल बनी — इसे और UPI स्क्रीनशॉट Claude में डालें, फिर उसका जवाब यहाँ चिपकाएँ");
};

/* ---------- 📋 AI का जवाब चिपकाएँ ---------- */
function parseAI(txt){
  txt=String(txt||"");
  const cands=[];const re=/```(?:json)?\s*([\s\S]*?)```/g;let m;while((m=re.exec(txt)))cands.push(m[1]);
  const i=txt.indexOf("{");if(i>-1)cands.push(txt.slice(i,txt.lastIndexOf("}")+1));
  for(const c of cands){try{const j=JSON.parse(c.trim());if(j&&(j.items||j.unmatched))return j}catch(e){}}
  return null;
}
SP.parseAI=parseAI;
function refInfo(ref){
  if(ref&&ref.startsWith("p:")){const p=allPurch().find(x=>x.id===ref.slice(2));return p?{p,amt:num(p.paid),shop:p.supName,phone:p.supPhone,date:p.date,ts:p.ts,label:billNo(p)}:null}
  if(ref&&ref.startsWith("s:")){const x=ST.supPay.find(y=>y.id===ref.slice(2));return x?{amt:num(x.amt),shop:x.supName,phone:"",date:x.date,ts:x.ts,label:"बाकी का भुगतान"}:null}
  return null;
}
SP.pasteSheet=function(){
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="AI का जवाब"><div class="grab"></div>
  <div class="sh-head"><div><h3>📋 AI का जवाब चिपकाएँ</h3><span class="note">Claude ने जो पूरा जवाब दिया, वह यहाँ चिपका दें</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <textarea class="inp" id="spTxt" rows="7" placeholder="यहाँ लंबा दबाएँ → Paste" style="font-family:monospace;font-size:13px"></textarea>
  <button class="big" data-spcheck style="margin-top:8px">🔍 जाँचें</button>
  <div id="spPrev"></div></div></div>`;
  let J=null;
  $("#sheet").onclick=async e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    if(e.target.closest("[data-spcheck]")){J=parseAI($("#spTxt").value);const el=$("#spPrev");
      if(!J){el.innerHTML='<p class="warn">इसमें AI वाला JSON नहीं मिला। Claude से कहें: "ऊपर वाले ढाँचे में JSON दो"</p>';return}
      const it=(J.items||[]),un=(J.unmatched||[]);
      el.innerHTML=`<h3 style="margin:10px 0 6px">✓ ${it.length} मिलान · ${un.length} बिना खरीद</h3>
      <div class="list" style="margin:0">${it.map((x,i)=>{const r=refInfo(x.ref);const diff=r?r2(num(x.amt)-r.amt):null;
        return `<label class="li sp-prev"><input type="checkbox" data-spk="${i}" ${r?"checked":"disabled"}><div class="mid"><b>${r?esc(r.label)+" · "+esc(r.shop||""):"⚠ बिल नहीं मिला ("+esc(x.ref||"")+")"}</b>
        <span>💳 ${esc(x.payee||"?")} ${x.upi?"· "+esc(x.upi):""} · ${rs(num(x.amt))} · ${esc(x.time||"")}</span>
        <span>UTR ${esc(x.utr||"—")} · ${esc(acctLabel(x.from_last4)||x.from_bank||"खाता ?")}${x.conf&&x.conf!=="high"?` · <b style="color:#b45309">भरोसा: ${esc(x.conf)}</b>`:""}${diff?` · <b style="color:var(--chili)">रकम में फर्क ${rs(diff)}</b>`:""}</span></div></label>`}).join("")}
      ${un.map(x=>`<div class="li"><div class="mid"><b style="color:var(--chili)">⚠ बिना खरीद एंट्री: ${esc(x.payee||"?")} · ${rs(num(x.amt))}</b><span>${esc(x.time||"")} · UTR ${esc(x.utr||"—")} · ${esc(acctLabel(x.from_last4)||"")}</span></div></div>`).join("")}</div>
      <button class="big" data-spsave2 style="margin-top:10px">✓ सब सेव करें</button>`;return}
    if(e.target.closest("[data-spsave2]")&&J){
      const pick=new Set([...document.querySelectorAll("[data-spk]:checked")].map(x=>+x.dataset.spk));
      let n=0,u=0;
      for(const [i,x] of (J.items||[]).entries()){if(!pick.has(i))continue;const r=refInfo(x.ref);if(!r)continue;await saveMatch(x,r);n++}
      for(const x of (J.unmatched||[])){if(!(num(x.amt)>0))continue;const id="u_"+slug(x.utr||(x.payee+"_"+x.amt+"_"+x.time));
        try{await S.db.collection("pay").doc(id).set({kind:"unmatched",ref:"",payee:x.payee||"",upi:x.upi||"",phone:x.phone||"",amt:num(x.amt),time:x.time||"",utr:x.utr||"",bank:x.from_bank||"",last4:String(x.from_last4||""),app:x.app||"",note:x.note||"",savedTs:Date.now(),resolved:false},{merge:true});u++}catch(err){}}
      closeSheet();toast(`✓ ${n} भुगतान पक्के हुए${u?` · ⚠ ${u} बिना खरीद एंट्री`:""}`);rer();
    }
  };
  setTimeout(()=>{const t=$("#spTxt");if(t)t.focus()},120);
};
async function saveMatch(x,r){
  const ref=x.ref,id=ref.replace(":","_");
  const doc={kind:ref.startsWith("p:")?"purchase":"supPay",ref,pid:ref.startsWith("p:")?ref.slice(2):"",bill:r.label,date:r.date,shopTyped:r.shop||"",phoneTyped:r.phone||"",billAmt:r.amt,
    payee:String(x.payee||"").trim(),upi:x.upi||"",phone:String(x.phone||"").replace(/\D/g,"").slice(-10),amt:num(x.amt),time:x.time||"",utr:String(x.utr||""),bank:x.from_bank||"",last4:String(x.from_last4||"").replace(/\D/g,"").slice(-4),app:x.app||"",conf:x.conf||"",note:x.note||"",savedTs:Date.now()};
  await S.db.collection("pay").doc(id).set(doc);
  if(doc.payee){
    const key=slug(doc.upi||doc.payee);const ex=ST.payees.find(p=>p.id===key||(doc.upi&&(p.upiIds||[]).includes(doc.upi))||String(p.name).toLowerCase()===doc.payee.toLowerCase());
    const pid=ex?ex.id:key;const o=ex||{};
    const add=(arr,v)=>{arr=[...(arr||[])];if(v&&!arr.includes(v))arr.push(v);return arr};
    const ph=String(r.phone||"").replace(/\D/g,"").slice(-10);
    await S.db.collection("payees").doc(pid).set({name:o.name||doc.payee,upiIds:add(o.upiIds,doc.upi),phones:add(add(o.phones,doc.phone),ph.length===10?ph:""),shops:add(o.shops,r.shop),
      total:r2(num(o.total)+doc.amt),count:(o.count||0)+1,lastTs:Date.now(),lastDate:r.date},{merge:true});
  }
}

/* ---------- 👥 पक्के दुकानदार और उनका इतिहास ---------- */
SP.payeesSheet=function(){
  const un=ST.pay.filter(x=>x.kind==="unmatched"&&!x.resolved);
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="दुकानदार"><div class="grab"></div>
  <div class="sh-head"><div><h3>👥 पक्के दुकानदार</h3><span class="note">UPI स्क्रीनशॉट से पहचाने गए असली नाम</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  ${un.length?`<h4 style="margin:4px 0;color:var(--chili)">⚠ पैसा गया, पर खरीद एंट्री नहीं मिली</h4><div class="list" style="margin:0 0 10px">${un.map(x=>`<div class="li"><div class="mid"><b>${esc(x.payee||"?")} · ${rs(x.amt)}</b><span>${esc(x.time||"")} · UTR ${esc(x.utr||"—")} · ${esc(acctLabel(x.last4))}</span></div><button class="lnk" data-spres="${esc(x.id)}">ठीक है</button></div>`).join("")}</div>`:""}
  <div class="list" style="margin:0">${ST.payees.map(p=>`<button class="li" data-sppe="${esc(p.id)}"><div class="mid"><b>💳 ${esc(p.name)}</b><span>${esc((p.upiIds||[]).join(", "))}${(p.phones||[]).length?" · 📞 "+esc(p.phones.join(", ")):""}</span><span class="note">दुकान: ${esc((p.shops||[]).join(", ")||"—")}</span></div><div class="rt">${rs(p.total||0)}<small>${p.count||0} बार</small></div></button>`).join("")||'<p class="note">अभी कोई नहीं — पहले AI से मिलान करवाएँ</p>'}</div></div></div>`;
  $("#sheet").onclick=async e=>{if(e.target.matches("[data-close]")){closeSheet();return}
    const r=e.target.closest("[data-spres]");if(r){await S.db.collection("pay").doc(r.dataset.spres).update({resolved:true,resolvedTs:Date.now()}).catch(()=>{});SP.payeesSheet();return}
    const p=e.target.closest("[data-sppe]");if(p)SP.payeeHist(p.dataset.sppe)};
};
SP.payeeHist=function(id){
  const pe=ST.payees.find(x=>x.id===id);if(!pe)return;
  const M=ST.pay.filter(x=>x.kind!=="unmatched"&&(String(x.payee).toLowerCase()===String(pe.name).toLowerCase()||(x.upi&&(pe.upiIds||[]).includes(x.upi)))).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const rates={};
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="इतिहास"><div class="grab"></div>
  <div class="sh-head"><div><h3>💳 ${esc(pe.name)}</h3><span class="note">${esc((pe.upiIds||[]).join(", "))} · कुल ${rs(pe.total||0)} · ${pe.count||0} बार</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div class="list" style="margin:0">${M.map(x=>{const p=x.pid?allPurch().find(y=>y.id===x.pid):null;(p&&p.lines||[]).forEach(l=>{(rates[l.name]||(rates[l.name]=[])).push({d:p.date,r:l.rate})});
    return `<div class="li"><div class="mid"><b>${fdate(x.date)} · ${esc(x.bill||"")} · ${rs(x.amt)}</b><span>${p?(p.lines||[]).map(l=>esc(l.name)+" "+fq(l.qty,l.unit)+" @ ₹"+l.rate).join(", "):"पुराना बाकी"}</span><span class="note">UTR ${esc(x.utr||"—")} · ${esc(acctLabel(x.last4)||x.bank||"")} · दुकान "${esc(x.shopTyped||"")}"</span></div></div>`}).join("")||'<p class="note">कोई भुगतान नहीं</p>'}</div>
  ${Object.keys(rates).length?`<h4 style="margin:12px 0 4px">📈 भाव का इतिहास</h4><div class="list" style="margin:0">${Object.entries(rates).map(([n,a])=>`<div class="li"><div class="mid"><b>${esc(n)}</b><span>${a.sort((x,y)=>x.d.localeCompare(y.d)).map(z=>fdate(z.d).slice(0,5)+": ₹"+z.r).join(" → ")}</span></div></div>`).join("")}</div>`:""}
  </div></div>`;
  $("#sheet").onclick=e=>{if(e.target.matches("[data-close]"))closeSheet()};
};

/* ---------- 🏦 मेरे खाते ---------- */
SP.acctSheet=function(){
  const by={};ST.pay.forEach(x=>{const k=x.last4||"?";const o=by[k]||(by[k]={n:0,amt:0});o.n++;o.amt+=num(x.amt)});
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="मेरे खाते"><div class="grab"></div>
  <div class="sh-head"><div><h3>🏦 किस खाते से कितना गया</h3><span class="note">सिर्फ़ आखिरी 4 अंक रखें — पूरा खाता नंबर नहीं</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div class="list" style="margin:0">${Object.entries(by).map(([k,o])=>`<div class="li"><div class="mid"><b>${esc(k==="?"?"खाता पता नहीं":acctLabel(k))}</b><span>${o.n} भुगतान</span></div><div class="rt">${rs(r2(o.amt))}</div></div>`).join("")||'<p class="note">अभी कोई भुगतान मिलान नहीं हुआ</p>'}</div>
  <h4 style="margin:12px 0 4px">मेरे खाते</h4>
  <div class="list" style="margin:0">${ST.accts.map((a,i)=>`<div class="li"><div class="mid"><b>${esc(a.label)}</b><span>…${esc(a.last4)}</span></div><button class="lnk" data-acdel="${i}" style="color:var(--chili)">हटाएँ</button></div>`).join("")}</div>
  <div class="row2" style="margin-top:8px"><input class="inp" id="acL" placeholder="नाम — जैसे विक्रम जी पर्सनल / कमला कंवर"><input class="inp" id="acN" inputmode="numeric" maxlength="4" placeholder="आखिरी 4 अंक"></div>
  <button class="big ghost" data-acadd style="margin-top:6px">+ खाता जोड़ें</button></div></div>`;
  $("#sheet").onclick=async e=>{if(e.target.matches("[data-close]")){closeSheet();return}
    const d=e.target.closest("[data-acdel]");if(d){const L=ST.accts.filter((_,i)=>i!==+d.dataset.acdel);await S.db.doc("ownerCfg/accounts").set({list:L});ST.accts=L;SP.acctSheet();return}
    if(e.target.closest("[data-acadd]")){const label=$("#acL").value.trim(),last4=$("#acN").value.replace(/\D/g,"").slice(-4);if(!label||last4.length!==4){toast("नाम और आखिरी 4 अंक लिखें");return}
      const L=[...ST.accts.filter(a=>a.last4!==last4),{label,last4}];await S.db.doc("ownerCfg/accounts").set({list:L});ST.accts=L;SP.acctSheet()}};
};

/* ---------- खरीद देखते समय (मालिक) ---------- */
SP.purchaseInfoHTML=function(p){
  if(!S.isOwner)return "";const x=ST.pay.find(y=>y.ref==="p:"+p.id);
  if(!x)return (p.pay==="vikram"||p.pay==="upi")?`<p class="note">🔐 UPI स्क्रीनशॉट से मिलान बाकी</p>`:"";
  return `<div class="spinfo">🔐 <b>${esc(x.payee||"")}</b> ${x.upi?"· "+esc(x.upi):""} · ${rs(x.amt)}${Math.abs(num(x.amt)-num(p.paid))>1?` <b style="color:var(--chili)">(बिल में ${rs(p.paid)})</b>`:""}<br>UTR ${esc(x.utr||"—")} · ${esc(acctLabel(x.last4)||x.bank||"")} · ${esc(x.time||"")}</div>`;
};
SP.auditText=function(d){
  if(!S.isOwner)return "";
  const M=ST.pay.filter(x=>x.date===d||(x.kind==="unmatched"&&String(x.time||"").startsWith(d)));
  const N=need().filter(x=>x.date===d);
  if(!M.length&&!N.length)return "इस दिन कोई UPI/विक्रम जी वाला भुगतान नहीं।";
  let t="| बिल | दुकान (लिखा) | असली पाने वाला | UPI | रकम ₹ | बिल रकम ₹ | UTR | खाता |\n|---|---|---|---|---|---|---|---|\n";
  M.forEach(x=>t+=`| ${x.kind==="unmatched"?"⚠ बिना खरीद एंट्री":x.bill||""} | ${x.shopTyped||""} | ${x.payee||""} | ${x.upi||""} | ${x.amt} | ${x.billAmt??""} | ${x.utr||""} | ${acctLabel(x.last4)||x.bank||""} |\n`);
  if(N.length)t+=`\nस्क्रीनशॉट से मिलान अभी बाकी: ${N.map(x=>(x.shop||"दुकान")+" ₹"+x.amt).join(", ")}\n`;
  return t;
};

/* क्लिक */
document.addEventListener("click",e=>{
  if(!S.isOwner)return;
  if(e.target.closest("[data-spai]")){SP.makeFile();return}
  if(e.target.closest("[data-sppaste]")){SP.pasteSheet();return}
  if(e.target.closest("[data-sppayees]")){SP.payeesSheet();return}
  if(e.target.closest("[data-spaccts]")){SP.acctSheet();return}
});
if(window.SF){const _o=SF.onDb;SF.onDb=function(db){_o(db);try{SP.onDb(db)}catch(e){}}}
})();
