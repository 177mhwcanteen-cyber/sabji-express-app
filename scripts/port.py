"""पुराने आर्टिफ़ैक्ट ऐप (sabji.html) को Firebase/Android ऐप में बदलने वाला एक-बार का पैच।
उपयोग: python3 scripts/port.py <पुरानी sabji.html> web/index.html"""
import re, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf8").read()

def rep(old, new, cnt=1):
    global s
    n = s.count(old)
    if n != cnt:
        sys.exit(f"count {n} (expected {cnt}) for: {old[:90]}")
    s = s.replace(old, new)

def rx(pat, new, flags=re.S):
    global s
    s2, n = re.subn(pat, lambda m: new, s, count=1, flags=flags)
    if n != 1:
        sys.exit("regex miss: " + pat[:90])
    s = s2

# ---- head: स्थानीय लाइब्रेरी, कोई CDN नहीं (बिना नेट भी खुले) ----
rep('<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>',
    '<meta name="theme-color" content="#0f5132">\n<link rel="manifest" href="manifest.webmanifest">\n'
    '<script src="config.js"></script>\n<script src="build.js"></script>\n'
    '<script src="lib/qrcode.min.js"></script>\n<script src="lib/vendor.js"></script>\n<script src="se-platform.js"></script>')
pass

# ---- CSS जोड़ें: लॉगिन, लाइव कैमरा, प्रिंट बटन ----
rep(".toast{position:fixed;", """/* v14 Android ऐप */
.lgform{display:grid;gap:10px;width:min(340px,100%)}
.lgerr{color:var(--chili);font-weight:700;margin:0}.lgmsg{color:var(--leaf);font-weight:700;margin:0}
.lgphone{font-size:30px;font-weight:800;letter-spacing:2px;min-height:40px;font-variant-numeric:tabular-nums}
.camov{position:fixed;inset:0;z-index:80;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#fff;padding:16px}
.camov video{width:100%;max-width:520px;border-radius:18px}
.camframe{position:absolute;left:50%;top:42%;width:min(70vw,360px);height:160px;transform:translate(-50%,-50%);border:3px solid #7CFC9A;border-radius:16px;box-shadow:0 0 0 2000px rgba(0,0,0,.35)}
.camov p{margin:0;font-weight:700;text-align:center}.camov .big{width:min(340px,100%);background:#fff}
.verline{font-size:12px;color:var(--muted);text-align:center;margin:14px 0 4px}
.toast{position:fixed;""")

# ---- फोटो: आर्टिफ़ैक्ट /_blob/ की जगह ऐप के अंदर की फोटो / Firebase ----
rep('const img=it.photo?`<img src="/_blob/${esc(it.photo)}" alt="" loading="lazy" style="position:absolute;inset:0" onerror="this.remove()">`:"";',
    'const psrc=SE.photoSrc(it);const img=psrc?`<img src="${esc(psrc)}" alt="" loading="lazy" decoding="async" style="position:absolute;inset:0" onerror="this.remove()">`:"";')
rep('${it.photo?`<img src="/_blob/${esc(it.photo)}" alt="">`:`<span class="em">${esc(it.emoji||"🥬")}</span>`}',
    '${SE.photoSrc(it)?`<img src="${esc(SE.photoSrc(it))}" alt="">`:`<span class="em">${esc(it.emoji||"🥬")}</span>`}')
rep('''    if(!S.assets){toast("फोटो डालने की अनुमति इस फोन पर नहीं है");return}
    try{toast("फोटो अपलोड हो रही है…");const small=await shrink(f);const r=await S.assets.upload(small,{type:"image/jpeg"});await saveItem(id,{photo:r.id});toast("फोटो लग गई")}catch(err){toast(err?.code==="too_large"?"फोटो बहुत बड़ी है":"फोटो नहीं लगी, दोबारा कोशिश करें")}}''',
    '''    if(S.demo){toast("डेमो में फोटो नहीं लगती");return}
    try{toast("फोटो लग रही है…");const tag=await SE.savePhoto(id,f);await saveItem(id,{photo:tag});renderSettings();toast("फोटो लग गई")}catch(err){toast("फोटो नहीं लगी, दोबारा कोशिश करें")}}''')

