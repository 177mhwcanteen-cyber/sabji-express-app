#!/usr/bin/env python3
"""🧾 रोज़ की खरीद का मिलान — विक्रम जी का खरीद-पन्ना (पर्ची) बनाम ऐप की मंडी खरीद।

उपयोग:
  python3 scripts/milan.py <ऐप का AI ऑडिट पैक (.md/.txt)> <पर्ची.csv> [--out रिपोर्ट.md]

पर्ची.csv (Claude विक्रम जी की फोटो/पन्ने से लिखे) — पहली लाइन शीर्षक:
  दुकान,सामान,मात्रा,भाव,रकम
  (रकम खाली हो तो मात्रा × भाव; दुकान खाली हो तो ऊपर वाली दुकान)

ऑडिट पैक: ऐप → दिन का हिसाब → 🤖 AI ऑडिट पैक → "⬇️ फाइल" (या कॉपी करके .md में सेव)।
इसमें "## 4. मंडी खरीद" की तालिका से ऐप की हर खरीद-लाइन पढ़ी जाती है।
नियम: docs/KHARID-MILAN-PROMPT-2026-11-28.md
"""
import argparse, csv, difflib, re, sys

NUM = re.compile(r"-?\d+(?:[.,]\d+)?")


def num(x):
    m = NUM.search(str(x or "").replace(",", ""))
    return float(m.group(0)) if m else 0.0


def norm(s):
    s = str(s or "").lower().strip()
    s = re.sub(r"[\s\-_.,/()'\"]+", "", s)
    for a, b in (("ज़", "ज"), ("ड़", "ड"), ("ढ़", "ढ"), ("फ़", "फ"), ("क़", "क"), ("ग़", "ग"), ("ख़", "ख"), ("ं", "न"), ("ँ", "न")):
        s = s.replace(a, b)
    for w in ("सब्जीभंडार", "सब्जीकंपनी", "फ्रूटकंपनी", "फलसब्जी", "भंडार", "ट्रेडर्स", "traders", "sabji", "subji", "company", "कंपनी"):
        s = s.replace(w, "")
    return s


def sim(a, b):
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    if a == b or a in b or b in a:
        return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def read_app(path):
    """ऑडिट पैक से '## 4. मंडी खरीद' तालिका"""
    t = open(path, encoding="utf8").read()
    m = re.search(r"##\s*4\.\s*मंडी खरीद\s*\n(.*?)(?:\n##\s|\Z)", t, re.S)
    if not m:
        sys.exit("❌ ऑडिट पैक में '## 4. मंडी खरीद' नहीं मिला — ऐप से पूरा पैक दें")
    rows = []
    for line in m.group(1).splitlines():
        line = line.strip()
        if not line.startswith("|") or set(line) <= set("|-: "):
            continue
        c = [x.strip() for x in line.strip("|").split("|")]
        if len(c) < 12 or c[0] in ("नं",):
            continue
        rows.append({"no": c[0], "time": c[1], "shop": c[2], "by": c[3], "item": c[4], "qty": num(c[5]), "rate": num(c[6]),
                     "prev": num(c[7]), "diff": num(c[8]) if c[8] else None, "amt": num(c[9]), "pay": c[10], "photo": c[11]})
    return rows


