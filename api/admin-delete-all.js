import admin from "firebase-admin";

function getAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing.");
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  return admin;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false });
  const cookie = req.headers.cookie || "";
  if (!cookie.includes("nf_admin_gate=1")) {
    return res.status(401).json({ ok:false, message:"Admin session required." });
  }
  try {
    const a = getAdmin();
    const db = a.firestore();
    const conversations = await db.collection("conversations").get();
    let deleted = 0;
    for (const conversation of conversations.docs) {
      const messages = await conversation.ref.collection("messages").get();
      const batch = db.batch();
      messages.docs.forEach(m => { batch.delete(m.ref); deleted++; });
      if (messages.size) await batch.commit();
    }
    return res.status(200).json({ ok:true, deleted });
  } catch (e) {
    return res.status(500).json({ ok:false, message:e.message });
  }
}