# ---- स्टॉक: पढ़-कर-लिखो की जगह पक्का जोड़/घटाव (दो फोन एक साथ हों तो भी सही) ----
rep('''if(!S.demo){try{const ref=S.db.collection("pstock").doc(id);const g=await ref.get();const base=g.exists?(+g.data().qty||0):cur;await ref.set({qty:r2(base+d),ts:Date.now(),by:S.uid||"",byName:biller(),last:why||""})}catch(e){toast("स्टॉक अपडेट नहीं हुआ")}}''',
    '''if(!S.demo){try{await S.db.collection("pstock").doc(id).set({qty:SE.inc(r2(d)),ts:Date.now(),by:S.uid||"",byName:biller(),last:why||""},{merge:true});S.db.collection("stockLog").doc("m"+Date.now().toString(36)+Math.random().toString(36).slice(2,5)).set({itemId:id,d:r2(d),why:why||"",ts:Date.now(),date:today(),by:S.uid||"",byName:biller()}).catch(()=>{})}catch(e){toast("स्टॉक अपडेट नहीं हुआ")}}''')
rep('''for(const [id,d] of trackedPairs(bill.lines,-1)){try{const ref=S.db.collection("pstock").doc(id);const g=await ref.get();await ref.set({qty:r2((g.exists?(+g.data().qty||0):0)+d),ts:Date.now(),byName:bill.byName,last:"बिल "+bill.no})}catch(e){}}''',
    '''for(const [id,d] of trackedPairs(bill.lines,-1)){try{await S.db.collection("pstock").doc(id).set({qty:SE.inc(r2(d)),ts:Date.now(),byName:bill.byName,last:"बिल "+bill.no},{merge:true})}catch(e){}}''')
rep('if(err&&err.code==="invalid_argument"){S.saving=false;drawCheckout();toast("बिल सेव करने की अनुमति नहीं है — मालिक से एडिट एक्सेस लें");return}',
    'if(err&&(err.code==="invalid_argument"||err.code==="permission-denied")){S.saving=false;drawCheckout();toast("बिल सेव करने की अनुमति नहीं है — विक्रम जी से खाता चालू करवाएँ");return}')

# ---- असली लॉगिन: पुराना नाम-PIN ताला हटाकर Firebase खाता ----
rx(r'function checkLock\(\)\{.*?\n\}\nfunction showLock\(\)\{.*?\n\}\nfunction logoutStaff\(\)\{[^\n]*\n',
   'function checkLock(){$("#lock").hidden=true}\nfunction showLock(){}\nfunction logoutStaff(){SE.logout()}\n')
rep('''$("#who").onclick=()=>{if(!S.isOwner&&!S.demo&&staffList().length){''','''$("#who").onclick=()=>{if(!S.demo){''')
rep('''<p class="note">इस फोन पर अभी आपके नाम से बिल बन रहे हैं।</p><button class="big ghost" data-logout>दूसरा व्यक्ति — बिलर बदलें</button>''',
    '''<p class="note">इस फोन पर अभी आपके नाम से बिल बन रहे हैं${S.isOwner?" (मालिक)":""}।</p><button class="big ghost" data-logout>लॉग-आउट — दूसरा व्यक्ति</button><p class="verline">ऐप संस्करण ${esc(SE.version)}${SE.isNative?" · Android":" · वेब"}</p>''')

