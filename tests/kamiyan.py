"""सब्ज़ी एक्सप्रेस — 🔍 50 कमियों वाले सुधार (28-11-2026) की जाँच (डेमो मोड, तेज़)।
पूरा बिल ✕✕ / मात्रा-खिड़की से हटाना दर्ज · गल्ले में दुकानदार का "गल्ले से" भुगतान · Google Pay नोट "Bill SE-…" ·
UPI-जमा मिलान में · रात 12 के बाद तारीख अपने-आप · गल्ला एंट्री arrayUnion · बाद में सेटल हुए बिल का नकद पुराने दिन में नहीं।
उपयोग: python3 tests/kamiyan.py <www फ़ोल्डर> <स्क्रीनशॉट फ़ोल्डर>"""
import asyncio, os, sys, threading, http.server, functools
from playwright.async_api import async_playwright

WWW, SHOTS = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
os.makedirs(SHOTS, exist_ok=True)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8768), functools.partial(http.server.SimpleHTTPRequestHandler, directory=WWW))
srv.RequestHandlerClass.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
errs = []


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={"width": 360, "height": 780}, service_workers="block")).new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("**/config.js", lambda r: r.fulfill(body="window.SE_CONFIG={};", content_type="application/javascript"))
        await pg.goto("http://127.0.0.1:8768/index.html"); await pg.wait_for_timeout(1500)
        assert await pg.evaluate("S.demo===true")

        # 1) पूरा बिल-टैब ✕✕ से बंद → हर सामान दर्ज (पहले कुछ नहीं)
        await pg.evaluate("S.tab='bill';showTab();S.cartRmLocal=0;quickAdd(S.items[0],1);quickAdd(S.items[1],2);newTab();quickAdd(S.items[2],1)")
        await pg.wait_for_timeout(200)
        n0 = await pg.evaluate("S.bt.length")
        await pg.click('[data-btx="0"]'); await pg.wait_for_timeout(100); await pg.click('[data-btx="0"]'); await pg.wait_for_timeout(200)
        got = await pg.evaluate("[S.bt.length,S.cartRmLocal]")
        assert got == [n0 - 1, 2], ("tab close log", n0, got)

        # 2) मात्रा-खिड़की का "बिल से हटाएँ" भी दर्ज
        await pg.evaluate("S.cartRmLocal=0;openQty(item(S.cart[0].id),0)"); await pg.wait_for_selector("[data-rm]")
        await pg.click("[data-rm]"); await pg.wait_for_timeout(150)
        assert await pg.evaluate("S.cartRmLocal") == 1, "qty-sheet remove logged"

        # 3) गल्ला: दुकानदार को "गल्ले से" दिया बाकी भी घटे; बाद में सेटल हुआ बिल पुराने दिन के नकद में नहीं
        r = await pg.evaluate("""(()=>{const d=today();S.close={float:500};S.kharch=[];S.ledger=[];S.gl=null;
          S.dayBills=[{no:'A1',ts:Date.now(),date:d,mode:'walk',lines:[],total:200,pay:{cash:200,upi:0,udhar:0},settled:true},
                      {no:'A2',ts:Date.now(),date:d,mode:'walk',lines:[],total:90,pay:{cash:90,upi:0,udhar:0},settled:true,settleTs:Date.now()+2*864e5}];
          S.supPay=[{id:'s1',supId:'x',amt:150,mode:'galla',date:d},{id:'s2',supId:'x',amt:999,mode:'vikram',date:d}];
          const c=cashCalc(d);return [c.cashSale,c.khCash,c.expected]})()""")
        assert r == [200, 150, 550], ("galla supPay/late settle", r)

        # 4) Google Pay: नोट "Sabji Express Bill SE-XXXXXX" अब पहचान में (पहले BILLNO माँगता था)
        csv = "Payer name,Creation time,Transaction ID,Amount,Status,Notes\nRAM,2026-11-28 10:00:00,T1,120,SUCCESS,Sabji Express Bill SE-AB12CD\n"
        bill = await pg.evaluate("t=>SF.parseGpay(t)[0].bill", csv)
        assert bill == "SEAB12CD", bill

        # 5) उधार का UPI-जमा भी मिलान में (झूठा UPI-जमा पकड़ में)
        r = await pg.evaluate("""(()=>{const d=S.billsDate;S.ledger=[{id:'j1',type:'jama',mode:'upi',amt:300,date:d,ts:Date.now(),partyName:'रमेश',byName:'कमल'}];
          SF.gp={pays:[{name:'X',ts:Date.now()-36e5*5,amt:50,txn:'z1',date:d}]};S.dayBills=[];const M=SF.gpNow();return [M.miss.length,M.miss[0]&&M.miss[0].jama,M.upiApp]})()""")
        assert r == [1, 1, 300], ("jama upi in match", r)
        SFgp = await pg.evaluate("SF.gp=null;1")

        # 6) गल्ला एंट्री: नई एंट्री जुड़ती है, पुरानी नहीं मिटती (glAdd)
        r = await pg.evaluate("""(async()=>{S.gl={log:[{id:'g0',ts:1,kind:'in',why:'x',amt:10}]};await SF.glAdd({id:'g1',ts:2,kind:'out',why:'y',amt:5});return S.gl.log.map(g=>g.id)})()""")
        assert r == ["g0", "g1"], r

        # 7) 🌅 रात 12 के बाद "आज" अपने-आप नई तारीख (ऐप खुला रहे तब भी)
        r = await pg.evaluate("""(()=>{_dayNow='2020-01-01';S.billsDate='2020-01-01';S.repDate='2020-01-01';dayRoll();return [S.billsDate===today(),_dayNow===today()]})()""")
        assert r == [True, True], r
        r = await pg.evaluate("""(()=>{_dayNow='2020-01-01';S.billsDate='2019-12-25';dayRoll();return S.billsDate})()""")
        assert r == "2019-12-25", "जो पुरानी तारीख खुद देख रहा है, उसे नहीं छेड़ते"
        await pg.evaluate("S.billsDate=today();S.repDate=today()")

        # 8) ₹ से भरी लाइन (₹20 का) पर fix निशान; उसी सामान को फिर जोड़ा तो निशान हटे
        await pg.evaluate("S.cart=[];S.tab='bill';showTab();const it=S.items.find(i=>i.unit==='kg'&&i.sale>0);openQty(it)"); await pg.wait_for_selector("[data-qa='20']")
        await pg.click("[data-qa='20']"); await pg.wait_for_timeout(150)
        r = await pg.evaluate("[S.cart[0].amt,S.cart[0].fix]")
        assert r == [20, 1], r
        r = await pg.evaluate("(()=>{const l=S.cart[0];quickAdd(item(l.id),1);return [S.cart.length,S.cart[0].fix===undefined,S.cart[0].amt===Math.round((20+item(l.id).sale)*100)/100]})()")
        assert r == [1, True, True], r

        # 9) छोटे फोन (360px): बिल-सूची की फ़िल्टर पट्टी आँकड़ों को न ढके
        await pg.evaluate("S.tab='bills';showTab()"); await pg.wait_for_timeout(400)
        r = await pg.evaluate("(()=>{const f=document.querySelector('.bfbar').getBoundingClientRect(),k=document.querySelector('#p-bills .kpis').getBoundingClientRect();return [getComputedStyle(document.querySelector('.bfbar')).position,k.top>=f.bottom-1]})()")
        assert r == ["static", True], r
        await pg.screenshot(path=f"{SHOTS}/k1-bills-360.png")

        assert not errs, errs
        print("✅ पूरा टेस्ट पास (50 कमियों के सुधार)")
        await b.close()

asyncio.run(main())
