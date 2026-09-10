import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffEmail } from "@/lib/staff";
import { clientLabel } from "@/lib/clientLabel";
import StaffTaxOrganizers from "../../StaffTaxOrganizers";
import StaffBusinessTaxOrganizers from "../../StaffBusinessTaxOrganizers";
import StaffInvoices from "../../StaffInvoices";
import StaffSignatureRequests from "../../StaffSignatureRequests";
import StaffClientDocuments from "../../StaffClientDocuments";

export default async function StaffClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (!isStaffEmail(user.email)) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { data: targetUserData } = await admin.auth.admin.getUserById(id);
  const targetUser = targetUserData?.user;

  if (!targetUser || isStaffEmail(targetUser.email)) {
    notFound();
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, last_name, status, is_business")
    .eq("user_id", id)
    .maybeSingle();

  const label = clientLabel({
    firstName: profile?.first_name,
    lastName: profile?.last_name,
    email: targetUser.email,
  });

  return (
    <div className="container">
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/staff" style={{ fontSize: "0.85rem" }}>
          &larr; Back to all clients
        </Link>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "0.5rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.3rem", margin: 0 }}>{label}</h1>
            <p style={{ fontSize: "0.85rem", color: "#5f5e5a", margin: "4px 0 0" }}>
              {profile?.is_business ? "Business/self-employed client" : "Individual client"}
              {profile?.status ? ` — ${profile.status}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <StaffTaxOrganizers clientId={id} />
        <StaffBusinessTaxOrganizers clientId={id} />
        <StaffInvoices clientId={id} />
        <StaffSignatureRequests clientId={id} />
        <StaffClientDocuments clientId={id} />
      </div>
    </div>
  );
}