# सेटिंग में कर्मचारी: मोबाइल + PIN से असली खाता
rx(r'<div class="card2"><h3>🔐 स्टाफ और PIN</h3>.*?data-staffadd>\+ स्टाफ जोड़ें</button></div>',
   '''<div class="card2"><h3>🔐 कर्मचारी (लॉगिन खाते)</h3>
    <p class="note" style="margin:0">हर व्यक्ति अपने मोबाइल नंबर + 4 अंक के PIN से लॉगिन करेगा। बिल उसी के नाम से बनेंगे। किसी को हटाना हो तो "बंद करें" — उसका पुराना हिसाब कभी नहीं मिटेगा।</p>
    <div>${S.staffDocs.filter(x=>!x.owner).length?S.staffDocs.filter(x=>!x.owner).map(x=>`<div class="staffrow"><b>👤 ${esc(x.name)}</b><span class="note">${esc(x.phone||"")} · ${x.active===false?"बंद":"चालू"}</span><button class="lnk" data-staffon="${esc(x.id)}" data-on="${x.active===false?1:0}" style="color:${x.active===false?"var(--leaf)":"var(--chili)"}">${x.active===false?"चालू करें":"बंद करें"}</button></div>`).join(""):'<p class="note" style="margin:0">अभी कोई कर्मचारी नहीं जोड़ा।</p>'}</div>
    <input class="inp" id="stName" placeholder="नाम (जैसे कमल भाई)" aria-label="नाम">
    <div class="row2" style="margin:0"><input class="inp" id="stPhone" inputmode="tel" maxlength="20" placeholder="मोबाइल नंबर" aria-label="मोबाइल नंबर"><input class="inp" id="stPin" inputmode="numeric" maxlength="4" placeholder="4 अंक PIN" aria-label="4 अंक का PIN"></div>
    <button class="big ghost" data-staffadd>+ कर्मचारी जोड़ें / PIN बदलें</button></div>
  <div class="card2"><h3>🖨️ ब्लूटूथ प्रिंटर</h3>
    <p class="note" style="margin:0">${SE.isNative?(SE.printer.addr?"चुना हुआ: <b>"+esc(SE.printer.name)+"</b> · "+(SE.printer.mm==="100"?"4 इंच · लेबल-भाषा (TSPL)":SE.printer.mm+"mm"):"पहले फोन की Bluetooth सेटिंग में प्रिंटर को pair करें, फिर यहाँ चुनें।"):"प्रिंटर Android ऐप में चुना जाता है। वेब में बिल फोन के प्रिंट से छपेगा।"}</p>
    ${SE.isNative?'<div class="row2" style="margin:0"><button class="big ghost" data-prnpick="58">58mm प्रिंटर चुनें</button><button class="big ghost" data-prnpick="80">80mm प्रिंटर चुनें</button></div><button class="big ghost" data-prnpick="100">4 इंच प्रिंटर (Xprinter XP-D4601B जैसा) चुनें</button><div id="prnList"></div><button class="big ghost" data-prntest>टेस्ट प्रिंट</button>':""}</div>
  <div class="card2"><h3>📦 पुराने ऐप का डेटा</h3><p class="note" style="margin:0">पुराने (आर्टिफ़ैक्ट) ऐप की सब्ज़ियाँ, भाव, खरीद इतिहास, उधार खाते और संस्थाएँ यहाँ लाएँ। जो पहले से है वह नहीं बदलेगा।</p><button class="big ghost" data-migrate>पुराना डेटा लाएँ</button></div>''')
rx(r'if\(e\.target\.closest\("\[data-staffadd\]"\)\)\{.*?\n  const sd=e\.target\.closest\("\[data-staffdel\]"\);if\(sd\)\{[^\n]*\n',
   '''if(e.target.closest("[data-staffadd]")){const name=$("#stName").value.trim(),ph=$("#stPhone").value.replace(/\\D/g,"").slice(-10),pin=$("#stPin").value.trim();
    try{toast("खाता बन रहा है…");await SE.addStaff(name,ph,pin);renderSettings();toast(name+" जुड़ गए · लॉगिन: "+ph+" · PIN "+pin+" उन्हें बता दें")}catch(err){toast(err.msg||("नहीं बना: "+(err.code||"")))}return}
  const sd=e.target.closest("[data-staffon]");if(sd){try{await SE.setStaffActive(sd.dataset.staffon,sd.dataset.on==="1");toast(sd.dataset.on==="1"?"चालू किया":"बंद किया — अब यह व्यक्ति लॉगिन नहीं कर पाएगा")}catch(err){toast("नहीं हुआ")}return}
  const pp=e.target.closest("[data-prnpick]");if(pp){try{const list=await SE.printer.list();$("#prnList").innerHTML=list.length?list.map(d=>`<button class="big ghost" data-prnset="${esc(d.address)}" data-n="${esc(d.name||d.address)}" data-w="${pp.dataset.prnpick}">🖨️ ${esc(d.name||d.address)}</button>`).join(""):'<p class="note">कोई pair किया प्रिंटर नहीं मिला — फोन की Bluetooth सेटिंग में पहले pair करें।</p>'}catch(err){toast(err.msg||err.message||"Bluetooth की अनुमति दें")}return}
  const ps=e.target.closest("[data-prnset]");if(ps){SE.printer.pick(ps.dataset.prnset,ps.dataset.n,ps.dataset.w);renderSettings();toast("प्रिंटर चुन लिया: "+ps.dataset.n);return}
  if(e.target.closest("[data-prntest]")){printBill({no:"TEST",date:today(),ts:Date.now(),partyName:"टेस्ट",lines:[{name:"आलू",qty:1.5,unit:"kg",rate:20,amt:30}],total:30,pay:{cash:30},byName:biller()});return}
  if(e.target.closest("[data-migrate]")){migrateOld();return}
''')

