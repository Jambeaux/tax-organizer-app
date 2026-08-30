// Turns a Supabase/Postgrest error (or a thrown network error) into a
// message that actually tells the client what happened, instead of always
// blaming "your connection" — which was misleading for session-expired and
// permission errors and made real bugs hard to diagnose from a bug report.
export function getSaveErrorMessage(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const lower = message.toLowerCase();

  if (
    lower.includes("jwt") ||
    lower.includes("session") ||
    lower.includes("token") ||
    code === "PGRST301" ||
    code === "401"
  ) {
    return "Your session expired — please refresh the page and sign in again, then try saving.";
  }

  if (lower.includes("permission") || lower.includes("policy") || code === "42501") {
    return "Couldn't save — you don't have permission to update this. Please contact us if this keeps happening.";
  }

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("timeout") ||
    lower === ""
  ) {
    return "Couldn't save — check your connection and try again.";
  }

  return `Couldn't save: ${message}`;
}
