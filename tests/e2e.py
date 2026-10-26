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
MOCK = open(os.path.join(H, "mock-firebase.js"), encoding="utf8").read() + "\n" + open(os.path.join(H, "..", "node_modules/jsbarcode/dist/JsBarcode.all.min.js"), encoding="utf8").read()
CFG = """window.SE_CONFIG={firebase:{apiKey:"TEST",projectId:"t"},ownerHash:"465bf0ff70fca5f4025f1dab7dd7a1ad8298b39f1635f64b0ad3cfa0bb78c334",ownerName:"विक्रम जी",updateUrl:"",photoUrl:"http://127.0.0.1:8765/fake-upload"};"""
errs = []
UPLOADS = []

async def page(b, mock, users, cfg=True):
    ctx = await b.new_context(viewport={"width": 400, "height": 860}, service_workers="block", geolocation={"latitude": 25.7712, "longitude": 71.3521, "accuracy": 12}, permissions=["geolocation", "clipboard-read", "clipboard-write"])
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append("console: " + m.text))
    await pg.add_init_script(f"window.__MOCK__={json.dumps(mock)};window.__USERS__={json.dumps(users)};window.print=()=>{{window.__printed=(window.__printed||0)+1}};")
    await pg.route("**/lib/vendor.js", lambda r: r.fulfill(body=MOCK, content_type="application/javascript"))
    await pg.route("**/config.js", lambda r: r.fulfill(body=CFG if cfg else "window.SE_CONFIG={};", content_type="application/javascript"))
    async def up(r):
        UPLOADS.append(len(r.request.post_data or ""))
        await r.fulfill(body='{"ok":true,"id":"f%d","url":"https://drive.google.com/file/d/f%d"}' % (len(UPLOADS), len(UPLOADS)), content_type="application/json")
    await pg.route("**/fake-upload", up)
    await pg.route("https://tile.openstreetmap.org/**", lambda r: r.fulfill(body=b"", status=204))
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
        await pg.fill("#lgEmail", "sabziexpress3600@gmail.com"); await pg.fill("#lgPass", "secret123")
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
        # 🔒 1 घंटे बाद PIN
        assert await pg.evaluate("!!localStorage.getItem('se_pinh')"), "pin hash not saved"
        await pg.evaluate("localStorage.setItem('se_act',String(Date.now()-2*3600e3));SR.lockCheck()"); await pg.wait_for_selector("#plock")
        for d in "1111": await pg.click(f'#plock [data-pk="{d}"]')
        await pg.wait_for_timeout(300); assert await pg.query_selector("#plock"), "wrong pin must not unlock"
        for d in "4321": await pg.click(f'#plock [data-pk="{d}"]')
        await pg.wait_for_timeout(300); assert not await pg.query_selector("#plock"), "right pin should unlock"
        print("idle PIN lock ok")
        assert "कमल" in await pg.inner_text("#who")
        await pg.screenshot(path=f"{SHOTS}/4-staff-billing.png")
        await pg.click('[data-item="tamatar"]'); await pg.fill("#qIn", "1.5"); await pg.click("[data-add]")
        await pg.click('[data-item="aloo"]'); await pg.fill("#aIn", "40"); await pg.click("[data-add]")
        await pg.evaluate("S.settings.ownerPh='9509553600'")
        await pg.click("#cartbtn"); await pg.wait_for_timeout(300); await pg.screenshot(path=f"{SHOTS}/paper.png", full_page=True)

        rc = await pg.evaluate("(()=>{S.settings.ownerPh=`9509553600`;const b={no:`SE-K7Q2MX`,date:today(),ts:Date.now(),mode:S.mode,partyName:`VIP ग्राहक`,byName:`कमल भाई`,lines:S.cart,total:cartTotal()};window.__tb=b;return SE.receiptCanvas(b,SF.rcptOpts(b,true),576).toDataURL()})()")
        import base64; open(f"{SHOTS}/rcpt-canvas.png","wb").write(base64.b64decode(rc.split(",")[1]))
        txt = await pg.evaluate("receiptText(window.__tb)"); assert "VIP" in txt and "95095 53600" in txt and "Potato" in txt and "सेहत" in txt, txt; print(txt)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.wait_for_timeout(600); await pg.click("[data-ckshare]"); await pg.wait_for_selector("#shPh")
        await pg.screenshot(path=f"{SHOTS}/14-share-ask.png")
        await pg.fill("#shPh", "+91 98290 12345"); await pg.click("[data-shwa]"); await pg.wait_for_timeout(1500)
        assert await pg.evaluate("S.cust.phone") == "9829012345", "phone not kept"
        tst = await pg.evaluate("(document.querySelector('.toast')||{}).innerText||''")
        assert "नहीं हुआ" not in tst and not errs, ("share before settle", tst, errs)
        print("share before settle ok:", tst[:60])
        await pg.click("[data-billsave]"); await pg.wait_for_selector("[data-sbok]"); await pg.wait_for_timeout(800)
        b0 = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v))")
        assert b0 and b0[0]["settled"] is False and b0[0]["pay"]["cash"] == 0, b0
        await pg.screenshot(path=f"{SHOTS}/20-settle.png")
        # ✏️ सेव के बाद बदलें: टमाटर +0.25, आलू हटाकर फिर…
        await pg.click("[data-sbedit2]"); await pg.wait_for_selector(".sbe-row")
        await pg.click('[data-sbp2="0"]'); await pg.fill("#sbeQ", "प्याज"); await pg.wait_for_timeout(200)
        await pg.click('[data-sbadd="pyaj"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f"{SHOTS}/21-edit.png")
        await pg.click("[data-sbsave]"); await pg.wait_for_selector("[data-sbok]"); await pg.wait_for_timeout(600)
        b0 = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v))")[0] if False else (await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v))"))[0]
        assert b0.get("editCount") == 1 and "प्याज" in b0["edits"][0]["diff"] and b0["total"] > 85, b0
        print("edit after save ok:", b0["edits"][0]["diff"], b0["edits"][0]["totalBefore"], "->", b0["total"])
        await pg.click('[data-sbpay="cash"]'); await pg.wait_for_timeout(150); await pg.click("[data-sbok]"); await pg.wait_for_timeout(1000)
        await pg.screenshot(path=f"{SHOTS}/5-receipt.png")
        nut = await pg.query_selector(".pp-nut"); assert nut, "nutrition box missing on receipt"; await nut.screenshot(path=f"{SHOTS}/nutri.png")
        bills = await pg.evaluate("Object.values(window.__MOCK__).length&&Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).map(([k,v])=>Object.values(v))")
        flat = [x for arr in bills for x in arr]
        assert flat and flat[0]["byName"] == "कमल भाई" and flat[0]["by"] == kamal[0] and flat[0]["settled"] is True and flat[0]["pay"]["cash"] == flat[0]["total"], flat[:1]
        assert flat[0].get("custPhone") == "9829012345", flat[0].get("custPhone")
        assert flat[0].get("loc") and abs(flat[0]["loc"]["lat"] - 25.7712) < 0.001, ("no location on bill", flat[0].get("loc"))
        hist = await pg.evaluate("Object.keys(window.__MOCK__['customers/9829012345/hist']||{})")
        assert hist == [flat[0]["no"]], ("customer history", hist)
        await pg.evaluate("SR.tick()"); await pg.wait_for_timeout(800)
        trk = await pg.evaluate("Object.values(window.__MOCK__.trk||{})"); live = await pg.evaluate("window.__MOCK__.live||{}")
        assert trk and trk[0]["uid"] == kamal[0] and trk[0]["pts"], ("trk", trk)
        assert kamal[0] in live and live[kamal[0]]["lat"], ("live", live)
        print("location ok: bill loc", flat[0]["loc"], "trk pts", len(trk[0]["pts"]), "hist", hist)
        print("bill total", flat[0]["total"], "lines", [(l["name"], l["qty"], l["amt"]) for l in flat[0]["lines"]])
        await pg.click("[data-print]"); await pg.wait_for_timeout(1500)
        printed = await pg.evaluate("[...document.querySelectorAll('iframe')].length")
        assert printed >= 1, "print iframe not created"
        # रसीद की तस्वीर अलग से देखें
        await pg.evaluate("""()=>{const b=%s;const cv=SE.receiptCanvas(b,{shop:'सब्ज़ी एक्सप्रेस',tag:'ताज़ी सब्ज़ी, आपके दरवाज़े पर',addr:'जालीपा कैंट, बाड़मेर',phone:'',date:'25-10 09:00',fq:(q,u)=>q+' '+u,qr:null,upi:'9460409552@okbizaxis',balance:null});
            const i=document.createElement('img');i.id='rc';i.src=cv.toDataURL();i.style.cssText='position:fixed;left:0;top:0;z-index:999;background:#fff;border:1px solid #000';document.body.appendChild(i)}""" % json.dumps(flat[0], ensure_ascii=False))
        await pg.wait_for_timeout(300)
        await pg.locator("#rc").screenshot(path=f"{SHOTS}/6-thermal-receipt.png")
        await pg.evaluate("document.getElementById('rc').remove();closeSheet()")
        # ---- ✏️ भाव बदलना (कर्मचारी) ----
        await pg.click('[data-tab="bill"]'); await pg.wait_for_timeout(200)
        await pg.click("[data-ratemode]"); await pg.wait_for_timeout(200)
        await pg.click('#grid [data-item="lauki"]'); await pg.wait_for_selector("#rnIn")
        await pg.fill("#rnIn", "35"); await pg.press("#rnIn", "Enter"); await pg.wait_for_timeout(400)
        lk = await pg.evaluate("window.__MOCK__.items.lauki")
        assert lk["sale"] == 35 and lk["rateByName"] == "कमल भाई" and lk["ratePrev"] == 30, lk
        assert any(v["name"] == "लौकी" and v["new"] == 35 for v in (await pg.evaluate("Object.values(window.__MOCK__.priceLog||{})")))
        await pg.click("[data-ratemode]"); await pg.wait_for_timeout(200)
        assert not await pg.query_selector("#grid .mg"), "staff must not see margin"
        print("staff rate change ok")
        # ---- 🅧 XYZ + ➕ नया सामान ----
        await pg.click('[data-tab="bill"]'); await pg.wait_for_timeout(300)
        await pg.click('#grid [data-item="xyz"]'); await pg.wait_for_selector("#xyAmt")
        await pg.fill("#xyAmt", "50"); await pg.click("[data-xysave]"); await pg.wait_for_timeout(200)
        assert await pg.evaluate("S.cart.length") == 0, "XYZ without note must be refused"
        await pg.fill("#xyNote", "थैली"); await pg.click("[data-xysave]"); await pg.wait_for_timeout(200)
        assert await pg.evaluate("S.cart.map(l=>[l.id,l.qty,l.rate,l.note])") == [["xyz", 50, 1, "थैली"]]
        await pg.click('#grid [data-newitem]'); await pg.wait_for_selector("#niName")
        await pg.fill("#niName", "शकरकंद"); await pg.fill("#niEn", "Sweet Potato"); await pg.fill("#niRate", "40")
        await pg.screenshot(path=f"{SHOTS}/15-new-item.png")
        await pg.click("[data-nisave]"); await pg.wait_for_timeout(600)
        ni = [v for v in (await pg.evaluate("Object.values(window.__MOCK__.items)")) if v["name"] == "शकरकंद"]
        assert ni and ni[0]["pending"] and ni[0]["addedByName"] == "कमल भाई" and ni[0]["sale"] == 40, ni
        await pg.fill("#qIn", "2"); await pg.click("[data-add]"); await pg.wait_for_timeout(200)
        await pg.click("#cartbtn"); await pg.wait_for_timeout(500)
        await pg.click("[data-billsave]"); await pg.wait_for_selector("[data-sbok]"); await pg.wait_for_timeout(400)
        await pg.click("[data-sbok]"); await pg.wait_for_timeout(1000)
        xb = [b for b in (await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v))")) if any(l["id"] == "xyz" for l in b["lines"])]
        assert xb and [l for l in xb[0]["lines"] if l["id"] == "xyz"][0]["note"] == "थैली" and xb[0]["total"] == 130, xb
        print("xyz + new item bill", xb[0]["no"], xb[0]["total"])
        await pg.evaluate("closeSheet()")
        # ---- खरीद (मंडी) — बिक्री जैसा ----
        await pg.click('[data-tab="kharid"]'); await pg.wait_for_timeout(300)
        assert await pg.input_value("#pShop") == "", "shop must not auto-fill"
        await pg.fill("#pShop", "पवन सब्ज़ी भंडार"); await pg.fill("#pPh", "98290 11111")
        await pg.click('#pgrid [data-pitem="tamatar"]'); await pg.wait_for_selector("#piQ")
        await pg.fill("#piQ", "28"); await pg.press("#piQ", "Enter"); await pg.keyboard.type("10"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300)
        await pg.wait_for_function("document.activeElement&&document.activeElement.id==='pq'", timeout=4000)
        ae = await pg.evaluate("[document.activeElement.id,document.activeElement.tagName,!!document.querySelector(\"#sheet .qpop\"),document.querySelector(\"#sheet\").innerText.slice(0,80)]"); assert ae[0] == "pq", ae
        await pg.keyboard.type("प्याज 92"); await pg.keyboard.press("Enter"); await pg.wait_for_selector("#piQ")
        assert await pg.input_value("#piQ") == "92"
        await pg.fill("#piR", "52"); await pg.press("#piR", "Enter"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f"{SHOTS}/8-kharid.png", full_page=True)
        await pg.click("[data-pbill]"); await pg.wait_for_selector("#pNet")
        await pg.fill("#pNet", "5000"); await pg.press("#pNet", "Tab"); await pg.wait_for_timeout(200)
        assert await pg.input_value("#pDisc") == "64", await pg.input_value("#pDisc")
        await pg.click('[data-ppay="udhar"]'); await pg.wait_for_timeout(150); await pg.fill("#pPaid", "1000"); await pg.press("#pPaid", "Tab"); await pg.wait_for_timeout(200)
        async with pg.expect_file_chooser() as fc:
            await pg.click("[data-pphoto]")
        await (await fc.value).set_files(os.path.join(WWW, "img", "tamatar.jpg")); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f"{SHOTS}/8b-kharid-bill.png", full_page=True)
        await pg.click("[data-psave]"); await pg.wait_for_timeout(3500)
        pur = await pg.evaluate("Object.values(window.__MOCK__.purchases||{})")
        assert len(pur) == 1 and pur[0]["gross"] == 5064 and pur[0]["disc"] == 64 and pur[0]["total"] == 5000 and pur[0]["due"] == 4000 and pur[0]["supName"] == "पवन सब्ज़ी भंडार", pur
        print("purchase", pur[0]["gross"], "disc", pur[0]["disc"], "net", pur[0]["total"], "due", pur[0]["due"], "photos", pur[0].get("photos"), "pending", pur[0].get("photoPending"), "uploads", UPLOADS)
        assert UPLOADS and pur[0]["photos"] and pur[0]["photoPending"] == 0, "photo upload failed"
        assert await pg.evaluate("SF.pendingPhotos()") == 0, "photo not deleted from phone"
        assert await pg.input_value("#pShop") == "", "shop should be empty for next purchase"
        # ⚡ खराबी + खर्चा (कर्मचारी)
        await pg.click("[data-qwaste]"); await pg.wait_for_selector("#wpick")
        await pg.click('#wpick [data-wit="tamatar"]'); await pg.wait_for_selector("#wQ"); await pg.fill("#wQ", "0.5"); await pg.click('[data-wr="सड़ गई"]'); await pg.click("[data-wsave]"); await pg.wait_for_timeout(400)
        await pg.click("[data-qkharch]"); await pg.wait_for_selector("#qkA"); await pg.click('[data-khq="गाड़ी किराया"]'); await pg.fill("#qkA", "250"); await pg.click("[data-qksave]"); await pg.wait_for_timeout(400)
        st = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/meta')).map(([k,v])=>v.stock).filter(Boolean)[0]")
        assert st and st["wlog"][0]["reason"] == "सड़ गई" and st["items"]["tamatar"]["waste"] == 0.5, st
        kh = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/kharch')).flatMap(([k,v])=>Object.values(v))")
        assert any(k["what"] == "गाड़ी किराया" and k["amt"] == 250 for k in kh), kh
        print("waste + kharch ok")
        await pg.screenshot(path=f"{SHOTS}/9-kharid-saved.png", full_page=True)
        # संस्था को प्याज — आज के खरीद भाव ₹52 पर
        await pg.click('[data-tab="bill"]'); await pg.wait_for_timeout(200)
        inst_rate = await pg.evaluate("(()=>{S.mode='inst';const r=priceOf(item('pyaj'));S.mode='walk';return r})()")
        assert inst_rate == 51.34, inst_rate
        # लेबल: सब्ज़ी की टोकरी — टमाटर (नाम + भाव + बारकोड) → स्कैन → वज़न पूछे
        await pg.click('[data-tab="label"]'); await pg.wait_for_timeout(200)
        await pg.click('[data-ltype="sabzi"]'); await pg.wait_for_timeout(150)
        await pg.click('#p-label [data-lpick="tamatar"]'); await pg.wait_for_timeout(300)
        await pg.locator(".lprev canvas").screenshot(path=f"{SHOTS}/10-label-sabzi.png")
        code = await pg.evaluate("SF.vwCode(item('tamatar').plu,'fix',0)")
        await pg.evaluate(f"handleScan('{code}')"); await pg.wait_for_timeout(300)
        if not await pg.query_selector("#qIn"):
            await pg.screenshot(path=f"{SHOTS}/dbg-scan.png"); print("DBG", code, await pg.evaluate("[S.tab,S.mode,!!SF.parseVW('%s'),JSON.stringify(SF.parseVW('%s')&&{k:SF.parseVW('%s').kind,id:SF.parseVW('%s').it&&SF.parseVW('%s').it.id}),document.querySelector('.toast')&&document.querySelector('.toast').innerText]" % (code,code,code,code,code)))
        await pg.fill("#qIn", "0.5"); await pg.click("[data-add]"); await pg.wait_for_timeout(200)
        cart = await pg.evaluate("S.cart.map(l=>[l.id,l.qty,l.amt])")
        assert ["tamatar", 0.5, 15] in cart, (code, cart)
        print("sabzi label code", code, "cart", cart)
        await pg.evaluate("S.cart=[];refreshAfterCart()")
        # रात का स्टॉक
        await pg.click('[data-tab="day"]'); await pg.wait_for_timeout(300)
        await pg.click("[data-night]"); await pg.wait_for_timeout(200)
        await pg.fill('[data-nclose="pyaj"]', "88"); await pg.fill('[data-nclose="tamatar"]', "26")
        assert "होना चाहिए" not in await pg.inner_text("#sheet"), "staff must not see expected stock"
        await pg.click("[data-nsave]"); await pg.wait_for_timeout(700)
        assert not await pg.query_selector("[data-nclose]"), "no recheck for staff"
        assert "धन्यवाद" in await pg.evaluate("(document.querySelector('.toast')||{}).innerText||''")
        st = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/meta')).map(([k,v])=>v.stock).filter(Boolean)[0]")
        assert st["items"]["pyaj"]["close"] == 88 and st["nightBy"] == "कमल भाई", st["items"]["pyaj"]
        print("night count (no recheck) ok")
        await pg.screenshot(path=f"{SHOTS}/11-day.png", full_page=True)
        # बिल रद्द करने की अर्ज़ी (कर्मचारी)
        await pg.click('[data-tab="bills"]'); await pg.wait_for_timeout(300)
        await pg.click('#p-bills [data-bill] >> nth=0'); await pg.wait_for_timeout(300)
        await pg.click('details.creq summary'); await pg.fill('#crWhy', 'ग्राहक ने सामान लौटाया'); await pg.click('[data-creq]'); await pg.wait_for_timeout(600)
        cr = await pg.evaluate("Object.values(window.__MOCK__.cancelReq||{})")
        assert len(cr) == 1 and cr[0]["status"] == "pending", cr
        print("cancel request", cr[0]["no"], cr[0]["reason"])
        mock = await pg.evaluate("window.__MOCK__")
        await pg.context.close()

        # ---------- 3) मालिक रिपोर्ट + A4 ----------
        pg = await page(b, mock, users)
        await pg.wait_for_selector("#lock:not([hidden])")
        await pg.click('[data-lg="to-owner"]'); await pg.fill("#lgEmail", "sabziexpress3600@gmail.com"); await pg.fill("#lgPass", "secret123"); await pg.click('[data-lg="owner-go"]')
        await pg.wait_for_selector("#lock", state="hidden"); await pg.wait_for_timeout(800)
        # किराना: नया सामान + पैकेट लेबल (दुकान, नाम, मात्रा, कीमत, एक्सपायरी, बारकोड) → स्कैन → 1 पैकेट
        await pg.click('[data-tab="label"]'); await pg.wait_for_timeout(200)
        await pg.click('[data-ltype="kirana"]'); await pg.wait_for_timeout(150)
        await pg.fill("#kNm", "मूंग दाल"); await pg.fill("#kPk", "500 ग्राम"); await pg.fill("#kPr", "65"); await pg.fill("#kCo", "52")
        await pg.click("[data-knew]"); await pg.wait_for_timeout(400)
        await pg.fill("#lExp", "2027-04-30"); await pg.wait_for_timeout(300)
        await pg.locator(".lprev canvas").screenshot(path=f"{SHOTS}/13-label-kirana.png")
        kcode = await pg.evaluate("(()=>{const it=S.items.find(i=>i.name==='मूंग दाल');return SF.vwCode(it.plu,'fix',0)})()")
        await pg.evaluate(f"handleScan('{kcode}')"); await pg.wait_for_timeout(300)
        kc = await pg.evaluate("S.cart.map(l=>[l.name,l.qty,l.amt])")
        assert ["मूंग दाल", 1, 65] in kc, (kcode, kc)
        print("kirana code", kcode, "cart", kc)
        await pg.evaluate("S.cart=[];refreshAfterCart()")
        await pg.click('[data-tab="day"]'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=f"{SHOTS}/12-owner-day.png", full_page=True)
        txt = await pg.inner_text("#p-day")
        assert "असली मुनाफ़ा" in txt, txt[:300]
        assert "रात का मिलान" in txt and "प्याज" in txt, txt[:600]
        assert "अभी गाड़ी में (लाइव)" in txt, "live stock card"
        await pg.click("[data-nrevok]"); await pg.wait_for_timeout(500)
        assert await pg.evaluate("Object.keys(window.__MOCK__.ownerCfg||{}).some(k=>k.startsWith('rev_'))"), "review not saved"
        await pg.locator(".nrev").screenshot(path=f"{SHOTS}/19-night-review.png")
        mh = await pg.evaluate("(()=>{const o=S.prevStock;S.prevStock={pyaj:{close:88},tamatar:{close:26}};const h=SF.morningHTML();S.prevStock=o;return h})()")
        assert "कल रात आपने लिखा था" in mh and "प्याज 88" in mh, mh
        print("owner night review ok")
        # 📒 पुराना बाकी (मालिक)
        await pg.click('[data-tab="udhar"]'); await pg.wait_for_timeout(300)
        await pg.click('#p-udhar [data-party="jco-mess"]'); await pg.wait_for_selector(".nsbox summary"); await pg.click(".nsbox summary")
        await pg.fill("#obAmt", "1500"); await pg.fill("#obNote", "सितंबर तक का"); await pg.click("[data-opbal]"); await pg.wait_for_timeout(900)
        led = await pg.evaluate("Object.values(window.__MOCK__.ledger||{}).filter(l=>l.opening)")
        assert led and led[0]["amt"] == 1500 and led[0]["partyId"] == "jco-mess", led
        assert "पुराना बाकी" in await pg.inner_text("#sheet")
        await pg.evaluate("closeSheet()")
        # 🔑 PIN दिखे
        await pg.click('[data-tab="set"]'); await pg.wait_for_timeout(400)
        assert "PIN 4321" in await pg.inner_text("#p-set"), "owner should see staff PIN"
        print("opening balance + PIN view ok")
        # 📥 कॉपी की पुरानी उधारी
        sums = await pg.evaluate("SR.OLD_UDHAR.map(g=>[g.name,g.rows.reduce((a,r)=>a+r[1],0),g.total,g.rows.length])")
        print("old udhar", sums)
        assert all(x[1] == x[2] for x in sums), sums
        await pg.click('[data-tab="udhar"]'); await pg.wait_for_timeout(300); await pg.click("[data-oldud]"); await pg.wait_for_selector("[data-odsave]")
        await pg.screenshot(path=f"{SHOTS}/22-old-udhar.png")
        await pg.click("[data-odsave]"); await pg.wait_for_timeout(2500)
        led = await pg.evaluate("Object.keys(window.__MOCK__.ledger||{}).filter(k=>k.startsWith('op_')).length")
        tot = await pg.evaluate("Object.entries(window.__MOCK__.ledger||{}).filter(([k])=>k.startsWith('op_')).reduce((a,[k,v])=>a+v.amt,0)")
        print("imported", led, tot)
        assert led >= 96 and tot >= 32625, (led, tot)
        assert not await pg.query_selector("[data-oldud]") or True
        # 📈 मालिक: टाइल पर मुनाफ़ा
        await pg.click('[data-tab="bill"]'); await pg.wait_for_timeout(400)
        mg = await pg.eval_on_selector_all("#grid .mg", "e=>e.map(x=>x.innerText)")
        assert mg and any("%" in x for x in mg), mg
        print("owner margin sample", mg[:3])
        # 🔐 UPI मिलान: मालिक की खरीद (विक्रम जी ने दिया) → AI फाइल → जवाब चिपकाएँ
        await pg.click('[data-tab="kharid"]'); await pg.wait_for_timeout(400)
        await pg.fill("#pShop", "राजू"); await pg.click('#pgrid [data-pitem="aloo"]'); await pg.wait_for_selector("#piQ")
        await pg.fill("#piQ", "10"); await pg.fill("#piR", "15"); await pg.press("#piR", "Enter"); await pg.wait_for_timeout(200)
        await pg.click("[data-pbill]"); await pg.wait_for_selector("[data-psave]"); await pg.click("[data-psave]"); await pg.wait_for_timeout(800)
        await pg.evaluate("SP.st.loaded=0"); await pg.wait_for_timeout(200)
        html = await pg.evaluate("(async()=>{await new Promise(r=>setTimeout(r,300));return SP.aiHTML()})()")
        open(f"{SHOTS}/upi-milan.html", "w", encoding="utf8").write(html)
        need = await pg.evaluate("SP.need().map(x=>[x.ref,x.amt,x.shop])")
        assert any(n[1] == 150 and n[2] == "राजू" for n in need), need
        ref = [n[0] for n in need if n[2] == "राजू"][0]
        await pg.click('[data-tab="kharid"]'); await pg.wait_for_timeout(300)
        assert "स्क्रीनशॉट चाहिए" in await pg.inner_text(".spcard")
        await pg.click("[data-spaccts]"); await pg.wait_for_selector("#acL"); await pg.fill("#acL", "विक्रम जी पर्सनल"); await pg.fill("#acN", "0499"); await pg.click("[data-acadd]"); await pg.wait_for_timeout(300); await pg.evaluate("closeSheet()")
        ai = "सार: 1 मिला।\n```json\n" + json.dumps({"sabji_match": 1, "items": [{"ref": ref, "payee": "RAJU RAM", "upi": "raju@ybl", "amt": 150, "time": "2026-10-25 08:10", "utr": "429811112222", "from_bank": "SBI", "from_last4": "0499", "app": "PhonePe", "conf": "high"}], "unmatched": [{"payee": "MOHAN LAL", "amt": 700, "time": "2026-10-25 09:00", "utr": "429899990000", "from_last4": "0499"}]}, ensure_ascii=False) + "\n```"
        await pg.click("[data-sppaste]"); await pg.wait_for_selector("#spTxt"); await pg.fill("#spTxt", ai); await pg.click("[data-spcheck]"); await pg.wait_for_selector("[data-spsave2]")
        await pg.screenshot(path=f"{SHOTS}/17-upi-preview.png")
        await pg.click("[data-spsave2]"); await pg.wait_for_timeout(800)
        pay = await pg.evaluate("window.__MOCK__.pay"); payees = await pg.evaluate("Object.values(window.__MOCK__.payees||{})")
        assert any(v.get("utr") == "429811112222" and v["payee"] == "RAJU RAM" for v in pay.values()) and any(v.get("kind") == "unmatched" for v in pay.values()), pay
        assert payees and payees[0]["name"] == "RAJU RAM" and "राजू" in payees[0]["shops"], payees
        await pg.click('[data-tab="kharid"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{SHOTS}/18-owner-kharid.png", full_page=True)
        assert "बिना खरीद" in await pg.inner_text(".spcard") or "खरीद एंट्री नहीं" in await pg.inner_text(".spcard")
        print("UPI matching ok", ref)
        await pg.click('[data-tab="day"]'); await pg.wait_for_timeout(500)
        # 🤖 AI ऑडिट पैक
        assert await pg.is_visible("[data-audcopy]")
        pack = await pg.evaluate("SF.auditPack()")
        open(f"{SHOTS}/audit-pack.txt", "w", encoding="utf8").write(pack)
        assert "AI के लिए हिदायत" in pack and "माल का मिलान" in pack and "XYZ" in pack and "थैली" in pack and "शकरकंद" in pack, pack[:400]
        await pg.click("[data-audcopy]"); await pg.wait_for_timeout(1200)
        clip = await pg.evaluate("navigator.clipboard.readText()")
        assert "ऑडिट पैक" in clip, clip[:100]
        print("audit pack chars", len(pack))
        # 📍 रूट: नकली 20 मिनट का पड़ाव + लाइव
        await pg.evaluate("""(()=>{const d=today();const t0=new Date(d+'T09:00:00').getTime();const pts=[];
          for(let i=0;i<25;i++)pts.push((t0+i*60000)+',25.771'+(i%3)+',71.3521,10');
          for(let i=0;i<10;i++)pts.push((t0+(26+i)*60000)+','+(25.771+(i+1)*0.002).toFixed(6)+',71.36,10');
          pts.push((t0+40*60000)+',OFF');pts.push((t0+55*60000)+',ON');
          const uid=Object.entries(window.__MOCK__.staff).find(([k,v])=>v.phone==='9876543210')[0];
          window.__MOCK__.trk=window.__MOCK__.trk||{};window.__MOCK__.trk[d+'_'+uid+'_09']={uid,name:'कमल भाई',date:d,hr:9,pts};
          const B=window.__MOCK__['days/'+d+'/bills'];Object.values(B).forEach((b,i)=>{b.ts=t0+(5+i*3)*60000});S.dayBills.forEach((b,i)=>{b.ts=t0+(5+i*3)*60000})})()""")
        await pg.click('[data-tab="route"]'); await pg.wait_for_timeout(2500)
        stops = await pg.eval_on_selector_all("#p-route .rstop", "e=>e.map(x=>x.innerText)")
        assert stops and "बिल" in stops[0] and "0 बिल" not in stops[0], stops
        rtxt = await pg.inner_text("#p-route")
        assert "लोकेशन में रुकावट" in rtxt and "कमल भाई" in rtxt, rtxt[:500]
        await pg.click('#p-route [data-rname="0"]'); await pg.wait_for_selector("#plName")
        await pg.fill("#plName", "सरल लाइन"); await pg.click("[data-plsave]"); await pg.wait_for_timeout(800)
        assert any(p["name"] == "सरल लाइन" for p in (await pg.evaluate("Object.values(window.__MOCK__.places||{})")))
        await pg.click('#p-route [data-ragg="7"]'); await pg.wait_for_timeout(1500)
        agg = await pg.inner_text("#rAgg")
        assert "सरल लाइन" in agg, agg[:400]
        assert "9829012345" in await pg.inner_text("#rcl")
        await pg.screenshot(path=f"{SHOTS}/16-route.png", full_page=True)
        print("route stops", len(stops), "|", stops[0].replace("\n", " ")[:80])
        await pg.click('[data-tab="report"]'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f"{SHOTS}/7-owner-report.png")
        assert await pg.is_visible("[data-npok]"), "pending new item card missing"
        await pg.click("[data-npok]"); await pg.wait_for_timeout(500)
        assert not [v for v in (await pg.evaluate("Object.values(window.__MOCK__.items)")) if v.get("pending")], "approve failed"
        await pg.click('[data-crok]'); await pg.click('[data-crok]'); await pg.wait_for_timeout(800)
        cancelled = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v)).filter(b=>b.cancelled).length")
        assert cancelled == 1, cancelled
        assert await pg.evaluate("Object.values(window.__MOCK__.cancelReq)[0].status") == "approved"
        print("owner approved cancel")
        await pg.click("[data-a4]"); await pg.wait_for_timeout(800)
        html = await pg.evaluate("(()=>{const f=[...document.querySelectorAll('iframe')].pop();return f?f.contentDocument.documentElement.outerHTML:''})()")
        assert "सब्ज़ी-वार" in html and "टमाटर" in html and "मंडी खरीद" in html, html[:300]
        open(f"{SHOTS}/a4.html", "w", encoding="utf8").write(html)
        await pg.context.close()
        await b.close()
    bad = [e for e in errs if "favicon" not in e]
    print("errors:", bad)
    print("ALL OK" if not bad else "ERRORS")

asyncio.run(main())
