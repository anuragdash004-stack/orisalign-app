/**
 * Shared contact-detail validation used by the booking flow on both the
 * client (instant inline feedback) and the server (cannot be bypassed).
 *
 * These are pure functions with no Node/browser dependencies so they can be
 * imported from either side. The deeper "does this email domain actually
 * exist" MX/DNS check lives server-side only (see the API routes), since it
 * needs the `dns` module.
 *
 * Each validator returns an error message string when the value looks fake,
 * or `null` when it passes.
 */

export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  // Strip a country code / trunk prefix so "+91", "91", "0" variants all match.
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export function validateName(raw: string): string | null {
  const n = (raw || "").trim();
  if (n.length < 2) return "Please enter your full name.";
  const letters = n.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 2) return "Please enter a valid name.";
  // Reject gibberish made of a single repeated letter, e.g. "hh", "aaa".
  if (new Set(letters.toLowerCase()).size < 2) return "Please enter a valid name.";
  return null;
}

export function validatePhone(raw: string): string | null {
  const d = normalizePhone(raw);
  if (d.length !== 10) return "Please enter a valid 10-digit mobile number.";
  if (!/^[6-9]/.test(d)) return "Please enter a real mobile number (it should start with 6, 7, 8 or 9).";
  // All identical digits — e.g. 9999999999.
  if (/^(\d)\1{9}$/.test(d)) return "Please enter a real mobile number.";
  // Straight ascending / descending runs — e.g. 1234567890.
  if ("0123456789".includes(d) || "9876543210".includes(d)) return "Please enter a real mobile number.";
  // Too little variety across 10 digits — e.g. 8989890989 (only 3 distinct).
  if (new Set(d).size < 4) return "Please enter a real mobile number.";
  return null;
}

export function validateEmail(raw: string): string | null {
  const e = (raw || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return "Please enter a valid email address.";
  return null;
}
