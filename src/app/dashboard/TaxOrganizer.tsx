"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Dependent = {
  name: string;
  relationship: string;
  dob: string;
  monthsLivedWithYou: string;
};

type IncomeFlags = {
  w2: boolean;
  selfEmployment: boolean;
  interestDividends: boolean;
  rental: boolean;
  retirementDistributions: boolean;
  unemployment: boolean;
  otherIncome: boolean;
};

type DeductionFlags = {
  mortgageInterest: boolean;
  propertyTax: boolean;
  charitableDonations: boolean;
  medicalExpenses: boolean;
  studentLoanInterest: boolean;
  educationExpenses: boolean;
  childcareExpenses: boolean;
  iraContributions: boolean;
};

type LifeChangeFlags = {
  marriedOrDivorced: boolean;
  newChild: boolean;
  boughtOrSoldHome: boolean;
  startedBusiness: boolean;
  movedStates: boolean;
  majorMedicalExpenses: boolean;
};

type Responses = {
  filingStatus: string;
  nameOrAddressChange: string;
  occupation: string;
  spouseName: string;
  spouseOccupation: string;
  dependents: Dependent[];
  income: IncomeFlags;
  incomeNotes: string;
  deductions: DeductionFlags;
  deductionNotes: string;
  lifeChanges: LifeChangeFlags;
  lifeChangeNotes: string;
  additionalNotes: string;
};

const EMPTY_RESPONSES: Responses = {
  filingStatus: "",
  nameOrAddressChange: "",
  occupation: "",
  spouseName: "",
  spouseOccupation: "",
  dependents: [],
  income: {
    w2: false,
    selfEmployment: false,
    interestDividends: false,
    rental: false,
    retirementDistributions: false,
    unemployment: false,
    otherIncome: false,
  },
  incomeNotes: "",
  deductions: {
    mortgageInterest: false,
    propertyTax: false,
    charitableDonations: false,
    medicalExpenses: false,
    studentLoanInterest: false,
    educationExpenses: false,
    childcareExpenses: false,
    iraContributions: false,
  },
  deductionNotes: "",
  lifeChanges: {
    marriedOrDivorced: false,
    newChild: false,
    boughtOrSoldHome: false,
    startedBusiness: false,
    movedStates: false,
    majorMedicalExpenses: false,
  },
  lifeChangeNotes: "",
  additionalNotes: "",
};

const INCOME_FIELDS: { key: keyof IncomeFlags; label: string }[] = [
  { key: "w2", label: "W-2 wages from an employer" },
  { key: "selfEmployment", label: "Self-employment / 1099 income" },
  { key: "interestDividends", label: "Interest or dividends" },
  { key: "rental", label: "Rental property income" },
  { key: "retirementDistributions", label: "Retirement account distributions" },
  { key: "unemployment", label: "Unemployment income" },
  { key: "otherIncome", label: "Other income not listed here" },
];

const DEDUCTION_FIELDS: { key: keyof DeductionFlags; label: string }[] = [
  { key: "mortgageInterest", label: "Mortgage interest" },
  { key: "propertyTax", label: "Property tax" },
  { key: "charitableDonations", label: "Charitable donations" },
  { key: "medicalExpenses", label: "Medical expenses" },
  { key: "studentLoanInterest", label: "Student loan interest" },
  { key: "educationExpenses", label: "Education expenses" },
  { key: "childcareExpenses", label: "Childcare expenses" },
  { key: "iraContributions", label: "IRA contributions" },
];

const LIFE_CHANGE_FIELDS: { key: keyof LifeChangeFlags; label: string }[] = [
  { key: "marriedOrDivorced", label: "Got married or divorced" },
  { key: "newChild", label: "Had or adopted a child" },
  { key: "boughtOrSoldHome", label: "Bought or sold a home" },
  { key: "startedBusiness", label: "Started a business" },
  { key: "movedStates", label: "Moved to a different state" },
  { key: "majorMedicalExpenses", label: "Had major medical expenses" },
];

