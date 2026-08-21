import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaffEmail } from "@/lib/staff";
import StaffInvoices from "./StaffInvoices";
import StaffTaxOrganizers from "./StaffTaxOrganizers";

export default async function StaffPage() {
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
          <h1 style={{ fontSize: "1.3rem", margin: 0 }}>Staff — Invoices</h1>
          <p style={{ fontSize: "0.85rem", color: "#5f5e5a", margin: "4px 0 0" }}>
            Signed in as {user.email}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="btn btn-outline" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <StaffInvoices />
      <StaffTaxOrganizers />
    </div>
  );
}
