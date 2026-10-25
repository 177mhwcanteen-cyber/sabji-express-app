"""नकली Firebase के साथ पूरा टेस्ट: मालिक लॉगिन → पुराना डेटा → कर्मचारी जोड़ें → कर्मचारी लॉगिन → बिल → प्रिंट → रिपोर्ट।
उपयोग: python3 tests/e2e.py <www फ़ोल्डर> <स्क्रीनशॉट फ़ोल्डर>"""
import asyncio, json, os, sys, threading, http.server, functools
from playwright.async_api import async_playwright

WWW, SHOTS = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
os.makedirs(SHOTS, exist_ok=True)
H = os.path.dirname(os.path.abspath(__file__))
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8765), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WWW))
srv.RequestHandlerClass.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:8765/index.html"
MOCK = open(os.path.join(H, "mock-firebase.js"), encoding="utf8").read()
CFG = """window.SE_CONFIG={firebase:{apiKey:"TEST",projectId:"t"},ownerEmail:"sabziexpress3600@gmail.com",ownerName:"विक्रम जी",updateUrl:""};"""
errs = []

async def page(b, mock, users, cfg=True):
    ctx = await b.new_context(viewport={"width": 400, "height": 860}, service_workers="block")
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append("console: " + m.text))
    await pg.add_init_script(f"window.__MOCK__={json.dumps(mock)};window.__USERS__={json.dumps(users)};window.print=()=>{{window.__printed=(window.__printed||0)+1}};")
    await pg.route("**/lib/vendor.js", lambda r: r.fulfill(body=MOCK, content_type="application/javascript"))
    if cfg:
        await pg.route("**/config.js", lambda r: r.fulfill(body=CFG, content_type="application/javascript"))
    await pg.goto(URL)
    return pg

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---------- 0) बिना Firebase: डेमो ----------
        pg = await page(b, {}, {}, cfg=False)
        await pg.wait_for_timeout(1500)
        assert await pg.is_hidden("#lock"), "demo should not lock"
        await pg.screenshot(path=f"{SHOTS}/0-demo.png")
        await pg.context.close()

        # ---------- 1) मालिक ----------
        users = {"sabziexpress3600@gmail.com": {"uid": "own", "pw": "secret123"}}
        pg = await page(b, {}, users)
        await pg.wait_for_selector("#lock:not([hidden])")
        await pg.screenshot(path=f"{SHOTS}/1-login-staff.png")
        await pg.click('[data-lg="to-owner"]')
        await pg.fill("#lgPass", "secret123")
        await pg.click('[data-lg="owner-go"]')
        await pg.wait_for_selector("#lock", state="hidden")
        await pg.wait_for_timeout(500)
        tabs = await pg.eval_on_selector_all("[data-tab]", "e=>e.map(x=>x.dataset.tab)")
        assert "set" in tabs and "report" in tabs, tabs
        await pg.click('[data-tab="set"]'); await pg.wait_for_timeout(300)
        await pg.click("[data-migrate]"); await pg.wait_for_timeout(2500)
        n_items = await pg.evaluate("Object.keys(window.__MOCK__.items||{}).length")
        assert n_items == 52, n_items
        # दोबारा लाने पर कुछ नहीं बदलना चाहिए
        await pg.evaluate("window.__MOCK__.items.aloo.sale=21")
        await pg.click("[data-migrate]"); await pg.wait_for_timeout(2500)
        assert await pg.evaluate("window.__MOCK__.items.aloo.sale") == 21, "migration overwrote data!"
        await pg.click('[data-tab="set"]'); await pg.wait_for_timeout(300)
        await pg.fill("#stName", "कमल भाई"); await pg.fill("#stPhone", "+91 98765 43210"); await pg.fill("#stPin", "4321")
        await pg.click("[data-staffadd]"); await pg.wait_for_timeout(800)
        staff = await pg.evaluate("window.__MOCK__.staff")
        kamal = [k for k, v in staff.items() if v.get("phone") == "9876543210"]
        assert kamal and staff[kamal[0]]["active"], staff
        await pg.wait_for_timeout(300)
        await pg.click('[data-tab="set"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{SHOTS}/2-owner-settings.png", full_page=True)
        mock = await pg.evaluate("window.__MOCK__"); users = await pg.evaluate("window.__USERS__")
        await pg.context.close()

        # ---------- 2) कर्मचारी ----------
        pg = await page(b, mock, users)
        await pg.wait_for_selector("#lock:not([hidden])")
        for d in "9876543210": await pg.click(f'#lock [data-k="{d}"]')
        for d in "1111": await pg.click(f'#lock [data-k="{d}"]')
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=f"{SHOTS}/3-wrong-pin.png")
        assert await pg.is_visible(".lgerr"), "wrong pin should show error"
        for d in "4321": await pg.click(f'#lock [data-k="{d}"]')
        await pg.wait_for_selector("#lock", state="hidden")
        await pg.wait_for_timeout(800)
        tabs = await pg.eval_on_selector_all("[data-tab]", "e=>e.map(x=>x.dataset.tab)")
        assert "set" not in tabs, "staff must not see settings"
        assert "कमल" in await pg.inner_text("#who")
        await pg.screenshot(path=f"{SHOTS}/4-staff-billing.png")
        await pg.click('[data-item="tamatar"]'); await pg.fill("#qIn", "1.5"); await pg.click("[data-add]")
        await pg.click('[data-item="aloo"]'); await pg.fill("#aIn", "40"); await pg.click("[data-add]")
        await pg.click("#cartbtn"); await pg.wait_for_timeout(300)
        await pg.click('[data-pay="cash"]') if await pg.query_selector('[data-pay="cash"]') else None
        await pg.click("[data-save]"); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f"{SHOTS}/5-receipt.png")
        bills = await pg.evaluate("Object.values(window.__MOCK__).length&&Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).map(([k,v])=>Object.values(v))")
        flat = [x for arr in bills for x in arr]
        assert flat and flat[0]["byName"] == "कमल भाई" and flat[0]["by"] == kamal[0], flat[:1]
        print("bill total", flat[0]["total"], "lines", [(l["name"], l["qty"], l["amt"]) for l in flat[0]["lines"]])
        await pg.click("[data-print]"); await pg.wait_for_timeout(1500)
        printed = await pg.evaluate("[...document.querySelectorAll('iframe')].length")
        assert printed >= 1, "print iframe not created"
        # रसीद की तस्वीर अलग से देखें
        await pg.evaluate("""()=>{const b=%s;const cv=SE.receiptCanvas(b,{shop:'सब्ज़ी एक्सप्रेस',tag:'ताज़ी सब्ज़ी, आपके दरवाज़े पर',addr:'जालीपा कैंट, बाड़मेर',phone:'',date:'25-10 09:00',fq:(q,u)=>q+' '+u,qr:null,upi:'9460409552@okbizaxis',balance:null});
            const i=document.createElement('img');i.id='rc';i.src=cv.toDataURL();i.style.cssText='position:fixed;left:0;top:0;z-index:999;background:#fff;border:1px solid #000';document.body.appendChild(i)}""" % json.dumps(flat[0], ensure_ascii=False))
        await pg.wait_for_timeout(300)
        await pg.locator("#rc").screenshot(path=f"{SHOTS}/6-thermal-receipt.png")
        mock = await pg.evaluate("window.__MOCK__")
        await pg.context.close()

        # ---------- 3) मालिक रिपोर्ट + A4 ----------
        pg = await page(b, mock, users)
        await pg.wait_for_selector("#lock:not([hidden])")
        await pg.click('[data-lg="to-owner"]'); await pg.fill("#lgPass", "secret123"); await pg.click('[data-lg="owner-go"]')
        await pg.wait_for_selector("#lock", state="hidden"); await pg.wait_for_timeout(800)
        await pg.click('[data-tab="report"]'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f"{SHOTS}/7-owner-report.png")
        await pg.click("[data-a4]"); await pg.wait_for_timeout(800)
        html = await pg.evaluate("(()=>{const f=[...document.querySelectorAll('iframe')].pop();return f?f.contentDocument.documentElement.outerHTML:''})()")
        assert "सब्ज़ी-वार" in html and "टमाटर" in html, html[:300]
        open(f"{SHOTS}/a4.html", "w", encoding="utf8").write(html)
        await pg.context.close()
        await b.close()
    bad = [e for e in errs if "favicon" not in e]
    print("errors:", bad)
    print("ALL OK" if not bad else "ERRORS")

asyncio.run(main())
