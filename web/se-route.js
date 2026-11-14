/* सब्ज़ी एक्सप्रेस — 📍 गाड़ी की लोकेशन व रूट, जगह की कमाई, 👥 ग्राहक रजिस्टर, 📤 बिल भेजना (WhatsApp/SMS),
   ➕ नया सामान, 🅧 XYZ (अन्य पैसा)। मुख्य ऐप (index.html) के S, $, esc, rs, r2, fq, toast… इस्तेमाल करता है। */
(function(){
"use strict";
const SR=window.SR={};
const NAT=window.SENative||{};const BP=()=>NAT.BtPrinter;
const LSx={get:k=>{try{return localStorage.getItem(k)||""}catch(e){return ""}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const FV=()=>window.firebase&&firebase.firestore&&firebase.firestore.FieldValue;
const isUnimpl=e=>/not implemented|UNIMPLEMENTED|is not a function|undefined/i.test(String(e&&(e.message||e.code)||e));
const rad=x=>x*Math.PI/180;
function dist(a,b){const R=6371000,dA=rad(b.lat-a.lat),dO=rad(b.lng-a.lng);const h=Math.sin(dA/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dO/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))}
const mins=ms=>Math.max(0,Math.round(ms/60000));
const durTxt=m=>m>=60?Math.floor(m/60)+" घंटे"+(m%60?" "+(m%60)+" मि.":""):m+" मिनट";
const dayAdd=(d,n)=>{const x=new Date(d+"T12:00:00");x.setDate(x.getDate()+n);return today(x)};
const clean=v=>{let d=String(v||"").replace(/\D/g,"");if(d.length>10)d=d.slice(-10);return d};
const dOf=ts=>today(new Date(ts));

/* ======================= 📍 जगहें (नाम वाली) ======================= */
SR.places=[];
function placeAt(p){if(!p||p.lat==null)return null;let best=null,bd=1e9;SR.places.forEach(x=>{const d=dist(p,x);if(d<=(+x.r||150)&&d<bd){bd=d;best=x}});return best}
SR.placeAt=placeAt;

/* ======================= 📍 कर्मचारी के फोन से लोकेशन ======================= */
SR.st={native:!!NAT.isNative,unsupported:false,perm:null,gps:null,running:null,err:""};
SR.last=null;SR.lastGood=null;
const GOOD=60;/* मीटर — इससे ज़्यादा "±" वाली जगह (नेटवर्क/टावर से) अंदाज़ा है, पक्की नहीं */
let tickBusy=false,started=false;
function queue(){try{return JSON.parse(LSx.get("se_trkq")||"[]")}catch(e){return []}}
function setQueue(q){LSx.set("se_trkq",JSON.stringify(q.slice(-6000)))}
function addPts(lines){
  if(!lines.length)return;const q=queue();
  lines.forEach(l=>{q.push(l);const a=l.split(",");if(a.length>=3){const p={ts:+a[0],lat:+a[1],lng:+a[2],acc:+a[3]||0};if(isFinite(p.lat)&&(!SR.last||p.ts>=SR.last.ts))SR.last=p;if(isFinite(p.lat)&&p.acc>0&&p.acc<=GOOD&&(!SR.lastGood||p.ts>=SR.lastGood.ts))SR.lastGood=p}});
  setQueue(q);
}
async function upload(){
  if(S.demo||!S.db||!S.uid||navigator.onLine===false)return;
  const q=queue();if(!q.length)return;const fv=FV();if(!fv)return;
  const groups={};
  q.forEach(l=>{const ts=+String(l).split(",")[0];if(!ts)return;const d=new Date(ts),k=today(d)+"_"+S.uid+"_"+String(d.getHours()).padStart(2,"0");(groups[k]||(groups[k]={date:today(d),hr:d.getHours(),pts:[]})).pts.push(l)});
  try{
    for(const [k,g] of Object.entries(groups))for(let i=0;i<g.pts.length;i+=300)
      await S.db.collection("trk").doc(k).set({uid:S.uid,name:biller(),date:g.date,hr:g.hr,pts:fv.arrayUnion(...g.pts.slice(i,i+300))},{merge:true});
    setQueue(queue().slice(q.length));
  }catch(e){}
}
async function pushLive(){
  if(S.demo||!S.db||!S.uid||navigator.onLine===false)return;
  const l=SR.last,st=SR.st;
  try{await S.db.collection("live").doc(S.uid).set({name:biller(),seen:Date.now(),lat:l?l.lat:null,lng:l?l.lng:null,acc:l?l.acc:null,ts:l?l.ts:null,
    perm:st.perm,gps:st.gps,running:st.running,unsupported:st.unsupported,ver:(window.SE&&SE.version)||""},{merge:true})}catch(e){}
}
function apply(r){if(!r)return;SR.st.perm=!!r.perm;SR.st.gps=!!r.gps;SR.st.running=!!r.running;if(r.error)SR.st.err=r.error}
SR.tick=async function(){
  if(tickBusy||!started)return;tickBusy=true;
  try{
    if(SR.st.native&&!SR.st.unsupported){
      try{const r=await BP().trackDrain();apply(r);addPts(String(r.data||"").split("\n").map(x=>x.trim()).filter(Boolean));
        if(r.perm&&r.gps&&!r.running&&!document.hidden){try{apply(await BP().trackStart({name:biller()}))}catch(e){}}
      }catch(e){if(isUnimpl(e))SR.st.unsupported=true}
    }
    await upload();await pushLive();
  }finally{tickBusy=false;SR.banner()}
};
SR.start=async function(){
  if(started||S.demo||S.isOwner||!S.uid)return;started=true;
  if(SR.st.native){try{apply(await BP().trackStart({name:biller()}))}catch(e){if(isUnimpl(e))SR.st.unsupported=true}}
  else if(navigator.geolocation){
    try{navigator.geolocation.watchPosition(p=>{SR.st.perm=true;SR.st.gps=true;SR.st.running=true;const now=Date.now();if(p.coords.accuracy>150)return;if(SR._wl&&now-SR._wl<45000)return;SR._wl=now;
        addPts([now+","+p.coords.latitude.toFixed(6)+","+p.coords.longitude.toFixed(6)+","+Math.round(p.coords.accuracy)])},
      e=>{if(e.code===1)SR.st.perm=false;else if(e.code===2)SR.st.gps=false;SR.st.running=false;SR.banner()},{enableHighAccuracy:true,maximumAge:30000,timeout:60000})}catch(e){}
  }
  SR.tick();setInterval(SR.tick,90000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)setTimeout(SR.tick,800)});
};
/* लोकेशन का सारा काम सिर्फ़ मालिक का — बिलर के फोन पर कोई पट्टी/संदेश नहीं; कमी मालिक को "रूट" टैब में दिखती है */
SR.banner=function(){{const x=document.getElementById("locbar");if(x)x.hidden=true}if(!SR.SHOW_BAR)return;
  if(S.isOwner||S.demo)return;let el=document.getElementById("locbar");
  if(!el){el=document.createElement("button");el.id="locbar";el.className="locbar";el.type="button";const nb=document.getElementById("netbar");if(nb)nb.insertAdjacentElement("afterend",el);else document.body.prepend(el);el.onclick=SR.fixLoc}
  const s=SR.st;let t="";
  if(s.native&&s.unsupported)t="📍 ऐप की नई APK डालें (वही पुराना लिंक)";
  else if(s.perm===false)t="📍 ऐप को लोकेशन की अनुमति दें — यहाँ दबाएँ";
  else if(s.gps===false)t="📍 फोन की लोकेशन (GPS) चालू करें — यहाँ दबाएँ";
  else if(s.native&&s.running===false&&s.perm)t="📍 लोकेशन चालू करें — यहाँ दबाएँ";
  el.hidden=!t;el.textContent=t;
};
SR.fixLoc=async function(){
  const s=SR.st;
  if(!s.native){toast("Chrome में इस साइट को लोकेशन की अनुमति दें");return}
  if(s.unsupported){toast("नई APK: वही पुराना लिंक खोलकर इंस्टॉल करें — डेटा नहीं मिटेगा");return}
  try{
    if(s.gps===false){await BP().openLocationSettings();setTimeout(SR.tick,4000);return}
    const r=await BP().trackStart({name:biller()});apply(r);
    if(!r.perm)toast("अनुमति नहीं मिली — फोन की सेटिंग → ऐप → सब्ज़ी एक्सप्रेस → अनुमतियाँ → लोकेशन → 'ऐप इस्तेमाल करते समय' और 'सटीक लोकेशन' चालू करें");
  }catch(e){}
  SR.banner();setTimeout(SR.tick,1500);
};
/* 📍 अभी की जगह (15 मिनट तक ताज़ा) — हर एंट्री के साथ दर्ज, सिर्फ़ मालिक की योजना के लिए; कहीं छपती नहीं */
SR.ownerLoc=null;
SR.locNow=function(){const g=SR.lastGood,c=[g,SR.last,SR.ownerLoc].find(x=>x&&Date.now()-x.ts<15*60000);return c?{lat:c.lat,lng:c.lng,acc:c.acc||0,ts:c.ts}:null};
SR.quickFix=function(){
  if(!navigator.geolocation||SR._qf||(SR.ownerLoc&&Date.now()-SR.ownerLoc.ts<4*60000))return Promise.resolve(SR.locNow());
  SR._qf=new Promise(res=>{try{navigator.geolocation.getCurrentPosition(p=>{const c=p.coords;if(c.accuracy<=250)SR.ownerLoc={lat:+c.latitude.toFixed(6),lng:+c.longitude.toFixed(6),acc:Math.round(c.accuracy),ts:Date.now()};SR._qf=null;res(SR.locNow())},
    ()=>{SR._qf=null;res(SR.locNow())},{enableHighAccuracy:true,timeout:9000,maximumAge:120000})}catch(e){SR._qf=null;res(null)}});return SR._qf};
SR.withLoc=function(doc){const l=SR.locNow();if(l)doc.loc=l;else if(S.isOwner)SR.quickFix();return doc};
/* हर बिल पर जगह का ठप्पा (बिल पर छपता नहीं) — मालिक के फोन का बिल हो तो एक बार GPS लेकर बाद में जोड़ दो */
SR.stamp=function(bill){
  const l=SR.locNow();
  if(l){bill.loc=l}
  else if(S.isOwner&&!S.demo){SR.quickFix().then(x=>{if(x&&!bill.loc&&bill.no&&bill.no!=="…"){bill.loc=x;S.db.doc("days/"+(bill.date||today())+"/bills/"+bill.no).update({loc:x}).catch(()=>{})}})}
  setTimeout(SR.tick,300);
};

/* ======================= 👥 ग्राहक का पक्का इतिहास ======================= */
SR.custHist=function(b,ph){
  ph=clean(ph);if(ph.length!==10||S.demo||!S.db||!b||!b.no||b.no==="…")return;
  const d={no:b.no,date:b.date||today(),ts:b.ts||Date.now(),total:+b.total||0,mode:b.mode||"",items:(b.lines||[]).map(l=>l.name+" "+fq(l.qty,l.unit)).join(", ").slice(0,600),
    by:b.byName||biller(),place:b.place||"",party:b.partyName||"",cancelled:!!b.cancelled};
  if(b.loc)d.loc=b.loc;
  S.db.doc("customers/"+ph+"/hist/"+b.no).set(d,{merge:true}).catch(()=>{});
};

/* ======================= 📤 बिल भेजें — पहले नंबर, फिर WhatsApp या SMS ======================= */
SR.shareAsk=function(b,phone,saved){
  const ph0=clean(phone||b.custPhone||(!saved&&S.mode==="walk"&&S.cust?S.cust.phone:"")||"");
  let box=document.getElementById("shbox");if(!box){box=document.createElement("div");box.id="shbox";document.body.appendChild(box)}
  box.innerHTML=`<div class="shb-scrim" data-shx></div><div class="shb" role="dialog" aria-label="बिल ग्राहक को भेजें">
    <h3>📤 बिल ग्राहक को भेजें</h3><p class="note" style="margin:0 0 8px">बिल ${esc(b.no)} · ${rs(b.total)}</p>
    <label class="fld">ग्राहक का मोबाइल नंबर<input class="inp" id="shPh" type="tel" inputmode="tel" maxlength="16" placeholder="10 अंक का नंबर" value="${ph0}" autocomplete="off" style="font-size:22px;font-weight:800;letter-spacing:1px"></label>
    <p class="note" id="shKnown" style="min-height:18px;margin:4px 0 8px"></p>
    <button class="big" data-shwa style="background:#1f8a4c;color:#fff">🟢 WhatsApp पर भेजें</button>
    <div class="row2" style="margin:8px 0 0"><button class="big ghost" data-shsms>✉️ SMS भेजें</button><button class="big ghost" data-shx>रद्द</button></div>
    <p class="note" style="margin:8px 0 0">ग्राहक के पास WhatsApp नहीं है तो SMS दबाएँ। यह नंबर ग्राहक रजिस्टर में हमेशा के लिए सेव रहेगा।</p></div>`;
  box.hidden=false;
  const inp=document.getElementById("shPh");
  const known=()=>{const p=clean(inp.value);const c=p.length===10&&(S.customers||[]).find(x=>x.id===p);
    document.getElementById("shKnown").textContent=c?`⭐ पुराने ग्राहक${c.name?" "+c.name:""} · ${c.visits||0} बार आए · कुल ${rs(c.spent||0)}`:(p.length===10?"🆕 नया ग्राहक — रजिस्टर में जुड़ जाएगा":"")};
  inp.oninput=known;known();if(!ph0)setTimeout(()=>inp.focus(),120);
  box.onclick=async e=>{
    if(e.target.closest("[data-shx]")){box.hidden=true;box.innerHTML="";return}
    const wa=e.target.closest("[data-shwa]"),sm=e.target.closest("[data-shsms]");if(!wa&&!sm)return;
    const ph=clean(inp.value);if(ph.length!==10||!/^[6-9]/.test(ph)){toast("सही 10 अंक का मोबाइल नंबर डालें");inp.focus();return}
    box.hidden=true;box.innerHTML="";
    await SR.keepPhone(b,ph,saved);
    if(wa)SF._shareNow(b,ph,saved);else SR.sendSms(b,ph);
  };
};
SR.keepPhone=async function(b,ph,saved){
  b.custPhone=ph;
  if(!saved){if(S.mode==="walk"&&S.cust){S.cust.phone=ph}return}
  try{await saveCustPhone(b,ph)}catch(e){}
  SR.custHist(b,ph);
};
SR.smsText=function(b){
  const L=b.lines||[];const it=L.slice(0,6).map(l=>l.name+" "+fq(l.qty,l.unit).replace(" कि.ग्रा","kg")).join(", ");const ph=SF.orderPh();
  return `सब्ज़ी एक्सप्रेस\nबिल ${b.no} · ${fdate(b.date||today())}\n${it}${L.length>6?"…":""}\nकुल: Rs ${b.total}\nधन्यवाद! फिर पधारें${ph?"\nघर बैठे सब्ज़ी: "+SF.fmtPh(ph)+" (WhatsApp/कॉल)":""}`;
};
SR.sendSms=async function(b,ph){
  const t=SR.smsText(b);
  if(NAT.isNative){try{await BP().sms({phone:ph,text:t});return}catch(e){}}
  location.href=`sms:+91${ph}?body=${encodeURIComponent(t)}`;
};

/* ======================= 🅧 XYZ — अन्य पैसा (₹1 = 1 इकाई) ======================= */
const XYZ={id:"xyz",name:"XYZ (अन्य पैसा)",en:"Other / Misc",emoji:"🅧",unit:"pc",sale:1,cost:1,cat:"xyz",active:true,virtual:true,plu:1,hue:280};
const seenPending=new Set();let pendInit=false;
SR.addVirtual=function(){
  if(!S.items.find(i=>i.id==="xyz"))S.items.push({...XYZ});
  try{rateAlerts()}catch(e){}
  if(S.isOwner){const P=S.items.filter(i=>i.pending&&!i.virtual);
    const fresh=P.filter(i=>!seenPending.has(i.id));P.forEach(i=>seenPending.add(i.id));
    if(fresh.length&&pendInit)toast("🆕 "+(fresh[0].addedByName||"कर्मचारी")+" ने नया सामान जोड़ा: "+fresh.map(i=>i.name).join(", ")+" — रिपोर्ट में देखें");
    else if(P.length&&!pendInit)setTimeout(()=>toast("🆕 "+P.length+" नया सामान आपकी मंज़ूरी का इंतज़ार कर रहा है — रिपोर्ट में देखें"),2500);
    pendInit=true;if(fresh.length){try{renderTabs()}catch(e){}}}
};
SR.xyzSheet=function(amt,idx){
  const ln=idx!=null&&S.cart[idx]&&S.cart[idx].id==="xyz"?S.cart[idx]:null;
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="XYZ अन्य पैसा"><div class="grab"></div>
  <div class="sh-head"><div><h3>🅧 XYZ — अन्य पैसा</h3><span class="note">जो चीज़ लिस्ट में नहीं, उसके पैसे · ₹1 = 1 इकाई</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <label class="fld">कितने रुपये?<input class="inp" id="xyAmt" inputmode="decimal" value="${ln?ln.qty:(amt||"")}" placeholder="₹" style="font-size:24px;font-weight:800"></label>
  <label class="fld">किस चीज़ के पैसे? (ज़रूरी)<input class="inp" id="xyNote" value="${esc(ln?ln.note||"":"")}" placeholder="जैसे थैली, शकरकंद, पुराना हिसाब"></label>
  <p class="note" style="margin:8px 0">जो सामान बार-बार बिके, उसे "+ नया सामान" से जोड़ लें — बिल बनाना और आसान होगा।</p>
  <button class="big" data-xysave>✓ बिल में जोड़ें</button></div></div>`;
  $("#sheet").onclick=e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    if(!e.target.closest("[data-xysave]"))return;
    const a=r2(parseFloat(String($("#xyAmt").value).replace(",","."))||0),n=$("#xyNote").value.trim();
    if(!(a>0)){toast("रकम लिखें");return}if(n.length<2){toast("किस चीज़ के पैसे — यह लिखना ज़रूरी है");return}
    const line={key:ln?ln.key:Math.random().toString(36).slice(2),id:"xyz",name:"XYZ: "+n,note:n,emoji:"🅧",unit:"pc",qty:a,rate:1,board:1,cost:1,changed:false,free:false,amt:a};
    if(ln)S.cart[idx]=line;else S.cart.push(line);
    closeSheet();refreshAfterCart();beep(true);toast("✓ XYZ ₹"+a+" · "+n);
  };
  setTimeout(()=>{const x=$("#xyAmt");if(x)x.focus()},120);
};

/* ======================= ➕ नया सामान (कर्मचारी भी) ======================= */
SR.addCardHTML=function(q){return `<button class="card addnew" data-newitem="${esc(q||"")}"><span class="tile"><span class="em">➕</span></span><span class="nm">नया सामान जोड़ें<small class="en">Add new item</small></span><span class="pr">लिस्ट में नहीं है?</span></button>`};
SR.newItemSheet=function(q){
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="नया सामान"><div class="grab"></div>
  <div class="sh-head"><div><h3>➕ नया सामान जोड़ें</h3><span class="note">${S.isOwner?"यह सबके फोन में तुरंत आ जाएगा":"यह सबके फोन में तुरंत आ जाएगा"}</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <label class="fld">नाम (हिंदी में)<input class="inp" id="niName" value="${esc(q||"")}" placeholder="जैसे शकरकंद"></label>
  <label class="fld">अंग्रेज़ी नाम (अगर पता हो)<input class="inp" id="niEn" placeholder="जैसे Sweet Potato"></label>
  <div class="row2"><label class="fld">किस हिसाब से बिकेगा<select class="inp" id="niUnit"><option value="kg">किलो</option><option value="pc">पीस / पैकेट</option></select></label>
  <label class="fld">बेचने का भाव ₹<input class="inp" id="niRate" inputmode="decimal" placeholder="₹"></label></div>
  <label class="fld">किस में रखें<select class="inp" id="niCat">${[["sabzi","🥬 सब्ज़ी"],["fal","🍎 फल"],["patta","🌿 पत्तेदार"],["packed","📦 किराना / पैकेट"]].map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select></label>
  <button class="big" data-nisave style="margin-top:10px">✓ जोड़ें और बिल में डालें</button></div></div>`;
  $("#sheet").onclick=e=>{if(e.target.matches("[data-close]")){closeSheet();return}if(e.target.closest("[data-nisave]"))SR.saveNewItem()};
  setTimeout(()=>{const x=$(q?"#niRate":"#niName");if(x)x.focus()},120);
};
SR.saveNewItem=async function(){
  const name=$("#niName").value.trim(),en=$("#niEn").value.trim(),unit=$("#niUnit").value,rate=r2(parseFloat(String($("#niRate").value).replace(",","."))||0),cat=$("#niCat").value;
  if(!name){toast("सामान का नाम लिखें");return}if(!(rate>0)){toast("बेचने का भाव लिखें");return}
  const dup=S.items.find(i=>!i.virtual&&i.name===name);if(dup){closeSheet();toast(name+" पहले से लिस्ट में है");openQty(dup);return}
  const id="n"+Date.now().toString(36);
  const it={name,en,unit,sale:rate,cost:0,cat,emoji:{sabzi:"🥬",fal:"🍎",patta:"🌿",packed:"📦"}[cat]||"🥬",hue:Math.floor(Math.random()*360),active:true,
    addedBy:S.uid||"",addedByName:biller(),addedTs:Date.now(),pending:!S.isOwner,ts:Date.now()};
  try{if(!S.demo&&S.db)await S.db.collection("items").doc(id).set(it)}catch(e){toast("सेव नहीं हुआ: "+(e.code||e.message||""));return}
  if(!S.items.find(x=>x.id===id))S.items.push({id,...it});
  closeSheet();toast("✓ "+name+" जुड़ गया");
  const x=item(id);if(x)openQty(x);
};
SR.pendingItemsHTML=function(){
  if(!S.isOwner)return "";const L=S.items.filter(i=>i.pending&&!i.virtual);if(!L.length)return "";
  return `<div class="card2" style="border:2px solid #f59e0b"><h3>🆕 कर्मचारी ने नया सामान जोड़ा (${L.length})</h3><p class="note" style="margin:0 0 6px">भाव देखकर पास करें। बंद करने पर यह बिलिंग से हट जाएगा (पुराने बिल वैसे ही रहेंगे)।</p>
  ${L.map(i=>`<div class="creq-row"><div><b>${esc(i.name)}${i.en?" ("+esc(i.en)+")":""} · ${rs(i.sale)}/${UNITS[i.unit]||i.unit}</b><span class="note">${esc(i.addedByName||"")} ने जोड़ा · ${i.addedTs?fdate(dOf(i.addedTs))+" "+ftime(i.addedTs):""}</span></div>
    <div class="row3" style="margin:0"><input class="inp" data-nprate="${esc(i.id)}" inputmode="decimal" value="${+i.sale||""}" aria-label="${esc(i.name)} का भाव"><button class="big" data-npok="${esc(i.id)}">✓ पास</button><button class="big ghost" data-npoff="${esc(i.id)}" style="color:var(--chili)">बंद करें</button></div></div>`).join("")}</div>`;
};
document.addEventListener("click",async e=>{
  const ok=e.target.closest("[data-npok]"),off=e.target.closest("[data-npoff]");if(!ok&&!off)return;
  const id=ok?ok.dataset.npok:off.dataset.npoff;const r=document.querySelector(`[data-nprate="${id}"]`);const rate=r2(parseFloat(r&&r.value)||0);const it=item(id);
  try{await S.db.collection("items").doc(id).update(ok?{pending:false,sale:rate||+(it&&it.sale)||0,approvedTs:Date.now()}:{pending:false,active:false,approvedTs:Date.now()});toast(ok?"✓ पास किया":"बंद किया")}catch(err){toast("नहीं हुआ: "+(err.code||""))}
});

/* ======================= 📍 मालिक का रूट डैशबोर्ड ======================= */
const R={date:null,map:null,live:[],day:null,raw:null,agg:null,loading:false,custQ:"",custAll:false,liveLayer:null,who:"",sat:LSx.get("se_rsat")!=="0",lbl:LSx.get("se_rlbl")!=="0",big:false,placeQ:"",play:{t:0,on:false,spd:5,timer:null},bcache:{}};
const HOME={lat:25.79024,lng:71.39961};/* सरदारपुरा, बिदासर (Q9RX+3RX) — नक्शे का शुरुआती इलाका */
const COLORS=["#22c55e","#f59e0b","#a855f7","#06b6d4","#ef4444"];
SR.onDb=function(db){
  if(S.isOwner)db.collection("places").onSnapshot(s=>{SR.places=s.docs.map(d=>({id:d.id,...d.data()}));if(S.tab==="route"&&R.raw){R.day=dayFor();SR.renderRoute()}},()=>{});
  if(S.isOwner)setTimeout(()=>SR.autoOldUdhar(db),2500);
  if(S.isOwner)setTimeout(async()=>{await SR.autoOldUdhar2(db);await SR.autoOldUdhar3(db);await SR.autoInst2(db)},6500);
  if(S.isOwner)setTimeout(()=>SR.applyBoard(db),4500);
  if(S.isOwner){setTimeout(()=>SR.applyInst(db),9000);setInterval(()=>{if(!SR._instDone)SR.applyInst(db)},5*60000)}
  if(S.isOwner)db.collection("live").onSnapshot(s=>{R.live=s.docs.map(d=>({id:d.id,...d.data()}));if(S.tab==="route")SR.updateLive()},()=>{});
  else{setTimeout(SR.start,1500);setTimeout(SR.lockCheck,1200)}
};
function parse(docs){
  const by={};
  docs.forEach(d=>{const u=by[d.uid]||(by[d.uid]={uid:d.uid,name:d.name||"",P:[],E:[]});if(d.name)u.name=d.name;
    (d.pts||[]).forEach(s=>{const a=String(s).split(",");const ts=+a[0];if(!ts)return;
      if(a.length>=3){const p={ts,lat:+a[1],lng:+a[2],acc:+a[3]||0};if(isFinite(p.lat)&&isFinite(p.lng)&&p.acc<=250)u.P.push(p)}else u.E.push({ts,ev:a[1]})})});
  return Object.values(by).map(u=>{u.P.sort((a,b)=>a.ts-b.ts);u.P=cleanPts(u.P.filter((p,i,a)=>!i||p.ts!==a[i-1].ts));u.E.sort((a,b)=>a.ts-b.ts);return u});
}
/* दाएँ-बाएँ उछलती जगहें हटाओ: (1) पक्की GPS (±60 मी. तक) हो तो उसके 5 मिनट आसपास की अंदाज़े वाली (नेटवर्क) जगह नहीं लेंगे
   (2) अकेली उछाल — जो 2 मिनट में 300 मी. दूर जाकर लौट आए — हटाओ */
function cleanPts(P){
  const goodTs=P.filter(p=>p.acc>0&&p.acc<=GOOD).map(p=>p.ts);
  const nearGood=ts=>{let lo=0,hi=goodTs.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(Math.abs(goodTs[m]-ts)<=5*60000)return true;if(goodTs[m]<ts)lo=m+1;else hi=m-1}return false};
  let Q=P.filter(p=>!(p.acc>GOOD||!p.acc)||!nearGood(p.ts));
  Q=Q.filter((p,i,a)=>{if(!i||i===a.length-1)return true;const x=a[i-1],y=a[i+1];return !(dist(x,p)>300&&dist(p,y)>300&&dist(x,y)<150&&y.ts-x.ts<=4*60000)});
  return Q;
}
function findStops(P){
  const out=[];let c=null;const close=()=>{if(c&&c.end-c.start>=4*60000)out.push(c)};
  for(const p of P){
    const w=1/Math.max(5,p.acc||GOOD)**2;
    if(c&&dist(c,p)<=100&&p.ts-c.end<=25*60000){const W=c.w+w;c.lat=(c.lat*c.w+p.lat*w)/W;c.lng=(c.lng*c.w+p.lng*w)/W;c.w=W;c.n++;c.end=p.ts;c.acc=Math.min(c.acc,p.acc||999)}
    else{close();c={lat:p.lat,lng:p.lng,w,n:1,start:p.ts,end:p.ts,acc:p.acc||999}}
  }
  close();return out;
}
function gapsOf(u){
  const G=[];let off=null;
  u.E.forEach(e=>{if(e.ev==="OFF"||e.ev==="STOP"||e.ev==="NOPERM"){if(!off)off={start:e.ts,why:e.ev}}else if((e.ev==="ON"||e.ev==="START")&&off){G.push({...off,end:e.ts});off=null}});
  if(off)G.push({...off,end:null});
  for(let i=1;i<u.P.length;i++){const a=u.P[i-1],b=u.P[i];if(b.ts-a.ts>12*60000&&dist(a,b)>300)G.push({start:a.ts,end:b.ts,why:"NOFIX"})}
  return G.sort((a,b)=>a.start-b.start);
}
function analyze(date,docs,bills){
  const U=parse(docs);const stops=[],gaps=[],pts=[];let km=0;
  let moveMs=0,first=0,last=0;
  U.forEach(u=>{findStops(u.P).forEach(s=>stops.push({...s,uid:u.uid,name:u.name}));gapsOf(u).forEach(g=>gaps.push({...g,name:u.name}));
    for(let i=1;i<u.P.length;i++){const a=u.P[i-1],b=u.P[i],d=dist(a,b),dt=b.ts-a.ts;if(d>40&&d<5000)km+=d/1000;if(dt>0&&dt<=12*60000&&d/(dt/3600000)>3000)moveMs+=dt}
    if(u.P.length){first=first?Math.min(first,u.P[0].ts):u.P[0].ts;last=Math.max(last,u.P[u.P.length-1].ts)}
    pts.push({uid:u.uid,name:u.name,P:u.P})});
  stops.sort((a,b)=>a.start-b.start);
  stops.forEach(s=>{s.place=placeAt(s);s.bills=[];s.sales=0;s.inst=0});
  const free=[];
  bills.forEach(b=>{let best=null;
    stops.forEach(s=>{if(b.by&&s.uid!==b.by)return;const inT=b.ts>=s.start-3*60000&&b.ts<=s.end+3*60000;const near=b.loc?dist(s,b.loc)<=250:true;if(inT&&near)best=s});
    if(!best&&b.loc)best=stops.find(s=>(!b.by||s.uid===b.by)&&dist(s,b.loc)<=120&&Math.abs(b.ts-s.start)<3*3600e3)||null;
    if(best){best.bills.push(b);if(b.mode==="inst")best.inst+=+b.total||0;else best.sales+=+b.total||0}else free.push(b)});
  return {date,docs,bills,stops,gaps,km:Math.round(km*10)/10,pts,free,moveMin:mins(moveMs),first,last};
}
SR.analyze=analyze;
/* व्यक्ति के हिसाब से छाँटा हुआ दिन */
function dayFor(){const r=R.raw;if(!r)return null;const w=R.who;return analyze(r.date,w?r.docs.filter(x=>x.uid===w):r.docs,w?r.bills.filter(b=>b.by===w):r.bills)}
function people(){const m=new Map();((R.raw&&R.raw.docs)||[]).forEach(d=>{if(d.uid&&!m.has(d.uid))m.set(d.uid,d.name||"")});R.live.forEach(v=>{if(v.id&&!m.has(v.id))m.set(v.id,v.name||"")});return [...m.entries()]}
const colorOf=uid=>{const L=people().map(x=>x[0]);const i=Math.max(0,L.indexOf(uid));return COLORS[i%COLORS.length]};
SR.loadDay=async function(date){
  R.loading=true;
  try{
    const docs=S.demo||!S.db?[]:(await S.db.collection("trk").where("date","==",date).get()).docs.map(x=>x.data());
    let bills=date===S.billsDate?S.dayBills:(S.demo||!S.db?[]:(await S.db.collection("days/"+date+"/bills").get()).docs.map(x=>x.data()));
    R.raw={date,docs,bills:bills.filter(b=>!b.cancelled)};R.day=dayFor();R.play.t=0;R.play.on=false;
  }catch(e){R.raw=null;R.day={date,docs:[],bills:[],stops:[],gaps:[],pts:[],free:[],km:0,err:e.code||e.message||""}}
  R.loading=false;if(S.tab==="route")SR.renderRoute();
};
/* रूट का छोटा लिखित हाल — AI ऑडिट पैक के लिए */
SR.routeText=async function(date){
  try{
    const docs=S.demo||!S.db?[]:(await S.db.collection("trk").where("date","==",date).get()).docs.map(x=>x.data());
    const bills=(date===S.billsDate?S.dayBills:[]).filter(b=>!b.cancelled);
    if(!docs.length)return "इस दिन गाड़ी की लोकेशन नहीं आई (नई APK/लोकेशन बंद/मालिक का फोन)। बिलों पर जगह: "+bills.filter(b=>b.loc).length+"/"+bills.length;
    const a=analyze(date,docs,bills);const W={OFF:"फोन की लोकेशन बंद की",STOP:"ऐप/लोकेशन रुकी",NOPERM:"अनुमति नहीं",NOFIX:"गाड़ी चली पर खबर नहीं आई"};
    let t=`दूरी लगभग ${a.km} km · ${a.stops.length} जगह रुकी · बिल जिन पर जगह दर्ज: ${bills.filter(b=>b.loc).length}/${bills.length}\n\n| समय | जगह | रुकी | बिल | बिक्री ₹ | संस्था ₹ |\n|---|---|---|---|---|---|\n`;
    a.stops.forEach(s=>t+=`| ${ftime(s.start)}–${ftime(s.end)} | ${s.place?s.place.name:"बिना नाम ("+s.lat.toFixed(4)+","+s.lng.toFixed(4)+")"} | ${durTxt(mins(s.end-s.start))} | ${s.bills.length} | ${r2(s.sales)} | ${r2(s.inst)} |\n`);
    t+=`\nचलते-चलते / बिना जगह वाले बिल: ${a.free.length} · ₹${r2(a.free.reduce((x,b)=>x+(+b.total||0),0))}\n`;
    if(a.gaps.length)t+="\nलोकेशन में रुकावट:\n"+a.gaps.map(g=>`- ${g.name}: ${ftime(g.start)}–${g.end?ftime(g.end):"आखिर तक"} · ${W[g.why]||g.why}`).join("\n")+"\n";
    return t;
  }catch(e){return "रूट नहीं पढ़ा जा सका: "+(e.code||e.message||"")}
};
function liveHTML(){
  if(!R.live.length)return `<h3 style="margin:0">🚐 गाड़ी अभी कहाँ है</h3><p class="note" style="margin:0">अभी किसी फोन से लोकेशन नहीं आई। कर्मचारी के फोन में नई APK डालकर लॉगिन करवाएँ और लोकेशन की अनुमति दें।</p>`;
  return `<h3 style="margin:0 0 4px">🚐 गाड़ी अभी कहाँ है</h3>`+[...R.live].sort((a,b)=>(b.seen||0)-(a.seen||0)).map(v=>{
    const fresh=v.ts&&Date.now()-v.ts<6*60000;const pl=v.lat!=null?placeAt(v):null;
    const bad=v.unsupported?"नई APK नहीं डली":v.perm===false?"लोकेशन की अनुमति नहीं दी":v.gps===false?"फोन की लोकेशन बंद":v.running===false?"लोकेशन रुकी":"";
    return `<div class="livep"><span class="dot ${fresh&&!bad?"on":""}"></span><div class="mid"><b>${esc(v.name||"")}</b><span>${v.ts?(pl?"📍 "+esc(pl.name)+" · ":"")+"आखिरी जगह "+agoTxt(v.ts):"अभी जगह नहीं मिली"}${bad?` · <b style="color:var(--chili)">⚠ ${bad}</b>`:""}${v.seen?" · ऐप "+agoTxt(v.seen):""}</span></div>${v.lat!=null?`<a class="lnk" href="https://maps.google.com/?q=${v.lat},${v.lng}" target="_blank" rel="noopener">नक्शा ↗</a>`:""}</div>`}).join("");
}
SR.updateLive=function(){const el=document.getElementById("rLive");if(el)el.innerHTML=liveHTML();drawLive()};
function drawLive(){
  if(!R.map||!window.L)return;if(!R.liveLayer)R.liveLayer=L.layerGroup().addTo(R.map);R.liveLayer.clearLayers();
  if(R.date!==today())return;
  R.live.forEach(v=>{if(v.lat==null||(R.who&&v.id!==R.who))return;const fresh=v.ts&&Date.now()-v.ts<6*60000;
    L.marker([v.lat,v.lng],{icon:L.divIcon({className:"rvan live"+(fresh?"":" old"),html:`<span style="border-color:${colorOf(v.id)}">🚐<b>${esc(String(v.name||"").split(" ")[0])}</b><i>${v.ts?agoTxt(v.ts):""}</i></span>`,iconSize:[110,30],iconAnchor:[55,15]}),zIndexOffset:900}).addTo(R.liveLayer)});
}
const WHY={OFF:"फोन की लोकेशन बंद की",STOP:"ऐप/लोकेशन रुकी",NOPERM:"लोकेशन की अनुमति नहीं",NOFIX:"गाड़ी चली पर खबर नहीं आई"};
function dayHTML(d){
  if(d.err)return `<div class="warn">रूट नहीं पढ़ा जा सका: ${esc(d.err)}</div>`;
  const all=d.bills,withLoc=all.filter(b=>b.loc).length,stopMin=d.stops.reduce((a,s)=>a+mins(s.end-s.start),0);
  const sale=r2(all.filter(b=>b.mode!=="inst").reduce((a,b)=>a+(+b.total||0),0));
  if(!d.pts.length)return `<div class="empty"><b>${fdate(d.date)} की लोकेशन नहीं आई</b>कर्मचारी के फोन में नई APK, लॉगिन और लोकेशन चालू होनी चाहिए। (इस दिन ${all.length} बिल · ${rs(sale)})</div>`;
  const freeAmt=r2(d.free.filter(b=>b.mode!=="inst").reduce((a,b)=>a+(+b.total||0),0));
  return `<div class="kpis k3"><div class="kpi"><span>🛣️ दूरी</span><b>${d.km} km</b></div><div class="kpi"><span>🚐 चलती रही</span><b style="font-size:16px">${durTxt(d.moveMin||0)}</b></div><div class="kpi"><span>🛑 रुकी (${d.stops.length} जगह)</span><b style="font-size:16px">${durTxt(stopMin)}</b></div>
   <div class="kpi"><span>🧾 बिक्री</span><b style="font-size:18px">${rs(sale)}</b></div><div class="kpi"><span>⏰ पहली–आख़िरी</span><b style="font-size:15px">${d.first?ftime(d.first)+"–"+ftime(d.last):"—"}</b></div><div class="kpi ${withLoc<all.length?"red":""}"><span>📍 बिल पर जगह</span><b>${withLoc}/${all.length}</b></div></div>
  ${d.gaps.length?`<div class="warn">⚠ लोकेशन में रुकावट: ${d.gaps.map(g=>`<br>• ${esc(g.name)} · ${ftime(g.start)}–${g.end?ftime(g.end):"आखिर तक"} · ${WHY[g.why]||g.why}`).join("")}</div>`:""}
  <h3 style="margin:10px 0 6px">🛑 गाड़ी कहाँ-कहाँ रुकी</h3>
  <div class="list">${d.stops.map((s,i)=>{const m=mins(s.end-s.start),ph=m>0?r2(s.sales/(m/60)):0;return `<div class="rstop" data-rstop="${i}" role="button" tabindex="0"><span class="rs-no">${i+1}</span>
    <div class="rs-t"><b>${ftime(s.start)}</b><span>${durTxt(m)}</span></div>
    <div class="rs-m"><b>${s.place?"📍 "+esc(s.place.name):"📍 बिना नाम की जगह"}</b><span class="note">${s.bills.length} बिल · ${rs(r2(s.sales))}${s.inst?" · संस्था "+rs(r2(s.inst)):""}${m>=10?" · "+rs(ph)+"/घंटा":""}${d.pts.length>1?" · "+esc(s.name):""}</span></div>
    <button class="${s.place?"lnk":"chip"}" data-rname="${i}">${s.place?"✏️":"✏️ नाम दें"}</button></div>`}).join("")||'<p class="note" style="padding:10px">अभी कोई जगह 4 मिनट से ज़्यादा नहीं रुकी।</p>'}</div>
  ${d.free.length?`<p class="note">🚐 चलते-चलते / बिना जगह वाले बिल: ${d.free.length} · ${rs(freeAmt)}</p>`:""}`;
}
function grid(p){return Math.round(p.lat*700)+"_"+Math.round(p.lng*700)}
SR.loadAgg=async function(n){
  const end=R.date||today(),start=dayAdd(end,-(n-1));const box=document.getElementById("rAgg");if(box)box.innerHTML='<p class="note">⏳ हिसाब लग रहा है…</p>';
  try{
    const docs=S.demo||!S.db?[]:(await S.db.collection("trk").where("date",">=",start).get()).docs.map(x=>x.data()).filter(x=>x.date<=end);
    const res={n,start,end,rows:{},free:{n:0,amt:0},hours:{},bills:0,sale:0,noTrack:0};
    const row=(k,name,p)=>res.rows[k]||(res.rows[k]={k,name,lat:p?p.lat:null,lng:p?p.lng:null,visits:0,min:0,bills:0,sale:0,inst:0,cust:new Set(),days:new Set()});
    const addBill=(r,b)=>{r.bills++;if(b.mode==="inst")r.inst+=+b.total||0;else r.sale+=+b.total||0;if(b.custPhone)r.cust.add(b.custPhone)};
    for(let d=start;d<=end;d=dayAdd(d,1)){
      let bills;
      if(d===S.billsDate)bills=S.dayBills;else{try{bills=S.demo||!S.db?[]:(await S.db.collection("days/"+d+"/bills").get()).docs.map(x=>x.data())}catch(e){bills=[]}}
      bills=bills.filter(b=>!b.cancelled);
      bills.forEach(b=>{res.bills++;if(b.mode!=="inst"){res.sale+=+b.total||0;const h=new Date(b.ts).getHours();res.hours[h]=(res.hours[h]||0)+(+b.total||0)}});
      const dd=docs.filter(x=>x.date===d);
      if(!dd.length){if(bills.length)res.noTrack++;bills.forEach(b=>{const pl=b.loc?placeAt(b.loc):null;if(pl){const r=row("p:"+pl.name,pl.name,pl);r.days.add(d);addBill(r,b)}else{res.free.n++;res.free.amt+=b.mode==="inst"?0:+b.total||0}});continue}
      const a=analyze(d,dd,bills);
      a.stops.forEach(s=>{const r=row(s.place?"p:"+s.place.name:"g:"+grid(s),s.place?s.place.name:null,s);r.visits++;r.min+=mins(s.end-s.start);r.days.add(d);s.bills.forEach(b=>addBill(r,b))});
      a.free.forEach(b=>{res.free.n++;res.free.amt+=b.mode==="inst"?0:+b.total||0});
    }
    R.agg=res;if(box)box.innerHTML=aggHTML(res);
  }catch(e){if(box)box.innerHTML=`<p class="warn">नहीं हुआ: ${esc(e.code||e.message||"")}</p>`}
};
function aggHTML(a){
  const rows=Object.values(a.rows).filter(r=>r.bills>0||r.min>=10).sort((x,y)=>y.sale-x.sale);
  let un=0;rows.forEach(r=>{if(!r.name){un++;r.label="बिना नाम #"+un}else r.label=r.name;r.ph=r.min>=10?r2(r.sale/(r.min/60)):null});
  const ranked=rows.filter(r=>r.ph!=null&&r.min>=30).sort((x,y)=>y.ph-x.ph);const best=ranked[0],worst=ranked.length>1?ranked[ranked.length-1]:null;
  const hrs=Object.entries(a.hours).sort((x,y)=>y[1]-x[1]).slice(0,3).map(([h,v])=>`${h}–${+h+1} बजे (${rs(r2(v))})`);
  return `<p class="note" style="margin:8px 0 4px">${fdate(a.start)} से ${fdate(a.end)} · ${a.bills} बिल · बिक्री ${rs(r2(a.sale))}${a.noTrack?` · ${a.noTrack} दिन लोकेशन नहीं आई`:""}</p>
  ${best?`<div class="rins good">🏆 सबसे कमाऊ जगह: <b>${esc(best.label)}</b> — ${rs(best.ph)} प्रति घंटा</div>`:""}
  ${worst&&worst!==best?`<div class="rins bad">⏳ सबसे कम कमाई: <b>${esc(worst.label)}</b> — ${rs(worst.ph)} प्रति घंटा। यहाँ कम रुकें या समय बदलकर देखें।</div>`:""}
  ${hrs.length?`<div class="rins">🕘 सबसे ज़्यादा बिक्री का समय: ${hrs.join(" · ")}</div>`:""}
  ${a.free.n?`<div class="rins">🚐 बिना जगह / चलते-चलते: ${a.free.n} बिल · ${rs(r2(a.free.amt))}</div>`:""}
  <div class="rtable"><table><thead><tr><th>जगह</th><th class="r">बार</th><th class="r">रुकी</th><th class="r">बिल</th><th class="r">बिक्री</th><th class="r">₹/घंटा</th><th class="r">ग्राहक</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${esc(r.label)}${r.name?"":` <button class="lnk" data-aggname="${r.lat},${r.lng}">नाम दें</button>`}</td><td class="r">${r.visits||"—"}</td><td class="r">${r.min?durTxt(r.min):"—"}</td><td class="r">${r.bills}</td><td class="r"><b>${rs(r2(r.sale))}</b></td><td class="r">${r.ph!=null?rs(r.ph):"—"}</td><td class="r">${r.cust.size||"—"}</td></tr>`).join("")||'<tr><td colspan="7" class="note">अभी डेटा नहीं</td></tr>'}
  </tbody></table></div>`;
}
function custList(){
  const q=R.custQ.trim().toLowerCase();let C=[...(S.customers||[])];
  if(q)C=C.filter(c=>String(c.id).includes(q)||String(c.name||"").toLowerCase().includes(q));
  C.sort((a,b)=>(b.spent||0)-(a.spent||0));return C;
}
function custListHTML(){
  const C=custList();const show=R.custAll||R.custQ?C.slice(0,300):C.slice(0,10);
  return show.map(c=>{const pl=c.lastLoc?placeAt(c.lastLoc):null;return `<div class="rcrow"><button class="li" data-chist="${esc(c.id)}"><div class="mid"><b>${esc(c.name||"ग्राहक")} · ${esc(c.id)}</b><span>${pl?"📍 "+esc(pl.name)+" · ":c.lastLoc?"📍 बिना नाम की जगह · ":""}${c.visits||0} बार · कुल ${rs(c.spent||0)}${c.lastTs?" · आखिरी "+fdate(dOf(c.lastTs)):""}${c.lastItems?" · "+esc(String(c.lastItems).slice(0,40)):""}</span></div><span>›</span></button>${c.lastLoc?`<button class="chip rc-map" data-cmap="${c.lastLoc.lat},${c.lastLoc.lng}" data-cname="${esc(c.name||c.id)}" aria-label="नक्शे पर दिखाएँ">🎯</button>`:""}</div>`}).join("")||'<p class="note" style="padding:10px">कोई ग्राहक नहीं मिला</p>';
}
function custHTML(){
  return `<div class="card2"><h3>👥 ग्राहक रजिस्टर (${(S.customers||[]).length})</h3><p class="note" style="margin:0">हर मोबाइल नंबर = एक पक्का ग्राहक। नाम पर दबाएँ तो पूरी खरीद का इतिहास।</p>
  <input class="inp" id="rcq" placeholder="नंबर या नाम से खोजें" value="${esc(R.custQ)}" style="margin:6px 0" autocomplete="off">
  <div class="list" id="rcl" style="margin:0">${custListHTML()}</div>
  <div class="row2" style="margin-top:8px"><button class="big ghost" data-callc>${R.custAll?"सिर्फ़ टॉप 10":"सभी ग्राहक"}</button><button class="big ghost" data-ccsv>⬇️ CSV (कैंपेन के लिए)</button></div></div>`;
}
/* 🏷️ सेव की हुई जगहें — खोज, आज की बिक्री, टैप = पूरा हिसाब */
function placeSales(){const m={};((R.raw&&R.raw.bills)||[]).forEach(b=>{if(R.who&&b.by!==R.who)return;const pl=b.loc?placeAt(b.loc):null;if(!pl)return;const o=m[pl.name]||(m[pl.name]={n:0,amt:0});o.n++;if(b.mode!=="inst")o.amt+=+b.total||0});return m}
function placesHTML(){
  const by={};SR.places.forEach(p=>(by[p.name]||(by[p.name]=[])).push(p));const sale=placeSales();
  const q=R.placeQ.trim().toLowerCase();
  const names=Object.keys(by).filter(n=>!q||n.toLowerCase().includes(q)).sort((a,b)=>((sale[b]||{}).amt||0)-((sale[a]||{}).amt||0)||a.localeCompare(b,"hi"));
  const sure=p=>p.src==="gps"&&+p.acc>0&&+p.acc<=GOOD;
  return `<div class="card2"><h3>🏷️ जगहें (${Object.keys(by).length})</h3><p class="note" style="margin:0 0 6px">जगह पर दबाएँ — बिल, बिक्री, ग्राहकों के नंबर, फोटो। ⚠ वाली जगहें अंदाज़े से बनी हैं — वहाँ पहुँचकर "📍 यहीं पक्का करें" दबा दें।</p>
  <input class="inp" id="rpq" placeholder="🔍 जगह खोजें" value="${esc(R.placeQ)}" autocomplete="off" style="margin:0 0 6px">
  <div id="rpl">${names.map(n=>{const ok=by[n].filter(sure).length,s=sale[n];return `<div class="rplace"><button class="rp-n" data-rpl="${esc(n)}"><b>📍 ${esc(n)}</b><span class="note">${ok?"✅ फोन GPS से पक्की":"⚠ अंदाज़े से"}${s?` · ${fdate(R.date).slice(0,5)}: ${s.n} बिल · ${rs(r2(s.amt))}`:""}</span></button>
    <span class="rp-a"><button class="lnk" data-plfix="${esc(n)}">📍 यहीं पक्का करें</button> · <button class="lnk" data-pren="${esc(n)}">नाम बदलें</button> · <button class="lnk" data-pdel="${esc(n)}" style="color:var(--chili)">हटाएँ</button></span></div>`}).join("")||'<p class="note">अभी कोई नाम नहीं रखा।</p>'}</div></div>`;
}
function playRange(d){let a=Infinity,b=0;d.pts.forEach(u=>{if(u.P.length){a=Math.min(a,u.P[0].ts);b=Math.max(b,u.P[u.P.length-1].ts)}});return [a,b]}
function playHTML(d){const [a,b]=playRange(d);const t=R.play.t&&R.play.t>=a&&R.play.t<=b?R.play.t:a;
  return `<div class="rplay"><button class="rp-btn" data-rplay aria-label="रास्ता चलाकर देखें">${R.play.on?"⏸":"▶"}</button>
  <div class="rp-mid"><input type="range" id="rpT" min="${a}" max="${b}" step="30000" value="${t}" aria-label="समय"><div class="rp-info"><b id="rpTime">${R.play.t?ftime(R.play.t):ftime(a)+" – "+ftime(b)}</b> <span id="rpSt">${R.play.t?"":"▶ दबाएँ — गाड़ी दिन भर के रास्ते पर चलती दिखेगी"}</span></div></div>
  <div class="rp-spd" role="group" aria-label="तेज़ी">${[[1,"1 मि/से"],[5,"5 मि/से"],[15,"15 मि/से"]].map(([v,l])=>`<button data-rspd="${v}" aria-pressed="${R.play.spd===v}">${l}</button>`).join("")}</div></div>`}
SR.renderRoute=function(){
  const el=document.getElementById("p-route");if(!el)return;bindRoute(el);if(!R.date)R.date=today();
  if((!R.raw||R.raw.date!==R.date)&&!R.loading)SR.loadDay(R.date);
  const d=R.day&&R.day.date===R.date?R.day:null,yd=dayAdd(today(),-1),P=people();
  el.innerHTML=`<div class="daterow"><h2 class="sec" style="margin:0;flex:1">📍 गाड़ी ट्रैकर</h2><button class="chip" data-rref aria-label="ताज़ा करें">🔄</button></div>
  <div class="rt-f"><div class="rt-chips">${[[today(),"आज"],[yd,"कल"]].map(([v,t])=>`<button class="chip" data-rday="${v}" aria-pressed="${R.date===v}">${t}</button>`).join("")}<input class="inp" type="date" id="rDate" value="${R.date}" aria-label="तारीख"></div>
    ${P.length?`<div class="rt-chips"><button class="chip" data-rwho="" aria-pressed="${!R.who}">👥 सब</button>${P.map(([u,n])=>`<button class="chip" data-rwho="${esc(u)}" aria-pressed="${R.who===u}"><i class="rdot" style="background:${colorOf(u)}"></i>${esc(n||"फोन")}</button>`).join("")}</div>`:""}</div>
  <div class="card2 rlive" id="rLive">${liveHTML()}</div>
  <div class="rmapw${R.big?" big":""}" id="rmapw"><div id="rmap" class="rmap" role="img" aria-label="गाड़ी का रास्ता नक्शे पर"></div>
    <div class="rctl"><button data-rsat>${R.sat?"🗺️ सादा":"🛰️ सैटेलाइट"}</button><button data-rlbl aria-pressed="${R.lbl}">🏷️ नाम</button><button data-rme>📍 मैं</button><button data-rbig>${R.big?"✕ छोटा":"⛶ बड़ा"}</button></div></div>
  ${d&&d.pts.some(u=>u.P.length>1)?playHTML(d):""}
  <button class="big" data-plhere style="margin:8px 0">📍 मैं यहाँ हूँ — फोन की असली जगह से जगह जोड़ें</button>
  ${d?dayHTML(d):'<div class="empty">⏳ रूट लोड हो रहा है…</div>'}
  ${placesHTML()}
  <div class="card2"><h3>🏆 जगह की कमाई</h3><p class="note" style="margin:0">कहाँ कितना समय, कितने बिल, कितनी बिक्री। ₹ प्रति घंटा से पता चलेगा कि कहाँ ज़्यादा रुकना है।</p>
    <div class="ragg"><button class="big ghost" data-ragg="1">इस दिन</button><button class="big ghost" data-ragg="7">7 दिन</button><button class="big ghost" data-ragg="30">30 दिन</button></div>
    <div id="rAgg">${R.agg?aggHTML(R.agg):""}</div></div>
  ${window.SX?SX.slotHTML():""}
  ${custHTML()}`;
  SR.drawMap();
};
function loadLeaflet(){return new Promise((res,rej)=>{if(window.L)return res();if(!document.querySelector('link[href="lib/leaflet.css"]')){const l=document.createElement("link");l.rel="stylesheet";l.href="lib/leaflet.css";document.head.appendChild(l)}
  const s=document.createElement("script");s.src="lib/leaflet.js";s.onload=()=>res();s.onerror=rej;document.head.appendChild(s)})}
const ESRI="https://server.arcgisonline.com/ArcGIS/rest/services/",SATU=ESRI+"World_Imagery/MapServer/tile/{z}/{y}/{x}";
function baseLayers(m,lbl){
  if(R.sat){L.tileLayer(SATU,{maxZoom:20,maxNativeZoom:18,attribution:"Imagery © Esri, Maxar, Earthstar Geographics"}).addTo(m);
    if(lbl){L.tileLayer(ESRI+"Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",{maxZoom:20,maxNativeZoom:18,opacity:.5}).addTo(m);
      L.tileLayer(ESRI+"Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",{maxZoom:20,maxNativeZoom:18,opacity:.9}).addTo(m)}}
  else L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:20,maxNativeZoom:19,attribution:"© OpenStreetMap"}).addTo(m);
}
const pin=(html,cls,w,h)=>L.divIcon({className:cls,html,iconSize:[w,h],iconAnchor:[w/2,h/2]});
SR.drawMap=async function(){
  const el=document.getElementById("rmap");if(!el)return;
  if(!window.L){try{await loadLeaflet()}catch(e){el.innerHTML='<p class="note" style="padding:12px">नक्शा लोड नहीं हुआ (इंटरनेट देखें)</p>';return}}
  if(R.map){try{R.map.remove()}catch(e){}R.map=null;R.liveLayer=null;R.meLayer=null;R.playLayer=null;R.billLayer=null;R.findLayer=null}
  if(!document.body.contains(el))return;
  const m=R.map=L.map(el,{zoomControl:true,attributionControl:true,maxZoom:20});
  baseLayers(m,R.lbl);
  const B=[];
  SR.places.forEach(p=>{const ok=p.src==="gps";const c=L.circle([p.lat,p.lng],{radius:+p.r||150,color:ok?"#38bdf8":"#f59e0b",weight:2,dashArray:ok?null:"6 5",fillOpacity:.07}).addTo(m);
    c.bindTooltip(esc(p.name)+(ok?"":" ⚠"),{permanent:true,direction:"center",className:"rlbl"});c.on("click",()=>SR.placeSheet(p.name))});
  const d=R.day&&R.day.date===R.date?R.day:null;
  if(d){
    d.pts.forEach(u=>{const ll=u.P.map(p=>[p.lat,p.lng]);if(ll.length<2)return;const col=colorOf(u.uid);
      L.polyline(ll,{color:"#ffffff",weight:7,opacity:.4}).addTo(m);L.polyline(ll,{color:col,weight:4,opacity:.95}).addTo(m);
      L.marker(ll[0],{icon:pin("▶","rpin st",22,22)}).addTo(m).bindTooltip("शुरू · "+ftime(u.P[0].ts)+" · "+esc(u.name||""));
      L.marker(ll[ll.length-1],{icon:pin("🏁","rpin en",24,24)}).addTo(m).bindTooltip("आख़िरी · "+ftime(u.P[u.P.length-1].ts)+" · "+esc(u.name||""));
      ll.forEach(x=>B.push(x))});
    d.stops.forEach((s,i)=>{const sz=Math.round(24+Math.min(14,Math.sqrt(s.sales)/2.5));
      L.marker([s.lat,s.lng],{icon:pin(`<span class="${s.sales>0?"sale":""}" style="width:${sz}px;height:${sz}px;line-height:${sz-4}px">${i+1}</span>`,"rstopi",sz,sz),zIndexOffset:500}).addTo(m)
        .on("click",()=>SR.stopSheet(i)).bindTooltip(`${i+1}. ${s.place?esc(s.place.name):"बिना नाम"} · ${ftime(s.start)} · ${durTxt(mins(s.end-s.start))} · ${s.bills.length} बिल · ${rs(r2(s.sales))}`);B.push([s.lat,s.lng])});
    R.billLayer=L.layerGroup();d.bills.forEach(b=>{if(!b.loc)return;L.circleMarker([b.loc.lat,b.loc.lng],{radius:4,color:"#fff",weight:1,fillColor:"#ef4444",fillOpacity:1}).addTo(R.billLayer).bindTooltip(ftime(b.ts)+" · "+rs(b.total)+" · "+esc(b.byName||""));B.push([b.loc.lat,b.loc.lng])});
  }
  const dec=()=>{const z=m.getZoom();el.classList.toggle("nolbl",!(R.lbl&&z>=15));if(R.billLayer){if(z>=17)R.billLayer.addTo(m);else m.removeLayer(R.billLayer)}};
  m.on("zoomend",dec);
  if(R.date===today())R.live.forEach(v=>{if(v.lat!=null&&(!R.who||v.id===R.who))B.push([v.lat,v.lng])});
  drawLive();
  if(B.length)m.fitBounds(B,{padding:[30,30],maxZoom:17});else m.setView([HOME.lat,HOME.lng],16);
  dec();playDraw();
  setTimeout(()=>{try{m.invalidateSize()}catch(e){}},250);
};
/* ▶ रीप्ले: समय t पर हर व्यक्ति कहाँ था */
function posAt(P,t){if(!P.length||t<P[0].ts)return null;const i=P.findIndex(p=>p.ts>t);if(i<0)return {p:P[P.length-1],mv:false,kmh:0};
  const a=P[i-1],b=P[i];if(!a)return null;const dt=b.ts-a.ts;if(dt>12*60000)return {p:a,mv:false,kmh:0};
  const f=(t-a.ts)/dt,kmh=dt>0?dist(a,b)/(dt/3600000)/1000:0;return {p:{lat:a.lat+(b.lat-a.lat)*f,lng:a.lng+(b.lng-a.lng)*f},mv:kmh>3,kmh}}
function playDraw(){
  const d=R.day;if(!R.map||!d||!window.L)return;
  if(!R.playLayer)R.playLayer=L.layerGroup().addTo(R.map);R.playLayer.clearLayers();
  const t=R.play.t;if(!t)return;const st=[];
  d.pts.forEach(u=>{const q=posAt(u.P,t);if(!q)return;const col=colorOf(u.uid);
    const done=u.P.filter(p=>p.ts<=t).map(p=>[p.lat,p.lng]);done.push([q.p.lat,q.p.lng]);
    if(done.length>1)L.polyline(done,{color:"#fde047",weight:5,opacity:.95}).addTo(R.playLayer);
    L.marker([q.p.lat,q.p.lng],{icon:L.divIcon({className:"rvan",html:`<span style="border-color:${col}">🚐<b>${esc(String(u.name||"").split(" ")[0])}</b></span>`,iconSize:[78,28],iconAnchor:[39,14]}),zIndexOffset:1000}).addTo(R.playLayer);
    const pl=placeAt(q.p);st.push(`${esc(String(u.name||"").split(" ")[0])}: ${q.mv?"🚐 चल रही "+Math.round(q.kmh)+" km/h":"🛑 रुकी"}${pl?" · 📍"+esc(pl.name):""}`)});
  const a=document.getElementById("rpTime");if(a)a.textContent=ftime(t);const b=document.getElementById("rpSt");if(b)b.innerHTML=st.join(" · ")||"इस समय कोई जगह नहीं";const r=document.getElementById("rpT");if(r&&+r.value!==t)r.value=t;
}
function playStop(){R.play.on=false;clearInterval(R.play.timer);const x=document.querySelector("[data-rplay]");if(x)x.textContent="▶"}
function playToggle(){const d=R.day;if(!d)return;const [a,b]=playRange(d);if(!(b>a))return;
  if(R.play.on){playStop();return}
  if(!R.play.t||R.play.t>=b)R.play.t=a;R.play.on=true;clearInterval(R.play.timer);
  const x=document.querySelector("[data-rplay]");if(x)x.textContent="⏸";
  R.play.timer=setInterval(()=>{if(S.tab!=="route"||!document.getElementById("rmap")){playStop();return}
    R.play.t=Math.min(b,R.play.t+R.play.spd*60000*0.2);playDraw();if(R.play.t>=b)playStop()},200);
  playDraw();
}
SR.playToggle=playToggle;
/* छोटा सैटेलाइट "फोटो" — जगह कैसी दिखती है */
function thumbInit(id,lat,lng,r){const el=document.getElementById(id);if(!el||!window.L)return;
  const m=L.map(el,{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false}).setView([lat,lng],r>200?17:18);
  L.tileLayer(SATU,{maxZoom:20,maxNativeZoom:18}).addTo(m);L.circle([lat,lng],{radius:r||80,color:"#38bdf8",weight:2,fillOpacity:.08}).addTo(m);
  L.circleMarker([lat,lng],{radius:6,color:"#fff",weight:2,fillColor:"#ef4444",fillOpacity:1}).addTo(m);setTimeout(()=>{try{m.invalidateSize()}catch(e){}},200)}
function billRowsHTML(L0){const L1=L0.slice().sort((a,b)=>b.ts-a.ts);if(!L1.length)return '<p class="note">कोई बिल नहीं</p>';
  return `<div class="rbl">${L1.slice(0,80).map(b=>{const p=b.pay||{};const how=b.mode==="inst"?"🏢 संस्था":b.settled===false?"⏳ बाकी":[p.upi?"UPI":"",p.cash?"नकद":"",p.udhar?"📒 उधार":""].filter(Boolean).join("+");const ph=clean(b.custPhone||"");
    return `<div class="rb"><div class="rb-m"><b>${b.date!==R.date?fdate(b.date).slice(0,5)+" ":""}${ftime(b.ts)} · ${rs(b.total)} <span class="pill">${esc(how)}</span></b><span class="note">${esc(b.no)} · ${esc(b.partyName||"VIP ग्राहक")}${ph?" · "+ph:""} · बिलर ${esc(b.byName||"")}</span><small>${esc((b.lines||[]).map(l=>l.name+" "+fq(l.qty,l.unit)).join(", "))}</small></div>${ph.length===10?`<div class="rb-a"><a href="https://wa.me/91${ph}" target="_blank" rel="noopener" aria-label="WhatsApp">🟢</a><a href="tel:+91${ph}" aria-label="कॉल">📞</a></div>`:""}</div>`}).join("")}${L1.length>80?`<p class="note">…और ${L1.length-80} बिल</p>`:""}</div>`}
SR.stopSheet=function(i){const d=R.day,s=d&&d.stops[i];if(!s)return;const m=mins(s.end-s.start);
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="पड़ाव"><div class="grab"></div>
  <div class="sh-head"><div><h3>${i+1}. ${s.place?"📍 "+esc(s.place.name):"📍 बिना नाम की जगह"}</h3><span class="note">${esc(s.name||"")} · ${ftime(s.start)}–${ftime(s.end)} · ${durTxt(m)} · ${s.bills.length} बिल · ${rs(r2(s.sales))}${s.inst?" · संस्था "+rs(r2(s.inst)):""}${m>=10?" · "+rs(r2(s.sales/(m/60)))+"/घंटा":""}</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div class="rthumb" id="rthumb" aria-label="जगह की सैटेलाइट फोटो"></div>${s.place&&s.place.photo?`<img class="rphoto" src="${s.place.photo}" alt="जगह की फोटो">`:""}
  <div class="row2" style="margin:8px 0">${s.place?`<button class="big ghost" data-sspl="${esc(s.place.name)}">📊 इस जगह का पूरा हिसाब</button>`:`<button class="big" data-ssname>✏️ इस जगह को नाम दें</button>`}<a class="big ghost" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://maps.google.com/?q=${s.lat},${s.lng}">🗺️ Google Map</a></div>
  <h4 style="margin:6px 0">🧾 यहाँ बने बिल (${s.bills.length})</h4>${billRowsHTML(s.bills)}</div></div>`;
  thumbInit("rthumb",s.lat,s.lng,s.place?+s.place.r||150:60);
  $("#sheet").onclick=e=>{if(e.target.matches("[data-close]")){closeSheet();return}if(e.target.closest("[data-ssname]")){nameSheet(s.lat,s.lng,null);return}const p=e.target.closest("[data-sspl]");if(p)SR.placeSheet(p.dataset.sspl)};
};
SR.billsRange=async function(n){const end=R.date||today(),out=[];
  for(let k=0;k<n;k++){const d=dayAdd(end,-k);let L1=R.bcache[d];
    if(!L1){if(d===S.billsDate)L1=S.dayBills;else{try{L1=S.demo||!S.db?[]:(await S.db.collection("days/"+d+"/bills").get()).docs.map(x=>x.data())}catch(e){L1=[]}if(d!==today())R.bcache[d]=L1}}
    out.push(...L1.filter(b=>!b.cancelled))}
  return out};
