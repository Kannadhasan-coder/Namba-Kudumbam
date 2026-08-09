// Vercel serverless function — runs on the server, never in the browser.
// Keeps the real family code/password out of the JS bundle that gets shipped
// to visitors. You can move these two values into Vercel Environment
// Variables later (Project Settings > Environment Variables) without
// changing any other file.

const FAMILY_CODE = process.env.FAMILY_CODE || "2026";
const FAMILY_PASSWORD = process.env.FAMILY_PASSWORD || "NambaFamily";

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { code, password } = req.body || {};

  if (code === FAMILY_CODE && password === FAMILY_PASSWORD) {
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ success: false });
};
