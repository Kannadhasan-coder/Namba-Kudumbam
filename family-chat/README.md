# Namba Family — private family chat

A small, private, violet-themed chat app for your family. Family front-door
code + password, then everyone picks their own photo and logs in with their
own password, then it's one shared chat room with online status, emoji,
and delete-your-own-message. Plus a separate admin dashboard.

No build step — it's plain HTML/CSS/JS, so it deploys to Vercel as-is.

---

## 1. Set up Firebase (free, ~3 minutes)

The chat needs a real-time database. Firebase's free tier is plenty for a
family.

1. Go to **console.firebase.google.com** → **Add project** → give it any
   name (e.g. "namba-family") → finish the wizard (you can turn off Google
   Analytics, it's not needed).
2. In your new project, click **Build → Firestore Database → Create
   database**. Choose a region close to you, start in **production mode**.
3. Click **Build → Authentication → Get started**. On the "Sign-in method"
   tab, enable **Anonymous**. (This is only used behind the scenes so the
   database knows "someone who logged into the app" is talking to it — your
   family never sees a Google/email sign-in screen.)
4. Go to **Project settings** (gear icon) → scroll to **Your apps** → click
   the **</>** (web) icon → register an app (any nickname) → it shows you a
   `firebaseConfig` object.
5. Open **`js/firebase-config.js`** in this project and paste your real
   values in, replacing the `PASTE_YOUR_...` placeholders.
6. Back in Firebase Console → **Firestore Database → Rules** — replace the
   default rules with the contents of **`firestore.rules`** (included in
   this project) and click **Publish**.

That's it — the app is now wired to your database.

---

## 2. Try it locally (optional)

Any static file server works, e.g. with Python:

```
cd family-chat
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

---

## 3. Deploy to Vercel

**Easiest way (no install needed):**
1. Go to **vercel.com** → sign up/log in (free) → **Add New… → Project**.
2. Choose **"Deploy without Git"** / drag-and-drop, and drop this whole
   `family-chat` folder onto the page.
3. Framework preset: **Other**. Leave build command empty, output directory
   as `.` (root). Click **Deploy**.
4. You'll get a live `https://your-app.vercel.app` link in under a minute.

**Or with the CLI**, from inside the `family-chat` folder:

```
npm install -g vercel
vercel login
vercel --prod
```

Either way, re-deploy any time you edit files by dragging the folder again
(or running `vercel --prod` again).

---

## 4. Everyone's logins

| Name | Role | Password |
|---|---|---|
| Akilan | Dady | Akilan@2026 |
| Rithish | Naina | rishish@2026 |
| Khavin | Son | khavin@2026 |
| Muguthan | Marumagal | muguthan@2026 |
| Kanna | Thatha | kanna@2026 |
| Vishwa | Son2 | vishwa@2026 |

Family front door — code `2026`, password `Namba Family`.
Admin dashboard — open the small **"Admin"** link at the bottom of the
front door screen (or visit `your-app.vercel.app/#admin`), code `220977`,
password `Kdhasan@2211`.

### Changing a password later
Passwords are stored in `js/config.js` as SHA-256 hashes, not plain text.
To change one: open the deployed site's browser console and run
`await sha256Hex("your-new-password")`, copy the hash it prints, and paste
it over the matching entry in `js/config.js`. Re-deploy.

---

## How it's built

- **Login flow**: family gate → member photo grid → per-member password.
  All three are checked against SHA-256 hashes (see security note below).
- **Chat**: Firestore `messages` collection, live-synced with `onSnapshot`
  so messages appear instantly for everyone. Only your own messages show a
  **Delete** button.
- **Online status**: each member's tab "heartbeats" a `presence` document
  every 10s; anyone whose heartbeat is under 20s old shows a green dot.
- **Emoji**: the 🙂 button opens a quick-pick panel; emoji-only messages
  render larger, like WhatsApp/iMessage.
- **Admin dashboard**: total messages, who's online, messages per member,
  a rough storage estimate, and a "delete all messages" button.
- **Theme**: deep violet palette, 'Baloo 2' (headings) + 'Inter' (body),
  and a recurring arch/doorway shape (the family photo frame, avatar
  cards, chat bubbles) as the visual signature — "coming home."

## A security note (please read)

This is a fully client-side app with no custom backend — which is what
makes it free and easy to host. That means:

- Passwords are checked in the browser against SHA-256 hashes. This stops
  a casual glance at the source code, but someone determined and technical
  could still find ways around a purely client-side check.
- The Firestore rules require *some* logged-in session, but can't verify
  *which* family member is writing — any of the six could technically post
  as any name if they tried to bypass the UI.
- **Don't reuse these passwords anywhere else**, and treat this as
  "private enough for a family group chat," not bank-grade security. If
  you ever want the stronger version (server checks passwords, issues
  proper per-person tokens), that needs a small backend (e.g. a Firebase
  Cloud Function) — happy to help build that next if you'd like.

## Project structure

```
family-chat/
├── index.html            all screens (gate, member select, chat, admin)
├── css/style.css         violet theme, arch motif, animations
├── js/
│   ├── config.js         member roster + hashed passwords
│   ├── firebase-config.js   ← paste your Firebase keys here
│   ├── hash.js            SHA-256 helper
│   └── app.js             all app logic (routing, chat, presence, admin)
├── assets/
│   ├── family-group.jpg
│   └── avatars/*.jpg
├── firestore.rules       paste into Firebase Console → Firestore → Rules
└── README.md              you are here
```
