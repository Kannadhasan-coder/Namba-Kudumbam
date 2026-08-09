/* ==========================================================================
   Firebase config — REPLACE these values with your own Firebase project.

   Epadi edukurathu:
   1. https://console.firebase.google.com ku poi oru project create pannunga.
   2. "Build" > "Realtime Database" > "Create Database" (start in *test mode*
      first, apparam README la kudutha rules ah paste pannunga).
   3. Project settings (gear icon) > "Your apps" > Web app (</>) add pannunga.
   4. Adhula kidaikura firebaseConfig object ah kீழே paste pannunga.
   ========================================================================== */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
