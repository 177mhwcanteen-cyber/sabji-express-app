// web/ से www/ (ऐप) और dist/ (वेबसाइट + अपडेट फ़ाइल) बनाता है।
// उपयोग: node scripts/build.mjs   (SE_VERSION=1.0.25 से संस्करण तय कर सकते हैं)
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const R = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const W = path.join(R, "web"), OUT = path.join(R, "www"), DIST = path.join(R, "dist");
const now = new Date(), p = n => String(n).padStart(2, "0");
const VERSION = process.env.SE_VERSION ||
  `${now.getFullYear()}.${p(now.getMonth() + 1)}${p(now.getDate())}.${p(now.getHours())}${p(now.getMinutes())}`;
const NATIVE_MIN = 1; // जब Android में नई मशीनी सुविधा जुड़े तब बढ़ाएँ — तब नई APK चाहिए

const rm = d => fs.rmSync(d, { recursive: true, force: true });
const cp = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.cpSync(a, b, { recursive: true }); };
rm(OUT); rm(DIST); fs.mkdirSync(path.join(OUT, "lib"), { recursive: true });

// 1) Firebase + Capacitor एक छोटे बंडल में
await build({ entryPoints: [path.join(W, "src/vendor.js")], bundle: true, minify: true, format: "iife",
  target: ["chrome90"], outfile: path.join(OUT, "lib/vendor.js"), legalComments: "none", logLevel: "warning" });

// 2) बाकी फ़ाइलें
for (const f of ["index.html", "se-platform.js", "se-features.js", "se-nutri.js", "se-route.js", "se-pay.js", "config.js", "manifest.webmanifest", "migrate.json", "icon.png"])
  if (fs.existsSync(path.join(W, f))) cp(path.join(W, f), path.join(OUT, f));
cp(path.join(W, "img"), path.join(OUT, "img"));
cp(path.join(R, "node_modules/qrcodejs/qrcode.min.js"), path.join(OUT, "lib/qrcode.min.js"));
cp(path.join(R, "node_modules/@zxing/library/umd/index.min.js"), path.join(OUT, "lib/zxing.min.js"));
cp(path.join(R, "node_modules/leaflet/dist/leaflet.js"), path.join(OUT, "lib/leaflet.js"));
cp(path.join(R, "node_modules/leaflet/dist/leaflet.css"), path.join(OUT, "lib/leaflet.css"));

// 3) फ़ॉन्ट (देवनागरी + अंग्रेज़ी)
const fontCss = [];
for (const [pkg, fam, ws] of [["baloo-2", "Baloo 2", [500, 700, 800]], ["mukta", "Mukta", [400, 500, 700]]])
  for (const w of ws) for (const sub of ["devanagari", "latin"]) {
    const fn = `${pkg}-${sub}-${w}-normal.woff2`, src = path.join(R, "node_modules/@fontsource", pkg, "files", fn);
    if (!fs.existsSync(src)) continue;
    cp(src, path.join(OUT, "fonts", fn));
    fontCss.push(`@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url(${fn}) format("woff2");${sub === "latin" ? "unicode-range:U+0000-00FF,U+20B9;" : "unicode-range:U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+25CC,U+A830-A839,U+A8E0-A8FF;"}}`);
  }
fs.writeFileSync(path.join(OUT, "fonts/fonts.css"), fontCss.join("\n"));

// 4) संस्करण + फोटो सूची
const photos = fs.readdirSync(path.join(W, "img")).filter(f => f.endsWith(".jpg")).map(f => f.slice(0, -4));
fs.writeFileSync(path.join(OUT, "build.js"),
  `window.SE_BUILD=${JSON.stringify(VERSION)};window.SE_NATIVE_MIN=${NATIVE_MIN};window.SE_PHOTOS=${JSON.stringify(photos)};\n`);

// 5) वेब (Chrome) के लिए ऑफ़लाइन कैश
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const a = path.join(d, f); fs.statSync(a).isDirectory() ? walk(a) : files.push(path.relative(OUT, a).split(path.sep).join("/")); } })(OUT);
const shell = files.filter(f => !f.endsWith("migrate.json"));
fs.writeFileSync(path.join(OUT, "sw.js"), `const C="se-${VERSION}",F=${JSON.stringify(["./", ...shell])};
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F)))});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.includes("/update/"))return;
e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request)))});
`);

// 6) dist = वेबसाइट (GitHub Pages) + Android अपडेट ज़िप
cp(OUT, DIST);
fs.mkdirSync(path.join(DIST, "update"), { recursive: true });
const zipName = `bundle-${VERSION}.zip`;
execSync(`cd "${OUT}" && zip -qr "${path.join(DIST, "update", zipName)}" . -x sw.js`);
fs.writeFileSync(path.join(DIST, "update/version.json"),
  JSON.stringify({ version: VERSION, url: "update/" + zipName, minNative: NATIVE_MIN, built: now.toISOString() }, null, 1));
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");
console.log("बना:", VERSION, "·", files.length, "फ़ाइलें");
