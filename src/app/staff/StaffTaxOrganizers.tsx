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
  submitted_at: string | null;
  updated_at: string;
  client_email: string;
};

const FILING_STATUS_LABELS: Record<string, string> = {
  single: "Single",
  married_joint: "Married filing jointly",
  married_separate: "Married filing separately",
  head_of_household: "Head of household",
  qualifying_widow: "Qualifying widow(er)",
};

export default function StaffTaxOrganizers() {
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/staff/tax-organizers");
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
      <p className="section-title">Tax organizer responses</p>

      {organizers.length === 0 ? (
        <p style={{ fontSize: "0.9rem", color: "#5f5e5a" }}>
          No clients have started a tax organizer yet.
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
                {org.client_email} — last updated{" "}
                {new Date(org.updated_at).toLocaleDateString()}
              </span>
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
            </div>

            {expandedId === org.id && (
              <div style={{ padding: "0 0 1rem 0", fontSize: "0.85rem" }}>
                <OrganizerDetail responses={org.responses} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function OrganizerDetail({ responses }: { responses: Responses }) {
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
