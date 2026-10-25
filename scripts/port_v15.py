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
rep('&tn=${encodeURIComponent("Bill "+b.no)}`;','&tn=${encodeURIComponent("Sabji Express | Bill No "+b.no)}`;')
rep('''    ${receiptHTML(b)}
    ${(party?.phone||b.custPhone)?''','''    ${receiptHTML(b)}
    ${S.isOwner&&window.SF&&SF.billLabel(b.no)?`<p class="note" style="margin:6px 0 0;text-align:center">🔐 ${esc(SF.billLabel(b.no))} (यह सिर्फ़ आपको दिखता है)</p>`:""}
    ${(party?.phone||b.custPhone)?''')
