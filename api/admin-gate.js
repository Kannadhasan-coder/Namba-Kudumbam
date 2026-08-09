export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const { code, password } = req.body || {};
  const valid = code === process.env.ADMIN_CODE && password === process.env.ADMIN_PASSWORD;
  if (!valid) return res.status(401).json({ ok: false, message: "Admin code or password is incorrect." });

  res.setHeader(
    "Set-Cookie",
    `nf_admin_gate=1; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 4}`
  );
  return res.status(200).json({ ok: true, adminUid: process.env.ADMIN_UID || null });
}