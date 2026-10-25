# v15: खरीद, रात का स्टॉक, दिन का हिसाब, बारकोड लेबल — असली कोड web/se-features.js में; यहाँ सिर्फ़ जोड़ने वाले हुक
# port.py से exec होता है (rep / rx / s वहीं के हैं)
rep('<section id="p-set" hidden></section>', '<section id="p-set" hidden></section>\n  <section id="p-kharid" hidden></section>\n  <section id="p-label" hidden></section>')
rep('</script>\n\n</body>', '</script>\n<script src="se-features.js"></script>\n\n</body>')
rep('function tabsList(){const t=[["bill","बिलिंग"],', 'function tabsList(){const t=[["bill","बिलिंग"],["kharid","खरीद"],')
rep('if(S.isOwner)t.push(["report","रिपोर्ट"', 't.push(["label","लेबल"]);if(S.isOwner)t.push(["report","रिपोर्ट"')
rep('["bill","udhar","bills","day","report","set"].forEach(k=>$("#p-"+k).hidden=S.tab!==k);',
    '["bill","udhar","bills","day","report","set","kharid","label"].forEach(k=>$("#p-"+k).hidden=S.tab!==k);$("#sbar").hidden=S.tab==="kharid"||S.tab==="label";')
rep('  else if(S.tab==="report")renderReport();',
    '  else if(S.tab==="report")renderReport();\n  else if(S.tab==="kharid"){if(window.SF)SF.renderKharid()}\n  else if(S.tab==="label"){if(window.SF)SF.renderLabel()}')
rep('function subBills(){\n', 'function subBills(){\n  if(window.SF)SF.onDate(S.billsDate);\n')
rep('function priceOf(it){return S.mode==="inst"?(+it.cost||0):(+it.sale||0)}',
    'function priceOf(it){return S.mode==="inst"?(window.SF?SF.costOf(it):(+it.cost||0)):(+it.sale||0)}')
rep('cost:+it.cost||0', 'cost:(window.SF?SF.costOf(it):(+it.cost||0))', 5)
rep('const khCash=r2(S.kharch.filter(k=>k.mode!=="upi").reduce((a,k)=>a+(+k.amt||0),0));',
    'const khCash=r2(S.kharch.filter(k=>k.mode!=="upi").reduce((a,k)=>a+(+k.amt||0),0)+(window.SF?SF.gallaPaid():0));')
rep('<span>− नकद खर्चा</span>', '<span>− नकद खर्चा + गल्ले से खरीद</span>')
rep('const buyTot=r2(rows.reduce((a,r)=>a+r.amt,0)),shortTot=r2(rows.reduce((a,r)=>a+r.shortVal,0)),flags=rows.filter(r=>r.flag);',
    'const _k=window.SF?SF.dayKpi():{buy:0,short:0};const buyTot=_k.buy,shortTot=_k.short;')
rx(r'  <h3 style="margin:0 0 4px">माल: सुबह कितना आया, रात को कितना बचा</h3>.*?\'<div class="empty">सब्ज़ियों की लिस्ट खाली है</div>\'\}</div>`;',
   '  ${window.SF?SF.dayStockHTML():""}`;')
rep('async function handleScan(code){\n  code=String(code||"").trim();if(!code)return;',
    'async function handleScan(code){\n  code=String(code||"").trim();if(!code)return;\n'
    '  const vw=window.SF&&!S.scanIn&&!findByCode(code)?SF.parseVW(code):null;\n'
    '  if(vw){if(vw.bad){beep(false);toast("लेबल की सब्ज़ी (कोड "+vw.plu+") लिस्ट में नहीं");return}\n'
    '    if(S.tab!=="bill"){S.tab="bill";showTab()}if(vw.it.active===false){toast(vw.it.name+" अभी बंद है");return}if(!(priceOf(vw.it)>0)){toast(vw.it.name+" का रेट नहीं डाला गया");return}\n'
    '    if(vw.kind==="fix"&&vw.it.unit!=="pc"){beep(true);openQty(vw.it);return}quickAdd(vw.it,vw.qty);return}')