function shrink(file,max){return new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const sc=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL("image/jpeg",.62))};img.onerror=rej;img.src=u})}
SR.placeSheet=async function(name,n){
  n=n||1;const G=SR.places.filter(p=>p.name===name);if(!G.length)return;const c=G.find(p=>p.src==="gps")||G[0],photo=(G.find(p=>p.photo)||{}).photo||"";
  const head=`<div class="sh-head"><div><h3>📍 ${esc(name)}</h3><span class="note">${G.length} जगह · ${c.src==="gps"?"✅ फोन GPS से पक्की ±"+(c.acc||"?")+" मी.":"⚠ अंदाज़े से बनी"} · दायरा ${+c.r||150} मी.</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div class="rt-chips" style="margin:0 0 8px">${[[1,fdate(R.date)===fdate(today())?"आज":fdate(R.date).slice(0,5)],[7,"7 दिन"],[30,"30 दिन"]].map(([v,t])=>`<button class="chip" data-psn="${v}" aria-pressed="${n===v}">${t}</button>`).join("")}</div>
  <div class="rthumb" id="rthumb" aria-label="जगह की सैटेलाइट फोटो"></div>${photo?`<img class="rphoto" src="${photo}" alt="जगह की फोटो">`:""}
  <div class="row2" style="margin:8px 0"><button class="big ghost" data-pphoto>📷 ${photo?"फोटो बदलें":"जगह की फोटो लें"}</button><button class="big ghost" data-pgo>🎯 नक्शे पर</button></div>`;
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="जगह का हिसाब"><div class="grab"></div>${head}<p class="note">⏳ बिल आ रहे हैं…</p></div></div>`;
  const wire=()=>{thumbInit("rthumb",c.lat,c.lng,+c.r||150);
    $("#sheet").onclick=async e=>{if(e.target.matches("[data-close]")){closeSheet();return}
      const ps=e.target.closest("[data-psn]");if(ps){SR.placeSheet(name,+ps.dataset.psn);return}
      if(e.target.closest("[data-pgo]")){closeSheet();if(R.map){R.map.setView([c.lat,c.lng],18);const w=document.getElementById("rmapw");if(w)w.scrollIntoView({behavior:"smooth",block:"center"})}return}
      if(e.target.closest("[data-pphoto]")){const fi=document.createElement("input");fi.type="file";fi.accept="image/*";fi.capture="environment";
        fi.onchange=async()=>{const f=fi.files[0];if(!f)return;try{toast("फोटो छोटी कर रहे हैं…");const u=await shrink(f,720);await S.db.collection("places").doc(c.id).update({photo:u,photoTs:Date.now()});c.photo=u;toast("📷 "+name+" की फोटो सेव हुई");SR.placeSheet(name,n)}catch(err){toast("फोटो सेव नहीं हुई")}};fi.click();return}}};
  wire();
  const all=await SR.billsRange(n);const B=all.filter(b=>b.loc&&(!R.who||b.by===R.who)&&(placeAt(b.loc)||{}).name===name);
  const sale=r2(B.filter(b=>b.mode!=="inst").reduce((a,b)=>a+(+b.total||0),0)),days=new Set(B.map(b=>b.date)).size;
  const C={};B.forEach(b=>{const ph=clean(b.custPhone);if(ph.length!==10)return;const o=C[ph]||(C[ph]={ph,name:"",n:0,amt:0,last:0});o.n++;o.amt+=+b.total||0;o.last=Math.max(o.last,b.ts||0);if(b.partyName&&!/^(VIP ग्राहक|ग्राहक \d+)$/.test(b.partyName))o.name=b.partyName});
  (S.customers||[]).forEach(cu=>{if(cu.lastLoc&&(placeAt(cu.lastLoc)||{}).name===name){const o=C[cu.id]||(C[cu.id]={ph:cu.id,name:"",n:0,amt:0,last:0});o.name=o.name||cu.name||"";o.tot=cu.spent||0;o.last=Math.max(o.last,cu.lastTs||0)}});
  (S.customers||[]).forEach(cu=>{if(C[cu.id]&&!C[cu.id].name)C[cu.id].name=cu.name||""});
  const CL=Object.values(C).sort((a,b)=>b.amt-a.amt||b.last-a.last);
  if(!document.getElementById("rthumb"))return;
  $("#sheet").querySelector(".sheet").innerHTML=`<div class="grab"></div>${head}
  <div class="kpis"><div class="kpi"><span>बिल</span><b>${B.length}</b></div><div class="kpi"><span>बिक्री</span><b>${rs(sale)}</b></div><div class="kpi"><span>ग्राहक (नंबर)</span><b>${CL.length}</b></div><div class="kpi"><span>${n>1?"दिन जब बिका":"औसत बिल"}</span><b>${n>1?days:rs(B.length?r2(sale/Math.max(1,B.filter(b=>b.mode!=="inst").length)):0)}</b></div></div>
  <h4 style="margin:10px 0 6px">👥 इस जगह के ग्राहकों के नंबर (${CL.length})</h4>
  ${CL.length?`<div class="rbl">${CL.map(o=>`<div class="rb"><div class="rb-m"><b>${esc(o.name||"ग्राहक")} · ${o.ph}</b><span class="note">${o.n?o.n+" बिल · "+rs(r2(o.amt)):"आख़िरी बार यहीं दिखे"}${o.last?" · आख़िरी "+fdate(dOf(o.last)).slice(0,5):""}</span></div><div class="rb-a"><a href="https://wa.me/91${o.ph}" target="_blank" rel="noopener" aria-label="WhatsApp">🟢</a><a href="tel:+91${o.ph}" aria-label="कॉल">📞</a><button class="lnk" data-chist="${o.ph}" aria-label="इतिहास">📜</button></div></div>`).join("")}</div>`:'<p class="note">अभी इस जगह के किसी बिल पर ग्राहक का नंबर नहीं लिखा गया।</p>'}
  <h4 style="margin:10px 0 6px">🧾 बिल (${B.length})</h4>${billRowsHTML(B)}`;
  wire();
  const sh=$("#sheet"),o0=sh.onclick;sh.onclick=e=>{const h=e.target.closest("[data-chist]");if(h){custHistSheet(h.dataset.chist);return}o0(e)};
};
/* 🛰️ फोन का असली GPS: कई रीडिंग लेकर सबसे सटीक (±मीटर सबसे कम) — नेटवर्क/पुरानी जगह नहीं */
SR.preciseFix=function(onProgress,maxMs){
  maxMs=maxMs||25000;
  return new Promise(res=>{
    if(!navigator.geolocation){res({err:"यह फोन GPS नहीं देता"});return}
    const R_=[];let id=null,done=false;const t0=Date.now();
    const fin=err=>{if(done)return;done=true;try{navigator.geolocation.clearWatch(id)}catch(e){}clearTimeout(tm);
      if(!R_.length){res({err:err||"GPS नहीं मिला — खुले में आकर फिर दबाएँ"});return}
      const best=Math.min(...R_.map(r=>r.acc));const B=R_.filter(r=>r.acc<=best*1.5);const W=B.reduce((a,r)=>a+1/r.acc**2,0);
      res({lat:+(B.reduce((a,r)=>a+r.lat/r.acc**2,0)/W).toFixed(6),lng:+(B.reduce((a,r)=>a+r.lng/r.acc**2,0)/W).toFixed(6),acc:Math.round(best),n:R_.length,ts:Date.now()})};
    const tm=setTimeout(()=>fin(),maxMs);
    const chk=setInterval(()=>{if(done){clearInterval(chk);return}const el=Date.now()-t0;const best=R_.length?Math.min(...R_.map(r=>r.acc)):1e9;if((el>=8000&&best<=20)||(el>=14000&&best<=GOOD))fin()},1000);
    try{id=navigator.geolocation.watchPosition(p=>{const c=p.coords;if(!(c.accuracy>0))return;R_.push({lat:c.latitude,lng:c.longitude,acc:c.accuracy});
        const best=Math.min(...R_.map(r=>r.acc));if(onProgress)onProgress({acc:Math.round(best),n:R_.length,ms:Date.now()-t0});
        if((best<=10&&R_.length>=3)||(best<=20&&R_.length>=6))fin()},
      e=>{if(e.code===1)fin("लोकेशन की अनुमति नहीं — फोन की सेटिंग → ऐप → सब्ज़ी एक्सप्रेस → लोकेशन → 'सटीक लोकेशन' चालू करें");else if(e.code===2)fin("फोन की लोकेशन (GPS) बंद है — चालू करें")},
      {enableHighAccuracy:true,maximumAge:0,timeout:maxMs})}catch(e){fin("GPS नहीं मिला")}
  });
};
SR.showMe=async function(){
  if(!R.map||!window.L)return;toast("🛰️ आपकी असली जगह ढूँढ रहे हैं…");
  const f=await SR.preciseFix(null,15000);if(f.err){toast(f.err);return}
  if(!R.meLayer)R.meLayer=L.layerGroup().addTo(R.map);R.meLayer.clearLayers();
  L.circle([f.lat,f.lng],{radius:f.acc,color:"#2563eb",weight:1,fillOpacity:.15}).addTo(R.meLayer);
  L.circleMarker([f.lat,f.lng],{radius:7,color:"#fff",weight:2,fillColor:"#2563eb",fillOpacity:1}).addTo(R.meLayer).bindTooltip("आप यहाँ हैं · ±"+f.acc+" मी.",{permanent:true,direction:"top",offset:[0,-8]});
  R.map.setView([f.lat,f.lng],Math.max(R.map.getZoom(),17));
};
/* 📍 जगह जोड़ें / पक्की करें — जगह हमेशा फोन के असली GPS से, नक्शे से नहीं */
SR.lockSheet=function(preName){
  const names=[...new Set(SR.places.map(p=>p.name))].sort((a,b)=>a.localeCompare(b,"hi"));
  const st={fix:null,q:preName||"",busy:true,sure:false};
  const chips=()=>{const q=st.q.trim().toLowerCase();const L=names.filter(n=>!q||n.toLowerCase().includes(q));return L.length?L.map(n=>`<button class="chip" data-plpick="${esc(n)}">${esc(n)}</button>`).join(""):`<span class="note">"${esc(st.q)}" नया नाम होगा</span>`};
  const fixHTML=()=>{const f=st.fix;if(st.busy)return `<div class="pl-fix busy">🛰️ GPS पकड़ रहा है…${f&&f.acc?` अभी ±${f.acc} मी. (${f.n} रीडिंग)`:""}<br><span class="note">खुले आसमान के नीचे, गाड़ी से 2-3 कदम दूर खड़े रहें</span></div>`;
    if(!f||f.err)return `<div class="pl-fix bad">⚠ ${esc(f&&f.err||"GPS नहीं मिला")}<br><button class="lnk" data-plretry>🔄 फिर कोशिश करें</button></div>`;
    return `<div class="pl-fix ${f.acc<=GOOD?"ok":"bad"}">${f.acc<=GOOD?"✅":"⚠"} जगह मिली: <b>±${f.acc} मीटर</b> (${f.n} रीडिंग)<br><span class="note">${f.lat}, ${f.lng}</span> · <a class="lnk" href="https://maps.google.com/?q=${f.lat},${f.lng}" target="_blank" rel="noopener">Google Map पर देखें ↗</a>${f.acc>GOOD?`<br><b>सटीकता कम है</b> — खुले में आकर <button class="lnk" data-plretry>🔄 फिर लें</button>`:""}</div>`};
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="जगह जोड़ें"><div class="grab"></div>
  <div class="sh-head"><div><h3>📍 ${preName?esc(preName)+" — यहीं पक्का करें":"मैं यहाँ हूँ — जगह जोड़ें"}</h3><span class="note">जगह फोन के असली GPS से दर्ज होगी, नक्शे से नहीं — इसलिए नक्शा थोड़ा खिसका दिखे तो भी हिसाब सही रहेगा</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div id="plFix">${fixHTML()}</div>
  <label class="fld">नाम (खोजें या नया लिखें)<input class="inp" id="plName" value="${esc(st.q)}" placeholder="जैसे सरल लाइन, गरुड़ लाइन" autocomplete="off"></label>
  <div class="lsws" id="plChips" style="margin:6px 0">${chips()}</div>
  <label class="fld">दायरा<select class="inp" id="plR">${[[100,"छोटा — 100 मीटर"],[150,"सामान्य — 150 मीटर"],[250,"बड़ा — 250 मीटर"]].map(([v,t])=>`<option value="${v}" ${v===150?"selected":""}>${t}</option>`).join("")}</select></label>
  <button class="big" data-pllock style="margin-top:10px">✓ इस जगह को सेव करें</button></div></div>`;
  const redraw=()=>{const x=$("#plFix");if(x)x.innerHTML=fixHTML()};
  const go=async()=>{st.busy=true;st.fix=null;st.sure=false;redraw();const f=await SR.preciseFix(pr=>{st.fix=pr;redraw()});st.busy=false;st.fix=f;redraw()};
  $("#sheet").oninput=e=>{if(e.target.id==="plName"){st.q=e.target.value;const c=$("#plChips");if(c)c.innerHTML=chips()}};
  $("#sheet").onclick=async e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    const pk=e.target.closest("[data-plpick]");if(pk){st.q=pk.dataset.plpick;$("#plName").value=st.q;$("#plChips").innerHTML=chips();return}
    if(e.target.closest("[data-plretry]")){go();return}
    const btn=e.target.closest("[data-pllock]");if(!btn)return;
    const name=st.q.trim(),r=+$("#plR").value||150,f=st.fix;
    if(!name){toast("नाम लिखें");$("#plName").focus();return}
    if(st.busy){toast("🛰️ GPS पकड़ने दें — कुछ सेकंड");return}
    if(!f||f.err){toast("GPS नहीं मिला — फिर कोशिश करें");return}
    if(f.acc>GOOD&&!st.sure){st.sure=true;btn.textContent="⚠ ±"+f.acc+" मी. — फिर भी सेव करें?";return}
    const rec={name,lat:f.lat,lng:f.lng,r,acc:f.acc,src:"gps",ts:Date.now(),by:S.uid||"",byName:biller()};
    try{
      const same=SR.places.filter(p=>p.name===name).map(p=>({p,d:dist(p,f)})).sort((a,b)=>a.d-b.d)[0];
      if(same&&same.d<=500){await S.db.collection("places").doc(same.p.id).update({...rec,old:{lat:same.p.lat,lng:same.p.lng}});toast("📍 "+name+" पक्की हुई · "+Math.round(same.d)+" मी. खिसकी")}
      else{await S.db.collection("places").add(rec);toast("📍 "+name+" सेव हुई · ±"+f.acc+" मी.")}
      closeSheet();
    }catch(err){toast("सेव नहीं हुआ: "+(err.code||""))}
  };
  go();
};
function nameSheet(lat,lng,cur){
  const names=[...new Set(SR.places.map(p=>p.name))].sort((a,b)=>a.localeCompare(b,"hi"));
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="जगह का नाम"><div class="grab"></div>
  <div class="sh-head"><div><h3>📍 इस जगह का नाम</h3><span class="note">आगे से यह जगह अपने-आप इसी नाम से पहचानी जाएगी</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <label class="fld">नाम<input class="inp" id="plName" value="${esc(cur?cur.name:"")}" placeholder="जैसे सरल लाइन, गरुड़ लाइन"></label>
  ${names.length?`<div class="lsws" style="margin:6px 0">${names.map(n=>`<button class="chip" data-plpick="${esc(n)}">${esc(n)}</button>`).join("")}</div>`:""}
  <label class="fld">दायरा<select class="inp" id="plR">${[[100,"छोटा — 100 मीटर"],[150,"सामान्य — 150 मीटर"],[250,"बड़ा — 250 मीटर"]].map(([v,t])=>`<option value="${v}" ${(cur?+cur.r:150)===v?"selected":""}>${t}</option>`).join("")}</select></label>
  <a class="lnk" href="https://maps.google.com/?q=${lat},${lng}" target="_blank" rel="noopener">Google Map पर देखें ↗</a>
  <p class="note" style="margin:6px 0 0">⚠ यह जगह रूट के अंदाज़े से है। आप अभी वहीं हैं तो नीचे वाला बटन दबाएँ — फोन का असली GPS लगेगा।</p>
  <button class="big" data-plsave style="margin-top:10px">✓ नाम सेव करें</button>
  <button class="big ghost" data-plnow style="margin-top:8px">📍 मैं अभी यहीं हूँ — फोन का असली GPS लें</button></div></div>`;
  $("#sheet").onclick=async e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    const pk=e.target.closest("[data-plpick]");if(pk){$("#plName").value=pk.dataset.plpick;return}
    if(e.target.closest("[data-plnow]")){SR.lockSheet($("#plName").value.trim()||(cur?cur.name:""));return}
    if(!e.target.closest("[data-plsave]"))return;
    const name=$("#plName").value.trim(),r=+$("#plR").value||150;if(!name){toast("नाम लिखें");return}
    try{if(cur)await S.db.collection("places").doc(cur.id).update({name,r});else await S.db.collection("places").add({name,lat:+(+lat).toFixed(6),lng:+(+lng).toFixed(6),r,ts:Date.now()});closeSheet();toast("📍 "+name+" सेव हुआ")}
    catch(err){toast("सेव नहीं हुआ: "+(err.code||""))}
  };
  setTimeout(()=>{const x=$("#plName");if(x)x.focus()},120);
}
async function custHistSheet(ph){
  const c=(S.customers||[]).find(x=>x.id===ph)||{};
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="ग्राहक का इतिहास"><div class="grab"></div>
  <div class="sh-head"><div><h3>👤 ${esc(c.name||"ग्राहक")} · ${esc(ph)}</h3><span class="note">${c.visits||0} बार · कुल ${rs(c.spent||0)}${c.firstTs?" · पहली बार "+fdate(dOf(c.firstTs)):""}</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div class="row2" style="margin:0 0 8px"><a class="big ghost" style="text-align:center;text-decoration:none" href="tel:+91${esc(ph)}">📞 कॉल</a><a class="big ghost" style="text-align:center;text-decoration:none" href="https://wa.me/91${esc(ph)}" target="_blank" rel="noopener">🟢 WhatsApp</a></div>
  <div id="chl"><p class="note">⏳ इतिहास आ रहा है…</p></div></div></div>`;
  $("#sheet").onclick=e=>{if(e.target.matches("[data-close]"))closeSheet()};
  try{
    const q=S.demo||!S.db?{docs:[]}:await S.db.collection("customers/"+ph+"/hist").orderBy("ts","desc").limit(200).get();
    const H=q.docs.map(d=>d.data());const el=document.getElementById("chl");if(!el)return;
    el.innerHTML=H.length?`<div class="list" style="margin:0">${H.map(h=>`<div class="li"><div class="mid"><b>${fdate(h.date)} · ${ftime(h.ts)} · ${rs(h.total)}${h.cancelled?' <span class="pill red">रद्द</span>':""}</b><span>${esc(h.items||"")}</span><span class="note">बिल ${esc(h.no)}${h.place?" · 📍 "+esc(h.place):""}${h.by?" · "+esc(h.by):""}</span></div></div>`).join("")}</div>`
      :`<p class="note">इस नंबर का पूरा इतिहास अब से जुड़ना शुरू होगा।${c.lastItems?" पिछली बार: "+esc(c.lastItems):""}</p>`;
  }catch(e){const el=document.getElementById("chl");if(el)el.innerHTML=`<p class="warn">इतिहास नहीं पढ़ा गया: ${esc(e.code||"")}</p>`}
}
SR.saveFile=async function(name,text,mime){
  if(NAT.isNative){try{await BP().shareText({name,text,mime:mime||"text/plain"});return true}catch(e){if(!isUnimpl(e)){toast("फाइल नहीं बनी: "+(e.message||""));return false}}
    try{await navigator.clipboard.writeText(text);toast("📋 नई APK में फाइल बनेगी — अभी पूरा डेटा कॉपी हो गया");return true}catch(e){return false}}
  const blob=new Blob(["﻿"+text],{type:(mime||"text/plain")+";charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  toast("⬇️ फाइल डाउनलोड हुई");return true;
};
function csvCustomers(){
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const rows=[["mobile","name","visits","total_spent","first_date","last_date","last_items"]];
  custList().forEach(c=>rows.push([c.id,c.name||"",c.visits||0,c.spent||0,c.firstTs?dOf(c.firstTs):"",c.lastTs?dOf(c.lastTs):"",c.lastItems||""]));
  return rows.map(r=>r.map(q).join(",")).join("\n");
}
function bindRoute(el){
  if(el._b)return;el._b=1;
  const reday=()=>{R.day=dayFor();R.play.t=0;playStop();SR.renderRoute()};
  el.addEventListener("change",e=>{if(e.target.id==="rDate"){R.date=e.target.value||today();R.agg=null;R.raw=null;R.day=null;playStop();R.play.t=0;SR.renderRoute()}});
  el.addEventListener("input",e=>{
    if(e.target.id==="rcq"){R.custQ=e.target.value;const l=document.getElementById("rcl");if(l)l.innerHTML=custListHTML();return}
    if(e.target.id==="rpq"){R.placeQ=e.target.value;const pos=e.target.selectionStart;const box=document.getElementById("rpl");if(box){const tmp=document.createElement("div");tmp.innerHTML=placesHTML();const nb=tmp.querySelector("#rpl");if(nb)box.innerHTML=nb.innerHTML}return}
    if(e.target.id==="rpT"){R.play.t=+e.target.value;playDraw();return}
  });
  el.addEventListener("click",e=>{
    const t=e.target.closest("[data-plhere],[data-plfix],[data-ragg],[data-rname],[data-pren],[data-pdel],[data-chist],[data-ccsv],[data-callc],[data-rref],[data-aggname],[data-rday],[data-rwho],[data-rsat],[data-rlbl],[data-rme],[data-rbig],[data-rplay],[data-rspd],[data-rpl],[data-cmap],[data-rstop]");if(!t)return;
    if(t.dataset.plhere!==undefined){SR.lockSheet("");return}
    if(t.dataset.plfix){SR.lockSheet(t.dataset.plfix);return}
    if(t.dataset.ragg){SR.loadAgg(+t.dataset.ragg);return}
    if(t.dataset.rref!==undefined){R.raw=null;R.day=null;R.agg=null;R.bcache={};SR.renderRoute();return}
    if(t.dataset.rname!==undefined){const s=R.day&&R.day.stops[+t.dataset.rname];if(s)nameSheet(s.lat,s.lng,s.place);return}
    if(t.dataset.aggname){const [la,ln]=t.dataset.aggname.split(",");nameSheet(+la,+ln,null);return}
    if(t.dataset.pren){const old=t.dataset.pren;const nn=(prompt("नया नाम",old)||"").trim();if(!nn||nn===old)return;SR.places.filter(p=>p.name===old).forEach(p=>S.db.collection("places").doc(p.id).update({name:nn}).catch(()=>{}));toast("नाम बदला");return}
    if(t.dataset.pdel){const n=t.dataset.pdel;if(!confirm(n+" का नाम हटाएँ? (बिल और रूट नहीं मिटेंगे)"))return;SR.places.filter(p=>p.name===n).forEach(p=>S.db.collection("places").doc(p.id).delete().catch(()=>{}));return}
    if(t.dataset.chist){custHistSheet(t.dataset.chist);return}
    if(t.dataset.callc!==undefined){R.custAll=!R.custAll;SR.renderRoute();return}
    if(t.dataset.ccsv!==undefined){SR.saveFile("SabjiExpress_Customers_"+today()+".csv",csvCustomers(),"text/csv");return}
    if(t.dataset.rday){if(R.date!==t.dataset.rday){R.date=t.dataset.rday;R.agg=null;R.raw=null;R.day=null;playStop();R.play.t=0;SR.renderRoute()}return}
    if(t.dataset.rwho!==undefined){R.who=t.dataset.rwho;reday();return}
    if(t.dataset.rsat!==undefined){R.sat=!R.sat;LSx.set("se_rsat",R.sat?"1":"0");SR.renderRoute();return}
    if(t.dataset.rlbl!==undefined){R.lbl=!R.lbl;LSx.set("se_rlbl",R.lbl?"1":"0");SR.renderRoute();return}
    if(t.dataset.rme!==undefined){SR.showMe();return}
    if(t.dataset.rbig!==undefined){R.big=!R.big;const w=document.getElementById("rmapw");if(w)w.classList.toggle("big",R.big);t.textContent=R.big?"✕ छोटा":"⛶ बड़ा";document.body.classList.toggle("rbig-on",R.big);setTimeout(()=>{try{R.map.invalidateSize()}catch(x){}},150);return}
    if(t.dataset.rplay!==undefined){playToggle();return}
    if(t.dataset.rspd){R.play.spd=+t.dataset.rspd;el.querySelectorAll("[data-rspd]").forEach(x=>x.setAttribute("aria-pressed",x===t));return}
    if(t.dataset.rpl){SR.placeSheet(t.dataset.rpl);return}
    if(t.dataset.cmap){const [la,ln]=t.dataset.cmap.split(",").map(Number);if(!R.map||!window.L)return;if(!R.findLayer)R.findLayer=L.layerGroup().addTo(R.map);R.findLayer.clearLayers();
      L.marker([la,ln],{icon:L.divIcon({className:"rvan find",html:`<span>👤<b>${esc(t.dataset.cname||"")}</b></span>`,iconSize:[120,28],iconAnchor:[60,14]})}).addTo(R.findLayer);R.map.setView([la,ln],18);
      const w=document.getElementById("rmapw");if(w)w.scrollIntoView({behavior:"smooth",block:"center"});return}
    if(t.dataset.rstop!==undefined){SR.stopSheet(+t.dataset.rstop);return}
  });
}


/* ======================= ⚡ जल्दी वाले काम: खराबी, खर्चा, भाव, रात का स्टॉक ======================= */
SR.quickStripHTML=function(){return `<div class="qstrip"><button data-qwaste>🗑️<span>खराबी</span></button><button data-qkharch>💸<span>खर्चा</span></button><button data-qrate>✏️<span>भाव बदलें</span></button><button data-qnight>🌙<span>रात का स्टॉक</span></button></div>`};
const KH=["गाड़ी किराया","पेट्रोल / डीज़ल","गाड़ी रिपेयर","मंडी भाड़ा","हम्माली","पॉलीथीन / थैली","चाय-नाश्ता","अन्य"];
SR.kharchSheet=function(){
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="खर्चा"><div class="grab"></div>
  <div class="sh-head"><div><h3>💸 खर्चा लिखें</h3><span class="note">आज ${fdate(today())} · दिन के हिसाब में जुड़ जाएगा</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div class="lsws" style="margin:0 0 8px">${KH.map(k=>`<button class="chip" data-khq="${esc(k)}">${esc(k)}</button>`).join("")}</div>
  <label class="fld">किस चीज़ का<input class="inp" id="qkW" placeholder="जैसे गाड़ी किराया"></label>
  <label class="fld">कितने रुपये<input class="inp big-in" id="qkA" inputmode="decimal" placeholder="₹"></label>
  <div class="paym" style="margin:8px 0"><button data-qkm="cash" aria-pressed="true">💵 नकद (गल्ले से)</button><button data-qkm="upi" aria-pressed="false">📱 UPI</button></div>
  <button class="big" data-qksave>✓ खर्चा सेव करें</button></div></div>`;
  let mode="cash";
  $("#sheet").onclick=async e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    const q=e.target.closest("[data-khq]");if(q){$("#qkW").value=q.dataset.khq==="अन्य"?"":q.dataset.khq;(q.dataset.khq==="अन्य"?$("#qkW"):$("#qkA")).focus();return}
    const m=e.target.closest("[data-qkm]");if(m){mode=m.dataset.qkm;document.querySelectorAll("[data-qkm]").forEach(x=>x.setAttribute("aria-pressed",x===m));return}
    if(!e.target.closest("[data-qksave]"))return;
    const what=$("#qkW").value.trim(),amt=r2(parseFloat(String($("#qkA").value).replace(",","."))||0);
    if(!what||!(amt>0)){toast("किस चीज़ का और कितने रुपये — दोनों लिखें");return}
    const k={what,amt,mode,ts:Date.now(),by:S.uid||"",byName:biller()};
    try{if(S.demo)S.kharch.push({id:"k"+k.ts,...k});else await S.db.collection("days/"+today()+"/kharch").doc("k"+k.ts.toString(36)).set(k);closeSheet();toast("💸 "+what+" "+rs(amt)+" जुड़ा")}catch(err){toast("खर्चा सेव नहीं हुआ")}
  };
  setTimeout(()=>{const x=$("#qkW");if(x)x.focus()},120);
};
const WR=["सड़ गई","सूख गई","दब/टूट गई","कम तौल","ग्राहक को लौटाई","अन्य"];
SR.wasteSheet=function(id){
  if(S.billsDate!==today()){toast("खराबी आज की तारीख में ही लिखें — दिन का हिसाब में आज चुनें");return}
  const it=id?item(id):null;
  if(!it){
    const L=S.items.filter(i=>i.active!==false&&!i.virtual);
    $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="खराबी"><div class="grab"></div>
    <div class="sh-head"><div><h3>🗑️ क्या खराब हुआ?</h3><span class="note">सामान चुनें</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
    <input class="inp" id="wq" type="search" placeholder="🔍 खोजें" autocomplete="off" style="margin-bottom:8px">
    <div class="ppick" id="wpick">${L.map(i=>`<button data-wit="${esc(i.id)}">${tileHTML(i)}<span>${esc(i.name)}</span></button>`).join("")}</div></div></div>`;
    $("#sheet").oninput=e=>{if(e.target.id!=="wq")return;const q=e.target.value.trim().toLowerCase();document.querySelectorAll("#wpick [data-wit]").forEach(b=>{const x=item(b.dataset.wit);b.hidden=!!q&&!((x.name+" "+(window.SN?SN.en(x):"")+" "+x.id).toLowerCase().includes(q))})};
    $("#sheet").onclick=e=>{if(e.target.matches("[data-close]")){closeSheet();return}const b=e.target.closest("[data-wit]");if(b)SR.wasteSheet(b.dataset.wit)};
    return;
  }
  const kg=it.unit==="kg",u=UNITS[it.unit]||it.unit;const hd=$("header").getBoundingClientRect(),top=Math.max(8,Math.round(hd.bottom)+6);
  $("#sheet").innerHTML=`<div class="qscrim" data-close></div><div class="qpop" style="top:${top}px" role="dialog" aria-label="${esc(it.name)} खराबी">
    <div class="qh">${tileHTML(it)}<div class="qn"><b>🗑️ ${esc(it.name)}</b><span>कितना खराब हुआ?</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
    <div class="qrow"><label class="qf"><input id="wQ" inputmode="decimal" autocomplete="off" placeholder="0"><span>${kg?"कि.ग्रा":u}</span></label></div>
    <div class="lsws">${WR.map((w,i)=>`<button class="chip" data-wr="${esc(w)}" aria-pressed="${i===0}">${esc(w)}</button>`).join("")}</div>
    <button class="big" data-wsave style="background:var(--chili);color:#fff">✓ खराबी दर्ज करें</button></div>`;
  let why=WR[0];
  $("#sheet").onclick=async e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    const w=e.target.closest("[data-wr]");if(w){why=w.dataset.wr;document.querySelectorAll("[data-wr]").forEach(x=>x.setAttribute("aria-pressed",x===w));return}
    if(!e.target.closest("[data-wsave]"))return;
    const q=r2(parseFloat(String($("#wQ").value).replace(",","."))*1000||0)/1000;if(!(q>0)){toast("कितना खराब हुआ — लिखें");return}
    const items=S.stock.items||(S.stock.items={});const o=items[it.id]||(items[it.id]={});o.waste=r2((+o.waste||0)+q);
    (S.stock.wlog||(S.stock.wlog=[])).push({id:it.id,name:it.name,unit:it.unit,qty:q,reason:why,ts:Date.now(),by:S.uid||"",byName:biller()});
    await saveStock();closeSheet();toast("🗑️ "+it.name+" "+fq(q,it.unit)+" खराबी दर्ज ("+why+")");try{renderPane()}catch(err){}
  };
  setTimeout(()=>{const x=$("#wQ");if(x)x.focus()},60);
};
/* ✏️ भाव बदलना — कर्मचारी भी; मालिक को खबर */
SR.rateChipHTML=function(){return S.rateMode?`<button class="chip ratechip on" data-ratemode>✏️ भाव बदलने का मोड — सामान दबाएँ · बंद ✕</button>`:`<button class="chip ratechip" data-ratemode>✏️ भाव बदलें</button>`};
SR.rateSheet=function(it){
  if(!it||it.virtual)return;const old=+it.sale||0,u=UNITS[it.unit]||it.unit;const cost=window.SF?SF.costOf(it):(+it.cost||0);
  const hd=$("header").getBoundingClientRect(),top=Math.max(8,Math.round(hd.bottom)+6);
  $("#sheet").innerHTML=`<div class="qscrim" data-close></div><div class="qpop" style="top:${top}px" role="dialog" aria-label="${esc(it.name)} का भाव">
    <div class="qh">${tileHTML(it)}<div class="qn"><b>✏️ ${esc(it.name)}</b><span>अभी का भाव ${rs(old)}/${u}</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
    <div class="qrow"><label class="qf"><span>नया ₹</span><input id="rnIn" inputmode="decimal" autocomplete="off" placeholder="${old}"><span>/${u}</span></label></div>
    ${S.isOwner&&cost>0?`<p class="note" id="rnM" style="margin:0">खरीद ${rs(cost)}/${u}</p>`:""}
    <button class="big" data-rnsave>✓ नया भाव लगाएँ</button>
    ${S.isOwner?"":`<p class="note" style="margin:0;text-align:center">नया भाव सबके फोन में तुरंत लग जाएगा</p>`}</div>`;
  const I=$("#rnIn");
  $("#sheet").oninput=()=>{const n=num(I.value),m=$("#rnM");if(m&&n>0)m.innerHTML=`खरीद ${rs(cost)} → बिक्री ${rs(n)} · मुनाफ़ा <b style="color:${n>cost?"var(--leaf)":"var(--chili)"}">${Math.round((n-cost)/cost*100)}%</b>`};
  const save=async()=>{const n=r2(num(I.value));if(!(n>0)){toast("नया भाव लिखें");return}if(n===old){closeSheet();return}
    try{if(!S.demo){await S.db.collection("items").doc(it.id).update({sale:n,rateTs:Date.now(),rateBy:S.uid||"",rateByName:biller(),ratePrev:old});
        await S.db.collection("priceLog").doc("r"+Date.now().toString(36)).set({itemId:it.id,name:it.name,field:"sale",old,new:n,ts:Date.now(),by:S.uid||"",byName:biller()})}
      it.sale=n;closeSheet();refreshAfterCart();toast("✏️ "+it.name+": "+rs(old)+" → "+rs(n))}
    catch(e){toast("भाव नहीं बदला: "+(e.code||""))}};
  $("#sheet").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();save()}};
  $("#sheet").onclick=e=>{if(e.target.matches("[data-close]")){closeSheet();return}if(e.target.closest("[data-rnsave]"))save()};
  setTimeout(()=>I.focus(),50);
};
const num=v=>{const n=parseFloat(String(v??"").replace(",","."));return isFinite(n)?n:0};
/* 📈 मालिक: टाइल पर खरीद → बिक्री · मुनाफ़ा % */
SR.marginHTML=function(it,p){
  if(!S.isOwner||it.virtual||!(p>0))return "";const c=window.SF?SF.costOf(it):(+it.cost||0);if(!(c>0))return `<span class="mg">खरीद भाव नहीं</span>`;
  const pct=Math.round((p-c)/c*100);return `<span class="mg ${pct<15?"bad":pct<30?"mid":""}">ख ${rs(c)} · ${pct>=0?"+":""}${pct}%</span>`;
};
const rateSeen={};let rateInit=false;
function rateAlerts(){
  if(!S.isOwner)return;
  S.items.forEach(i=>{if(!i.rateTs)return;const was=rateSeen[i.id];rateSeen[i.id]=i.rateTs;
    if(rateInit&&i.rateTs!==was&&i.rateBy&&i.rateBy!==S.uid)toast("✏️ "+(i.rateByName||"कर्मचारी")+" ने "+i.name+" का भाव "+rs(i.ratePrev||0)+" → "+rs(i.sale)+" किया")});
  rateInit=true;
}
document.addEventListener("click",e=>{
  if(e.target.closest("[data-qwaste]")){SR.wasteSheet();return}
  if(e.target.closest("[data-qkharch]")){SR.kharchSheet();return}
  if(e.target.closest("[data-qnight]")){if(S.billsDate!==today()){toast("रात का स्टॉक आज का ही — दिन का हिसाब में आज की तारीख चुनें");return}if(window.SF&&SF.nightSheet)SF.nightSheet();return}
  if(e.target.closest("[data-qrate]")){S.rateMode=true;S.tab="bill";try{showTab()}catch(x){}try{renderBill()}catch(x){}toast("✏️ अब जिस सामान का भाव बदलना है, उसे दबाएँ");return}
});

