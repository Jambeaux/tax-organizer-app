"use client";

import { useEffect, useState } from "react";
import { EXPENSE_FIELDS, type BusinessResponses } from "@/app/dashboard/BusinessTaxOrganizer";

type OrganizerRow = {
  id: string;
  user_id: string;
  status: string;
  responses: BusinessResponses;
  needs_attention: boolean;
  attention_notes: string | null;
  submitted_at: string | null;
  updated_at: string;
  client_email: string;
  client_name: string | null;
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  sole_proprietor: "Sole proprietor / self-employed",
  single_member_llc: "Single-member LLC",
  multi_member_llc: "Multi-member LLC",
  s_corp: "S-corporation",
  c_corp: "C-corporation",
  partnership: "Partnership",
  not_sure: "Not sure",
};

export default function StaffBusinessTaxOrganizers() {
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/staff/business-tax-organizers");
      const body = await res.json().catch(() => ({}));
      setOrganizers(body.organizers ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>Loading...</p>;
  }

  return (
    <div className="card" style={{ marginTop: "1.25rem" }}>
      <p className="section-title">Business tax organizer responses</p>

      {organizers.length === 0 ? (
        <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>
          No clients have started a business tax organizer yet.
        </p>
      ) : (
        organizers.map((org) => (
          <div key={org.id} style={{ borderBottom: "1px solid var(--gray)" }}>
            <div
              className="doc-row"
              style={{ cursor: "pointer", borderBottom: "none" }}
              onClick={() => setExpandedId(expandedId === org.id ? null : org.id)}
            >
              <span>
                {org.client_name ? `${org.client_name} — ${org.client_email}` : org.client_email}
                {" — last updated "}
                {new Date(org.updated_at).toLocaleDateString()}
              </span>
              <span style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                {org.needs_attention && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#a32d2d",
                      border: "1px solid #a32d2d",
                      borderRadius: "4px",
                      padding: "0.1rem 0.4rem",
                    }}
                  >
                    Needs attention
                  </span>
                )}
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: org.status === "submitted" ? "#047E20" : "#cc9900",
                    textTransform: "capitalize",
                  }}
                >
                  {org.status === "submitted" ? "Submitted" : "Draft"}
                </span>
              </span>
            </div>

            {expandedId === org.id && (
              <div style={{ padding: "0 0 1rem 0", fontSize: "0.85rem" }}>
                {org.needs_attention && (
                  <div
                    style={{
                      background: "#fdf1f1",
                      border: "1px solid #a32d2d",
                      borderRadius: "6px",
                      padding: "0.6rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <strong>Client flagged this as needing extra attention.</strong>
                    {org.attention_notes && <div>{org.attention_notes}</div>}
                  </div>
                )}
                <BusinessOrganizerDetail responses={org.responses} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function BusinessOrganizerDetail({ responses }: { responses: BusinessResponses }) {
  const checkedExpenses = EXPENSE_FIELDS.filter((f) => responses.expenses?.[f.key]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <strong>Business name:</strong> {responses.businessName || "Not answered"}
      </div>

      <div>
        <strong>Business type:</strong>{" "}
        {ENTITY_TYPE_LABELS[responses.entityType] || "Not answered"}
      </div>

      {responses.natureOfBusiness && (
        <div>
          <strong>Nature of business:</strong> {responses.natureOfBusiness}
        </div>
      )}

      {responses.yearStarted && (
        <div>
          <strong>Year started:</strong> {responses.yearStarted}
        </div>
      )}

      {responses.ein && (
        <div>
          <strong>EIN:</strong> {responses.ein}
        </div>
      )}

      <div>
        <strong>Has a P&amp;L statement:</strong>{" "}
        {responses.hasProfitLossStatement || "Not answered"}
      </div>

      {responses.grossReceipts && (
        <div>
          <strong>Approximate income:</strong> {responses.grossReceipts}
        </div>
      )}

      <div>
        <strong>Expense categories:</strong>{" "}
        {checkedExpenses.length ? checkedExpenses.map((f) => f.label).join(", ") : "None checked"}
        {responses.expenseNotes && <div>Notes: {responses.expenseNotes}</div>}
      </div>

      <div>
        <strong>Has employees:</strong> {responses.hasEmployees || "Not answered"}
      </div>

      <div>
        <strong>Paid contractors $600+:</strong> {responses.issuedForms1099 || "Not answered"}
      </div>

      {responses.additionalNotes && (
        <div>
          <strong>Additional notes:</strong> {responses.additionalNotes}
        </div>
      )}
    </div>
  );
}