# ---- रसीद: प्रिंट बटन ----
rep('''    ${!fresh&&S.isOwner&&!b.cancelled&&!S.demo?`<label class="fld" style="margin-top:10px">रद्द करने की वजह''',
    '''    <button class="big ghost" data-print style="margin-top:8px">🖨️ रसीद प्रिंट करें</button>
    ${!fresh&&S.isOwner&&!b.cancelled&&!S.demo?`<label class="fld" style="margin-top:10px">रद्द करने की वजह''')
rep('''    if(e.target.matches("[data-close]")){closeSheet();return}
    if(e.target.closest("[data-waask]"))''','''    if(e.target.matches("[data-close]")){closeSheet();return}
    if(e.target.closest("[data-print]")){printBill(b);return}
    if(e.target.closest("[data-waask]"))''')

# ---- स्कैनर: फोटो की जगह लाइव कैमरा ----
rep('$("#scanBtn").onclick=()=>$("#scanFile").click();',
    '''async function liveScan(){
  if(!SE.canLiveScan()){$("#scanFile").click();return}
  for(;;){let c;try{c=await SE.scan()}catch(e){toast("कैमरा नहीं खुला — "+(e.message||""));return}
    if(c===undefined){$("#scanFile").click();return}
    if(!c)return;
    await handleScan(c);
    if(!S.scanIn)return; // माल चढ़ाते समय लगातार स्कैन
  }
}
$("#scanBtn").onclick=liveScan;''')
rep('aria-label="बारकोड की फोटो से स्कैन करें">📷</button>','aria-label="कैमरे से बारकोड स्कैन करें">📷</button>')
s = s.replace("unpkg.com/@zxing/library@0.21.3/umd/index.min.js", "lib/zxing.min.js").replace('sc.src="https://lib/zxing.min.js"', 'sc.src="lib/zxing.min.js"')

# ---- boot: आर्टिफ़ैक्ट की जगह Firebase ----
rep('''  const use=n=>window.claude&&window.claude.use?window.claude.use(n).catch(()=>null):Promise.resolve(null);
  const [db,user,assets]=await Promise.all([use("db"),use("user"),use("assets")]);
  S.db=db;S.user=user;S.assets=assets;
  if(user){try{S.isOwner=await user.isOwner();const me=await user.me();S.uid=me.id;S.meName=me.name||""}catch(e){}}
  if(!db){loadDemo();showTab();return}''',
'''  let fb=null;try{fb=await SE.start()}catch(e){console.error(e)}
  if(!fb){loadDemo();showTab();if(!SE.configured)toast("डेमो मोड — Firebase अभी जुड़ा नहीं है");return}
  const db=fb.db;S.db=db;S.isOwner=fb.isOwner;S.uid=fb.uid;S.meName=fb.name;S.staff=fb.name;
  S.user={id:async()=>fb.uid,isOwner:async()=>fb.isOwner,me:async()=>({id:fb.uid,name:fb.name})};
  SE._busy=()=>S.saving||cartTotal()>0;
  renderTabs();
  SE.watchPhotos(()=>renderPane());
  if(S.isOwner)db.collection("staff").onSnapshot(s=>{S.staffDocs=s.docs.map(d=>({id:d.id,...d.data()}));if(S.tab==="set"&&!$("#p-set").contains(document.activeElement))renderSettings()},()=>{});
  setTimeout(()=>SE.checkUpdate(toast),4000);''')
rep('const S={db:null,user:null,assets:null,demo:false,isOwner:false,uid:null,meName:"",staff:"",',
    'const S={db:null,user:null,assets:null,demo:false,isOwner:false,uid:null,meName:"",staff:"",staffDocs:[],')