/* ======================= 🔒 1 घंटे से ज़्यादा बंद रहा तो PIN (कर्मचारी) ======================= */
const IDLE=60*60000;let lastMark=0;
function markAct(){const n=Date.now();if(n-lastMark<30000)return;lastMark=n;LSx.set("se_act",String(n))}
SR.lockCheck=function(){
  if(S.isOwner||S.demo||!S.uid||document.getElementById("plock"))return;
  const h=LSx.get("se_pinh"),ph=LSx.get("se_pinph"),last=+LSx.get("se_act")||0;
  if(!h||!ph)return;
  if(Date.now()-last<IDLE){markAct();return}
  let pin="",bad=0;const el=document.createElement("div");el.id="plock";el.className="plock";document.body.appendChild(el);
  const draw=(err)=>{el.innerHTML=`<div class="pl-box"><div class="pl-logo">🥬</div><b>सब्ज़ी एक्सप्रेस</b><span>नमस्ते ${esc(biller()||"")} 🙏 — अपना PIN डालें</span>
    <div class="dots ${err?"bad":""}">${[0,1,2,3].map(i=>`<i class="${i<pin.length?"f":""}"></i>`).join("")}</div>${err?`<p class="pl-err">${esc(err)}</p>`:""}
    <div class="pl-keys">${["1","2","3","4","5","6","7","8","9","c","0","b"].map(k=>`<button data-pk="${k}">${k==="c"?"साफ़":k==="b"?"⌫":k}</button>`).join("")}</div>
    <button class="lnk" data-plout>दूसरा व्यक्ति? लॉग-आउट</button></div>`};
  draw();
  el.onclick=async e=>{
    if(e.target.closest("[data-plout]")){SE.logout();return}
    const k=e.target.closest("[data-pk]");if(!k)return;const v=k.dataset.pk;
    if(v==="c")pin="";else if(v==="b")pin=pin.slice(0,-1);else if(pin.length<4)pin+=v;
    draw();
    if(pin.length===4){const ok=(await SE.pinHash(ph,pin))===h;
      if(ok){el.remove();LSx.set("se_act",String(Date.now()));lastMark=Date.now();toast("🙏 स्वागत है")}
      else{bad++;pin="";if(bad>=5){toast("5 बार गलत PIN — दोबारा लॉगिन करें");setTimeout(()=>SE.logout(),1200);return}draw("PIN गलत है ("+bad+"/5)")}}
  };
};
["pointerdown","keydown"].forEach(ev=>document.addEventListener(ev,()=>{if(!document.getElementById("plock"))markAct()},{passive:true,capture:true}));
document.addEventListener("visibilitychange",()=>{if(!document.hidden)SR.lockCheck()});
setInterval(()=>{if(!document.hidden)SR.lockCheck()},60000);