def read_parchi(path):
    rows, shop = [], ""
    with open(path, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            g = lambda *k: next((r[x] for x in k if x in r and str(r[x]).strip()), "")
            shop = g("दुकान", "shop") or shop
            item = g("सामान", "item")
            if not item:
                continue
            q, rt = num(g("मात्रा", "qty")), num(g("भाव", "rate"))
            amt = num(g("रकम", "amt")) or round(q * rt, 2)
            rows.append({"shop": shop, "item": item, "qty": q, "rate": rt, "amt": amt})
    return rows


def match(app, par):
    used, pairs = set(), []
    for i, p in enumerate(par):
        best, bs = None, 0.0
        for j, a in enumerate(app):
            if j in used:
                continue
            s = sim(p["item"], a["item"]) * 0.7 + sim(p["shop"], a["shop"]) * 0.3
            if abs(p["amt"] - a["amt"]) < 1:
                s += 0.15
            if s > bs:
                best, bs = j, s
        if best is not None and bs >= 0.62 and sim(p["item"], app[best]["item"]) >= 0.6:
            used.add(best)
            pairs.append((p, app[best]))
        else:
            pairs.append((p, None))
    extra = [a for j, a in enumerate(app) if j not in used]
    return pairs, extra


def rs(x):
    return "₹" + (f"{x:,.2f}".rstrip("0").rstrip("."))


def report(app, par):
    pairs, extra = match(app, par)
    miss = [p for p, a in pairs if a is None]
    both = [(p, a) for p, a in pairs if a is not None]
    bad = [(p, a) for p, a in both if abs(p["amt"] - a["amt"]) > max(5, 0.02 * p["amt"]) or abs(p["qty"] - a["qty"]) > 0.05 * max(p["qty"], 1) or abs(p["rate"] - a["rate"]) > 0.5]
    tp, ta = round(sum(p["amt"] for p in par), 2), round(sum(a["amt"] for a in app), 2)
    L = [f"# 🧾 खरीद का मिलान — पर्ची बनाम ऐप", "",
         f"- पर्ची में कुल: **{rs(tp)}** ({len(par)} लाइन) · ऐप में कुल: **{rs(ta)}** ({len(app)} लाइन) · फर्क: **{rs(round(ta - tp, 2))}**",
         f"- ✅ पूरा मिला: {len(both) - len(bad)} · ⚠ फर्क वाले: {len(bad)} · ❌ ऐप में नहीं चढ़े: {len(miss)} · ❓ सिर्फ़ ऐप में: {len(extra)}", ""]
    if miss:
        L += ["## ❌ पर्ची में है, ऐप में नहीं चढ़ा", "| दुकान | सामान | मात्रा | भाव | रकम |", "|---|---|---|---|---|"]
        L += [f"| {p['shop']} | {p['item']} | {p['qty']:g} | {p['rate']:g} | {rs(p['amt'])} |" for p in miss]
        L += [f"कुल **{rs(round(sum(p['amt'] for p in miss), 2))}** — साथी से चढ़वाएँ (माल का हिसाब और दुकान का बाकी इसी से बनता है)", ""]
    if bad:
        L += ["## ⚠ दोनों में है, पर फर्क", "| सामान | दुकान (पर्ची / ऐप) | मात्रा पर्ची→ऐप | भाव पर्ची→ऐप | रकम पर्ची→ऐप | किसने चढ़ाया |", "|---|---|---|---|---|---|"]
        L += [f"| {p['item']} | {p['shop']} / {a['shop']} | {p['qty']:g} → {a['qty']:g} | {p['rate']:g} → {a['rate']:g} | {rs(p['amt'])} → {rs(a['amt'])} | {a['by']} |" for p, a in bad]
        L += [""]
    if extra:
        L += ["## ❓ ऐप में है, पर्ची में नहीं (दोहरी/झूठी एंट्री तो नहीं?)", "| ऐप नं | समय | दुकान | सामान | रकम | किसने |", "|---|---|---|---|---|---|"]
        L += [f"| {a['no']} | {a['time']} | {a['shop']} | {a['item']} | {rs(a['amt'])} | {a['by']} |" for a in extra]
        L += [""]
    nophoto = sorted({(a["no"], a["shop"], a["by"]) for a in app if "नहीं" in a["photo"]})
    if nophoto:
        L += ["## 📷 बिना फोटो वाली खरीद", "- " + "\n- ".join(f"{n} · {s} · {b}" for n, s, b in nophoto), ""]
    hi = [a for a in app if a["diff"] is not None and a["diff"] >= 15]
    if hi:
        L += ["## 🔺 पिछली बार से 15%+ महँगा", "- " + "\n- ".join(f"{a['item']} ({a['shop']}): ₹{a['prev']:g} → ₹{a['rate']:g} (+{a['diff']:g}%) · {a['by']}" for a in hi), ""]
    if not (miss or bad or extra or nophoto or hi):
        L += ["✅ विक्रम जी, आज की हर खरीद पर्ची से पूरी मिल गई।"]
    return "\n".join(L)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("pack")
    ap.add_argument("parchi")
    ap.add_argument("--out")
    a = ap.parse_args()
    out = report(read_app(a.pack), read_parchi(a.parchi))
    if a.out:
        open(a.out, "w", encoding="utf8").write(out + "\n")
    print(out)
