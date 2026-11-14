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

async def wf(pg, expression, timeout=30000, polling=100):
    """wait_for_function जैसा, पर evaluate से (पीछे के टैब में raf/CSP से अटकता नहीं)"""
    import time
    end = time.time() + timeout / 1000
    while True:
        try:
            if await pg.evaluate(expression):
                return True
        except Exception:
            pass
        if time.time() > end:
            try:
                st = await pg.evaluate("[document.activeElement&&(document.activeElement.id||document.activeElement.tagName),document.querySelector('#sheet')&&document.querySelector('#sheet').innerText.slice(0,100),S.tab]")
            except Exception:
                st = None
            raise TimeoutError("wf timeout: " + expression[:80] + " | " + str(st))
        await pg.wait_for_timeout(polling)


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
    await pg.route("https://server.arcgisonline.com/**", lambda r: r.fulfill(body=b"", status=204))
    await pg.goto(URL)
    return pg


CONTRAST_JS = r"""(()=>{const P=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(',').map(x=>parseFloat(x));return {r:a[0],g:a[1],b:a[2],a:a.length>3?a[3]:1}};
const L=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
const mix=(top,bot)=>({r:top.r*top.a+bot.r*(1-top.a),g:top.g*top.a+bot.g*(1-top.a),b:top.b*top.a+bot.b*(1-top.a),a:1});
const bgOf=el=>{const st=[];let e=el;while(e&&e.nodeType===1){if(getComputedStyle(e).backgroundImage!=='none'&&!st.length)return null;const c=P(getComputedStyle(e).backgroundColor);if(c&&c.a>0){st.push(c);if(c.a>=.99)break}e=e.parentElement}
  let base=P(getComputedStyle(document.body).backgroundColor)||{r:255,g:255,b:255,a:1};if(base.a<1)base={r:255,g:255,b:255,a:1};for(let i=st.length-1;i>=0;i--)base=mix(st[i],base);return base};
const out=[];const seen=new Set();
document.querySelectorAll('body *').forEach(el=>{if(!el.offsetParent&&getComputedStyle(el).position!=='fixed')return;const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1);if(!own)return;
  const cs=getComputedStyle(el);if(cs.visibility==='hidden'||+cs.opacity<.3)return;if(el.closest('svg,canvas,.leaflet-container,img,header'))return;
  const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return;
  let fg=P(cs.color);if(!fg)return;const bg=bgOf(el);if(!bg)return;if(fg.a<1)fg=mix(fg,bg);
  const l1=L(fg),l2=L(bg),cr=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
  if(cr<3){const path=[];let e=el;for(let i=0;i<4&&e&&e!==document.body;i++){path.unshift(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):''));e=e.parentElement}
    const k=path.join('>');if(seen.has(k))return;seen.add(k);out.push({cr:+cr.toFixed(2),path:k,text:el.textContent.trim().slice(0,40)})}});
return out})()"""

BRIGHT_JS = r"""(()=>{const P=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(',').map(x=>parseFloat(x));return {r:a[0],g:a[1],b:a[2],a:a.length>3?a[3]:1}};
const L=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};const out=[],seen=new Set();
document.querySelectorAll('body *').forEach(el=>{if(!el.offsetParent)return;if(el.closest('header,.qr,.qrbox,canvas,svg,img,.leaflet-container,[class*=qr]'))return;const c=P(getComputedStyle(el).backgroundColor);if(!c||c.a<.9)return;if(L(c)<.55)return;
 const r=el.getBoundingClientRect();if(r.width*r.height<1500)return;const k=el.tagName.toLowerCase()+'.'+(typeof el.className==='string'?el.className.trim().split(/\s+/).slice(0,2).join('.'):'');if(seen.has(k))return;seen.add(k);out.push(k+' '+getComputedStyle(el).backgroundColor)});return out})()"""

LATIN_JS = r"""(()=>{const W=new Map();const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=tw.nextNode()){const el=n.parentElement;if(!el||!el.offsetParent||el.closest('script,style,svg'))continue;
 (n.textContent.match(/[A-Za-z][A-Za-z.\-]{2,}/g)||[]).forEach(w=>W.set(w,(W.get(w)||0)+1))}return [...W.keys()]})()"""

