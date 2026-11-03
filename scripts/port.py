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
.locbar{display:block;width:100%;border:0;background:#fff4e5;color:#92400e;border:1.5px solid #f59e0b;font-weight:800;font-size:14px;line-height:1.3;padding:9px 12px;text-align:center;border-radius:12px;margin-bottom:8px}
.morning{display:grid;gap:2px;background:linear-gradient(135deg,#fff7e6,var(--surface));border:1.5px solid #fbbf24;border-radius:16px;padding:10px 14px;margin:0 0 12px;color:var(--ink)}.morning span{font-size:14px}.morning small{color:var(--muted);font-size:12px}
.nrev{border:2px solid #f59e0b}.nrev.ok{border-color:var(--leaf)}
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

# v23: खरीद — बिक्री जैसा आसान (टाइल → मात्रा/भाव → कागज़ी खरीद बिल → छूट → सेव)
rep(".toast{position:fixed;", """/* v23 खरीद */
.supcard{display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(124,58,237,.10),var(--surface));border:1.5px solid rgba(124,58,237,.35);border-radius:18px;padding:12px 14px;box-shadow:var(--shadow)}
.supcard .mid{flex:1;display:grid;min-width:0}.supcard b{font-size:18px}.supcard .mid span{font-size:13px;color:var(--muted)}
.supav{width:42px;height:42px;border-radius:12px;background:#ede9fe;display:flex;align-items:center;justify-content:center;font-size:22px;flex:none}
.supopt{display:flex;align-items:center;gap:10px;width:100%;border:0;border-bottom:1px solid var(--line);background:var(--surface);color:var(--ink);padding:10px 12px;text-align:left}
.supopt .mid{flex:1;display:grid}.supopt .mid span{font-size:12.5px;color:var(--muted)}
.nsbox summary{font-weight:800;color:var(--leaf);padding:6px 0;cursor:pointer}
.big-in{font-size:22px!important;font-weight:800;text-align:center}
.pbarbtn{background:#6d28d9;color:#fff}
.toast{position:fixed;""")

# v24: मालिक का UPI मिलान, भाव बदलना, मुनाफ़ा %, गाड़ी में माल, खराबी, खर्चा
rep('<script src="se-route.js"></script>', '<script src="se-route.js"></script>\n<script src="se-pay.js"></script>')
rep('set({items:S.stock.items||{},ts:Date.now(),by:S.uid||"",byName:biller()})', 'set({items:S.stock.items||{},wlog:S.stock.wlog||[],nightBy:S.stock.nightBy||"",nightTs:S.stock.nightTs||0,ts:Date.now(),by:S.uid||"",byName:biller()})')
rep('const quick=["डीज़ल","मंडी भाड़ा","हम्माली","पॉलीथीन","चाय-नाश्ता"];', 'const quick=["गाड़ी किराया","पेट्रोल / डीज़ल","गाड़ी रिपेयर","मंडी भाड़ा","हम्माली","पॉलीथीन / थैली","चाय-नाश्ता"];')
rep('$("#cats").innerHTML=CATS.map(', '$("#cats").innerHTML=(window.SR?SR.rateChipHTML():"")+CATS.map(')
rep('  const ni=e.target.closest("[data-newitem]");', '  if(e.target.closest("[data-ratemode]")){S.rateMode=!S.rateMode;renderBill();if(S.rateMode)toast("✏️ अब जिस सामान का भाव बदलना है, उसे दबाएँ");return}\n  const rmi=S.rateMode&&e.target.closest("[data-item]");if(rmi&&window.SR){SR.rateSheet(item(rmi.dataset.item));return}\n  const ni=e.target.closest("[data-newitem]");')
rep('"रेट बाकी"}</span></button>', '"रेट बाकी"}</span>${S.isOwner&&window.SR?SR.marginHTML(it,p):""}</button>')
rep('$("#grid").innerHTML=list.map(it=>{', 'const LL=window.SF&&SF.liveLeftMap?SF.liveLeftMap():null;$("#grid").innerHTML=list.map(it=>{')
rep('const left=stockLeft(it.id);', 'let left=stockLeft(it.id);if(left==null&&LL&&LL[it.id]!=null)left=LL[it.id];')
rep(".toast{position:fixed;", """/* v24 */
.qstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 12px}
.qstrip button{display:grid;justify-items:center;gap:2px;border:0;border-radius:14px;background:var(--surface);box-shadow:var(--shadow);padding:10px 4px;font-size:22px;color:var(--ink)}
.qstrip button span{font-size:12.5px;font-weight:800}
.card .mg{display:block;font-size:11px;font-weight:800;padding:0 9px 7px;color:#15803d}.card .mg.mid{color:#b45309}.card .mg.bad{color:var(--chili)}
.grid .card .mg{padding:0 7px 6px}
.ratechip{border-color:#7c3aed!important;color:#6d28d9}.ratechip.on{background:#7c3aed!important;color:#fff!important}
.shoprow{display:grid;grid-template-columns:1.4fr 1fr;gap:8px}
.spcard{border:2px solid #0f766e;background:linear-gradient(135deg,rgba(15,118,110,.10),var(--surface));border-radius:18px;padding:12px 14px;margin:0 0 12px;box-shadow:var(--shadow)}
.sp-h{display:flex;justify-content:space-between;align-items:center;gap:8px}.sp-h b{font-size:17px}
.sp-need{display:grid;gap:2px;font-size:13px;margin:4px 0 8px}
.sp-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sp-btns .big{padding:10px 6px;font-size:14.5px}
.spinfo{background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:8px 10px;font-size:13px;margin:8px 0}
.sp-prev{display:flex;gap:10px;align-items:flex-start}.sp-prev input{margin-top:5px;width:20px;height:20px}
.toast{position:fixed;""")

# v25: उधार वसूली (पुराना बाकी, याद दिलाएँ, जमा रसीद), PIN दिखे/बदले, 1 घंटे बाद PIN
rep('<div class="kpis"><div class="kpi hero"><span>कुल बकाया (सबका मिलाकर)</span><b>${rs(total)}</b></div></div>', '<div class="kpis"><div class="kpi hero"><span>कुल बकाया (सबका मिलाकर)</span><b>${rs(total)}</b></div></div>\n  ${window.SR?SR.udharTopHTML():""}')
rep('href="${waLink(`नमस्ते ${p.name} जी, सब्ज़ी एक्सप्रेस का आपका बाकी हिसाब ₹${b} है। कृपया भुगतान कर दें। UPI: ${upiId()} 🙏`,p.phone)}">WhatsApp पर बकाया याद दिलाएँ</a>', 'href="${waLink(window.SR?SR.remindText(p,b):`नमस्ते ${p.name} जी, सब्ज़ी एक्सप्रेस का आपका बाकी हिसाब ₹${b} है। UPI: ${upiId()} 🙏`,p.phone)}" data-remone="1">🟢 WhatsApp पर बकाया याद दिलाएँ</a>\n    ${window.SR?SR.openingHTML(p):""}')
rep('${l.type==="udhar"?"उधार · बिल "+esc(l.billNo||""):"जमा · "+(l.mode==="upi"?"UPI":"नकद")}', '${l.type==="udhar"?(l.opening?"📜 पुराना बाकी"+(l.note?" · "+esc(l.note):""):"उधार · बिल "+esc(l.billNo||"")):"जमा · "+(l.mode==="upi"?"UPI":"नकद")}')
rep('    const m=e.target.closest("[data-jm]");if(m){st.mode=m.dataset.jm;', '    if(e.target.closest("[data-opbal]")){if(window.SR&&await SR.saveOpening(p)){closeSheet();renderPane();setTimeout(()=>openParty(pid),300)}return}\n    if(e.target.closest("[data-remone]")&&!S.demo){S.db.collection("parties").doc(pid).update({remindTs:Date.now()}).catch(()=>{})}\n    const m=e.target.closest("[data-jm]");if(m){st.mode=m.dataset.jm;')
rep('toast(rs(amt)+" जमा हुए");closeSheet();renderPane()}', 'toast(rs(amt)+" जमा हुए");closeSheet();renderPane();if(window.SR)setTimeout(()=>SR.jamaDone(p,r2(amt),st.mode),250)}')
rep('<span class="note">${esc(x.phone||"")} · ${x.active===false?"बंद":"चालू"}</span>', '<span class="note">${esc(x.phone||"")} · ${x.active===false?"बंद":"चालू"}</span>${window.SR&&x.active!==false?SR.pinHTML(x):""}')
rep(".toast{position:fixed;", ".plock{position:fixed;inset:0;z-index:90;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px}\n.pl-box{display:grid;justify-items:center;gap:10px;width:100%;max-width:340px;text-align:center}.pl-logo{font-size:44px}.pl-box b{font-family:var(--f-display);font-size:26px}.pl-box>span{color:var(--muted)}\n.pl-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%}.pl-keys button{border:0;border-radius:16px;background:var(--surface);box-shadow:var(--shadow);font-size:26px;font-weight:800;padding:14px 0;color:var(--ink)}\n.pl-err{color:var(--chili);font-weight:800;margin:0}\n.lsgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.lsgrid div{display:grid;background:var(--bg);border-radius:10px;padding:6px 8px}.lsgrid b{font-size:13px}.lsgrid span{font-weight:800;font-size:15px}.lsgrid small{color:var(--muted);font-size:11px}\n.livestk{border:2px solid var(--leaf)}\n.toast{position:fixed;")

# v26: चेकआउट का कसा हुआ बिल
rep(".toast{position:fixed;", ".paper.pp-c{margin:0 2px 8px;padding:10px 12px 12px}.paper.pp-c::after{display:none}\n.ppc-head{display:flex;align-items:center;gap:6px;border-bottom:2px solid #1b1b1b;padding-bottom:5px}.ppc-head b{font-family:'Baloo 2',sans-serif;font-size:19px;font-weight:800;flex:1;line-height:1.1}.ppc-logo{font-size:20px}\n.ppc-tag{font-size:12px;font-weight:800;border-radius:999px;padding:2px 9px;white-space:nowrap}.ppc-tag.vip{background:linear-gradient(90deg,#b8860b,#f5c542);color:#1c1300}.ppc-tag.ud{border:1.5px solid #d64545;color:#b42d2d}.ppc-tag.inst{border:1.5px solid #2f6fdb;color:#2457b5}\n.ppc-meta{display:flex;justify-content:space-between;gap:6px;font-size:12px;color:#444;margin:4px 0 2px;flex-wrap:wrap}.ppc-meta b{color:#000}.ppc-cust{font-weight:700;color:#222}\n.ppc-t{font-size:13.5px}.ppc-t th{font-size:11px;padding:3px 2px;border-bottom:1.5px dashed #999}.ppc-t td{padding:3px 2px}.ppc-t .pp-en{font-size:10px;color:#777}.ppc-t .pp-x{width:24px;height:24px;border-radius:7px;font-size:12px}\n.ppc-foot{display:flex;align-items:center;gap:12px;border-top:1.5px dashed #999;margin-top:6px;padding-top:8px}.ppc-foot.noqr{justify-content:flex-end}\n.ppc-qr{flex:none;width:124px;height:124px;background:#fff;padding:2px;border-radius:6px}.ppc-qr canvas,.ppc-qr img{width:120px!important;height:120px!important;display:block}\n.ppc-tot{flex:1;display:grid;justify-items:end;text-align:right;gap:2px}.ppc-tot span{font-size:12px;color:#555}.ppc-tot b{font-family:'Baloo 2',sans-serif;font-size:40px;line-height:1;color:#111}.ppc-tot small{font-size:11px;color:#666;line-height:1.3}\n.ppc-under{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 2px 10px}.ppc-disc{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;color:var(--muted)}.ppc-disc .inp{width:90px;padding:6px 8px;font-size:16px}\n.ppc-sh{padding-bottom:4px}.ppc-sh h3{font-size:18px;margin:0}\n.toast{position:fixed;")

# v27: पहले सेव, फिर भुगतान; सेव के बाद बिल बदलना
rep('<script src="se-pay.js"></script>', '<script src="se-pay.js"></script>\n<script src="se-bill.js"></script>')
rep('rateChanged:lines.some(l=>l.changed),cancelled:false};', 'rateChanged:lines.some(l=>l.changed),cancelled:false,settled:c.pay!=="pending"};')
rep('await adjStock(trackedPairs(lines,-1),"बिल "+c.no);S.saving=false;closeCurTab();refreshAfterCart();showReceipt(bill,true);return}', 'await adjStock(trackedPairs(lines,-1),"बिल "+c.no);S.saving=false;closeCurTab();refreshAfterCart();if(bill.settled===false&&window.SB)SB.settleSheet(bill);else showReceipt(bill,true);return}')
rep('S.saving=false;closeCurTab();refreshAfterCart();showReceipt(bill,true,offline);', 'S.saving=false;closeCurTab();refreshAfterCart();if(bill.settled===false&&window.SB)SB.settleSheet(bill,offline);else showReceipt(bill,true,offline);')
rep('    ${receiptHTML(b)}\n    ${S.isOwner&&window.SF&&SF.billLabel(b.no)', '    ${receiptHTML(b)}\n    ${window.SB?SB.receiptActionsHTML(b):""}\n    ${S.isOwner&&window.SF&&SF.billLabel(b.no)')
rep('$("#custbox").innerHTML=cb;', '$("#custbox").innerHTML=(window.SB?SB.pendingHTML():"")+cb;')
rep('''$("#p-report").innerHTML=(window.SF?SF.cancelReqsHTML():"")''', '''$("#p-report").innerHTML=(window.SF?SF.cancelReqsHTML():"")+(window.SB?SB.editsHTML():"")''')
rep(".toast{position:fixed;", ".sb-qr{display:flex;gap:12px;align-items:center;background:#fff;color:#111;border-radius:16px;padding:10px;margin:8px 0}.sb-qr>div:last-child{display:grid;gap:2px}.sb-qr b{font-family:var(--f-display);font-size:30px}\n.sb-change{font-size:18px;margin:6px 0 10px}.sb-change b{color:var(--leaf)}\n.sb-party{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--chili-bg,#fdecec);border-radius:12px;padding:8px 12px;margin:8px 0}\n.sb-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}\n.sbe-list{display:grid;gap:6px}.sbe-row{display:grid;grid-template-columns:1fr auto 64px;gap:8px;align-items:center;background:var(--surface);border-radius:12px;padding:8px 10px;box-shadow:var(--shadow)}.sbe-row.gone{opacity:.45}\n.sbe-n{display:grid}.sbe-n b{font-size:16px}.sbe-n span{font-size:12px;color:var(--muted)}\n.sbe-q{display:flex;align-items:center;gap:4px}.sbe-q button{width:36px;height:36px;border:0;border-radius:10px;background:var(--bg);font-size:22px;font-weight:800;color:var(--ink)}.sbe-q input{width:64px;text-align:center;border:1.5px solid var(--line);border-radius:10px;padding:6px 2px;font-size:17px;font-weight:800;background:var(--bg);color:var(--ink)}\n.sbe-a{text-align:right}.sbe-add{margin-top:10px}\n.sb-pend{background:#fff7e6;border:1.5px solid #f59e0b;border-radius:14px;padding:8px 10px;margin:0 0 10px;color:#7c2d12}.sb-pend>div{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.sb-pend button{border:0;border-radius:999px;background:#f59e0b;color:#fff;font-weight:800;padding:6px 12px}\n.sb-ract{margin:8px 0;display:grid;gap:6px}\n.paper.pp-c{border-radius:14px;overflow:hidden;padding:0 0 12px;box-shadow:0 10px 26px rgba(0,0,0,.22)}\n.paper.pp-c .ppc-head{background:linear-gradient(135deg,#14532d,#1f8a4c);color:#fff;border:0;padding:9px 12px}.paper.pp-c .ppc-head b{color:#fff}\n.paper.pp-c .ppc-meta,.paper.pp-c .ppc-t,.paper.pp-c .pp-row{margin-left:12px;margin-right:12px;width:auto}.paper.pp-c .ppc-t{width:calc(100% - 24px)}\n.paper.pp-c .ppc-meta b{background:#ecfdf5;color:#14532d;border-radius:6px;padding:0 6px}\n.ppc-t tbody tr:nth-child(even) td{background:#f7faf7}\n.paper.pp-c .ppc-foot{margin:8px 12px 0}.ppc-qr{border:2px solid #14532d;border-radius:10px;position:relative;padding:3px}.ppc-qr::after{content:'UPI';position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#14532d;color:#fff;font-size:10px;font-weight:800;border-radius:6px;padding:0 6px}\n.toast{position:fixed;")

# v28: कॉपी की पुरानी उधारी
rep(".toast{position:fixed;", ".oldud{background:var(--surface);border-radius:14px;padding:8px 12px;margin:0 0 8px;box-shadow:var(--shadow)}.oldud summary{cursor:pointer;line-height:1.5}\n.oldud-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px;margin-top:6px}.oldud-g label{display:flex;align-items:center;gap:6px;background:var(--bg);border-radius:8px;padding:4px 8px;font-size:14px;flex-wrap:wrap}.oldud-g label b{margin-left:auto}.oldud-g label.today{outline:2px solid #f59e0b}.oldud-g small{width:100%;color:#b45309;font-size:11px}\n.toast{position:fixed;")

# v29: "बिल देखें" = पक्का सेव; संस्था को खरीद भाव का चालान + लोगों को रिपोर्ट; पुरानी उधारी अपने-आप + एंट्री बदलना
rep('function priceOf(it){return S.mode==="inst"?(window.SF?SF.costOf(it):(+it.cost||0)):(+it.sale||0)}',
    'function priceOf(it){return +it.sale||0} /* संस्था: चुनते समय बिक्री भाव, सेव होते ही खरीद भाव (SB.instReprice) */')
rep('''  S.chk={no:_keep||(window.SF?"…":newBillNo()),disc:0,pay:S.mode==="inst"?"inst":"cash",given:"",cashPart:"",upiOk:false};
  drawCheckout();
  if(!_keep&&window.SF){const c0=S.chk;SF.reserveBillNo().then(n=>{if(_t){_t.no=n;_t.noDate=today();lsSet("se_tabs",JSON.stringify(S.bt))}if(S.chk===c0){c0.no=n;if($("#sheet .sh-head"))drawCheckout()}})}''',
'''  if(S.saving)return;
  S.chk={no:_keep||(window.SF?"…":newBillNo()),disc:0,pay:S.mode==="inst"?"inst":"pending",given:"",cashPart:"",upiOk:false};
  if(window.SB&&SB.autoSave){SB.autoSave();return}
  drawCheckout();''')
rep('  if(c.no==="…"&&window.SF)c.no=await SF.reserveBillNo();',
    '  if(c.no==="…"&&window.SF){S.saving=true;drawCheckout();try{c.no=await SF.reserveBillNo()}finally{S.saving=false}}')
rep('settled:c.pay!=="pending"};if(window.SR)SR.stamp(bill);', 'settled:c.pay!=="pending"};if(window.SR)SR.stamp(bill);if(bill.mode==="inst"&&window.SB)SB.instReprice(bill);')
rep('function receiptText(b){\n  b={...b,pay:b.pay||{}};', 'function receiptText(b){\n  if(b.mode==="inst"&&window.SB)return SB.instText(b,null);\n  b={...b,pay:b.pay||{}};')
rep('<span>${fdate(l.date)} ${ftime(l.ts)} · ${esc(l.byName||"")}</span></div><div class="rt"',
    '<span>${fdate(l.date)} ${ftime(l.ts)} · ${esc(l.byName||"")}${l.opening&&window.SR?SR.opEditBtn(l):""}</span></div><div class="rt"')
rep(r'''<textarea class="inp" id="s-insts" data-sf="insts" rows="4">${esc(insts().join("\n"))}</textarea></label>''',
    r'''<textarea class="inp" id="s-insts" data-sf="insts" rows="4">${esc(insts().join("\n"))}</textarea></label>${window.SB?SB.peopleBtnHTML():""}''')
rep(".toast{position:fixed;", """.sb-saving{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;font-size:18px}.sb-spin{width:22px;height:22px;border-radius:50%;border:3px solid var(--leaf);border-top-color:transparent;animation:sbspin .8s linear infinite}@keyframes sbspin{to{transform:rotate(360deg)}}
.sb-saved{background:#e7f6ec;color:#11502b;border-radius:12px;padding:6px 10px;font-weight:800;margin:0 0 6px;text-align:center}.sb-upin{margin:0 0 8px;text-align:center}
.pp-edit{margin:6px 0 2px;padding:5px 8px;border:1.5px dashed #7c3aed;border-radius:8px;color:#5b21b6;font-size:12.5px;line-height:1.4}
.ch-to{font-family:'Baloo 2',sans-serif;font-size:22px;font-weight:800;text-align:center;margin:4px 0 2px}
.ch-tot{display:grid;justify-items:center;gap:0;margin:6px 0 4px;text-align:center}.ch-tot span{font-weight:700}.ch-tot b{font-family:'Baloo 2',sans-serif;font-size:30px;line-height:1.1}.ch-tot small{color:#555}
.ch-warn{color:#b42318;font-size:12.5px;margin:4px 0}.ch-sign{display:flex;justify-content:space-between;gap:12px;margin-top:22px;font-size:12px;color:#555}.ch-sign span{flex:1;border-top:1px solid #999;padding-top:3px;text-align:center}
.ic-box{background:var(--surface);border-radius:14px;padding:10px 12px;margin:8px 0;box-shadow:var(--shadow);display:grid;gap:6px}
.ic-btn{display:flex;align-items:center;justify-content:space-between;gap:8px;text-decoration:none;color:inherit;background:#e9f9ee;border:1.5px solid #25d366;border-radius:12px;padding:8px 10px;font:inherit;text-align:left;width:100%;cursor:pointer}.ic-btn span{display:grid;font-weight:800}.ic-btn small{font-weight:500;color:#4b5563}.ic-btn i{font-style:normal;font-weight:800;color:#0b7a35;white-space:nowrap}
.ic-btn.off{background:transparent;border-style:dashed;border-color:#bbb}.ic-btn.off i{color:#888}
.ic-grp{background:var(--surface);border-radius:14px;padding:8px 10px;margin:0 0 8px;box-shadow:var(--shadow)}.ic-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 0;border-bottom:1px dashed #ccc}.ic-row select{grid-column:1/-1}
.toast{position:fixed;""")

# v31: ⚡ एक टैप बिल — QR हर बिल पर, रसीद में भी
rep(r"t+=`${L}\n🙏 धन्यवाद! फिर पधारें\n`;", r"{const q=window.SF&&SF.qrFor&&SF.qrFor(b);if(q)t+=`${L}\n📱 *UPI:* ${upiId()}\n${q.label}\n`}if(b.byName&&b.mode!=='inst')t+=`🧑‍🌾 बिलिंग: *${b.byName}*\n`;t+=`${L}\n🙏 धन्यवाद! फिर पधारें\n`;")
rep('function receiptHTML(b){if(window.SF)return SF.paperHTML(b,{});', 'function receiptHTML(b){if(window.SF)return SF.paperHTML(b,{qr:true});')
rep('  $("#sheet").oninput=e=>{if(e.target.id==="waPh")', '  if(window.SF&&SF.drawPaperQR)SF.drawPaperQR(b,"ppqr",240);\n  $("#sheet").oninput=e=>{if(e.target.id==="waPh")')
rep(".toast{position:fixed;", ".paym.paym4{grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}.paym4 button{display:grid;justify-items:center;gap:1px;padding:7px 2px;font-size:13px;border-radius:12px;line-height:1.15}.paym4 button i{font-style:normal;font-size:19px}.sb-act4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}.sb-act4 button{display:grid;justify-items:center;gap:1px;border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:6px 2px;font:inherit;font-weight:700;font-size:12px;color:var(--ink)}.sb-act4 i{font-style:normal;font-size:18px}.sb-bot{display:grid;grid-template-columns:1fr 2.3fr;gap:8px}.sb-bot .big{margin:0;padding:12px 8px}.sb-bot .ghost{font-size:14px}.sb-line{display:flex;align-items:center;gap:6px;font-weight:700;margin:2px 0 4px;flex-wrap:wrap}.sb-line .inp{width:6.5em;padding:8px;text-align:right}.sb-ok{font-size:12px;background:var(--ok-bg);color:#14532d;border-radius:8px;padding:2px 8px;vertical-align:middle}.sb1 .sb-upin{margin:0 0 2px;font-size:12px}.ppc-by{margin-top:0!important}.ppc-t tr.tap{cursor:pointer}.ppc-t tr.tap:active{background:#fef3c7}.sb1 .ppc-qr{width:154px;height:154px}.sb1 .ppc-qr canvas,.sb1 .ppc-qr img{width:146px!important;height:146px!important}.pp-qr canvas,.pp-qr img{width:150px!important;height:150px!important}.sb-cx{margin-left:auto;margin-right:8px;border:1.5px solid var(--chili);color:var(--chili);background:transparent;border-radius:10px;padding:4px 10px;font:inherit;font-weight:800;font-size:13px}.sb-cx.wait{border-style:dashed;color:#92400e;border-color:#d97706}.sb1 .sh-head{margin-bottom:6px}.sb1 .ppc-head{padding:6px 12px}.mbuy{border:2px solid #d97706}.mbuy-l{display:flex;flex-wrap:wrap;gap:6px}.mbuy-l span{background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:3px 8px;font-size:14px}.obrief{border:2px solid #14532d}.ob-g{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ob-g>div{display:grid;background:#f0fdf4;border-radius:12px;padding:8px}.ob-g span{font-size:12px;color:#444}.ob-g b{font-size:20px}.ob-g small{font-size:11px;color:#555;line-height:1.3}.rt-f{display:grid;gap:6px;margin:0 0 8px}.rt-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.rt-chips .inp{width:auto;flex:1;min-width:140px;padding:8px}.rt-chips .chip[aria-pressed=true]{background:#14532d;color:#fff;border-color:#14532d}.rdot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:middle}.rmapw{position:relative;margin:0 0 8px}.rmapw .rmap{height:62vh;min-height:360px;margin:0;border-radius:16px}.rmapw.big{position:fixed;inset:0;z-index:60;background:#000;margin:0}.rmapw.big .rmap{height:100%;border-radius:0}.rctl{position:absolute;right:8px;top:8px;z-index:500;display:grid;gap:6px}.rctl button{border:0;border-radius:10px;padding:7px 10px;font:inherit;font-weight:800;font-size:12px;background:rgba(255,255,255,.95);color:#111;box-shadow:0 2px 8px rgba(0,0,0,.35)}.rctl button[aria-pressed=false]{opacity:.6}.leaflet-tooltip.rlbl{background:rgba(15,23,42,.72);color:#fff;border:0;box-shadow:none;font-weight:700;font-size:11px;padding:1px 6px;border-radius:8px}.leaflet-tooltip.rlbl::before{display:none}.nolbl .leaflet-tooltip.rlbl{display:none}.rpin{display:grid;place-items:center;font-size:13px;color:#fff;font-weight:900}.rpin.st{background:#16a34a;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.5)}.rpin.en{font-size:20px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}.rstopi span{display:block;text-align:center;border-radius:50%;background:#64748b;color:#fff;font-weight:900;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5)}.rstopi span.sale{background:#16a34a}.rvan span{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;background:#fff;border:2.5px solid #f97316;border-radius:14px;padding:1px 7px 1px 4px;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,.45)}.rvan b{font-size:11px;color:#111}.rvan i{font-style:normal;font-size:10px;color:#555}.rvan.old span{opacity:.7;border-style:dashed}.rvan.find span{border-color:#2563eb}.rplay{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;background:var(--surface);border-radius:14px;padding:8px 10px;box-shadow:var(--shadow);margin:0 0 8px}.rp-btn{width:46px;height:46px;border-radius:50%;border:0;background:#f59e0b;color:#111;font-size:20px;font-weight:900}.rp-mid{display:grid;gap:2px;min-width:0}.rp-mid input{width:100%;accent-color:#f59e0b}.rp-info{font-size:12px;color:var(--muted);line-height:1.3}.rp-info b{color:var(--ink);font-size:15px}.rp-spd{grid-column:1/-1;display:flex;gap:6px}.rp-spd button{flex:1;border:1.5px solid var(--line);background:transparent;color:var(--ink);border-radius:10px;padding:5px;font:inherit;font-size:12px;font-weight:700}.rp-spd button[aria-pressed=true]{background:#f59e0b;color:#111;border-color:#f59e0b}.kpis.k3{grid-template-columns:repeat(3,1fr);gap:6px}.kpis.k3 .kpi{padding:8px}.kpis.k3 .kpi span{font-size:11px}.rstop{grid-template-columns:26px 64px 1fr auto;cursor:pointer}.rs-no{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#16a34a;color:#fff;font-weight:900;font-size:12px}.rplace{border-bottom:1px solid var(--line);padding:6px 0}.rp-n{display:grid;width:100%;text-align:left;background:none;border:0;padding:2px 0;font:inherit;color:var(--ink)}.rp-a{font-size:12px}.rthumb{height:190px;border-radius:14px;overflow:hidden;margin:4px 0;isolation:isolate;z-index:0;position:relative}.rphoto{width:100%;max-height:240px;object-fit:cover;border-radius:14px;margin:4px 0}.rbl{display:grid;gap:6px}.rb{display:flex;gap:8px;align-items:center;background:var(--surface);border-radius:12px;padding:8px 10px;box-shadow:var(--shadow)}.rb-m{display:grid;flex:1;min-width:0;gap:1px}.rb-m small{color:var(--muted);font-size:11px}.rb-m .pill{font-size:11px;margin-left:4px}.rb-a{display:flex;gap:8px;font-size:20px}.rb-a a,.rb-a button{text-decoration:none;font-size:20px}.rcrow{display:flex;gap:6px;align-items:center}.rcrow .li{flex:1}.rc-map{flex:none}.ns2 #nsq{margin:0 0 6px}.ns-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-height:34vh;overflow:auto;padding:2px}.ns-t{position:relative;display:grid;justify-items:center;gap:2px;border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:4px 2px;font:inherit;font-size:11px;font-weight:700;color:var(--ink)}.ns-t .tile{width:100%;aspect-ratio:1;border-radius:9px;overflow:hidden}.ns-t.on{border-color:#16a34a;background:#f0fdf4}.ns-t b{position:absolute;top:2px;right:2px;background:#16a34a;color:#fff;border-radius:8px;padding:0 4px;font-size:10px}.ns-l{display:grid;gap:4px}.ns-r{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;background:var(--surface);border-radius:10px;padding:7px 10px;box-shadow:var(--shadow);cursor:pointer}.ns-r b{font-size:15px}.ns-r small{color:var(--muted);font-size:11px}.ns-sum{display:flex;justify-content:space-between;align-items:baseline;border-top:2px dashed var(--line);margin:10px 0 8px;padding-top:8px}.ns-sum span{font-size:13px;color:var(--muted)}.ns-sum b{font-size:24px}.ns-sum.big b{font-size:32px;color:#16a34a}.ns-pop{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.45);display:grid;align-items:end}.ns-pb{background:var(--bg);border-radius:20px 20px 0 0;padding:14px 16px 18px;box-shadow:0 -6px 24px rgba(0,0,0,.3)}.ns-kg{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:8px 0}.ns-kg button,.ns-pc button{border:1.5px solid var(--line);background:var(--surface);color:var(--ink);border-radius:10px;padding:10px 2px;font:inherit;font-weight:800}.ns-pc{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.ns-pc button{font-size:24px}.ns-in{display:flex;align-items:center;gap:8px}.ns-in .inp{flex:1;font-size:24px;text-align:center}.ns-in span{font-weight:800}.adv{border-radius:12px;padding:8px 10px;margin:6px 0}.adv h4{margin:0 0 4px}.adv p{margin:0}.adv.hi{background:#fef2f2;border:1.5px solid #fca5a5}.adv.mid{background:#fffbeb;border:1.5px solid #fcd34d}.adv.lo{background:#f0fdf4;border:1.5px solid #86efac}.adv-t{display:grid;gap:4px}.adv-t div{display:grid}.adv-t span{font-size:12px;color:#444}.rt small.pf{display:block;font-weight:800;color:#15803d;font-size:11px}.rt small.pf.low{color:#b45309}.rt small.pf.neg{color:#b91c1c}.rt small.pf.z{color:#64748b}.pfk{display:grid;background:#f0fdf4;border:2px solid #16a34a;border-radius:14px;padding:8px 12px;margin:0 0 10px}.pfk span{font-size:13px;color:#14532d;font-weight:700}.pfk span small{font-weight:500;color:#555}.pfk b{font-size:26px;color:#15803d}.pfk>small{font-size:12px;color:#555}.cpy{border:2px dashed #7c3aed}.cpy h4{margin:10px 0 4px}.cpt{width:100%;border-collapse:collapse;font-size:13px}.cpt td,.cpt th{padding:4px 6px;border-bottom:1px solid var(--line)}.cpt .r{text-align:right}.cpt tr.bad td,.cpt td.bad{color:#b91c1c;font-weight:700}.cpd{display:grid;gap:6px;background:#f5f3ff;border-radius:12px;padding:8px 10px}.cpd>span{font-weight:800;font-size:14px}.cpd .chip[aria-pressed=true]{background:#7c3aed;color:#fff;border-color:#7c3aed}.cpd-now{color:#6d28d9}.ppc-sum small.roff{display:block;font-size:10.5px;color:#6b7280}.pp-row.roff{font-size:12px;color:#6b7280}.ppc-sum{display:flex;justify-content:space-between;align-items:baseline;border-top:1.5px dashed #999;margin:8px 12px 0;padding-top:6px}.ppc-sum span{font-size:12px;color:#555}.ppc-sum b{font-family:'Baloo 2',sans-serif;font-size:26px;line-height:1;color:#111}.ppc-row3,.pp-row3{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;margin:8px 10px 0}.pp-row3{margin:10px 0 0}.ppc-row3{grid-template-columns:1fr auto 1fr;gap:4px;margin:8px 6px 0}.ppc-row3 .ppc-qr{width:176px;height:176px;padding:7px;border:3px solid #14532d;border-radius:16px;box-shadow:0 0 0 3px #fff,0 0 0 5px #86efac,0 6px 14px rgba(20,83,45,.18);background:#fff}.ppc-row3 .ppc-qr canvas,.ppc-row3 .ppc-qr img{width:156px!important;height:156px!important}.ppc-row3 .ppc-qr::after{content:'UPI · स्कैन करें';top:-11px;font-size:10px;padding:1px 8px;white-space:nowrap}.ppc-row3 .stmp{padding:6px 2px}.ppc-row3 .stmp b{font-size:12.5px}.ppc-row3 .stmp span{font-size:11px}.pp-qrbox{background:#fff;padding:7px;border:3px solid #14532d;border-radius:16px;box-shadow:0 0 0 3px #fff,0 0 0 5px #86efac}.pp-qrbox canvas,.pp-qrbox img{width:170px!important;height:170px!important;display:block}.ppc-upi{text-align:center;font-size:11px;color:#555;margin:4px 0 2px}.stmp{display:grid;justify-items:center;text-align:center;gap:1px;border:2.5px solid currentColor;outline:1px solid currentColor;outline-offset:-6px;border-radius:12px;padding:8px 4px;line-height:1.2;color:#1f8a4c;transform:rotate(-4deg)}.stmp b{font-size:14px;font-weight:800}.stmp span{font-size:12px;font-weight:700;word-break:break-word}.stmp small{font-size:10px;opacity:.85}.stmp.by{color:#1d4ed8;transform:rotate(4deg)}.stmp.due{color:#b45309}.stmp.ud{color:#b91c1c}.stmp.red{color:#c62828}.sb-act4 button.wa{background:#25d366;border-color:#1da851;color:#04230f}.wa-i{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#128c3e}.ppc-tot small b{font-size:12px;line-height:1.3;font-weight:800;font-family:inherit;color:#14532d;background:none;padding:0}\n.toast{position:fixed;")

# पहरेदार: भुगतान बाकी (सेटल से पहले) वाले बिल की छाप नहीं — सेटल होने पर झूठा "बदला गया" अलार्म न बजे; सेटल से पहले के बदलाव edits में दर्ज रहते हैं
rep("for(const b of bills){if(b.pending)continue;seen.add(b.no);", "for(const b of bills){if(b.pending||b.settled===false)continue;seen.add(b.no);")
# v32: हर एंट्री के साथ जगह (सिर्फ़ मालिक की योजना के लिए)
rep('const ent={ts:now,date:today(),partyId:pid,partyName:p.name,type:"jama",', 'const ent={...(window.SR&&SR.locNow&&SR.locNow()?{loc:SR.locNow()}:{}),ts:now,date:today(),partyId:pid,partyName:p.name,type:"jama",')
rep('await ref.set({name:bill.custName||o.name||"",phone:bill.custPhone,', 'await ref.set({...(bill.loc?{lastLoc:bill.loc}:{}),name:bill.custName||o.name||"",phone:bill.custPhone,')
rep('await ref.set({name:b.custName||o.name||"",phone:ph,', 'await ref.set({...(b.loc?{lastLoc:b.loc}:{}),name:b.custName||o.name||"",phone:ph,')
# v33: बिक्री/स्टॉक/कमी/गल्ले का हिसाब सिर्फ़ मालिक को — कर्मचारी सिर्फ़ खरीद, खर्चा, खराबी, गिनती डालें
rep('  <div class="kpi ${shortTot>0?"red":""}"><span>माल में कमी (बिक्री रेट)</span><b>${rs(shortTot)}</b></div><div class="kpi"><span>गल्ला</span><b style="font-size:16px;padding-top:6px">${diffPill(c.diff)}</b></div></div>', '  ${S.isOwner?`<div class="kpi ${shortTot>0?"red":""}"><span>माल में कमी (बिक्री रेट)</span><b>${rs(shortTot)}</b></div><div class="kpi"><span>गल्ला</span><b style="font-size:16px;padding-top:6px">${diffPill(c.diff)}</b></div>`:""}</div>')
rep('    <div class="stkmeta"><span>सुबह खुला पैसा</span><b>${rs(c.float)}</b></div>\n    <div class="stkmeta"><span>+ नकद बिक्री</span><b>${rs(c.cashSale)}</b></div>\n    <div class="stkmeta"><span>+ उधारी वसूली (नकद)</span><b>${rs(c.jamaCash)}</b></div>\n    <div class="stkmeta"><span>− नकद खर्चा + गल्ले से खरीद</span><b>${rs(c.khCash)}</b></div>\n    <div class="amtline" style="margin:0"><span>गल्ले में होना चाहिए</span><b>${rs(c.expected)}</b></div>', '    ${S.isOwner?`<div class="stkmeta"><span>सुबह खुला पैसा</span><b>${rs(c.float)}</b></div>\n    <div class="stkmeta"><span>+ नकद बिक्री</span><b>${rs(c.cashSale)}</b></div>\n    <div class="stkmeta"><span>+ उधारी वसूली (नकद)</span><b>${rs(c.jamaCash)}</b></div>\n    <div class="stkmeta"><span>− नकद खर्चा + गल्ले से खरीद</span><b>${rs(c.khCash)}</b></div>\n    <div class="amtline" style="margin:0"><span>गल्ले में होना चाहिए</span><b>${rs(c.expected)}</b></div>`:\'<p class="note" style="margin:0 0 6px">सुबह खुला पैसा और रात को गल्ला गिनकर लिखें — बस इतना।</p>\'}')
rep('    ${c.diff!=null?`<p style="margin:0;font-size:17px">नतीजा: ${diffPill(c.diff)}${S.close?.byName?` <span class="note">· ${esc(S.close.byName)} ने ${ftime(S.close.ts)} पर गिना</span>`:""}</p>`:""}', '    ${!S.isOwner&&c.counted!=null?\'<p class="note" style="margin:0">✓ गिनती सेव हुई — धन्यवाद 🙏</p>\':c.diff!=null?`<p style="margin:0;font-size:17px">नतीजा: ${diffPill(c.diff)}${S.close?.byName?` <span class="note">· ${esc(S.close.byName)} ने ${ftime(S.close.ts)} पर गिना</span>`:""}</p>`:""}')
rep('aria-label="तारीख"></div>\n  <div class="kpis"><div class="kpi"><span>आज की खरीद (मंडी)</span>', 'aria-label="तारीख"></div>\n  ${window.SF&&SF.ownerBriefHTML?SF.ownerBriefHTML():""}\n  <div class="kpis"><div class="kpi"><span>आज की खरीद (मंडी)</span>')
rep("const ownerCancel=b.cancelled&&!o.c&&b.cancelledBy&&b.cancelledBy===S.uid;", "const ownerCancel=(b.cancelled&&!o.c&&b.cancelledBy&&(b.cancelledBy===S.uid||!!b.cancelReason))||(!b.cancelled&&o.c&&b.restoredBy===S.uid);")
rep("if(!G.okdel.has(id)&&!Object.values(G.days).some(d=>d.m[id]&&d.m[id].c))", "if(!G.okdel.has(id)&&!Object.values(G.days).some(d=>d.m[id]&&d.m[id].c)&&!(S.dayBills||[]).some(b=>b.no===id&&b.cancelled))")
rep("let left=stockLeft(it.id);if(left==null&&LL&&LL[it.id]!=null)left=LL[it.id];", "let left=S.isOwner?stockLeft(it.id):null;if(S.isOwner&&left==null&&LL&&LL[it.id]!=null)left=LL[it.id];")
# v30: संस्था का खरीद भाव हाथ से
rep(".toast{position:fixed;", ".pl-fix{border-radius:12px;padding:10px 12px;margin:4px 0 8px;font-weight:600;background:#eef4ff;border:2px solid #93b4f5}.pl-fix.ok{background:#e9f9ee;border-color:#25d366}.pl-fix.bad{background:#fff1f0;border-color:var(--chili)}.pl-fix.busy{animation:plp 1.2s ease-in-out infinite alternate}@keyframes plp{from{opacity:.65}to{opacity:1}}.rme{background:#fff;border:2px solid rgba(0,0,0,.25);border-radius:8px;padding:6px 9px;font:inherit;font-weight:700;cursor:pointer}\n.toast{position:fixed;")
rep('(window.SB?SB.editsHTML():"")', '(window.SB?SB.editsHTML()+(SB.udharHTML?SB.udharHTML():""):"")')
rep(".toast{position:fixed;", ".ud-chk{border:2px solid #f0b429;background:#fffbea;border-radius:14px;padding:10px 12px;margin:8px 0}.ud-chk.bad{border-color:var(--chili);background:#fff1f0}.ud-h{display:flex;align-items:center;gap:6px;font-size:17px}.ud-h .lnk{margin-left:auto}.ud-g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px;text-align:center}.ud-g span{display:grid;font-size:12px;color:#555;background:#fff;border-radius:10px;padding:6px 2px}.ud-g b{font-size:16px;color:#111}.ud-g b.red{color:var(--chili)}.ud-w{color:var(--chili);font-weight:700;margin:4px 0 0}.ud-send{margin:10px 0 0;display:grid}.ud-send a.big{text-align:center;text-decoration:none}\n.toast{position:fixed;")
rep("free:!!l.free,...(l.note?{note:l.note}:{})}));", "free:!!l.free,...(l.note?{note:l.note}:{}),...(l.costTyped?{costTyped:l.costTyped}:{})}));")
rep(".toast{position:fixed;", ".ic-cost{display:flex;align-items:center;gap:4px;font-weight:700}.ic-cost .inp{width:5.5em;padding:8px;text-align:right}\n.toast{position:fixed;")

rep('(window.SB?SB.editsHTML()+(SB.udharHTML?SB.udharHTML():""):"")', '(window.SF&&SF.ownerBriefHTML?SF.ownerBriefHTML():"")+(window.SB?SB.editsHTML()+(SB.udharHTML?SB.udharHTML():""):"")')
rep('nightBy:S.stock.nightBy||"",nightTs:S.stock.nightTs||0,', 'nightBy:S.stock.nightBy||"",nightTs:S.stock.nightTs||0,nightVal:S.stock.nightVal||0,nightN:S.stock.nightN||0,')
rep('<div class="kpi red"><span>उधार</span><b>${rs(sum("udhar"))}</b></div></div>', '<div class="kpi red"><span>उधार</span><b>${rs(sum("udhar"))}</b></div></div>${S.isOwner&&window.SF&&SF.profitKpiHTML?SF.profitKpiHTML(live):""}')
rep('"नकद+उधार":"उधार"}</small></div></button>', '"नकद+उधार":b.settled===false?"⏳ बाकी":"उधार"}</small>${S.isOwner&&window.SF&&SF.billProfitTag&&!b.cancelled?SF.billProfitTag(b):""}</div></button>')
# v34: राउंड ऑफ
rep('$("#cartt").textContent=rs(cartTotal());', '$("#cartt").textContent=rs(S.mode==="inst"?cartTotal():Math.round(cartTotal()));')
rep(r'if(b.disc)t+=`🏷️ छूट: −₹${b.disc}\n`;t+=`💰 *कुल रकम: ₹${b.total}*\n`;', r'if(b.disc)t+=`🏷️ छूट: −₹${b.disc}\n`;{const ro=window.SF&&SF.roff?SF.roff(b):0;if(ro)t+=`_जोड़ ₹${r2(b.sub!=null?b.sub:b.lines.reduce((a,l)=>a+(+l.amt||0),0))} · ${SF.roffTxt(ro)}_\n`}t+=`💰 *कुल रकम: ₹${b.total}*\n`;')
s = s.replace("आम ग्राहक", "VIP ग्राहक")
# टीम के लिए "स्टाफ" शब्द नहीं
s = s.replace("सब स्टाफ के फोन", "सब कर्मचारियों के फोन").replace("स्टाफ", "कर्मचारी")

open(dst, "w", encoding="utf8").write(s)
print("ok", len(s))