/* ======================= 📒 उधार वसूली ======================= */
SR.remindText=function(p,b){
  const L=(S.ledger||[]).filter(l=>l.partyId===p.id).sort((a,c)=>c.ts-a.ts).slice(0,6);
  const ph=window.SF?SF.orderPh():"";
  return `🙏 नमस्ते ${p.name} जी,\nसब्ज़ी एक्सप्रेस का आपका बाकी हिसाब: *₹${b}*\n━━━━━━━━━━━━\n${L.map(l=>`${fdate(l.date).slice(0,5)} · ${l.type==="udhar"?(l.opening?"पुराना बाकी":"बिल "+(l.billNo||"")):"जमा ✓"} · ₹${l.amt}`).join("\n")}\n━━━━━━━━━━━━\nUPI से भुगतान: ${upiId()}${ph?"\nसवाल हो तो कॉल/WhatsApp: "+SF.fmtPh(ph):""}\nधन्यवाद 🙏`;
};
SR.jamaDone=function(p,amt,mode){
  const b=bal(p.id);if(!p.phone)return;
  const t=`🙏 ${p.name} जी, सब्ज़ी एक्सप्रेस में आपका ₹${amt} ${mode==="upi"?"UPI":"नकद"} जमा हो गया। धन्यवाद!\nअब बाकी: *₹${b}*`;
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="जमा की रसीद"><div class="grab"></div>
  <div class="sh-head"><div><h3>✓ ${rs(amt)} जमा हुए</h3><span class="note">${esc(p.name)} · अब बाकी ${rs(b)}</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <a class="big" style="display:block;text-align:center;text-decoration:none;background:#1f8a4c;color:#fff" target="_blank" rel="noopener" href="${waLink(t,p.phone)}" data-jrc>🟢 ग्राहक को रसीद भेजें</a></div></div>`;
  $("#sheet").onclick=e=>{if(e.target.matches("[data-close]")){closeSheet();return}if(e.target.closest("[data-jrc]"))setTimeout(closeSheet,300)};
};
SR.udharTopHTML=function(){
  const t=today(),L=(S.ledger||[]).filter(l=>l.type==="jama"&&l.date===t);const c=r2(L.filter(l=>l.mode!=="upi").reduce((a,l)=>a+l.amt,0)),u=r2(L.filter(l=>l.mode==="upi").reduce((a,l)=>a+l.amt,0));
  const due=S.parties.map(p=>({p,b:bal(p.id)})).filter(x=>x.b>0&&x.p.phone);
  return `<div class="kpis"><div class="kpi"><span>आज वसूली (नकद)</span><b>${rs(c)}</b></div><div class="kpi blue"><span>आज वसूली (UPI)</span><b>${rs(u)}</b></div></div>
  ${SR.oldUdharBtnHTML()}
  ${due.length?`<button class="big ghost" data-remindall style="margin-bottom:10px">📩 याद दिलाने की सूची (${due.length} लोग)</button>`:""}`;
};
SR.remindAll=function(){
  const due=S.parties.map(p=>({p,b:bal(p.id),age:udharAge(p.id)})).filter(x=>x.b>0&&x.p.phone).sort((a,c)=>c.b-a.b);
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="याद दिलाएँ"><div class="grab"></div>
  <div class="sh-head"><div><h3>📩 बकाया याद दिलाएँ</h3><span class="note">हर नाम पर दबाएँ — WhatsApp में पूरा हिसाब तैयार मिलेगा</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div class="list" style="margin:0">${due.map(x=>`<a class="li" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" data-rem="${esc(x.p.id)}" href="${waLink(SR.remindText(x.p,x.b),x.p.phone)}"><div class="mid"><b>${esc(x.p.name)}</b><span>${esc(x.p.phone)}${x.age!=null?" · "+x.age+" दिन से":""}${x.p.remindTs?" · पिछली याद "+fdate(today(new Date(x.p.remindTs))).slice(0,5):""}</span></div><div class="rt" style="color:var(--chili)">${rs(x.b)}<small>🟢 भेजें</small></div></a>`).join("")}</div></div></div>`;
  $("#sheet").onclick=e=>{if(e.target.matches("[data-close]")){closeSheet();return}const a=e.target.closest("[data-rem]");if(a&&!S.demo)S.db.collection("parties").doc(a.dataset.rem).update({remindTs:Date.now()}).catch(()=>{})};
};
SR.openingHTML=function(p){if(!S.isOwner)return "";return `<details class="nsbox" style="margin-top:12px"><summary>📜 पुराना बाकी जोड़ें (सिर्फ़ मालिक)</summary>
  <div class="row2" style="margin:6px 0 0"><input class="inp" id="obAmt" inputmode="decimal" placeholder="₹ पुराना उधार"><input class="inp" id="obNote" placeholder="जैसे सितंबर तक का"></div>
  <button class="big ghost" data-opbal style="margin-top:6px">+ पुराना बाकी जोड़ें</button></details>`};
