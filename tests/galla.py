"""सब्ज़ी एक्सप्रेस — ⏱️ हर घंटे गल्ला गिनती (27-11-2026): हर गिनती अलग लाइन (पुरानी नहीं मिटती), मालिक को फर्क,
कर्मचारी को "होना चाहिए" नहीं, ⏳ भुगतान बाकी बिल की याद, घंटे वाली याद, खर्चा मिटता नहीं (void), बिल पर बिलर एक बार।
उपयोग: python3 tests/galla.py <www फ़ोल्डर> <स्क्रीनशॉट फ़ोल्डर>"""
import asyncio, os, sys, threading, http.server, functools
from playwright.async_api import async_playwright

WWW, SHOTS = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
os.makedirs(SHOTS, exist_ok=True)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8767), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WWW))
srv.RequestHandlerClass.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
errs = []


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={"width": 400, "height": 860}, service_workers="block")).new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("**/config.js", lambda r: r.fulfill(body="window.SE_CONFIG={};", content_type="application/javascript"))
        await pg.goto("http://127.0.0.1:8767/index.html"); await pg.wait_for_timeout(1500)
        assert await pg.evaluate("S.demo===true")
        # मालिक: खुला 500, नकद बिक्री 200 → होना चाहिए 700
        await pg.evaluate("""S.staff='कमल भाई';S.close={float:500};S.dayBills=[{no:'A1',ts:Date.now()-5e5,date:today(),mode:'walk',lines:[],total:200,pay:{cash:200,upi:0,udhar:0},settled:true},
          {no:'A2',ts:Date.now()-3e5,date:today(),mode:'walk',partyName:'रमेश जी',lines:[],total:90,pay:{cash:0,upi:0,udhar:0},settled:false}]""")
        await pg.evaluate("SF.gcSave(500,690)"); await pg.wait_for_timeout(50)
        await pg.evaluate("SF.gcSave(500,700)")
        h = await pg.evaluate("S.close.hist.map(x=>[x.counted,x.expected,x.diff,x.pend])")
        assert h == [[690, 700, -10, 1], [700, 700, 0, 1]], h  # दोनों गिनती बचीं, पहली नहीं मिटी
        await pg.evaluate("SF.dseg='paisa';S.tab='day';showTab()"); await pg.wait_for_timeout(300)
        t = await pg.inner_text("#p-day")
        assert "आज की गिनतियाँ (2)" in t and "₹10 कम है" in t and "1 बिल का भुगतान अभी बाकी" in t and "हर घंटे" in t, t[:900]
        await pg.screenshot(path=os.path.join(SHOTS, "galla-owner.png"), full_page=True)
        # मालिक: याद हर 2 घंटे
        await pg.click('[data-gcev="2"]'); await pg.wait_for_timeout(200)
        assert await pg.evaluate("SF.gcEvery()") == 2
        # कर्मचारी: याद आए, गिनती खिड़की में "होना चाहिए" नहीं
        await pg.evaluate("S.isOwner=false;S.settings.gcEvery=1;S.close.hist.forEach(x=>x.ts-=2*3600e3);localStorage.removeItem('se_gcn_'+today())")
        assert await pg.evaluate("SF.gcNag(true)")
        await pg.click('[data-gcn="go"]'); await pg.wait_for_timeout(200)
        t = await pg.inner_text("#sheet")
        assert "गल्ला गिनें" in t and "होना चाहिए" not in t and "₹90" not in t and "भुगतान अभी बाकी" in t, t
        await pg.screenshot(path=os.path.join(SHOTS, "galla-staff.png"))
        await pg.fill("#gcIn", "705"); await pg.click("[data-gcsave]"); await pg.wait_for_timeout(200)
        assert await pg.evaluate("S.close.hist.length") == 3 and await pg.evaluate("S.close.counted") == 705
        await pg.evaluate("S.tab='day';showTab()"); await pg.wait_for_timeout(200)
        assert "गिनतियाँ" not in await pg.inner_text("#p-day"), "कर्मचारी को गिनतियों का हिसाब नहीं"
        assert await pg.locator(".qstrip [data-gcopen]").count() == 1
        # खर्चा मिटता नहीं — "हटाया" ठप्पा
        await pg.evaluate("S.isOwner=true;S.kharch=[{id:'k1',what:'चाय',amt:20,mode:'cash',ts:Date.now(),byName:'कमल भाई'}];renderDay()")
        await pg.click('[data-delkh="k1"]'); await pg.click('[data-delkh="k1"]'); await pg.wait_for_timeout(200)
        assert await pg.evaluate("S.kharch.length") == 0
        # बिल पर बिलर का नाम एक बार
        rt = await pg.evaluate("receiptText({no:'X',ts:Date.now(),date:today(),mode:'walk',partyName:'VIP ग्राहक',lines:[{name:'टमाटर',qty:1,unit:'kg',rate:30,amt:30}],total:30,pay:{cash:30},byName:'कमल भाई'})")
        assert rt.count("कमल भाई") == 1, rt
        # 🌙 रात का स्टॉक पक्का: आज जिसका माल था, वह खाली छोड़कर सेव नहीं; खराबी उसी खिड़की में
        await pg.evaluate("closeSheet();S.isOwner=false;S.stock={items:{}};S.prevStock={tamatar:{close:5}};SF.nightSheet()"); await pg.wait_for_timeout(200)
        t = await pg.inner_text("#sheet"); assert "1 सब्ज़ी अभी बाकी" in t and await pg.locator("[data-nsave][disabled]").count() == 1, t[:400]
        await pg.screenshot(path=os.path.join(SHOTS, "night-need.png"))
        await pg.click('.ns-need [data-nst="tamatar"]'); await pg.fill("#nsQ", "2"); await pg.fill("#nsW", "0.5"); await pg.click("[data-nsok]"); await pg.wait_for_timeout(150)
        assert await pg.locator("[data-nsave]:not([disabled])").count() == 1
        await pg.click("[data-nsave]"); await pg.wait_for_timeout(300)
        st = await pg.evaluate("[S.stock.items.tamatar.close,S.stock.items.tamatar.waste,(S.stock.wlog||[]).length]"); assert st == [2, 0.5, 1], st
        # ज़्यादा लिखा → पहले "दोबारा तौलें", दूसरी बार सेव
        await pg.evaluate("closeSheet();S.stock={items:{}};SF.nightSheet()"); await pg.wait_for_timeout(150)
        await pg.click('.ns-need [data-nst="tamatar"]'); await pg.fill("#nsQ", "9"); await pg.click("[data-nsok]"); await pg.click("[data-nsave]"); await pg.wait_for_timeout(150)
        assert "फिर भी" in await pg.inner_text("[data-nsave]") and not (await pg.evaluate("(S.stock.items.tamatar||{}).close"))
        await pg.click("[data-nsave]"); await pg.wait_for_timeout(200); assert await pg.evaluate("S.stock.items.tamatar.close") == 9
        # ⏳ पिछले दिन के बाकी बिल साथी को भी दिखें
        await pg.evaluate("closeSheet();SB.old=[{no:'OLD1',date:dayPlus(today(),-1),ts:Date.now()-864e5,total:80,partyName:'रमेश जी',settled:false,pay:{},lines:[]}]")
        h = await pg.evaluate("SB.pendingHTML()"); assert "पिछले दिन के 1 बिल" in h and "OLD1" in h and "₹80" not in h.split("</b>")[0], h
        # 🛒 खरीदा, पर बिक्री में नहीं: बंद सामान (▶ चालू) + ऐप में न होने वाला नाम (➕ बनाएँ)
        await pg.evaluate("S.isOwner=true;S.items.find(i=>i.id==='palak').active=false;S.purchHist=[{id:'p1',ts:Date.now(),date:today(),lines:[{id:'palak',name:'पालक',qty:5,rate:20,unit:'kg'},{name:'बथुआ',qty:4,rate:80,unit:'kg'}]},{id:'c1',src:'chat',lines:[{name:'पुरानी चीज़',qty:1,rate:5}]}]")
        h = await pg.evaluate("SF.buyGapHTML()"); assert "खरीदा, पर बिक्री में नहीं (2)" in h and "बथुआ" in h and "पालक" in h and "पुरानी" not in h, h[:500]
        await pg.evaluate("S.tab='report';showTab()"); await pg.wait_for_timeout(300)
        await pg.fill('[data-bgr="palak"]', "35"); await pg.click('[data-bgon="palak"]'); await pg.wait_for_timeout(200)
        assert await pg.evaluate("[item('palak').active,item('palak').sale]") == [True, 35]
        await pg.click('[data-bgnew="0"]'); await pg.wait_for_timeout(200)
        assert await pg.evaluate("S.items.some(i=>i.name==='बथुआ'&&i.sale===110&&i.active)"), "बथुआ बिक्री में (80 + 35% → 110)"
        await pg.screenshot(path=os.path.join(SHOTS, "buygap.png"))
        # 🧾 छोटी पर्ची: नाम · बिल · सामान · कुल · बड़ा QR (बाकी हो तभी); पूरी रसीद से बहुत छोटी
        r = await pg.evaluate("""(()=>{const b={no:'27-1001',date:today(),ts:Date.now(),mode:'walk',settled:false,lines:[{name:'टमाटर',qty:1.5,unit:'kg',rate:30,amt:45},{name:'धनिया',qty:0.25,unit:'kg',rate:120,amt:30},{name:'आलू',qty:2,unit:'kg',rate:20,amt:40}],total:115,byName:'कमल भाई'};
          const o=SF.rcptOpts(b),slim=SE.receiptCanvas(b,o),full=SE.receiptCanvas(b,SF.rcptOpts(b,'full'));
          const paid={...b,settled:true,pay:{upi:115,cash:0,udhar:0}},o2=SF.rcptOpts(paid),s2=SE.receiptCanvas(paid,o2);
          window.__slim=slim.toDataURL();return [o.slim,!!o.qr,o.qrLabel,slim.width,slim.height,full.height,!!o2.qr,s2.height]})()""")
        assert r[0] and r[1] and "115" in r[2] and r[3] == 384 and r[4] < r[5] * 0.75 and not r[6] and r[7] < r[4] - 200, r
        await pg.evaluate("document.body.insertAdjacentHTML('beforeend','<img id=slimimg style=\"position:fixed;top:0;left:0;z-index:99999;background:#fff;border:1px solid #000\" src=\"'+window.__slim+'\">')")
        await pg.wait_for_timeout(200); await pg.locator("#slimimg").screenshot(path=os.path.join(SHOTS, "parchi-slim.png")); await pg.evaluate("document.getElementById('slimimg').remove()")
        # बिल बनते ही अपने-आप छपाई (नकली प्रिंटर) + 👤 में प्रिंटर खिड़की
        await pg.evaluate("closeSheet();S._fakePrn=[];S.tab='bill';showTab();S.cart=[{id:'tamatar',name:'टमाटर',qty:1,unit:'kg',rate:30,amt:30}];setMode('walk')")
        await pg.evaluate("openCheckout()"); await pg.wait_for_timeout(900)
        fp = await pg.evaluate("S._fakePrn.map(x=>[x.auto,x.o&&x.o.slim,!!(x.o&&x.o.qr)])"); assert fp == [[True, True, True]], fp
        await pg.evaluate("localStorage.setItem('se_autoprn','0');S._fakePrn=[];closeSheet();S.cart=[{id:'tamatar',name:'टमाटर',qty:1,unit:'kg',rate:30,amt:30}];openCheckout()"); await pg.wait_for_timeout(900)
        assert await pg.evaluate("S._fakePrn.length") == 0, "बंद हो तो अपने-आप नहीं"
        await pg.evaluate("closeSheet();localStorage.removeItem('se_autoprn');S._fakePrn=null;prnSheet()"); await pg.wait_for_timeout(150)
        assert "छोटी पर्ची" in await pg.inner_text("#sheet")
        await pg.evaluate("closeSheet()")
        # 🔄 ऐप अपडेट करें बटन (सेटिंग में)
        await pg.evaluate("S.tab='set';showTab()"); await pg.wait_for_timeout(200)
        assert await pg.locator("#p-set [data-updnow]").count() == 1 and await pg.evaluate("typeof SE.updateNow") == "function"
        await b.close()
    assert not errs, errs
    print("✅ पूरा टेस्ट पास (गल्ला गिनती)")

asyncio.run(main())