# ---- लोड कम: टॉप सब्ज़ी दिन में एक बार गिनें ----
rep('async function loadTop7(){\n  try{', 'async function loadTop7(){\n  if(lsGet("se_top7d")===today()&&Object.keys(S.top7||{}).length)return;\n  try{')
rep('if(Object.keys(sc).length){S.top7=sc;lsSet("se_top7",JSON.stringify(sc));', 'if(Object.keys(sc).length){S.top7=sc;lsSet("se_top7",JSON.stringify(sc));lsSet("se_top7d",today());')

# ---- रिपोर्ट: A4 प्रिंट / PDF ----
rep('''<h2 class="sec" style="margin:0;flex:1">मालिक की रिपोर्ट</h2><input class="inp" type="date" id="repDate" value="${date}" aria-label="तारीख"></div>''',
    '''<h2 class="sec" style="margin:0;flex:1">मालिक की रिपोर्ट</h2><input class="inp" type="date" id="repDate" value="${date}" aria-label="तारीख"></div>
  <button class="big ghost" data-a4 style="margin-bottom:10px">🖨️ A4 रिपोर्ट प्रिंट / PDF</button>''')
rep('''$("#p-report").addEventListener("click",e=>{''','''$("#p-report").addEventListener("click",e=>{if(e.target.closest("[data-a4]")){SE.printA4("दिन की रिपोर्ट · "+fdate(S.repDate),reportA4(S.repDate)).catch(err=>toast("प्रिंट नहीं हुआ: "+(err.message||"")));return}''')

# ---- UPI सेटिंग की लाइन ----
rep('· Google Pay · बदलनी हो तो Claude से कहें', '· Google Pay · बदलनी हो तो विक्रम जी Claude से बदलवाएँ')

