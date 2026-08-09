// Vercel serverless function — verifies the admin code + password server-side.

const ADMIN_CODE = process.env.ADMIN_CODE || "220977";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Kdhasan@2211";

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { code, password } = req.body || {};

  if (code === ADMIN_CODE && password === ADMIN_PASSWORD) {
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ success: false });
};
