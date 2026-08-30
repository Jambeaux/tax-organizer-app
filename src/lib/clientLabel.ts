// Builds the "Last, First — email" label used across the staff pages.
// Falls back gracefully if only one name part is filled in yet, or none
// at all (a client who hasn't reached the personal info section of the
// tax organizer only has an email to show).
export function clientLabel({
  firstName,
  lastName,
  email,
}: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const first = firstName?.trim();
  const last = lastName?.trim();

  let namePart = "";
  if (last && first) namePart = `${last}, ${first}`;
  else if (last) namePart = last;
  else if (first) namePart = first;

  if (namePart && email) return `${namePart} — ${email}`;
  return namePart || email || "Unknown";
}