# ---- नए फ़ंक्शन: प्रिंट, A4 रिपोर्ट, पुराना डेटा ----
EXTRA = r'''
/* ---------- प्रिंट ---------- */
async function printBill(b){
  try{
    const o=window.SF?SF.rcptOpts(b,!b.pay||(b.pay.udhar>0)):{shop:"सब्ज़ी एक्सप्रेस",date:fdate(b.date)+" "+ftime(b.ts),fq};
    const how=await SE.printReceipt(b,o);
    toast(how==="bt"?"🖨️ रसीद छप रही है":"प्रिंट खुल गया");
  }catch(err){toast(err.msg||("प्रिंट नहीं हुआ: "+(err.message||err.code||"")))}
}
function reportA4(date){
  const all=S.dayBills.filter(b=>!b.cancelled),sale=all.filter(b=>b.mode!=="inst"),inst=all.filter(b=>b.mode==="inst");
  const sum=(a,f)=>r2(a.reduce((x,b)=>x+f(b),0));
  const per={};all.forEach(b=>(b.lines||[]).forEach(l=>{const k=l.id+"|"+(b.mode==="inst"?"i":"s");const p=per[k]||(per[k]={name:l.name,unit:l.unit,inst:b.mode==="inst",q:0,amt:0,cost:0});p.q=r2(p.q+l.qty);p.amt=r2(p.amt+(l.amt||0));p.cost=r2(p.cost+(l.cost||0)*l.qty)}));
  const rows=Object.values(per).sort((a,b)=>b.amt-a.amt);
  const kh=sum(S.kharch||[],k=>k.amt||0);
  const tr=(c)=>`<tr>${c.map((x,i)=>`<td${i&&typeof x!=="string"?' class="r"':""}>${x}</td>`).join("")}</tr>`;
  return `<h2>सारांश</h2><table>
  ${tr(["कुल बिक्री (ग्राहक)",rs(sum(sale,b=>b.total))])}${tr(["नकद",rs(sum(sale,b=>b.pay.cash||0))])}${tr(["UPI",rs(sum(sale,b=>b.pay.upi||0))])}${tr(["उधार में",rs(sum(sale,b=>b.pay.udhar||0))])}
  ${tr(["संस्थाओं को (खरीद रेट)",rs(sum(inst,b=>b.total))])}${tr(["खर्चा",rs(kh)])}${tr(["बिल",String(sale.length)+" + संस्था "+inst.length])}
  ${tr(["रद्द बिल",String(S.dayBills.filter(b=>b.cancelled).length)])}</table>
  <h2>सब्ज़ी-वार</h2><table><tr><th>सब्ज़ी</th><th class="r">मात्रा</th><th class="r">रकम</th><th class="r">खरीद लागत</th><th class="r">फायदा</th></tr>
  ${rows.map(p=>`<tr><td>${esc(p.name)}${p.inst?" (संस्था)":""}</td><td class="r">${fq(p.q,p.unit)}</td><td class="r">${rs(p.amt)}</td><td class="r">${rs(p.cost)}</td><td class="r">${p.inst?"—":rs(r2(p.amt-p.cost))}</td></tr>`).join("")}</table>
  <h2>सभी बिल</h2><table><tr><th>बिल</th><th>समय</th><th>ग्राहक</th><th>बिलर</th><th class="r">रकम</th><th>भुगतान</th></tr>
  ${S.dayBills.map(b=>`<tr><td>${esc(b.no)}</td><td>${ftime(b.ts)}</td><td>${esc(b.partyName||"")}</td><td>${esc(b.byName||"")}</td><td class="r">${rs(b.total)}</td><td>${b.cancelled?"रद्द":[b.pay.cash?"नकद "+rs(b.pay.cash):"",b.pay.upi?"UPI "+rs(b.pay.upi):"",b.pay.udhar?"उधार "+rs(b.pay.udhar):"",b.mode==="inst"?"संस्था":""].filter(Boolean).join(", ")}</td></tr>`).join("")}</table>`;
}
async function migrateOld(){
  if(!S.isOwner||S.demo){toast("सिर्फ मालिक");return}
  try{toast("पुराना डेटा ला रहे हैं…");const r=await fetch("migrate.json",{cache:"no-store"});const m=await r.json();let n=0,skip=0;
    for(const [col,docs] of Object.entries(m)){for(const [id,data] of Object.entries(docs)){const ref=S.db.collection(col).doc(id);const g=await ref.get();if(g.exists){skip++;continue}await ref.set(data);n++}}
    toast(`✓ ${n} चीज़ें आईं · ${skip} पहले से थीं (नहीं बदलीं)`)}catch(err){
    if(/permission/i.test(err.code||err.message||"")){const d=await SE.ownerDiag();toast(d.ok?"अनुमति अब ठीक है — दोबारा दबाएँ":"सर्वर ने मना किया: "+d.why);return}
    toast("नहीं आया: "+(err.message||err.code||""))}
}
'''
rep('/* ---------- biller name ---------- */', EXTRA + '\n/* ---------- biller name ---------- */')

# ---- फ़ॉन्ट ऐप के अंदर (बिना नेट भी वही सुंदर अक्षर) ----
rep('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Mukta:wght@400;500;700&display=swap">',
    '<link rel="stylesheet" href="fonts/fonts.css">')

# v20: बिल सेटल होने से पहले शेयर — भुगतान खाली हो तो भी संदेश बने
rep("function receiptText(b){\n", "function receiptText(b){\n  b={...b,pay:b.pay||{}};\n")

# v20: ग्राहक का निशान (VIP / क्रेडिट / संस्था) + घर बैठे ऑर्डर नंबर
rep('["walk","आम ग्राहक",""],["udhar","उधार खाता","ud"]', '["walk","⭐ VIP ग्राहक",""],["udhar","उधार / क्रेडिट","ud"]')
rep(r"${L}\n🧾 बिल नं: ${b.no}", r"${L}\n*${SF.custTag(b)}*\n🧾 बिल नं: ${b.no}")
rep(r"if(S.settings.shopPh)t+=`📞 घर बैठे ऑर्डर: ${S.settings.shopPh}\n`;",
    r"if(SF.orderPh())t+=`\n📲 *घर बैठे ताज़ी सब्ज़ी मँगाएँ*\nWhatsApp या कॉल करें: *${SF.fmtPh(SF.orderPh())}*\nhttps://wa.me/91${SF.orderPh()}\n`;")

