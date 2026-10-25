/* सब्ज़ी एक्सप्रेस — सेटिंग
   firebase: Firebase कंसोल → Project settings → Web app से मिला कोड यहाँ आता है।
   (यह गुप्त नहीं है — डेटा की सुरक्षा firestore.rules से होती है) */
window.SE_CONFIG = {
  firebase: {
    apiKey: "AIzaSyBBaZF1E58Ybxemy5HPj8T3L0gnyg9eOPI",
    authDomain: "sabji-express-9a8f0.firebaseapp.com",
    projectId: "sabji-express-9a8f0",
    storageBucket: "sabji-express-9a8f0.firebasestorage.app",
    messagingSenderId: "166609299174",
    appId: "1:166609299174:web:f1740cac2f75273fbf7d27"
  },
  // मालिक की ईमेल की छाप (SHA-256) — ईमेल यहाँ साफ़ नहीं लिखी जाती
  ownerHash: "d05c53d3cdca521782c90e21f807a1add61726965096709cb1ae4f3612b96151",
  ownerName: "विक्रम जी",
  // Google Apps Script वेब-ऐप का URL (…/exec) — खरीद के बिल की फोटो Drive में भेजने के लिए
  photoUrl: "",
  updateUrl: "https://177mhwcanteen-cyber.github.io/sabji-express-app/"
};
