/**
 * सब्ज़ी एक्सप्रेस → Google Sheet (रोज़ का दूसरा बैकअप + Claude के लिए हिसाब)
 *
 * लगाने का तरीका (एक बार):
 * 1. sheets.new खोलें, नाम रखें "सब्ज़ी एक्सप्रेस हिसाब"
 * 2. Extensions → Apps Script → यह पूरा कोड चिपकाएँ → Save
 * 3. बाईं ओर ⚙ Project Settings → "Show appsscript.json" चालू करें, फिर appsscript.json में
 *    इसी फ़ोल्डर की appsscript.json वाली चीज़ें चिपकाएँ
 * 4. ऊपर फ़ंक्शन "setup" चुनकर ▶ Run दबाएँ → अनुमति दें (Allow)
 * 5. ऊपर Deploy → New deployment → प्रकार "Web app" → Execute as: Me, Who has access: Anyone → Deploy
 *    जो URL मिले (…/exec) वह Claude को भेजें — ऐप की खरीद वाली फोटो इसी से Drive में जाएँगी
 * बस। अब हर घंटे पिछले 3 दिन का हिसाब Sheet में अपने-आप उतरता रहेगा।
 * Sheet में कुछ भी हाथ से बदलने से ऐप का डेटा नहीं बदलता (सिर्फ़ पढ़ने की कॉपी है)।
 */
const PROJECT_ID = 'PASTE_PROJECT_ID'; // Firebase प्रोजेक्ट ID, जैसे sabji-express-1a2b3
const DAYS_BACK = 3;

function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncAll').timeBased().everyHours(1).create();
  syncAll();
}

function syncAll() {
  const ss = SpreadsheetApp.getActive();
  syncBills_(ss);
  syncItems_(ss);
  syncLedger_(ss);
  syncDayMeta_(ss);
  syncPurchases_(ss);
  sheet_(ss, 'जानकारी', ['आखिरी अपडेट']).getRange(2, 1).setValue(new Date());
}

/* ---------- Firestore REST (आपके Google खाते की अनुमति से) ---------- */
function fsList_(path) {
  const out = [];
  let token = '';
  do {
    const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/' +
      path + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    const r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (r.getResponseCode() === 404) return out;
    if (r.getResponseCode() !== 200) throw new Error(path + ': ' + r.getContentText().slice(0, 300));
    const j = JSON.parse(r.getContentText());
    (j.documents || []).forEach(d => out.push(Object.assign({ _id: d.name.split('/').pop() }, val_({ mapValue: { fields: d.fields || {} } }))));
    token = j.nextPageToken || '';
  } while (token);
  return out;
}
function val_(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val_);
  if ('mapValue' in v) { const o = {}; const f = v.mapValue.fields || {}; Object.keys(f).forEach(k => o[k] = val_(f[k])); return o; }
  return null;
}
function days_() {
  const tz = 'Asia/Kolkata', out = [];
  for (let i = 0; i < DAYS_BACK; i++) out.push(Utilities.formatDate(new Date(Date.now() - i * 864e5), tz, 'yyyy-MM-dd'));
  return out;
}
function sheet_(ss, name, head) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#e6f2e6'); }
  return sh;
}
/* key वाली पंक्तियाँ बदलो/जोड़ो — पुरानी तारीखों की पंक्तियाँ कभी नहीं मिटतीं */
function upsert_(sh, keyCol, rows) {
  const n = sh.getLastRow();
  const keys = n > 1 ? sh.getRange(2, keyCol, n - 1, 1).getValues().map(r => String(r[0])) : [];
  const idx = {}; keys.forEach((k, i) => idx[k] = i + 2);
  const add = [];
  rows.forEach(r => { const k = String(r[keyCol - 1]); if (idx[k]) sh.getRange(idx[k], 1, 1, r.length).setValues([r]); else add.push(r); });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
}
const ist_ = ts => ts ? Utilities.formatDate(new Date(ts), 'Asia/Kolkata', 'dd-MM-yyyy HH:mm') : '';

