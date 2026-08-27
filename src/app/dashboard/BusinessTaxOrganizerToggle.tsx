"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BusinessTaxOrganizer from "./BusinessTaxOrganizer";

export default function BusinessTaxOrganizerToggle({
  userId,
  initialIsBusiness,
}: {
  userId: string;
  initialIsBusiness: boolean;
}) {
  const supabase = createClient();
  const [isBusiness, setIsBusiness] = useState(initialIsBusiness);

  async function handleToggle(checked: boolean) {
    setIsBusiness(checked);
    // Self-service update — allowed by the column-level grant on
    // profiles (name/phone/address/is_business only, never status).
    await supabase
      .from("profiles")
      .update({ is_business: checked, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
  }

  return (
    <div className="card" style={{ marginTop: "1.25rem" }}>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={isBusiness}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        Do you need to enter business information? (self-employment, 1099, or business income)
      </label>

      {isBusiness && <BusinessTaxOrganizer userId={userId} />}
    </div>
  );
}
