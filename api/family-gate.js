export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const { code, password } = req.body || {};
  const valid = code === process.env.FAMILY_CODE && password === process.env.FAMILY_PASSWORD;
  if (!valid) return res.status(401).json({ ok: false, message: "Family code or password is incorrect." });

  res.setHeader(
    "Set-Cookie",
    `nf_gate=1; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}`
  );
  return res.status(200).json({ ok: true });
}