function syncBills_(ss) {
  const B = sheet_(ss, 'बिल', ['बिल नं', 'तारीख', 'समय', 'प्रकार', 'ग्राहक/संस्था', 'मोबाइल', 'बिलर', 'कुल', 'नकद', 'UPI', 'उधार', 'छूट', 'खरीद लागत', 'रेट बदला', 'रद्द', 'रद्द की वजह']);
  const L = sheet_(ss, 'बिल की लाइनें', ['चाबी', 'बिल नं', 'तारीख', 'प्रकार', 'सब्ज़ी', 'मात्रा', 'इकाई', 'भाव', 'बोर्ड भाव', 'रकम', 'खरीद भाव', 'भाव बदला', 'मुफ्त', 'रद्द']);
  const bRows = [], lRows = [];
  days_().forEach(d => fsList_('days/' + d + '/bills').forEach(b => {
    const p = b.pay || {};
    const mode = b.mode === 'inst' ? 'संस्था' : b.mode === 'udhar' ? 'उधार खाता' : 'ग्राहक';
    bRows.push([b.no || b._id, b.date || d, ist_(b.ts), mode, b.partyName || '', b.custPhone || '', b.byName || '', b.total || 0, p.cash || 0, p.upi || 0, p.udhar || 0, b.disc || 0, b.cost || 0, b.rateChanged ? 'हाँ' : '', b.cancelled ? 'रद्द' : '', b.cancelReason || '']);
    (b.lines || []).forEach((l, i) => lRows.push([(b.no || b._id) + '#' + i, b.no || b._id, b.date || d, mode, l.name, l.qty, l.unit, l.rate, l.board, l.amt, l.cost, l.changed ? 'हाँ' : '', l.free ? 'हाँ' : '', b.cancelled ? 'रद्द' : '']));
  }));
  if (bRows.length) upsert_(B, 1, bRows);
  if (lRows.length) upsert_(L, 1, lRows);
}
function syncItems_(ss) {
  const today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  const S = sheet_(ss, 'भाव (रोज़)', ['चाबी', 'तारीख', 'सब्ज़ी', 'बिक्री भाव', 'खरीद भाव', 'इकाई', 'चालू']);
  const rows = fsList_('items').map(it => [today + '|' + it._id, today, it.name, it.sale || 0, it.cost || 0, it.unit || '', it.active === false ? 'बंद' : 'चालू']);
  if (rows.length) upsert_(S, 1, rows);
  const P = sheet_(ss, 'स्टॉक (पैक्ड)', ['सामान', 'मात्रा', 'आखिरी बदलाव', 'किसने', 'क्यों']);
  const ps = fsList_('pstock'); const names = {}; fsList_('items').forEach(i => names[i._id] = i.name);
  if (ps.length) upsert_(P, 1, ps.map(x => [names[x._id] || x._id, x.qty || 0, ist_(x.ts), x.byName || '', x.last || '']));
}
function syncLedger_(ss) {
  const S = sheet_(ss, 'उधार खाता', ['चाबी', 'तारीख', 'खाता', 'उधार/जमा', 'रकम', 'तरीका', 'बिल', 'किसने']);
  const rows = fsList_('ledger').map(l => [l._id, l.date || '', l.partyName || '', l.type === 'udhar' ? 'उधार' : 'जमा', l.amt || 0, l.mode || '', l.billNo || '', l.byName || '']);
  if (rows.length) upsert_(S, 1, rows);
}
function syncDayMeta_(ss) {
  const K = sheet_(ss, 'खर्चा', ['चाबी', 'तारीख', 'किस पर', 'रकम', 'तरीका', 'किसने']);
  const G = sheet_(ss, 'गल्ला मिलान', ['तारीख', 'विवरण (JSON)']);
  const kr = [], gr = [];
  days_().forEach(d => {
    fsList_('days/' + d + '/kharch').forEach(k => kr.push([d + '|' + k._id, d, k.what || '', k.amt || 0, k.mode === 'upi' ? 'UPI' : 'नकद', k.byName || '']));
    const meta = fsList_('days/' + d + '/meta');
    if (meta.length) gr.push([d, JSON.stringify(meta)]);
  });
  if (kr.length) upsert_(K, 1, kr);
  if (gr.length) upsert_(G, 1, gr);
}

