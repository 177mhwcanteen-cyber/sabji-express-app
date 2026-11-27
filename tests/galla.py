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
        await b.close()
    assert not errs, errs
    print("✅ पूरा टेस्ट पास (गल्ला गिनती)")

asyncio.run(main())