rep('<div class="card2"><h3>📦 पुराने ऐप का डेटा</h3>', '${window.SF?SF.labelSettingsHTML():""}\n  <div class="card2"><h3>📦 पुराने ऐप का डेटा</h3>')
rep('डेमो मोड: यहाँ बने बिल सेव नहीं होंगे। असली ऐप claude.ai पर साइन-इन करके खोलें।', 'डेमो मोड: यहाँ बने बिल सेव नहीं होंगे। Firebase जुड़ते ही असली ऐप चलेगा।')
rep('  if(S.isOwner)db.collection("staff").onSnapshot(', '  if(window.SF)SF.onDb(db);\n  if(S.isOwner)db.collection("staff").onSnapshot(')
rep('  <h2>सभी बिल</h2><table>', '  ${window.SF?SF.purchA4HTML():""}\n  <h2>सभी बिल</h2><table>')
rep(".toast{position:fixed;", """/* v15 खरीद, लेबल */
.supsel{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.supsel b{font-size:17px}.supsel .lnk{margin-left:auto}.supsel .tile{width:40px;height:40px}
.plines{display:grid;gap:8px}.pline{display:grid;grid-template-columns:44px 1fr;gap:10px;padding:8px;border:1.5px solid var(--line);border-radius:14px}
.pf{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;align-items:end}.pf .inp{padding:8px;font-size:17px}.pamt{font-size:18px;padding:8px 0;display:block}
.pbadge{margin-top:4px;min-height:4px}
.ppick{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:6px}.ppick button{border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:5px 4px;display:grid;justify-items:center;gap:2px;font-size:12px;font-weight:700;color:var(--ink)}
.ppick .tile{width:46px;height:46px}
.dgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:4px 0 6px}.dgrid span{background:var(--bg);border-radius:8px;padding:3px 5px;font-size:11px;color:var(--muted)}.dgrid b{display:block;color:var(--ink);font-size:13px}
.nrow{display:grid;grid-template-columns:44px 1fr 110px;gap:10px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line)}.nrow .note{display:block}.nrow .inp{font-size:20px;font-weight:800;text-align:center}
.lsws{display:flex;flex-wrap:wrap;gap:6px 12px}.lsw{display:flex;align-items:center;gap:5px}
.lprev{background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0/16px 16px;border-radius:12px;padding:10px;display:flex;justify-content:center}.lprev canvas{max-width:100%;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.2);border-radius:4px}
.chip[aria-pressed="true"]{background:var(--leaf);color:var(--leaf-ink);border-color:var(--leaf)}
.toast{position:fixed;""")
rep('db.collection("items").onSnapshot(s=>{S.items=sortItems(s.docs.map(d=>({id:d.id,...d.data()})));',
    'db.collection("items").onSnapshot(s=>{S.items=sortItems(s.docs.map(d=>({id:d.id,...d.data()})));if(S.isOwner&&window.SF&&S.items.some(i=>!i.plu))SF.ensurePLU();')
# v16: टैब में चित्र-निशान, चुना टैब सामने, रिपोर्ट में ग्राफ़
rep('$("#tabs").innerHTML=tabsList().map(([k,v])=>`<button role="tab" aria-selected="${S.tab===k}" data-tab="${k}">${v}</button>`).join("");',
    'const TI={bill:"🧾",kharid:"🛒",udhar:"📒",bills:"📋",day:"🌙",label:"🏷️",report:"📈",set:"⚙️"};$("#tabs").innerHTML=tabsList().map(([k,v])=>`<button role="tab" aria-selected="${S.tab===k}" data-tab="${k}"><span class="ti">${TI[k]||""}</span> ${v}</button>`).join("");{const a=$("#tabs [aria-selected=\\"true\\"]");if(a&&a.scrollIntoView)try{a.scrollIntoView({inline:"center",block:"nearest"})}catch(e){}}')
rep('<button class="big ghost" data-a4 style="margin-bottom:10px">🖨️ A4 रिपोर्ट प्रिंट / PDF</button>',
    '<button class="big ghost" data-a4 style="margin-bottom:10px">🖨️ A4 रिपोर्ट प्रिंट / PDF</button>\n  ${window.SF?SF.chartsHTML():""}')
rep(".toast{position:fixed;", """/* v16 ग्राफ़ */
.ti{font-size:15px}
.chart{background:var(--surface);border-radius:16px;box-shadow:var(--shadow);padding:12px 14px;margin-bottom:12px}
.chart h3{margin:0 0 2px;font-size:16px}.chart .note{margin:0 0 6px}
.chart svg{width:100%;height:auto;display:block}
.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:4px}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.mixbar{display:flex;height:26px;border-radius:9px;overflow:hidden;margin:6px 0}.mixbar span{display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800;min-width:0;overflow:hidden;white-space:nowrap}
.hbar{display:grid;grid-template-columns:90px 1fr 64px;gap:8px;align-items:center;font-size:13px;margin:4px 0}.hbar .t{background:var(--bg);border-radius:6px;height:16px;overflow:hidden}.hbar .t i{display:block;height:100%;background:var(--leaf);border-radius:6px}.hbar b{text-align:right}
.toast{position:fixed;""")
# v17: बिल नंबर — हर दिन 1 से, गुप्त कोड (SE-XXXXXX); UPI संदेश में "Sabji Express"
rep('''  S.chk={no:newBillNo(),disc:0,pay:S.mode==="inst"?"inst":"cash",given:"",cashPart:"",upiOk:false};
  drawCheckout();''','''  const _t=S.bt[S.ai];const _keep=_t&&_t.no&&_t.noDate===today()?_t.no:"";
  S.chk={no:_keep||(window.SF?"…":newBillNo()),disc:0,pay:S.mode==="inst"?"inst":"cash",given:"",cashPart:"",upiOk:false};
  drawCheckout();
  if(!_keep&&window.SF){const c0=S.chk;SF.reserveBillNo().then(n=>{if(_t){_t.no=n;_t.noDate=today();lsSet("se_tabs",JSON.stringify(S.bt))}if(S.chk===c0){c0.no=n;if($("#sheet .sh-head"))drawCheckout()}})}''')
