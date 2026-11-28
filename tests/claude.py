"""🧑‍💼 Claude-डिब्बा (web/se-claude.js ↔ scripts/claude_box.py) की जाँच: ताला दोनों ओर खुले, कार्ड बने, कोई JS गलती नहीं।
उपयोग: python3 tests/claude.py <www> [निजी चाबी PEM]  (चाबी न हो तो सिर्फ़ ऐप-तरफ़ की जाँच)"""
import asyncio, base64, json, os, sys, threading, http.server, functools
from playwright.async_api import async_playwright
WWW = os.path.abspath(sys.argv[1]); PEM = sys.argv[2] if len(sys.argv) > 2 else "/tmp/sabji-claude/key.pem"
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8771), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WWW))
srv.RequestHandlerClass.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
errs = []

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={"width": 360, "height": 780}, service_workers="block")).new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("**/config.js", lambda r: r.fulfill(body="window.SE_CONFIG={};", content_type="application/javascript"))
        await pg.goto("http://127.0.0.1:8771/index.html"); await pg.wait_for_timeout(1500)
        assert await pg.evaluate("!!window.SCL&&S.demo===true")
        assert await pg.evaluate("SCL.ok()") is False, "demo में भेजना बंद"
        msg = "🔍 सब्ज़ी एक्सप्रेस — टेस्ट पैक ₹1,234 " * 50
        o = await pg.evaluate("t=>SCL.pack(t)", msg)
        if os.path.exists(PEM):
            from cryptography.hazmat.primitives import serialization, hashes
            from cryptography.hazmat.primitives.asymmetric import padding
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            k = serialization.load_pem_private_key(open(PEM, "rb").read(), None)
            K = k.decrypt(base64.b64decode(o["wk"]), padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
            assert AESGCM(K).decrypt(base64.b64decode(o["iv"]), base64.b64decode(o["ct"]), None).decode() == msg, "ऐप → Claude ताला"
            aud = {"verdict": "₹1,150 कम", "rows": [["बिक्री", "₹10,325"]], "issues": [{"t": "नारियल नहीं लिखा", "amt": "850", "lvl": "पक्का", "why": "रात में नहीं"}], "ask": ["नारियल कहाँ गए?"]}
            iv = os.urandom(12)
            f = {"iv": base64.b64encode(iv).decode(), "ct": base64.b64encode(AESGCM(K).encrypt(iv, json.dumps(aud, ensure_ascii=False).encode(), None)).decode()}
            back = await pg.evaluate("f=>SCL.open(f)", f)
            assert json.loads(back) == aud, "Claude → ऐप ताला"
            print("ताला दोनों ओर ✓")
        h = await pg.evaluate("""(()=>{S.isOwner=true;SCL.out={'2026-11-28':{verdict:'₹1,150 कम',rows:[['बिक्री','₹10,325']],issues:[{t:'नारियल <b>',amt:'850',lvl:'पक्का'}],ask:['सवाल'],_ts:5}};return SCL.cardHTML()})()""")
        assert "Claude का ऑडिट" in h and "&lt;b&gt;" in h and "🔴 नया" in h, h[:300]
        assert "नया ऑडिट" in await pg.evaluate("SCL.note()")
        await pg.evaluate("S.tab='report';showTab();renderReport()"); await pg.wait_for_timeout(400)
        assert await pg.locator("#sclCard").count() == 1, "रिपोर्ट में कार्ड"
        await pg.click("[data-sclseen]"); await pg.wait_for_timeout(200)
        assert await pg.evaluate("SCL.unseen().length") == 0
        await b.close()
    assert not errs, errs
    print("✅ claude.py पास")

asyncio.run(main())
