// Simple email allowlist for staff access — no separate role table, just
// a comma-separated list of JLB Tax staff emails in an environment
// variable. Add or remove staff by editing STAFF_EMAILS in Vercel and
// redeploying.

function getStaffEmails(): string[] {
  return (process.env.STAFF_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isStaffEmail(email?: string | null): boolean {
  if (!email) return false;
  return getStaffEmails().includes(email.toLowerCase());
}
