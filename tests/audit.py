"""पुराने आर्टिफ़ैक्ट ऐप की हर सुविधा नए ऐप में है या नहीं — हर टैब चलाकर जाँच"""
import asyncio, json, os, sys
sys.argv = ["x", "www", sys.argv[1]]
src = open(os.path.join(os.path.dirname(__file__), "e2e.py"), encoding="utf8").read().split("async def main():")[0]
__file__ = os.path.abspath(os.path.join(os.path.dirname(__file__), "e2e.py")); exec(src)
from playwright.async_api import async_playwright
CHECK = []
def ok(name, cond, extra=""): CHECK.append((name, bool(cond), extra))
async def m():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mig = json.load(open(os.path.join(WWW, "migrate.json"), encoding="utf8"))
        users = {"sabziexpress3600@gmail.com": {"uid": "own", "pw": "secret123"}}
        mock = {"items": mig["items"], "parties": mig["parties"], "settings": mig["settings"], "customers": mig["customers"], "purchases": {}}
        import datetime, random
        random.seed(3)
        for i in range(1, 7):
            d = (datetime.date.today() - datetime.timedelta(days=i)).isoformat(); bills = {}
            for j in range(random.randint(8, 16)):
                amt = random.choice([40, 60, 85, 120, 150, 210, 300, 450])
                bills[f"SE{d[8:]}{d[5:7]}-{j:04d}AA"] = {"no": f"SE{d[8:]}{d[5:7]}-{j:04d}AA", "date": d, "ts": 0, "mode": "walk", "total": amt, "pay": {"cash": amt}, "lines": [{"id": "aloo", "name": "आलू", "qty": 1, "amt": amt, "cost": amt * .7}], "cancelled": False}
            mock[f"days/{d}/bills"] = bills
            mock["purchases"][f"p{i}"] = {"date": d, "ts": 0, "total": random.randint(5000, 9000), "lines": [], "cancelled": False}
        pg = await page(b, mock, users)
        await pg.click('[data-lg="to-owner"]'); await pg.fill("#lgPass", "secret123"); await pg.click('[data-lg="owner-go"]')
        await pg.wait_for_selector("#lock", state="hidden"); await pg.wait_for_timeout(1200)
        tabs = await pg.eval_on_selector_all("[data-tab]", "e=>e.map(x=>x.dataset.tab)")
        ok("सभी टैब (बिलिंग, खरीद, उधार, आज के बिल, दिन, लेबल, रिपोर्ट, सेटिंग)", set(["bill","kharid","udhar","bills","day","label","report","set"]) <= set(tabs), tabs)
        n = await pg.evaluate("document.querySelectorAll('#grid [data-item]').length")
        ok("52 सब्ज़ियाँ फोटो वाले कार्ड में", n >= 50, n)
        nimg = await pg.evaluate("document.querySelectorAll('#grid [data-item] img').length")
        ok("HD फोटो लगी हैं", nimg >= 48, nimg)
        cats = await pg.evaluate("[...document.querySelectorAll('#cats .chip')].map(x=>x.textContent.trim())")
        ok("कैटेगरी + टॉप सेलिंग", any("टॉप" in c for c in cats) and len(cats) >= 5, cats)
        await pg.fill("#q", "खीरा 1.5"); await pg.press("#q", "Enter"); await pg.wait_for_timeout(300)
        ok("सर्च में 'खीरा 1.5' लिखकर सीधा जुड़ना", await pg.evaluate("S.cart.some(l=>l.id==='kheera'&&l.qty===1.5)"))
        await pg.click('[data-item="kela"]'); await pg.wait_for_timeout(200)
        ok("केला का भाव बदल सकते हैं (flex)", await pg.is_visible("#rtIn"))
        await pg.fill("#qIn", "2"); await pg.click("[data-add]")
        await pg.click('[data-item="tamatar"]'); await pg.wait_for_timeout(200)
        ok("बाकी सब्ज़ियों का भाव ताला-बंद", not await pg.is_visible("#rtIn"))
        await pg.fill("#aIn", "60"); await pg.click("[data-add]")
        ok("रुपये लिखकर किलो अपने-आप (₹60 टमाटर = 2 किलो)", await pg.evaluate("S.cart.some(l=>l.id==='tamatar'&&l.qty===2)"))
        await pg.fill("#custPh", "9509553600"); await pg.wait_for_timeout(300)
        ok("ग्राहक मोबाइल डालते ही पुराना ग्राहक पहचाना", "Vikram" in (await pg.input_value("#custNm")))
        await pg.click("[data-btnew]"); await pg.wait_for_timeout(200)
        ok("एक साथ कई ग्राहक (टैब)", await pg.evaluate("S.bt.length") == 2)
        await pg.click("#bts .btab >> nth=0"); await pg.wait_for_timeout(200)
        await pg.click("#cartbtn"); await pg.wait_for_timeout(300)
        await pg.click('[data-pay="upi"]'); await pg.wait_for_timeout(500)
        qr = await pg.evaluate("!!document.querySelector('#qr canvas, #qr img')")
        ok("UPI QR रकम के साथ (VIKRAM CHARAN 9460409552@okbizaxis)", qr and await pg.evaluate("upiId()") == "9460409552@okbizaxis")
        await pg.screenshot(path=f"{SHOTS}/a-upi.png")
        await pg.click("[data-save]"); await pg.wait_for_timeout(1000)
        ok("बिल सेव + रसीद + WhatsApp + प्रिंट बटन", await pg.is_visible("[data-print]") and await pg.evaluate("!!document.querySelector('#sheet a[href*=\"wa.me\"]')"))
        await pg.evaluate("closeSheet()")
        # उधार
        await pg.click('[data-tab="udhar"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{SHOTS}/a-udhar.png")
        ok("उधार खाते (JCO मेस, अफसर मेस, समोसा शॉप…)", await pg.evaluate("document.querySelector('#p-udhar').innerText.includes('JCO')"))
        await pg.click('[data-tab="bills"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{SHOTS}/a-bills.png")
        ok("आज के बिल + कौन बिल बना रहा है (लाइव)", await pg.evaluate("document.querySelector('#p-bills').innerText.length>40"))
        await pg.click('[data-tab="day"]'); await pg.wait_for_timeout(400)
        t = await pg.inner_text("#p-day")
        ok("गल्ला मिलान + खर्चा + रात का स्टॉक + पूरा हिसाब", all(k in t for k in ["गल्ला मिलान", "खर्चा", "रात का स्टॉक", "आज का पूरा हिसाब"]))
        await pg.click('[data-tab="report"]'); await pg.wait_for_timeout(600)
        t = await pg.inner_text("#p-report")
        ok("रिपोर्ट + पहरेदार + A4 प्रिंट", all(k in t for k in ["पहरेदार", "कुल बिक्री", "A4"]))
        await pg.wait_for_timeout(1500)
        ok("रिपोर्ट में 7 दिन का ग्राफ़", await pg.evaluate("!!document.querySelector('#p-report .chart svg rect')"))
        await pg.screenshot(path=f"{SHOTS}/a-report.png", full_page=True)
        await pg.click('[data-tab="set"]'); await pg.wait_for_timeout(500)
        t = await pg.inner_text("#p-set")
        ok("सेटिंग: पक्की UPI, संस्थाएँ, कर्मचारी, प्रिंटर, लेबल प्रिंटर, भाव, फोटो", all(k in t for k in ["9460409552", "संस्थाएँ", "कर्मचारी", "ब्लूटूथ प्रिंटर", "लेबल प्रिंटर", "बिक्री"]))
        ok("फोटो बदलने का बटन", await pg.evaluate("document.querySelectorAll('#p-set [data-photo]').length") >= 50)
        # भाव बदलें → priceLog
        await pg.fill("#s-aloo", "22"); await pg.press("#s-aloo", "Tab"); await pg.wait_for_timeout(500)
        ok("भाव बदलने पर तारीख सहित इतिहास (priceLog)", await pg.evaluate("Object.values(window.__MOCK__.priceLog||{}).some(x=>x.itemId==='aloo'&&x.new===22)"))
        # बिना नेट
        await pg.context.set_offline(True)
        await pg.click('[data-tab="bill"]'); await pg.click('[data-item="pyaj"]'); await pg.fill("#qIn", "1"); await pg.click("[data-add]")
        await pg.click("#cartbtn"); await pg.wait_for_timeout(300); await pg.click('[data-pay="cash"]'); await pg.click("[data-save]"); await pg.wait_for_timeout(1200)
        ok("बिना इंटरनेट बिल (फोन में रुका)", await pg.evaluate("JSON.parse(localStorage.getItem('se_outbox')||'[]').length") >= 1)
        await pg.evaluate("closeSheet()"); await pg.context.set_offline(False); await pg.evaluate("window.dispatchEvent(new Event('online'))"); await pg.wait_for_timeout(3000)
        ok("नेट आते ही अपने-आप सर्वर पर", await pg.evaluate("JSON.parse(localStorage.getItem('se_outbox')||'[]').length") == 0)
        ok("बिल नंबर अपने-आप (SE…)", await pg.evaluate("Object.entries(window.__MOCK__).filter(([k])=>k.endsWith('/bills')).flatMap(([k,v])=>Object.keys(v)).every(n=>/^SE\\d{4}-/.test(n))"))
        await b.close()
    for n, c, e in CHECK: print(("✅" if c else "❌"), n, "" if c else e)
    print("errors:", errs)
asyncio.run(m())
