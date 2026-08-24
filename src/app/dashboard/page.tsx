import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaffEmail } from "@/lib/staff";
import { getOrCreateProfile } from "@/lib/profile";
import PortalDashboard from "./PortalDashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const staff = isStaffEmail(user.email);
  const profile = await getOrCreateProfile(user.id, user.email ?? "");

  return (
    <div className="container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.3rem", margin: 0 }}>Your documents</h1>
          <p style={{ fontSize: "0.85rem", color: "#5f5e5a", margin: "4px 0 0" }}>
            Signed in as {user.email}
          </p>
          {staff && (
            <p style={{ fontSize: "0.8rem", margin: "6px 0 0" }}>
              <a href="/staff">Go to staff dashboard →</a>
            </p>
          )}
        </div>
        <form action="/auth/signout" method="post">
          <button className="btn btn-outline" type="submit">
            Sign out
          </button>
        </form>
      </div>

      {!staff && profile.status === "pending" ? (
        <div className="card">
          <p className="section-title">Thanks for signing up</p>
          <p style={{ fontSize: "0.9rem" }}>
            We&apos;re reviewing your new account — this is just a quick
            check to make sure everything&apos;s in order. You&apos;ll have
            full access to your dashboard as soon as a member of our team
            approves it, usually within one business day.
          </p>
          <p style={{ fontSize: "0.85rem", color: "#5f5e5a" }}>
            Expecting faster access, or think this is taking too long?
            Reach out at{" "}
            <a href="mailto:info@jlbtax.com">info@jlbtax.com</a> or{" "}
            <a href="tel:+13188209549">(318) 820-9549</a>.
          </p>
        </div>
      ) : (
        <PortalDashboard userId={user.id} profile={profile} />
      )}
    </div>
  );
}
