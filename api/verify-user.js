// Vercel serverless function — checks which avatar was clicked + the typed
// password against the real family member list, which lives only here on
// the server. The browser never receives anyone's password.

const FAMILY_MEMBERS = {
  photo1: { name: 'Akilan',   role: 'Dady',      password: 'Akilan@2026',   photo: 'assets/photo1.png' },
  photo2: { name: 'Rithish',  role: 'Naina',     password: 'rishish@2026',  photo: 'assets/photo2.png' },
  photo3: { name: 'Khavin',   role: 'Son',       password: 'khavin@2026',   photo: 'assets/photo3.png' },
  photo4: { name: 'Muguthan', role: 'Marumagal', password: 'muguthan@2026', photo: 'assets/photo4.png' },
  photo5: { name: 'Kanna',    role: 'Thatha',    password: 'kanna@2026',    photo: 'assets/photo5.png' },
  photo6: { name: 'Vishwa',   role: 'Son2',      password: 'vishwa@2026',   photo: 'assets/photo6.png' },
};

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { id, password } = req.body || {};
  const member = FAMILY_MEMBERS[id];

  if (member && password === member.password) {
    return res.status(200).json({
      success: true,
      user: { id, name: member.name, role: member.role, photo: member.photo }
    });
  }

  return res.status(401).json({ success: false });
};
