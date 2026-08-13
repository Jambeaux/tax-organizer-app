"use client";

import { useState } from "react";
import DocumentManager from "./DocumentManager";
import SignatureRequests from "./SignatureRequests";
import PaymentRequests from "./PaymentRequests";

export default function PortalDashboard({ userId }: { userId: string }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <DocumentManager
        userId={userId}
        onSignatureRequested={() => setRefreshKey((k) => k + 1)}
      />
      <SignatureRequests userId={userId} refreshKey={refreshKey} />
      <PaymentRequests userId={userId} refreshKey={refreshKey} />
    </>
  );
}
