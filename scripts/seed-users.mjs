import admin from "firebase-admin";
import fs from "node:fs";

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountPath && !serviceAccountJson) {
  console.error("Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON.");
  process.exit(1);
}

const serviceAccount = serviceAccountPath
  ? JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))
  : JSON.parse(serviceAccountJson);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const users = [
  { name: "Akilan V", role: "Dady", password: "Akilan@2026", photo: "/akilan.jpg", gender: "Male", about: "Family member" },
  { name: "Rithish N", role: "Naina", password: "rishish@2026", photo: "/rithish.jpg", gender: "Male", about: "Family member" },
  { name: "Khavin Balaji T", role: "Son", password: "khavin@2026", photo: "/khavin.jpg", gender: "Male", about: "Family member" },
  { name: "Muguthanraj T", role: "Marumagal", password: "muguthan@2026", photo: "/muguthanraj.jpg", gender: "Male", about: "Family member" },
  { name: "Kannadhasan K", role: "Thatha", password: "kanna@2026", photo: "/kannadhasan.jpg", gender: "Male", about: "Family admin" },
  { name: "Vishwa M", role: "Son2", password: "vishwa@2026", photo: "/vishwa.jpg", gender: "Male", about: "Family member" }
];

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
const emailFor = (name) => `${slug(name)}@nambafamily.local`;

const created = {};
for (const u of users) {
  const email = emailFor(u.name);
  let record;
  try {
    record = await admin.auth().getUserByEmail(email);
    record = await admin.auth().updateUser(record.uid, { password: u.password, displayName: u.name });
  } catch {
    record = await admin.auth().createUser({ email, password: u.password, displayName: u.name });
  }
  const isAdmin = u.name === "Kannadhasan K";
  await admin.auth().setCustomUserClaims(record.uid, { admin: isAdmin, role: u.role });
  await db.collection("users").doc(record.uid).set({
    name: u.name,
    role: u.role,
    photo: u.photo,
    gender: u.gender,
    about: u.about,
    immutableProfile: true
  }, { merge: true });
  created[u.name] = { uid: record.uid, email };
}

const ids = Object.values(created).map(x => x.uid);
const userNames = Object.keys(created);

const groupId = "family-group";
await db.collection("conversations").doc(groupId).set({
  type: "group",
  title: "Namba Family",
  memberIds: ids,
  createdAt: admin.firestore.FieldValue.serverTimestamp()
}, { merge: true });

for (let i = 0; i < userNames.length; i++) {
  for (let j = i + 1; j < userNames.length; j++) {
    const a = created[userNames[i]];
    const b = created[userNames[j]];
    const id = [a.uid, b.uid].sort().join("_");
    await db.collection("conversations").doc(id).set({
      type: "personal",
      memberIds: [a.uid, b.uid].sort(),
      title: `${userNames[i]} & ${userNames[j]}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

console.log(JSON.stringify(created, null, 2));
console.log("\nUse Kannadhasan K UID as ADMIN_UID for the Vercel admin gate.");