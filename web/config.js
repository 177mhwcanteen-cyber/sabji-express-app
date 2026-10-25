/* सब्ज़ी एक्सप्रेस — सेटिंग
   firebase: Firebase कंसोल → Project settings → Web app से मिला कोड यहाँ आता है।
   (यह गुप्त नहीं है — डेटा की सुरक्षा firestore.rules से होती है) */
window.SE_CONFIG = {
  firebase: {
    apiKey: "PASTE_API_KEY",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },
  // मालिक की ईमेल की छाप (SHA-256) — ईमेल यहाँ साफ़ नहीं लिखी जाती
  ownerHash: "70e65847566f6e4609800a53bb14fbdf6a43dac12aedc32396337239937d229b",
  ownerName: "विक्रम जी",
  // Google Apps Script वेब-ऐप का URL (…/exec) — खरीद के बिल की फोटो Drive में भेजने के लिए
  photoUrl: "",
  updateUrl: "https://177mhwcanteen-cyber.github.io/sabji-express-app/"
};
