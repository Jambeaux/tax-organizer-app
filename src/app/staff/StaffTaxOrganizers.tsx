"use client";

import { useEffect, useState } from "react";
import {
  INCOME_FIELDS,
  DEDUCTION_FIELDS,
  LIFE_CHANGE_FIELDS,
  type Responses,
} from "@/app/dashboard/TaxOrganizer";

type OrganizerRow = {
  id: string;
  user_id: string;
  status: string;
  responses: Responses;
  needs_attention: boolean;
  attention_notes: string | null;
  submitted_at: string | null;
  updated_at: string;
  client_email: string;
  client_name: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
};

const FILING_STATUS_LABELS: Record<string, string> = {
  single: "Single",
  married_joint: "Married filing jointly",
  married_separate: "Married filing separately",
  head_of_household: "Head of household",
  qualifying_widow: "Qualifying widow(er)",
};

// Shows one client's tax organizer. Reuses the existing (all-clients)
// /api/staff/tax-organizers route and filters client-side to this one
// user, rather than adding a query-param mode to that route.
export default function StaffTaxOrganizers({ clientId }: { clientId: string }) {
  const [organizer, setOrganizer] = useState<OrganizerRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch("/api/staff/tax-organizers");
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      const organizers: OrganizerRow[] = body.organizers ?? [];
      setOrganizer(organizers.find((o) => o.user_id === clientId) ?? null);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>Loading...</p>;
  }

  return (
    <div className="card">
      <p className="section-title">Tax organizer</p>

      {!organizer ? (
        <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>
          This client hasn&apos;t started a tax organizer yet.
        </p>
      ) : (
        <div style={{ fontSize: "0.85rem" }}>
          <div
            className="doc-row"
            style={{ borderBottom: "none", paddingBottom: "0.5rem" }}
          >
            <span>Last updated {new Date(organizer.updated_at).toLocaleDateString()}</span>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: organizer.status === "submitted" ? "#047E20" : "#cc9900",
                textTransform: "capitalize",
              }}
            >
              {organizer.status === "submitted" ? "Submitted" : "Draft"}
            </span>
          </div>

          {organizer.needs_attention && (
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
              {organizer.attention_notes && <div>{organizer.attention_notes}</div>}
            </div>
          )}

          <OrganizerDetail responses={organizer.responses} />
        </div>
      )}
    </div>
  );
}

export function OrganizerDetail({ responses }: { responses: Responses }) {
  const checkedIncome = INCOME_FIELDS.filter((f) => responses.income?.[f.key]);
  const checkedDeductions = DEDUCTION_FIELDS.filter((f) => responses.deductions?.[f.key]);
  const checkedLifeChanges = LIFE_CHANGE_FIELDS.filter((f) => responses.lifeChanges?.[f.key]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <strong>Filing status:</strong>{" "}
        {FILING_STATUS_LABELS[responses.filingStatus] || "Not answered"}
      </div>

      {responses.occupation && (
        <div>
          <strong>Occupation:</strong> {responses.occupation}
        </div>
      )}

      {(responses.spouseName || responses.spouseOccupation) && (
        <div>
          <strong>Spouse:</strong> {responses.spouseName || "—"}
          {responses.spouseOccupation ? ` (${responses.spouseOccupation})` : ""}
        </div>
      )}

      {responses.nameOrAddressChange && (
        <div>
          <strong>Name/address changes:</strong> {responses.nameOrAddressChange}
        </div>
      )}

      <div>
        <strong>Dependents:</strong>{" "}
        {responses.dependents?.length ? (
          <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.2rem" }}>
            {responses.dependents.map((dep, i) => (
              <li key={i}>
                {dep.name || "Unnamed"} — {dep.relationship || "?"}, born{" "}
                {dep.dob || "?"}, lived with client {dep.monthsLivedWithYou || "?"}{" "}
                months
              </li>
            ))}
          </ul>
        ) : (
          "None listed"
        )}
      </div>

      <div>
        <strong>Income sources:</strong>{" "}
        {checkedIncome.length ? checkedIncome.map((f) => f.label).join(", ") : "None checked"}
        {responses.incomeNotes && <div>Notes: {responses.incomeNotes}</div>}
      </div>

      <div>
        <strong>Deductions/credits:</strong>{" "}
        {checkedDeductions.length
          ? checkedDeductions.map((f) => f.label).join(", ")
          : "None checked"}
        {responses.deductionNotes && <div>Notes: {responses.deductionNotes}</div>}
      </div>

      <div>
        <strong>Life changes:</strong>{" "}
        {checkedLifeChanges.length
          ? checkedLifeChanges.map((f) => f.label).join(", ")
          : "None checked"}
        {responses.lifeChangeNotes && <div>Notes: {responses.lifeChangeNotes}</div>}
      </div>

      {responses.additionalNotes && (
        <div>
          <strong>Additional notes:</strong> {responses.additionalNotes}
        </div>
      )}
    </div>
  );
}