rep('const bill={no:c.no,ts:now,date,', 'if(c.no==="…"&&window.SF)c.no=await SF.reserveBillNo();\n  const bill={no:c.no,ts:now,date,')
rep('&tn=${encodeURIComponent("Bill "+c.no)}`;','&tn=${encodeURIComponent("Sabji Express | Bill No "+c.no)}`;')
rep('''    ${receiptHTML(b)}
    ${(party?.phone||b.custPhone)?''','''    ${receiptHTML(b)}
    ${S.isOwner&&window.SF&&SF.billLabel(b.no)?`<p class="note" style="margin:6px 0 0;text-align:center">🔐 ${esc(SF.billLabel(b.no))} (यह सिर्फ़ आपको दिखता है)</p>`:""}
    ${(party?.phone||b.custPhone)?''')
# v18: कागज़ जैसी रसीद, सेटल, PDF शेयर
rep('function drawCheckout(){\n', 'function drawCheckout(){if(window.SF&&SF.drawCheckout)return SF.drawCheckout();\n')
rep('function receiptHTML(b){\n', 'function receiptHTML(b){if(window.SF)return SF.paperHTML(b,{});\n')
rep('<button class="big ghost" data-print style="margin-top:8px">🖨️ रसीद प्रिंट करें</button>',
    '<div class="pp-actions" style="margin-top:10px"><button data-sharepdf>📤<span>PDF शेयर</span></button><button data-print>🖨️<span>प्रिंट</span></button></div>')
rep('    if(e.target.closest("[data-print]")){printBill(b);return}',
    '    if(e.target.closest("[data-print]")){printBill(b);return}\n    if(e.target.closest("[data-sharepdf]")){if(window.SF)SF.shareBill(b,(party&&party.phone)||b.custPhone,true);return}')