/* ---------- मंडी खरीद ---------- */
function syncPurchases_(ss) {
  const P = sheet_(ss, 'खरीद', ['चाबी', 'तारीख', 'समय', 'दुकान', 'मोबाइल', 'किसने', 'कुल', 'भुगतान', 'दिया', 'बाकी', 'फोटो', 'नोट']);
  const L = sheet_(ss, 'खरीद की लाइनें', ['चाबी', 'तारीख', 'दुकान', 'सामान', 'मात्रा', 'इकाई', 'भाव', 'रकम', 'पिछला भाव', 'बदलाव %']);
  const pay = { vikram: 'विक्रम जी ने दिया', galla: 'गल्ले से नकद', upi: 'कर्मचारी UPI', udhar: 'बाकी (उधार)' };
  const pr = [], lr = [];
  days_().forEach(d => {
    const q = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents:runQuery', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'purchases' }], where: { fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: d } } } } })
    });
    if (q.getResponseCode() !== 200) return;
    JSON.parse(q.getContentText()).filter(x => x.document).forEach(x => {
      const p = Object.assign({ _id: x.document.name.split('/').pop() }, val_({ mapValue: { fields: x.document.fields || {} } }));
      if (p.cancelled) return;
      pr.push([p._id, p.date, ist_(p.ts), p.supName || '', p.supPhone || '', p.byName || '', p.total || 0, pay[p.pay] || p.pay || '', p.paid || 0, p.due || 0,
        (p.photos || []).map(f => f.url).join(' '), p.note || '']);
      (p.lines || []).forEach((l, i) => lr.push([p._id + '#' + i, p.date, p.supName || '', l.name, l.qty, l.unit, l.rate, l.amt, l.prev || '',
        l.prev ? Math.round((l.rate - l.prev) / l.prev * 100) : '']));
    });
  });
  if (pr.length) upsert_(P, 1, pr);
  if (lr.length) upsert_(L, 1, lr);
}

/* ---------- ऐप से बिल की फोटो → Google Drive ---------- */
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    // 1) फोटो भेजने वाला सच में हमारे ऐप का चालू कर्मचारी/मालिक है?
    const lk = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(b.apiKey),
      { method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: b.idToken }), muteHttpExceptions: true });
    if (lk.getResponseCode() !== 200) return out_({ ok: false, error: 'login' });
    const u = (JSON.parse(lk.getContentText()).users || [])[0];
    if (!u) return out_({ ok: false, error: 'login' });
    const st = fsGet_('staff/' + u.localId);
    if (!st || st.active !== true) return out_({ ok: false, error: 'not-staff' });
    // 2) Drive में "सब्ज़ी एक्सप्रेस बिल फोटो / 2026-10" फ़ोल्डर
    const root = folder_(DriveApp.getRootFolder(), 'सब्ज़ी एक्सप्रेस बिल फोटो');
    const month = folder_(root, String(b.date || '').slice(0, 7) || 'बिना तारीख');
    const name = String(b.name || (b.pid + '.jpg')).replace(/[\\/:*?"<>|]/g, '_');
    const f = month.createFile(Utilities.newBlob(Utilities.base64Decode(b.b64), b.mime || 'image/jpeg', name));
    f.setDescription('खरीद ' + b.pid + ' · ' + (st.name || ''));
    return out_({ ok: true, id: f.getId(), url: f.getUrl() });
  } catch (err) {
    return out_({ ok: false, error: String(err).slice(0, 200) });
  }
}
function fsGet_(path) {
  const r = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/' + path,
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  return val_({ mapValue: { fields: JSON.parse(r.getContentText()).fields || {} } });
}
function folder_(parent, name) { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