# v21: अंग्रेज़ी नाम + पोषण
rep('<script src="se-platform.js"></script>', '<script src="se-platform.js"></script>\n<script src="se-nutri.js"></script>')
rep('<span class="nm">${esc(it.name)}</span>', '<span class="nm">${esc(it.name)}${SN.en(it)?`<small class="en">${esc(SN.en(it))}</small>`:""}</span>')
rep('String(i.alias||"").toLowerCase().includes(ql)', 'String(i.alias||"").toLowerCase().includes(ql)||SN.en(i).toLowerCase().includes(ql)')
rep("t+=l.free?`${i+1}. ${l.name} ${fq", "t+=l.free?`${i+1}. ${SN.withEn(l.name)} ${fq")
rep(r":`${i+1}. ${l.name}\n    ${fq", r":`${i+1}. ${SN.withEn(l.name)}\n    ${fq")
rep(r"t+=`${L}\n🙏 धन्यवाद! फिर पधारें\n`;", r"""{const nt=SN.ofBill(b);if(nt){t+=`${L}\n🥗 *इस थैले में आपकी सेहत* _(लगभग)_\n`;const cs=SN.cells(nt);for(let i=0;i<cs.length;i+=2)t+=cs.slice(i,i+2).map(c=>`${c[0]} ${c[1]} *${c[2]}*`).join("  ·  ")+"\n";
    const hl=SN.headline(nt);if(hl)t+=`${hl}\n`;SN.top(nt,3).forEach(x=>t+=`⭐ ${x.name} (${x.en}): ${x.why}\n`);if(SN.cheer(nt))t+=SN.cheer(nt)+"\n";t+=`_${SN.note}_\n`}}
  t+=`${L}\n🙏 धन्यवाद! फिर पधारें\n`;""")

exec(open(__import__("os").path.join(__import__("os").path.dirname(__file__),"port_v15.py"),encoding="utf8").read())

# v22: 📍 रूट/लोकेशन, ग्राहक रजिस्टर, बिल भेजना, नया सामान, XYZ — असली कोड web/se-route.js में
rep('<section id="p-label" hidden></section>', '<section id="p-label" hidden></section>\n  <section id="p-route" hidden></section>')
rep('<script src="se-features.js"></script>', '<script src="se-features.js"></script>\n<script src="se-route.js"></script>')
rep('t.push(["label","लेबल"]);', 't.push(["label","लेबल"]);if(S.isOwner)t.push(["route","रूट"]);')
rep('"kharid","label"].forEach(k=>$("#p-"+k).hidden=S.tab!==k);$("#sbar").hidden=S.tab==="kharid"||S.tab==="label";',
    '"kharid","label","route"].forEach(k=>$("#p-"+k).hidden=S.tab!==k);$("#sbar").hidden=S.tab==="kharid"||S.tab==="label"||S.tab==="route";')
