# सब्ज़ी एक्सप्रेस — बिलिंग ऐप (Android + वेब)

विक्रम जी की सब्ज़ी गाड़ी (जालीपा कैंट, बाड़मेर) के लिए बिलिंग, स्टॉक, उधार और रिपोर्ट।

## कैसे काम करता है
| हिस्सा | कहाँ | बदलाव कैसे पहुँचता है |
|---|---|---|
| ऐप का खोल (APK) | कर्मचारी के फोन में एक बार | Releases से नई APK (कभी-कभार) |
| ऐप का अंदर का हिस्सा (स्क्रीन, हिसाब) | GitHub Pages | हर बदलाव पर फोन में **अपने-आप** |
| डेटा (बिल, स्टॉक, भाव, उधार) | Firebase Firestore (Mumbai) | लाइव — ऐप अपडेट से कभी नहीं मिटता |
| रोज़ की कॉपी | Google Sheet (Apps Script) | हर घंटे |

* बिना इंटरनेट बिल बनते हैं; नेट आते ही सर्वर पर चले जाते हैं।
* कर्मचारी कोई बिल मिटा/बदल नहीं सकते (`firestore.rules`)। रेट सिर्फ़ मालिक बदलते हैं।
* स्कैनर: Google ML Kit (Android), वेब में Chrome का BarcodeDetector।
* प्रिंट: ब्लूटूथ थर्मल 58/80mm (हिंदी, इमेज मोड) और A4 रिपोर्ट/PDF।

## लिंक
* APK: `https://github.com/177mhwcanteen-cyber/sabji-express-app/releases/latest/download/sabji-express.apk`
* वेब (मालिक मोड, Chrome में): `https://177mhwcanteen-cyber.github.io/sabji-express-app/`

## एक बार की सेटिंग
1. `web/config.js` में Firebase का `firebaseConfig` भरें।
2. Firebase Console → Firestore → Rules में `firestore.rules` चिपकाकर Publish।
3. Firebase Console → Authentication → Email/Password चालू।
4. GitHub → Settings → Pages → Source: **GitHub Actions**।
5. (वैकल्पिक) `apps-script/` वाला कोड Google Sheet के Apps Script में।

## बनाने वाले के लिए
```
npm ci
npm run build          # www/ और dist/ बनाता है
npx cap sync android   # Android में कॉपी
python3 scripts/port.py <पुरानी sabji.html> web/index.html   # सिर्फ़ पहली बार का बदलाव
python3 tests/e2e.py www /tmp/shots                         # नकली Firebase के साथ पूरा टेस्ट
```
`android/app/sabji-release.jks` साइन करने की चाबी है — इसे बदलें नहीं, वरना नई APK पुरानी के ऊपर इंस्टॉल नहीं होगी।
