"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import { logAudit } from "@/lib/logAudit";
import { estimateRange, buildMonthlyPlan, alignerRangeLabel } from "@/lib/monthlyPlan";

const supabase = getSupabaseClient();

const IMAGE_SLOTS = [
  { key: "left_occlusion",   label: "Left Occlusion" },
  { key: "right_occlusion",  label: "Right Occlusion" },
  { key: "center_occlusion", label: "Center Occlusion" },
  { key: "upper",            label: "Upper" },
  { key: "lower",            label: "Lower" },
  { key: "front_profile",    label: "Front Profile" },
  { key: "right_profile",    label: "Right Profile" },
  { key: "smile_45",         label: "45° Smile" },
  { key: "smile_front",      label: "Front Smile" },
];

const STL_SLOTS = [
  { key: "bite_scan_1", label: "Bite Scan 1" },
  { key: "bite_scan_2", label: "Bite Scan 2" },
  { key: "upper_scan",  label: "Upper Scan" },
  { key: "lower_scan",  label: "Lower Scan" },
];

const SHEETS = {
  1:  "Scheu® Duran+® - 0.500 mm",
  2:  "Scheu® Duran+® - 0.750 mm",
  3:  "Scheu® Duran+® - 1.000 mm",
  4:  "Erkodent® Erkodur-al® - 0.600 mm",
  5:  "Erkodent® Erkodur-al® - 1.000 mm",
  6:  "Erkodent® Erkodur® - 0.600 mm",
  7:  "Erkodent® Erkodur® - 0.800 mm",
  8:  "Erkodent® Erkodur® - 1.000 mm",
  9:  "Scheu® Duran+® - 0.625 mm",
  10: "Zendura™ A - 0.762 mm",
  11: "Zendura™ FLX - 0.762 mm",
  12: "Zendura™ TRAK - 0.380 mm",
  13: "Scheu® Duran+® - 1.500 mm",
  14: "Erkodent® Erkolen® - 0.600 mm",
  15: "Scheu® Copyplast® - 0.750 mm",
  16: "Erkodent® Erkodur-al® - 0.800 mm",
  17: "Scheu® Bioplast® with DURASOFT® seal - 2.000 mm",
  18: "Scheu® DURASOFT® pd with DURASOFT® seal - 1.800 mm",
  19: "Scheu® IMPRELON® S pd - 1.000 mm",
  20: "Scheu® CA® Pro+ - 0.750 mm",
  21: "Scheu® IMPRELON® S pd - 0.750 mm",
  22: "Zendura™ A - 1.020 mm",
  23: "Scheu® UNIQ+ pd - 0.750 mm",
};

const SHEET_CATS = {
  "Attachment Template": [1, 4, 6, 12, 14, 15],
  "Aligner Tray":        [2, 7, 9, 11, 16, 20, 23],
  "Retainer":            [3, 5, 8, 10, 13, 17, 18, 19, 21, 22],
};

const fmtRs = (n) => `₹ ${Math.round(n).toLocaleString("en-IN")}`;

const PROVISIONAL_PLAN_NOTE = "Your tooth will be rotated to required degree. Alignment will be corrected. Spaces will be gained. Your plan might involve IPR and buttons.";

