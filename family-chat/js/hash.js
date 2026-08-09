// Small helper — hashes a string with SHA-256 using the browser's built-in
// Web Crypto API (no library needed) and returns a lowercase hex string.
async function sha256Hex(message) {
  const enc = new TextEncoder().encode(message);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
