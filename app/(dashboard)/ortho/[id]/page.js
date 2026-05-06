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

  // ── PROVISIONAL PLAN ──────────────────────────────────────────
  const submitProvisionalPlan = async () => {
    if (!provisionalPlan.trim()) {
      alert("Please write the provisional plan first.");
      return;
    }
    setProvisionalSaving(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({ provisional_plan: provisionalPlan, provisional_plan_submitted: true })
      .eq("id", id);
    setProvisionalSaving(false);
    if (error) { alert("Failed to submit plan: " + error.message); return; }
    setProvisionalSubmitted(true);
  };

  // ── ORTHO NOTE ────────────────────────────────────────────────
  const saveNote = async () => {
    setNoteSaving(true);
    await supabase
      .from("appointments_booking")
      .update({ ortho_note: orthoNote })
      .eq("id", id);
    setNoteSaving(false);
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

            {/* ── Provisional Planning ── */}
            <div>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#111827", display: "block", marginBottom: "8px" }}>
                Provisional Planning
              </label>
              {provisionalSubmitted ? (
                <div style={{
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: "8px", padding: "14px",
                  fontSize: "14px", color: "#111827", whiteSpace: "pre-wrap",
                }}>
                  {provisionalPlan}
                  <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#16a34a", fontWeight: "600" }}>
                    ✓ Submitted to dentist
                  </p>
                </div>
              ) : (
                <>
                  <textarea
                    style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
                    placeholder="Write the provisional treatment plan here..."
                    value={provisionalPlan}
                    onChange={(e) => setProvisionalPlan(e.target.value)}
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

            {/* ── Note ── */}
            <div>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#111827", display: "block", marginBottom: "8px" }}>
                Note
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
                placeholder="Add notes..."
                value={orthoNote}
                onChange={(e) => setOrthoNote(e.target.value)}
              />
              <button
                onClick={saveNote}
                disabled={noteSaving}
                style={{ ...btnStyle(true), width: "auto", padding: "10px 24px", opacity: noteSaving ? 0.7 : 1 }}
              >
                {noteSaving ? "Saving..." : "Save Note"}
              </button>
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

            {/* ── Upload Plan PDF ── */}
            <div>
              <label style={{ fontWeight: "600", fontSize: "14px", color: "#111827", display: "block", marginBottom: "8px" }}>
                Upload Plan PDF
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

          </div>
        </div>

      </div>
    </div>
  );
}
