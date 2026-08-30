"use client";

import { useEffect, useState } from "react";
import {
  EXPENSE_LINE_ITEMS,
  VEHICLE_EXPENSE_ITEMS,
  type BusinessResponses,
} from "@/app/dashboard/BusinessTaxOrganizer";
import { clientLabel } from "@/lib/clientLabel";

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
  client_first_name: string | null;
  client_last_name: string | null;
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

function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
                {clientLabel({
                  firstName: org.client_first_name,
                  lastName: org.client_last_name,
                  email: org.client_email,
                })}
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
                <BusinessOrganizerDetail responses={org.responses} userId={org.user_id} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <strong>{label}:</strong> {value}
    </div>
  );
}

function BusinessOrganizerDetail({
  responses,
  userId,
}: {
  responses: BusinessResponses;
  userId: string;
}) {
  const [plUrlState, setPlUrlState] = useState<"idle" | "loading" | "error">("idle");

  async function openProfitLoss() {
    if (!responses.profitLossStatementFileName) return;
    setPlUrlState("loading");
    const res = await fetch(
      `/api/staff/documents?userId=${encodeURIComponent(userId)}&fileName=${encodeURIComponent(
        responses.profitLossStatementFileName
      )}`
    );
    const body = await res.json().catch(() => ({}));
    setPlUrlState(res.ok ? "idle" : "error");
    if (res.ok && body.url) {
      window.open(body.url, "_blank");
    }
  }

  const filledExpenses = EXPENSE_LINE_ITEMS.filter(
    (item) => toNumber(responses.expenses?.[item.key]) > 0
  );
  const filledMiscExpenses = (responses.miscExpenses ?? []).filter(
    (item) => toNumber(item.amount) > 0
  );
  const totalExpenses =
    EXPENSE_LINE_ITEMS.reduce((sum, item) => sum + toNumber(responses.expenses?.[item.key]), 0) +
    filledMiscExpenses.reduce((sum, item) => sum + toNumber(item.amount), 0);

  const grossIncome =
    toNumber(responses.grossReceiptsSales) -
    (toNumber(responses.returnsAllowances) + toNumber(responses.costOfGoodsSold));

  const hasVehicleInfo = !!(responses.vehicleYear || responses.vehicleMake || responses.vehicleModel);
  const filledVehicleExpenses = VEHICLE_EXPENSE_ITEMS.filter(
    (item) => toNumber(responses.vehicleExpenses?.[item.key]) > 0
  );
  const totalVehicleExpenses =
    VEHICLE_EXPENSE_ITEMS.reduce((sum, item) => sum + toNumber(responses.vehicleExpenses?.[item.key]), 0) +
    toNumber(responses.vehicleOther1Amount) +
    toNumber(responses.vehicleOther2Amount) +
    toNumber(responses.vehicleOther3Amount);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <p style={{ fontWeight: 600, margin: "0.25rem 0 0" }}>About the business</p>
      <Field label="Proprietor" value={responses.proprietorName} />
      <Field label="Principal business/profession" value={responses.principalBusiness} />
      <Field label="Business name" value={responses.businessName} />
      <Field label="Business type" value={ENTITY_TYPE_LABELS[responses.entityType]} />
      <Field label="EIN" value={responses.ein} />
      <Field
        label="Address"
        value={
          [responses.businessAddress, responses.city, responses.state, responses.zip]
            .filter(Boolean)
            .join(", ") || undefined
        }
      />
      <Field label="Years owned" value={responses.yearsOwned} />
      <Field label="Records maintained by" value={responses.recordsMaintainer} />
      <Field label="Separate business bank account" value={responses.separateBankAccounts} />
      <Field label="Has 1099-NEC forms" value={responses.has1099NEC} />
      <Field label="Made payments requiring a 1099" value={responses.madePayments1099} />
      <Field label="Filed required 1099 forms" value={responses.filedRequiredForms} />
      <Field label="Home-based business" value={responses.homeBased} />

      <p style={{ fontWeight: 600, margin: "0.5rem 0 0" }}>Income</p>
      <Field label="Has P&L statement" value={responses.hasProfitLossStatement} />
      {responses.profitLossStatementFileName && (
        <div>
          <strong>P&amp;L uploaded:</strong>{" "}
          <button
            type="button"
            onClick={openProfitLoss}
            disabled={plUrlState === "loading"}
            className="btn btn-outline"
            style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem", marginLeft: "0.25rem" }}
          >
            {plUrlState === "loading"
              ? "Opening..."
              : `Download ${responses.profitLossStatementFileName.replace(/^\d+_PL_/, "")}`}
          </button>
          {plUrlState === "error" && (
            <span style={{ color: "#a32d2d", marginLeft: "0.5rem" }}>Couldn&apos;t open file</span>
          )}
        </div>
      )}
      <Field label="Gross receipts and sales" value={responses.grossReceiptsSales && `$${responses.grossReceiptsSales}`} />
      <Field label="Returns and allowances" value={responses.returnsAllowances && `$${responses.returnsAllowances}`} />
      <Field label="Cost of goods sold" value={responses.costOfGoodsSold && `$${responses.costOfGoodsSold}`} />
      {(responses.grossReceiptsSales || responses.returnsAllowances || responses.costOfGoodsSold) && (
        <div>
          <strong>Computed gross income:</strong> ${formatMoney(grossIncome)}
        </div>
      )}

      <p style={{ fontWeight: 600, margin: "0.5rem 0 0" }}>Expenses</p>
      {filledExpenses.length || filledMiscExpenses.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          {filledExpenses.map((item) => (
            <div key={item.key} style={{ display: "flex", justifyContent: "space-between", maxWidth: 360 }}>
              <span>{item.label}</span>
              <span>${responses.expenses[item.key]}</span>
            </div>
          ))}
          {filledMiscExpenses.map((item, index) => (
            <div key={`misc-${index}`} style={{ display: "flex", justifyContent: "space-between", maxWidth: 360 }}>
              <span>{item.description || "(no description)"}</span>
              <span>${item.amount}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              maxWidth: 360,
              fontWeight: 700,
              borderTop: "1px solid var(--gray)",
              paddingTop: "0.25rem",
            }}
          >
            <span>Total</span>
            <span>${formatMoney(totalExpenses)}</span>
          </div>
        </div>
      ) : (
        <p style={{ color: "#5f5e5a", margin: 0 }}>No expense amounts entered</p>
      )}
      {responses.expenseNotes && <div>Expense notes: {responses.expenseNotes}</div>}

      {(filledVehicleExpenses.length > 0 || responses.totalMilesDriven || hasVehicleInfo) && (
        <>
          <p style={{ fontWeight: 600, margin: "0.5rem 0 0" }}>Auto expense worksheet</p>
          <Field
            label="Vehicle"
            value={
              [responses.vehicleYear, responses.vehicleMake, responses.vehicleModel]
                .filter(Boolean)
                .join(" ") || undefined
            }
          />
          <Field label="Date placed in service" value={responses.vehicleDatePlacedInService} />
          <Field label="Total miles driven" value={responses.totalMilesDriven} />
          <Field label="Business miles" value={responses.businessMiles} />
          <Field label="Commuting miles" value={responses.commutingMiles} />
          <Field label="Other miles" value={responses.otherMiles} />
          {filledVehicleExpenses.map((item) => (
            <div key={item.key} style={{ display: "flex", justifyContent: "space-between", maxWidth: 360 }}>
              <span>{item.label}</span>
              <span>${responses.vehicleExpenses[item.key]}</span>
            </div>
          ))}
          {responses.vehicleOther1Label && (
            <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 360 }}>
              <span>{responses.vehicleOther1Label}</span>
              <span>${responses.vehicleOther1Amount}</span>
            </div>
          )}
          {responses.vehicleOther2Label && (
            <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 360 }}>
              <span>{responses.vehicleOther2Label}</span>
              <span>${responses.vehicleOther2Amount}</span>
            </div>
          )}
          {responses.vehicleOther3Label && (
            <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 360 }}>
              <span>{responses.vehicleOther3Label}</span>
              <span>${responses.vehicleOther3Amount}</span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              maxWidth: 360,
              fontWeight: 700,
              borderTop: "1px solid var(--gray)",
              paddingTop: "0.25rem",
            }}
          >
            <span>Total vehicle expenses</span>
            <span>${formatMoney(totalVehicleExpenses)}</span>
          </div>
        </>
      )}

      <p style={{ fontWeight: 600, margin: "0.5rem 0 0" }}>Employees</p>
      <Field label="Has employees" value={responses.hasEmployees} />

      {responses.additionalNotes && (
        <div>
          <strong>Additional notes:</strong> {responses.additionalNotes}
        </div>
      )}
    </div>
  );
}
