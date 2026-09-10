import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Runs the client's own document delete server-side (still scoped to
// their own "<userId>/..." folder — same access as before, just routed
// through a server route now) so the matching row in the `documents`
// tracking table gets cleaned up too, not just the storage object.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { fileName } = await request.json();

  if (typeof fileName !== "string" || !fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    return NextResponse.json({ error: "Invalid fileName" }, { status: 400 });
  }

  const { error } = await supabase.storage
    .from("documents")
    .remove([`${user.id}/${fileName}`]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const admin = createAdminClient();
  await admin.from("documents").delete().eq("user_id", user.id).eq("file_name", fileName);

  return NextResponse.json({ ok: true });
}