function ViewSection({ title, done, activeSection, setActiveSection, children }) {
  const isOpen = activeSection === title;
  return (
    <div style={{
      background: "white", border: `1px solid ${done ? "#22c55e" : "#e5e7eb"}`,
      borderRadius: "16px", overflow: "hidden",
      boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
    }}>
      <div
        onClick={() => setActiveSection(isOpen ? null : title)}
        style={{
          padding: "18px 20px", display: "flex", justifyContent: "space-between",
          alignItems: "center", cursor: "pointer",
          background: done ? "#f0fdf4" : "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            width: "24px", height: "24px", borderRadius: "50%",
            background: done ? "#22c55e" : "#e5e7eb",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: "13px", fontWeight: "700", flexShrink: 0,
          }}>
            {done ? "✓" : ""}
          </span>
          <span style={{ fontWeight: "600", color: done ? "#16a34a" : "#111827" }}>
            {title}
          </span>
        </div>
        <span style={{ color: "gray", fontSize: "13px" }}>
          {done ? (isOpen ? "▲" : "▼") : "Pending"}
        </span>
      </div>
      {isOpen && (
        <div style={{ padding: "20px", borderTop: "1px solid #e5e7eb" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function OrthoCase() {
  const { id } = useParams();
  const router = useRouter();

  const [patient, setPatient] = useState(null);
  const [imageUrls, setImageUrls] = useState({});
  const [stlUrls, setStlUrls] = useState({});
  const [activeSection, setActiveSection] = useState(null);
  const [actor, setActor] = useState(null);

  // Planning state
  const [minMonths, setMinMonths] = useState("");
  const [maxMonths, setMaxMonths] = useState("");
  const [provisionalPlan, setProvisionalPlan] = useState("");
  const [provisionalSubmitted, setProvisionalSubmitted] = useState(false);
  const [provisionalSaving, setProvisionalSaving] = useState(false);

  const [orthoNote, setOrthoNote] = useState(PROVISIONAL_PLAN_NOTE);
  const [noteSaving, setNoteSaving] = useState(false);

  const [finalPlan, setFinalPlan] = useState("");
  const [finalSaving, setFinalSaving] = useState(false);

  const [videoLink, setVideoLink] = useState("");

  // Final Plan Review — upper/lower arch set counts + generated schedule
  const [upperSets, setUpperSets] = useState("");
  const [lowerSets, setLowerSets] = useState("");
  const [finalReviewSubmitted, setFinalReviewSubmitted] = useState(false);
  const [finalReviewSaving, setFinalReviewSaving] = useState(false);
  const [monthlyPlan, setMonthlyPlan] = useState(null);

  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfSubmitted, setPdfSubmitted] = useState(false);

  const [activeSheetCat, setActiveSheetCat] = useState(null);
  const [attachmentSheet, setAttachmentSheet] = useState("");
  const [retainerSheet, setRetainerSheet] = useState("");
  const [alignerRows, setAlignerRows] = useState([{ trays: "", sheet: "" }]);
  const [sheetsSaving, setSheetsSaving] = useState(false);
  const [sheetsSaved, setSheetsSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data }, { data: authData }] = await Promise.all([
        supabase.from("appointments_booking").select("*").eq("id", id).single(),
        supabase.auth.getUser(),
      ]);
      if (authData?.user) {
        const { data: roleData } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
        setActor({ email: authData.user.email || null, role: roleData?.role || "orthodontist" });
      }

      if (!data) return;
      setPatient(data);

      // Planning fields
      if (data.provisional_plan_submitted) {
        setProvisionalSubmitted(true);
        setProvisionalPlan(data.provisional_plan || "");
      }
      setMinMonths(data.provisional_min_months ? String(data.provisional_min_months) : "");
      setMaxMonths(data.provisional_max_months ? String(data.provisional_max_months) : "");
      setOrthoNote(data.ortho_note || "");
      setFinalPlan(data.final_plan || "");
      setVideoLink(data.planning_video_link || "");
      if (data.plan_pdf_url) setPdfSubmitted(true);
      if (data.final_upper_sets || data.final_lower_sets) {
        setUpperSets(data.final_upper_sets ? String(data.final_upper_sets) : "");
        setLowerSets(data.final_lower_sets ? String(data.final_lower_sets) : "");
      }
      if (data.monthly_plan) {
        setMonthlyPlan(data.monthly_plan);
        setFinalReviewSubmitted(true);
      }
      if (data.sheet_selection) {
        const ss = data.sheet_selection;
        if (ss.activeCategory) setActiveSheetCat(ss.activeCategory);
        if (ss.attachmentSheet !== undefined) setAttachmentSheet(ss.attachmentSheet);
        if (ss.retainerSheet !== undefined) setRetainerSheet(ss.retainerSheet);
        if (ss.alignerRows?.length) setAlignerRows(ss.alignerRows);
      }

      // Load signed image URLs
      if (data.image_paths && typeof data.image_paths === "object") {
        const urls = {};
        for (const [key, path] of Object.entries(data.image_paths)) {
          const { data: urlData } = await supabase.storage
            .from("case-files")
            .createSignedUrl(path, 3600);
          if (urlData?.signedUrl) urls[key] = urlData.signedUrl;
        }
        setImageUrls(urls);
      }

      // Load signed STL URLs
      if (data.stl_paths && typeof data.stl_paths === "object") {
        const urls = {};
        for (const [key, path] of Object.entries(data.stl_paths)) {
          const { data: urlData } = await supabase.storage
            .from("case-files")
            .createSignedUrl(path, 3600);
          if (urlData?.signedUrl) urls[key] = urlData.signedUrl;
        }
        setStlUrls(urls);
      }
    };
    load();
  }, [id]);

  // ── PROVISIONAL PLAN + NOTE ───────────────────────────────────
  const submitProvisionalPlan = async () => {
    if (!provisionalPlan.trim()) {
      alert("Please write the provisional plan first.");
      return;
    }
    const minM = parseInt(minMonths, 10) || null;
    const maxM = parseInt(maxMonths, 10) || null;
    setProvisionalSaving(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({
        provisional_plan: provisionalPlan,
        ortho_note: orthoNote,
        provisional_min_months: minM,
        provisional_max_months: maxM,
        provisional_plan_submitted: true,
      })
      .eq("id", id);
    setProvisionalSaving(false);
    if (error) { alert("Failed to submit plan: " + error.message); return; }
    logAudit({ appointmentId: id, actor, action: "Provisional Plan Submitted", entity: "provisional_plan", newData: { provisional_plan: provisionalPlan, ortho_note: orthoNote, provisional_min_months: minM, provisional_max_months: maxM } });
    setProvisionalSubmitted(true);
  };

  // ── FINAL PLAN REVIEW (upper/lower sets + monthly schedule) ────
  const submitFinalReview = async () => {
    const upper = parseInt(upperSets, 10) || 0;
    const lower = parseInt(lowerSets, 10) || 0;
    if (upper <= 0 || lower <= 0) {
      alert("Enter both upper and lower arch set counts.");
      return;
    }
    const plan = buildMonthlyPlan(upper, lower);
    setFinalReviewSaving(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({
        final_upper_sets: upper,
        final_lower_sets: lower,
        monthly_plan: plan,
        journey_steps: { ...(patient?.journey_steps || {}), final_plan_review: true },
      })
      .eq("id", id);
    setFinalReviewSaving(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId: id, actor, action: "Final Plan Review Submitted", entity: "monthly_plan", newData: { final_upper_sets: upper, final_lower_sets: lower, monthly_plan: plan } });
    setMonthlyPlan(plan);
    setFinalReviewSubmitted(true);
  };

  // ── FINAL PLAN ────────────────────────────────────────────────
  const saveFinalPlan = async () => {
    setFinalSaving(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({ final_plan: finalPlan, planning_video_link: videoLink })
      .eq("id", id);
    setFinalSaving(false);
    if (error) { alert("Failed to save: " + error.message); return; }
    logAudit({ appointmentId: id, actor, action: "Final Plan Saved", entity: "final_plan", newData: { final_plan: finalPlan, planning_video_link: videoLink } });
    alert("Final plan saved.");
  };

  // ── SHEET SELECTION ───────────────────────────────────────────
  const saveSheets = async () => {
    setSheetsSaving(true);
    const sheetPayload = { activeCategory: activeSheetCat, attachmentSheet, retainerSheet, alignerRows };
    await supabase.from("appointments_booking").update({ sheet_selection: sheetPayload }).eq("id", id);
    logAudit({ appointmentId: id, actor, action: "Sheet Selection Saved", entity: "sheet_selection", newData: sheetPayload });
    setSheetsSaving(false);
    setSheetsSaved(true);
    setTimeout(() => setSheetsSaved(false), 3000);
  };

  // ── PDF UPLOAD ────────────────────────────────────────────────
  const uploadPdf = async () => {
    if (!pdfFile) { alert("Please select a PDF file."); return; }
    setPdfUploading(true);
    const path = `appointments/${id}/planning/plan_${Date.now()}_${pdfFile.name}`;
    const { error } = await supabase.storage
      .from("case-files")
      .upload(path, pdfFile, { upsert: true });
    if (error) { alert("Failed to upload PDF: " + error.message); setPdfUploading(false); return; }
    await supabase.from("appointments_booking").update({ plan_pdf_url: path }).eq("id", id);
    logAudit({ appointmentId: id, actor, action: "Planning PDF Uploaded", entity: "plan_pdf_url", newData: { plan_pdf_url: path, file_name: pdfFile.name } });
    setPdfUploading(false);
    setPdfSubmitted(true);
    alert("Plan PDF uploaded.");
  };

  if (!patient) return <p style={{ padding: "20px" }}>Loading...</p>;

  const inputStyle = {
    width: "100%", padding: "12px", borderRadius: "8px",
    border: "1px solid #e5e7eb", fontSize: "14px",
    outline: "none", boxSizing: "border-box", marginBottom: "12px",
    background: "white", color: "#111827",
  };

  const btnStyle = (active = true) => ({
    width: "100%", padding: "12px", borderRadius: "8px", border: "none",
    background: active ? "#111827" : "#e5e7eb",
    color: active ? "white" : "#9ca3af",
    fontWeight: "600", cursor: active ? "pointer" : "not-allowed",
  });

  return (
    <div style={{ maxWidth: "720px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <button
          onClick={() => router.push("/ortho")}
          style={{ background: "none", border: "none", color: "gray", cursor: "pointer", fontSize: "13px", marginBottom: "8px" }}
        >
          ← Back
        </button>
        <h1 style={{ marginBottom: "4px" }}>{patient.name || "Patient Case"}</h1>
        <p style={{ color: "gray", fontSize: "13px", margin: 0 }}>
          {patient.phone || ""} {patient.email ? `• ${patient.email}` : ""}
        </p>
      </div>

      <div style={{ display: "grid", gap: "14px" }}>

        {/* ── SECTION 1: PATIENT FORM ── */}
        <ViewSection title="1. Patient Form" done={patient.form_submitted} activeSection={activeSection} setActiveSection={setActiveSection}>
          {patient.form_submitted ? (() => {
            const pfd = patient.patient_form_data || {};
            const teeth = (v) => (Array.isArray(v) && v.length ? v.join(", ") : null);
            const rows = [
              ["Name", patient.name || pfd.name],
              ["Age", patient.age || pfd.age],
              ["Sex", pfd.sex],
              ["Weight (kg)", pfd.weight],
              ["Occupation", patient.occupation || pfd.occupation],
              ["Medical History", pfd.medical_history || patient.complete_history],
              ["Chief Complaint", patient.chief_complaint || pfd.chief_complaint],
              ["Notes", pfd.notes],
              ["Dental Caries", teeth(pfd.dental_caries)],
              ["Missing Tooth", teeth(pfd.missing_tooth)],
              ["Pain", teeth(pfd.pain)],
              ["Sensitivity", teeth(pfd.sensitivity)],
              ["Mobility", teeth(pfd.mobility)],
              ["Recession", teeth(pfd.recession)],
              ["Deciduous Tooth", teeth(pfd.deciduous_tooth)],
              ["Stains", pfd.stains],
              ["Calculus", pfd.calculus],
              ["Pregnancy", pfd.pregnancy],
              ["Pre-orthodontic Procedures", teeth(pfd.pre_orthodontic_procedures)],
              ["Other Procedures", pfd.pre_orthodontic_others],
            ];
            const docs = Array.isArray(pfd.documents) ? pfd.documents : [];
            return (
              <div style={{ display: "grid", gap: "8px" }}>
                {rows.map(([label, val]) => {
                  const has = val !== null && val !== undefined && val !== "";
                  return (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #f3f4f6", paddingBottom: "6px" }}>
                      <span style={{ fontSize: "12px", color: "gray", textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0, maxWidth: "45%" }}>{label}</span>
                      <span style={{ fontSize: "14px", color: has ? "#111827" : "#9ca3af", textAlign: "right", whiteSpace: "pre-wrap", fontStyle: has ? "normal" : "italic" }}>
                        {has ? val : "Not available"}
                      </span>
                    </div>
                  );
                })}
                {docs.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <p style={{ fontSize: "12px", color: "gray", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Uploaded Documents</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                      {docs.map((doc, i) => (
                        doc.type?.startsWith("image/") ? (
                          <a key={i} href={doc.url} target="_blank" rel="noreferrer" style={{ display: "block", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", background: "#fafafa" }}>
                            <img src={doc.url} alt={doc.name} style={{ width: "100%", height: "90px", objectFit: "cover", display: "block" }} />
                            <p style={{ fontSize: "10px", textAlign: "center", padding: "4px", margin: 0, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</p>
                          </a>
                        ) : (
                          <a key={i} href={doc.url} target="_blank" rel="noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", height: "120px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fafafa", textDecoration: "none", color: "#374151", padding: "8px" }}>
                            <span style={{ fontSize: "26px" }}>📄</span>
                            <span style={{ fontSize: "10px", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{doc.name}</span>
                          </a>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
            <p style={{ color: "gray", fontSize: "14px", margin: 0 }}>
              Dentist has not submitted the patient form yet.
            </p>
          )}
        </ViewSection>

        {/* ── SECTION 2: IMAGES ── */}
        <ViewSection title="2. Patient Images" done={patient.images_submitted} activeSection={activeSection} setActiveSection={setActiveSection}>
          {patient.images_submitted ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              {IMAGE_SLOTS.map((slot) => (
                <div key={slot.key} style={{
                  borderRadius: "10px", overflow: "hidden",
                  border: "1px solid #e5e7eb", background: "#fafafa",
                }}>
                  {imageUrls[slot.key] ? (
                    <a href={imageUrls[slot.key]} target="_blank" rel="noreferrer">
                      <img
                        src={imageUrls[slot.key]}
                        alt={slot.label}
                        style={{ width: "100%", height: "80px", objectFit: "cover", display: "block" }}
                      />
                    </a>
                  ) : (
                    <div style={{ height: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "10px", color: "#9ca3af" }}>Loading...</span>
                    </div>
                  )}
                  <p style={{ fontSize: "10px", textAlign: "center", padding: "4px", margin: 0, color: "#374151", fontWeight: "600" }}>
                    {slot.label}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "gray", fontSize: "14px", margin: 0 }}>
              Dentist has not uploaded images yet.
            </p>
          )}
        </ViewSection>

        {/* ── SECTION 3: STL FILES ── */}
        <ViewSection title="3. STL Scan Files" done={patient.stl_submitted} activeSection={activeSection} setActiveSection={setActiveSection}>
          {patient.stl_submitted ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {STL_SLOTS.map((slot) => (
                <div key={slot.key} style={{
                  border: "1px solid #e5e7eb", borderRadius: "10px",
                  padding: "12px", textAlign: "center", background: "#fafafa",
                }}>
                  <p style={{ fontWeight: "600", fontSize: "13px", margin: "0 0 6px", color: "#374151" }}>{slot.label}</p>
                  {stlUrls[slot.key] ? (
                    <a
                      href={stlUrls[slot.key]}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "12px", color: "#2563eb" }}
                    >
                      Download ↗
                    </a>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>Loading...</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "gray", fontSize: "14px", margin: 0 }}>
              Dentist has not uploaded STL files yet.
            </p>
          )}
        </ViewSection>

        {/* ── SECTION 4: PLANNING ── */}
        <div style={{
          background: "white", border: "1px solid #e5e7eb",
          borderRadius: "16px", overflow: "hidden",
          boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
        }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
            <h3 style={{ margin: 0, fontWeight: "700", color: "#111827" }}>4. Planning</h3>
          </div>

          <div style={{ padding: "20px", display: "grid", gap: "24px" }}>

            {/* ── Provisional Planning + Duration + Notes ── */}
            <div>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#111827", display: "block", marginBottom: "8px" }}>
                Provisional Planning
              </label>

              {!provisionalSubmitted && (
                <div style={{ marginBottom: "16px", padding: "14px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <label style={{ fontWeight: "600", fontSize: "13px", color: "#111827", display: "block", marginBottom: "6px" }}>
                    Estimated Treatment Duration (months)
                  </label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      type="number" min="1" placeholder="Min months"
                      value={minMonths}
                      onChange={(e) => setMinMonths(e.target.value)}
                      style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                    />
                    <input
                      type="number" min="1" placeholder="Max months"
                      value={maxMonths}
                      onChange={(e) => setMaxMonths(e.target.value)}
                      style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                    />
                  </div>
                  {(parseInt(minMonths, 10) > 0 || parseInt(maxMonths, 10) > 0) && (() => {
                    const r = estimateRange(parseInt(minMonths, 10) || 0, parseInt(maxMonths, 10) || 0);
                    return (
                      <p style={{ fontSize: "12px", color: "#6b7280", margin: "8px 0 0" }}>
                        Estimated price: <strong style={{ color: "#111827" }}>{fmtRs(r.min)} – {fmtRs(r.max)}</strong> (₹4,999/month)
                      </p>
                    );
                  })()}
                </div>
              )}

              {provisionalSubmitted ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "14px", fontSize: "14px", color: "#111827", whiteSpace: "pre-wrap" }}>
                  {(minMonths || maxMonths) ? (() => {
                    const r = estimateRange(parseInt(minMonths, 10) || 0, parseInt(maxMonths, 10) || 0);
                    return (
                      <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #bbf7d0" }}>
                        <p style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>Estimated Duration: {minMonths}–{maxMonths} months</p>
                        <p style={{ margin: 0, fontSize: "14px", color: "#111827" }}>Estimated price: {fmtRs(r.min)} – {fmtRs(r.max)}</p>
                      </div>
                    );
                  })() : patient?.provisional_sets_orispro ? (
                    <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #bbf7d0" }}>
                      <p style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>Sets Required: {patient.provisional_sets_orispro}</p>
                    </div>
                  ) : null}
                  {provisionalPlan}
                  {orthoNote ? (
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #bbf7d0" }}>
                      <p style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>Notes</p>
                      <p style={{ margin: 0, fontSize: "14px", color: "#111827", whiteSpace: "pre-wrap" }}>{orthoNote}</p>
                    </div>
                  ) : null}
                  <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#16a34a", fontWeight: "600" }}>✓ Submitted to dentist</p>
                </div>
              ) : (
                <>
                  <textarea
                    style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
                    placeholder="Write the provisional treatment plan here..."
                    value={provisionalPlan}
                    onChange={(e) => setProvisionalPlan(e.target.value)}
                  />
                  <label style={{ fontWeight: "600", fontSize: "14px", color: "#111827", display: "block", margin: "4px 0 8px" }}>
                    Notes
                  </label>
                  <textarea
                    style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
                    placeholder="Add notes for the dentist..."
                    value={orthoNote}
                    onChange={(e) => setOrthoNote(e.target.value)}
                  />
                  <button
                    onClick={submitProvisionalPlan}
                    disabled={provisionalSaving}
                    style={{ ...btnStyle(true), opacity: provisionalSaving ? 0.7 : 1 }}
                  >
                    {provisionalSaving ? "Submitting..." : "Submit Provisional Plan →"}
                  </button>
                </>
              )}
            </div>

            {/* ── Final Planning ── */}
            <div>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#111827", display: "block", marginBottom: "8px" }}>
                Final Planning
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
                placeholder="Write the final treatment plan..."
                value={finalPlan}
                onChange={(e) => setFinalPlan(e.target.value)}
              />
            </div>

            {/* ── Video Link ── */}
            <div>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#111827", display: "block", marginBottom: "8px" }}>
                Planning Stimulus Video Link
              </label>
              <input
                type="url"
                style={inputStyle}
                placeholder="Paste YouTube / Drive link..."
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
              />
              <button
                onClick={saveFinalPlan}
                disabled={finalSaving}
                style={{ ...btnStyle(true), width: "auto", padding: "10px 24px", opacity: finalSaving ? 0.7 : 1 }}
              >
                {finalSaving ? "Saving..." : "Save Final Plan & Video"}
              </button>
            </div>

            {/* ── Final Plan Review (upper/lower sets + monthly schedule) ── */}
            <div>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#111827", display: "block", marginBottom: "8px" }}>
                Final Plan Review
              </label>

              {finalReviewSubmitted ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "14px" }}>
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px" }}>
                    Upper: {upperSets} sets · Lower: {lowerSets} sets · {monthlyPlan?.totalMonths} months
                  </p>
                  {monthlyPlan && (
                    <div style={{ display: "grid", gap: "6px" }}>
                      {monthlyPlan.months.map((m) => (
                        <div key={m.num} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "6px 0", borderBottom: "1px dashed #bbf7d0" }}>
                          <span style={{ color: "#111827" }}>
                            Month {m.num} — Upper {alignerRangeLabel(m.upper)}, Lower {alignerRangeLabel(m.lower)}
                          </span>
                          <strong style={{ color: "#111827" }}>{fmtRs(m.amount)}</strong>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", paddingTop: "8px", fontWeight: "700" }}>
                        <span>Total (incl. ₹999 planning fee)</span>
                        <span>{fmtRs(monthlyPlan.months[monthlyPlan.months.length - 1]?.cumulative || 999)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                    <input
                      type="number" min="1" placeholder="Upper arch sets"
                      value={upperSets}
                      onChange={(e) => setUpperSets(e.target.value)}
                      style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                    />
                    <input
                      type="number" min="1" placeholder="Lower arch sets"
                      value={lowerSets}
                      onChange={(e) => setLowerSets(e.target.value)}
                      style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                    />
                  </div>
                  <button
                    onClick={submitFinalReview}
                    disabled={finalReviewSaving}
                    style={{ ...btnStyle(true), opacity: finalReviewSaving ? 0.7 : 1 }}
                  >
                    {finalReviewSaving ? "Generating..." : "Generate Schedule & Submit →"}
                  </button>
                </>
              )}
            </div>

            {/* ── Planning PDF ── */}
            <div>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#111827", display: "block", marginBottom: "8px" }}>
                Planning PDF
              </label>
              {pdfSubmitted ? (
                <div style={{
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: "8px", padding: "14px",
                  fontSize: "14px", color: "#16a34a", fontWeight: "600",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                }}>
                  <span>✓ Plan PDF uploaded</span>
                  <button
                    onClick={() => { setPdfSubmitted(false); setPdfFile(null); }}
                    style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "12px", cursor: "pointer", flexShrink: 0 }}
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <div style={{
                  border: "2px dashed #e5e7eb", borderRadius: "10px",
                  padding: "20px", textAlign: "center", background: "#fafafa",
                }}>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files[0])}
                    style={{ display: "block", margin: "0 auto 12px" }}
                  />
                  {pdfFile && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "12px" }}>
                      <p style={{ fontSize: "13px", color: "#374151", margin: 0 }}>{pdfFile.name}</p>
                      <button
                        onClick={() => setPdfFile(null)}
                        style={{ padding: "2px 8px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "13px", cursor: "pointer", lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <button
                    onClick={uploadPdf}
                    disabled={!pdfFile || pdfUploading}
                    style={{ ...btnStyle(true), opacity: (!pdfFile || pdfUploading) ? 0.6 : 1 }}
                  >
                    {pdfUploading ? "Uploading..." : "Upload PDF"}
                  </button>
                </div>
              )}
            </div>

            {/* ── Select Sheets ── */}
            <div>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#111827", display: "block", marginBottom: "12px" }}>
                Select Sheets
              </label>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                {Object.keys(SHEET_CATS).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveSheetCat(activeSheetCat === cat ? null : cat)}
                    style={{
                      padding: "8px 18px", borderRadius: "99px", border: "none",
                      background: activeSheetCat === cat ? "#111827" : "#f3f4f6",
                      color: activeSheetCat === cat ? "white" : "#374151",
                      fontWeight: "600", fontSize: "13px", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {activeSheetCat === "Attachment Template" && (
                <div style={{ marginBottom: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <select style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={attachmentSheet} onChange={(e) => setAttachmentSheet(e.target.value)}>
                    <option value="">Select sheet...</option>
                    {SHEET_CATS["Attachment Template"].map((n) => (
                      <option key={n} value={String(n)}>{SHEETS[n]}</option>
                    ))}
                  </select>
                  {attachmentSheet && (
                    <button onClick={() => setAttachmentSheet("")} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "16px", cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>×</button>
                  )}
                </div>
              )}

              {activeSheetCat === "Aligner Tray" && (
                <div style={{ marginBottom: "12px" }}>
                  {alignerRows.map((row, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                      <input
                        type="number"
                        placeholder="No. of trays"
                        value={row.trays}
                        onChange={(e) => setAlignerRows(alignerRows.map((r, i) => i === idx ? { ...r, trays: e.target.value } : r))}
                        style={{ ...inputStyle, width: "130px", marginBottom: 0, flexShrink: 0 }}
                      />
                      <select
                        value={row.sheet}
                        onChange={(e) => setAlignerRows(alignerRows.map((r, i) => i === idx ? { ...r, sheet: e.target.value } : r))}
                        style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                      >
                        <option value="">Select sheet...</option>
                        {SHEET_CATS["Aligner Tray"].map((n) => (
                          <option key={n} value={String(n)}>{SHEETS[n]}</option>
                        ))}
                      </select>
                      {row.sheet && (
                        <button
                          onClick={() => setAlignerRows(alignerRows.map((r, i) => i === idx ? { ...r, sheet: "" } : r))}
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "16px", cursor: "pointer", flexShrink: 0, lineHeight: 1 }}
                        >×</button>
                      )}
                      <button
                        onClick={() => setAlignerRows([...alignerRows, { trays: "", sheet: "" }])}
                        style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "white", fontWeight: "700", fontSize: "18px", cursor: "pointer", flexShrink: 0, color: "#111827", lineHeight: 1 }}
                      >+</button>
                      {alignerRows.length > 1 && (
                        <button
                          onClick={() => setAlignerRows(alignerRows.filter((_, i) => i !== idx))}
                          style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#f3f4f6", fontWeight: "700", fontSize: "14px", cursor: "pointer", flexShrink: 0, color: "#6b7280", lineHeight: 1 }}
                        >🗑</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeSheetCat === "Retainer" && (
                <div style={{ marginBottom: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <select style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={retainerSheet} onChange={(e) => setRetainerSheet(e.target.value)}>
                    <option value="">Select sheet...</option>
                    {SHEET_CATS["Retainer"].map((n) => (
                      <option key={n} value={String(n)}>{SHEETS[n]}</option>
                    ))}
                  </select>
                  {retainerSheet && (
                    <button onClick={() => setRetainerSheet("")} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "16px", cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>×</button>
                  )}
                </div>
              )}

              {activeSheetCat && (
                <button
                  onClick={saveSheets}
                  disabled={sheetsSaving}
                  style={{ ...btnStyle(true), width: "auto", padding: "10px 24px", opacity: sheetsSaving ? 0.7 : 1 }}
                >
                  {sheetsSaving ? "Saving..." : sheetsSaved ? "Saved ✓" : "Save Sheet Selection"}
                </button>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
