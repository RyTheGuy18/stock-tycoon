// Firebase web config for Stock Tycoon (Firebase console → Project settings → Your apps → Web app).
// This isn't a secret: it identifies the project. firestore.rules is what protects the data.
// Set it to null to play offline only.
export const firebaseConfig = {
  apiKey: "AIzaSyCFiDICgmVgFpeev-hhggHiJU1npIoBsvc",
  authDomain: "stock-tycoon-98f34.firebaseapp.com",
  projectId: "stock-tycoon-98f34",
  storageBucket: "stock-tycoon-98f34.firebasestorage.app",
  messagingSenderId: "1088850359172",
  appId: "1:1088850359172:web:9dd1eaec636d530efb23d1",
};

// Public key for push notifications (the matching private key lives only in the GitHub secret VAPID_PRIVATE).
export const vapidPublicKey = "BGFHKqR1TDOeea5F1UvYcjTxz1XrjdyEL49iAnEt7OqbeDG-FQMwvLG4T-ZVgs1VsapZkU753byPbW6eCkK1vA8";
