"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";

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

export default function OrthoCase() {
  const { id } = useParams();
  const router = useRouter();

  const [patient, setPatient] = useState(null);
  const [imageUrls, setImageUrls] = useState({});
  const [stlUrls, setStlUrls] = useState({});
  const [activeSection, setActiveSection] = useState(null);

  // Planning state
  const [provisionalPlan, setProvisionalPlan] = useState("");
  const [provisionalSubmitted, setProvisionalSubmitted] = useState(false);
  const [provisionalSaving, setProvisionalSaving] = useState(false);

  const [orthoNote, setOrthoNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [finalPlan, setFinalPlan] = useState("");
  const [finalSaving, setFinalSaving] = useState(false);

  const [videoLink, setVideoLink] = useState("");

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
      const { data } = await supabase
        .from("appointments_booking")
        .select("*")
        .eq("id", id)
        .single();

      if (!data) return;
      setPatient(data);

      // Planning fields
      if (data.provisional_plan_submitted) {
        setProvisionalSubmitted(true);
        setProvisionalPlan(data.provisional_plan || "");
      }
      setOrthoNote(data.ortho_note || "");
      setFinalPlan(data.final_plan || "");
      setVideoLink(data.planning_video_link || "");
      if (data.plan_pdf_url) setPdfSubmitted(true);
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
    setProvisionalSaving(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({
        provisional_plan: provisionalPlan,
        ortho_note: orthoNote,
        provisional_plan_submitted: true,
      })
      .eq("id", id);
    setProvisionalSaving(false);
    if (error) { alert("Failed to submit plan: " + error.message); return; }
    setProvisionalSubmitted(true);
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
    alert("Final plan saved.");
  };

  // ── SHEET SELECTION ───────────────────────────────────────────
  const saveSheets = async () => {
    setSheetsSaving(true);
    await supabase.from("appointments_booking").update({
      sheet_selection: { activeCategory: activeSheetCat, attachmentSheet, retainerSheet, alignerRows },
    }).eq("id", id);
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
    await supabase
      .from("appointments_booking")
      .update({ plan_pdf_url: path })
      .eq("id", id);
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

  const ViewSection = ({ title, done, children }) => {
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
  };

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
        <ViewSection title="1. Patient Form" done={patient.form_submitted}>
          {patient.form_submitted ? (
            <div style={{ display: "grid", gap: "10px" }}>
              {[
                ["Name", patient.name],
                ["Age", patient.age],
                ["Occupation", patient.occupation],
                ["Chief Complaint", patient.chief_complaint],
                ["Complete History", patient.complete_history],
              ].map(([label, val]) => val ? (
                <div key={label}>
                  <p style={{ fontSize: "12px", color: "gray", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</p>
                  <p style={{ fontSize: "14px", color: "#111827", margin: 0, whiteSpace: "pre-wrap" }}>{val}</p>
                </div>
              ) : null)}
            </div>
          ) : (
            <p style={{ color: "gray", fontSize: "14px", margin: 0 }}>
              Dentist has not submitted the patient form yet.
            </p>
          )}
        </ViewSection>

        {/* ── SECTION 2: IMAGES ── */}
        <ViewSection title="2. Patient Images" done={patient.images_submitted}>
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
        <ViewSection title="3. STL Scan Files" done={patient.stl_submitted}>
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

            {/* ── Provisional Planning + Notes ── */}
            <div>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#111827", display: "block", marginBottom: "8px" }}>
                Provisional Planning
              </label>
              {provisionalSubmitted ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "14px", fontSize: "14px", color: "#111827", whiteSpace: "pre-wrap" }}>
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
                }}>
                  ✓ Plan PDF uploaded
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
                    <p style={{ fontSize: "13px", color: "#374151", marginBottom: "12px" }}>
                      {pdfFile.name}
                    </p>
                  )}
                  <button
                    onClick={uploadPdf}
                    disabled={!pdfFile || pdfUploading}
                    style={btnStyle(!!pdfFile && !pdfUploading)}
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
                <div style={{ marginBottom: "12px" }}>
                  <select style={inputStyle} value={attachmentSheet} onChange={(e) => setAttachmentSheet(e.target.value)}>
                    <option value="">Select sheet...</option>
                    {SHEET_CATS["Attachment Template"].map((n) => (
                      <option key={n} value={String(n)}>{SHEETS[n]}</option>
                    ))}
                  </select>
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
                      <button
                        onClick={() => setAlignerRows([...alignerRows, { trays: "", sheet: "" }])}
                        style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "white", fontWeight: "700", fontSize: "18px", cursor: "pointer", flexShrink: 0, color: "#111827", lineHeight: 1 }}
                      >
                        +
                      </button>
                      {alignerRows.length > 1 && (
                        <button
                          onClick={() => setAlignerRows(alignerRows.filter((_, i) => i !== idx))}
                          style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", fontWeight: "700", fontSize: "16px", cursor: "pointer", flexShrink: 0, color: "#dc2626", lineHeight: 1 }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeSheetCat === "Retainer" && (
                <div style={{ marginBottom: "12px" }}>
                  <select style={inputStyle} value={retainerSheet} onChange={(e) => setRetainerSheet(e.target.value)}>
                    <option value="">Select sheet...</option>
                    {SHEET_CATS["Retainer"].map((n) => (
                      <option key={n} value={String(n)}>{SHEETS[n]}</option>
                    ))}
                  </select>
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