SR.saveOpening=async function(p){
  const amt=r2(parseFloat(String(($("#obAmt")||{}).value||"").replace(",","."))||0),note=String(($("#obNote")||{}).value||"").trim();if(!(amt>0)){toast("रकम लिखें");return false}
  const now=Date.now(),id="o"+now.toString(36);const ent={ts:now,date:today(),partyId:p.id,partyName:p.name,type:"udhar",opening:true,note:note||"पुराना बाकी",amt,billNo:"",by:S.uid||"",byName:biller()};
  try{if(S.demo)S.ledger.push({id,...ent});else await S.db.collection("ledger").doc(id).set(ent);if(!S.ledger.find(x=>x.id===id))S.ledger.push({id,...ent});toast("📜 "+p.name+" का पुराना बाकी "+rs(amt)+" जुड़ा");return true}catch(e){toast("नहीं जुड़ा: "+(e.code||""));return false}
};
document.addEventListener("click",e=>{if(e.target.closest("[data-remindall]"))SR.remindAll()});
/* 🔑 मालिक: कर्मचारी का PIN देखें/बदलें */
SR.pinHTML=function(x){return ` <span class="note">🔑 PIN ${x.pin?esc(x.pin):"—"}</span> <button class="lnk" data-pinch="${esc(x.id)}">PIN बदलें</button>`};
document.addEventListener("click",async e=>{const b=e.target.closest("[data-pinch]");if(!b||!S.isOwner)return;const x=(S.staffDocs||[]).find(y=>y.id===b.dataset.pinch);if(!x)return;
  const pin=(prompt(x.name+" का नया 4 अंक का PIN",x.pin||"")||"").trim();if(!pin)return;if(!/^\d{4}$/.test(pin)){toast("PIN 4 अंक का होना चाहिए");return}
  try{toast("⏳ नया PIN लग रहा है…");await SE.addStaff(x.name,x.phone,pin);toast("🔑 "+x.name+" का नया PIN "+pin+" — उन्हें बता दें")}catch(err){toast("नहीं हुआ: "+(err.msg||err.code||err.message||""))}});


/* ======================= 📥 कॉपी वाली पुरानी उधारी (26-10-2026 तक, विक्रम जी की कॉपी से) ======================= */
const OLD_UDHAR=(()=>{const D=(m,a,b)=>{const r=[];for(let d=a;d<=b;d++)r.push(["2026-"+m+"-"+String(d).padStart(2,"0"),140]);return r};
  return [
  {pid:"samosa-shop",name:"समोसा शॉप",al:["समोसा","samosa"],total:4638,rows:[["2026-10-06",460],["2026-10-07",300],["2026-10-10",168],["2026-10-11",525],["2026-10-13",160],["2026-10-15",697],["2026-10-16",300],["2026-10-17",420],["2026-10-18",435],["2026-10-19",148],["2026-10-21",650],["2026-10-22",375]]},
  {pid:"co",name:"CO साहब",eq:["coसाहब","सीओसाहब","co","cosahab","coसाब"],note:"नारियल ₹140 रोज़",total:7340,rows:[["2026-08-31",140],...D("09",1,22),...D("09",24,30),...D("10",1,20),["2026-10-21",340]]},
  {pid:"officers-mess",name:"अफसर मेस",al:["अफसरमेस","अफ़सरमेस","ऑफिसरमेस","ऑफिसर्समेस","officersmess","officermess"],total:2383,rows:[["2026-10-23",1388],["2026-10-24",315],["2026-10-26",680]]},
  {pid:"jco-mess",name:"JCO मेस",al:["jcoमेस","jcomess","जेसीओमेस"],total:15625,rows:[["2026-10-09",490],["2026-10-10",1600],["2026-10-11",1200],["2026-10-12",700],["2026-10-13",910],["2026-10-15",1135],["2026-10-17",3430],["2026-10-20",1625],["2026-10-22",615],["2026-10-23",410],["2026-10-24",3510]]},
  {pid:"ajay-sir",name:"अजय सर",al:["अजयसर","ajaysir","अजय"],total:3319,rows:[["2026-08-21",250],["2026-08-22",80],["2026-08-26",375],["2026-08-31",160],["2026-09-01",145],["2026-09-06",187],["2026-09-11",110],["2026-09-15",125],["2026-09-16",226],["2026-09-19",125],["2026-09-20",80],["2026-09-21",140],["2026-09-22",115],["2026-09-26",176],["2026-09-28",145],["2026-09-30",140],["2026-10-05",260],["2026-10-06",70],["2026-10-07",200],["2026-10-21",210]]}
  ]})();
SR.OLD_UDHAR=OLD_UDHAR;
const opId=(g,r,i)=>"op_"+g.pid+"_"+r[0]+"_"+i;
const nrm=x=>String(x||"").toLowerCase().replace(/[\s.\-_()]/g,"");
/* ऐप में पहले से बना खाता नाम से पहचानो (अलग id वाला भी) */
const findP=(list,g)=>list.find(x=>x.id===g.pid)||list.find(x=>{const n=nrm(x.name);return (g.eq||[]).includes(n)||(g.al||[]).some(a=>n.includes(nrm(a)))});
SR.findOldParty=findP;
const opDone=g=>g.rows.every((r,i)=>(S.ledger||[]).some(l=>l.id===opId(g,r,i)));
SR.oldUdharBtnHTML=function(){if(!S.isOwner)return "";const left=OLD_UDHAR.filter(g=>!opDone(g));if(!left.length)return "";
  return `<button class="big ghost" data-oldud style="margin-bottom:10px;border:2px dashed #7c3aed;color:#6d28d9">📥 कॉपी की पुरानी उधारी ऐप में डालें (${left.length} खाते · ${rs(left.reduce((a,g)=>a+g.total,0))})</button>`};
