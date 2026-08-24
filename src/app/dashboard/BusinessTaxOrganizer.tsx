"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ExpenseFlags = {
  advertising: boolean;
  suppliesEquipment: boolean;
  rentLease: boolean;
  utilities: boolean;
  vehicleMileage: boolean;
  contractLabor: boolean;
  insurance: boolean;
  homeOffice: boolean;
  otherExpenses: boolean;
};

export type BusinessResponses = {
  businessName: string;
  entityType: string;
  ein: string;
  natureOfBusiness: string;
  yearStarted: string;
  hasProfitLossStatement: string;
  grossReceipts: string;
  expenses: ExpenseFlags;
  expenseNotes: string;
  hasEmployees: string;
  issuedForms1099: string;
  additionalNotes: string;
};

const EMPTY_BUSINESS_RESPONSES: BusinessResponses = {
  businessName: "",
  entityType: "",
  ein: "",
  natureOfBusiness: "",
  yearStarted: "",
  hasProfitLossStatement: "",
  grossReceipts: "",
  expenses: {
    advertising: false,
    suppliesEquipment: false,
    rentLease: false,
    utilities: false,
    vehicleMileage: false,
    contractLabor: false,
    insurance: false,
    homeOffice: false,
    otherExpenses: false,
  },
  expenseNotes: "",
  hasEmployees: "",
  issuedForms1099: "",
  additionalNotes: "",
};

export const EXPENSE_FIELDS: { key: keyof ExpenseFlags; label: string }[] = [
  { key: "advertising", label: "Advertising / marketing" },
  { key: "suppliesEquipment", label: "Supplies or equipment" },
  { key: "rentLease", label: "Rent or lease (space, chair, booth, etc.)" },
  { key: "utilities", label: "Utilities" },
  { key: "vehicleMileage", label: "Vehicle / mileage" },
  { key: "contractLabor", label: "Contract labor" },
  { key: "insurance", label: "Business insurance" },
  { key: "homeOffice", label: "Home office use" },
  { key: "otherExpenses", label: "Other business expenses" },
];