rep(".toast{position:fixed;", """/* v18 कागज़ की रसीद */
.pp-slot{position:relative;padding-top:10px}
.pp-printer{height:14px;margin:0 6px;border-radius:10px;background:linear-gradient(#2b2f36,#4a505a);box-shadow:inset 0 -3px 0 #1c1f24}
.paper{position:relative;margin:-6px 14px 18px;background:#fffefa;color:#1b1b1b;padding:18px 16px 22px;font-family:"Mukta",system-ui,sans-serif;box-shadow:0 10px 24px rgba(0,0,0,.18);border-radius:2px}
.paper::after{content:"";position:absolute;left:0;right:0;bottom:-10px;height:10px;background:linear-gradient(-45deg,transparent 7px,#fffefa 0) 0 0/14px 10px repeat-x,linear-gradient(45deg,transparent 7px,#fffefa 0) 0 0/14px 10px repeat-x}
.pp-anim{animation:ppIn .55s cubic-bezier(.2,.8,.2,1)}
@keyframes ppIn{from{transform:translateY(-70%);clip-path:inset(70% 0 0 0)}to{transform:none;clip-path:inset(0 0 0 0)}}
.pp-head{text-align:center;display:grid;gap:0}.pp-head .pp-logo{font-size:30px;line-height:1}.pp-head b{font-family:"Baloo 2",sans-serif;font-size:24px;font-weight:800;letter-spacing:.3px}.pp-head small{color:#555;font-size:12px}
.pp-rule{height:2px;background:#1b1b1b;margin:10px 0 8px}
.pp-dash{border-top:1.5px dashed #9a9a9a;margin:8px 0}
.pp-meta{display:flex;justify-content:space-between;gap:8px;font-size:13px;color:#333;flex-wrap:wrap}.pp-meta b{color:#000}
.pp-t{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}.pp-t th{font-size:12px;color:#555;font-weight:700;text-align:left;padding:2px 3px}.pp-t td{padding:5px 3px;vertical-align:top;border-bottom:1px dotted #ddd}
.pp-t .r{text-align:right;white-space:nowrap}.pp-t tr[data-edit]{cursor:pointer}.pp-t tr[data-edit]:active{background:#f3f7ef}
.pp-x{border:0;background:#fde8e8;color:#c62828;border-radius:8px;width:26px;height:26px;font-weight:800}
.pp-chg{display:inline-block;font-size:10px;background:#fde8e8;color:#c62828;border-radius:6px;padding:0 5px}
.pp-row{display:flex;justify-content:space-between;font-size:14px;color:#333}.pp-row.note{font-size:12px;color:#777}
.pp-total{display:flex;justify-content:space-between;align-items:baseline;margin:4px 0}.pp-total span{font-weight:800;font-size:16px}.pp-total b{font-family:"Baloo 2",sans-serif;font-size:32px}
.pp-stamp{margin:8px auto 2px;width:max-content;max-width:100%;border:2.5px solid #1f8a4c;color:#1f8a4c;font-weight:800;border-radius:8px;padding:3px 10px;transform:rotate(-3deg);font-size:14px}.pp-stamp.red{border-color:#c62828;color:#c62828}
.pp-qr{display:grid;justify-items:center;gap:2px;margin-top:8px}.pp-qr b{font-size:15px}.pp-qr span{font-size:11px;color:#666}.pp-qr>div{background:#fff;padding:6px}
.pp-thanks{text-align:center;font-weight:800;font-size:15px}
.pp-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}.pp-actions:has(> :nth-child(2):last-child){grid-template-columns:1fr 1fr}
.pp-actions button{border:1.5px solid var(--line);background:var(--surface);color:var(--ink);border-radius:14px;padding:10px 4px;font-size:22px;display:grid;justify-items:center;gap:2px}.pp-actions span{font-size:13px;font-weight:800}
.settle-sum{display:flex;justify-content:space-between;align-items:center;background:var(--surface);border:1.5px solid var(--line);border-radius:14px;padding:10px 14px;margin-bottom:10px}.settle-sum b{font-size:24px}
.toast{position:fixed;""")
# v19: बिल रद्द करने की अर्ज़ी (कर्मचारी → विक्रम जी)
rep('''    ${!fresh&&S.isOwner&&!b.cancelled&&!S.demo?`<label class="fld" style="margin-top:10px">रद्द करने''','''    ${window.SF?SF.cancelReqHTML(b,fresh):""}
    ${!fresh&&S.isOwner&&!b.cancelled&&!S.demo?`<label class="fld" style="margin-top:10px">रद्द करने''')
rep('    if(e.target.closest("[data-print]")){printBill(b);return}','    if(e.target.closest("[data-print]")){printBill(b);return}\n    if(e.target.closest("[data-creq]")){SF.sendCancelReq(b);return}')
rep('$("#p-report").innerHTML=guardHTML()+`','$("#p-report").innerHTML=(window.SF?SF.cancelReqsHTML():"")+guardHTML()+`')
rep('''$("#p-report").addEventListener("click",e=>{''','''$("#p-report").addEventListener("click",e=>{const crk=e.target.closest("[data-crok],[data-crno]");if(crk&&window.SF){const ok=!!crk.dataset.crok;if(ok&&crk.dataset.sure!=="1"){crk.dataset.sure="1";crk.textContent="पक्का? दोबारा दबाएँ";return}SF.decideCancel(crk.dataset.crok||crk.dataset.crno,ok);return}''')
rep('''<label class="fld">दुकान/गाड़ी का ऑर्डर नंबर (बिल पर छपेगा)''','''<label class="fld">आपका WhatsApp नंबर (बिल रद्द की अर्ज़ी इसी पर आएगी)<input class="inp" id="s-ownerPh" data-sf="ownerPh" inputmode="tel" value="${esc(s.ownerPh||"")}" placeholder="10 अंक"></label>
    <label class="fld">दुकान/गाड़ी का ऑर्डर नंबर (बिल पर छपेगा)''')
rep('t.push(["label","लेबल"]);if(S.isOwner)t.push(["report","रिपोर्ट"+(guardOpen()?" 🔴"+guardOpen():"")]','t.push(["label","लेबल"]);const _cr=(S.cancelReqs||[]).length;if(S.isOwner)t.push(["report","रिपोर्ट"+(guardOpen()+_cr?" 🔴"+(guardOpen()+_cr):"")]')
rep(".toast{position:fixed;", """.creq{margin-top:12px;border:1.5px dashed var(--chili);border-radius:12px;padding:8px 12px}.creq summary{font-weight:800;color:var(--chili);cursor:pointer}
.creq-row{display:grid;gap:6px;padding:10px 0;border-bottom:1px solid var(--line)}.creq-row>div:first-child{display:grid;gap:2px}
.toast{position:fixed;""")
