/* सब्ज़ी एक्सप्रेस — नए काम (04-11-2026): मंडी सूची, भाव सलाह, समय-जगह, खराबी, हिसाब-लिंक, ऑर्डर, भाव-पोस्टर, बैकअप, महीने का A4, Vyapar फ़ाइल
   नियम: हर हिसाब तभी जब डिब्बा खोला जाए; पुराने दिन का जोड़ फ़ोन में याद (localStorage); कर्मचारी को बिक्री/मुनाफ़ा नहीं */
(function(){
const SX=window.SX={};
const num=v=>{const n=parseFloat(String(v??"").replace(",","."));return isFinite(n)?n:0};
const CFG=window.SE_CONFIG||{};
const dayAdd=(d,n)=>{const x=new Date(d+"T12:00:00");x.setDate(x.getDate()+n);return today(x)};
const LS={get(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const open={};/* कौन-सा डिब्बा खुला है */
const r5=v=>Math.max(5,Math.round(v/5)*5);
const pubBase=()=>String(CFG.updateUrl||location.href.replace(/[^/]*$/,"")).replace(/\/?$/,"/");
const rnd=n=>{const a="abcdefghjkmnpqrstuvwxyz23456789";let s="";const c=crypto&&crypto.getRandomValues?crypto.getRandomValues(new Uint8Array(n)):Array.from({length:n},()=>Math.random()*255);for(let i=0;i<n;i++)s+=a[c[i]%a.length];return s};

/* ---------- रोज़ की बिक्री का जोड़ (हर सब्ज़ी) — पुराने दिन फ़ोन में याद ---------- */
async function dayQty(d){
  if(d===S.billsDate){return aggr(S.dayBills)}
  const k="sx_dq_"+d,c=d<today()?LS.get(k):null;if(c)return c;
  let L=[];try{if(!S.demo&&S.db)L=(await S.db.collection("days/"+d+"/bills").get()).docs.map(x=>x.data())}catch(e){return {q:{},n:0}}
  const a=aggr(L);if(d<today())LS.set(k,a);return a;
}
function aggr(L){const q={};let n=0;(L||[]).forEach(b=>{if(b.cancelled)return;n++;(b.lines||[]).forEach(l=>{if(l.id&&!l.free&&l.id!=="xyz")q[l.id]=r2((q[l.id]||0)+num(l.qty))})});return {q,n}}
SX.history=async function(days,end){end=end||S.billsDate;const out=[];for(let k=0;k<days;k++){const d=dayAdd(end,-k);out.push({d,...await dayQty(d)})}return out};

/* ======================= 1) कल की मंडी सूची ======================= */
SX.mandi=null;
SX.calcMandi=async function(){
  const H=await SX.history(14,S.billsDate);const act=H.filter(x=>x.n>0);const nd=act.length||1;
  const tw=new Date(dayAdd(S.billsDate,1)+"T12:00:00").getDay();
  const rows=[];const R=SF.dayRows?SF.dayRows():[];const RR={};R.forEach(r=>RR[r.it.id]=r);
  S.items.filter(i=>i.active!==false&&!i.virtual&&!i.track&&!i.pending&&i.id!=="xyz").forEach(it=>{
    let tot=0,sd=0,wd=0,wn=0;act.forEach(x=>{const q=num(x.q[it.id]);tot+=q;if(q>0)sd++;if(new Date(x.d+"T12:00:00").getDay()===tw){wd+=q;wn++}});
    const avg=tot/nd,wavg=wn?wd/wn:avg,fc=avg*0.7+wavg*0.3;
    const r=RR[it.id];const ent=r&&r.close!=null&&r.close!=="";const left=ent?num(r.close):Math.max(0,num(r&&r.expect));
    const step=it.unit==="kg"?0.5:1;const need=Math.max(0,Math.ceil((fc*1.1-left)/step)*step);
    const cost=num(SF.costOf?SF.costOf(it):it.cost);
    if(avg<=0&&left<=0)return;
    rows.push({it,avg:r2(avg),left:r2(left),ent,need,cost,amt:r2(need*cost),rare:sd<Math.min(3,Math.ceil(act.length/3))});
  });
  rows.sort((a,b)=>b.amt-a.amt);SX.mandi={rows,days:act.length,ts:Date.now(),date:S.billsDate};return SX.mandi;
};
SX.mandiHTML=function(){if(!S.isOwner)return "";
  const M=SX.mandi&&SX.mandi.date===S.billsDate?SX.mandi:null;const body=!open.mandi?"":!M?'<p class="note">⏳ पिछले 14 दिन की बिक्री देखी जा रही है…</p>':(()=>{
    const buy=M.rows.filter(r=>r.need>0&&!r.rare),rare=M.rows.filter(r=>r.need>0&&r.rare),skip=M.rows.filter(r=>r.need<=0&&r.left>0);
    const tot=r2(buy.reduce((a,r)=>a+r.amt,0));
    return `<p class="note" style="margin:0 0 6px">${M.days} दिन की बिक्री से · कल (${fdate(dayAdd(S.billsDate,1)).slice(0,5)}) के लिए · ${M.rows.some(r=>!r.ent)?"⚠ रात का स्टॉक पूरा नहीं — बचा माल अंदाज़े से":"रात का बचा माल लिखा हुआ"}</p>
    <div class="tblwrap"><table class="rrt"><thead><tr><th>सब्ज़ी</th><th class="r">रोज़ बिकी</th><th class="r">बचा</th><th class="r">लाना है</th><th class="r">≈ ₹</th></tr></thead><tbody>
    ${buy.map(r=>`<tr><td>${esc(r.it.name)}</td><td class="r">${fq(r.avg,r.it.unit)}</td><td class="r">${fq(r.left,r.it.unit)}</td><td class="r"><b>${fq(r.need,r.it.unit)}</b></td><td class="r">${r.cost?rs(r.amt):"—"}</td></tr>`).join("")}
    <tr class="tot"><td>कुल अंदाज़न खरीद</td><td></td><td></td><td></td><td class="r">${rs(tot)}</td></tr></tbody></table></div>
    ${rare.length?`<p class="note" style="margin:6px 0 0">🟡 कभी-कभी बिकती है — ज़रूरत हो तो: ${rare.map(r=>esc(r.it.name)+" "+fq(r.need,r.it.unit)).join(", ")}</p>`:""}
    ${skip.length?`<p class="note" style="margin:4px 0 0">🔴 कल मत लाएँ (बचा काफ़ी है): ${skip.map(r=>esc(r.it.name)).join(", ")}</p>`:""}
    <div class="row2" style="margin-top:8px"><button class="big" data-sxmandiwa>📤 मंडी सूची WhatsApp पर</button><button class="big ghost" data-sxmandire>🔄 दोबारा</button></div>`})();
  return `<div class="card2 sxc"><div class="rr-h"><h3 style="margin:0">🛒 कल की मंडी सूची</h3><button class="lnk" data-sxo="mandi">${open.mandi?"बंद करें":"खोलें ›"}</button></div>${body}</div>`};
SX.mandiText=function(){const M=SX.mandi;if(!M)return "";const L=M.rows.filter(r=>r.need>0&&!r.rare);
  return `🛒 *कल की मंडी सूची* — ${fdate(dayAdd(M.date,1))}\nसब्ज़ी एक्सप्रेस\n━━━━━━━━━━━━\n${L.map((r,i)=>`${i+1}. ${r.it.name} — ${fq(r.need,r.it.unit)}`).join("\n")}\n━━━━━━━━━━━━\n🙏 ताज़ा और अच्छा माल ही लें। बिल की फोटो ऐप में डालें।`};

/* ======================= 2) भाव की सलाह ======================= */
SX.priceRows=function(){const out=[];const P=SF.livePurch?SF.livePurch():[];
  const bought={};P.forEach(p=>(p.lines||[]).forEach(l=>{if(l.id)bought[l.id]=1}));
  S.items.filter(i=>i.active!==false&&!i.virtual&&num(i.sale)>0).forEach(it=>{const c=num(SF.costOf?SF.costOf(it):it.cost);if(!(c>0))return;
    const m=(num(it.sale)-c)/num(it.sale);const today=!!bought[it.id];
    if(m<0.30)out.push({it,c:r2(c),m,sug:r5(c/0.65),lv:m<0.15?"hi":"mid",today});
    else if(m>0.60&&today)out.push({it,c:r2(c),m,sug:null,lv:"lo",today})});
  return out.sort((a,b)=>a.m-b.m)};
SX.priceHTML=function(){if(!S.isOwner)return "";const L=SX.priceRows();if(!L.length)return "";
  const low=L.filter(x=>x.sug),hiM=L.filter(x=>!x.sug);
  return `<div class="card2 sxc"><h3 style="margin:0 0 6px">💹 भाव की सलाह <small class="note">· ${low.length?low.length+" सब्ज़ी में मुनाफ़ा 30% से कम":"सब ठीक"}</small></h3>
  ${low.slice(0,open.priceAll?99:6).map(x=>`<div class="sx-pr ${x.lv}"><div><b>${esc(x.it.name)}</b><span>खरीद ${rs(x.c)} · बिक्री ${rs(x.it.sale)} · मुनाफ़ा ${Math.round(x.m*100)}%${x.today?" · आज की मंडी":""}</span></div><button class="chip" data-sxrate="${esc(x.it.id)}|${x.sug}">✓ ₹${x.sug} करें</button></div>`).join("")}${low.length>6?`<button class="lnk" data-sxo="priceAll" style="margin-top:4px">${open.priceAll?"कम दिखाएँ":"सब "+low.length+" देखें ›"}</button>`:""}
  ${hiM.length?`<p class="note" style="margin:6px 0 0">ℹ️ भाव काफ़ी ज़्यादा (60%+ मुनाफ़ा), ग्राहक टूट न जाएँ: ${hiM.map(x=>esc(x.it.name)+" "+rs(x.it.sale)).join(", ")}</p>`:""}</div>`};
SX.setRate=async function(id,sale){const it=item(id);if(!it||!S.isOwner)return;const old=num(it.sale),now=Date.now();
  try{if(!S.demo&&S.db){await S.db.collection("items").doc(id).update({sale,ratePrev:old,rateTs:now,rateBy:S.uid||"",rateByName:"विक्रम जी (भाव सलाह)"});
      await S.db.collection("priceLog").doc("sx"+id+now.toString(36)).set({itemId:id,name:it.name,field:"sale",old,new:sale,ts:now,by:S.uid||"",byName:"विक्रम जी",note:"भाव सलाह"})}
    it.sale=sale;toast("✓ "+it.name+" का भाव ₹"+old+" → ₹"+sale);SX.pubRates(true);try{renderPane()}catch(e){}}catch(e){toast("भाव नहीं बदला: "+(e.code||""))}};

/* ======================= 3) जगह और समय की कमाई ======================= */
SX.slot={days:7,res:null};
SX.calcSlots=async function(days){const to=today(),from=dayAdd(to,-(days-1));const B=(await SF.fetchRange(from,to)).filter(b=>!b.cancelled&&b.mode!=="inst");
  const ds=new Set(B.map(b=>b.date)),nd=Math.max(1,ds.size);const hr={},pl={};
  B.forEach(b=>{const h=new Date(b.ts).getHours();hr[h]=(hr[h]||0)+num(b.total);const p=b.loc&&SR.placeAt?SR.placeAt(b.loc):null;
    const nm=p?p.name:(b.loc&&b.loc.lat!=null?"बिना नाम ("+num(b.loc.lat).toFixed(3)+","+num(b.loc.lng).toFixed(3)+")":"जगह दर्ज नहीं");
    const o=pl[nm]||(pl[nm]={nm,amt:0,n:0,slot:{}});o.amt+=num(b.total);o.n++;const sl=Math.floor(h/2)*2;o.slot[sl]=(o.slot[sl]||0)+num(b.total)});
  const P=Object.values(pl).map(o=>({...o,day:r2(o.amt/nd)})).sort((a,b)=>b.amt-a.amt);
  const route=[];for(let s=6;s<=20;s+=2){let best=null;P.forEach(o=>{const v=num(o.slot[s]);if(v>0&&(!best||v>best.v))best={nm:o.nm,v}});if(best)route.push({s,nm:best.nm,day:r2(best.v/nd)})}
  SX.slot={days,res:{hr,P,route,nd,from,to,n:B.length}};return SX.slot.res};
SX.slotHTML=function(){if(!S.isOwner)return "";const R=SX.slot.res;let body="";
  if(open.slot){if(!R)body='<p class="note">⏳ बिल देखे जा रहे हैं…</p>';else{const mx=Math.max(1,...Object.values(R.hr));
    body=`<p class="note" style="margin:0 0 6px">${fdate(R.from).slice(0,5)}–${fdate(R.to).slice(0,5)} · ${R.nd} दिन · ${R.n} बिल · रोज़ का औसत</p>
    <div class="sx-hr">${Array.from({length:14},(_,i)=>i+7).map(h=>{const v=num(R.hr[h])/R.nd;return `<div title="${h}–${h+1} बजे"><i style="height:${Math.round(num(R.hr[h])/mx*100)}%"></i><span>${h>12?h-12:h}</span><small>${v>=1?Math.round(v):""}</small></div>`}).join("")}</div>
    ${R.route.length?`<h4 style="margin:8px 0 4px">🧭 सुझाया रूट (हर 2 घंटे की सबसे कमाऊ जगह)</h4><div class="sx-rt">${R.route.map(x=>`<span><b>${x.s>12?x.s-12:x.s}–${x.s+2>12?x.s+2-12:x.s+2}</b> ${esc(x.nm)} <small>${rs(x.day)}/रोज़</small></span>`).join("<i>→</i>")}</div>`:""}
    <h4 style="margin:8px 0 4px">📍 जगह-वार (रोज़ का औसत)</h4>
    <div class="tblwrap"><table class="rrt"><tbody>${R.P.slice(0,10).map(o=>{const bs=Object.entries(o.slot).sort((a,b)=>b[1]-a[1])[0];return `<tr><td>${esc(o.nm)}</td><td class="r">${rs(o.day)}</td><td class="r"><small>सबसे अच्छा ${bs?(+bs[0]>12?+bs[0]-12:+bs[0])+"–"+(+bs[0]+2>12?+bs[0]+2-12:+bs[0]+2)+" बजे":"—"}</small></td></tr>`}).join("")}</tbody></table></div>`}}
  return `<div class="card2 sxc"><div class="rr-h"><h3 style="margin:0">⏰ समय और जगह की कमाई</h3><button class="lnk" data-sxo="slot">${open.slot?"बंद करें":"खोलें ›"}</button></div>
  ${open.slot?`<div class="bf-r" style="margin:6px 0">${[7,14,30].map(d=>`<button class="chip" data-sxslot="${d}" aria-pressed="${SX.slot.days===d}">${d} दिन</button>`).join("")}</div>`:""}${body}</div>`};

/* ======================= 4) खराबी रिपोर्ट ======================= */
SX.waste=null;
SX.calcWaste=async function(){const to=today();const W={};let days=0;
  for(let k=0;k<30;k++){const d=dayAdd(to,-k);let st=null;const ck=d<to?LS.get("sx_wl_"+d):null;
    if(ck)st=ck;else{try{if(!S.demo&&S.db){const x=await S.db.doc("days/"+d+"/meta/stock").get();st=x.exists?(x.data().wlog||[]).map(w=>({id:w.id,q:num(w.qty)})):[]}}catch(e){st=[]}if(d<to&&st)LS.set("sx_wl_"+d,st)}
    if(st&&st.length)days++;(st||[]).forEach(w=>{const o=W[w.id]||(W[w.id]={q:0,n:0});o.q=r2(o.q+w.q);o.n++})}
  const H=await SX.history(30,to);const sold={};H.forEach(x=>Object.entries(x.q).forEach(([id,q])=>sold[id]=r2((sold[id]||0)+q)));
  const rows=Object.entries(W).map(([id,o])=>{const it=item(id);const c=it?num(SF.costOf?SF.costOf(it):it.cost):0;const s=num(sold[id]);return {id,name:it?it.name:id,unit:it?it.unit:"kg",q:o.q,n:o.n,loss:r2(o.q*c),pct:s+o.q>0?Math.round(o.q/(s+o.q)*100):0}}).sort((a,b)=>b.loss-a.loss);
  SX.waste={rows,days,tot:r2(rows.reduce((a,r)=>a+r.loss,0)),ts:Date.now()};return SX.waste};
SX.wasteHTML=function(){if(!S.isOwner)return "";const W=SX.waste;let body="";
  if(open.waste){body=!W?'<p class="note">⏳ 30 दिन की खराबी देखी जा रही है…</p>':!W.rows.length?'<p class="note">पिछले 30 दिन में कोई खराबी दर्ज नहीं</p>':`<p style="margin:0 0 6px">30 दिन में खराबी से नुकसान <b style="color:var(--chili)">${rs(W.tot)}</b> <small class="note">(खरीद भाव पर)</small></p>
    <div class="tblwrap"><table class="rrt"><thead><tr><th>सब्ज़ी</th><th class="r">कितनी बार</th><th class="r">मात्रा</th><th class="r">नुकसान</th><th class="r">% माल</th></tr></thead><tbody>${W.rows.map(r=>`<tr><td>${esc(r.name)}</td><td class="r">${r.n}</td><td class="r">${fq(r.q,r.unit)}</td><td class="r">${rs(r.loss)}</td><td class="r ${r.pct>=10?"bad":""}">${r.pct}%</td></tr>`).join("")}</tbody></table></div>
    ${W.rows.filter(r=>r.pct>=10).map(r=>`<p class="ud-w" style="margin:4px 0 0">⚠ ${esc(r.name)}: ${r.pct}% माल खराब — खरीद ${r.pct>=20?"आधी":"थोड़ी कम"} करें</p>`).join("")}`}
  return `<div class="card2 sxc"><div class="rr-h"><h3 style="margin:0">🗑️ खराबी रिपोर्ट (30 दिन)</h3><button class="lnk" data-sxo="waste">${open.waste?"बंद करें":"खोलें ›"}</button></div>${body}</div>`};

/* ======================= 5) ग्राहक का हिसाब-लिंक ======================= */
SX.hisabLink=async function(pid){const p=(S.parties||[]).find(x=>x.id===pid);if(!p){toast("खाता नहीं मिला");return}if(p.hide){toast("🔒 छिपे खाते का लिंक नहीं बनता");return}
  let tok=p.pubToken;if(!tok){tok=rnd(16);try{if(!S.demo)await S.db.collection("parties").doc(pid).update({pubToken:tok})}catch(e){toast("लिंक नहीं बना (सर्वर नियम नए चिपकाएँ): "+(e.code||""));return}p.pubToken=tok}
  const E=(S.ledger||[]).filter(l=>l.partyId===pid).sort((a,b)=>a.ts-b.ts).slice(-200).map(l=>({d:l.date||"",t:l.type,a:num(l.amt),b:l.billNo||"",m:l.mode||"",o:l.opening?1:0}));
  const b=typeof balRaw==="function"?balRaw(pid):bal(pid);
  const doc={type:"hisab",name:p.name||"",bal:r2(b),entries:E,upi:upiId(),payee:"Sabji Express",ts:Date.now(),by:biller()||""};
  try{if(!S.demo)await S.db.collection("pub").doc(tok).set(doc)}catch(e){toast("लिंक नहीं बना (सर्वर नियम नए चिपकाएँ): "+(e.code||""));return}
  const url=pubBase()+"h.html?t="+tok;
  const txt=`🙏 नमस्ते ${p.name} जी,\nसब्ज़ी एक्सप्रेस में आपका हिसाब: *₹${r2(b)} बाकी*\nपूरा तारीख-वार हिसाब और UPI से चुकाने का बटन इस लिंक पर 👇\n${url}\nधन्यवाद 🥬`;
  window.open(waLink(txt,p.phone||""),"_blank");SX._lastLink=url;return url};

/* ======================= 7) पहले से ऑर्डर ======================= */
SX.orders=[];SX._oUn=null;
SX.watchOrders=function(){if(S.demo||!S.db||SX._oUn)return;try{SX._oUn=S.db.collection("orders").where("status","in",["new","billing"]).onSnapshot(s=>{SX.orders=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>num(b.ts)-num(a.ts));SX.orderPill()},()=>{})}catch(e){}};
SX.orderPill=function(){let el=document.getElementById("sxOrd");const n=SX.orders.filter(o=>o.status==="new").length,m=SX.orders.length;
  if(!m){if(el)el.remove();return}if(!el){el=document.createElement("button");el.id="sxOrd";el.className="sx-ord";el.type="button";el.setAttribute("data-sxorders","1");document.body.appendChild(el)}
  el.innerHTML=`📥 ऑर्डर <b>${m}</b>${n?'<i></i>':""}`;if(n&&!SX._beeped){SX._beeped=1;try{beep(true)}catch(e){}}};
SX.ordersSheet=function(){const L=SX.orders;$("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="ऑर्डर"><div class="grab"></div>
  <div class="sh-head"><div><h3>📥 ग्राहकों के ऑर्डर (${L.length})</h3><span class="note">ऑर्डर-लिंक: ${esc(pubBase()+"o.html")}</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  ${L.length?L.map(o=>`<div class="card2 sx-o"><div class="rr-h"><b>${esc(o.name||"ग्राहक")} · ${esc(o.phone||"")}</b><small class="note">${ftime(o.ts)}${o.status==="billing"?" · 🧾 बिल बन रहा":""}</small></div>
    ${o.addr?`<p class="note" style="margin:2px 0">📍 ${esc(o.addr)}</p>`:""}<p style="margin:4px 0">${(o.items||[]).map(x=>esc(x.n)+" "+fq(num(x.q),x.u||"kg")).join(", ")}</p>${o.note?`<p class="note" style="margin:0">📝 ${esc(o.note)}</p>`:""}
    <div class="row2" style="margin-top:6px"><button class="big" data-sxobill="${esc(o.id)}">🧾 बिल बनाएँ</button><a class="big ghost" target="_blank" rel="noopener" href="${waLink(`🙏 नमस्ते ${o.name||""} जी, आपका ऑर्डर मिल गया — सब्ज़ी एक्सप्रेस की गाड़ी जल्द आपके पास पहुँचेगी 🚐🥬`,o.phone||"")}">✓ WhatsApp पुष्टि</a></div>
    <div class="row2" style="margin-top:6px"><button class="big ghost" data-sxodone="${esc(o.id)}">✓ पूरा हो गया</button><button class="big ghost" data-sxono="${esc(o.id)}" style="color:var(--chili)">✕ रद्द</button></div></div>`).join(""):'<div class="empty">अभी कोई ऑर्डर नहीं</div>'}
  <div class="row2" style="margin-top:6px"><button class="big ghost" data-sxolink>🔗 ऑर्डर-लिंक भेजें</button><button class="big ghost" data-sxqr>📲 घर-घर का QR</button></div></div></div>`};
SX.orderBill=async function(id){const o=SX.orders.find(x=>x.id===id);if(!o)return;closeSheet();S.tab="bill";showTab();
  if(String(o.phone||"").length===10){S.mode="walk";S.cust={phone:o.phone,name:o.name||""}}
  (o.items||[]).forEach(x=>{const it=item(x.id);if(it&&num(x.q)>0)try{quickAdd(it,num(x.q))}catch(e){}});
  try{if(!S.demo)await S.db.collection("orders").doc(id).update({status:"billing",byName:biller()||"",bts:Date.now()})}catch(e){}
  S.sxOrder={id,phone:o.phone,ts:Date.now()};try{refreshAfterCart()}catch(e){}toast("📥 ऑर्डर का सामान बिल में — तौलकर मात्रा ठीक करें, फिर सेव करें")};
SX.orderSet=async function(id,status,extra){try{if(!S.demo)await S.db.collection("orders").doc(id).update({status,dts:Date.now(),byName:biller()||"",...(extra||{})})}catch(e){toast("नहीं हुआ: "+(e.code||""))}};
/* बिल सेव हुआ तो उसी ग्राहक का ऑर्डर अपने-आप पूरा */
SX.checkOrderDone=function(){const o=S.sxOrder;if(!o)return;const b=(S.dayBills||[]).find(x=>!x.cancelled&&x.ts>o.ts&&(!o.phone||x.custPhone===o.phone));if(b){S.sxOrder=null;SX.orderSet(o.id,"done",{billNo:b.no});toast("✓ ऑर्डर पूरा — बिल "+b.no)}};
SX.pubRates=async function(force){if(S.demo||!S.db||!(S.isOwner||S.uid))return;/* साथी के फोन से भी भाव जाएँ — तीन-दुकान ऑर्डर-पेज इन्हीं से चलता है */const k="sx_pubr";const last=LS.get(k)||0;
  const L=S.items.filter(i=>i.active!==false&&!i.virtual&&!i.pending&&num(i.sale)>0&&i.id!=="xyz"&&!i.track).map(i=>{const ps=SE.photoSrc(i);return {id:i.id,n:i.name,e:window.SN&&SN.en?SN.en(i):"",u:i.unit,s:num(i.sale),c:i.cat||"",p:ps&&!/^data:/.test(ps)?ps:"",h:num(i.hue)}});
  const h=JSON.stringify(L.map(i=>[i.id,i.s,i.p]));if(!force&&Date.now()-last<6*3600e3&&LS.get("sx_pubh")===h)return;
  try{await S.db.collection("pub").doc("rates").set({type:"rates",items:L,ts:Date.now(),phone:String(S.settings.ownerPh||"").replace(/\D/g,"").slice(-10)});LS.set(k,Date.now());LS.set("sx_pubh",h)}catch(e){}};

/* ======================= 8) रोज़ का भाव-पोस्टर ======================= */
const loadImg=src=>new Promise(r=>{if(!src)return r(null);const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src});
SX.poster=async function(){toast("🖼️ भाव-पोस्टर बन रहा है…");try{await document.fonts.load('800 40px "Baloo 2"');await document.fonts.load('700 28px "Mukta"')}catch(e){}
  const L=S.items.filter(i=>i.active!==false&&!i.virtual&&!i.pending&&num(i.sale)>0&&i.id!=="xyz"&&!i.track).sort((a,b)=>(+a.order||0)-(+b.order||0)).slice(0,24);
  const W=1080,H=1350,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  let g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,"#0d1a33");g.addColorStop(1,"#1b3566");x.fillStyle=g;x.fillRect(0,0,W,H);
  x.fillStyle="#fff";x.font='800 64px "Baloo 2",sans-serif';x.textAlign="center";x.fillText("🚐 सब्ज़ी एक्सप्रेस",W/2,92);
  x.font='700 34px "Mukta",sans-serif';x.fillStyle="#ffb067";x.fillText("आज के ताज़ा भाव · "+fdate(today()),W/2,142);
  const cols=3,rowsN=Math.ceil(L.length/cols),top=180,bot=1160,cw=(W-80)/cols,ch=Math.min(150,(bot-top)/Math.max(1,rowsN));
  const imgs=await Promise.all(L.map(i=>loadImg(SE.photoSrc(i))));
  L.forEach((it,k)=>{const cx=40+(k%cols)*cw,cy=top+Math.floor(k/cols)*ch;const pad=8;
    x.fillStyle="rgba(255,255,255,.96)";const rr=(X,Y,w,h,r)=>{x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath()};
    rr(cx+pad,cy+pad,cw-2*pad,ch-2*pad,20);x.fill();const s=ch-2*pad-16;
    if(imgs[k]){x.save();rr(cx+pad+8,cy+pad+8,s,s,14);x.clip();const im=imgs[k],sc=Math.max(s/im.width,s/im.height);x.drawImage(im,cx+pad+8+(s-im.width*sc)/2,cy+pad+8+(s-im.height*sc)/2,im.width*sc,im.height*sc);x.restore()}
    else{x.font=`${Math.round(s*.7)}px sans-serif`;x.textAlign="center";x.fillText(it.emoji||"🥬",cx+pad+8+s/2,cy+pad+8+s*.78)}
    x.textAlign="left";x.fillStyle="#1c1c1e";x.font=`700 ${Math.round(ch*.21)}px "Mukta",sans-serif`;const tx=cx+pad+s+20;
    let nm=it.name;while(x.measureText(nm).width>cw-2*pad-s-26&&nm.length>2)nm=nm.slice(0,-1);x.fillText(nm,tx,cy+pad+ch*.36);
    x.fillStyle="#e04a00";x.font=`800 ${Math.round(ch*.27)}px "Baloo 2",sans-serif`;const pr="₹"+num(it.sale);x.fillText(pr,tx,cy+pad+ch*.72);const pw=x.measureText(pr).width;
    x.fillStyle="#6e6e73";x.font=`600 ${Math.round(ch*.15)}px "Mukta",sans-serif`;x.fillText("/"+(UNITS[it.unit]||it.unit),tx+pw+4,cy+pad+ch*.72)});
  /* नीचे: ऑर्डर QR */
  const url=pubBase()+"o.html";let qr=null;try{if(window.QRCode){const d=document.createElement("div");new QRCode(d,{text:url,width:180,height:180,correctLevel:QRCode.CorrectLevel.M});await new Promise(r=>setTimeout(r,60));qr=d.querySelector("canvas")||await loadImg((d.querySelector("img")||{}).src)}}catch(e){}
  x.fillStyle="#fff";x.fillRect(40,1175,200,200-30);if(qr)x.drawImage(qr,50,1180,160,160);
  x.textAlign="left";x.fillStyle="#fff";x.font='800 40px "Baloo 2",sans-serif';x.fillText("📱 घर बैठे ऑर्डर करें — QR स्कैन करें",270,1235);
  x.font='600 28px "Mukta",sans-serif';x.fillStyle="#cfe0ff";x.fillText("UPI / नकद · जालीपा कैंट, बाड़मेर · गाड़ी आपकी गली में 🚐",270,1285);
  x.fillStyle="#ffb067";x.fillText(url.replace(/^https?:\/\//,""),270,1325);
  const blob=await new Promise(r=>c.toBlob(r,"image/png"));await SX.shareBlob(blob,"SabjiExpress_Bhav_"+today(),"png","image/png","🥬 सब्ज़ी एक्सप्रेस — आज के ताज़ा भाव 👇 घर बैठे ऑर्डर: "+url)};

/* ---------- फ़ाइल शेयर (APK में सीधे WhatsApp/Drive; ब्राउज़र में शेयर या डाउनलोड) ---------- */
SX.shareBlob=async function(blob,name,ext,mime,text){
  const b64=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(String(fr.result).split(",")[1]);fr.readAsDataURL(blob)});
  if(SE.isNative&&window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.BtPrinter){try{await Capacitor.Plugins.BtPrinter.shareFile({data:b64,name,pdf:false,mime:ext==="png"?"":mime,ext,text:text||""});return}catch(e){toast("फ़ाइल शेयर नहीं हुई — नया APK डालें (लिंक वही)");return}}
  const file=new File([blob],name+"."+ext,{type:mime});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text:text||""});return}}catch(e){if(e&&e.name==="AbortError")return}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name+"."+ext;document.body.appendChild(a);a.click();a.remove();toast("⬇️ फ़ाइल डाउनलोड हुई: "+name+"."+ext)};

/* ======================= 14) बैकअप ======================= */
const clean=o=>JSON.parse(JSON.stringify(o,(k,v)=>k==="pin"||k==="pinHash"?undefined:v));
SX.autoBackup=async function(){if(!S.isOwner||S.demo||!S.db)return;const y=dayAdd(today(),-1);if(LS.get("sx_bk")===y)return;
  try{const ref=S.db.doc("ownerCfg/bk_"+y);const ex=await ref.get();if(ex.exists){LS.set("sx_bk",y);return}
    const [bills,kh,st,cl,pu]=await Promise.all([S.db.collection("days/"+y+"/bills").get(),S.db.collection("days/"+y+"/kharch").get(),S.db.doc("days/"+y+"/meta/stock").get(),S.db.doc("days/"+y+"/meta/close").get(),S.db.collection("purchases").where("date","==",y).get()]);
    const doc=clean({date:y,ts:Date.now(),bills:bills.docs.map(d=>d.data()),kharch:kh.docs.map(d=>({id:d.id,...d.data()})),stock:st.exists?st.data():null,close:cl.exists?cl.data():null,purchases:pu.docs.map(d=>({id:d.id,...d.data()})),ledger:(S.ledger||[]).filter(l=>l.date===y)});
    let js=JSON.stringify(doc);if(js.length>900000){doc.bills=doc.bills.map(b=>({...b,edits:undefined}));js=JSON.stringify(doc)}
    if(js.length<1000000)await ref.set(JSON.parse(js));LS.set("sx_bk",y)}catch(e){}};
SX.backupFile=async function(){if(!S.isOwner)return;toast("📦 बैकअप फ़ाइल बन रही है… (30 दिन)");const out={app:"सब्ज़ी एक्सप्रेस",made:new Date().toISOString(),days:{}};
  try{const g=async c=>(await S.db.collection(c).get()).docs.map(d=>({id:d.id,...d.data()}));
    [out.items,out.parties,out.ledger,out.suppliers,out.supPay]=await Promise.all(["items","parties","ledger","suppliers","supPay"].map(g));
    out.purchases=(await S.db.collection("purchases").where("date",">=",dayAdd(today(),-30)).get()).docs.map(d=>({id:d.id,...d.data()}));
    for(let k=0;k<30;k++){const d=dayAdd(today(),-k);const b=(await S.db.collection("days/"+d+"/bills").get()).docs.map(x=>x.data());const st=await S.db.doc("days/"+d+"/meta/stock").get();if(b.length||st.exists)out.days[d]={bills:b,stock:st.exists?st.data():null}}
  }catch(e){toast("बैकअप अधूरा: "+(e.code||e.message||""))}
  const blob=new Blob([JSON.stringify(clean(out))],{type:"application/json"});await SX.shareBlob(blob,"SabjiExpress_Backup_"+today(),"json","application/json","सब्ज़ी एक्सप्रेस का बैकअप "+fdate(today())+" — इसे Google Drive में रखें");LS.set("sx_bkf",Date.now());try{renderReport()}catch(e){}};

/* ======================= 15) महीने का हिसाब A4 ======================= */
SX.monthA4=async function(ym){if(!S.isOwner)return;toast("📄 "+ym+" का हिसाब बन रहा है…");
  const first=ym+"-01",lastD=new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate(),last=ym+"-"+String(lastD).padStart(2,"0"),to=last>today()?today():last;
  const B=await SF.fetchRange(first,to);const days={};const per={};let kh=0,ws=0,buy=0;
  B.forEach(b=>{const o=days[b.date]||(days[b.date]={n:0,sale:0,cash:0,upi:0,ud:0,inst:0,pf:0});if(b.cancelled)return;o.n++;if(b.mode==="inst"){o.inst+=num(b.total);return}
    o.sale+=num(b.total);o.cash+=num(b.pay&&b.pay.cash);o.upi+=num(b.pay&&b.pay.upi);o.ud+=num(b.pay&&b.pay.udhar);try{o.pf+=num((SF.billProfit(b)||{}).p)}catch(e){}
    const s=per[b.byName||"—"]||(per[b.byName||"—"]={n:0,sale:0});s.n++;s.sale+=num(b.total)});
  try{const P=(await S.db.collection("purchases").where("date",">=",first).get()).docs.map(d=>d.data()).filter(p=>!p.cancelled&&p.date<=to);buy=P.reduce((a,p)=>a+num(p.total),0)}catch(e){}
  for(const d of Object.keys(days).sort()){try{const k=(await S.db.collection("days/"+d+"/kharch").get()).docs.map(x=>x.data());const kd=k.reduce((a,x)=>a+num(x.amt),0);days[d].kh=kd;kh+=kd;
      const st=await S.db.doc("days/"+d+"/meta/stock").get();const wl=st.exists?(st.data().wlog||[]):[];const wv=wl.reduce((a,w)=>{const it=item(w.id);return a+num(w.qty)*(it?num(SF.costOf(it)):0)},0);days[d].ws=wv;ws+=wv}catch(e){}}
  const D=Object.keys(days).sort();const T={n:0,sale:0,cash:0,upi:0,ud:0,inst:0,pf:0};D.forEach(d=>Object.keys(T).forEach(k=>T[k]+=num(days[d][k])));
  const real=r2(T.pf-kh-ws);const udTot=r2((S.parties||[]).filter(p=>!p.hide).reduce((a,p)=>a+Math.max(0,bal(p.id)),0));
  const td=v=>`<td class="r">₹${Math.round(v).toLocaleString("en-IN")}</td>`;const mName=new Date(first+"T12:00:00").toLocaleDateString("hi-IN",{month:"long",year:"numeric"});
  const body=`<h2>📅 ${mName} का पूरा हिसाब</h2>
  <table><tbody><tr><td>ग्राहकों को बिक्री</td>${td(T.sale)}</tr><tr><td>— नकद / UPI / उधार</td><td class="r">₹${Math.round(T.cash).toLocaleString("en-IN")} / ₹${Math.round(T.upi).toLocaleString("en-IN")} / ₹${Math.round(T.ud).toLocaleString("en-IN")}</td></tr>
  <tr><td>अपनी संस्थाओं को (खरीद भाव)</td>${td(T.inst)}</tr><tr><td>मंडी खरीद</td>${td(buy)}</tr><tr><td>बिलों पर फायदा (बिक्री − लागत)</td>${td(T.pf)}</tr>
  <tr><td>− खर्च</td>${td(kh)}</tr><tr><td>− खराबी (खरीद भाव)</td>${td(ws)}</tr><tr class="tot"><td>असली मुनाफ़ा (अंदाज़ा)</td>${td(real)}</tr><tr><td>आज की तारीख तक कुल उधार बाकी</td>${td(udTot)}</tr></tbody></table>
  <h3>दिन-वार</h3><table><thead><tr><th>दिन</th><th class="r">बिल</th><th class="r">बिक्री</th><th class="r">नकद</th><th class="r">UPI</th><th class="r">उधार</th><th class="r">संस्था</th><th class="r">फायदा</th><th class="r">खर्च</th></tr></thead><tbody>
  ${D.map(d=>{const o=days[d];return `<tr><td>${fdate(d).slice(0,5)}</td><td class="r">${o.n}</td>${td(o.sale)}${td(o.cash)}${td(o.upi)}${td(o.ud)}${td(o.inst)}${td(o.pf)}${td(num(o.kh))}</tr>`}).join("")}
  <tr class="tot"><td>कुल</td><td class="r">${T.n}</td>${td(T.sale)}${td(T.cash)}${td(T.upi)}${td(T.ud)}${td(T.inst)}${td(T.pf)}${td(kh)}</tr></tbody></table>
  <h3>कर्मचारी-वार</h3><table><tbody>${Object.entries(per).map(([k,o])=>`<tr><td>${esc(k)}</td><td class="r">${o.n} बिल</td>${td(o.sale)}</tr>`).join("")}</tbody></table>`;
  await SE.printA4(mName+" का हिसाब","<style>body{font-size:17px}td,th{font-size:16px}h2{font-size:24px}</style>"+body)};

/* ======================= 16) Vyapar के लिए फ़ाइल (CSV) ======================= */
const csv=rows=>"﻿"+rows.map(r=>r.map(v=>{const s=String(v??"");return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(",")).join("\r\n");
SX.vyapar=async function(from,to,kind){if(!S.isOwner)return;
  if(kind==="sale"){const B=(await SF.fetchRange(from,to)).filter(b=>!b.cancelled).sort((a,b)=>a.ts-b.ts);const R=[["Date","Invoice No","Party Name","Phone","Item Name","Quantity","Unit","Price/Unit","Amount","Payment Type","Total"]];
    B.forEach(b=>{const pt=b.mode==="inst"?"संस्था":b.payMode==="upi"?"UPI":b.payMode==="cash"?"Cash":b.payMode==="split"?"Cash+Credit":"Credit";(b.lines||[]).forEach(l=>R.push([fdate(b.date),b.no,b.partyName||"VIP ग्राहक",b.custPhone||"",l.name,num(l.qty),UNITS[l.unit]||l.unit,num(l.rate),num(l.amt),pt,num(b.total)]))});
    await SX.shareBlob(new Blob([csv(R)],{type:"text/csv"}),"SabjiExpress_Bikri_"+from+"_"+to,"csv","text/csv","सब्ज़ी एक्सप्रेस बिक्री "+fdate(from)+" – "+fdate(to));return}
  let P=[];try{P=(await S.db.collection("purchases").where("date",">=",from).get()).docs.map(d=>({id:d.id,...d.data()})).filter(p=>!p.cancelled&&p.date<=to).sort((a,b)=>a.ts-b.ts)}catch(e){}
  const R=[["Date","Bill No","Party Name","Phone","Item Name","Quantity","Unit","Price/Unit","Amount","Payment Type","Total"]];
  P.forEach((p,i)=>(p.lines||[]).forEach(l=>R.push([fdate(p.date),p.no||("ख-"+p.date.slice(8)+"/"+p.date.slice(5,7)+"-"+(i+1)),p.supName||"",p.supPhone||"",l.name,num(l.qty),UNITS[l.unit]||l.unit||"",num(l.rate),num(l.amt),p.pay||"",num(p.total)])));
  await SX.shareBlob(new Blob([csv(R)],{type:"text/csv"}),"SabjiExpress_Kharid_"+from+"_"+to,"csv","text/csv","सब्ज़ी एक्सप्रेस खरीद "+fdate(from)+" – "+fdate(to))};

/* ======================= रिपोर्ट: मालिक के औज़ार ======================= */
SX.vy={from:today().slice(0,8)+"01",to:today()};
SX.toolsHTML=function(){if(!S.isOwner)return "";const d=today(),pm=dayAdd(d.slice(0,8)+"01",-1).slice(0,7),cm=d.slice(0,7);const bkAgo=LS.get("sx_bkf");const ago=bkAgo?Math.floor((Date.now()-bkAgo)/864e5):null;
  return `${+d.slice(8)<=3?`<div class="card2 sxc" style="border:2px solid var(--accent)"><b>📄 पिछले महीने (${pm}) का हिसाब तैयार है</b><button class="big" data-sxmonth="${pm}" style="margin-top:6px">🖨️ खोलें / PDF</button></div>`:""}
  <div class="card2 sxc"><h3 style="margin:0 0 8px">🧰 मालिक के औज़ार</h3><div class="sx-tools">
    <button data-sxmonth="${cm}">📄<span>इस महीने का A4</span></button><button data-sxmonth="${pm}">📄<span>पिछला महीना A4</span></button>
    <button data-sxposter>🖼️<span>भाव-पोस्टर</span></button><button data-sxqr>📲<span>घर-घर का QR</span></button><button data-sxbk>📦<span>बैकअप फ़ाइल</span></button></div>
    <p class="note" style="margin:6px 0 0">${ago==null?"⚠ बैकअप फ़ाइल अभी तक नहीं बनी — एक बार बनाकर Google Drive में रखें":ago>7?`⚠ आख़िरी बैकअप फ़ाइल ${ago} दिन पहले — नई बनाएँ`:`✓ आख़िरी बैकअप फ़ाइल ${ago?ago+" दिन पहले":"आज"}`} · रोज़ का बैकअप अपने-आप सर्वर पर</p>
    <h4 style="margin:10px 0 4px">📊 Vyapar / Excel फ़ाइल</h4><div class="bf-r"><label class="bf-d">से<input type="date" id="sxvF" value="${SX.vy.from}"></label><label class="bf-d">तक<input type="date" id="sxvT" value="${SX.vy.to}"></label></div>
    <div class="row2" style="margin-top:6px"><button class="big ghost" data-sxvy="sale">🧾 बिक्री फ़ाइल</button><button class="big ghost" data-sxvy="buy">🛒 खरीद फ़ाइल</button></div></div>
  ${SX.wasteHTML()}`};

/* 📲 घर-घर / गाड़ी का पक्का QR कार्ड (भाव नहीं — हमेशा चले): स्कैन → o.html ऑर्डर पेज (06-11-2026, 177 MH जैसा) */
SX.qrCard=async function(){toast("📲 QR कार्ड बन रहा है…");const link=pubBase()+"o.html",W=1240,H=1748,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  try{await document.fonts.load('800 60px "Baloo 2"')}catch(e){}
  const ctr=(t,y,f,col)=>{x.font=f;x.fillStyle=col||"#14181c";x.textAlign="center";x.fillText(t,W/2,y)};
  const rr=(X,Y,w,h,r)=>{x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath()};
  const F=(w,px)=>`${w} ${px}px "Baloo 2","Mukta",sans-serif`;const icon=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src="icon.png"});
  x.fillStyle="#fffdf5";x.fillRect(0,0,W,H);x.fillStyle="#0c831f";x.fillRect(0,0,W,400);x.fillStyle="#f8cb46";x.fillRect(0,400,W,16);
  if(icon){x.save();rr(W/2-70,40,140,140,30);x.clip();x.drawImage(icon,W/2-70,40,140,140);x.restore()}
  ctr("सब्ज़ी एक्सप्रेस",265,F(800,96),"#fff");ctr("ताज़ी सब्ज़ी-फल · घर के दरवाज़े तक",335,F(700,42),"#e9f6ec");
  ctr("घर बैठे ऑर्डर करें",520,F(800,96),"#0a6b19");ctr("स्कैन करें → सब्ज़ी चुनें → गाड़ी आपके दरवाज़े पर 🚐",590,F(700,42));
  x.fillStyle="#fff";x.strokeStyle="#0c831f";x.lineWidth=10;rr(W/2-410,640,820,820,48);x.fill();x.stroke();
  let m=null;try{const q=new QRCode(document.createElement("div"),{text:link,width:64,height:64,correctLevel:QRCode.CorrectLevel?QRCode.CorrectLevel.H:2});m=q&&q._oQRCode}catch(e){}
  if(!m){toast("QR नहीं बना");return}const n=m.getModuleCount(),cs=Math.floor(720/n),o0=Math.round(W/2-cs*n/2),o1=Math.round(1050-cs*n/2);x.fillStyle="#0b3d14";
  for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(m.isDark(r,k))x.fillRect(o0+k*cs,o1+r*cs,cs,cs);
  x.fillStyle="#fff";rr(W/2-76,974,152,152,28);x.fill();if(icon)x.drawImage(icon,W/2-58,992,116,116);
  ctr("📷 कैमरा खोलें → QR पर रखें → ऑर्डर करें",1530,F(700,44));ctr("🥬 सब्ज़ी · 🍎 फल · 🌿 पत्तेदार · 🛒 पैक्ड सामान",1600,F(700,42),"#3b3b2f");
  const ph=String((S.settings&&S.settings.ownerPh)||"").replace(/\D/g,"").slice(-10);x.fillStyle="#0c831f";x.fillRect(0,H-100,W,100);ctr(ph?"📞 "+ph:"सब्ज़ी एक्सप्रेस",H-36,F(700,40),"#fff");
  SX._qr=c;const blob=await new Promise(r=>c.toBlob(r,"image/png"));await SX.shareBlob(blob,"SabjiExpress_Order_QR","png","image/png","🥬 सब्ज़ी एक्सप्रेस — घर बैठे ऑर्डर करें: "+link)};
/* ======================= बटन ======================= */
const rerender=k=>{if(k==="slot"){if(S.tab==="route"&&SR.renderRoute)SR.renderRoute()}else if(k==="waste"||k==="tools"){try{renderReport()}catch(e){}}else{try{renderDay()}catch(e){}}};
document.addEventListener("click",async e=>{const t=e.target;
  const o=t.closest("[data-sxo]");if(o){const k=o.dataset.sxo;open[k]=!open[k];rerender(k);
    if(open[k]){if(k==="mandi"&&!(SX.mandi&&SX.mandi.date===S.billsDate))SX.calcMandi().then(()=>rerender(k));if(k==="slot"&&!SX.slot.res)SX.calcSlots(SX.slot.days).then(()=>rerender(k));if(k==="waste"&&!SX.waste)SX.calcWaste().then(()=>rerender(k))}return}
  if(t.closest("[data-sxmandire]")){SX.mandi=null;rerender("mandi");SX.calcMandi().then(()=>rerender("mandi"));return}
  if(t.closest("[data-sxmandiwa]")){window.open(waLink(SX.mandiText(),""),"_blank");return}
  const rt=t.closest("[data-sxrate]");if(rt){const [id,v]=rt.dataset.sxrate.split("|");if(!rt.dataset.sure){rt.dataset.sure="1";rt.textContent="पक्का ₹"+v+"?";return}SX.setRate(id,num(v));return}
  const sl=t.closest("[data-sxslot]");if(sl){SX.slot.days=+sl.dataset.sxslot;SX.slot.res=null;rerender("slot");SX.calcSlots(SX.slot.days).then(()=>rerender("slot"));return}
  const hl=t.closest("[data-sxhl]");if(hl){SX.hisabLink(hl.dataset.sxhl);return}
  if(t.closest("[data-sxorders]")){SX.ordersSheet();return}
  const ob=t.closest("[data-sxobill]");if(ob){SX.orderBill(ob.dataset.sxobill);return}
  const od=t.closest("[data-sxodone]");if(od){SX.orderSet(od.dataset.sxodone,"done");closeSheet();return}
  const on=t.closest("[data-sxono]");if(on){if(!on.dataset.sure){on.dataset.sure="1";on.textContent="पक्का रद्द?";return}SX.orderSet(on.dataset.sxono,"cancel");closeSheet();return}
  if(t.closest("[data-sxqr]")){SX.qrCard();return}
  if(t.closest("[data-sxolink]")){window.open(waLink("🥬 सब्ज़ी एक्सप्रेस — अब घर बैठे ऑर्डर करें! सब्ज़ी चुनें, भेजें, गाड़ी आपकी गली में 🚐\n"+pubBase()+"o.html",""),"_blank");return}
  if(t.closest("[data-sxposter]")){SX.poster();return}
  if(t.closest("[data-sxbk]")){SX.backupFile();return}
  const mo=t.closest("[data-sxmonth]");if(mo){SX.monthA4(mo.dataset.sxmonth);return}
  const vy=t.closest("[data-sxvy]");if(vy){const a=SX.vy.from,b=SX.vy.to;SX.vyapar(a<=b?a:b,a<=b?b:a,vy.dataset.sxvy);return}
});
document.addEventListener("change",e=>{if(e.target.id==="sxvF")SX.vy.from=e.target.value||SX.vy.from;if(e.target.id==="sxvT")SX.vy.to=e.target.value||SX.vy.to});
/* शुरुआत: मालिक — रोज़ का बैकअप + भाव सूची (हल्के, देर से); सब — ऑर्डर सुनें */
SX.start=function(){if(SX._st)return;SX._st=1;setTimeout(()=>{SX.watchOrders();SX.pubRates();if(S.isOwner){setTimeout(SX.autoBackup,20000)}},8000);setInterval(()=>{try{SX.checkOrderDone()}catch(e){}},15000);if(S.isOwner)setInterval(()=>{try{SX.pubRates()}catch(e){}},10*60000)};
const wait=setInterval(()=>{if(window.S&&S.db&&S.items&&S.items.length&&(S.isOwner||S.uid)){clearInterval(wait);SX.start()}},2000);
})();