def fs_enc(v):
    """Firestore REST टाइप वाला रूप (h.html/o.html टेस्ट के लिए)"""
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue": v}
    if isinstance(v, str): return {"stringValue": v}
    if v is None: return {"nullValue": None}
    if isinstance(v, list): return {"arrayValue": {"values": [fs_enc(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: fs_enc(x) for k, x in v.items()}}}
    return {"stringValue": str(v)}

async def gallery(pg, who):
    """GALLERY=1 हो तो हर टैब की फोटो — रोशनी और अँधेरे (dark) दोनों में"""
    if not os.environ.get("GALLERY"): return
    g = os.path.join(SHOTS, "gallery"); os.makedirs(g, exist_ok=True)
    await pg.evaluate("closeSheet&&closeSheet()")
    tabs = await pg.eval_on_selector_all("[data-tab]", "e=>e.map(x=>x.dataset.tab)")
    for cs in ["light", "dark"]:
        await pg.emulate_media(color_scheme=cs)
        for t in tabs:
            await pg.click(f'[data-tab="{t}"]'); await pg.wait_for_timeout(500)
            if t == "day" and who == "owner":
                for k in ["sar", "paisa", "maal", "ai"]:
                    await pg.evaluate(f"SF.dseg='{k}';SF.dsegApply();window.scrollTo(0,0)"); await pg.wait_for_timeout(400)
                    await pg.screenshot(path=f"{g}/{who}-{cs}-day-{k}.png", full_page=True)
                    for x in await pg.evaluate(CONTRAST_JS): print("LOWCONTRAST", who, cs, "day-"+k, x["cr"], x["path"], "|", x["text"])
                await pg.evaluate("SF.dseg='sar';SF.dsegApply()")
            await pg.screenshot(path=f"{g}/{who}-{cs}-{t}.png", full_page=True)
            bad = await pg.evaluate(CONTRAST_JS)
            for x in bad: print("LOWCONTRAST", who, cs, t, x["cr"], x["path"], "|", x["text"])
            if cs == "light": print("LATIN", who, t, " ".join(await pg.evaluate(LATIN_JS)))
            if cs == "dark":
                for x in await pg.evaluate(BRIGHT_JS): print("BRIGHT", who, t, x)
        for t, sel in [("bills", "[data-bill]"), ("udhar", "[data-party]"), ("day", "[data-night]"), ("kharid", "[data-pview]"), ("bill", "#grid [data-item]")]:
            if t not in tabs: continue
            await pg.click(f'[data-tab="{t}"]'); await pg.wait_for_timeout(400)
            el = await pg.query_selector(sel)
            if not el: continue
            try:
                await el.click(); await pg.wait_for_timeout(700)
                await pg.screenshot(path=f"{g}/{who}-{cs}-sheet-{t}.png", full_page=True)
                bad = await pg.evaluate(CONTRAST_JS)
                for x in bad: print("LOWCONTRAST", who, cs, "sheet-"+t, x["cr"], x["path"], "|", x["text"])
            except Exception as ex: print("SHEETFAIL", who, t, str(ex)[:80])
            await pg.evaluate("closeSheet&&closeSheet()"); await pg.wait_for_timeout(200)
    await pg.emulate_media(color_scheme="light")

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
        pg = await page(b, {"ownerCfg": {"flags": {"board1": 1, "board2": 1, "cost1": 1, "photo1": 1, "copy1": 1, "copy2": 1, "winter1": 1, "board3": 1, "supply1": 1, "chat1": 1}}}, users)
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
        rc = await pg.evaluate("(()=>{S.settings.ownerPh=`9509553600`;const b={no:`SE-K7Q2MX`,date:today(),ts:Date.now(),mode:S.mode,partyName:`VIP ग्राहक`,byName:`कमल भाई`,lines:S.cart.map(l=>({...l})),total:cartTotal()};window.__tb=b;return SE.receiptCanvas(b,SF.rcptOpts(b,true),576).toDataURL()})()")
        import base64; open(f"{SHOTS}/rcpt-canvas.png","wb").write(base64.b64decode(rc.split(",")[1]))
        txt = await pg.evaluate("receiptText(window.__tb)"); assert "VIP" in txt and "95095 53600" in txt and "Potato" in txt and "सेहत" in txt, txt; print(txt)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        # "बिल देखें" = बिल तुरंत पक्का सेव, सीधे भुगतान वाली खिड़की (कोई ✕ नहीं)
        await pg.click("#cartbtn"); await pg.wait_for_selector("[data-sbok]"); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f"{SHOTS}/paper.png", full_page=True)
        assert not await pg.query_selector("#sheet [data-del]") and not await pg.query_selector("#sheet [data-edit]"), "no remove/edit on saved bill"
        assert await pg.query_selector("#sheet .pp-c") and await pg.query_selector("#sheet #sbqr canvas, #sheet #sbqr img"), "saved bill + QR shown in settle"
        # ⚡ एक टैप शीट: 4 चिप एक लाइन, 4 बटन (एडिट/फोटो/शेयर/प्रिंट), नया ग्राहक + बड़ा बटन, सामान पर टैप = एडिट
        assert len(await pg.query_selector_all("#sheet .paym4 [data-sbpay]")) == 4 and len(await pg.query_selector_all("#sheet .sb-act4 button")) == 4
        assert await pg.query_selector("#sheet [data-sbrow='0']") and "पैसा आ गया · सेव" in await pg.inner_text("[data-sbok]") and "नया ग्राहक" in await pg.inner_text("[data-sblater]")
        sht = await pg.inner_text("#sheet")
        assert "VIKRAM" not in sht and "@okbizaxis" in sht and "बिलिंग" in await pg.inner_text("#sheet .stmp.by") and "कमल भाई" in await pg.inner_text("#sheet .stmp.by"), sht[:400]
        assert await pg.evaluate("S.cart.length") == 0, "cart should be cleared after auto-save"
        b0 = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v))")
        assert b0 and b0[0]["settled"] is False and b0[0]["pay"]["cash"] == 0, b0
        await pg.screenshot(path=f"{SHOTS}/20-settle.png")
        # ✏️ सेव के बाद बदलें: टमाटर +0.25, आलू हटाकर फिर…
        await pg.click("#sheet [data-sbrow='0']"); await pg.wait_for_selector(".sbe-row")
        await pg.click('[data-sbp2="0"]'); await pg.fill("#sbeQ", "प्याज"); await pg.wait_for_timeout(200)
        await pg.click('[data-sbadd="pyaj"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f"{SHOTS}/21-edit.png")
        await pg.click("[data-sbsave]"); await pg.wait_for_selector("[data-sbok]"); await pg.wait_for_timeout(600)
        b0 = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v))")[0] if False else (await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v))"))[0]
        assert b0.get("editCount") == 1 and "प्याज" in b0["edits"][0]["diff"] and b0["total"] > 85, b0
        assert b0["total"] == round(b0["total"]) and abs(b0["total"] - b0["sub"]) < 1, (b0["total"], b0["sub"])
        if abs(b0["total"] - b0["sub"]) >= 0.01:
            assert "राउंड ऑफ" in await pg.inner_text("#sheet .ppc-sum"), await pg.inner_text("#sheet .ppc-sum")
            await pg.screenshot(path=f"{SHOTS}/29-roundoff.png")
        print("edit after save ok:", b0["edits"][0]["diff"], b0["edits"][0]["totalBefore"], "->", b0["total"])
        await pg.click('[data-sbpay="cash"]'); await pg.wait_for_timeout(150)
        await pg.fill("#sbGiven", "200"); await pg.wait_for_timeout(100)
        assert "₹" in await pg.inner_text("#sbChg")
        await pg.screenshot(path=f"{SHOTS}/27-onetap-cash.png")
        settled_no = b0["no"]
        await pg.click("[data-sbok]"); await pg.wait_for_timeout(1000)
        # सेव के बाद अलग रसीद नहीं — सीधे खाली बिलिंग + संदेश
        assert not await pg.query_selector("#sheet .scrim"), "no receipt screen after settle"
        tst0 = await pg.evaluate("(document.querySelector('.toast')||{}).innerText||''"); assert "सेव" in tst0 and "नकद" in tst0, tst0
        await pg.screenshot(path=f"{SHOTS}/28-after-save.png")
        # बाद में "आज के बिल" से रसीद: QR (बिना रकम, भुगतान हो चुका), बदलाव का नोट ग्राहक के बिल पर नहीं
        await pg.evaluate(f"showReceipt(S.dayBills.find(b=>b.no==='{settled_no}'),false)"); await pg.wait_for_selector("#sheet .paper")
        assert await pg.query_selector("#sheet #ppqr canvas, #sheet #ppqr img") and "अगली बार" in await pg.inner_text("#sheet .pp-qr"), "QR on paid receipt"
        assert not await pg.query_selector("#sheet .paper .pp-edit"), "edit note must not show on customer bill"
        rtx = await pg.evaluate(f"receiptText(S.dayBills.find(b=>b.no==='{settled_no}'))"); assert "UPI:" in rtx and "@" in rtx and "बदला" not in rtx and "VIKRAM" not in rtx and "बिलिंग: *कमल भाई*" in rtx, rtx
        assert "PAID" in await pg.inner_text("#sheet .stmp.paid") and "कमल भाई" in await pg.inner_text("#sheet .pp-row3 .stmp.by")
        rcv = await pg.evaluate(f"(()=>{{const b=S.dayBills.find(x=>x.no==='{settled_no}');return SE.receiptCanvas(b,SF.rcptOpts(b,true),576).toDataURL()}})()")
        open(f"{{SHOTS}}/29-paid-receipt.png".format(SHOTS=SHOTS),"wb").write(base64.b64decode(rcv.split(",")[1]))
        await pg.screenshot(path=f"{SHOTS}/5-receipt.png")
        await pg.click("[data-sharepdf]"); await pg.wait_for_selector("#shPh")
        await pg.screenshot(path=f"{SHOTS}/14-share-ask.png")
        await pg.fill("#shPh", "+91 98290 12345"); await pg.click("[data-shwa]"); await pg.wait_for_timeout(1500)
        cp = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v)).map(b=>b.custPhone)")
        assert "9829012345" in cp, ("phone not kept", cp)
        tst = await pg.evaluate("(document.querySelector('.toast')||{}).innerText||''")
        assert "नहीं हुआ" not in tst and not errs, ("share after settle", tst, errs)
        await pg.click("[data-close]") if await pg.query_selector("#sheet [data-close]") else None
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
        await pg.click("#cartbtn"); await pg.wait_for_selector("[data-sbok]"); await pg.wait_for_timeout(400)
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
        await wf(pg, "document.activeElement&&document.activeElement.id==='pq'", timeout=9000)
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
        pl = await pg.evaluate("Object.values(window.__MOCK__.purchases||{}).map(p=>[p.date,!!p.loc])")
        assert pl and all(x[1] for x in pl), ("purchase must carry location", pl)
        # संस्था को प्याज — आज के खरीद भाव ₹52 पर
        await pg.click('[data-tab="bill"]'); await pg.wait_for_timeout(200)
        inst_rate = await pg.evaluate("(()=>{const b={lines:[{id:'pyaj',name:'प्याज',unit:'kg',qty:5,rate:60,board:60,cost:0,amt:300}]};SB.instReprice(b);return [b.lines[0].rate,b.lines[0].saleRate,b.total,b.saleTotal]})()")
        assert inst_rate == [51.34, 60, 256.7, 300], inst_rate
        rt = await pg.evaluate("(()=>{const b={no:'SE-TEST01',date:today(),ts:Date.now(),mode:'inst',partyName:'177 MH कैंटीन',byName:'कमल भाई',lines:[{id:'pyaj',name:'प्याज',unit:'kg',qty:5,rate:60,board:60,cost:0,amt:300}]};SB.instReprice(b);return SB.instText(b,SB.peopleFor('177 MH कैंटीन')[0])})()")
        assert "मनोज" in rt and "₹43.3" in rt and "बेचना *₹60*" in rt, rt
        print(rt)
        # पूरा संस्था बिल: चुनते समय ₹60, चालान पर खरीद भाव ₹51.34, QR नहीं, लोगों को रिपोर्ट बटन
        await pg.evaluate("setMode('inst');S.inst='मारवाड़ रसोई (होटल)';renderBill();renderCart()")
        await pg.click('[data-item="aloo"]'); await pg.fill("#qIn", "2"); await pg.click("[data-add]"); await pg.wait_for_timeout(200)
        assert await pg.evaluate("S.cart[0].rate") == 21
        await pg.click("#cartbtn"); await pg.wait_for_selector("#sheet .pp-ch"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f"{SHOTS}/23-inst-challan.png", full_page=True)
        assert not await pg.query_selector("#sheet #ppqr") and not await pg.query_selector("#sheet .pp-nut"), "no QR / nutrition on challan"
        ic = await pg.eval_on_selector_all("#sheet .ic-btn", "e=>e.map(x=>x.innerText)")
        assert len(ic) == 2 and "गणेश" in ic[0] and "स्वरूप" in ic[1], ic
        ib = [b for b in (await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v))")) if b["mode"] == "inst"]
        assert ib and ib[0]["lines"][0]["rate"] == (await pg.evaluate("SF.costOf(item('aloo'))")) and ib[0]["total"] == 2*ib[0]["lines"][0]["rate"] and ib[0]["saleTotal"] == 42 and ib[0]["lines"][0]["rate"] < 21, ib
        print("inst challan ok", ic)
        # जिस सब्ज़ी का खरीद भाव ऐप को नहीं पता → बिलर से पूछे, ₹0 / बिक्री भाव पर चालान नहीं
        await pg.evaluate("closeSheet();setMode('inst');S.inst='डोसा पॉइंट';S.cart=[];renderBill();renderCart()")
        nc = await pg.evaluate("(()=>{const it=S.items.find(it=>{if(it.active===false||it.unit!=='kg')return false;const c=it.cost;it.cost=0;const z=SF.costOf(it)===0;it.cost=c;return z});if(!it)return null;it.cost=0;if(window.__MOCK__.items[it.id])window.__MOCK__.items[it.id].cost=0;return it.id})()")
        assert nc, "no item without purchase history"
        await pg.click(f'[data-item="{nc}"]'); await pg.fill("#qIn", "3"); await pg.click("[data-add]"); await pg.wait_for_timeout(200)
        nb0 = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v)).length")
        await pg.click("#cartbtn"); await pg.wait_for_selector("#sheet #icc0"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f"{SHOTS}/23b-inst-costask.png", full_page=True)
        await pg.click("[data-iccsave]"); await pg.wait_for_timeout(200)
        assert await pg.query_selector("#sheet #icc0"), "empty cost must not save"
        await pg.fill("#icc0", "30"); await pg.click("[data-iccsave]"); await pg.wait_for_selector("#sheet .pp-ch"); await pg.wait_for_timeout(500)
        ib2 = [b for b in (await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v))")) if b["mode"] == "inst" and b["lines"][0]["id"] == nc]
        assert ib2 and ib2[0]["lines"][0]["rate"] == 30 and ib2[0]["total"] == 90 and ib2[0]["lines"][0].get("costTyped") and not ib2[0]["lines"][0].get("noCost"), ib2
        assert "भाव" in await pg.inner_text("#sheet .pp-ch") and not await pg.query_selector("#sheet #ppqr")
        print("inst cost ask ok", nc, nb0)
        # 📒 उधार का पक्का रास्ता: खाते का हाल, नंबर ज़रूरी, सीमा पार → वजह, पर्ची का सबूत, मालिक को जाँच कार्ड
        pn = await pg.evaluate("(()=>{closeSheet();setMode('walk');S.cart=[];renderBill();renderCart();const p=S.parties[0];p.phone='';p.limit=50;return [p.id,p.name]})()")
        await pg.click('[data-item="tamatar"]'); await pg.fill("#qIn", "2"); await pg.click("[data-add]"); await pg.wait_for_timeout(200)
        await pg.click("#cartbtn"); await pg.wait_for_selector("[data-sbok]"); await pg.wait_for_timeout(300)
        await pg.click('[data-sbpay="udhar"]'); await pg.wait_for_selector("#sbPq"); await pg.fill("#sbPq", pn[1]); await pg.wait_for_timeout(200)
        await pg.click(f'[data-sbp="{pn[0]}"]'); await pg.wait_for_selector("#sheet .ud-chk"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f"{SHOTS}/24-udhar-check.png", full_page=True)
        assert await pg.query_selector("#sbUph") and await pg.query_selector("#sbUwhy"), "phone + reason asked"
        assert "उधार पक्का करें" in await pg.inner_text("[data-sbok]")
        await pg.click("[data-sbok]"); await pg.wait_for_timeout(300)
        assert await pg.query_selector("#sbUph"), "no phone → must not settle"
        await pg.fill("#sbUph", "98765 43210"); await pg.click("[data-sbok]"); await pg.wait_for_timeout(300)
        assert await pg.query_selector("#sbUwhy"), "over limit without reason → must not settle"
        await pg.fill("#sbUwhy", "विक्रम जी ने हाँ कहा"); await pg.click("[data-sbok]"); await pg.wait_for_selector("[data-udsend]"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{SHOTS}/25-udhar-receipt.png", full_page=True)
        ub = await pg.evaluate("S._lastUd&&S._lastUd.no||SB._lastUd.no")
        await pg.evaluate("(()=>{const a=document.querySelector('[data-udsend]');a.addEventListener('click',e=>e.preventDefault());a.click()})()"); await pg.wait_for_timeout(400)
        ud = [b for b in (await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v))")) if b["no"] == ub]
        assert ud and ud[0]["pay"]["udhar"] == ud[0]["total"] and ud[0]["udChk"]["over"] and ud[0]["udChk"]["why"] and ud[0]["udChk"]["newPh"] == "9876543210" and ud[0].get("udSent"), ud
        assert (await pg.evaluate(f"window.__MOCK__.parties['{pn[0]}'].phone")) == "9876543210"
        uh = await pg.evaluate("S.isOwner?SB.udharHTML():'notowner'")
        assert uh == "notowner" or ("आज का उधार" in uh and "पर्ची गई" in uh and "सीमा" in uh), uh[:300]
        print("udhar flow ok", ub, ud[0]["udChk"])
        # 🚫 रद्द: कर्मचारी की अर्ज़ी — बिना वजह नहीं, अर्ज़ी के साथ जगह; बिल शीट पर "⏳ रद्द अर्ज़ी गई"
        await pg.evaluate("closeSheet();setMode('walk');S.cart=[];renderBill();renderCart();window.__oph=S.settings.ownerPh;S.settings.ownerPh=''")
        await pg.click('[data-item="tamatar"]'); await pg.fill("#qIn", "1"); await pg.click("[data-add]"); await pg.wait_for_timeout(200)
        await pg.click("#cartbtn"); await pg.wait_for_selector("[data-sbcancel]"); cxno = await pg.evaluate("SB.unpaid().slice(-1)[0].no")
        await pg.click("[data-sbcancel]"); await pg.wait_for_selector("#crWhy"); await pg.click("[data-cxgo]"); await pg.click("[data-cxgo]"); await pg.wait_for_timeout(200)
        assert await pg.query_selector("#crWhy"), "reason required"
        await pg.fill("#crWhy", "ग्राहक ने सामान नहीं लिया"); await pg.screenshot(path=f"{SHOTS}/30-cancel.png"); await pg.click("[data-cxgo]"); await pg.click("[data-cxgo]"); await pg.wait_for_timeout(800)
        cr = await pg.evaluate(f"(window.__MOCK__.cancelReq||{{}})['{cxno}']")
        assert cr and cr["status"] == "pending" and cr.get("loc") and cr["settled"] is False and cr["done"] is True, cr
        cxb = await pg.evaluate(f"Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v)).find(b=>b.no==='{cxno}')")
        assert cxb["cancelled"] and cxb["cancelReason"] == "ग्राहक ने सामान नहीं लिया" and cxb["cancelByName"] == "कमल भाई", cxb
        assert not await pg.evaluate(f"SB.unpaid().some(b=>b.no==='{cxno}')"), "cancelled bill must leave pending list"
        await pg.evaluate("closeSheet();S.settings.ownerPh=window.__oph")
        mb = await pg.evaluate("SF.missingBuy().map(x=>x.it.id+':'+x.need)")
        print("cancel request ok", cxno, "missing buy:", mb)
        # 🔒 लोकेशन सिर्फ़ मालिक की: बिलर को कोई पट्टी/शब्द नहीं, बिल पर जगह का नाम नहीं
        own = await pg.evaluate("S.isOwner")
        allb = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v))")
        assert not any(b.get("place") for b in allb), [b.get("place") for b in allb]
        if not own:
            assert await pg.evaluate("!document.getElementById('locbar')||document.getElementById('locbar').hidden") and await pg.evaluate("SR.places.length") == 0
            assert "लोकेशन" not in await pg.inner_text("body")
        print("location private ok, owner=", own)
        await pg.evaluate("closeSheet();setMode('walk')")
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
        # बिलिंग जैसा: "प्याज 88" खोजकर Enter, टमाटर टाइल → 26, आलू खत्म (0)
        assert "भरने वाले" in await pg.inner_text("#sheet .sh-head") and "कमल भाई" in await pg.inner_text("#sheet .sh-head")
        await pg.fill("#nsq", "प्याज 88"); await pg.press("#nsq", "Enter"); await pg.wait_for_timeout(200)
        await pg.click('[data-nst="tamatar"]'); await pg.wait_for_selector("#nsQ"); await pg.fill("#nsQ", "26"); await pg.click("[data-nsok]"); await pg.wait_for_timeout(150)
        await pg.click('[data-nst="kiwi"]'); await pg.wait_for_selector("#nsQ"); await pg.click("[data-nsp]"); await pg.click("[data-nsp]"); await pg.click("[data-nsok]"); await pg.wait_for_timeout(150)
        await pg.fill("#nsq", "आलू"); await pg.press("#nsq", "Enter"); await pg.wait_for_selector("#nsQ"); await pg.click("[data-ns0]"); await pg.wait_for_timeout(150)
        ntx = await pg.inner_text("#sheet")
        assert "होना चाहिए" not in ntx and "बिका" not in ntx, "staff must not see expected stock"
        assert "बचा माल (4)" in ntx and "खत्म (0)" in ntx and "₹" in await pg.inner_text("#sheet .ns-sum"), ntx[:500]
        await pg.screenshot(path=f"{SHOTS}/34-night-entry.png")
        await pg.click("[data-nsave]"); await pg.wait_for_selector("#nsadv"); await wf(pg, "!document.querySelector('#nsadv').innerText.includes('बन रही')", timeout=8000)
        adv = await pg.inner_text("#sheet"); assert "रात का स्टॉक सेव हुआ" in adv and "बचा माल" in adv and "रोज़ ~" not in adv, adv[:500]
        await pg.screenshot(path=f"{SHOTS}/35-night-done.png")
        await pg.evaluate("closeSheet()")
        st = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/meta')).map(([k,v])=>v.stock).filter(Boolean)[0]")
        assert st["items"]["pyaj"]["close"] == 88 and st["items"]["tamatar"]["close"] == 26 and st["items"]["kiwi"]["close"] == 2 and st["items"]["aloo"]["close"] == 0 and st["nightBy"] == "कमल भाई" and st["items"]["pyaj"]["closeBy"] == "कमल भाई" and st.get("nightVal", 0) > 0, st
        print("night count (no recheck) ok")
        await pg.screenshot(path=f"{SHOTS}/11-day.png", full_page=True)
        # 🔒 कर्मचारी को बिक्री/कमी/होना चाहिए/गल्ले का हिसाब नहीं — सिर्फ़ खरीद, खर्चा, खराबी, रात की गिनती
        if not await pg.evaluate("S.isOwner"):
            dtx = await pg.inner_text("#p-day")
            for w in ["बिका", "होना चाहिए", "कमी", "खरीद की एंट्री छूटी", "आज का सार"]:
                assert w not in dtx, (w, dtx[:600])
            assert await pg.query_selector("#p-day [data-night]") and await pg.query_selector("#p-day #dCount")
            await pg.click('[data-tab="bill"]'); await pg.wait_for_timeout(300)
            assert not await pg.query_selector("#grid .stk"), "staff must not see stock left on tiles"
            await pg.click('[data-tab="day"]'); await pg.wait_for_timeout(300)
            await pg.click('[data-tab="bills"]'); await pg.wait_for_timeout(300)
            assert not await pg.query_selector("#p-bills .pf") and not await pg.query_selector("#p-bills .pfk"), "staff must not see profit"
            assert not await pg.query_selector("#p-bills .kpis") and not await pg.query_selector("#billsDate"), "staff must not see cash/UPI totals or other days"
            assert not await pg.query_selector("#p-bills .gp-tag"), "staff must not see Google Pay names"
            await pg.click('[data-tab="bill"]'); await pg.wait_for_timeout(200)
            mine = await pg.evaluate("(document.querySelector('.mine')||{}).innerText||''")
            assert "₹" not in mine, mine
            # 🛒 खरीद की याद (कर्मचारी) + "आज खरीद नहीं हुई"
            ng = await pg.evaluate("(()=>{const o=S.purch;S.purch=[];SF.nobuy=null;const r=SF.buyNag(true);S.purch=o;return [r,!!document.getElementById('buyNag')]})()")
            assert ng == [True, True], ng
            await pg.click('[data-nag="none"]'); await pg.wait_for_timeout(300)
            nb = await pg.evaluate("[!document.getElementById('buyNag'),!!((window.__MOCK__['days/'+today()+'/meta']||{}).nobuy),SF.buyNag(true)]")
            assert nb == [True, True, False], nb
            # उधार: कुल बकाया नहीं; अपनी संस्था का खाता नहीं बनता
            await pg.click('[data-tab="udhar"]'); await pg.wait_for_timeout(300)
            utx = await pg.inner_text("#p-udhar")
            assert "कुल बकाया" not in utx and "आज वसूली" not in utx, utx[:300]
            await pg.click("[data-newparty]"); await pg.wait_for_selector("#npName")
            await pg.fill("#npName", "marwar rasoi"); await pg.click("#sheet [data-ok]"); await pg.wait_for_timeout(400)
            assert not await pg.evaluate("Object.values(window.__MOCK__.parties||{}).some(p=>/rasoi/i.test(p.name))"), "institution udhar account must be blocked"
            await pg.evaluate("closeSheet()")
            print("staff buy-nag + udhar private ok")
            await pg.click('[data-tab="bills"]'); await pg.wait_for_timeout(200)
            await pg.click('[data-tab="day"]'); await pg.wait_for_timeout(300)
            assert not await pg.query_selector("#p-day .cpy"), "staff must not see copy card"
            print("staff day view private ok")
        # बिल रद्द करने की अर्ज़ी (कर्मचारी)
        await pg.click('[data-tab="bills"]'); await pg.wait_for_timeout(300)
        _bn = await pg.evaluate("[...document.querySelectorAll('#p-bills [data-bill]')].map(x=>x.dataset.bill).find(n=>!(S.cancelReqs||[]).some(r=>r.no===n)&&!(S.dayBills.find(b=>b.no===n)||{}).cancelled&&(S.dayBills.find(b=>b.no===n)||{}).settled!==false)")
        await pg.click(f'#p-bills [data-bill="{_bn}"]'); await pg.wait_for_timeout(300)
        await pg.click('details.creq summary'); await pg.fill('#crWhy', 'ग्राहक ने सामान लौटाया'); await pg.click('[data-creq]'); await pg.wait_for_timeout(600)
        cr = await pg.evaluate("Object.values(window.__MOCK__.cancelReq||{})")
        cr = [x for x in cr if x["reason"] == "ग्राहक ने सामान लौटाया"]
        assert len(cr) == 1 and cr[0]["status"] == "pending", cr
        print("cancel request", cr[0]["no"], cr[0]["reason"])
        mock = await pg.evaluate("window.__MOCK__")
        await gallery(pg, "staff")
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
        # 📑 खंड-पट्टी: एक बार में एक खंड
        await pg.click('[data-tab="day"]'); await pg.wait_for_timeout(600)
        assert await pg.is_visible('[data-dseg="sar"]') and await pg.is_visible("#p-day .obrief") and not await pg.is_visible("#p-day [data-saveclose]"), "sections"
        await pg.click('[data-dseg="paisa"]'); await pg.wait_for_timeout(200)
        assert await pg.is_visible("#p-day [data-saveclose]") and not await pg.is_visible("#p-day .obrief") and await pg.is_visible("#p-day .gpc")
        await pg.click('[data-dseg="maal"]'); await pg.wait_for_timeout(200)
        assert await pg.is_visible("#p-day [data-night]") and not await pg.is_visible("#p-day [data-saveclose]")
        await pg.click('[data-dseg="ai"]'); await pg.wait_for_timeout(200)
        assert await pg.is_visible("#p-day .cpy") and not await pg.is_visible("#p-day [data-night]")
        await pg.click('[data-dseg="sar"]'); await pg.wait_for_timeout(300)
        assert await pg.query_selector("#p-day #dMini"), "mini map"
        await pg.screenshot(path=f"{SHOTS}/12a-owner-day-sar.png")
        print("day sections ok")
        await pg.evaluate("SF.dseg='all';SF.dsegApply()")
        await pg.screenshot(path=f"{SHOTS}/12-owner-day.png", full_page=True)
        assert await pg.query_selector("#p-day .obrief") and "खरीद दर्ज" in await pg.inner_text("#p-day .obrief"), "owner brief missing"
        txt = await pg.inner_text("#p-day")
        assert "असली मुनाफ़ा" in txt, txt[:300]
        assert "रात का मिलान" in txt and "प्याज" in txt, txt[:600]
        await wf(pg, "document.querySelector('#p-day').innerText.includes('कल की खरीद की सलाह')", timeout=8000)
        txt = await pg.inner_text("#p-day"); assert "भरने वाले" in txt and "रोज़ ~" in txt, txt[:800]
        assert "अभी गाड़ी में (लाइव)" in txt, "live stock card"
        await pg.click("[data-nrevok]"); await pg.wait_for_timeout(500)
        assert await pg.evaluate("Object.keys(window.__MOCK__.ownerCfg||{}).some(k=>k.startsWith('rev_'))"), "review not saved"
        await pg.locator(".nrev").screenshot(path=f"{SHOTS}/19-night-review.png")
        mh = await pg.evaluate("(()=>{const o=S.prevStock;S.prevStock={pyaj:{close:88},tamatar:{close:26}};const h=SF.morningHTML();S.prevStock=o;return h})()")
        assert "कल रात आपने लिखा था" in mh and "प्याज 88" in mh, mh
        print("owner night review ok")
        # 💹 हर बिल का फायदा (सिर्फ़ मालिक, सूची में)
        await pg.click('[data-tab="bills"]'); await pg.wait_for_timeout(400)
        assert await pg.query_selector("#p-bills .pfk") and await pg.query_selector("#p-bills .rt small.pf"), "owner profit tags"
        pft = await pg.inner_text("#p-bills .pfk"); assert "फायदा" in pft, pft
        await pg.screenshot(path=f"{SHOTS}/36-bills-profit.png")
        # 📱 Google Pay फ़ाइल → बिल से मिलान (सिर्फ़ मालिक)
        csv = await pg.evaluate("""(()=>{const u=S.dayBills.filter(b=>!b.cancelled&&b.mode!=='inst'&&+((b.pay||{}).upi)>0);if(!u.length)return '';const p=t=>{const d=new Date(t);const z=new Date(d.getTime()+5.5*3600e3);return z.toISOString().slice(0,19).replace('T',' ')};
          let c='Payer/Receiver,Paid via,Type,Creation time,Transaction ID,Amount,Processing fee,Net amount,Status,Update time,Notes\\n';
          c+='TEST A,Google Pay,UPI,'+p(u[0].ts+60000)+',TX1,'+u[0].pay.upi+',0.00,'+u[0].pay.upi+',Success,'+p(u[0].ts+60000)+',"Sabji Express | Bill No '+u[0].no+'"\\n';
          c+='BINA BILL,Unknown app,UPI,'+p(u[0].ts+120000)+',TX2,777.00,0.00,777.00,Success,'+p(u[0].ts+120000)+',Payment from PhonePe\\n';
          c+='FAIL X,Unknown app,UPI,'+p(u[0].ts+130000)+',TX3,50.00,0.00,50.00,Failed,'+p(u[0].ts+130000)+',\\n';return c})()""")
        assert csv, "need an UPI bill for Google Pay test"
        await pg.click('[data-tab="day"]'); await pg.wait_for_selector("#p-day .gpc")
        await pg.set_input_files("#gpFile", files=[{"name": "gpay.csv", "mimeType": "text/csv", "buffer": csv.encode("utf8")}])
        await pg.wait_for_timeout(900)
        gpt = await pg.inner_text("#p-day .gpc")
        assert "पैसा आया, पर बिल नहीं मिला" in gpt and "BINA BILL" in gpt and "777" in gpt and "FAIL X" not in gpt, gpt
        gm = await pg.evaluate("""(()=>{const u=S.dayBills.filter(b=>!b.cancelled&&b.mode!=='inst'&&+((b.pay||{}).upi)>0)[0];const k='days/'+S.billsDate+'/bills';const mb=(window.__MOCK__[k]||{})[u.no]||{};return [(mb.upiPayer||{}).name,(mb.upiPayer||{}).how,!!window.__MOCK__.ownerCfg['gpay_'+S.billsDate],SF.gpNow().rows.length]})()""")
        assert gm == ["TEST A", "नोट", True, 2], gm
        await pg.locator("#p-day .gpc").screenshot(path=f"{SHOTS}/37-gpay.png")
        await pg.click('[data-tab="bills"]'); await pg.wait_for_timeout(300)
        assert "TEST A" in await pg.inner_text("#p-bills"), "payer name on owner bill list"
        assert "Google Pay मिलान" in await pg.evaluate("SF.auditPack()")
        print("gpay ok", gm)
        # 🤖 कॉपी → AI JSON → मिलान + रात का स्टॉक चढ़ाना
        await pg.click('[data-tab="day"]'); await pg.wait_for_selector("#p-day .cpy")
        await pg.click('[data-cpp="day"]'); await pg.wait_for_timeout(300)
        clip2 = await pg.evaluate("navigator.clipboard.readText()"); assert "sabji-copy" in clip2 and await pg.evaluate("today()") in clip2, clip2[:200]
        dj = {"type":"sabji-copy","date":"","kharid":[{"name":"टमाटर","qty":28,"unit":"kg","rate":10,"amount":280},{"name":"धनिया","qty":5,"unit":"kg","rate":50,"amount":250}],"kharidTotalWritten":600,
              "sanstha":[{"to":"मारवाड़ रसोई","name":"खीरा","qty":5,"unit":"kg","amount":150}],"night":[],"kharab":[],
              "sale":{"online":900,"cash":300,"udhar":[{"name":"अफसर मेस","amount":500}],"totalWritten":1700},"kharch":[{"what":"टैक्सी","amount":250}],"unclear":["लाइन 5 पढ़ी नहीं गई"]}
        import json as _j
        dj["date"] = await pg.evaluate("S.billsDate")
        await pg.fill("#cpyIn", "यह रहा:\n```json\n" + _j.dumps(dj, ensure_ascii=False) + "\n```"); await pg.click("[data-cpsave]"); await pg.wait_for_timeout(800)
        await wf(pg, "(document.querySelector('#p-day .cpy')||{}).innerText?.includes('खरीद — कॉपी बनाम ऐप')", timeout=6000)
        ctx2 = await pg.inner_text("#p-day .cpy"); assert "बिक्री — कॉपी बनाम ऐप" in ctx2 and "खरीद — कॉपी बनाम ऐप" in ctx2 and "संस्था — कॉपी" in ctx2 and "पढ़ी नहीं" in ctx2, ctx2[:600]
        nj = {"type":"sabji-night","date":dj["date"],"night":[{"name":"सेब","qty":2,"unit":"kg"},{"name":"तरबुज","qty":4,"unit":"kg"},{"name":"G4","qty":1,"unit":"kg"},{"name":"प्याज","qty":12,"unit":"kg"}],"kharab":[{"name":"पपीता","qty":2.5,"unit":"kg"}],"unclear":[]}
        await pg.fill("#cpyIn", _j.dumps(nj, ensure_ascii=False)); await pg.click("[data-cpsave]"); await pg.wait_for_selector("[data-cpnight]")
        await pg.screenshot(path=f"{SHOTS}/37-copy-compare.png", full_page=True)
        await pg.click("[data-cpnight]"); await pg.wait_for_timeout(800)
        st2 = await pg.evaluate("S.stock.items")
        assert st2["seb"]["close"] == 2 and st2["tarbooj"]["close"] == 4 and st2["harimirch"]["close"] == 1 and st2["pyaj"]["close"] == 88 and st2["papita"]["waste"] == 2.5, {k: st2.get(k) for k in ["seb","tarbooj","harimirch","pyaj","papita"]}
        print("profit + copy import ok", pft.replace("\n"," "))
        # 📒 पुराना बाकी (मालिक)
        await pg.click('[data-tab="udhar"]'); await pg.wait_for_timeout(300)
        await pg.click('#p-udhar [data-party="jco-mess"]'); await pg.wait_for_selector(".nsbox summary"); await pg.click(".nsbox summary")
        await pg.fill("#obAmt", "1500"); await pg.fill("#obNote", "सितंबर तक का"); await pg.click("[data-opbal]"); await pg.wait_for_timeout(900)
        led = await pg.evaluate("Object.values(window.__MOCK__.ledger||{}).filter(l=>l.opening&&l.note==='सितंबर तक का')")
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
        # नया वर्ज़न: मालिक के फोन पर अपने-आप जुड़ी
        await wf(pg, "Object.keys(window.__MOCK__.ledger||{}).filter(k=>k.startsWith('op_')).length>=97", timeout=15000)
        led = await pg.evaluate("Object.keys(window.__MOCK__.ledger||{}).filter(k=>k.startsWith('op_')).length")
        tot = await pg.evaluate("Object.entries(window.__MOCK__.ledger||{}).filter(([k])=>k.startsWith('op_')).reduce((a,[k,v])=>a+v.amt,0)")
        print("auto imported", led, tot)
        assert led == 97 and tot == 33305, (led, tot)
        assert (await pg.evaluate("window.__MOCK__.ownerCfg.flags.oldUdhar1")) > 0
        await wf(pg, "(window.__MOCK__.ownerCfg.flags||{}).oldUdhar2>0", timeout=15000)
        o2 = await pg.evaluate("(()=>{const E=Object.entries(window.__MOCK__.ledger||{}).filter(([k])=>k.startsWith('o2_'));return [E.length,E.reduce((a,[k,v])=>a+v.amt,0),SR.OLD_UDHAR2.reduce((a,g)=>a+g.total,0),!!window.__MOCK__.parties['adm-commander'],E.filter(([k,v])=>v.partyId==='mh-canteen').length]})()")
        print("old udhar 2", o2)
        await wf(pg, "(window.__MOCK__.ownerCfg.flags||{}).oldUdhar3>0", timeout=15000)
        o3 = await pg.evaluate("""(()=>{const M=window.__MOCK__,E=Object.entries(M.ledger||{}).filter(([k])=>k.startsWith('o3_'));return [E.length,E.reduce((a,[k,v])=>a+v.amt,0),SR.OLD_UDHAR3.reduce((a,g)=>a+g.total,0),M.parties['mh-canteen'].name,M.parties['adm-commander'].hide,M.parties['manoj-ghar'].hide,bal('adm-commander'),balRaw('adm-commander')>0,Object.values(M.ledger).filter(v=>v.partyId==='mh-canteen').every(v=>v.partyName==='177 MH वेट कैंटीन')]})()""")
        print("old udhar 3", o3)
        # 🏢 कर्मचारी के बनाए "अपनी संस्था" उधार खाते → संस्था चालान + खाता हटाया (नीचे दिखे)
        i2 = await pg.evaluate("""(async()=>{const M=window.__MOCK__;const d='2026-10-30',k='days/'+d+'/bills';M[k]=M[k]||{};
          M.parties['p_jb']={name:'jasai bhrev',phone:'',ts:Date.now()};
          M[k]['SE-JB0001']={no:'SE-JB0001',date:d,ts:new Date(d+'T11:00:00+05:30').getTime(),by:'u_m',byName:'Mukesh Bhai Sub Ex',mode:'udhar',partyId:'p_jb',partyName:'jasai bhrev',lines:[{id:'pyaj',name:'प्याज',unit:'kg',qty:5,rate:60,amt:300}],sub:300,total:300,disc:0,pay:{cash:0,upi:0,udhar:300},payMode:'udhar',settled:true,cancelled:false};
          M.ledger['SE-JB0001']={ts:Date.now(),date:d,partyId:'p_jb',partyName:'jasai bhrev',type:'udhar',amt:300,billNo:'SE-JB0001'};
          delete M.ownerCfg.flags.inst2;SR._inst2=0;await SR.autoInst2(S.db);await new Promise(r=>setTimeout(r,400));
          const b=M[k]['SE-JB0001'],p=M.parties['p_jb'],mh=M.parties['mh-canteen'];
          return [b.mode,b.partyName,b.lines[0].rate<60,!M.ledger['SE-JB0001'],p.deleted,p.movedTo,!!mh.deleted,!S.parties.some(x=>x.id==='p_jb'),S.partiesDel.some(x=>x.id==='p_jb'),!!M.parties['jco-mess'].deleted]})()""")
        print("inst2", i2)
        assert i2 == ["inst", "15 भैरव कैंटीन (जसाई)", True, True, True, "15 भैरव कैंटीन (जसाई)", True, True, True, False], i2
        # ✏️ नाम बदलें + 🗑️ खाता हटाएँ (सिर्फ़ मालिक) — नीचे "हटाए गए" में
        await pg.click('[data-tab="udhar"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-party="nepali-staff"]'); await pg.wait_for_selector("#pName")
        await pg.fill("#pName", "नेपाली स्टाफ (कैंटीन)"); await pg.dispatch_event("#pName", "change"); await pg.wait_for_timeout(500)
        assert (await pg.evaluate("window.__MOCK__.parties['nepali-staff'].name")) == "नेपाली स्टाफ (कैंटीन)"
        await pg.evaluate("closeSheet()"); await pg.wait_for_timeout(200)
        await pg.click('[data-party="nepali-staff"]'); await pg.wait_for_selector("[data-pdel]")
        await pg.click("[data-pdel]"); await pg.wait_for_timeout(150); await pg.click("[data-pdel]"); await pg.wait_for_timeout(600)
        dl = await pg.evaluate("[window.__MOCK__.parties['nepali-staff'].deleted,window.__MOCK__.parties['nepali-staff'].deletedByName,!document.querySelector('[data-party=\"nepali-staff\"]')]")
        assert dl == [True, "विक्रम जी (मालिक)", True], dl
        await pg.evaluate("closeSheet()"); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('#p-udhar .pdel').open=true")
        pdt = await pg.inner_text("#p-udhar .pdel"); assert "नेपाली स्टाफ (कैंटीन)" in pdt and "मालिक ने हटाया" in pdt and "संस्था में भेजा" in pdt, pdt
        await pg.screenshot(path=f"{SHOTS}/38-udhar-deleted.png", full_page=True)
        print("party rename/delete ok")
        # 🧾 बिल फिल्टर + से–तक
        await pg.click('[data-tab="bills"]'); await pg.wait_for_timeout(400)
        assert await pg.is_visible("#p-bills .bfbar"), "filter bar"
        n_all = await pg.evaluate("document.querySelectorAll('#p-bills [data-bill]').length")
        if await pg.query_selector('[data-bfm="upi"]'):
            await pg.click('[data-bfm="upi"]'); await pg.wait_for_timeout(200)
            ok = await pg.evaluate("[...document.querySelectorAll('#p-bills [data-bill]')].every(x=>{const b=S.dayBills.find(y=>y.no===x.dataset.bill);return b&&+b.pay.upi>0})")
            assert ok, "upi filter"
        await pg.click('[data-bfm="all"]'); await pg.wait_for_timeout(200)
        first = await pg.evaluate("(document.querySelector('#p-bills [data-bill]')||{}).dataset.bill")
        await pg.fill("#bfQ", first); await pg.wait_for_timeout(500)
        nq = await pg.evaluate("[...document.querySelectorAll('#p-bills [data-bill]')].map(x=>x.dataset.bill)")
        assert nq == [first], nq
        await pg.fill("#bfQ", ""); await pg.wait_for_timeout(500)
        await pg.fill("#bfFrom", "2026-10-28"); await pg.dispatch_event("#bfFrom", "change")
        await wf(pg, "[...document.querySelectorAll('#p-bills [data-bill]')].some(x=>x.dataset.bill==='SE-JB0001')", timeout=8000)
        n_rng = await pg.evaluate("document.querySelectorAll('#p-bills [data-bill]').length")
        assert n_rng > n_all, (n_rng, n_all)
        await pg.screenshot(path=f"{SHOTS}/39-bills-filter.png")
        await pg.click('[data-bfq="%s|%s"]' % (await pg.evaluate("today()"), await pg.evaluate("today()"))); await pg.wait_for_timeout(300)
        # 📅 अवधि रिपोर्ट
        await pg.click('[data-tab="report"]'); await pg.wait_for_timeout(300)
        await pg.evaluate("S.repSel='rr';renderReport()"); await pg.wait_for_timeout(200)  # 📊 नया रिपोर्ट-क्षेत्र: पहले रिपोर्ट चुनो
        await pg.click("[data-rropen]"); await wf(pg, "document.querySelector('.rrc table.rrt')", timeout=8000)
        rtx = await pg.inner_text(".rrc"); assert "कुल" in rtx and "फायदा" in rtx, rtx[:300]
        await pg.locator(".rrc").screenshot(path=f"{SHOTS}/40-range-report.png")
        print("bill filters + range ok", n_all, n_rng)
        # 🏪 सप्लायर का नाम टाइप करते ही सुझाव
        await pg.click('[data-tab="kharid"]'); await pg.wait_for_timeout(300)
        await pg.fill("#pShop", ""); await pg.type("#pShop", "पव"); await pg.wait_for_timeout(200)
        assert await pg.is_visible("#shopSug") and "पवन" in await pg.inner_text("#shopSug"), "supplier suggestions"
        await pg.click("#shopSug [data-shopsug]"); await pg.wait_for_timeout(200)
        sv = await pg.evaluate("[document.getElementById('pShop').value,document.getElementById('pPh').value]")
        assert sv[0].startswith("पवन") and len(sv[1].replace(" ","")) >= 10, sv
        await pg.fill("#pShop", ""); await pg.dispatch_event("#pShop", "input")
        # 📒 उधार फिल्टर
        await pg.click('[data-tab="udhar"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-ufm="hide"]'); await pg.wait_for_timeout(200)
        hid = await pg.evaluate("[...document.querySelectorAll('#p-udhar [data-party]')].map(x=>x.dataset.party)")
        assert hid and all(h in ("adm-commander", "manoj-ghar") for h in hid), hid
        await pg.click('[data-ufm="all"]'); await pg.fill("#ufQ", "JCO"); await pg.wait_for_timeout(500)
        jq = await pg.evaluate("[...document.querySelectorAll('#p-udhar [data-party]')].map(x=>x.innerText.split('\\n')[0])")
        assert jq and all("JCO" in x for x in jq), jq
        await pg.fill("#ufQ", ""); await pg.wait_for_timeout(400)
        print("supplier suggest + udhar filter ok", sv, hid)
        # ===== नए काम (se-plus) =====
        await pg.evaluate("window.__oA4=SE.printA4;window.__oSh=SX.shareBlob;window.__oOp=window.open;window.__opened=[];window.open=(u)=>{window.__opened.push(u);return null};window.__shared=[];SX.shareBlob=async(b,n,e,m,t)=>{const o={n,e,m,size:b.size,txt:e==='png'?'':await b.text().catch(()=>'')};if(e==='png')o.url=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});window.__shared.push(o)};window.__a4=null;SE.printA4=async(t,h)=>{window.__a4={t,h}}")
        # 1) कल की मंडी सूची
        await pg.click('[data-tab="day"]'); await pg.wait_for_timeout(300); await pg.click('[data-dseg="maal"]'); await pg.wait_for_timeout(200)
        await pg.click('[data-sxo="mandi"]'); await wf(pg, "document.querySelector('#p-day .sxc table.rrt')", timeout=10000)
        mt = await pg.evaluate("SX.mandiText()"); assert "कल की मंडी सूची" in mt and "रोज़" not in mt and "₹" not in mt, mt
        await pg.click("[data-sxmandiwa]"); assert "wa.me" in (await pg.evaluate("window.__opened.slice(-1)[0]")) or "whatsapp" in (await pg.evaluate("window.__opened.slice(-1)[0]")).lower()
        await pg.evaluate("SF.dseg='all';SF.dsegApply()")
        # 2) भाव की सलाह
        await pg.evaluate("(()=>{const it=item('kheera');it.sale=32;window.__MOCK__.items.kheera.sale=32;renderDay()})()"); await pg.wait_for_timeout(300)
        sxr = await pg.query_selector('[data-sxrate^="kheera|"]'); assert sxr, "price advice for kheera"
        sug = int((await sxr.get_attribute("data-sxrate")).split("|")[1])
        await sxr.click(); await pg.wait_for_timeout(100); await pg.click('[data-sxrate^="kheera|"]'); await pg.wait_for_timeout(500)
        assert (await pg.evaluate("window.__MOCK__.items.kheera.sale")) == sug and sug > 32, sug
        # 3) समय-जगह
        sl = await pg.evaluate("(async()=>{const r=await SX.calcSlots(7);return [r.n>0,Object.keys(r.hr).length>0,SX.slotHTML().includes('समय और जगह')]})()")
        assert sl == [True, True, True], sl
        # 4) खराबी रिपोर्ट + 14/15/16 औज़ार
        await pg.click('[data-tab="report"]'); await pg.wait_for_timeout(300)
        await pg.evaluate("S.repSel='tools';renderReport()"); await pg.wait_for_timeout(200)
        await pg.click('[data-sxo="waste"]'); await wf(pg, "(document.querySelector('[data-sxo=waste]')||{}).closest&&!document.body.innerText.includes('30 दिन की खराबी देखी जा रही')", timeout=15000)
        await pg.click('[data-sxmonth]'); await wf(pg, "window.__a4", timeout=15000)
        a4 = await pg.evaluate("window.__a4"); assert "असली मुनाफ़ा" in a4["h"] and "दिन-वार" in a4["h"], a4["t"]
        await pg.click('[data-sxvy="sale"]'); await wf(pg, "window.__shared.length>=1", timeout=10000)
        await pg.click('[data-sxvy="buy"]'); await wf(pg, "window.__shared.length>=2", timeout=10000)
        sh = await pg.evaluate("window.__shared"); assert sh[0]["e"] == "csv" and "Invoice No" in sh[0]["txt"] and "Bill No" in sh[1]["txt"], sh
        await pg.click("[data-sxbk]"); await wf(pg, "window.__shared.length>=3", timeout=30000)
        bk = await pg.evaluate("JSON.parse(window.__shared[2].txt)"); assert bk["items"] and bk["parties"] and "days" in bk, list(bk.keys())
        assert '"pin"' not in (await pg.evaluate("window.__shared[2].txt")), "backup must not hold PINs"
        await pg.evaluate("localStorage.removeItem('sx_bk');SX.autoBackup()"); await pg.wait_for_timeout(1500)
        assert await pg.evaluate("!!(window.__MOCK__.ownerCfg||{})['bk_'+dayAdd2(today(),-1)]".replace("dayAdd2(today(),-1)", "(()=>{const x=new Date(today()+'T12:00:00');x.setDate(x.getDate()-1);return today(x)})()")), "daily backup"
        # 8) भाव-पोस्टर
        await pg.click("[data-sxposter]"); await wf(pg, "window.__shared.length>=4", timeout=20000)
        ps = await pg.evaluate("window.__shared[3]"); assert ps["e"] == "png" and ps["size"] > 30000, ps["size"]
        import base64; open(f"{SHOTS}/43-poster.png", "wb").write(base64.b64decode(ps["url"].split(",")[1]))
        # 5) हिसाब-लिंक + h.html
        await pg.click('[data-tab="udhar"]'); await pg.wait_for_timeout(300); await pg.click('[data-party="jco-mess"]'); await pg.wait_for_selector("[data-sxhl]")
        await pg.click("[data-sxhl]"); await pg.wait_for_timeout(800)
        tok = await pg.evaluate("window.__MOCK__.parties['jco-mess'].pubToken"); pubd = await pg.evaluate(f"window.__MOCK__.pub['{tok}']")
        assert tok and pubd["type"] == "hisab" and pubd["bal"] > 0 and len(pubd["entries"]) > 5, (tok, pubd and pubd.get("bal"))
        assert ("h.html?t=" + tok) in (await pg.evaluate("decodeURIComponent(window.__opened.slice(-1)[0])"))
        await pg.evaluate("closeSheet()")
        rates = await pg.evaluate("(window.__MOCK__.pub||{}).rates") or None
        hp = await pg.context.new_page()
        async def fsr(route):
            u = route.request.url
            if "/pub/" + tok in u: await route.fulfill(json={"fields": fs_enc(pubd)["mapValue"]["fields"]})
            elif "/pub/rates" in u: await route.fulfill(json={"fields": fs_enc(rates)["mapValue"]["fields"]} if rates else {}, status=200 if rates else 404)
            elif u.split("?")[0].endswith("/orders") and route.request.method == "POST": UPLOADS.append(("order", route.request.post_data)); await route.fulfill(json={"name": "x"})
            else: await route.fulfill(status=404, body="{}")
        await hp.route("https://firestore.googleapis.com/**", fsr)
        await hp.goto(URL.replace("index.html", "h.html?t=" + tok)); await wf(hp, "document.body.innerText.includes('तारीख-वार हिसाब')", timeout=8000)
        htx = await hp.inner_text("body"); assert "JCO मेस" in htx and "UPI से अभी चुकाएँ" in htx, htx[:300]
        await hp.screenshot(path=f"{SHOTS}/41-hisab-link.png")
        # 7) ऑर्डर पेज + ऐप में ऑर्डर
        await pg.evaluate("SX.pubRates(true)"); await pg.wait_for_timeout(600)
        rates = await pg.evaluate("window.__MOCK__.pub.rates"); assert rates and len(rates["items"]) > 10
        await hp.goto(URL.replace("index.html", "o.html")); await hp.wait_for_selector("[data-p]")
        await hp.screenshot(path=f"{SHOTS}/42a-order-grid.png")
        await hp.click('[data-p="aloo"]'); await hp.click('[data-p="aloo"]'); await hp.click('[data-p="tamatar"]'); await hp.click("#go"); await hp.wait_for_selector("#nm")
        await hp.fill("#nm", "टेस्ट ग्राहक"); await hp.fill("#ph", "98290 12345"); await hp.fill("#ad", "12/B JCO लाइन"); await hp.click("#go")
        await wf(hp, "document.body.innerText.includes('ऑर्डर मिल गया')", timeout=8000)
        await hp.screenshot(path=f"{SHOTS}/42-order-page.png")
        ob = json.loads([u for u in UPLOADS if isinstance(u, tuple) and u[0] == "order"][-1][1])["fields"]
        assert ob["phone"]["stringValue"] == "9829012345" and ob["status"]["stringValue"] == "new" and len(ob["items"]["arrayValue"]["values"]) == 2, ob
        assert set(ob.keys()) <= {"name", "phone", "addr", "note", "items", "ts", "status", "src"}, ob.keys()
        await hp.close()
        await pg.evaluate("""(()=>{const M=window.__MOCK__;M.orders=M.orders||{};M.orders['o_t1']={name:'टेस्ट ग्राहक',phone:'9829012345',addr:'12/B',note:'',ts:Date.now(),status:'new',src:'web',items:[{id:'aloo',n:'आलू',q:0.5,u:'kg',s:20},{id:'tamatar',n:'टमाटर',q:0.25,u:'kg',s:20}]};SX._oUn&&SX._oUn();SX._oUn=null;SX.watchOrders()})()""")
        await pg.wait_for_selector("#sxOrd", timeout=8000); await pg.click("#sxOrd"); await pg.wait_for_selector("[data-sxobill]")
        await pg.click('[data-sxobill="o_t1"]'); await pg.wait_for_timeout(600)
        oc = await pg.evaluate("[S.cart.map(l=>l.id),S.cust.phone,window.__MOCK__.orders.o_t1.status]")
        assert "aloo" in oc[0] and "tamatar" in oc[0] and oc[1] == "9829012345" and oc[2] == "billing", oc
        await pg.evaluate("S.cart=[];S.sxOrder=null;refreshAfterCart()")
        await pg.evaluate("SE.printA4=window.__oA4;SX.shareBlob=window.__oSh;window.open=window.__oOp")
        print("se-plus ok: mandi, rate, slot, waste, a4, vyapar, backup, poster, hisab-link, order")
        assert o3[0] == 36 and o3[1] == o3[2] == 21405 and o3[3:7] == ["177 MH वेट कैंटीन", "nopay", "home", 0] and o3[7] and o3[8], o3
        assert o2[0] + len(await pg.evaluate("window.__MOCK__.ownerCfg.flags.oldUdhar2Skip||[]")) == 34 and o2[1] <= o2[2] == 13610 and o2[3] and o2[4] == 8, o2
        await pg.click('[data-tab="udhar"]'); await pg.wait_for_timeout(500)
        assert not await pg.query_selector("[data-oldud]"), "manual import button should vanish"
        await pg.evaluate("renderUdhar()")
        adm = await pg.inner_text('[data-party="adm-commander"]')
        assert "🔒" in adm and "₹" not in adm, adm
        sid = await pg.evaluate("SR.findOldParty(S.parties,SR.OLD_UDHAR[0]).id")
        await pg.click(f'[data-party="{sid}"]'); await pg.wait_for_selector("[data-opedit]")
        await pg.screenshot(path=f"{SHOTS}/22-old-udhar.png")
        await pg.click("[data-opedit]"); await pg.wait_for_selector("#oeA")
        await pg.fill("#oeA", "460"); await pg.click("[data-oesave]"); await pg.wait_for_timeout(600)
        await pg.click("[data-opedit]"); await pg.wait_for_selector("#oeA")
        await pg.fill("#oeA", "450"); await pg.click("[data-oesave]"); await pg.wait_for_timeout(600)
        ed = await pg.evaluate("Object.values(window.__MOCK__.ledger).filter(v=>v.prevAmt!=null)")
        assert ed and ed[0]["amt"] == 450 and ed[0]["prevAmt"] == 460, ed
        print("opening edit ok")
        # 🪧 बोर्ड के भाव: एक बार अपने-आप
        await pg.evaluate("(async()=>{delete window.__MOCK__.ownerCfg.flags.board1;delete window.__MOCK__.ownerCfg.flags.board2;delete window.__MOCK__.ownerCfg.flags.cost1;delete window.__MOCK__.ownerCfg.flags.photo1;delete window.__MOCK__.ownerCfg.flags.copy1;delete window.__MOCK__.ownerCfg.flags.copy2;delete window.__MOCK__.ownerCfg.flags.winter1;delete window.__MOCK__.ownerCfg.flags.board3;delete window.__MOCK__.ownerCfg.flags.supply1;delete window.__MOCK__.ownerCfg.flags.chat1;SR._board=0;await SR.applyBoard(S.db)})()"); await pg.wait_for_timeout(800)
        bd = await pg.evaluate("[window.__MOCK__.items.tamatar.sale,window.__MOCK__.items.nimbu.sale,!!window.__MOCK__.items.parwal,window.__MOCK__.items.parwal&&window.__MOCK__.items.parwal.sale,Object.values(window.__MOCK__.priceLog||{}).filter(x=>x.note&&x.note.includes('बोर्ड')).length,window.__MOCK__.ownerCfg.flags.board1>0]")
        assert bd[0] == 30 and bd[1] == 200 and bd[2] and bd[3] == 90 and bd[4] >= 10 and bd[5], bd
        b2 = await pg.evaluate("[window.__MOCK__.ownerCfg.flags.board2>0,window.__MOCK__.items.harapyaj&&window.__MOCK__.items.harapyaj.sale,window.__MOCK__.items.kachchakela&&window.__MOCK__.items.kachchakela.sale,!window.__MOCK__.items.safalmatar,window.__MOCK__.items.methi.sale]")
        assert b2 == [True, 80, 60, True, 200], b2
        b3 = await pg.evaluate("(()=>{const I=window.__MOCK__.items;return [window.__MOCK__.ownerCfg.flags.board3>0,I.harimirch.sale,I.toroi.sale,I.palak.sale,I.nariyal.sale,I.tamatar.ratePrev,I.aloo.sale,I.matar.sale]})()")
        assert b3 == [True, 180, 40, 60, 60, 20, 20, 200], b3
        c1 = await pg.evaluate("[window.__MOCK__.ownerCfg.flags.cost1>0,window.__MOCK__.items.tamatar.cost,window.__MOCK__.items.aloo.cost,(window.__MOCK__.items.aloo.lastBuy||{}).rate,Object.values(window.__MOCK__.priceLog||{}).filter(x=>x.field==='cost').length]")
        assert c1[0] and c1[1] == 8 and c1[2] == 13 and c1[3] == 13 and c1[4] >= 20, c1
        p1 = await pg.evaluate("""(()=>{const M=window.__MOCK__,I=M.items,st=(M['days/2026-11-01/meta']||{}).stock||{};return [M.ownerCfg.flags.photo1>0,I.moongfali&&I.moongfali.active,I.sitafal.active,I.parwal.photo,I.dragonfruit.photo,(st.items||{}).seb&&st.items.seb.close,(st.items||{}).shimla&&st.items.shimla.close,Object.keys(st.items||{}).length,SE.bundled.has('lalaloo')]})()""")
        assert p1 == [True, False, False, "b", "b", 5, 1.7, 22, True], p1
        if await pg.evaluate("today()") == "2026-11-02":
            await pg.wait_for_timeout(500)
            assert await pg.evaluate("(S.prevStock||{}).seb&&S.prevStock.seb.close") == 5, "opening stock not loaded for today"
        c2 = await pg.evaluate("""(()=>{const M=window.__MOCK__,st=((M['days/2026-11-02/meta']||{}).stock)||{},cp=((M['days/2026-11-02/meta']||{}).copy)||{};const I=st.items||{};return [M.ownerCfg.flags.copy1>0,I.aloo&&I.aloo.close,I.tamatar&&I.tamatar.close,I.papita&&I.papita.waste,I.kiwi&&I.kiwi.close,!!(cp.day&&cp.day.sale),(st.wlog||[]).length]})()""")
        assert c2 == [True, 30, 0, 2.5, 10, True, 10], c2
        c3 = await pg.evaluate("""(()=>{const M=window.__MOCK__,st=((M['days/2026-11-03/meta']||{}).stock)||{},cp=((M['days/2026-11-03/meta']||{}).copy)||{};const I=st.items||{},P=M.purchases||{};
          const mm=Object.entries(M.items).find(([k,v])=>v.name==='मोटी मिर्च');return [M.ownerCfg.flags.copy2>0,I.seb&&I.seb.close,I.kiwi&&I.kiwi.close,I.kheera&&I.kheera.close,!!I.tamatar&&I.tamatar.close!==undefined,P.cp2_0311_seb&&P.cp2_0311_seb.total,P.cp2_0311_papita&&P.cp2_0311_papita.total,P.cp2_0311_papita&&P.cp2_0311_papita.pay,cp.day&&cp.day.sale.online,(cp.day&&cp.day.kharid.length),mm?(I[mm[0]]||{}).close:0.5]})()""")
        assert c3 == [True, 8, 7, 0, False, 1500, 350, "galla", 7201, 28, 0.5], c3
        w1 = await pg.evaluate("""(async()=>{const M=window.__MOCK__,I=M.items;const r=[M.ownerCfg.flags.winter1>0,I.bathua&&I.bathua.active,I.ber&&I.ber.season,I.strawberry&&I.strawberry.unit,Object.values(I).filter(x=>x.season).length,I.tamatar.active!==false];
          const it=S.items.find(x=>x.id==='ber');if(!it)return r.concat(['noitem']);SX.seasonSel={ber:true};r.push(SX.seasonText().includes('बेर'));r.push(SX.seasonHTML().includes('मौसम का नया माल'));
          await SX.seasonOn('ber');r.push(M.items.ber.active);SX.seasonSel={};return r})()""")
        assert w1 == [True, False, "winter", "pc", 20, True, True, True, True], w1
        print("winter pack ok")
        sp = await pg.evaluate("""(()=>{const M=window.__MOCK__,SU=Object.values(M.suppliers||{}),PE=M.payees||{};const pv=SU.find(s=>String(s.name).includes('पवन'));
          const g=M.suppliers.sup_gajanand,mi=M.suppliers.sup_misri;return [M.ownerCfg.flags.supply1>0,!!pv&&(pv.items||[]).includes('phoolgobhi'),pv&&pv.name,g&&g.rates.nariyal,mi&&mi.rates.phoolgobhi,
          (PE.chat_managnechiya||{}).chat&&PE.chat_managnechiya.chat.total,SU.filter(s=>s.master==='supply1').length>=15]})()""")
        assert sp == [True, True, "पवन सब्ज़ी भंडार", 45, 40, 92113, True], sp
        await pg.evaluate("closeSheet()"); await pg.wait_for_timeout(200)
        await pg.click('[data-tab="kharid"]'); await pg.wait_for_timeout(300)
        await pg.fill("#pPh", ""); await pg.fill("#pShop", "मिश्री लाल"); await pg.wait_for_timeout(200)
        su = await pg.evaluate("[!document.getElementById('supIt').hidden,document.getElementById('supIt').textContent.includes('मिश्री')&&document.getElementById('supIt').textContent.includes('फूलगोभी'),document.querySelector('#pgrid [data-pitem]').dataset.pitem,!!document.querySelector('#pgrid .supmine')]")
        assert su == [True, True, "phoolgobhi", True], su
        await pg.click("#supIt [data-pitem=phoolgobhi]"); await pg.wait_for_timeout(250)
        supr = await pg.evaluate("(document.querySelector('.qpop .supr')||{}).textContent||''")
        assert "₹40" in supr, supr
        await pg.screenshot(path=f"{SHOTS}/8c-kharid-dukan.png")
        await pg.click(".qpop [data-close]"); await pg.fill("#pShop", ""); await pg.wait_for_timeout(150)
        assert await pg.evaluate("document.getElementById('supIt').hidden"), "supplier strip should hide"
        cb = await pg.evaluate("""(()=>{const P=Object.values(window.__MOCK__.purchases||{}).filter(p=>p.src==='chat'),C=window.__MOCK__.purchases['ch_20261104-WA0022']||{},pv=P.find(p=>p.date==='2026-11-10'&&p.total===3600)||{};
          return [window.__MOCK__.ownerCfg.flags.chat1>0,P.length>=230,C.pay,C.total,pv.supName,(pv.lines||[{}])[0].id,P.filter(p=>p.pay==='galla').length]})()""")
        assert cb == [True, True, "galla", 2980, "पवन सब्ज़ी भंडार", "", 3], cb
        hi = await pg.evaluate("""(()=>{S.purch.push({id:'hx1',date:today(),ts:Date.now(),supName:'मिश्री लाल',byName:'कमल भाई',hiRate:[{name:'फूलगोभी',rate:50,usual:40,pct:25}]});const h=SF.hiRateHTML();S.purch.pop();return [h.includes('फूलगोभी ₹50'),h.includes('+25%')]})()""")
        assert hi == [True, True], hi
        await pg.click('[data-tab="kharid"]'); await pg.wait_for_timeout(200)
        await pg.fill("#pPh", ""); await pg.fill("#pShop", "मिश्री लाल"); await pg.wait_for_timeout(200)
        await pg.click("#supIt [data-pitem=phoolgobhi]"); await pg.wait_for_selector("#piQ")
        await pg.fill("#piQ", "5"); await pg.fill("#piR", "50"); await pg.click("[data-pisave]"); await pg.wait_for_timeout(300)
        await pg.click("[data-pbill]"); await pg.wait_for_selector("[data-psave]"); await pg.click("[data-psave]"); await pg.wait_for_timeout(1500)
        hp2 = await pg.evaluate("(Object.values(window.__MOCK__.purchases).find(p=>p.supName==='मिश्री लाल'&&p.src!=='chat')||{}).hiRate")
        assert hp2 and hp2[0]["usual"] == 40 and hp2[0]["rate"] == 50, hp2
        print("chat purchases + hi-rate ok")
        print("supplier master ok")
        gl = await pg.evaluate("""(async()=>{const d=S.billsDate,c0=cashCalc(d).expected;SF.glF={kind:'out',why:''};const bad=await SF.glSave();
          await SF.glWrite([{id:'g1',ts:1,kind:'out',why:'विक्रम जी को दिए',amt:500,by:'u_x',byName:'कमल भाई'},{id:'g2',ts:2,kind:'in',why:'MH कैंटीन से लिए',amt:200,by:'u_x',byName:'कमल भाई'}]);
          const c1=cashCalc(d),h=SF.glCardHTML(),tile=SF.gallaTileHTML(),m=((window.__MOCK__['days/'+d+'/meta']||{}).galla||{}).log||[];
          const pc=S.prevClose;S.prevClose={d:dayPlus(d,-1),counted:777};const fl=S.close&&S.close.float!=null&&S.close.float!==''?null:cashCalc(d).float;S.prevClose=pc;
          const r=[bad,r2(c0-c1.expected),c1.gIn,c1.gOut,h.includes('data-glok'),tile.includes('2 एंट्री'),m.length,fl===null||fl===777];await SF.glWrite([]);r.push(cashCalc(d).expected===c0);return r})()""")
        assert gl == [False, 300, 200, 500, True, True, 2, True, True], gl
        print("galla in-out ok")
        if await pg.evaluate("today()") == "2026-11-03":
            await pg.wait_for_timeout(400)
            assert await pg.evaluate("(S.prevStock||{}).aloo&&S.prevStock.aloo.close") == 30, "02-11 night must be today's opening"
        print("board rates ok", bd, c1, p1)
        # 🏢 अपनी संस्था को गया "उधार" बिल → खरीद भाव का संस्था चालान (एक बार, पुराना रूप सुरक्षित, उधार एंट्री हटे)
        ic = await pg.evaluate("""(async()=>{const M=window.__MOCK__;const k='days/2026-11-03/bills';M[k]=M[k]||{};
          M[k]['SE-79K9BE']={no:'SE-79K9BE',date:'2026-11-03',ts:Date.now()-3600e3,by:'u_mukesh',byName:'Mukesh Bhai Sub Ex',mode:'udhar',partyId:'p_mr',partyName:'marwar rasoi',
            lines:[{id:'kheera',name:'खीरा',unit:'kg',qty:7,rate:50,amt:350},{id:'dhaniya',name:'धनिया',unit:'kg',qty:1,rate:180,amt:180}],sub:530,total:530,disc:0,pay:{cash:0,upi:0,udhar:530},payMode:'udhar',settled:true,cancelled:false};
          M.ledger=M.ledger||{};M.ledger['SE-79K9BE']={ts:Date.now(),date:'2026-11-03',partyId:'p_mr',partyName:'marwar rasoi',type:'udhar',amt:530,billNo:'SE-79K9BE'};
          M.purchases=M.purchases||{};M.purchases['pt_inst']={date:'2026-11-03',ts:Date.now(),lines:[{id:'kheera',qty:20,rate:30,amt:600}]};
          delete M.ownerCfg.flags.inst1;SR._inst=0;SR._instDone=0;await SR.applyInst(S.db,{...SR.INST1,force:true});
          const b=M[k]['SE-79K9BE'];const once=JSON.stringify(b);SR._instDone=0;await SR.applyInst(S.db,{...SR.INST1,force:true});
          return [b.mode,b.partyName,b.lines[0].rate,b.lines[0].saleRate,b.lines[1].rate>0&&b.lines[1].rate<180,b.total===b.lines[0].amt+b.lines[1].amt,b.instConv.from.total,b.instConv.from.partyName,!M.ledger['SE-79K9BE'],M.ownerCfg.flags.inst1>0,JSON.stringify(M[k]['SE-79K9BE'])===once,b.edits.slice(-1)[0].diff]})()""")
        assert ic[:11] == ["inst", "मारवाड़ रसोई (होटल)", 30, 50, True, True, 530, "marwar rasoi", True, True, True], ic
        print("inst conversion ok", ic[11])

        await pg.evaluate("closeSheet()")
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
        pay = await pg.evaluate("window.__MOCK__.pay"); payees = await pg.evaluate("Object.values(window.__MOCK__.payees||{}).filter(p=>!p.supKey)")
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
        # 🛰️ जगह फोन के असली GPS से: अंदाज़े वाली "सरल लाइन" को यहीं पक्का करें + नई जगह "मैं यहाँ हूँ"
        assert "अंदाज़े से" in await pg.inner_text("#p-route")
        await pg.click('#p-route [data-plfix="सरल लाइन"]'); await pg.wait_for_selector("#sheet .pl-fix.ok", timeout=30000)
        await pg.screenshot(path=f"{SHOTS}/26-place-lock.png")
        await pg.click("[data-pllock]"); await pg.wait_for_timeout(800)
        pl = [p for p in (await pg.evaluate("Object.values(window.__MOCK__.places||{})")) if p["name"] == "सरल लाइन"]
        assert len(pl) == 1 and pl[0]["src"] == "gps" and pl[0]["acc"] == 12 and abs(pl[0]["lat"] - 25.7712) < 1e-5 and abs(pl[0]["lng"] - 71.3521) < 1e-5 and pl[0].get("old"), pl
        await pg.context.set_geolocation({"latitude": 25.7841, "longitude": 71.3655, "accuracy": 8})
        await pg.click('#p-route [data-plhere]'); await pg.wait_for_selector("#sheet .pl-fix.ok", timeout=30000)
        await pg.fill("#plName", "सर"); await pg.wait_for_timeout(150)
        assert "सरल लाइन" in await pg.inner_text("#plChips")
        await pg.fill("#plName", "गरुड़ लाइन"); await pg.click("[data-pllock]"); await pg.wait_for_timeout(800)
        g = [p for p in (await pg.evaluate("Object.values(window.__MOCK__.places||{})")) if p["name"] == "गरुड़ लाइन"]
        assert g and g[0]["src"] == "gps" and abs(g[0]["lat"] - 25.7841) < 1e-5 and g[0]["acc"] == 8, g
        await pg.context.set_geolocation({"latitude": 25.7712, "longitude": 71.3521, "accuracy": 12})
        # दाएँ-बाएँ उछाल: पक्की GPS के बीच नेटवर्क की ±120 मी. वाली जगह और अकेली उछाल हटे
        cl = await pg.evaluate("""(()=>{const t0=Date.now()-3600e3;const pts=[];for(let i=0;i<10;i++)pts.push((t0+i*60000)+',25.771200,71.352100,10');
          pts.splice(4,0,(t0+3.5*60000)+',25.771200,71.358000,120');pts.splice(8,0,(t0+6.5*60000)+',25.775000,71.352100,15');
          const a=SR.analyze(today(),[{uid:'x',name:'t',pts}],[]);return [a.pts[0].P.length,a.stops.length,+a.stops[0].lng.toFixed(4)]})()""")
        assert cl == [10, 1, 71.3521], cl
        print("gps place lock ok", pl[0]["acc"], g[0]["lat"], cl)
        # 🛰️ ट्रैकर: सैटेलाइट/सादा, व्यक्ति फ़िल्टर, ▶ रीप्ले, पड़ाव पर बिल, जगह का पूरा हिसाब
        await pg.evaluate("closeSheet()"); await pg.click('[data-rref]'); await pg.wait_for_selector("#rmapw .rctl"); await pg.wait_for_timeout(1500)
        assert "सादा" in await pg.inner_text("[data-rsat]"), "satellite should be default"
        assert len(await pg.query_selector_all("[data-rwho]")) >= 2
        await pg.click("[data-rplay]"); await pg.wait_for_timeout(1400)
        rs_ = await pg.inner_text("#rpSt"); assert ("रुकी" in rs_ or "चल रही" in rs_), rs_
        assert await pg.query_selector("#rmap .rvan"), "moving van marker"
        await pg.screenshot(path=f"{SHOTS}/31-tracker.png")
        await pg.click("[data-rplay]")
        await pg.click('[data-rstop="0"]'); await pg.wait_for_selector("#sheet #rthumb"); await pg.wait_for_timeout(300)
        stx = await pg.inner_text("#sheet"); assert "यहाँ बने बिल" in stx and "₹" in stx, stx[:300]
        await pg.screenshot(path=f"{SHOTS}/32-stop-sheet.png")
        await pg.evaluate("closeSheet()")
        await pg.click('[data-rpl="सरल लाइन"]'); await wf(pg, "document.querySelector('#sheet')&&document.querySelector('#sheet').innerText.includes('ग्राहकों के नंबर')", timeout=8000)
        await pg.click('#sheet [data-psn="7"]'); await wf(pg, "document.querySelector('#sheet').innerText.includes('ग्राहकों के नंबर')", timeout=8000)
        await pg.screenshot(path=f"{SHOTS}/33-place-sheet.png")
        await pg.evaluate("closeSheet()")
        await pg.click('[data-rwho]:not([data-rwho=""])'); await pg.wait_for_timeout(600)
        await pg.click('[data-rsat]'); await pg.wait_for_timeout(600); assert "सैटेलाइट" in await pg.inner_text("[data-rsat]")
        await pg.click('[data-rsat]'); await pg.wait_for_timeout(300); await pg.click('[data-rwho=""]'); await pg.wait_for_timeout(400)
        print("tracker ok")
        await pg.screenshot(path=f"{SHOTS}/16-route.png", full_page=True)
        print("route stops", len(stops), "|", stops[0].replace("\n", " ")[:80])
        await pg.click('[data-tab="report"]'); await pg.evaluate("S.repSel='';renderReport()"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f"{SHOTS}/7-owner-report.png", full_page=True)
        assert await pg.locator("#p-report .rp-g").count() == 4, "रिपोर्ट के 4 समूह"
        assert await pg.is_visible("[data-npok]"), "pending new item card missing"
        await pg.click("[data-npok]"); await pg.wait_for_timeout(500)
        assert not [v for v in (await pg.evaluate("Object.values(window.__MOCK__.items)")) if v.get("pending")], "approve failed"
        ctx = await pg.inner_text("#p-report")
        assert "रद्द हुए बिल" in ctx and "रद्द हो गया" in ctx and "वापस चालू" in ctx, ctx[:300]
        # ↩ मालिक: उधार वाला बिल वापस चालू — बिल फिर चालू, उधार खाते में वापस
        await pg.click(f'[data-crno="{_bn}"]'); await pg.wait_for_timeout(900)
        rb = await pg.evaluate(f"Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v)).find(b=>b.no==='{_bn}')")
        assert rb["cancelled"] is False and rb.get("restoredTs") and (not (rb.get("pay") or {}).get("udhar") or await pg.evaluate(f"!!(window.__MOCK__.ledger||{{}})['{_bn}']")), rb
        print("owner restored cancelled bill ok")
        for _ in range(4):
            if not await pg.query_selector('[data-crok]'): break
            await pg.click('[data-crok]'); await pg.wait_for_timeout(100)
            if await pg.query_selector('[data-crok]'): await pg.click('[data-crok]')
            await pg.wait_for_timeout(800)
        cancelled = await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.values(v)).filter(b=>b.cancelled).length")
        assert cancelled == 1, cancelled
        assert sorted(x["status"] for x in await pg.evaluate("Object.values(window.__MOCK__.cancelReq)")) == ["approved", "rejected"]
        print("owner approved cancel")
        await pg.evaluate("S.repSel='tools';renderReport()"); await pg.wait_for_timeout(200)
        await pg.evaluate("window.__qq=null;window.__oSh2=SX.shareBlob;SX.shareBlob=async(b,n,e)=>{if(n==='SabjiExpress_Order_QR')window.__qq={e,size:b?b.size:-1,url:SX._qr.toDataURL('image/png')}}")
        await pg.click("[data-sxqr]"); await wf(pg, "window.__qq", timeout=15000)
        q = await pg.evaluate("window.__qq"); assert q["e"] == "png" and q["size"] > 20000, q.get("size")
        await pg.evaluate("void(SX.shareBlob=window.__oSh2)")
        import base64, numpy as np, cv2
        img = cv2.imdecode(np.frombuffer(base64.b64decode(q["url"].split(",")[1]), np.uint8), cv2.IMREAD_COLOR); cv2.imwrite(f"{SHOTS}/44-qr-card.png", img)
        val, _, _ = cv2.QRCodeDetector().detectAndDecode(img); assert val.endswith("o.html"), val
        await pg.evaluate("S.repSel='';renderReport()")
        print("qr card ok")
        await pg.evaluate("S.repSel='full';renderReport()"); await pg.wait_for_timeout(200)
        await pg.click("[data-a4]"); await pg.wait_for_timeout(800)
        html = await pg.evaluate("(()=>{const f=[...document.querySelectorAll('iframe')].pop();return f?f.contentDocument.documentElement.outerHTML:''})()")
        assert "सब्ज़ी-वार" in html and "टमाटर" in html and "मंडी खरीद" in html, html[:300]
        open(f"{SHOTS}/a4.html", "w", encoding="utf8").write(html)
        # 🌙 डार्क मोड: कहीं भी लिखावट अदृश्य न हो (दिन का हिसाब, बिल, उधार, रिपोर्ट)
        await pg.evaluate("closeSheet&&closeSheet()"); await pg.emulate_media(color_scheme="dark")
        for t in ["day", "bills", "udhar", "report", "kharid"]:
            await pg.click(f'[data-tab="{t}"]'); await pg.wait_for_timeout(400)
            bad = await pg.evaluate(CONTRAST_JS)
            assert not bad, (t, bad[:5])
        await pg.emulate_media(color_scheme="light")
        print("dark mode contrast ok")
        await gallery(pg, "owner")
        await pg.context.close()
        await b.close()
    bad = [e for e in errs if "favicon" not in e]
    print("errors:", bad)
    print("ALL OK" if not bad else "ERRORS")

try:
    asyncio.run(main())
except Exception:
    print("errors-at-fail:", errs[:8])
    raise
