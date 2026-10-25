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
SR.last=null;
let tickBusy=false,started=false;
function queue(){try{return JSON.parse(LSx.get("se_trkq")||"[]")}catch(e){return []}}
function setQueue(q){LSx.set("se_trkq",JSON.stringify(q.slice(-6000)))}
function addPts(lines){
  if(!lines.length)return;const q=queue();
  lines.forEach(l=>{q.push(l);const a=l.split(",");if(a.length>=3){const p={ts:+a[0],lat:+a[1],lng:+a[2],acc:+a[3]||0};if(isFinite(p.lat)&&(!SR.last||p.ts>=SR.last.ts))SR.last=p}});
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
    try{navigator.geolocation.watchPosition(p=>{SR.st.perm=true;SR.st.gps=true;SR.st.running=true;const now=Date.now();if(SR._wl&&now-SR._wl<45000)return;SR._wl=now;
        addPts([now+","+p.coords.latitude.toFixed(6)+","+p.coords.longitude.toFixed(6)+","+Math.round(p.coords.accuracy)])},
      e=>{if(e.code===1)SR.st.perm=false;else if(e.code===2)SR.st.gps=false;SR.st.running=false;SR.banner()},{enableHighAccuracy:true,maximumAge:30000,timeout:60000})}catch(e){}
  }
  SR.tick();setInterval(SR.tick,90000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)setTimeout(SR.tick,800)});
};
SR.banner=function(){
  if(S.isOwner||S.demo)return;let el=document.getElementById("locbar");
  if(!el){el=document.createElement("button");el.id="locbar";el.className="locbar";el.type="button";const nb=document.getElementById("netbar");if(nb)nb.insertAdjacentElement("afterend",el);else document.body.prepend(el);el.onclick=SR.fixLoc}
  const s=SR.st;let t="";
  if(s.native&&s.unsupported)t="📍 गाड़ी की लोकेशन के लिए नई APK डालें (वही पुराना लिंक)";
  else if(s.perm===false)t="📍 लोकेशन की अनुमति नहीं है — यहाँ दबाकर 'अनुमति दें' चुनें";
  else if(s.gps===false)t="📍 फोन की लोकेशन (GPS) बंद है — यहाँ दबाकर चालू करें";
  else if(s.native&&s.running===false&&s.perm)t="📍 लोकेशन रुकी हुई है — यहाँ दबाकर चालू करें";
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
/* हर बिल पर जगह का ठप्पा */
SR.stamp=function(bill){
  const l=SR.last;
  if(l&&Date.now()-l.ts<15*60000){bill.loc={lat:l.lat,lng:l.lng,acc:l.acc||0,ts:l.ts};const pl=placeAt(l);if(pl)bill.place=pl.name}
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
  <p class="warn" style="margin:8px 0">⚠ XYZ वाला हर बिल विक्रम जी की रिपोर्ट और ऑडिट में अलग से दिखेगा। जो सामान बार-बार बिके, उसे "+ नया सामान" से जोड़ें।</p>
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
  <div class="sh-head"><div><h3>➕ नया सामान जोड़ें</h3><span class="note">${S.isOwner?"यह सबके फोन में तुरंत आ जाएगा":"विक्रम जी को इसकी खबर अपने-आप जाएगी"}</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
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
  closeSheet();toast("✓ "+name+" जुड़ गया"+(S.isOwner?"":" — विक्रम जी को खबर गई"));
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
const R={date:null,map:null,live:[],day:null,agg:null,loading:false,custQ:"",custAll:false,liveLayer:null};
SR.onDb=function(db){
  db.collection("places").onSnapshot(s=>{SR.places=s.docs.map(d=>({id:d.id,...d.data()}));if(S.tab==="route"&&R.day){R.day=analyze(R.day.date,R.day.docs,R.day.bills);SR.renderRoute()}},()=>{});
  if(S.isOwner)db.collection("live").onSnapshot(s=>{R.live=s.docs.map(d=>({id:d.id,...d.data()}));if(S.tab==="route")SR.updateLive()},()=>{});
  else setTimeout(SR.start,1500);
};
function parse(docs){
  const by={};
  docs.forEach(d=>{const u=by[d.uid]||(by[d.uid]={uid:d.uid,name:d.name||"",P:[],E:[]});if(d.name)u.name=d.name;
    (d.pts||[]).forEach(s=>{const a=String(s).split(",");const ts=+a[0];if(!ts)return;
      if(a.length>=3){const p={ts,lat:+a[1],lng:+a[2],acc:+a[3]||0};if(isFinite(p.lat)&&isFinite(p.lng)&&p.acc<=250)u.P.push(p)}else u.E.push({ts,ev:a[1]})})});
  return Object.values(by).map(u=>{u.P.sort((a,b)=>a.ts-b.ts);u.P=u.P.filter((p,i,a)=>!i||p.ts!==a[i-1].ts);u.E.sort((a,b)=>a.ts-b.ts);return u});
}
function findStops(P){
  const out=[];let c=null;const close=()=>{if(c&&c.end-c.start>=4*60000)out.push(c)};
  for(const p of P){
    if(c&&dist(c,p)<=100&&p.ts-c.end<=25*60000){const n=c.n+1;c.lat=(c.lat*c.n+p.lat)/n;c.lng=(c.lng*c.n+p.lng)/n;c.n=n;c.end=p.ts}
    else{close();c={lat:p.lat,lng:p.lng,n:1,start:p.ts,end:p.ts}}
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
  U.forEach(u=>{findStops(u.P).forEach(s=>stops.push({...s,uid:u.uid,name:u.name}));gapsOf(u).forEach(g=>gaps.push({...g,name:u.name}));
    for(let i=1;i<u.P.length;i++){const d=dist(u.P[i-1],u.P[i]);if(d>40&&d<5000)km+=d/1000}pts.push({uid:u.uid,name:u.name,P:u.P})});
  stops.sort((a,b)=>a.start-b.start);
  stops.forEach(s=>{s.place=placeAt(s);s.bills=[];s.sales=0;s.inst=0});
  const free=[];
  bills.forEach(b=>{let best=null;
    stops.forEach(s=>{if(b.by&&s.uid!==b.by)return;const inT=b.ts>=s.start-3*60000&&b.ts<=s.end+3*60000;const near=b.loc?dist(s,b.loc)<=250:true;if(inT&&near)best=s});
    if(!best&&b.loc)best=stops.find(s=>(!b.by||s.uid===b.by)&&dist(s,b.loc)<=120&&Math.abs(b.ts-s.start)<3*3600e3)||null;
    if(best){best.bills.push(b);if(b.mode==="inst")best.inst+=+b.total||0;else best.sales+=+b.total||0}else free.push(b)});
  return {date,docs,bills,stops,gaps,km:Math.round(km*10)/10,pts,free};
}
SR.analyze=analyze;
SR.loadDay=async function(date){
  R.loading=true;
  try{
    const docs=S.demo||!S.db?[]:(await S.db.collection("trk").where("date","==",date).get()).docs.map(x=>x.data());
    let bills=date===S.billsDate?S.dayBills:(S.demo||!S.db?[]:(await S.db.collection("days/"+date+"/bills").get()).docs.map(x=>x.data()));
    R.day=analyze(date,docs,bills.filter(b=>!b.cancelled));
  }catch(e){R.day={date,docs:[],bills:[],stops:[],gaps:[],pts:[],free:[],km:0,err:e.code||e.message||""}}
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
  R.live.forEach(v=>{if(v.lat==null)return;L.circleMarker([v.lat,v.lng],{radius:12,color:"#7c2d12",weight:3,fillColor:"#f97316",fillOpacity:.95}).addTo(R.liveLayer).bindTooltip("🚐 "+(v.name||"")+" · "+(v.ts?agoTxt(v.ts):""),{permanent:true,direction:"top",offset:[0,-10]})});
}
const WHY={OFF:"फोन की लोकेशन बंद की",STOP:"ऐप/लोकेशन रुकी",NOPERM:"लोकेशन की अनुमति नहीं",NOFIX:"गाड़ी चली पर खबर नहीं आई"};
function dayHTML(d){
  if(d.err)return `<div class="warn">रूट नहीं पढ़ा जा सका: ${esc(d.err)}</div>`;
  const all=d.bills,withLoc=all.filter(b=>b.loc).length,stopMin=d.stops.reduce((a,s)=>a+mins(s.end-s.start),0);
  const sale=r2(all.filter(b=>b.mode!=="inst").reduce((a,b)=>a+(+b.total||0),0));
  if(!d.pts.length)return `<div class="empty"><b>${fdate(d.date)} की लोकेशन नहीं आई</b>कर्मचारी के फोन में नई APK, लॉगिन और लोकेशन चालू होनी चाहिए। (इस दिन ${all.length} बिल · ${rs(sale)})</div>`;
  const freeAmt=r2(d.free.filter(b=>b.mode!=="inst").reduce((a,b)=>a+(+b.total||0),0));
  return `<div class="kpis"><div class="kpi"><span>रुकने की जगहें</span><b>${d.stops.length}</b></div><div class="kpi"><span>कुल रुकी</span><b style="font-size:17px">${durTxt(stopMin)}</b></div>
   <div class="kpi"><span>दूरी</span><b>${d.km} km</b></div><div class="kpi ${withLoc<all.length?"red":""}"><span>बिल पर जगह</span><b>${withLoc}/${all.length}</b></div></div>
  ${d.gaps.length?`<div class="warn">⚠ लोकेशन में रुकावट: ${d.gaps.map(g=>`<br>• ${esc(g.name)} · ${ftime(g.start)}–${g.end?ftime(g.end):"आखिर तक"} · ${WHY[g.why]||g.why}`).join("")}</div>`:""}
  <h3 style="margin:10px 0 6px">🛑 गाड़ी कहाँ-कहाँ रुकी</h3>
  <div class="list">${d.stops.map((s,i)=>{const m=mins(s.end-s.start),ph=m>0?r2(s.sales/(m/60)):0;return `<div class="rstop">
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
  return show.map(c=>`<button class="li" data-chist="${esc(c.id)}"><div class="mid"><b>${esc(c.name||"ग्राहक")} · ${esc(c.id)}</b><span>${c.visits||0} बार · कुल ${rs(c.spent||0)}${c.lastTs?" · आखिरी "+fdate(dOf(c.lastTs)):""}${c.lastItems?" · "+esc(String(c.lastItems).slice(0,40)):""}</span></div><span>›</span></button>`).join("")||'<p class="note" style="padding:10px">कोई ग्राहक नहीं मिला</p>';
}
function custHTML(){
  return `<div class="card2"><h3>👥 ग्राहक रजिस्टर (${(S.customers||[]).length})</h3><p class="note" style="margin:0">हर मोबाइल नंबर = एक पक्का ग्राहक। नाम पर दबाएँ तो पूरी खरीद का इतिहास।</p>
  <input class="inp" id="rcq" placeholder="नंबर या नाम से खोजें" value="${esc(R.custQ)}" style="margin:6px 0" autocomplete="off">
  <div class="list" id="rcl" style="margin:0">${custListHTML()}</div>
  <div class="row2" style="margin-top:8px"><button class="big ghost" data-callc>${R.custAll?"सिर्फ़ टॉप 10":"सभी ग्राहक"}</button><button class="big ghost" data-ccsv>⬇️ CSV (कैंपेन के लिए)</button></div></div>`;
}
function placesHTML(){
  const by={};SR.places.forEach(p=>(by[p.name]||(by[p.name]=[])).push(p));const names=Object.keys(by).sort((a,b)=>a.localeCompare(b,"hi"));
  return `<div class="card2"><h3>🏷️ जगहों के नाम (${names.length})</h3><p class="note" style="margin:0 0 6px">रुकने वाली जगह पर "नाम दें" दबाकर नाम रखें (जैसे सरल लाइन, गरुड़ लाइन)। एक नाम की कई जगहें हों तो कमाई एक साथ जुड़ती है।</p>
  ${names.map(n=>`<div class="stkmeta"><span>📍 <b style="color:var(--ink)">${esc(n)}</b> <span class="note">(${by[n].length} जगह)</span></span><span><button class="lnk" data-pren="${esc(n)}">नाम बदलें</button> · <button class="lnk" data-pdel="${esc(n)}" style="color:var(--chili)">हटाएँ</button></span></div>`).join("")||'<p class="note">अभी कोई नाम नहीं रखा।</p>'}</div>`;
}
SR.renderRoute=function(){
  const el=document.getElementById("p-route");if(!el)return;bindRoute(el);if(!R.date)R.date=today();
  if((!R.day||R.day.date!==R.date)&&!R.loading)SR.loadDay(R.date);
  const d=R.day&&R.day.date===R.date?R.day:null;
  el.innerHTML=`<div class="daterow"><h2 class="sec" style="margin:0;flex:1">📍 गाड़ी का रूट</h2><button class="chip" data-rref aria-label="ताज़ा करें">🔄</button><input class="inp" type="date" id="rDate" value="${R.date}" aria-label="तारीख"></div>
  <div class="card2 rlive" id="rLive">${liveHTML()}</div>
  <div id="rmap" class="rmap" role="img" aria-label="गाड़ी का रास्ता नक्शे पर"></div>
  ${d?dayHTML(d):'<div class="empty">⏳ रूट लोड हो रहा है…</div>'}
  <div class="card2"><h3>🏆 जगह की कमाई</h3><p class="note" style="margin:0">कहाँ कितना समय, कितने बिल, कितनी बिक्री। ₹ प्रति घंटा से पता चलेगा कि कहाँ ज़्यादा रुकना है।</p>
    <div class="ragg"><button class="big ghost" data-ragg="1">इस दिन</button><button class="big ghost" data-ragg="7">7 दिन</button><button class="big ghost" data-ragg="30">30 दिन</button></div>
    <div id="rAgg">${R.agg?aggHTML(R.agg):""}</div></div>
  ${custHTML()}
  ${placesHTML()}`;
  SR.drawMap();
};
function loadLeaflet(){return new Promise((res,rej)=>{if(window.L)return res();if(!document.querySelector('link[href="lib/leaflet.css"]')){const l=document.createElement("link");l.rel="stylesheet";l.href="lib/leaflet.css";document.head.appendChild(l)}
  const s=document.createElement("script");s.src="lib/leaflet.js";s.onload=()=>res();s.onerror=rej;document.head.appendChild(s)})}
SR.drawMap=async function(){
  const el=document.getElementById("rmap");if(!el)return;
  if(!window.L){try{await loadLeaflet()}catch(e){el.innerHTML='<p class="note" style="padding:12px">नक्शा लोड नहीं हुआ (इंटरनेट देखें)</p>';return}}
  if(R.map){try{R.map.remove()}catch(e){}R.map=null;R.liveLayer=null}
  if(!document.body.contains(el))return;
  const m=R.map=L.map(el,{zoomControl:true,attributionControl:true});
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(m);
  const B=[];
  SR.places.forEach(p=>{L.circle([p.lat,p.lng],{radius:+p.r||150,color:"#2f6fdb",weight:1,fillOpacity:.07}).addTo(m).bindTooltip(p.name)});
  const d=R.day&&R.day.date===R.date?R.day:null;
  if(d){
    d.pts.forEach((u,ui)=>{const ll=u.P.map(p=>[p.lat,p.lng]);if(ll.length>1)L.polyline(ll,{color:["#1f8a4c","#d97706","#7c3aed"][ui%3],weight:4,opacity:.75}).addTo(m);ll.forEach(x=>B.push(x))});
    d.stops.forEach(s=>{const r=8+Math.min(18,Math.sqrt(s.sales)/3);L.circleMarker([s.lat,s.lng],{radius:r,color:"#14532d",fillColor:s.sales>0?"#22c55e":"#94a3b8",fillOpacity:.85,weight:2}).addTo(m)
      .bindPopup(`<b>${esc(s.place?s.place.name:"बिना नाम की जगह")}</b><br>${ftime(s.start)}–${ftime(s.end)} · ${durTxt(mins(s.end-s.start))}<br>${s.bills.length} बिल · ${rs(r2(s.sales))}`);B.push([s.lat,s.lng])});
    d.bills.forEach(b=>{if(b.loc){L.circleMarker([b.loc.lat,b.loc.lng],{radius:3,color:"#b91c1c",weight:1,fillOpacity:1}).addTo(m);B.push([b.loc.lat,b.loc.lng])}});
  }
  if(R.date===today())R.live.forEach(v=>{if(v.lat!=null)B.push([v.lat,v.lng])});
  drawLive();
  if(B.length)m.fitBounds(B,{padding:[28,28],maxZoom:17});else m.setView([25.75,71.39],13);
  setTimeout(()=>{try{m.invalidateSize()}catch(e){}},250);
};
function nameSheet(lat,lng,cur){
  const names=[...new Set(SR.places.map(p=>p.name))].sort((a,b)=>a.localeCompare(b,"hi"));
  $("#sheet").innerHTML=`<div class="scrim" data-close><div class="sheet px" role="dialog" aria-label="जगह का नाम"><div class="grab"></div>
  <div class="sh-head"><div><h3>📍 इस जगह का नाम</h3><span class="note">आगे से यह जगह अपने-आप इसी नाम से पहचानी जाएगी</span></div><button class="x" data-close aria-label="बंद करें">✕</button></div>
  <label class="fld">नाम<input class="inp" id="plName" value="${esc(cur?cur.name:"")}" placeholder="जैसे सरल लाइन, गरुड़ लाइन"></label>
  ${names.length?`<div class="lsws" style="margin:6px 0">${names.map(n=>`<button class="chip" data-plpick="${esc(n)}">${esc(n)}</button>`).join("")}</div>`:""}
  <label class="fld">दायरा<select class="inp" id="plR">${[[100,"छोटा — 100 मीटर"],[150,"सामान्य — 150 मीटर"],[250,"बड़ा — 250 मीटर"]].map(([v,t])=>`<option value="${v}" ${(cur?+cur.r:150)===v?"selected":""}>${t}</option>`).join("")}</select></label>
  <a class="lnk" href="https://maps.google.com/?q=${lat},${lng}" target="_blank" rel="noopener">Google Map पर देखें ↗</a>
  <button class="big" data-plsave style="margin-top:10px">✓ नाम सेव करें</button></div></div>`;
  $("#sheet").onclick=async e=>{
    if(e.target.matches("[data-close]")){closeSheet();return}
    const pk=e.target.closest("[data-plpick]");if(pk){$("#plName").value=pk.dataset.plpick;return}
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
  el.addEventListener("change",e=>{if(e.target.id==="rDate"){R.date=e.target.value||today();R.agg=null;R.day=null;SR.renderRoute()}});
  el.addEventListener("input",e=>{if(e.target.id==="rcq"){R.custQ=e.target.value;const l=document.getElementById("rcl");if(l)l.innerHTML=custListHTML()}});
  el.addEventListener("click",e=>{
    const t=e.target.closest("[data-ragg],[data-rname],[data-pren],[data-pdel],[data-chist],[data-ccsv],[data-callc],[data-rref],[data-aggname]");if(!t)return;
    if(t.dataset.ragg){SR.loadAgg(+t.dataset.ragg);return}
    if(t.dataset.rref!==undefined){R.day=null;R.agg=null;SR.renderRoute();return}
    if(t.dataset.rname!==undefined){const s=R.day&&R.day.stops[+t.dataset.rname];if(s)nameSheet(s.lat,s.lng,s.place);return}
    if(t.dataset.aggname){const [la,ln]=t.dataset.aggname.split(",");nameSheet(+la,+ln,null);return}
    if(t.dataset.pren){const old=t.dataset.pren;const nn=(prompt("नया नाम",old)||"").trim();if(!nn||nn===old)return;SR.places.filter(p=>p.name===old).forEach(p=>S.db.collection("places").doc(p.id).update({name:nn}).catch(()=>{}));toast("नाम बदला");return}
    if(t.dataset.pdel){const n=t.dataset.pdel;if(!confirm(n+" का नाम हटाएँ? (बिल और रूट नहीं मिटेंगे)"))return;SR.places.filter(p=>p.name===n).forEach(p=>S.db.collection("places").doc(p.id).delete().catch(()=>{}));return}
    if(t.dataset.chist){custHistSheet(t.dataset.chist);return}
    if(t.dataset.callc!==undefined){R.custAll=!R.custAll;SR.renderRoute();return}
    if(t.dataset.ccsv!==undefined){SR.saveFile("SabjiExpress_Customers_"+today()+".csv",csvCustomers(),"text/csv");return}
  });
}

/* SF के साथ जोड़ */
if(window.SF){const _o=SF.onDb;SF.onDb=function(db){_o(db);try{SR.onDb(db)}catch(e){}}}
})();
