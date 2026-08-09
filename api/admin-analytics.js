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
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  const cookie = req.headers.cookie || "";
  if (!cookie.includes("nf_admin_gate=1")) {
    return res.status(401).json({ ok: false, message: "Admin session required." });
  }

  try {
    const a = getAdmin();
    const db = a.firestore();
    const conversations = await db.collection("conversations").get();
    let messageCount = 0;
    let estimatedBytes = 0;
    let personalChats = 0;
    let groupChats = 0;

    for (const c of conversations.docs) {
      const data = c.data();
      if (data.type === "group") groupChats++;
      else personalChats++;
      const msgs = await c.ref.collection("messages").get();
      messageCount += msgs.size;
      msgs.forEach(m => {
        const d = m.data();
        estimatedBytes += Buffer.byteLength(JSON.stringify(d), "utf8");
      });
    }

    return res.status(200).json({
      ok: true,
      conversations: conversations.size,
      personalChats,
      groupChats,
      messageCount,
      estimatedBytes,
      estimatedKB: Math.round((estimatedBytes / 1024) * 100) / 100,
      estimatedMB: Math.round((estimatedBytes / 1048576) * 1000) / 1000
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
}