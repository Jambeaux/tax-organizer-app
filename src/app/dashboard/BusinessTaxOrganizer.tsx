"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Every dollar-amount field is stored as a plain string (so the input can
// be blank, and we're not fighting number-input quirks), and parsed with
// this helper only when computing totals.
function toNumber(value: string): number {
  const n = parseFloat(value.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const EXPENSE_LINE_ITEMS: { key: string; label: string; subItem?: boolean }[] = [
  { key: "accounting", label: "Accounting" },
  { key: "advertising", label: "Advertising" },
  { key: "autoTruckExpense", label: "Automobile and truck expense" },
  { key: "badDebts", label: "Bad debts" },
  { key: "bankCharges", label: "Bank charges" },
  { key: "cellPhone", label: "Cell phone" },
  { key: "cleanFuelVehicleDeductions", label: "Clean fuel vehicle deductions" },
  { key: "commissionsFees", label: "Commissions and fees" },
  { key: "computer", label: "Computer" },
  { key: "consulting", label: "Consulting" },
  { key: "creditCollectionCosts", label: "Credit and collection costs" },
  { key: "contractLabor", label: "Contract labor" },
  { key: "delivery", label: "Delivery" },
  { key: "depreciation", label: "Depreciation" },
  { key: "depreciationClaimedElsewhere", label: "Depreciation claimed elsewhere on return", subItem: true },
  { key: "discounts", label: "Discounts" },
  { key: "duesSubscriptions", label: "Dues and subscriptions" },
  { key: "educationTraining", label: "Education and training" },
  { key: "employeeBenefitPrograms", label: "Employee benefit programs" },
  { key: "entertainment", label: "Entertainment" },
  { key: "entertainmentDeductible", label: "Deductible", subItem: true },
  { key: "entertainmentNondeductible", label: "Nondeductible", subItem: true },
  { key: "equipmentRentalLease", label: "Equipment rental/lease" },
  { key: "freight", label: "Freight" },
  { key: "fuel", label: "Fuel" },
  { key: "gifts", label: "Gifts" },
  { key: "independentContractor", label: "Independent contractor" },
  { key: "insurance", label: "Insurance" },
  { key: "insuranceGeneral", label: "General", subItem: true },
  { key: "insuranceBuildingEquipment", label: "Building and equipment", subItem: true },
  { key: "insuranceLiability", label: "Liability", subItem: true },
  { key: "insuranceWorkersComp", label: "Workers' compensation", subItem: true },
  { key: "insuranceOther", label: "Other insurance", subItem: true },
  { key: "interest", label: "Interest" },
  { key: "disallowedInterestExpense", label: "Disallowed interest expense (Form 8990)", subItem: true },
  { key: "internet", label: "Internet" },
  { key: "janitorial", label: "Janitorial" },
  { key: "laundryCleaning", label: "Laundry and cleaning" },
  { key: "legalProfessionalServices", label: "Legal and professional services" },
  { key: "marketing", label: "Marketing" },
  { key: "meals", label: "Meals" },
  { key: "meetings", label: "Meetings" },
  { key: "miscellaneous", label: "Miscellaneous" },
  { key: "officeExpense", label: "Office expense" },
  { key: "outsideServicesContractors", label: "Outside services and contractors" },
  { key: "parkingFeesTolls", label: "Parking fees and tolls" },
  { key: "payrollProcessingExpenses", label: "Payroll processing expenses" },
  { key: "pensionProfitSharing", label: "Pension, profit-sharing, and other plans" },
  { key: "permitsFees", label: "Permits and fees" },
  { key: "postageShipping", label: "Postage/shipping" },
  { key: "printing", label: "Printing" },
  { key: "recruiting", label: "Recruiting" },
  { key: "rentLease", label: "Rent or lease" },
  { key: "rentLeaseVehiclesMachinery", label: "Vehicles, machinery and equipment", subItem: true },
  { key: "rentLeaseOtherProperty", label: "Other business property", subItem: true },
  { key: "repairsMaintenance", label: "Repairs and maintenance" },
  { key: "salariesNonShareholders", label: "Salaries and wages to non-shareholders" },
  { key: "salariesShareholders", label: "Salaries and wages to shareholders" },
  { key: "sales", label: "Sales" },
  { key: "security", label: "Security" },
  { key: "software", label: "Software" },
  { key: "supplies", label: "Supplies" },
  { key: "taxesLicenses", label: "Taxes and licenses" },
  { key: "telephone", label: "Telephone" },
  { key: "tools", label: "Tools" },
  { key: "travelMealsEntertainment", label: "Travel, meals and entertainment" },
  { key: "travel", label: "Travel", subItem: true },
  { key: "deductibleMeals", label: "Deductible meals", subItem: true },
  { key: "uniforms", label: "Uniforms" },
  { key: "utilities", label: "Utilities" },
  { key: "wages", label: "Wages" },
  { key: "wasteRemoval", label: "Waste removal" },
];

export const VEHICLE_EXPENSE_ITEMS: { key: string; label: string }[] = [
  { key: "repairs", label: "Repairs" },
  { key: "tires", label: "Tires" },
  { key: "gas", label: "Gas" },
  { key: "insurance", label: "Insurance" },
  { key: "parkingFees", label: "Parking fees" },
  { key: "licenses", label: "Licenses" },
  { key: "tolls", label: "Tolls" },
  { key: "oil", label: "Oil" },
];

export type BusinessResponses = {
  // About the business
  proprietorName: string;
  principalBusiness: string;
  businessName: string;
  entityType: string;
  ein: string;
  businessAddress: string;
  city: string;
  state: string;
  zip: string;
  yearsOwned: string;
  recordsMaintainer: string;
  separateBankAccounts: string;
  has1099NEC: string;
  madePayments1099: string;
  filedRequiredForms: string;
  homeBased: string;

  // Income
  hasProfitLossStatement: string;
  profitLossStatementFileName: string;
  grossReceiptsSales: string;
  returnsAllowances: string;
  costOfGoodsSold: string;

  // Expenses
  expenses: Record<string, string>;
  miscExpenses: { description: string; amount: string }[];
  expenseNotes: string;

  // Auto expense worksheet
  vehicleDatePlacedInService: string;
  totalMilesDriven: string;
  businessMiles: string;
  commutingMiles: string;
  otherMiles: string;
  vehicleExpenses: Record<string, string>;
  vehicleOther1Label: string;
  vehicleOther1Amount: string;
  vehicleOther2Label: string;
  vehicleOther2Amount: string;
  vehicleOther3Label: string;
  vehicleOther3Amount: string;

  // Employees
  hasEmployees: string;

  additionalNotes: string;
};

function emptyExpenses(): Record<string, string> {
  const obj: Record<string, string> = {};
  EXPENSE_LINE_ITEMS.forEach((item) => {
    obj[item.key] = "";
  });
  return obj;
}

function emptyVehicleExpenses(): Record<string, string> {
  const obj: Record<string, string> = {};
  VEHICLE_EXPENSE_ITEMS.forEach((item) => {
    obj[item.key] = "";
  });
  return obj;
}

const EMPTY_BUSINESS_RESPONSES: BusinessResponses = {
  proprietorName: "",
  principalBusiness: "",
  businessName: "",
  entityType: "",
  ein: "",
  businessAddress: "",
  city: "",
  state: "",
  zip: "",
  yearsOwned: "",
  recordsMaintainer: "",
  separateBankAccounts: "",
  has1099NEC: "",
  madePayments1099: "",
  filedRequiredForms: "",
  homeBased: "",

  hasProfitLossStatement: "",
  profitLossStatementFileName: "",
  grossReceiptsSales: "",
  returnsAllowances: "",
  costOfGoodsSold: "",

  expenses: emptyExpenses(),
  miscExpenses: [],
  expenseNotes: "",

  vehicleDatePlacedInService: "",
  totalMilesDriven: "",
  businessMiles: "",
  commutingMiles: "",
  otherMiles: "",
  vehicleExpenses: emptyVehicleExpenses(),
  vehicleOther1Label: "",
  vehicleOther1Amount: "",
  vehicleOther2Label: "",
  vehicleOther2Amount: "",
  vehicleOther3Label: "",
  vehicleOther3Amount: "",

  hasEmployees: "",

  additionalNotes: "",
};

export default function BusinessTaxOrganizer({ userId }: { userId: string }) {
  const supabase = createClient();
  const [responses, setResponses] = useState<BusinessResponses>(EMPTY_BUSINESS_RESPONSES);
  const [status, setStatus] = useState<string>("draft");
  const [needsAttention, setNeedsAttention] = useState(false);
  const [attentionNotes, setAttentionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPL, setUploadingPL] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
        const loaded = data.responses as Partial<BusinessResponses>;
        setResponses({
          ...EMPTY_BUSINESS_RESPONSES,
          ...loaded,
          expenses: { ...emptyExpenses(), ...(loaded.expenses ?? {}) },
          miscExpenses: loaded.miscExpenses ?? [],
          vehicleExpenses: { ...emptyVehicleExpenses(), ...(loaded.vehicleExpenses ?? {}) },
        });
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

  function updateExpense(key: string, value: string) {
    setResponses((prev) => ({ ...prev, expenses: { ...prev.expenses, [key]: value } }));
  }

  function updateVehicleExpense(key: string, value: string) {
    setResponses((prev) => ({
      ...prev,
      vehicleExpenses: { ...prev.vehicleExpenses, [key]: value },
    }));
  }

  async function handleUploadProfitLoss(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPL(true);
    setUploadError(null);

    const storedName = `${Date.now()}_PL_${file.name}`;
    const { error } = await supabase.storage
      .from("documents")
      .upload(`${userId}/${storedName}`, file, { upsert: false });

    setUploadingPL(false);
    e.target.value = "";

    if (error) {
      setUploadError(error.message);
      return;
    }

    updateField("profitLossStatementFileName", storedName);
  }

  function addMiscExpense() {
    setResponses((prev) => ({
      ...prev,
      miscExpenses: [...prev.miscExpenses, { description: "", amount: "" }],
    }));
  }

  function updateMiscExpense(index: number, field: "description" | "amount", value: string) {
    setResponses((prev) => ({
      ...prev,
      miscExpenses: prev.miscExpenses.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function removeMiscExpense(index: number) {
    setResponses((prev) => ({
      ...prev,
      miscExpenses: prev.miscExpenses.filter((_, i) => i !== index),
    }));
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

  const grossIncome =
    toNumber(responses.grossReceiptsSales) -
    (toNumber(responses.returnsAllowances) + toNumber(responses.costOfGoodsSold));

  const totalFixedExpenses = EXPENSE_LINE_ITEMS.reduce(
    (sum, item) => sum + toNumber(responses.expenses[item.key] ?? ""),
    0
  );
  const totalMiscExpenses = responses.miscExpenses.reduce(
    (sum, item) => sum + toNumber(item.amount ?? ""),
    0
  );
  const totalExpenses = totalFixedExpenses + totalMiscExpenses;

  const totalVehicleExpenses =
    VEHICLE_EXPENSE_ITEMS.reduce((sum, item) => sum + toNumber(responses.vehicleExpenses[item.key] ?? ""), 0) +
    toNumber(responses.vehicleOther1Amount) +
    toNumber(responses.vehicleOther2Amount) +
    toNumber(responses.vehicleOther3Amount);

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
          Business tax organizer — Self-Employed Filer Checklist
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
        self-employment income, fill out both. Rough numbers are fine
        wherever you're not sure — bring your records to fill in the rest.
        Please don&apos;t include Social Security Numbers here; you can note
        &quot;have EIN, will provide separately&quot; if you'd rather not
        type it in.
      </p>

      <p style={{ marginBottom: "1.25rem" }}>
        <a
          href="https://calendly.com/jbooker3-jlbtax/30min"
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
          style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
        >
          Book a Free Consultation
        </a>
      </p>

      <p className="section-title">About your business</p>

      <div className="field-group">
        <label className="field-label">Name of proprietor</label>
        <input
          type="text"
          value={responses.proprietorName}
          onChange={(e) => updateField("proprietorName", e.target.value)}
        />
      </div>

      <div className="field-group">
        <label className="field-label">Principal business or profession</label>
        <input
          type="text"
          value={responses.principalBusiness}
          onChange={(e) => updateField("principalBusiness", e.target.value)}
          placeholder="e.g. Barber / personal care services"
        />
      </div>

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
        <label className="field-label">EIN (if you have one — optional)</label>
        <input type="text" value={responses.ein} onChange={(e) => updateField("ein", e.target.value)} />
      </div>

      <div className="field-group">
        <label className="field-label">Business address</label>
        <input
          type="text"
          value={responses.businessAddress}
          onChange={(e) => updateField("businessAddress", e.target.value)}
        />
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <div className="field-group" style={{ flex: 2 }}>
          <label className="field-label">City</label>
          <input type="text" value={responses.city} onChange={(e) => updateField("city", e.target.value)} />
        </div>
        <div className="field-group" style={{ flex: 1 }}>
          <label className="field-label">State</label>
          <input type="text" value={responses.state} onChange={(e) => updateField("state", e.target.value)} />
        </div>
        <div className="field-group" style={{ flex: 1 }}>
          <label className="field-label">Zip code</label>
          <input type="text" value={responses.zip} onChange={(e) => updateField("zip", e.target.value)} />
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">How long have you owned this business?</label>
        <input
          type="text"
          value={responses.yearsOwned}
          onChange={(e) => updateField("yearsOwned", e.target.value)}
          placeholder="e.g. 5 years"
        />
      </div>

      <div className="field-group">
        <label className="field-label">Who maintains the business records?</label>
        <input
          type="text"
          value={responses.recordsMaintainer}
          onChange={(e) => updateField("recordsMaintainer", e.target.value)}
          placeholder="e.g. Myself, a bookkeeper, etc."
        />
      </div>

      <div className="field-group">
        <label className="field-label">
          Do you maintain separate banking accounts for personal and business transactions?
        </label>
        <select
          value={responses.separateBankAccounts}
          onChange={(e) => updateField("separateBankAccounts", e.target.value)}
        >
          <option value="">Select one</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      <div className="field-group">
        <label className="field-label">Do you have any Forms 1099-NEC to support the income?</label>
        <select
          value={responses.has1099NEC}
          onChange={(e) => updateField("has1099NEC", e.target.value)}
        >
          <option value="">Select one</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      <div className="field-group">
        <label className="field-label">
          Did you make any payments this year that require you to file a 1099?
        </label>
        <select
          value={responses.madePayments1099}
          onChange={(e) => updateField("madePayments1099", e.target.value)}
        >
          <option value="">Select one</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
          <option value="not_sure">Not sure</option>
        </select>
      </div>

      {responses.madePayments1099 === "yes" && (
        <div className="field-group">
          <label className="field-label">If yes, did you or will you file the required forms?</label>
          <select
            value={responses.filedRequiredForms}
            onChange={(e) => updateField("filedRequiredForms", e.target.value)}
          >
            <option value="">Select one</option>
            <option value="filed">Already filed</option>
            <option value="will_file">Will file</option>
            <option value="need_help">Need help doing this</option>
          </select>
        </div>
      )}

      <div className="field-group">
        <label className="field-label">Is this a home-based business?</label>
        <select value={responses.homeBased} onChange={(e) => updateField("homeBased", e.target.value)}>
          <option value="">Select one</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
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

      {responses.hasProfitLossStatement === "yes" && (
        <div className="field-group">
          <label className="field-label">Upload your profit &amp; loss statement</label>
          <p style={{ fontSize: "0.8rem", color: "#5f5e5a", marginTop: 0, marginBottom: "0.5rem" }}>
            If you upload a P&amp;L, you can skip typing in every expense
            category below — we&apos;ll work from the document instead.
          </p>
          {responses.profitLossStatementFileName ? (
            <p style={{ fontSize: "0.85rem", color: "#047E20", marginBottom: "0.5rem" }}>
              Uploaded: {responses.profitLossStatementFileName.replace(/^\d+_PL_/, "")}
              {" — "}
              <button
                type="button"
                onClick={() => updateField("profitLossStatementFileName", "")}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--navy)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                clear
              </button>
            </p>
          ) : null}
          <label className="btn btn-outline" style={{ display: "inline-block" }}>
            {uploadingPL ? "Uploading..." : responses.profitLossStatementFileName ? "Upload a different file" : "Upload P&L statement"}
            <input
              type="file"
              onChange={handleUploadProfitLoss}
              disabled={uploadingPL}
              style={{ display: "none" }}
            />
          </label>
          {uploadError && (
            <p style={{ color: "#a32d2d", fontSize: "0.8rem", marginTop: "0.5rem" }}>{uploadError}</p>
          )}
          <p style={{ fontSize: "0.75rem", color: "#5f5e5a", marginTop: "0.5rem" }}>
            This uploads to the same secure Documents area shown on your main
            dashboard.
          </p>
        </div>
      )}

      <div className="amount-row">
        <label className="field-label">Gross receipts and sales</label>
        <input
          type="text"
          value={responses.grossReceiptsSales}
          onChange={(e) => updateField("grossReceiptsSales", e.target.value)}
          placeholder="$"
        />
      </div>
      <div className="amount-row">
        <label className="field-label">Returns and allowances</label>
        <input
          type="text"
          value={responses.returnsAllowances}
          onChange={(e) => updateField("returnsAllowances", e.target.value)}
          placeholder="$"
        />
      </div>
      <div className="amount-row">
        <label className="field-label">Cost of goods sold</label>
        <input
          type="text"
          value={responses.costOfGoodsSold}
          onChange={(e) => updateField("costOfGoodsSold", e.target.value)}
          placeholder="$"
        />
      </div>
      <div className="amount-row total">
        <label className="field-label">Gross income (sales − returns − cost of goods)</label>
        <span>${formatMoney(grossIncome)}</span>
      </div>

      <p className="section-title" style={{ marginTop: "1.5rem" }}>
        Expenses
      </p>
      <p style={{ fontSize: "0.85rem", color: "#5f5e5a", marginTop: 0 }}>
        {responses.profitLossStatementFileName
          ? "You've uploaded a P&L statement above, so you can skip this section entirely if it already covers your expenses."
          : "Enter a rough dollar amount for anything that applies — leave the rest blank. Exact totals can come from your records later."}
      </p>

      {EXPENSE_LINE_ITEMS.map((item) => (
        <div className={`amount-row${item.subItem ? " sub-item" : ""}`} key={item.key}>
          <label className="field-label">{item.label}</label>
          <input
            type="text"
            value={responses.expenses[item.key] ?? ""}
            onChange={(e) => updateExpense(item.key, e.target.value)}
            placeholder="$"
          />
        </div>
      ))}

      <p style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: "1rem", marginBottom: "0.3rem" }}>
        Not sure where an expense goes?
      </p>
      <p style={{ fontSize: "0.85rem", color: "#5f5e5a", marginTop: 0 }}>
        Add it here with a short description and the amount — we&apos;ll
        figure out where it belongs.
      </p>

      {responses.miscExpenses.map((item, index) => (
        <div className="amount-row" key={index} style={{ gap: "0.5rem" }}>
          <input
            type="text"
            value={item.description}
            onChange={(e) => updateMiscExpense(index, "description", e.target.value)}
            placeholder="Description"
            style={{ flex: 1, textAlign: "left" }}
          />
          <input
            type="text"
            value={item.amount}
            onChange={(e) => updateMiscExpense(index, "amount", e.target.value)}
            placeholder="$"
          />
          <button
            type="button"
            onClick={() => removeMiscExpense(index)}
            className="btn btn-outline"
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
            aria-label="Remove this expense"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addMiscExpense}
        className="btn btn-outline"
        style={{ marginTop: "0.5rem", fontSize: "0.85rem", padding: "0.5rem 1rem" }}
      >
        + Add an expense
      </button>

      <div className="amount-row total" style={{ marginTop: "1rem" }}>
        <label className="field-label">Total expenses</label>
        <span>${formatMoney(totalExpenses)}</span>
      </div>

      <div className="field-group" style={{ marginTop: "0.75rem" }}>
        <label className="field-label">Anything else about expenses?</label>
        <textarea
          value={responses.expenseNotes}
          onChange={(e) => updateField("expenseNotes", e.target.value)}
        />
      </div>

      <p className="section-title" style={{ marginTop: "1.5rem" }}>
        Auto expense worksheet
      </p>
      <p style={{ fontSize: "0.85rem", color: "#5f5e5a", marginTop: 0 }}>
        Fill this out if you use a vehicle for this business.
      </p>

      <div className="field-group">
        <label className="field-label">Date vehicle placed in service</label>
        <input
          type="text"
          value={responses.vehicleDatePlacedInService}
          onChange={(e) => updateField("vehicleDatePlacedInService", e.target.value)}
          placeholder="e.g. 03/2022"
        />
      </div>

      <div className="field-group">
        <label className="field-label">Total miles driven during the year</label>
        <input
          type="text"
          value={responses.totalMilesDriven}
          onChange={(e) => updateField("totalMilesDriven", e.target.value)}
        />
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <div className="field-group" style={{ flex: 1 }}>
          <label className="field-label">Business miles</label>
          <input
            type="text"
            value={responses.businessMiles}
            onChange={(e) => updateField("businessMiles", e.target.value)}
          />
        </div>
        <div className="field-group" style={{ flex: 1 }}>
          <label className="field-label">Commuting miles</label>
          <input
            type="text"
            value={responses.commutingMiles}
            onChange={(e) => updateField("commutingMiles", e.target.value)}
          />
        </div>
        <div className="field-group" style={{ flex: 1 }}>
          <label className="field-label">Other miles</label>
          <input
            type="text"
            value={responses.otherMiles}
            onChange={(e) => updateField("otherMiles", e.target.value)}
          />
        </div>
      </div>

      <p style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.3rem" }}>Vehicle expenses</p>
      {VEHICLE_EXPENSE_ITEMS.map((item) => (
        <div className="amount-row" key={item.key}>
          <label className="field-label">{item.label}</label>
          <input
            type="text"
            value={responses.vehicleExpenses[item.key] ?? ""}
            onChange={(e) => updateVehicleExpense(item.key, e.target.value)}
            placeholder="$"
          />
        </div>
      ))}

      {[1, 2, 3].map((n) => {
        const labelKey = `vehicleOther${n}Label` as keyof BusinessResponses;
        const amountKey = `vehicleOther${n}Amount` as keyof BusinessResponses;
        return (
          <div className="amount-row" key={n} style={{ gap: "0.5rem" }}>
            <input
              type="text"
              value={responses[labelKey] as string}
              onChange={(e) => updateField(labelKey, e.target.value as never)}
              placeholder="Other expense — describe"
              style={{ flex: 1, textAlign: "left" }}
            />
            <input
              type="text"
              value={responses[amountKey] as string}
              onChange={(e) => updateField(amountKey, e.target.value as never)}
              placeholder="$"
            />
          </div>
        );
      })}

      <div className="amount-row total">
        <label className="field-label">Total vehicle expenses</label>
        <span>${formatMoney(totalVehicleExpenses)}</span>
      </div>

      <p className="section-title" style={{ marginTop: "1.5rem" }}>
        Employees
      </p>

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

      <p style={{ fontSize: "0.75rem", color: "#5f5e5a", marginTop: "1rem" }}>
        Under penalties of perjury, I declare to the best of my knowledge and
        belief that the information in this form is true, correct, and
        complete.
      </p>

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