export default function TaxOrganizer({ userId }: { userId: string }) {
  const supabase = createClient();
  const [responses, setResponses] = useState<Responses>(EMPTY_RESPONSES);
  const [status, setStatus] = useState<string>("draft");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("tax_organizer_responses")
        .select("responses, status")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        setResponses({ ...EMPTY_RESPONSES, ...(data.responses as Partial<Responses>) });
        setStatus(data.status);
      }
      skipNextSave.current = true;
      setLoading(false);
    }
    load();
  }, [supabase, userId]);

  // Autosave: debounce so we're not writing on every keystroke.
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
        .from("tax_organizer_responses")
        .upsert(
          { user_id: userId, responses, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      setSaveState(error ? "error" : "saved");
    }, 1000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses]);

  function updateField<K extends keyof Responses>(key: K, value: Responses[K]) {
    setResponses((prev) => ({ ...prev, [key]: value }));
  }

  function toggleIncome(key: keyof IncomeFlags, checked: boolean) {
    setResponses((prev) => ({ ...prev, income: { ...prev.income, [key]: checked } }));
  }

  function toggleDeduction(key: keyof DeductionFlags, checked: boolean) {
    setResponses((prev) => ({ ...prev, deductions: { ...prev.deductions, [key]: checked } }));
  }

  function toggleLifeChange(key: keyof LifeChangeFlags, checked: boolean) {
    setResponses((prev) => ({ ...prev, lifeChanges: { ...prev.lifeChanges, [key]: checked } }));
  }

  function addDependent() {
    setResponses((prev) => ({
      ...prev,
      dependents: [...prev.dependents, { name: "", relationship: "", dob: "", monthsLivedWithYou: "" }],
    }));
  }

  function updateDependent(index: number, field: keyof Dependent, value: string) {
    setResponses((prev) => ({
      ...prev,
      dependents: prev.dependents.map((dep, i) => (i === index ? { ...dep, [field]: value } : dep)),
    }));
  }

  function removeDependent(index: number) {
    setResponses((prev) => ({
      ...prev,
      dependents: prev.dependents.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    const { error } = await supabase.from("tax_organizer_responses").upsert(
      {
        user_id: userId,
        responses,
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
          Tax organizer
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
        This is a living intake form — update it anytime as your situation
        changes. Please don&apos;t include Social Security Numbers in any
        field below; secure SSN collection isn&apos;t available yet.
      </p>

      <p className="section-title">Personal &amp; filing info</p>

      <div className="field-group">
        <label className="field-label">Filing status</label>
        <select
          value={responses.filingStatus}
          onChange={(e) => updateField("filingStatus", e.target.value)}
        >
          <option value="">Select one</option>
          <option value="single">Single</option>
          <option value="married_joint">Married filing jointly</option>
          <option value="married_separate">Married filing separately</option>
          <option value="head_of_household">Head of household</option>
          <option value="qualifying_widow">Qualifying widow(er)</option>
        </select>
      </div>

      <div className="field-group">
        <label className="field-label">Occupation</label>
        <input
          type="text"
          value={responses.occupation}
          onChange={(e) => updateField("occupation", e.target.value)}
        />
      </div>

      {(responses.filingStatus === "married_joint" ||
        responses.filingStatus === "married_separate") && (
        <>
          <div className="field-group">
            <label className="field-label">Spouse&apos;s name</label>
            <input
              type="text"
              value={responses.spouseName}
              onChange={(e) => updateField("spouseName", e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Spouse&apos;s occupation</label>
            <input
              type="text"
              value={responses.spouseOccupation}
              onChange={(e) => updateField("spouseOccupation", e.target.value)}
            />
          </div>
        </>
      )}

      <div className="field-group">
        <label className="field-label">
          Any name or address changes since your last return?
        </label>
        <textarea
          value={responses.nameOrAddressChange}
          onChange={(e) => updateField("nameOrAddressChange", e.target.value)}
        />
      </div>

      <p className="section-title">Dependents</p>

      {responses.dependents.map((dep, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--gray)",
            borderRadius: "6px",
            padding: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <div className="field-group">
            <label className="field-label">Name</label>
            <input
              type="text"
              value={dep.name}
              onChange={(e) => updateDependent(i, "name", e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Relationship</label>
            <input
              type="text"
              value={dep.relationship}
              onChange={(e) => updateDependent(i, "relationship", e.target.value)}
              placeholder="e.g. Son, Daughter, Parent"
            />
          </div>
          <div className="field-group">
            <label className="field-label">Date of birth</label>
            <input
              type="date"
              value={dep.dob}
              onChange={(e) => updateDependent(i, "dob", e.target.value)}
            />
          </div>
          <div className="field-group" style={{ marginBottom: "0.5rem" }}>
            <label className="field-label">Months lived with you this year</label>
            <input
              type="text"
              value={dep.monthsLivedWithYou}
              onChange={(e) => updateDependent(i, "monthsLivedWithYou", e.target.value)}
            />
          </div>
          <button
            className="btn btn-outline"
            style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
            onClick={() => removeDependent(i)}
            type="button"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        className="btn btn-outline"
        style={{ padding: "0.4rem 1rem", fontSize: "0.85rem", marginBottom: "1.25rem" }}
        onClick={addDependent}
        type="button"
      >
        + Add a dependent
      </button>

      <p className="section-title">Income this year</p>

      {INCOME_FIELDS.map((field) => (
        <label className="checkbox-row" key={field.key}>
          <input
            type="checkbox"
            checked={responses.income[field.key]}
            onChange={(e) => toggleIncome(field.key, e.target.checked)}
          />
          {field.label}
        </label>
      ))}

      <div className="field-group" style={{ marginTop: "0.75rem" }}>
        <label className="field-label">Anything else about your income?</label>
        <textarea
          value={responses.incomeNotes}
          onChange={(e) => updateField("incomeNotes", e.target.value)}
        />
      </div>

      <p className="section-title">Deductions &amp; credits</p>

      {DEDUCTION_FIELDS.map((field) => (
        <label className="checkbox-row" key={field.key}>
          <input
            type="checkbox"
            checked={responses.deductions[field.key]}
            onChange={(e) => toggleDeduction(field.key, e.target.checked)}
          />
          {field.label}
        </label>
      ))}

      <div className="field-group" style={{ marginTop: "0.75rem" }}>
        <label className="field-label">Anything else about deductions or credits?</label>
        <textarea
          value={responses.deductionNotes}
          onChange={(e) => updateField("deductionNotes", e.target.value)}
        />
      </div>

      <p className="section-title">Life changes this year</p>

      {LIFE_CHANGE_FIELDS.map((field) => (
        <label className="checkbox-row" key={field.key}>
          <input
            type="checkbox"
            checked={responses.lifeChanges[field.key]}
            onChange={(e) => toggleLifeChange(field.key, e.target.checked)}
          />
          {field.label}
        </label>
      ))}

      <div className="field-group" style={{ marginTop: "0.75rem" }}>
        <label className="field-label">Tell us more about any of the above</label>
        <textarea
          value={responses.lifeChangeNotes}
          onChange={(e) => updateField("lifeChangeNotes", e.target.value)}
        />
      </div>

      <p className="section-title">Anything else?</p>

      <div className="field-group">
        <textarea
          value={responses.additionalNotes}
          onChange={(e) => updateField("additionalNotes", e.target.value)}
          placeholder="Anything else we should know before preparing your return"
        />
      </div>

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