SR.oldUdharSheet=function(){
  const pick={};OLD_UDHAR.forEach(g=>{pick[g.pid]={};g.rows.forEach((r,i)=>pick[g.pid][i]=r[0]!==today())});
  const draw=()=>{
    $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="पुरानी उधारी"><div class="grab"></div>
    <div class="sh-head"><div><h3>📥 कॉपी की पुरानी उधारी</h3><span class="note">तारीख के हिसाब से हर एंट्री अलग · जो पहले डल चुकी है वह दोबारा नहीं डलेगी</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
    ${OLD_UDHAR.map(g=>{const p=findP(S.parties,g);const done=opDone(g);const sel=g.rows.reduce((a,r,i)=>a+(pick[g.pid][i]?r[1]:0),0);
      return `<details class="oldud" ${done?"":"open"}><summary><b>${esc(g.name)}</b>${g.note?` <span class="note">(${esc(g.note)})</span>`:""} · ${g.rows.length} एंट्री · कॉपी में कुल <b>${rs(g.total)}</b>${done?' <span class="pill green">✓ डल चुकी</span>':""}<br><span class="note">ऐप में अभी बाकी: ${p?rs(bal(p.id)):"खाता नया बनेगा"} · चुनी हुई: ${rs(sel)}</span></summary>
      <div class="oldud-g">${g.rows.map((r,i)=>`<label class="${r[0]===today()?"today":""}"><input type="checkbox" data-odp="${g.pid}" data-odi="${i}" ${pick[g.pid][i]?"checked":""} ${done?"disabled":""}><span>${fdate(r[0]).slice(0,5)}</span><b>${rs(r[1])}</b>${r[0]===today()?'<small>⚠ आज का — ऐप में बिल बना हो तो हटा दें</small>':""}</label>`).join("")}</div></details>`}).join("")}
    <p class="note" style="margin:8px 0">कॉपी के हिसाब से कुल: ${rs(OLD_UDHAR.reduce((a,g)=>a+g.total,0))}</p>
    <button class="big" data-odsave>✓ चुनी हुई एंट्री ऐप में डालें</button></div></div>`;
  };
  draw();
  $("#sheet").onchange=e=>{const c=e.target.closest("[data-odp]");if(c){pick[c.dataset.odp][+c.dataset.odi]=c.checked;const y=$("#sheet .sheet").scrollTop;draw();$("#sheet .sheet").scrollTop=y}};
  $("#sheet").onclick=async e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    if(!e.target.closest("[data-odsave]"))return;
    let n=0,amt=0;
    try{
      for(const g of OLD_UDHAR){
        let p=findP(S.parties,g);
        if(!p){const d={name:g.name,phone:"",qtr:"",ts:Date.now()};if(!S.demo)await S.db.collection("parties").doc(g.pid).set(d,{merge:true});p={id:g.pid,...d};S.parties.push(p)}
        for(const [i,r] of g.rows.entries()){
          if(!pick[g.pid][i])continue;const id=opId(g,r,i);if((S.ledger||[]).some(l=>l.id===id))continue;
          const ent={ts:new Date(r[0]+"T12:00:00").getTime(),date:r[0],partyId:p.id,partyName:p.name,type:"udhar",opening:true,note:"कॉपी से"+(g.note?" · "+g.note:""),amt:r[1],billNo:"",by:S.uid||"",byName:biller()};
          if(!S.demo)await S.db.collection("ledger").doc(id).set(ent);
          if(!S.ledger.find(l=>l.id===id))S.ledger.push({id,...ent});n++;amt+=r[1];
        }
      }
      closeSheet();toast("📥 "+n+" एंट्री डलीं · "+rs(amt));try{renderPane()}catch(x){}
    }catch(err){toast("पूरी नहीं डलीं ("+n+" डलीं): "+(err.code||err.message||"")+" — दोबारा दबाएँ, डली हुई दोबारा नहीं डलेंगी")}
  };
};
document.addEventListener("click",e=>{if(e.target.closest("[data-oldud]"))SR.oldUdharSheet()});
/* नया वर्ज़न: मालिक के फोन पर एक बार अपने-आप सारी पुरानी उधारी तारीख-वार जुड़ जाए।
   जिस दिन का उसी खाते में ऐप-बिल का उधार पहले से है, वह दिन दोबारा नहीं जुड़ता (दोहरा न हो)। */
SR.autoOldUdhar=async function(db){
  if(!S.isOwner||S.demo||!db||SR._oldAuto)return;SR._oldAuto=1;
  try{
    const fr=db.doc("ownerCfg/flags");const f=await fr.get();if(f.exists&&f.data().oldUdhar1)return;
    const [ps,ls]=await Promise.all([db.collection("parties").get(),db.collection("ledger").get()]);
    const parties=ps.docs.map(d=>({id:d.id,...d.data()})),led=ls.docs.map(d=>({id:d.id,...d.data()}));
    let n=0,amt=0;const skip=[];
    /* एक ही बार में (batch) लिखो — फोन पर 97 बार स्क्रीन दोबारा न बने */
    const W=db.batch?db.batch():null;const put=(ref,d,o)=>W?W.set(ref,d,o):ref.set(d,o);const newLed=[];
    for(const g of OLD_UDHAR){
      let p=findP(parties,g);
      if(!p){const d={name:g.name,phone:"",qtr:"",ts:Date.now(),by:S.uid||"",byName:biller()};await put(db.collection("parties").doc(g.pid),d,{merge:true});p={id:g.pid,...d};parties.push(p)}
      for(const [i,r] of g.rows.entries()){
        const id=opId(g,r,i);if(led.some(l=>l.id===id))continue;
        if(led.some(l=>l.partyId===p.id&&l.date===r[0]&&l.type==="udhar"&&!l.opening)){skip.push(g.name+" "+fdate(r[0]).slice(0,5)+" ₹"+r[1]);continue}
        const ent={ts:new Date(r[0]+"T12:00:00").getTime(),date:r[0],partyId:p.id,partyName:p.name,type:"udhar",opening:true,note:"कॉपी से"+(g.note?" · "+g.note:""),amt:r[1],billNo:"",by:S.uid||"",byName:biller()};
        await put(db.collection("ledger").doc(id),ent);led.push({id,...ent});newLed.push({id,...ent});n++;amt+=r[1];
      }
    }
    await put(fr,{oldUdhar1:Date.now(),oldUdharN:n,oldUdharAmt:r2(amt),oldUdharSkip:skip},{merge:true});
    if(W)await W.commit();
    if(n)toast("📥 कॉपी की पुरानी उधारी जुड़ गई: "+n+" एंट्री · "+rs(amt)+(skip.length?" ("+skip.length+" दिन पहले से ऐप में थे)":""));
    try{renderPane()}catch(x){}
  }catch(e){SR._oldAuto=0}
};
/* 📥 03-11: दूसरी किस्त — कमल भाई की रोज़ की कॉपी (13-10 से 02-11) की उधारी, जो विक्रम जी की उधार-किताब (ऊपर, 26-10 तक) में नहीं थी।
   किताब वाले खातों में सिर्फ़ 27-10 के बाद की; बाकी खाते (किताब में नहीं) पूरे। जिस दिन ऐप-बिल का उधार पहले से है, वह दिन नहीं जुड़ता। */
const OLD_UDHAR2=[
  {pid:"officers-mess",name:"अफसर मेस",al:["अफसरमेस","अफ़सरमेस","ऑफिसरमेस","ऑफिसर्समेस","officersmess","officermess"],rows:[["2026-10-28",300],["2026-10-29",1180],["2026-10-30",500],["2026-10-31",220],["2026-11-02",500]]},
  {pid:"jco-mess",name:"JCO मेस",al:["jcoमेस","jcomess","जेसीओमेस"],rows:[["2026-10-27",180],["2026-10-28",1480],["2026-10-30",1010],["2026-11-02",100]]},
  {pid:"samosa-shop",name:"समोसा शॉप",al:["समोसा","samosa"],rows:[["2026-10-27",700]]},
  {pid:"ajay-sir",name:"अजय सर",al:["अजयसर","ajaysir"],rows:[["2026-10-27",180]]},
  {pid:"adm-commander",name:"एडम कमांडर",al:["एडम","admcommander","adamcommander"],rows:[["2026-10-13",470],["2026-10-14",240],["2026-10-16",470],["2026-10-17",460],["2026-10-21",140],["2026-10-22",70],["2026-10-23",360],["2026-10-24",190],["2026-10-25",220],["2026-11-02",535]]},
  {pid:"mh-canteen",name:"MH",eq:["mh","एमएच"],rows:[["2026-10-13",1280],["2026-10-16",240],["2026-10-18",120],["2026-10-19",250],["2026-10-21",100],["2026-10-23",130],["2026-10-27",300],["2026-11-02",350]]},
  {pid:"narpat",name:"नरपत भाई",al:["नरपत","narpat"],note:"अपनी टीम",rows:[["2026-10-22",700]]},
  {pid:"ganesh",name:"गणेश",eq:["गणेश","गणेशभाई","ganesh"],note:"नारियल",rows:[["2026-10-17",60]]},
  {pid:"mamu",name:"मामू",al:["मामू","mamu"],note:"10 नारियल",rows:[["2026-10-21",450]]},
  {pid:"nepali-staff",name:"नेपाली स्टाफ",al:["नेपाली","nepali"],note:"पपीता",rows:[["2026-10-27",100]]},
  {pid:"kesar-ji",name:"केसर जी",al:["केसर","kesar"],note:"अमरूद",rows:[["2026-11-02",25]]}];
OLD_UDHAR2.forEach(g=>g.total=g.rows.reduce((a,r)=>a+r[1],0));
SR.OLD_UDHAR2=OLD_UDHAR2;
SR.autoOldUdhar2=async function(db){
  if(!S.isOwner||S.demo||!db||SR._old2)return;SR._old2=1;
  try{
    const fr=db.doc("ownerCfg/flags");const f=await fr.get();if(f.exists&&f.data().oldUdhar2)return;
    const [ps,ls]=await Promise.all([db.collection("parties").get(),db.collection("ledger").get()]);
    const parties=ps.docs.map(d=>({id:d.id,...d.data()})),led=ls.docs.map(d=>({id:d.id,...d.data()}));
    let n=0,amt=0;const skip=[];
    const W=db.batch?db.batch():null;const put=(ref,d,o)=>W?W.set(ref,d,o):ref.set(d,o);
    for(const g of OLD_UDHAR2){
      let p=findP(parties,g);
      if(!p){const d={name:g.name,phone:"",qtr:"",ts:Date.now(),by:S.uid||"",byName:biller()};await put(db.collection("parties").doc(g.pid),d,{merge:true});p={id:g.pid,...d};parties.push(p)}
      for(const [i,r] of g.rows.entries()){
        const id="o2_"+g.pid+"_"+r[0]+"_"+i;if(led.some(l=>l.id===id))continue;
        if(led.some(l=>l.partyId===p.id&&l.date===r[0]&&l.type==="udhar")){skip.push(g.name+" "+fdate(r[0]).slice(0,5)+" ₹"+r[1]);continue}
        const ent={ts:new Date(r[0]+"T12:00:00").getTime(),date:r[0],partyId:p.id,partyName:p.name,type:"udhar",opening:true,note:"कमल भाई की कॉपी से"+(g.note?" · "+g.note:""),amt:r[1],billNo:"",by:S.uid||"",byName:biller()};
        await put(db.collection("ledger").doc(id),ent);led.push({id,...ent});n++;amt+=r[1];
      }
    }
    await put(fr,{oldUdhar2:Date.now(),oldUdhar2N:n,oldUdhar2Amt:r2(amt),oldUdhar2Skip:skip},{merge:true});
    if(W)await W.commit();
    if(n)toast("📥 कॉपी (13-10 से 02-11) की बाकी उधारी जुड़ी: "+n+" एंट्री · "+rs(amt)+(skip.length?" ("+skip.length+" दिन पहले से ऐप में थे)":""));
    try{renderPane()}catch(x){}
  }catch(e){SR._old2=0}
};
/* 📥 03-11 (विक्रम जी की राय के बाद): पुराने रजिस्टर पेज (26-09 से 04-10) + कॉपी की बची एंट्री; MH = 177 MH वेट कैंटीन;
   एडम कमांडर = वसूली नहीं (रकम छिपी, सिर्फ़ नोट); मनोज जी = मालिक के घर की सब्ज़ी (अलग खाता, रकम छिपी) */
const OLD_UDHAR3=[
  {pid:"officers-mess",name:"अफसर मेस",al:["अफसरमेस","अफ़सरमेस","ऑफिसरमेस","ऑफिसर्समेस","officersmess","officermess"],rows:[["2026-10-27",290,"कमल भाई की कॉपी से"],["2026-09-27",800,"पुराना रजिस्टर पेज"],["2026-10-03",1150,"पुराना रजिस्टर पेज"],["2026-10-04",460,"पुराना रजिस्टर पेज"]]},
  {pid:"jco-mess",name:"JCO मेस",al:["jcoमेस","jcomess","जेसीओमेस"],rows:[["2026-09-27",209],["2026-09-30",900],["2026-10-02",6467],["2026-10-03",1500]].map(r=>[...r,"पुराना रजिस्टर पेज"])},
  {pid:"samosa-shop",name:"समोसा शॉप",al:["समोसा","samosa"],rows:[["2026-09-27",390,"पुराना रजिस्टर पेज"],["2026-10-03",800,"पुराना रजिस्टर पेज"],["2026-10-20",388,"कमल भाई की कॉपी से"]]},
  {pid:"ajay-sir",name:"अजय सर",al:["अजयसर","ajaysir"],rows:[["2026-10-22",40,"कमल भाई की कॉपी से"]]},
  {pid:"adm-commander",name:"एडम कमांडर",al:["एडम","admcommander","adamcommander"],hide:"nopay",rows:[["2026-10-28",620],["2026-10-29",130],["2026-10-30",320]].map(r=>[...r,"कमल भाई की कॉपी से"])},
  {pid:"mh-canteen",name:"177 MH वेट कैंटीन",eq:["mh","एमएच"],rename:true,rows:[["2026-09-26",390],["2026-09-27",490],["2026-09-28",444],["2026-09-30",680],["2026-10-01",130],["2026-10-02",127],["2026-10-03",290]].map(r=>[...r,"पुराना रजिस्टर पेज"]).concat([["2026-10-23",280,"कमल भाई की कॉपी से"]])},
  {pid:"kapil",name:"कपिल बाबूजी (स्टेशन HQ)",eq:["कपिल","कपिलजी","कपिलबाबूजी","kapil"],rename:true,rows:[["2026-09-27",130],["2026-09-28",96],["2026-09-30",182],["2026-10-03",160]].map(r=>[...r,"पुराना रजिस्टर पेज"])},
  {pid:"naresh",name:"नरेश (अपनी टीम)",al:["नरेश","naresh"],rows:[["2026-09-30",140,"पुराना रजिस्टर पेज · नारियल"]]},
  {pid:"guard-line",name:"गार्ड लाइन",al:["गार्डलाइन","guardline"],rows:[["2026-09-27",500,"पुराना रजिस्टर पेज"]]},
  {pid:"kamal-ghar",name:"कमल भाई (घर की सब्ज़ी)",al:["कमलभाई(घर","कमलभाईघर"],rows:[["2026-09-28",550,"पुराना रजिस्टर पेज · कमल भाई ने अपने घर भेजी"]]},
  {pid:"manoj-ghar",name:"मनोज जी (मालिक का घर)",al:["मनोजजी(मालिक","मनोजजी(घर"],hide:"home",rows:[["2026-10-03",167,"पुराना रजिस्टर पेज"],["2026-10-13",540,"कॉपी · 160 + मौसमी 380"],["2026-10-19",800,"कॉपी · घर की सब्ज़ी"],["2026-10-22",295,"कॉपी"],["2026-10-23",200,"कॉपी · सरसों"],["2026-10-30",350,"कॉपी · मौसमी"]]}];
OLD_UDHAR3.forEach(g=>g.total=g.rows.reduce((a,r)=>a+r[1],0));
SR.OLD_UDHAR3=OLD_UDHAR3;
SR.autoOldUdhar3=async function(db){
  if(!S.isOwner||S.demo||!db||SR._old3)return;SR._old3=1;
  try{
    const fr=db.doc("ownerCfg/flags");const f=await fr.get();if(f.exists&&f.data().oldUdhar3)return;
    const [ps,ls]=await Promise.all([db.collection("parties").get(),db.collection("ledger").get()]);
    const parties=ps.docs.map(d=>({id:d.id,...d.data()})),led=ls.docs.map(d=>({id:d.id,...d.data()}));
    let n=0,amt=0;const skip=[];
    const W=db.batch?db.batch():null;const put=(ref,d,o)=>W?W.set(ref,d,o):ref.set(d,o);
    for(const g of OLD_UDHAR3){
      let p=findP(parties,g);
      if(!p){const d={name:g.name,phone:"",qtr:"",ts:Date.now(),by:S.uid||"",byName:biller(),...(g.hide?{hide:g.hide}:{})};await put(db.collection("parties").doc(g.pid),d,{merge:true});p={id:g.pid,...d};parties.push(p)}
      else{const ch={};if(g.rename&&p.name!==g.name){ch.name=g.name;ch.oldName=p.name}if(g.hide&&p.hide!==g.hide)ch.hide=g.hide;
        if(Object.keys(ch).length){await put(db.collection("parties").doc(p.id),ch,{merge:true});Object.assign(p,ch);const sp=(S.parties||[]).find(x=>x.id===p.id);if(sp)Object.assign(sp,ch)}
        if(ch.name)for(const l of led.filter(l=>l.partyId===p.id&&l.partyName!==ch.name)){await put(db.collection("ledger").doc(l.id),{partyName:ch.name},{merge:true});l.partyName=ch.name}}
      for(const [i,r] of g.rows.entries()){
        const id="o3_"+g.pid+"_"+r[0]+"_"+i;if(led.some(l=>l.id===id))continue;
        if(led.some(l=>l.partyId===p.id&&l.date===r[0]&&l.type==="udhar"&&!l.opening&&num(l.amt)===r[1])){skip.push(g.name+" "+fdate(r[0]).slice(0,5)+" ₹"+r[1]);continue}
        const ent={ts:new Date(r[0]+"T12:00:00").getTime(),date:r[0],partyId:p.id,partyName:p.name,type:"udhar",opening:true,note:r[2]||"",amt:r[1],billNo:"",by:S.uid||"",byName:biller()};
        await put(db.collection("ledger").doc(id),ent);led.push({id,...ent});n++;amt+=r[1];
      }
    }
    await put(fr,{oldUdhar3:Date.now(),oldUdhar3N:n,oldUdhar3Amt:r2(amt),oldUdhar3Skip:skip},{merge:true});
    if(W)await W.commit();
    if(n)toast("📥 पुराने पेज + कॉपी की बची उधारी जुड़ी: "+n+" एंट्री · एडम कमांडर और घर का खाता छिपे");
    try{renderPane()}catch(x){}
  }catch(e){SR._old3=0}
};
/* 🔒 मालिक: किसी खाते की रकम छिपाएँ/दिखाएँ (वसूली नहीं, सिर्फ़ नोट) */
document.addEventListener("click",async e=>{const b=e.target.closest("[data-phide]");if(!b||!S.isOwner)return;const p=(S.parties||[]).find(x=>x.id===b.dataset.phide);if(!p)return;
  const v=p.hide?"":"nopay";try{if(!S.demo)await S.db.collection("parties").doc(p.id).set({hide:v},{merge:true});p.hide=v;toast(v?"🔒 "+p.name+" की रकम छिपी — कुल बकाया में नहीं जुड़ेगी":"👁 "+p.name+" की रकम फिर दिखेगी");openParty(p.id);try{renderPane()}catch(x){}}catch(err){toast("नहीं हुआ: "+(err.code||""))}});
/* ✏️ पुरानी (कॉपी वाली) उधार एंट्री बदलें/मिटाएँ — सिर्फ़ मालिक */
SR.opEditBtn=function(l){return S.isOwner?` · <button class="lnk" data-opedit="${esc(l.id)}">✏️ बदलें</button>`:""};
SR.opEditSheet=function(id){
  const l=(S.ledger||[]).find(x=>x.id===id);if(!l||!S.isOwner)return;const pid=l.partyId;let sure=false;
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="पुरानी एंट्री बदलें"><div class="grab"></div>
  <div class="sh-head"><div><h3>✏️ पुरानी उधार एंट्री</h3><span class="note">${esc(l.partyName||"")} · अभी ${fdate(l.date)} · ${rs(l.amt)}</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <div class="row2"><label class="fld">तारीख<input class="inp" type="date" id="oeD" value="${esc(l.date)}"></label><label class="fld">रकम ₹<input class="inp" id="oeA" inputmode="decimal" value="${l.amt}"></label></div>
  <label class="fld">नोट<input class="inp" id="oeN" value="${esc(l.note||"")}"></label>
  <button class="big" data-oesave style="margin-top:8px">💾 बदलाव सेव करें</button>
  <div class="sb-row"><button class="big ghost" data-oeback>← वापस</button><button class="big ghost" data-oedel style="color:var(--chili)">🗑️ एंट्री मिटाएँ</button></div></div></div>`;
  $("#sheet").onclick=async e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    if(e.target.closest("[data-oeback]")){openParty(pid);return}
    const del=e.target.closest("[data-oedel]");
    if(del){if(!sure){sure=true;del.textContent="पक्का मिटाएँ? दोबारा दबाएँ";return}
      try{try{G.okdel.add(id)}catch(x){}if(!S.demo)await S.db.collection("ledger").doc(id).delete();S.ledger=S.ledger.filter(x=>x.id!==id);toast("🗑️ एंट्री मिटाई");openParty(pid);try{renderPane()}catch(x){}}catch(err){toast("नहीं मिटी: "+(err.code||""))}return}
    if(e.target.closest("[data-oesave]")){
      const d=$("#oeD").value,a=r2(parseFloat(String($("#oeA").value).replace(",","."))||0),n=$("#oeN").value.trim();
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){toast("तारीख सही चुनें");return}if(!(a>0)){toast("रकम लिखें");return}
      const ch={date:d,ts:new Date(d+"T12:00:00").getTime(),amt:a,note:n||"पुराना बाकी",editTs:Date.now(),editBy:biller(),prevAmt:l.amt,prevDate:l.date};
      try{if(!S.demo)await S.db.collection("ledger").doc(id).update(ch);Object.assign(l,ch);
        try{if(G.led&&G.led.m[id])Object.assign(G.led.m[id],{fp:fpLed(l),amt:l.amt})}catch(x){}
        toast("✓ एंट्री बदली: "+rs(ch.prevAmt)+" → "+rs(a));openParty(pid);try{renderPane()}catch(x){}}catch(err){toast("नहीं बदली: "+(err.code||""))}}
  };
};
document.addEventListener("click",e=>{const b=e.target.closest("[data-opedit]");if(b){e.stopPropagation();SR.opEditSheet(b.dataset.opedit)}},true);
/* ======================= 🪧 बोर्ड के भाव (01-11-2026) = पक्के बिक्री भाव + नई सब्ज़ियाँ ======================= */
/* मालिक के फोन पर एक बार अपने-आप: जिस सामान का भाव बोर्ड से अलग है वह बदलेगा (priceLog में पुराना→नया दर्ज), नई सब्ज़ियाँ जुड़ेंगी */
const BOARD={date:"2026-11-01",flag:"board1",
  sale:{aloo:20,pyaj:60,tamatar:20,kheera:50,adrak:140,shimla:80,bhindi:80,gajar:70,lauki:30,palak:80,phoolgobhi:60,pattagobhi:50,karela:60,harimirch:120,dhaniya:180,beans:140,mushroom:65,chukandar:70,kundru:40,toroi:80,lahsun:240,baingan:60,sahjan:140,podina:100,karipatta:200,
    kela:50,seb:140,kiwi:100,anar:240,papita:80,tarbooj:50,ananas:100,amrood:110,nariyal:70,gilki:60,makka:60,motimirch:80,mooli:40,kaddu:40,nimbu:200,bhartabaingan:60,kinnu:180,amla:100,chandaliya:80,matar:200},
  add:[{id:"parwal",name:"परवल",unit:"kg",cat:"sabzi",emoji:"🥒",hue:110,sale:90},
    {id:"harapyaj",name:"हरा प्याज",unit:"kg",cat:"patta",emoji:"🧅",hue:100,sale:0,cost:60},
    {id:"moongfali",name:"मूंगफली",unit:"kg",cat:"sabzi",emoji:"🥜",hue:35,sale:0},
    {id:"shakarkand",name:"शकरकंद",unit:"kg",cat:"sabzi",emoji:"🍠",hue:20,sale:0},
    {id:"malta",name:"माल्टा",unit:"kg",cat:"fal",emoji:"🍊",hue:30,sale:0}]};
/* 🪧 02-11-2026: छूटी सब्ज़ियाँ (कमल भाई की कॉपी 13–31 अक्टूबर से) + बचे भाव; "सफल मटर" बंद — सिर्फ़ खुली मटर बिकती है */
const BOARD2={date:"2026-11-02",flag:"board2",src:"विक्रम जी की मंज़ूरी 02-11-2026 (कॉपी के खरीद भाव से)",
  sale:{harapyaj:80,shakarkand:60,malta:180,methi:200,motamirch:80,arbi:70},
  off:["safalmatar"],
  add:[{id:"kachchakela",name:"कच्चा केला",unit:"kg",cat:"sabzi",emoji:"🍌",hue:90,sale:60,cost:40},
    {id:"mausami",name:"मौसमी",unit:"kg",cat:"fal",emoji:"🍋",hue:65,sale:80,cost:60},
    {id:"semfali",name:"सेमफली",unit:"kg",cat:"sabzi",emoji:"🫛",hue:115,sale:90,cost:60},
    {id:"haldi",name:"हल्दी (कच्ची)",unit:"kg",cat:"sabzi",emoji:"🫚",hue:40,sale:150,cost:100},
    {id:"sarson",name:"सरसों (साग)",unit:"kg",cat:"patta",emoji:"🥬",hue:110,sale:100,cost:65},
    {id:"lalaloo",name:"लाल आलू",unit:"kg",cat:"sabzi",emoji:"🥔",hue:12,sale:30,cost:20}]};
/* 💰 02-11-2026: हर सामान का पक्का खरीद भाव (कमल भाई की कॉपी, 13–31 अक्टूबर की आख़िरी खरीद) — संस्था का चालान इसी पर बने, कभी ₹0 या बिक्री भाव पर नहीं */
const COST1={date:"2026-11-02",flag:"cost1",src:"कमल भाई की कॉपी — आख़िरी खरीद भाव (अक्टूबर)",cost:{adrak:57.1,aloo:13,amla:65,amrood:65,ananas:55,anar:170,arbi:45,baingan:40,beans:80,bhartabaingan:40,bhindi:60,chandaliya:100,chukandar:60,dhaniya:80,dragonfruit:180,gajar:54.3,gilki:40,gwarfali:60,haldi:100,harapyaj:60,harimirch:50,kachchakela:40,kaddu:20,karela:40,karipatta:100,kela:36,kheera:30,kinnu:120,kiwi:76.7,kundru:30,lahsun:160,lalaloo:20,lauki:25,makka:35,malta:120,matar:80,mausami:70,methi:100,mooli:20,motamirch:50,motimirch:50,mushroom:50,nariyal:45,nimbu:120,palak:50,papita:50,parwal:80,pattagobhi:14,phoolgobhi:40,podina:50,pyaj:50,sahjan:120,sarson:65,seb:100,semfali:60,shakarkand:40,shimla:54.3,singhada:80,tamatar:8,tarbooj:20,toroi:40}};
/* 02-11: विक्रम जी की 13 फोटो, जो कभी खरीदा नहीं गया वह बंद, और 31-10 की रात का बचा माल = आज (02-11) की शुरुआत */
const PHOTO1={date:"2026-11-02",flag:"photo1",src:"विक्रम जी — फोटो, खरीद-जाँच और शुरुआती स्टॉक",
  photo:["parwal","harapyaj","moongfali","shakarkand","malta","kachchakela","mausami","semfali","haldi","sarson","lalaloo","sitafal","dragonfruit"],
  off:["moongfali","sitafal"],offNote:"13–31 अक्टूबर में कभी खरीदा नहीं गया — खरीदें तब चालू करें",
  stock:{date:"2026-11-01",note:"कमल भाई की कॉपी — 31-10 की रात का बचा माल (शुरुआती स्टॉक)",items:{seb:5,anar:7,amrood:7,malta:2.5,kiwi:15,nariyal:12,tarbooj:5,kaddu:15,kheera:5,bhindi:2.5,kela:7,adrak:1.5,lauki:3,harimirch:1,phoolgobhi:2,pattagobhi:2.5,nimbu:2.5,palak:2,makka:2,matar:2.5,gajar:1.5,shimla:1.7}}};
