import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Code was present but exchange failed — usually an expired or
    // already-used sign-in link. Surface a reason instead of silently
    // bouncing back to a blank login form.
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "That sign-in link has expired or was already used. Please request a new one."
      )}`
    );
  }

  // No code at all — the request never reached us as a valid sign-in
  // callback. Most often this means the URL Supabase redirected to isn't
  // on the project's allowed Redirect URLs list, so it fell back to the
  // Site URL instead of completing the sign-in.
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "We couldn't complete your sign-in. Please request a new link — if this keeps happening, let us know."
    )}`
  );
}