rep('  else if(S.tab==="label"){if(window.SF)SF.renderLabel()}', '  else if(S.tab==="label"){if(window.SF)SF.renderLabel()}\n  else if(S.tab==="route"){if(window.SR)SR.renderRoute()}')
rep('label:"🏷️",', 'label:"🏷️",route:"📍",')
rep('S.items=sortItems(s.docs.map(d=>({id:d.id,...d.data()})));', 'S.items=sortItems(s.docs.map(d=>({id:d.id,...d.data()})));if(window.SR)SR.addVirtual();')
rep('  }).join("");\n}\n$("#p-bill").addEventListener("click",e=>{', '  }).join("")+(window.SR?SR.addCardHTML():"");\n}\n$("#p-bill").addEventListener("click",e=>{')
rep('दूसरा नाम लिखकर देखें।</div>`;return}', 'दूसरा नाम लिखकर देखें।</div>`+(window.SR?SR.addCardHTML(q):"");return}')
rep('  const m=e.target.closest("[data-mode]");if(m){setMode(m.dataset.mode);return}', '  const ni=e.target.closest("[data-newitem]");if(ni&&window.SR){SR.newItemSheet(ni.dataset.newitem);return}\n  const m=e.target.closest("[data-mode]");if(m){setMode(m.dataset.mode);return}')
rep('function openQty(it,lineIdx){', 'function openQty(it,lineIdx){if(it&&it.id==="xyz"&&window.SR)return SR.xyzSheet(null,lineIdx);')
rep('function quickAdd(it,q){', 'function quickAdd(it,q){if(it&&it.id==="xyz"&&window.SR)return SR.xyzSheet(q);')
rep('amt:l.amt,changed:!!l.changed,free:!!l.free}));', 'amt:l.amt,changed:!!l.changed,free:!!l.free,...(l.note?{note:l.note}:{})}));')
rep('rateChanged:lines.some(l=>l.changed),cancelled:false};', 'rateChanged:lines.some(l=>l.changed),cancelled:false};if(window.SR)SR.stamp(bill);')
rep('S.saving=false;closeCurTab();refreshAfterCart();showReceipt(bill,true,offline);', 'if(window.SR&&bill.custPhone)SR.custHist(bill,bill.custPhone);S.saving=false;closeCurTab();refreshAfterCart();showReceipt(bill,true,offline);')
rep('$("#p-report").innerHTML=(window.SF?SF.cancelReqsHTML():"")', '$("#p-report").innerHTML=(window.SF?SF.cancelReqsHTML():"")+(window.SR?SR.pendingItemsHTML():"")')
rep('${S.items.map(it=>`<div class="setitem"', '${S.items.filter(i=>!i.virtual).map(it=>`<div class="setitem"')
rep('return S.items.filter(i=>!i.track&&(i.active!==false||st[i.id])).map(it=>{', 'return S.items.filter(i=>!i.track&&!i.virtual&&(i.active!==false||st[i.id])).map(it=>{')
rep(".toast{position:fixed;", """/* v22 रूट, ग्राहक, बिल भेजना, नया सामान */
.locbar{display:block;width:100%;border:0;background:#b91c1c;color:#fff;font-weight:800;font-size:14px;line-height:1.3;padding:10px 12px;text-align:center;border-radius:12px;margin-bottom:8px;animation:lbp 1.6s ease-in-out infinite}
@keyframes lbp{50%{background:#dc2626}}@media (prefers-reduced-motion:reduce){.locbar{animation:none}}
#shbox{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-end;justify-content:center}#shbox[hidden]{display:none}
.shb-scrim{position:absolute;inset:0;background:rgba(5,15,9,.55)}
.shb{position:relative;width:100%;max-width:520px;background:var(--surface);color:var(--ink);border-radius:24px 24px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 30px rgba(0,0,0,.25);animation:up .2s ease-out}
.shb h3{margin:0 0 2px;font-size:20px}
.card.addnew{border:2px dashed var(--leaf);background:transparent}.card.addnew .tile{display:flex;align-items:center;justify-content:center;background:var(--bg)}.card.addnew .em{font-size:30px}
.ragg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 0}.ragg .big{padding:10px 4px}
.rmap{position:relative;z-index:0;isolation:isolate;height:330px;border-radius:16px;overflow:hidden;margin:0 0 12px;background:var(--bg);box-shadow:var(--shadow)}
.rlive .livep{display:flex;align-items:center;gap:10px;padding:6px 0}.rlive .mid{flex:1;display:grid}.rlive .mid span{font-size:13px;color:var(--muted)}
.rstop{display:grid;grid-template-columns:64px 1fr auto;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line)}
.rs-t{display:grid;text-align:center;background:var(--bg);border-radius:10px;padding:4px}.rs-t b{font-size:14px}.rs-t span{font-size:11px;color:var(--muted)}
.rs-m{display:grid;min-width:0}.rs-m b{font-size:15px}
.rins{background:var(--bg);border-radius:10px;padding:8px 10px;margin:6px 0;font-size:14px}.rins.good{background:#e7f6ec;color:#14532d}.rins.bad{background:#fff3e0;color:#7c2d12}
.rtable{overflow-x:auto;margin-top:8px}.rtable table{width:100%;border-collapse:collapse;font-size:13px}.rtable th{font-size:11px;color:var(--muted);text-align:left;padding:4px}.rtable td{padding:6px 4px;border-top:1px solid var(--line)}.rtable .r{text-align:right;white-space:nowrap}
.audcard{border:2px solid #7c3aed;background:linear-gradient(135deg,rgba(124,58,237,.08),transparent)}
.toast{position:fixed;""")

s = s.replace("आम ग्राहक", "VIP ग्राहक")
# टीम के लिए "स्टाफ" शब्द नहीं
s = s.replace("सब स्टाफ के फोन", "सब कर्मचारियों के फोन").replace("स्टाफ", "कर्मचारी")

open(dst, "w", encoding="utf8").write(s)
print("ok", len(s))
