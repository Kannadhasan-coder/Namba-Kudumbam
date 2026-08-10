/* ============================================================
   FIREBASE CONFIG — fill this in with YOUR project's keys.
   Firebase Console → Project Settings → General → Your apps → SDK setup
   See README.md, Step 1, for exact instructions.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBxmEytkZfb8VI_WNth071pVxj1WHQbU70",
  authDomain: "nk-chat-db.firebaseapp.com",
  projectId: "nk-chat-db",
  storageBucket: "nk-chat-db.firebasestorage.app",
  messagingSenderId: "523484163524",
  appId: "1:523484163524:web:f97803500ac146bb0bc891"
};

/* Soft "gate" codes — these only decide who SEES the login forms.
   Real account security is handled by Firebase Authentication
   (see README, Step 3) using each member's own password.

   spectatePassword is what visitors type and CAN be changed freely,
   right here, anytime — no Firebase Console visit needed. */
const GATE_CODES = {
  adminCode: "220977",
  familyCode: "2026",
  familyPassword: "Namba Family",
  spectatePassword: "guest@2026"
};

/* GUEST_AUTH_PASSWORD is the guest account's actual Firebase Auth
   password — set ONCE in Firebase Console (README Step 3) and never
   changed there again. It is intentionally separate from
   GATE_CODES.spectatePassword above: change the gate word anytime
   without ever touching Firebase Console. */
const GUEST_AUTH_PASSWORD = "guest@2026";

/* Email domain used to turn each member's name into a Firebase Auth
   email under the hood — members never see or type this. */
const AUTH_EMAIL_DOMAIN = "naarikootam.family";

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
/* Storage is intentionally not initialized — image/voice attachments in
   Announcements need Firebase Storage, which requires the Blaze
   (pay-as-you-go) plan and a billing card on file. This build skips it
   and stays on the Spark (free, no card needed) plan. If you add a card
   later, see README "Adding photo/voice messages later" to re-enable it. */

/* Secondary app instance so that creating a new member account
   (Admin → Add Member) never signs the admin out of their own session. */
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = secondaryApp.auth();