/* 03-11: कमल भाई की कॉपी (02-11) — रात का बचा माल + खराबी ऐप में, और कॉपी का पूरा हिसाब मिलान के लिए */
const COPY1={date:"2026-11-02",flag:"copy1",src:"कमल भाई की कॉपी 02-11 (विक्रम जी की भेजी फोटो)",
  night:{date:"2026-11-02",by:"कॉपी से (Claude) · विक्रम जी",
    items:{amrood:2,seb:2,kiwi:10,nariyal:6,tarbooj:4,papita:3,pyaj:12,aloo:30,phoolgobhi:3,pattagobhi:2,gajar:0.5,beans:0.5,nimbu:2,chukandar:1,kheera:7,kaddu:3,anar:2,malta:1.5,shimla:0.5,sahjan:0.3},
    zero:["tamatar","kela","dhaniya","adrak","harimirch","motimirch","bhindi","lauki","matar","palak","makka","podina"],
    waste:{papita:2.5,matar:3,aloo:2,harimirch:3,seb:1,amrood:1,kaddu:2,gajar:0.5,tamatar:2,kela:3}},
  copy:{day:{type:"sabji-copy",date:"2026-11-02",
    kharid:[{name:"खीरा",qty:30,unit:"kg",rate:30,amount:900},{name:"धनिया",qty:5,unit:"kg",rate:50,amount:250},{name:"पोदीना",qty:1,unit:"kg",rate:50,amount:50},{name:"टमाटर",qty:30,unit:"kg",rate:15,amount:450},{name:"प्याज",qty:29.5,unit:"kg",rate:50,amount:1480},{name:"आलू",qty:53,unit:"kg",rate:13,amount:690},{name:"केला",qty:20,unit:"kg",rate:32.5,amount:650},{name:"पपीता",qty:8.5,unit:"kg",rate:50,amount:420},{name:"फूलगोभी",qty:8,unit:"kg",rate:35,amount:280},{name:"पत्तागोभी",qty:6,unit:"kg",rate:25,amount:150},{name:"गाजर",qty:3.5,unit:"kg",rate:54,amount:188},{name:"अदरक",qty:3.5,unit:"kg",rate:60,amount:210},{name:"निम्बू",qty:3,unit:"kg",rate:90,amount:270},{name:"बिन्स",qty:2,unit:"kg",rate:90,amount:180},{name:"मोटी मिर्च",qty:1,unit:"kg",rate:50,amount:50},{name:"G4",qty:5,unit:"kg",rate:50,amount:250},{name:"शिमला",qty:2.5,unit:"kg",rate:48,amount:120},{name:"चुकंदर",qty:1.5,unit:"kg",rate:40,amount:60}],
    kharidTotalWritten:6700,
    sanstha:[{to:"मारवाड़ रसोई",name:"खीरा",qty:5,unit:"kg",amount:150},{to:"मारवाड़ रसोई",name:"मोटी मिर्च",qty:1,unit:"kg",amount:50},{to:"मारवाड़ रसोई",name:"निम्बू",qty:1,unit:"kg",amount:90},{to:"मारवाड़ रसोई",name:"अदरक",qty:1,unit:"kg",amount:60},{to:"मारवाड़ रसोई",name:"धनिया",qty:1,unit:"kg",amount:50},{to:"मारवाड़ रसोई",name:"फूलगोभी",qty:2,unit:"kg",amount:70},{to:"मारवाड़ रसोई",name:"खीरा",qty:5,unit:"kg",amount:150}],
    sale:{online:6665,cash:2150,udhar:[{name:"अफसर मेस",amount:500},{name:"JCO मेस",amount:100},{name:"MH",amount:350},{name:"एडम कमांडर",amount:535},{name:"केसर जी (अमरूद)",amount:25}],totalWritten:10325,bachatWritten:4245},
    kharch:[{what:"टैक्सी किराया (MH)",amount:250}],
    unclear:["प्याज का वज़न कॉपी में 20½ जैसा लिखा, ऐप में 29.5 kg — रकम ₹1,480 (ऐप ₹1,475)","गाजर से चुकंदर तक 8 लाइनों का जोड़ ₹1,328, ब्रैकेट में ₹1,380 लिखा (+₹52)","केला का वज़न कॉपी में नहीं — ऐप में 20 kg","धनिया: कॉपी 5 kg ₹250 + पोदीना ₹50, ऐप में धनिया 6 kg ₹450","तरबूज '4' — kg या नग साफ़ नहीं"]},
   night:{type:"sabji-night",date:"2026-11-02",night:[],kharab:[],unclear:[]}}};
const HN={amrood:"अमरूद",seb:"सेब",kiwi:"कीवी",nariyal:"नारियल",tarbooj:"तरबूज",papita:"पपीता",pyaj:"प्याज",aloo:"आलू",phoolgobhi:"फूलगोभी",pattagobhi:"पत्तागोभी",gajar:"गाजर",beans:"बिन्स",nimbu:"निम्बू",chukandar:"चुकंदर",kheera:"खीरा",kaddu:"कद्दू",anar:"अनार",malta:"नारंगी",shimla:"शिमला",sahjan:"सहजन",matar:"मटर",harimirch:"मिर्ची",tamatar:"टमाटर",kela:"केला"};
COPY1.copy.night.night=Object.entries(COPY1.night.items).map(([id,q])=>({name:HN[id]||id,qty:q,unit:["kiwi","nariyal"].includes(id)?"pc":"kg"}));
COPY1.copy.night.kharab=Object.entries(COPY1.night.waste).map(([id,q])=>({name:HN[id]||id,qty:q,unit:"kg"}));
/* 04-11: कमल भाई की कॉपी (03-11) — रात का बचा माल, छूटी 2 खरीद (पपीता, सेब) और कॉपी का पूरा हिसाब मिलान के लिए.
   टमाटर/धनिया/केला/गाजर/मूली/मक्का/माल्टा कॉपी में नहीं लिखे पर ऐप के हिसाब से काफ़ी बचना चाहिए था — इन्हें 0 नहीं लिखा (विक्रम जी से पूछा) */
const COPY2={date:"2026-11-03",flag:"copy2",src:"कमल भाई की कॉपी 03-11 (विक्रम जी की भेजी फोटो)",
  night:{date:"2026-11-03",by:"कॉपी से (Claude) · विक्रम जी",
    items:{seb:8,amrood:2,papita:4,tarbooj:1.5,anar:0.5,kiwi:7,aloo:4,phoolgobhi:4.5,pattagobhi:10,lauki:3,harimirch:1,kaddu:1.5,nariyal:15,shakarkand:5,beans:3.5,shimla:2.5,amla:1,adrak:2,chukandar:1.5,lahsun:2,pyaj:2,chandaliya:1,palak:1,methi:0.5},
    names:{"मोटी मिर्च":0.5},zeroNames:["बड़ी मिर्च"],
    zero:["kheera","bhindi","matar","nimbu","sahjan","karipatta"],waste:{}},
  buy:[{id:"cp2_0311_papita",itemId:"papita",name:"पपीता",qty:7,rate:50,pay:"galla",note:"कमल भाई की कॉपी 03-11 की लाइन 3 — ऐप में चढ़ी नहीं थी। नकद/ऑनलाइन पक्का करें"},
       {id:"cp2_0311_seb",itemId:"seb",name:"सेब",qty:16.6,rate:90,amt:1500,pay:"vikram",note:"कमल भाई की कॉपी 03-11 की लाइन 6 — ऐप में चढ़ी नहीं थी। ऑनलाइन माना, पक्का करें"}],
  copy:{day:{type:"sabji-copy",date:"2026-11-03",
    kharid:[["अमरूद",23.5,"kg",45,1060],["केला",20,"kg",32.5,650],["पपीता",7,"kg",50,350],["नारियल",19,"pc",45,850],["सेब",16.6,"kg",90,1500],["टमाटर",28,"kg",15,420],["पत्तागोभी",20,"kg",14,280],["खीरा",30,"kg",15,450],["मेथी",2.5,"kg",80,200],["चंदलिया",2,"kg",100,200],["पालक",2,"kg",30,60],["पालक",4,"kg",40,160],["मूली",5,"kg",15,75],["धनिया",6,"kg",33,200],["गाजर",6,"kg",45,270],["हरी मिर्च",5,"kg",60,300],["बीन्स",3,"kg",90,270],["अदरक",5.5,"kg",60,330],["शिमला मिर्च",3,"kg",45,135],["लौकी",4,"kg",20,80],["स्वीट कॉर्न",4,"kg",35,140],["आंवला",2,"kg",60,120],["चुकंदर",2.5,"kg",50,125],["फूलगोभी",8,"kg",25,200],["भिंडी",4,"kg",40,160],["मोटी मिर्च",2,"kg",50,100],["मटर",3,"kg",150,450],["शकरकंद",6,"kg",45,270]].map(([name,qty,unit,rate,amount])=>({name,qty,unit,rate,amount,shop:""})),
    kharidTotalWritten:9385,
    sanstha:[["177 MH कैंटीन","खीरा",3,90],["177 MH कैंटीन","केला",4,144],["177 MH कैंटीन","अदरक",0.5,35],["177 MH कैंटीन","हरी मिर्च",0.5,25],["177 MH कैंटीन","टमाटर",3,45],
      ["रामविनायक डोसा","कद्दू",2,40],["रामविनायक डोसा","सहजन",0.2,24],["रामविनायक डोसा","लौकी",0.5,10],["रामविनायक डोसा","गाजर",0.3,15],["रामविनायक डोसा","आलू",3,39],
      ["15 भैरव (जसाई)","पत्तागोभी",5,100],["15 भैरव (जसाई)","बड़ी मिर्च",1,50],["15 भैरव (जसाई)","अदरक",0.25,20],["15 भैरव (जसाई)","धनिया",0.5,17],["15 भैरव (जसाई)","गाजर",0.5,25],
      ["मारवाड़ रसोई","खीरा",7,210],["मारवाड़ रसोई","धनिया",1,34]].map(([to,name,qty,amount])=>({to,name,qty,unit:"kg",amount})),
    sale:{online:7201,cash:1300,udhar:[{name:"कपिल बाबूजी (स्टेशन HQ)",amount:270},{name:"JCO मेस",amount:1565},{name:"समोसा शॉप",amount:60},{name:"एडम कमांडर",amount:140}],totalWritten:10529,bachatWritten:1538},
    kharch:[{what:"टैक्सी किराया (अभी बाकी)",amount:200}],
    unclear:["खरीद लाइनों का जोड़ ₹9,405, कॉपी में ₹9,385 लिखा (−₹20)","खीरा: कॉपी 30 kg×15, ऐप 15 kg×30 (रकम ₹450 दोनों में) — रात का स्टॉक ऐप वाला सही दिखाता है","बड़ी मिर्च (कॉपी) = मोटी मिर्च (ऐप की खरीद) — ऐप में ये दो अलग सामान बने हैं","जसाई: प्याज 5 kg कॉपी में काटा हुआ, पर ऐप के बिल SE-NSXQ9D में है","जसाई: शिमला 1 kg (SE-4CB77C) कॉपी में नहीं","भुगतान: ऑनलाइन ₹7,235 + नकद ₹2,150 (₹200 टैक्सी किराया बाकी)","लहसुन 3 kg ₹525 कमल भाई ने 'मेरे पास सब्ज़ी' में जोड़ा — ऐप में कोई खरीद नहीं","कीवी '7 पैकेट' लिखा — 7 नग माना","फूलगोभी '4.5 kg / 5 kg' दोनों लिखे — 4.5 माना"]},
   night:{type:"sabji-night",date:"2026-11-03",night:[],kharab:[],unclear:["टमाटर, धनिया, केला, गाजर, मूली, मक्का, माल्टा रात की सूची में नहीं — ऐप के हिसाब से बचने चाहिए थे"]}}};
{const U={kiwi:"pc",nariyal:"pc"},H={seb:"सेब",amrood:"अमरूद",papita:"पपीता",tarbooj:"तरबूज",anar:"अनार",kiwi:"कीवी",aloo:"आलू",phoolgobhi:"फूलगोभी",pattagobhi:"पत्तागोभी",lauki:"लौकी",harimirch:"हरी मिर्च",kaddu:"कद्दू",nariyal:"नारियल",shakarkand:"शकरकंद",beans:"बीन्स",shimla:"शिमला मिर्च",amla:"आंवला",adrak:"अदरक",chukandar:"चुकंदर",lahsun:"लहसुन",pyaj:"प्याज",chandaliya:"चंदलिया",palak:"पालक",methi:"मेथी"};
  COPY2.copy.night.night=Object.entries(COPY2.night.items).map(([id,q])=>({name:H[id]||id,qty:q,unit:U[id]||"kg"})).concat([{name:"बड़ी मिर्च",qty:0.5,unit:"kg"}]);}
/* 13-11: ❄️ सर्दी का नया माल — जो सब्ज़ी/फल नवंबर–फ़रवरी में आते हैं पर ऐप में नहीं थे. बंद (active:false) जुड़ते हैं, भाव खाली —
   मालिक "🌱 मौसम का माल" कार्ड (दिन → 📦 माल) से कमल भाई को खरीदने को कहें, माल आए तो ▶ चालू करें + भाव डालें. पुराना कुछ नहीं बदलता */
const WN=(id,name,cat,emoji,hue,mon,tip,unit)=>({id,name,unit:unit||"kg",cat,emoji,hue,sale:0,active:false,season:"winter",seasonMon:mon,seasonTip:tip});
const WINTER1={date:"2026-11-13",flag:"winter1",src:"सर्दी का नया माल (13-11-2026)",
  add:[WN("bathua","बथुआ","patta","🌿",120,"नवं–फ़र","रायता/पराठे का साग — पालक के साथ रखें"),
    WN("soya","सुवा (सोया) भाजी","patta","🌿",130,"नवं–फ़र","मेथी-पालक के साथ बिकती है"),
    WN("haralahsun","हरा लहसुन","patta","🧄",100,"दिसं–फ़र","गड्डी में — सर्दी की ख़ास माँग"),
    WN("harachana","हरा चना (छोलिया)","sabzi","🫛",105,"दिसं–फ़र","छिला/बिना छिला — जल्दी बिकता है"),
    WN("mogri","मोगरी (मूली की फली)","sabzi","🫛",115,"नवं–जन","राजस्थान की सर्दी की सब्ज़ी"),
    WN("shalgam","शलगम","sabzi","🟣",300,"नवं–फ़र","फौजी परिवारों (पंजाब/उत्तर) में माँग"),
    WN("ganthgobhi","गांठ गोभी","sabzi","🥬",95,"नवं–फ़र","कश्मीरी/उत्तर के ग्राहक लेते हैं"),
    WN("broccoli","ब्रोकली","sabzi","🥦",125,"नवं–फ़र","अफसर मेस / JCO लाइन — कम मात्रा से शुरू"),
    WN("lalpattagobhi","लाल पत्तागोभी","sabzi","🥬",320,"नवं–फ़र","सलाद के लिए — 2-3 नग से शुरू"),
    WN("suran","जिमीकंद (सूरन)","sabzi","🟤",30,"अक्टू–जन","टिकाऊ — खराब कम होता है"),
    WN("ratalu","रतालू","sabzi","🟣",285,"नवं–फ़र","टिकाऊ — गुजराती/राजस्थानी सब्ज़ी"),
    WN("kamalkakdi","कमल ककड़ी","sabzi","⚪",40,"अक्टू–फ़र","कभी-कभी — माँग पूछकर लाएँ"),
    WN("ber","बेर","fal","🟢",85,"दिसं–फ़र","सस्ता फल — बच्चों/जवानों में ख़ूब बिकता है"),
    WN("santra","संतरा","fal","🍊",30,"नवं–फ़र","नागपुरी — कीनू से पहले/साथ"),
    WN("angoor","अंगूर","fal","🍇",280,"दिसं–मार्च","हरा/काला — नाज़ुक, कम लाएँ"),
    WN("strawberry","स्ट्रॉबेरी (डिब्बा)","fal","🍓",350,"दिसं–फ़र","डिब्बे में — अफसर मेस / परिवार","pc"),
    WN("cheeku","चीकू","fal","🟤",25,"नवं–मार्च","पका ही लाएँ"),
    WN("nashpati","नाशपाती","fal","🍐",75,"नवं–दिसं","सेब के साथ"),
    WN("khajoor","खजूर (पिंड)","fal","🟤",20,"नवं–फ़र","सर्दी में माँग — खराब नहीं होता"),
    WN("ganna","गन्ना (टुकड़े)","fal","🎋",110,"दिसं–फ़र","मकर संक्रांति के आसपास")]};
/* 14-11: गाड़ी के बोर्ड की नई फोटो (विक्रम जी: "जो भाव बोर्ड पर लिखे हैं वह कर दो") — सिर्फ़ ये 18 बिक्री भाव बदलते हैं.
   बोर्ड की "SAFAL MATAR" लाइन = रेगुलर मटर (स्थाई नियम); मटर/अनानास/नींबू का अंक फोटो में साफ़ नहीं — वे नहीं छुए. खाली लाइनों के पुराने भाव वही */
const BOARD3={date:"2026-11-14",flag:"board3",src:"गाड़ी का बोर्ड 14-11-2026 (विक्रम जी की भेजी फोटो)",
  sale:{harimirch:180,toroi:40,adrak:160,dhaniya:200,kiwi:120,chandaliya:100,palak:60,tamatar:30,gajar:80,lauki:40,seb:150,bhindi:70,pattagobhi:40,kundru:30,papita:70,amrood:100,nariyal:60,mushroom:70}};
const PACKS=[BOARD,BOARD2,COST1,PHOTO1,COPY1,COPY2,WINTER1,BOARD3];
SR.BOARD=BOARD;SR.PACKS=PACKS;
SR.applyBoard=async function(db){
  if(!S.isOwner||S.demo||!db||SR._board)return;SR._board=1;
  try{
    const fr=db.doc("ownerCfg/flags");
    for(const P of PACKS){
      const f=await fr.get();if(f.exists&&f.data()[P.flag])continue;
      const q=await db.collection("items").get();const items=q.docs.map(d=>({id:d.id,...d.data()}));
      const W=db.batch?db.batch():null;const put=(ref,d,o)=>W?W.set(ref,d,o):ref.set(d,o);const upd=(ref,d)=>W?W.update(ref,d):ref.update(d);
      const now=Date.now(),src=P.src||"बोर्ड के भाव 01-11-2026";const ch=[];let add=0,off=0;
      for(const [id,sale] of Object.entries(P.sale||{})){const it=items.find(x=>x.id===id);if(!it||+it.sale===sale)continue;
        ch.push(it.name+" ₹"+(+it.sale||0)+"→₹"+sale);
        await upd(db.collection("items").doc(id),{sale,ratePrev:+it.sale||0,rateTs:now,rateBy:S.uid||"",rateByName:"विक्रम जी (बोर्ड)",saleSet:{date:P.date,src}});
        await put(db.collection("priceLog").doc("rb"+id+now.toString(36)),{itemId:id,name:it.name,field:"sale",old:+it.sale||0,new:sale,ts:now,by:S.uid||"",byName:"विक्रम जी (बोर्ड)",note:src})}
      for(const [id,cost] of Object.entries(P.cost||{})){const it=items.find(x=>x.id===id);if(!it||+it.cost===cost)continue;
        ch.push(it.name+" खरीद ₹"+(+it.cost||0)+"→₹"+cost);
        await upd(db.collection("items").doc(id),{cost,lastBuy:{date:P.date,rate:cost,note:src}});
        await put(db.collection("priceLog").doc("rc"+id+now.toString(36)),{itemId:id,name:it.name,field:"cost",old:+it.cost||0,new:cost,ts:now,by:S.uid||"",byName:"विक्रम जी",note:src})}
      for(const id of (P.off||[])){const it=items.find(x=>x.id===id);if(it&&it.active!==false){await upd(db.collection("items").doc(id),{active:false,offNote:(P.offNote||"बिकता नहीं")+" — "+P.date});off++}}
      let ph=0;for(const id of (P.photo||[])){const it=items.find(x=>x.id===id);if(it&&!it.photo){await upd(db.collection("items").doc(id),{photo:"b"});ph++}}
      let cpn=0;if(P.night){const ref=db.doc("days/"+P.night.date+"/meta/stock");const cur=await ref.get();const D0=cur.exists?cur.data():{};const I={...(D0.items||{})};const wl=(D0.wlog||[]).slice();const by=P.night.by;
        const has=id=>I[id]&&I[id].close!==undefined&&I[id].close!=="";
        Object.entries(P.night.items).forEach(([id,q])=>{if(!items.find(x=>x.id===id)||has(id))return;I[id]={...(I[id]||{}),close:q,closeBy:by,closeTs:now,src:"copy"};cpn++});
        const byN=n=>{const x=items.find(i=>String(i.name||"").trim()===n);return x?x.id:null};
        Object.entries(P.night.names||{}).forEach(([n,q])=>{const id=byN(n);if(!id||has(id))return;I[id]={...(I[id]||{}),close:q,closeBy:by,closeTs:now,src:"copy"};cpn++});
        (P.night.zeroNames||[]).forEach(n=>{const id=byN(n);if(!id||has(id))return;I[id]={...(I[id]||{}),close:0,closeBy:by+" (मोटी मिर्च में गिना)",closeTs:now,src:"copy"};cpn++});
        (P.night.zero||[]).forEach(id=>{if(!items.find(x=>x.id===id)||has(id))return;I[id]={...(I[id]||{}),close:0,closeBy:by+" (सूची में नहीं = खत्म)",closeTs:now,src:"copy"};cpn++});
        Object.entries(P.night.waste||{}).forEach(([id,q])=>{const it=items.find(x=>x.id===id);if(!it||num(I[id]&&I[id].waste)>0)return;I[id]={...(I[id]||{}),waste:q,wasteSrc:"copy"};wl.push({id,name:it.name,unit:it.unit,qty:q,reason:"कॉपी में खराब लिखा",ts:now,by:S.uid||"",byName:by})});
        await put(ref,{items:I,wlog:wl,nightBy:D0.nightBy||by,nightTs:D0.nightTs||now,nightSrc:"copy",ts:now,by:S.uid||"",byName:"विक्रम जी"},{merge:true});
        if(P.copy)await put(db.doc("days/"+P.date+"/meta/copy"),{...P.copy,ts:now,by:"विक्रम जी (Claude से)"},{merge:true});}
      let nb=0;for(const B of (P.buy||[])){const ref=db.collection("purchases").doc(B.id);const g=await ref.get();if(g.exists)continue;const it=items.find(x=>x.id===B.itemId);
        const amt=r2(B.amt||B.qty*B.rate),ts=new Date(P.date+"T22:50:00+05:30").getTime()+nb;
        await put(ref,{date:P.date,ts,late:true,by:S.uid||"",byName:"विक्रम जी (कॉपी से)",supId:"",supName:"कॉपी से — दुकान नहीं लिखी",supPhone:"",
          lines:[{id:it?it.id:"",name:it?it.name:B.name,unit:it?it.unit:"kg",qty:B.qty,rate:B.rate,amt,billAmt:amt,prev:it?num(it.cost):0}],gross:amt,disc:0,total:amt,pay:B.pay,paid:B.pay==="udhar"?0:amt,due:B.pay==="udhar"?amt:0,note:B.note,photos:[],photoPending:0,cancelled:false,src:"copy"});nb++}
      let stk=0;if(P.stock){const ref=db.doc("days/"+P.stock.date+"/meta/stock");const cur=await ref.get();const I=(cur.exists&&cur.data().items)||{};
        if(!Object.values(I).some(o=>o&&o.close!==undefined&&o.close!=="")){const items2={...I};for(const [id,q] of Object.entries(P.stock.items)){if(!items.find(x=>x.id===id))continue;items2[id]={...(I[id]||{}),close:q,closeBy:"विक्रम जी",closeTs:now,closeNote:P.stock.note};stk++}
          await put(ref,{items:items2,nightBy:"विक्रम जी",nightTs:now,openNote:P.stock.note,ts:now,by:S.uid||"",byName:"विक्रम जी"},{merge:true})}}
      let ord=Math.max(0,...items.map(i=>+i.order||0));
      for(const a of (P.add||[])){if(items.some(x=>x.id===a.id||String(x.name||"").replace(/\s*\(.*\)/,"").trim()===a.name.replace(/\s*\(.*\)/,"").trim()))continue;
        const d={active:a.active!==false,...(a.season?{season:a.season,seasonMon:a.seasonMon||"",seasonTip:a.seasonTip||"",offNote:"मौसम का माल — खरीदें तब चालू करें"}:{}),name:a.name,unit:a.unit,cat:a.cat,emoji:a.emoji,hue:a.hue,sale:a.sale,cost:a.cost||0,order:++ord,photo:"",buyHist:a.cost?[{date:P.date,rate:a.cost,src:"कमल भाई की कॉपी (अक्टूबर)"}]:[],saleSet:{date:P.date,src:a.sale?src:"भाव बाकी — विक्रम जी बताएँगे"}};
        await put(db.collection("items").doc(a.id),d);add++}
      await put(fr,{[P.flag]:now,[P.flag+"Changed"]:ch,[P.flag+"Added"]:add},{merge:true});
      if(W)await W.commit();
      if(cpn||nb){toast("🌙 "+fdate(P.night.date)+" का रात का बचा माल ("+cpn+" सब्ज़ी)"+(nb?" + "+nb+" छूटी खरीद":"")+" ऐप में चढ़ी — कॉपी से");if(nb&&window.SF&&SF.livePurch&&S.billsDate===P.date&&typeof renderDay==="function")setTimeout(()=>{try{renderDay()}catch(e){}},800);if(dayAdd(S.billsDate||today(),-1)===P.night.date)db.doc("days/"+P.night.date+"/meta/stock").get().then(x=>{S.prevStock=(x.exists&&x.data().items)||{};if(S.tab==="day"&&typeof renderDay==="function")renderDay()}).catch(()=>{});if(S.billsDate===P.date&&window.SF)SF.loadCopy(P.date);continue}
      if(ph||stk){toast("📸 "+ph+" फोटो लगीं"+(off?" · "+off+" सामान बंद (कभी खरीदा नहीं)":"")+(stk?" · 📦 "+stk+" सब्ज़ियों का शुरुआती स्टॉक चढ़ा":""));if(stk&&dayAdd(S.billsDate||today(),-1)===P.stock.date)db.doc("days/"+P.stock.date+"/meta/stock").get().then(x=>{S.prevStock=(x.exists&&x.data().items)||{};if(S.tab==="day"&&typeof renderDay==="function")renderDay()}).catch(()=>{});continue}
      if(ch.length||add||off)toast((P.cost?"💰 खरीद भाव पक्के: ":"🪧 "+P.date.slice(8)+"-"+P.date.slice(5,7)+" के भाव: ")+ch.length+" बदले · "+add+" नई सब्ज़ी"+(off?" · "+off+" बंद":""));
    }
  }catch(e){SR._board=0}
};
/* 🏢 03-11: मुकेश भाई ने अपनी ही संस्थाओं को माल "उधार" (बिक्री भाव) में दिया — विक्रम जी के आदेश पर संस्था चालान (खरीद भाव) में बदलें।
   उस दिन की मंडी खरीद चढ़ने के बाद ही चलता है (ताकि उसी दिन का असली खरीद भाव लगे); पुराना पूरा बिल bill.instConv.from में सुरक्षित, उधार एंट्री हटती है */
