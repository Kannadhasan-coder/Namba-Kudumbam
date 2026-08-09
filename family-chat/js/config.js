// ============================================================================
// Namba Family — app configuration
// ----------------------------------------------------------------------------
// Passwords are never stored as plain text here — only their SHA-256 hashes.
// hash.js has a small helper (sha256Hex) used at login time to compare.
//
// IMPORTANT — read before you deploy:
// This is a fully client-side app. Anyone who opens dev tools can read this
// file, so these hashes stop a casual "guess and peek" from a browser tab,
// but they are NOT a substitute for real server-side auth. For a family
// group chat that's a reasonable trade-off; don't reuse these passwords
// anywhere sensitive. See README.md for the Firestore security rules that
// back this up on the database side.
// ============================================================================

const APP_NAME = "Namba Family";

// The "front door" — required before anyone sees the member list.
const FAMILY_GATE = {
  codeHash: "158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab",     // 2026
  passwordHash: "ff9819c1a13ed1ba1c22a5a19cdf6a85d668f52fa13ffc763d762cde8e89a233" // Namba Family
};

// Each family member's own login. avatar paths are relative to index.html.
const MEMBERS = [
  { id: "akilan",   name: "Akilan",   role: "Dady",     avatar: "assets/avatars/akilan.jpg",   passwordHash: "ff2754ec72ff10db437e6d97f2a50e20fc89b427cd6d39f4332de98b7f8a4875" },
  { id: "rithish",  name: "Rithish",  role: "Naina",    avatar: "assets/avatars/rithish.jpg",  passwordHash: "617be4ea059fb70be4162438811daff9691d26edcb9792473fe4ddeb3807b757" },
  { id: "khavin",   name: "Khavin",   role: "Son",      avatar: "assets/avatars/khavin.jpg",   passwordHash: "0268e59aa01c70e14f2f5352fabf767a2b2403530ae7f677f50011e245a828a3" },
  { id: "muguthan", name: "Muguthan", role: "Marumagal",avatar: "assets/avatars/muguthan.jpg", passwordHash: "997a646cb8b8cc337101b52b411fdd58031210036283ede4a9e23047fe2714fb" },
  { id: "kanna",    name: "Kanna",    role: "Thatha",   avatar: "assets/avatars/kanna.jpg",    passwordHash: "dc30d9baf5caf4ab09cfe8336b576dcdebebb7acc8217d42f7fc1cb3f0c1e826" },
  { id: "vishwa",   name: "Vishwa",   role: "Son2",     avatar: "assets/avatars/vishwa.jpg",   passwordHash: "3f462ab5f4a26d41813d928bfb8dea4ea18866ee95a496fd7f5d6ab82682baf0" }
];

// Admin dashboard — separate from family members, reached via the small
// "Admin" link at the bottom of the gate screen (or by opening #admin).
const ADMIN = {
  codeHash: "c8356ca0b94a50e46ee0c3c6c1ddc3cd3a9672df81dd56516d2e3db42f962838",     // 220977
  passwordHash: "11527ef5afaaddf197d184ba74c0cfd5b73f94c1c75a33c4bd4222645a6513ac" // Kdhasan@2211
};

// Quick-pick emoji for the composer panel.
const EMOJI_SET = [
  "😀","😂","🥰","😍","😎","🤩","😊","😇","🙃","😉",
  "🥲","😢","😭","😡","🤔","😴","🤗","🥳","😅","🙌",
  "👍","👎","🙏","👏","💪","🫶","❤️","🧡","💛","💚",
  "💙","💜","🔥","✨","🎉","🎂","🍛","🍚","☕","🌙"
];
