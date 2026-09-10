import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffEmail } from "@/lib/staff";

// Staff-only: generate a short-lived signed URL to download a specific
// client's document (e.g. a P&L statement uploaded from the business tax
// organizer) without giving staff blanket access to the storage bucket.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isStaffEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");
  const fileName = searchParams.get("fileName");

  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Existing contract, unchanged: userId + fileName -> a short-lived
  // signed download URL for one specific file (used by
  // StaffBusinessTaxOrganizers.tsx for P&L downloads).
  if (fileName) {
    // fileName should only ever be a plain filename the app itself
    // generated (see DocumentManager.tsx / BusinessTaxOrganizer.tsx upload
    // handlers) — reject anything that looks like an attempt to traverse
    // outside this user's own storage folder.
    if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
      return NextResponse.json({ error: "Invalid fileName" }, { status: 400 });
    }

    const { data, error } = await admin.storage
      .from("documents")
      .createSignedUrl(`${targetUserId}/${fileName}`, 60);

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "File not found" }, { status: 404 });
    }

    return NextResponse.json({ url: data.signedUrl });
  }

  // New: userId alone -> the list of "plain" documents for that client,
  // split by who put them there (client upload vs. staff send). Excludes
  // files that already get their own section elsewhere in the staff
  // per-client view (the P&L statement, signature-request documents) so
  // nothing shows up twice.
  const { data: storageFiles, error: listError } = await admin.storage
    .from("documents")
    .list(targetUserId, { sortBy: { column: "created_at", order: "desc" } });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const { data: signatureRows } = await admin
    .from("signature_requests")
    .select("document_name")
    .eq("user_id", targetUserId);
  const signatureFileNames = new Set(
    (signatureRows ?? []).map((r) => r.document_name).filter(Boolean)
  );

  const { data: businessOrganizer } = await admin
    .from("business_tax_organizer_responses")
    .select("responses")
    .eq("user_id", targetUserId)
    .maybeSingle();
  const plFileName =
    (businessOrganizer?.responses as { profitLossStatementFileName?: string } | null)
      ?.profitLossStatementFileName ?? null;

  const { data: documentRows } = await admin
    .from("documents")
    .select("file_name, original_name, uploaded_by, uploaded_by_email, note, created_at")
    .eq("user_id", targetUserId);
  const documentByFileName = new Map((documentRows ?? []).map((d) => [d.file_name, d]));

  const documents = (storageFiles ?? [])
    .filter((f) => f.name !== plFileName && !signatureFileNames.has(f.name))
    .map((f) => {
      const tracked = documentByFileName.get(f.name);
      return {
        fileName: f.name,
        originalName: tracked?.original_name ?? f.name.replace(/^\d+_/, ""),
        uploadedBy: tracked?.uploaded_by ?? "client",
        uploadedByEmail: tracked?.uploaded_by_email ?? null,
        note: tracked?.note ?? null,
        createdAt: tracked?.created_at ?? f.created_at ?? null,
      };
    });

  return NextResponse.json({ documents });
}
