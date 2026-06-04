"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import { logAudit } from "@/lib/logAudit";

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

const EMPTY_FORM = {
  name: "", age: "", sex: "", weight: "", occupation: "",
  medical_history: "", chief_complaint: "",
  missing_tooth: "", dental_caries: "", deciduous_tooth: "",
  stains: "", calculus: "", recession: "",
  mobile: "", pain: "", sensitivity: "", pregnancy: "",
};

export default function AppointmentWorkflow() {
  const { id } = useParams();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [activeSection, setActiveSection] = useState(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [imagesSubmitted, setImagesSubmitted] = useState(false);
  const [stlSubmitted, setStlSubmitted] = useState(false);
  const [ending, setEnding] = useState(false);
  const [actor, setActor] = useState(null);

  const [provisionalPlan, setProvisionalPlan] = useState("");
  const [provisionalPlanSubmitted, setProvisionalPlanSubmitted] = useState(false);
  const [orthoNote, setOrthoNote] = useState("");

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formDocs, setFormDocs] = useState([]);
  const [formSaving, setFormSaving] = useState(false);
  const [docUploading, setDocUploading] = useState(false);

  const [images, setImages] = useState({});
  const [imagesSaving, setImagesSaving] = useState(false);

  const [stls, setStls] = useState({});
  const [stlSaving, setStlSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: roleData } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
        setActor({ email: authData.user.email || null, role: roleData?.role || "dentist" });
      }

      const { data } = await supabase
        .from("appointments_booking")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        const pfd = data.patient_form_data || {};
        setForm({
          name: data.name || "",
          age: data.age || "",
          sex: pfd.sex || "",
          weight: pfd.weight || "",
          occupation: data.occupation || pfd.occupation || "",
          medical_history: pfd.medical_history || data.complete_history || "",
          chief_complaint: data.chief_complaint || pfd.chief_complaint || "",
          missing_tooth: pfd.missing_tooth || "",
          dental_caries: pfd.dental_caries || "",
          deciduous_tooth: pfd.deciduous_tooth || "",
          stains: pfd.stains || "",
          calculus: pfd.calculus || "",
          recession: pfd.recession || "",
          mobile: pfd.mobile || "",
          pain: pfd.pain || "",
          sensitivity: pfd.sensitivity || "",
          pregnancy: pfd.pregnancy || "",
        });
        setFormDocs(pfd.documents || []);
        if (data.form_submitted) setFormSubmitted(true);
        if (data.images_submitted) setImagesSubmitted(true);
        if (data.stl_submitted) setStlSubmitted(true);
        if (data.provisional_plan_submitted) {
          setProvisionalPlanSubmitted(true);
          setProvisionalPlan(data.provisional_plan || "");
          setOrthoNote(data.ortho_note || "");
        }
      }
    };
    load();
  }, [id]);

  // ─── FORM SUBMIT ────────────────────────────────────────────────
  const submitForm = async () => {
    if (!form.name || !form.age || !form.chief_complaint || !form.medical_history) {
      alert("Please fill in Name, Age, Medical History and Chief Complaint.");
      return;
    }
    setFormSaving(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({
        name: form.name,
        age: form.age,
        occupation: form.occupation,
        chief_complaint: form.chief_complaint,
        complete_history: form.medical_history,
        patient_form_data: { ...form, documents: formDocs },
        form_submitted: true,
      })
      .eq("id", id);
    setFormSaving(false);
    if (error) { alert("Failed to save form."); return; }
    logAudit({ appointmentId: id, actor, action: "Patient Form Submitted", entity: "patient_form_data", newData: { ...form, documents: formDocs } });
    setFormSubmitted(true);
    setActiveSection(null);
  };

  // ─── DOCUMENT UPLOAD ────────────────────────────────────────────
  const handleDocFiles = async (files) => {
    if (!files || files.length === 0) return;
    setDocUploading(true);
    const newDocs = [...formDocs];
    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${id}/docs/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("patient-docs").upload(path, file);
      if (upErr) { alert(`Failed to upload ${file.name}: ${upErr.message}`); continue; }
      const { data: urlData } = supabase.storage.from("patient-docs").getPublicUrl(path);
      newDocs.push({ name: file.name, path, url: urlData.publicUrl, type: file.type, size: file.size, uploadedAt: new Date().toISOString() });
    }
    setFormDocs(newDocs);
    await supabase.from("appointments_booking")
      .update({ patient_form_data: { ...form, documents: newDocs } })
      .eq("id", id);
    setDocUploading(false);
  };

  const removeDoc = async (idx) => {
    const doc = formDocs[idx];
    if (!window.confirm(`Remove "${doc.name}"?`)) return;
    await supabase.storage.from("patient-docs").remove([doc.path]);
    const newDocs = formDocs.filter((_, i) => i !== idx);
    setFormDocs(newDocs);
    await supabase.from("appointments_booking")
      .update({ patient_form_data: { ...form, documents: newDocs } })
      .eq("id", id);
  };

  // ─── IMAGE UPLOAD ────────────────────────────────────────────────
  const handleImageChange = (key, file) => {
    setImages((prev) => ({ ...prev, [key]: file }));
  };

  const allImagesSelected = IMAGE_SLOTS.every((s) => images[s.key]);

  const submitImages = async () => {
    if (!allImagesSelected) { alert("Please upload all 9 images."); return; }
    setImagesSaving(true);
    const paths = {};
    for (const slot of IMAGE_SLOTS) {
      const file = images[slot.key];
      const path = `appointments/${id}/images/${slot.key}_${file.name}`;
      const { error } = await supabase.storage.from("case-files").upload(path, file, { upsert: true });
      if (error) { alert(`Failed to upload ${slot.label}`); setImagesSaving(false); return; }
      paths[slot.key] = path;
    }
    await supabase.from("appointments_booking").update({ image_paths: paths, images_submitted: true }).eq("id", id);
    logAudit({ appointmentId: id, actor, action: "Patient Images Uploaded", entity: "image_paths", newData: { image_slots: Object.keys(paths) } });
    setImagesSaving(false);
    setImagesSubmitted(true);
    setActiveSection(null);
  };

  // ─── STL UPLOAD ──────────────────────────────────────────────────
  const handleStlChange = (key, file) => {
    setStls((prev) => ({ ...prev, [key]: file }));
  };

  const allStlsSelected = STL_SLOTS.every((s) => stls[s.key]);

  const submitStls = async () => {
    if (!allStlsSelected) { alert("Please upload all 4 STL files."); return; }
    setStlSaving(true);
    const paths = {};
    for (const slot of STL_SLOTS) {
      const file = stls[slot.key];
      const path = `appointments/${id}/stl/${slot.key}_${file.name}`;
      const { error } = await supabase.storage.from("case-files").upload(path, file, { upsert: true });
      if (error) { alert(`Failed to upload ${slot.label}`); setStlSaving(false); return; }
      paths[slot.key] = path;
    }
    await supabase.from("appointments_booking").update({ stl_paths: paths, stl_submitted: true }).eq("id", id);
    logAudit({ appointmentId: id, actor, action: "STL Scan Files Uploaded", entity: "stl_paths", newData: { stl_slots: Object.keys(paths) } });
    setStlSaving(false);
    setStlSubmitted(true);
    setActiveSection(null);
  };

  // ─── END APPOINTMENT ─────────────────────────────────────────────
  const allDone = formSubmitted && imagesSubmitted && stlSubmitted;

  const endAppointment = async () => {
    if (!allDone) { alert("Please complete all 3 sections before ending the appointment."); return; }
    const confirmed = window.confirm("End this appointment? It will be marked as completed and cannot be edited again.");
    if (!confirmed) return;
    setEnding(true);
    const { error } = await supabase.from("appointments_booking").update({ status: "completed" }).eq("id", id);
    setEnding(false);
    if (error) { alert("Failed to end appointment."); return; }
    logAudit({ appointmentId: id, actor, action: "Appointment Ended by Dentist", entity: "status", newData: { status: "completed" } });
    alert("Appointment completed successfully!");
    router.push("/dentist");
  };

  // ─── SECTION CARD ─────────────────────────────────────────────────
  const SectionCard = ({ sectionKey, label, done, children }) => {
    const isOpen = activeSection === sectionKey;
    return (
      <div style={{ background: "white", border: `1px solid ${done ? "#22c55e" : "#e5e7eb"}`, borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
        <div
          onClick={() => !done && setActiveSection(isOpen ? null : sectionKey)}
          style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: done ? "default" : "pointer", background: done ? "#f0fdf4" : "white" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: done ? "#22c55e" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "13px", fontWeight: "700", flexShrink: 0 }}>
              {done ? "✓" : ""}
            </span>
            <span style={{ fontWeight: "600", color: done ? "#16a34a" : "#111827" }}>{label}</span>
          </div>
          {done ? (
            <span style={{ color: "#16a34a", fontSize: "13px", fontWeight: "600" }}>Completed</span>
          ) : (
            <span style={{ color: "gray", fontSize: "13px" }}>{isOpen ? "▲" : "▼"}</span>
          )}
        </div>
        {isOpen && !done && (
          <div style={{ padding: "20px", borderTop: "1px solid #e5e7eb" }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  // ─── STYLES ───────────────────────────────────────────────────────
  const inp = {
    width: "100%", padding: "11px 12px", borderRadius: "8px",
    border: "1px solid #e5e7eb", fontSize: "14px",
    outline: "none", boxSizing: "border-box",
    background: "white", color: "#111827",
  };

  const lbl = { display: "block", fontSize: "13px", fontWeight: "700", color: "#111827", marginBottom: "6px" };

  const gr = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" };

  const sf = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div style={{ maxWidth: "680px" }}>
      <h1 style={{ marginBottom: "6px" }}>Appointment</h1>
      <p style={{ color: "gray", fontSize: "13px", marginBottom: "24px" }}>
        Complete all 3 sections to end the appointment.
      </p>

      <div style={{ display: "grid", gap: "14px" }}>

        {/* ── SECTION 1: PATIENT FORM ── */}
        <SectionCard sectionKey="form" label="1. Patient Form" done={formSubmitted}>

          {/* Basic Info */}
          <div style={gr}>
            <div>
              <span style={lbl}>Name *</span>
              <input style={inp} type="text" value={form.name} onChange={sf("name")} />
            </div>
            <div>
              <span style={lbl}>Age *</span>
              <input style={inp} type="number" value={form.age} onChange={sf("age")} />
            </div>
          </div>
          <div style={gr}>
            <div>
              <span style={lbl}>Sex</span>
              <select style={inp} value={form.sex} onChange={sf("sex")}>
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="TRANSGENDER">Transgender</option>
              </select>
            </div>
            <div>
              <span style={lbl}>Weight (kg)</span>
              <input style={inp} type="number" value={form.weight} onChange={sf("weight")} />
            </div>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <span style={lbl}>Occupation</span>
            <input style={inp} type="text" value={form.occupation} onChange={sf("occupation")} />
          </div>

          {/* Medical + Complaint */}
          <div style={{ marginBottom: "16px" }}>
            <span style={lbl}>Medical History *</span>
            <textarea style={{ ...inp, minHeight: "80px", resize: "vertical" }} value={form.medical_history} onChange={sf("medical_history")} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <span style={lbl}>Chief Complaint *</span>
            <textarea style={{ ...inp, minHeight: "80px", resize: "vertical" }} value={form.chief_complaint} onChange={sf("chief_complaint")} />
          </div>

          {/* Dental Examination */}
          <p style={{ fontSize: "11px", fontWeight: "800", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 12px" }}>Dental Examination</p>

          <div style={gr}>
            <div>
              <span style={lbl}>Missing Tooth</span>
              <input style={inp} type="text" value={form.missing_tooth} onChange={sf("missing_tooth")} />
            </div>
            <div>
              <span style={lbl}>Dental Caries</span>
              <input style={inp} type="text" value={form.dental_caries} onChange={sf("dental_caries")} />
            </div>
          </div>
          <div style={gr}>
            <div>
              <span style={lbl}>Deciduous Tooth</span>
              <input style={inp} type="text" value={form.deciduous_tooth} onChange={sf("deciduous_tooth")} />
            </div>
            <div>
              <span style={lbl}>Stains</span>
              <input style={inp} type="text" value={form.stains} onChange={sf("stains")} />
            </div>
          </div>
          <div style={gr}>
            <div>
              <span style={lbl}>Calculus</span>
              <input style={inp} type="text" value={form.calculus} onChange={sf("calculus")} />
            </div>
            <div>
              <span style={lbl}>Recession</span>
              <input style={inp} type="text" value={form.recession} onChange={sf("recession")} />
            </div>
          </div>
          <div style={gr}>
            <div>
              <span style={lbl}>Mobile</span>
              <input style={inp} type="text" value={form.mobile} onChange={sf("mobile")} />
            </div>
            <div>
              <span style={lbl}>Pain</span>
              <input style={inp} type="text" value={form.pain} onChange={sf("pain")} />
            </div>
          </div>
          <div style={{ ...gr, marginBottom: "16px" }}>
            <div>
              <span style={lbl}>Sensitivity</span>
              <input style={inp} type="text" value={form.sensitivity} onChange={sf("sensitivity")} />
            </div>
            <div>
              <span style={lbl}>Pregnancy</span>
              <input style={inp} type="text" value={form.pregnancy} onChange={sf("pregnancy")} />
            </div>
          </div>

          {/* Upload Documents */}
          <div style={{ marginBottom: "16px" }}>
            <span style={lbl}>Upload Documents</span>
            <p style={{ fontSize: "11px", color: "#6b7280", margin: "0 0 8px" }}>Photos (JPG, PNG) and PDFs — multiple files allowed</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              style={{ display: "none" }}
              onChange={(e) => { handleDocFiles(e.target.files); e.target.value = ""; }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={docUploading}
              style={{
                width: "100%", padding: "12px", borderRadius: "8px",
                border: "2px dashed #d1d5db", background: "#fafafa",
                color: "#374151", fontWeight: "600", fontSize: "13px",
                cursor: docUploading ? "not-allowed" : "pointer",
                opacity: docUploading ? 0.6 : 1,
                marginBottom: formDocs.length ? "10px" : 0,
              }}
            >
              {docUploading ? "⏳ Uploading..." : "📎 Click to choose files"}
            </button>
            {formDocs.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {formDocs.map((doc, idx) => {
                  const isImg = doc.type?.startsWith("image/");
                  return (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#f9fafb" }}>
                      <span style={{ fontSize: "18px" }}>{isImg ? "🖼️" : "📄"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</p>
                        {doc.size && <p style={{ margin: 0, fontSize: "10px", color: "#9ca3af" }}>{(doc.size / 1024).toFixed(0)} KB</p>}
                      </div>
                      <a href={doc.url} target="_blank" rel="noreferrer" style={{ padding: "4px 10px", borderRadius: "6px", background: "#111827", color: "white", fontWeight: "700", fontSize: "10px", textDecoration: "none" }}>View</a>
                      <button onClick={() => removeDoc(idx)} style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "10px", cursor: "pointer" }}>Remove</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={submitForm}
            disabled={formSaving}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "#111827", color: "white", fontWeight: "600", cursor: "pointer", opacity: formSaving ? 0.7 : 1 }}
          >
            {formSaving ? "Saving..." : "Submit Form"}
          </button>
        </SectionCard>

        {/* ── SECTION 2: IMAGES ── */}
        <SectionCard sectionKey="images" label="2. Upload Images (9 required)" done={imagesSubmitted}>
          <p style={{ fontSize: "13px", color: "gray", marginBottom: "16px" }}>Upload all 9 required photos before submitting.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {IMAGE_SLOTS.map((slot) => (
              <div key={slot.key} style={{ border: `2px dashed ${images[slot.key] ? "#22c55e" : "#e5e7eb"}`, borderRadius: "10px", padding: "10px", textAlign: "center", background: images[slot.key] ? "#f0fdf4" : "#fafafa" }}>
                <p style={{ fontSize: "11px", fontWeight: "600", marginBottom: "6px", color: "#374151" }}>{slot.label}</p>
                {images[slot.key] ? (
                  <div>
                    <p style={{ fontSize: "10px", color: "#16a34a", margin: "0 0 4px" }}>✓ Selected</p>
                    <p style={{ fontSize: "10px", color: "gray", margin: 0, wordBreak: "break-all" }}>{images[slot.key].name.substring(0, 16)}...</p>
                  </div>
                ) : (
                  <label style={{ cursor: "pointer" }}>
                    <span style={{ fontSize: "11px", color: "#6b7280" }}>Tap to upload</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleImageChange(slot.key, e.target.files[0])} />
                  </label>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={submitImages}
            disabled={!allImagesSelected || imagesSaving}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: allImagesSelected ? "#111827" : "#e5e7eb", color: allImagesSelected ? "white" : "#9ca3af", fontWeight: "600", cursor: allImagesSelected ? "pointer" : "not-allowed", opacity: imagesSaving ? 0.7 : 1 }}
          >
            {imagesSaving ? "Uploading..." : `Submit Images (${Object.keys(images).length}/9)`}
          </button>
        </SectionCard>

        {/* ── SECTION 3: STL FILES ── */}
        <SectionCard sectionKey="stl" label="3. Upload STL Files (4 required)" done={stlSubmitted}>
          <p style={{ fontSize: "13px", color: "gray", marginBottom: "16px" }}>Upload all 4 scan files before submitting.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {STL_SLOTS.map((slot) => (
              <div key={slot.key} style={{ border: `2px dashed ${stls[slot.key] ? "#22c55e" : "#e5e7eb"}`, borderRadius: "10px", padding: "14px", textAlign: "center", background: stls[slot.key] ? "#f0fdf4" : "#fafafa" }}>
                <p style={{ fontSize: "12px", fontWeight: "600", marginBottom: "8px", color: "#374151" }}>{slot.label}</p>
                {stls[slot.key] ? (
                  <p style={{ fontSize: "11px", color: "#16a34a", margin: 0 }}>✓ {stls[slot.key].name.substring(0, 18)}...</p>
                ) : (
                  <label style={{ cursor: "pointer" }}>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Tap to upload</span>
                    <input type="file" accept=".stl,.obj,.ply" style={{ display: "none" }} onChange={(e) => handleStlChange(slot.key, e.target.files[0])} />
                  </label>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={submitStls}
            disabled={!allStlsSelected || stlSaving}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: allStlsSelected ? "#111827" : "#e5e7eb", color: allStlsSelected ? "white" : "#9ca3af", fontWeight: "600", cursor: allStlsSelected ? "pointer" : "not-allowed", opacity: stlSaving ? 0.7 : 1 }}
          >
            {stlSaving ? "Uploading..." : `Submit STL Files (${Object.keys(stls).length}/4)`}
          </button>
        </SectionCard>

      </div>

      {/* ── SECTION 4: PROVISIONAL PLANNING ── */}
      <div style={{ marginTop: "14px", background: "white", border: "1px solid #e5e7eb", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "18px 20px", background: provisionalPlanSubmitted ? "#f0fdf4" : "#fafafa", borderBottom: "1px solid #e5e7eb" }}>
          <span style={{ fontWeight: "600", color: provisionalPlanSubmitted ? "#16a34a" : "#111827" }}>4. Provisional Planning</span>
          {provisionalPlanSubmitted && (
            <span style={{ marginLeft: "10px", fontSize: "12px", color: "#16a34a", fontWeight: "600" }}>✓ Submitted by orthodontist</span>
          )}
        </div>
        <div style={{ padding: "20px" }}>
          {provisionalPlanSubmitted ? (
            <div>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "14px", fontSize: "14px", color: "#111827", whiteSpace: "pre-wrap", lineHeight: "1.6", marginBottom: orthoNote ? "12px" : 0 }}>
                {provisionalPlan}
              </div>
              {orthoNote ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "14px" }}>
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 6px" }}>Notes from Orthodontist</p>
                  <p style={{ margin: 0, fontSize: "14px", color: "#111827", whiteSpace: "pre-wrap", lineHeight: "1.6" }}>{orthoNote}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p style={{ color: "gray", fontSize: "14px", margin: 0 }}>Waiting for orthodontist to submit the provisional plan...</p>
          )}
        </div>
      </div>

      {/* ── END APPOINTMENT ── */}
      <div style={{ marginTop: "24px", padding: "20px", background: allDone ? "#f0fdf4" : "#f9fafb", borderRadius: "16px", border: `1px solid ${allDone ? "#22c55e" : "#e5e7eb"}` }}>
        {!allDone && (
          <p style={{ fontSize: "13px", color: "gray", marginBottom: "12px", textAlign: "center" }}>
            Complete all 3 sections above to end the appointment.
          </p>
        )}
        <button
          onClick={endAppointment}
          disabled={!allDone || ending}
          style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: allDone ? "#dc2626" : "#e5e7eb", color: allDone ? "white" : "#9ca3af", fontWeight: "700", fontSize: "15px", cursor: allDone ? "pointer" : "not-allowed", opacity: ending ? 0.7 : 1 }}
        >
          {ending ? "Ending..." : "🏁 End Appointment"}
        </button>
      </div>
    </div>
  );
}