const INST1={flag:"inst1",date:"2026-11-03",src:"विक्रम जी का आदेश 03-11: अपनी संस्था का माल उधार नहीं — खरीद भाव पर चालान",
  bills:[["SE-79K9BE","रसोई"],["SE-H1GBDX","डोसा"],["SE-NSXQ9D","भैरव"],["SE-4CB77C","भैरव"],["SE-JYPDHZ","MH"]]};
SR.INST1=INST1;
SR.applyInst=async function(db,P){
  P=P||INST1;if(!S.isOwner||S.demo||!db||SR._inst||SR._instDone)return;SR._inst=1;
  try{
    const fr=db.doc("ownerCfg/flags");const f=await fr.get();if(f.exists&&f.data()[P.flag]){SR._instDone=1;return}
    const pq=await db.collection("purchases").where("date","==",P.date).get();
    const purch=pq.docs.map(d=>({id:d.id,...d.data()})).filter(p=>!p.cancelled);
    let night=false;try{const m=await db.doc("days/"+P.date+"/meta/stock").get();night=!!(m.exists&&m.data().nightTs)}catch(e){}
    const ready=P.force||today()>P.date||(purch.length&&(night||new Date().getHours()>=21));
    if(!ready)return;
    const endTs=new Date(P.date+"T23:59:59+05:30").getTime();
    const costFor=id=>{let q=0,a=0;purch.forEach(p=>(p.lines||[]).forEach(l=>{if(l.id===id){q+=num(l.qty);a+=num(l.amt)}}));if(q>0&&a>0)return r2(a/q);
      let best=null;(S.purchHist||[]).forEach(p=>{if(p.cancelled||p.ts>endTs)return;(p.lines||[]).forEach(l=>{if(l.id===id&&num(l.rate)>0&&(!best||p.ts>best.ts))best={rate:num(l.rate),ts:p.ts}})});
      if(best)return best.rate;const it=item(id);if(it&&it.lastBuy&&num(it.lastBuy.rate)>0)return num(it.lastBuy.rate);return it?num(it.cost):0};
    const IN=insts(),now=Date.now(),out=[];
    const lt=l=>l.name+" "+fq(l.qty,l.unit)+"×₹"+l.rate;
    for(const [no,key] of P.bills){
      const ref=db.doc("days/"+P.date+"/bills/"+no);const g=await ref.get();if(!g.exists)continue;const b=g.data();
      if(b.mode==="inst"||b.cancelled||b.instConv)continue;
      const inst=IN.find(n=>n.includes(key))||key;
      const from={mode:b.mode||"",partyId:b.partyId||"",partyName:b.partyName||"",total:num(b.total),sub:num(b.sub),cost:num(b.cost),disc:num(b.disc),pay:b.pay||{},payMode:b.payMode||"",lines:b.lines||[]};
      const lines=(b.lines||[]).map(l=>{const sale=num(l.rate),pr=costFor(l.id),rate=pr>0?r2(pr):sale;
        const n={...l,saleRate:sale,rate,board:rate,cost:rate,changed:false,amt:l.free?0:r2(num(l.qty)*rate)};if(!(pr>0))n.noCost=true;return n});
      const tot=r2(lines.reduce((a,l)=>a+num(l.amt),0));
      const nb={...b,mode:"inst",partyId:"",partyName:inst,lines,sub:tot,total:tot,cost:tot,disc:0,
        saleTotal:r2(lines.reduce((a,l)=>a+(l.free?0:num(l.qty)*num(l.saleRate)),0)),pay:{cash:0,upi:0,udhar:0},payMode:"inst",rateChanged:false,instRate:"purchase",settled:true};
      const ed={ts:now,by:S.uid||"",byName:"विक्रम जी",before:from.lines.map(lt).join(", "),after:lines.map(lt).join(", "),
        diff:"उधार खाता \""+from.partyName+"\" (बिक्री भाव ₹"+from.total+") → संस्था चालान "+inst+" (खरीद भाव ₹"+tot+")",totalBefore:from.total,totalAfter:tot,note:P.src};
      nb.edits=[...(b.edits||[]),ed];nb.editCount=num(b.editCount)+1;
      nb.instConv={ts:now,by:S.uid||"",src:P.src,from,fp:typeof fpBill==="function"?fpBill(nb):""};
      await ref.set(nb);
      if(num(from.pay.udhar)>0){try{G.okdel.add(no)}catch(x){}try{await db.doc("ledger/"+no).delete()}catch(x){}S.ledger=(S.ledger||[]).filter(l=>l.id!==no)}
      const i=(S.dayBills||[]).findIndex(x=>x.no===no);if(i>-1&&S.billsDate===P.date)S.dayBills[i]=nb;
      out.push({no,from:from.partyName,inst,before:from.total,after:tot});
    }
    await fr.set({[P.flag]:now,[P.flag+"List"]:out},{merge:true});SR._instDone=1;
    if(out.length){const bf=r2(out.reduce((a,o)=>a+o.before,0)),af=r2(out.reduce((a,o)=>a+o.after,0));
      toast("🏢 "+out.length+" उधार बिल अपनी संस्था के चालान बने (खरीद भाव): ₹"+bf+" → ₹"+af);try{renderPane()}catch(x){}}
  }catch(e){}finally{SR._inst=0}
};
/* =============== 🏢 अपनी संस्थाएँ उधार में नहीं (03-11, विक्रम जी) =============== */
const INST_K=[[/रसोई|rasoi|मारवाड़\s*रसोई/i,"रसोई","मारवाड़ रसोई (होटल)"],[/डोसा|dosa|रामविनायक/i,"डोसा","रामविनायक डोसा पॉइंट"],[/भैरव|bhrev|bhairav|bherav|jasai|जसाई/i,"भैरव","15 भैरव कैंटीन (जसाई)"],[/mh\s*(wet\s*)?canteen|एमएच|177\s*mh|mh\s*(वेट\s*)?कैंटीन|^\s*mh\s*$/i,"MH","177 MH कैंटीन"]];
SR.instOf=function(name){const n=String(name||"");for(const [re,key,def] of INST_K)if(re.test(n)){const IN=typeof insts==="function"?insts():[];return IN.find(x=>x.includes(key))||def}return ""};
const devId=()=>{try{let d=localStorage.getItem("se_dev");if(!d){d="d"+Math.random().toString(36).slice(2,9);localStorage.setItem("se_dev",d)}return d}catch(e){return "d?"}};
const devTxt=()=>{const u=navigator.userAgent||"";const m=u.match(/Android[^;)]*;\s*([^;)]+)/);return (m?m[1]:/iPhone/.test(u)?"iPhone":/Windows/.test(u)?"Windows कंप्यूटर":"ब्राउज़र").trim().slice(0,40)};
/* किसी उधार-बिल को संस्था चालान (खरीद भाव) में बदलो — पुराना पूरा रूप bill.instConv.from में */
SR.costForDay=async function(db,date){
  let purch=[];try{const pq=await db.collection("purchases").where("date","==",date).get();purch=pq.docs.map(d=>({id:d.id,...d.data()})).filter(p=>!p.cancelled)}catch(e){}
  const endTs=new Date(date+"T23:59:59+05:30").getTime();
  const f=id=>{let q=0,a=0;purch.forEach(p=>(p.lines||[]).forEach(l=>{if(l.id===id){q+=num(l.qty);a+=num(l.amt)}}));if(q>0&&a>0)return r2(a/q);
    let best=null;(S.purchHist||[]).forEach(p=>{if(p.cancelled||p.ts>endTs)return;(p.lines||[]).forEach(l=>{if(l.id===id&&num(l.rate)>0&&(!best||p.ts>best.ts))best={rate:num(l.rate),ts:p.ts}})});
    if(best)return best.rate;const it=item(id);if(it&&it.lastBuy&&num(it.lastBuy.rate)>0)return num(it.lastBuy.rate);return it?num(it.cost):0};
  f.purch=purch;return f};
SR.convToInst=async function(db,date,no,inst,src,costFor){
  const ref=db.doc("days/"+date+"/bills/"+no);const g=await ref.get();if(!g.exists)return null;const b=g.data();
  if(b.mode==="inst"||b.cancelled||b.instConv)return null;
  const now=Date.now(),lt=l=>l.name+" "+fq(l.qty,l.unit)+"×₹"+l.rate;
  const from={mode:b.mode||"",partyId:b.partyId||"",partyName:b.partyName||"",total:num(b.total),sub:num(b.sub),cost:num(b.cost),disc:num(b.disc),pay:b.pay||{},payMode:b.payMode||"",lines:b.lines||[]};
  const lines=(b.lines||[]).map(l=>{const sale=num(l.rate),pr=costFor(l.id),rate=pr>0?r2(pr):sale;const n={...l,saleRate:sale,rate,board:rate,cost:rate,changed:false,amt:l.free?0:r2(num(l.qty)*rate)};if(!(pr>0))n.noCost=true;return n});
  const tot=r2(lines.reduce((a,l)=>a+num(l.amt),0));
  const nb={...b,mode:"inst",partyId:"",partyName:inst,lines,sub:tot,total:tot,cost:tot,disc:0,saleTotal:r2(lines.reduce((a,l)=>a+(l.free?0:num(l.qty)*num(l.saleRate)),0)),pay:{cash:0,upi:0,udhar:0},payMode:"inst",rateChanged:false,instRate:"purchase",settled:true};
  const ed={ts:now,by:S.uid||"",byName:"विक्रम जी",before:from.lines.map(lt).join(", "),after:lines.map(lt).join(", "),diff:"उधार खाता \""+from.partyName+"\" (बिक्री भाव ₹"+from.total+") → संस्था चालान "+inst+" (खरीद भाव ₹"+tot+")",totalBefore:from.total,totalAfter:tot,note:src};
  nb.edits=[...(b.edits||[]),ed];nb.editCount=num(b.editCount)+1;nb.instConv={ts:now,by:S.uid||"",src,from,fp:typeof fpBill==="function"?fpBill(nb):""};
  await ref.set(nb);
  if(num(from.pay.udhar)>0){try{G.okdel.add(no)}catch(x){}try{await db.doc("ledger/"+no).delete()}catch(x){}S.ledger=(S.ledger||[]).filter(l=>l.id!==no)}
  const i=(S.dayBills||[]).findIndex(x=>x.no===no);if(i>-1&&S.billsDate===date)S.dayBills[i]=nb;
  return {no,date,from:from.partyName,inst,before:from.total,after:tot};
};
/* खाता हटाना (सिर्फ़ मालिक) — असल में मिटता नहीं: "हटाया गया" निशान, कौन/कब/किस फ़ोन से, नीचे की सूची में दिखता है */
SR.delParty=async function(p,why,extra){
  const d={deleted:true,deletedBy:S.uid||"",deletedByName:"विक्रम जी (मालिक)",deletedTs:Date.now(),deletedDev:devId(),deletedDevTxt:devTxt(),deleteWhy:why||"",oldBal:typeof balRaw==="function"?balRaw(p.id):bal(p.id),...(extra||{})};
  if(window.SR&&SR.locNow&&SR.locNow())d.deletedLoc=SR.locNow();
  if(!S.demo)await S.db.collection("parties").doc(p.id).set(d,{merge:true});
  Object.assign(p,d);S.parties=(S.parties||[]).filter(x=>x.id!==p.id);S.partiesDel=[...(S.partiesDel||[]).filter(x=>x.id!==p.id),p];
  try{const seen=JSON.parse(localStorage.getItem("se_pdel")||"{}");seen[p.id]=d.deletedTs;localStorage.setItem("se_pdel",JSON.stringify(seen))}catch(e){}
};
SR.delListHTML=function(){const L=(S.partiesDel||[]).slice().sort((a,b)=>num(b.deletedTs)-num(a.deletedTs));if(!L.length)return "";
  return `<details class="pdel"><summary>🗑️ हटाए गए खाते (${L.length})</summary>${L.map(p=>`<div class="pdel-r"><div><b>${esc(p.name)}</b><span>मालिक ने हटाया · ${p.deletedTs?fdate(new Date(p.deletedTs).toISOString().slice(0,10))+" "+ftime(p.deletedTs):""}${p.movedTo?" · 🏢 संस्था में भेजा: "+esc(p.movedTo):""}${S.isOwner&&p.deleteWhy?" · "+esc(p.deleteWhy):""}${S.isOwner&&num(p.oldBal)?" · बाकी था "+rs(p.oldBal):""}${S.isOwner&&p.deletedDevTxt?" · 📱 "+esc(p.deletedDevTxt):""}</span></div>${S.isOwner?`<button class="lnk" data-pundel="${esc(p.id)}">↩ वापस लाएँ</button>`:""}</div>`).join("")}</details>`};
/* मालिक की ID से किसी दूसरे फ़ोन पर खाता हटे → इस फ़ोन पर तुरंत 🚨 सूचना (पहरेदार में दर्ज) */
SR.watchDel=function(L){if(!S.isOwner)return;let seen={};try{seen=JSON.parse(localStorage.getItem("se_pdel")||"null")}catch(e){}
  const first=!seen;seen=seen||{};let ch=false;
  (L||[]).forEach(p=>{const t=num(p.deletedTs);if(!t||seen[p.id]===t)return;seen[p.id]=t;ch=true;if(first||p.deletedDev===devId())return;
    const msg=`उधार खाता "${p.name}" हटाया गया — आपकी (मालिक) ID से, ${ftime(t)} पर, फ़ोन: ${p.deletedDevTxt||"पता नहीं"}${num(p.oldBal)?" · बाकी था "+rs(p.oldBal):""}`;
    try{if(typeof guardAlarm==="function"&&G.ready)guardAlarm({kind:"pdel",no:p.id,msg});else{toast("🚨 "+msg);beep(false)}}catch(e){toast("🚨 "+msg)}});
  if(ch)try{localStorage.setItem("se_pdel",JSON.stringify(seen))}catch(e){}};
document.addEventListener("change",async e=>{if(e.target.id!=="pName"||!S.isOwner)return;const p=(S.parties||[]).find(x=>x.id===e.target.dataset.pid);const v=e.target.value.trim();if(!p||!v||v===p.name)return;
  if(SR.instOf(v)){toast("🏢 यह अपनी संस्था का नाम है — उधार खाता इस नाम से नहीं रखें");e.target.value=p.name;return}
  const old=p.name,now=Date.now();try{if(!S.demo){await S.db.collection("parties").doc(p.id).set({name:v,nameHist:[...(p.nameHist||[]),{old,new:v,ts:now,by:S.uid||""}]},{merge:true});
    for(const l of (S.ledger||[]).filter(l=>l.partyId===p.id)){try{await S.db.collection("ledger").doc(l.id).set({partyName:v},{merge:true})}catch(x){}}}
    p.name=v;(S.ledger||[]).forEach(l=>{if(l.partyId===p.id)l.partyName=v});toast("✏️ नाम बदला: "+old+" → "+v);try{renderPane()}catch(x){}}catch(err){toast("नाम नहीं बदला: "+(err.code||""))}});
document.addEventListener("click",async e=>{
  const d=e.target.closest("[data-pdel]");
  if(d&&S.isOwner){const p=(S.parties||[]).find(x=>x.id===d.dataset.pdel);if(!p)return;const b=typeof balRaw==="function"?balRaw(p.id):bal(p.id);
    if(!d.dataset.sure){d.dataset.sure="1";d.textContent="⚠ पक्का हटाएँ?"+(b>0?" (₹"+b+" बाकी है — कुल बकाया से निकल जाएगा)":"")+" — फिर दबाएँ";return}
    try{await SR.delParty(p,"");closeSheet();toast("🗑️ "+p.name+" का खाता हटाया — नीचे 'हटाए गए खाते' में दिखेगा");try{renderPane()}catch(x){}
      const ph=String(S.settings.ownerPh||"").replace(/\D/g,"").slice(-10);if(ph.length===10&&window.SB&&SB.waNotice)setTimeout(()=>SB.waNotice(`🗑️ *उधार खाता हटाया*\nसब्ज़ी एक्सप्रेस\n━━━━━━━━━━━━\n👤 ${p.name}\n💰 बाकी था: ₹${b}\n🕐 ${fdate(today())} ${ftime(Date.now())}\n📱 ${devTxt()}`,ph),400)}catch(err){toast("नहीं हटा: "+(err.code||""))}
    return}
  const u=e.target.closest("[data-pundel]");
  if(u&&S.isOwner){const p=(S.partiesDel||[]).find(x=>x.id===u.dataset.pundel);if(!p)return;
    try{if(!S.demo)await S.db.collection("parties").doc(p.id).set({deleted:false,restoredTs:Date.now(),restoredBy:S.uid||""},{merge:true});p.deleted=false;S.partiesDel=S.partiesDel.filter(x=>x.id!==p.id);S.parties=[...S.parties,p];toast("↩ "+p.name+" का खाता वापस");try{renderPane()}catch(x){}}catch(err){toast("नहीं हुआ: "+(err.code||""))}}
});
/* एक बार (मालिक के फोन पर): कर्मचारी के बनाए "अपनी संस्था" वाले उधार खाते → उनके बिल संस्था चालान में, खाता हटाया (नीचे "हटाए गए" में) */
SR.autoInst2=async function(db){
  if(!S.isOwner||S.demo||!db||SR._inst2)return;SR._inst2=1;
  try{
    const fr=db.doc("ownerCfg/flags");const f=await fr.get();if(f.exists&&f.data().inst2)return;
    const [ps,ls]=await Promise.all([db.collection("parties").get(),db.collection("ledger").get()]);
    const parties=ps.docs.map(d=>({id:d.id,...d.data()})),led=ls.docs.map(d=>({id:d.id,...d.data()}));
    const src="विक्रम जी का आदेश 03-11: अपनी संस्था उधार में नहीं — खरीद भाव पर चालान, उधार खाता हटाया";const out=[],conv=[],cache={};const t=today();
    for(const p of parties){if(p.deleted)continue;const inst=p.id==="mh-canteen"?SR.instOf("177 MH canteen"):SR.instOf(p.name);if(!inst)continue;
      for(const l of led.filter(l=>l.partyId===p.id&&l.type==="udhar"&&l.billNo&&l.date&&l.date<t)){
        try{const cf=cache[l.date]||(cache[l.date]=await SR.costForDay(db,l.date));const r=await SR.convToInst(db,l.date,l.billNo,inst,src,cf);if(r)conv.push(r)}catch(x){}}
      const sp=(S.parties||[]).find(x=>x.id===p.id)||p;await SR.delParty(sp,"अपनी संस्था — उधार नहीं",{movedTo:inst,autoBy:"inst2"});out.push({id:p.id,name:p.name,inst})}
    await fr.set({inst2:Date.now(),inst2List:out,inst2Conv:conv},{merge:true});
    if(out.length)toast("🏢 "+out.length+" उधार खाते अपनी संस्था के थे — संस्था में भेजे, उधार सूची से हटाए"+(conv.length?" · "+conv.length+" पुराने बिल चालान बने":""));
    try{renderPane()}catch(x){}
  }catch(e){SR._inst2=0}
};
/* 🗺️ दिन का हिसाब → "सार" में आज की गाड़ी का छोटा नक्शा (सिर्फ़ मालिक) — टैप करें तो पूरा रूट */
SR.mini={date:"",day:null,ts:0,map:null};
SR.miniMapHTML=function(){if(!S.isOwner)return "";const d=SR.mini.date===S.billsDate?SR.mini.day:null;
  const sum=d?`${d.stops.length} जगह रुकी · लगभग ${d.km} km · ${d.stops.filter(s=>s.sales>0).length} जगह बिक्री${d.gaps&&d.gaps.length?" · ⚠ "+d.gaps.length+" बार लोकेशन बंद":""}`:"⏳ नक्शा लोड हो रहा है…";
  return `<div class="card2 mmap" data-gorute><h3 style="margin:0 0 6px">🗺️ ${S.billsDate===today()?"आज":fdate(S.billsDate)} की गाड़ी <small class="note">· टैप करें — पूरा रूट</small></h3><div id="dMini" class="dmini" role="img" aria-label="आज का रास्ता"></div><p class="note" id="dMiniT">${sum}</p></div>`};
SR.miniInit=async function(){const el=document.getElementById("dMini");if(!el||!S.isOwner)return;const date=S.billsDate;
  try{if(SR.mini.date!==date||Date.now()-SR.mini.ts>5*60000){const docs=S.demo||!S.db?[]:(await S.db.collection("trk").where("date","==",date).get()).docs.map(x=>x.data());
      SR.mini={date,day:analyze(date,docs,(S.dayBills||[]).filter(b=>!b.cancelled)),ts:Date.now(),map:null}}
    const d=SR.mini.day;const t=document.getElementById("dMiniT");
    if(t)t.textContent=`${d.stops.length} जगह रुकी · लगभग ${d.km} km · ${d.stops.filter(s=>s.sales>0).length} जगह बिक्री${d.gaps&&d.gaps.length?" · ⚠ "+d.gaps.length+" बार लोकेशन बंद":""}`;
    if(!window.L)await loadLeaflet().catch(()=>{});const el2=document.getElementById("dMini");if(!el2||el2._lm)return;
    if(!window.L||!L.map){el2.style.display="none";return}
    const m=L.map(el2,{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false,tap:false});el2._lm=m;
    L.tileLayer(SATU,{maxZoom:20,maxNativeZoom:18}).addTo(m);const B=[];
    d.pts.forEach(u=>{const ll=u.P.map(p=>[p.lat,p.lng]);if(ll.length<2)return;L.polyline(ll,{color:"#fff",weight:6,opacity:.45}).addTo(m);L.polyline(ll,{color:colorOf(u.uid),weight:3.5}).addTo(m);ll.forEach(x=>B.push(x))});
    d.stops.forEach((s,i)=>{L.circleMarker([s.lat,s.lng],{radius:s.sales>0?Math.min(14,6+Math.sqrt(s.sales)/6):5,color:"#fff",weight:2,fillColor:s.sales>0?"#22c55e":"#f59e0b",fillOpacity:.95}).addTo(m);B.push([s.lat,s.lng])});
    if(B.length)m.fitBounds(B,{padding:[14,14],maxZoom:17});else m.setView([HOME.lat,HOME.lng],15);setTimeout(()=>{try{m.invalidateSize()}catch(e){}},150);
  }catch(e){const t=document.getElementById("dMiniT"),el3=document.getElementById("dMini");if(el3)el3.style.display="none";if(t&&!/जगह रुकी/.test(t.textContent))t.textContent="🗺️ नक्शा इंटरनेट आने पर दिखेगा — टैप करके पूरा रास्ता देखें"}};
document.addEventListener("click",e=>{if(!e.target.closest("[data-gorute]"))return;R.date=S.billsDate;R.raw=null;R.day=null;const t=document.querySelector('[data-tab="route"]');if(t)t.click()});
/* SF के साथ जोड़ */
if(window.SF){const _o=SF.onDb;SF.onDb=function(db){_o(db);try{SR.onDb(db)}catch(e){}}}
})();