export default function BusinessTaxOrganizer({ userId }: { userId: string }) {
  const supabase = createClient();
  const [responses, setResponses] = useState<BusinessResponses>(EMPTY_BUSINESS_RESPONSES);
  const [status, setStatus] = useState<string>("draft");
  const [needsAttention, setNeedsAttention] = useState(false);
  const [attentionNotes, setAttentionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("business_tax_organizer_responses")
        .select("responses, status, needs_attention, attention_notes")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        setResponses({ ...EMPTY_BUSINESS_RESPONSES, ...(data.responses as Partial<BusinessResponses>) });
        setStatus(data.status);
        setNeedsAttention(!!data.needs_attention);
        setAttentionNotes(data.attention_notes ?? "");
      }
      skipNextSave.current = true;
      setLoading(false);
    }
    load();
  }, [supabase, userId]);

  useEffect(() => {
    if (loading) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("business_tax_organizer_responses")
        .upsert(
          {
            user_id: userId,
            responses,
            needs_attention: needsAttention,
            attention_notes: attentionNotes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      setSaveState(error ? "error" : "saved");
    }, 1000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses, needsAttention, attentionNotes]);

  function updateField<K extends keyof BusinessResponses>(key: K, value: BusinessResponses[K]) {
    setResponses((prev) => ({ ...prev, [key]: value }));
  }

  function toggleExpense(key: keyof ExpenseFlags, checked: boolean) {
    setResponses((prev) => ({ ...prev, expenses: { ...prev.expenses, [key]: checked } }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    const { error } = await supabase.from("business_tax_organizer_responses").upsert(
      {
        user_id: userId,
        responses,
        needs_attention: needsAttention,
        attention_notes: attentionNotes,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setSubmitting(false);
    if (!error) setStatus("submitted");
  }

  if (loading) return null;

  return (
    <div className="card" style={{ marginTop: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <p style={{ fontWeight: 600, fontSize: "0.95rem", margin: 0 }}>
          Business tax organizer
        </p>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: status === "submitted" ? "#047E20" : "#cc9900",
            textTransform: "capitalize",
          }}
        >
          {status === "submitted" ? "Submitted" : "Draft"}
        </span>
      </div>

      <p style={{ fontSize: "0.8rem", color: "#5f5e5a", marginTop: 0 }}>
        For self-employment, 1099, or business income — separate from your
        personal tax organizer above. If you have both W-2 wages and
        self-employment income (e.g. a job plus a side business), fill out
        both. Please don&apos;t include Social Security Numbers or EINs you're
        unsure about sharing this way — you can also just note &quot;have EIN,
        will provide separately&quot; here.
      </p>

      <p className="section-title">About your business</p>

      <div className="field-group">
        <label className="field-label">Business name (or &quot;operates under my own name&quot;)</label>
        <input
          type="text"
          value={responses.businessName}
          onChange={(e) => updateField("businessName", e.target.value)}
        />
      </div>

      <div className="field-group">
        <label className="field-label">Business type</label>
        <select
          value={responses.entityType}
          onChange={(e) => updateField("entityType", e.target.value)}
        >
          <option value="">Select one</option>
          <option value="sole_proprietor">Sole proprietor / self-employed (no separate entity)</option>
          <option value="single_member_llc">Single-member LLC</option>
          <option value="multi_member_llc">Multi-member LLC</option>
          <option value="s_corp">S-corporation</option>
          <option value="c_corp">C-corporation</option>
          <option value="partnership">Partnership</option>
          <option value="not_sure">Not sure</option>
        </select>
      </div>

      <div className="field-group">
        <label className="field-label">Nature of business</label>
        <input
          type="text"
          value={responses.natureOfBusiness}
          onChange={(e) => updateField("natureOfBusiness", e.target.value)}
          placeholder="e.g. Barber / personal care services"
        />
      </div>

      <div className="field-group">
        <label className="field-label">Year you started this work</label>
        <input
          type="text"
          value={responses.yearStarted}
          onChange={(e) => updateField("yearStarted", e.target.value)}
          placeholder="e.g. 2021"
        />
      </div>

      <div className="field-group">
        <label className="field-label">EIN (if you have one — optional)</label>
        <input
          type="text"
          value={responses.ein}
          onChange={(e) => updateField("ein", e.target.value)}
        />
      </div>

      <p className="section-title">Income</p>

      <div className="field-group">
        <label className="field-label">Do you have a profit &amp; loss statement prepared?</label>
        <select
          value={responses.hasProfitLossStatement}
          onChange={(e) => updateField("hasProfitLossStatement", e.target.value)}
        >
          <option value="">Select one</option>
          <option value="yes">Yes, I have one ready</option>
          <option value="no">No, I need help putting one together</option>
          <option value="not_sure">Not sure what that is</option>
        </select>
      </div>

      <div className="field-group">
        <label className="field-label">
          Approximate total income from this business this year
        </label>
        <input
          type="text"
          value={responses.grossReceipts}
          onChange={(e) => updateField("grossReceipts", e.target.value)}
          placeholder="Rough figure is fine — exact numbers come from your records"
        />
      </div>

      <p className="section-title">Expenses</p>
      <p style={{ fontSize: "0.85rem", color: "#5f5e5a", marginTop: 0 }}>
        Check anything that applies — you don&apos;t need exact totals here,
        just what to bring or talk through.
      </p>

      {EXPENSE_FIELDS.map((field) => (
        <label className="checkbox-row" key={field.key}>
          <input
            type="checkbox"
            checked={responses.expenses[field.key]}
            onChange={(e) => toggleExpense(field.key, e.target.checked)}
          />
          {field.label}
        </label>
      ))}

      <div className="field-group" style={{ marginTop: "0.75rem" }}>
        <label className="field-label">Anything else about expenses?</label>
        <textarea
          value={responses.expenseNotes}
          onChange={(e) => updateField("expenseNotes", e.target.value)}
        />
      </div>

      <p className="section-title">Employees &amp; contractors</p>

      <div className="field-group">
        <label className="field-label">Do you have any employees?</label>
        <select
          value={responses.hasEmployees}
          onChange={(e) => updateField("hasEmployees", e.target.value)}
        >
          <option value="">Select one</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      <div className="field-group">
        <label className="field-label">Did you pay any contractors $600 or more this year?</label>
        <select
          value={responses.issuedForms1099}
          onChange={(e) => updateField("issuedForms1099", e.target.value)}
        >
          <option value="">Select one</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
          <option value="not_sure">Not sure</option>
        </select>
      </div>

      <p className="section-title">Anything else?</p>

      <div className="field-group">
        <textarea
          value={responses.additionalNotes}
          onChange={(e) => updateField("additionalNotes", e.target.value)}
          placeholder="Anything else we should know about your business before preparing your return"
        />
      </div>

      <label className="checkbox-row" style={{ marginTop: "0.5rem" }}>
        <input
          type="checkbox"
          checked={needsAttention}
          onChange={(e) => setNeedsAttention(e.target.checked)}
        />
        My situation is more complex than usual, or I need extra attention
      </label>

      {needsAttention && (
        <div className="field-group" style={{ marginTop: "0.5rem" }}>
          <label className="field-label">Tell us a bit more</label>
          <textarea
            value={attentionNotes}
            onChange={(e) => setAttentionNotes(e.target.value)}
            placeholder="e.g. multiple years of unfiled returns, mix of W-2 and self-employment income, recent IRS notice, etc."
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1rem",
        }}
      >
        <span className="save-status">
          {saveState === "saving" && "Saving..."}
          {saveState === "saved" && "All changes saved"}
          {saveState === "error" && "Couldn't save — check your connection"}
        </span>
        <button className="btn" onClick={handleSubmit} disabled={submitting} type="button">
          {submitting ? "Submitting..." : status === "submitted" ? "Re-submit" : "Submit to JLB Tax"}
        </button>
      </div>
    </div>
  );
}
