// Every upload route builds a Storage object key as
// `${userId}/${Date.now()}_${file.name}` using the filename the browser
// reports for the selected file — which is attacker-controlled input (a
// client, or a staff member, can rename a file to anything before
// picking it). Supabase Storage keys are opaque strings, not resolved
// like filesystem paths, so a crafted name can't actually escape the
// `${userId}/` prefix the way `../../` would on a real filesystem — but
// slashes in the name still produce confusing nested "folders" inside a
// user's own prefix, and defense-in-depth is cheap here. This keeps just
// the basename and strips anything that looks like a directory
// separator or a `..` segment before it's used to build a key, matching
// the same rejection already applied to the userId+fileName download
// route in src/app/api/staff/documents/route.ts.
export function sanitizeFileName(name: string): string {
  const basename = name.split(/[/\\]/).pop() || "file";
  const cleaned = basename.replace(/\.\.+/g, "_").trim();
  return cleaned || "file";
}
