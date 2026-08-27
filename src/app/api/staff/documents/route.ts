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

  if (!targetUserId || !fileName) {
    return NextResponse.json({ error: "userId and fileName are required" }, { status: 400 });
  }

  // fileName should only ever be a plain filename the app itself generated
  // (see DocumentManager.tsx / BusinessTaxOrganizer.tsx upload handlers) —
  // reject anything that looks like an attempt to traverse outside this
  // user's own storage folder.
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    return NextResponse.json({ error: "Invalid fileName" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUrl(`${targetUserId}/${fileName}`, 60);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "File not found" }, { status: 404 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
