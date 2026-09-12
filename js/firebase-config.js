const firebaseConfig = {
  apiKey: "AIzaSyBxmEytkZfb8VI_WNth071pVxj1WHQbU70",
  authDomain: "nk-chat-db.firebaseapp.com",
  projectId: "nk-chat-db",
  storageBucket: "nk-chat-db.firebasestorage.app",
  messagingSenderId: "523484163524",
  appId: "1:523484163524:web:f97803500ac146bb0bc891"
};

const GATE_CODES = {
  adminCode: "",
  familyCode: "",
  familyPassword: "",
  spectatePassword: ""
};

const GUEST_AUTH_PASSWORD = "";

const AUTH_EMAIL_DOMAIN = "";

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = secondaryApp.auth();
