"use client";

import { useState } from "react";
import DocumentManager from "./DocumentManager";
import SignatureRequests from "./SignatureRequests";
import PaymentRequests from "./PaymentRequests";
import TaxOrganizer from "./TaxOrganizer";
import BusinessTaxOrganizerToggle from "./BusinessTaxOrganizerToggle";
import type { Profile } from "@/lib/profile";

export default function PortalDashboard({
  userId,
  profile,
}: {
  userId: string;
  profile: Profile;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <div className="card">
        <p className="section-title">Need to talk something through?</p>
        <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
          Book a free consultation with our team — virtual or in person —
          and we&apos;ll help you figure out next steps.
        </p>
        <a
          href="https://calendly.com/jbooker3-jlbtax/30min"
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
        >
          Book a Free Consultation
        </a>
      </div>

      <DocumentManager userId={userId} />
      <SignatureRequests userId={userId} refreshKey={refreshKey} />
      <PaymentRequests userId={userId} refreshKey={refreshKey} />
      <TaxOrganizer userId={userId} />
      <BusinessTaxOrganizerToggle userId={userId} initialIsBusiness={profile.is_business} />
    </>
  );
}
