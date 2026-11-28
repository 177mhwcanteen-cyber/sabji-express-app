#!/usr/bin/env python3
"""🧑‍💼 सब्ज़ी एक्सप्रेस ↔ Claude का ताले वाला डिब्बा (28-11-2026) — web/se-claude.js का दूसरा सिरा।
  fetch <dir>                 (GitHub Action) pub/cx_idx + pub/cx_<दिन> → <dir>/claude/in/<दिन>.json  (ताले में ही)
  inbox [--key PEM]           (Claude) शाखा claude-data खींचो, खोलो → /tmp/sabji-in/<दिन>.md + key.txt (फोन की चाबी)
  send <दिन> <audit.json> [--key PEM]  (Claude) ऑडिट ताले में → claude-data/claude/out/<दिन>.json + index.json → push
audit.json: {"verdict":"एक लाइन", "rows":[["कुल बिक्री","₹10,325"],…], "issues":[{"t":"…","amt":"1,150","lvl":"पक्का|शक|नोट","why":"…"}],
             "ask":["कमल भाई से सवाल…"], "note":"…"}
निजी चाबी: /home/claude/vbe-block-timer/keys/sabji-claude.pem (निजी repo vikram7charan-del/vbe-block-timer)।"""
import base64, json, os, subprocess, sys, time, urllib.request

PROJ = "sabji-express-9a8f0"
API = "AIzaSyBBaZF1E58Ybxemy5HPj8T3L0gnyg9eOPI"
REPO = "/home/claude/sabji-express-app"
PEM = "/home/claude/vbe-block-timer/keys/sabji-claude.pem"
OUT = "/tmp/sabji-in"


def rest(doc):
    u = f"https://firestore.googleapis.com/v1/projects/{PROJ}/databases/(default)/documents/pub/{doc}?key={API}"
    rq = urllib.request.Request(u, headers={"Referer": "https://177mhwcanteen-cyber.github.io/"})
    try:
        return json.load(urllib.request.urlopen(rq, timeout=30))
    except Exception as e:
        print("नहीं मिला", doc, e); return None


def val(v):
    if "stringValue" in v: return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return v["doubleValue"]
    if "mapValue" in v: return {k: val(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return None


def fetch(d):
    ix = rest("cx_idx")
    if not ix: return
    dates = val({"mapValue": {"fields": ix.get("fields", {})}}).get("d", {}) or {}
    os.makedirs(f"{d}/claude/in", exist_ok=True)
    for day, ts in sorted(dates.items())[-15:]:
        p = f"{d}/claude/in/{day}.json"
        if os.path.exists(p) and json.load(open(p)).get("ts") == ts: continue
        doc = rest("cx_" + day)
        if not doc: continue
        o = {k: val(v) for k, v in doc.get("fields", {}).items()}
        json.dump(o, open(p, "w"), ensure_ascii=False); print("नया:", day)


def keys(pem):
    from cryptography.hazmat.primitives import serialization
    return serialization.load_pem_private_key(open(pem, "rb").read(), None)


def git(*a, cwd=REPO):
    return subprocess.run(["git", *a], cwd=cwd, check=True, capture_output=True, text=True).stdout


def worktree():
    wt = "/tmp/sabji-claude-data"
    git("fetch", "-q", "origin", "claude-data")
    if not os.path.exists(wt): git("worktree", "add", "-f", wt, "origin/claude-data")
    else: git("checkout", "-q", "--detach", "origin/claude-data", cwd=wt); git("reset", "-q", "--hard", "origin/claude-data", cwd=wt)
    return wt


def inbox(pem):
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    k, wt = keys(pem), worktree()
    os.makedirs(OUT, exist_ok=True); last = (0, None)
    for f in sorted(os.listdir(f"{wt}/claude/in")):
        o = json.load(open(f"{wt}/claude/in/{f}"))
        K = k.decrypt(base64.b64decode(o["wk"]), padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
        t = AESGCM(K).decrypt(base64.b64decode(o["iv"]), base64.b64decode(o["ct"]), None).decode()
        open(f"{OUT}/{f[:-5]}.md", "w").write(t)
        if o.get("ts", 0) > last[0]: last = (o["ts"], K)
        print(f[:-5], "·", time.strftime("%d-%m %H:%M", time.localtime(o.get("ts", 0) / 1000)), "·", len(t), "अक्षर")
    if last[1]: open(f"{OUT}/key.txt", "w").write(base64.b64encode(last[1]).decode())


def send(day, path):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    K = base64.b64decode(open(f"{OUT}/key.txt").read())
    body = json.dumps(json.load(open(path)), ensure_ascii=False).encode()
    iv = os.urandom(12); ts = int(time.time() * 1000)
    wt = worktree(); os.makedirs(f"{wt}/claude/out", exist_ok=True)
    json.dump({"iv": base64.b64encode(iv).decode(), "ct": base64.b64encode(AESGCM(K).encrypt(iv, body, None)).decode(), "ts": ts}, open(f"{wt}/claude/out/{day}.json", "w"))
    ip = f"{wt}/claude/out/index.json"; ix = json.load(open(ip)) if os.path.exists(ip) else {"d": {}}
    ix["d"][day] = ts; json.dump(ix, open(ip, "w"))
    git("add", "-A", cwd=wt); git("commit", "-qm", f"Claude का ऑडिट {day}", cwd=wt); git("push", "-q", "origin", "HEAD:claude-data", cwd=wt)
    print("✓ भेजा", day)


if __name__ == "__main__":
    a = sys.argv[1:]; pem = a[a.index("--key") + 1] if "--key" in a else PEM
    if a[0] == "fetch": fetch(a[1])
    elif a[0] == "inbox": inbox(pem)
    elif a[0] == "send": send(a[1], a[2])
