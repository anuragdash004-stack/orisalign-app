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

const PROCEDURE_OPTIONS = ["Restorations", "Root Canal", "Scaling", "Extraction", "Gingival Therapy", "Others"];

// FDI tooth numbering — four quadrant columns.
const ADULT_QUADRANTS = [
  [11, 12, 13, 14, 15, 16, 17, 18],
  [21, 22, 23, 24, 25, 26, 27, 28],
  [31, 32, 33, 34, 35, 36, 37, 38],
  [41, 42, 43, 44, 45, 46, 47, 48],
];
const CHILD_QUADRANTS = [
  [51, 52, 53, 54, 55],
  [61, 62, 63, 64, 65],
  [71, 72, 73, 74, 75],
  [81, 82, 83, 84, 85],
];
const GRADE_OPTIONS = ["+", "++", "+++"];

const asArr = (v) => (Array.isArray(v) ? v : []);

const EMPTY_FORM = {
  name: "", age: "", sex: "", weight: "", occupation: "",
  medical_history: "", chief_complaint: "", notes: "",
  missing_tooth: [], dental_caries: [], deciduous_tooth: [],
  stains: "", calculus: "", recession: [],
  mobility: [], pain: [], sensitivity: [], pregnancy: "",
  pre_orthodontic_procedures: [],
  pre_orthodontic_others: "",
};

// Wraps a single-choice control with a Cancel button shown when it has a value.
function Clearable({ show, onClear, children }) {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "stretch" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {show && (
        <button
          type="button"
          onClick={onClear}
          title="Clear selection"
          style={{ flexShrink: 0, padding: "0 12px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Multi-select FDI tooth picker. `dentition` = "adult" | "child".
function ToothField({ label, dentition, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState([]);
  const quadrants = dentition === "child" ? CHILD_QUADRANTS : ADULT_QUADRANTS;
  const selected = Array.isArray(value) ? value : [];

  const openPicker = () => { setTemp(selected); setOpen(true); };
  const toggleTooth = (t) => setTemp((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const add = () => { onChange([...temp].sort((a, b) => a - b)); setOpen(false); };

  const lblStyle = { display: "block", fontSize: "13px", fontWeight: "700", color: "var(--admin-ink, #1b2a4a)", marginBottom: "6px" };

  return (
    <div style={{ marginBottom: "14px" }}>
      <span style={lblStyle}>{label}</span>
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          type="button"
          onClick={openPicker}
          style={{
            flex: 1, minHeight: "42px", padding: "9px 12px", borderRadius: "8px",
            border: "1px solid var(--admin-line, #e9e1d0)", background: "white", textAlign: "left",
            fontSize: "14px", cursor: "pointer", color: selected.length ? "var(--admin-ink, #1b2a4a)" : "var(--admin-ink2, #837a66)",
          }}
        >
          {selected.length ? selected.join(", ") : "Tap to select teeth"}
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            title="Clear"
            style={{ flexShrink: 0, padding: "0 14px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
          >
            Cancel
          </button>
        )}
      </div>

      {open && (
        <div style={{ marginTop: "8px", border: "1px solid var(--admin-line, #e9e1d0)", borderRadius: "10px", padding: "12px", background: "#fafafa" }}>
          <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: "var(--admin-ink2, #837a66)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {dentition === "child" ? "Child Dentition" : "Adult Dentition"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
            {quadrants.map((col, ci) => (
              <div key={ci} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {col.map((t) => {
                  const on = temp.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTooth(t)}
                      style={{
                        padding: "8px 0", borderRadius: "7px", fontSize: "13px", fontWeight: "700", cursor: "pointer",
                        border: on ? "none" : "1px solid #d1d5db",
                        background: on ? "#168F83" : "white",
                        color: on ? "white" : "var(--admin-ink, #1b2a4a)",
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--admin-line, #e9e1d0)", background: "white", color: "var(--admin-ink, #1b2a4a)", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={add}
              style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "var(--admin-ink, #1b2a4a)", color: "white", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
            >
              Add ({temp.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ sectionKey, label, done, activeSection, setActiveSection, children }) {
  const isOpen = activeSection === sectionKey;
  return (
    <div style={{ background: "white", border: `1px solid ${done ? "#3FB3A4" : "var(--admin-line, #e9e1d0)"}`, borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
      <div
        onClick={() => !done && setActiveSection(isOpen ? null : sectionKey)}
        style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: done ? "default" : "pointer", background: done ? "#EAF7F5" : "white" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: done ? "#3FB3A4" : "var(--admin-line, #e9e1d0)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "13px", fontWeight: "700", flexShrink: 0 }}>
            {done ? "✓" : ""}
          </span>
          <span style={{ fontWeight: "600", color: done ? "#168F83" : "var(--admin-ink, #1b2a4a)" }}>{label}</span>
        </div>
        {done ? (
          <span style={{ color: "#168F83", fontSize: "13px", fontWeight: "600" }}>Completed</span>
        ) : (
          <span style={{ color: "gray", fontSize: "13px" }}>{isOpen ? "▲" : "▼"}</span>
        )}
      </div>
      {isOpen && !done && (
        <div style={{ padding: "20px", borderTop: "1px solid var(--admin-line, #e9e1d0)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

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

  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState([]);
  const [procedureOthersText, setProcedureOthersText] = useState("");

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
          notes: pfd.notes || "",
          missing_tooth: asArr(pfd.missing_tooth),
          dental_caries: asArr(pfd.dental_caries),
          deciduous_tooth: asArr(pfd.deciduous_tooth),
          stains: pfd.stains || "",
          calculus: pfd.calculus || "",
          recession: asArr(pfd.recession),
          mobility: asArr(pfd.mobility),
          pain: asArr(pfd.pain),
          sensitivity: asArr(pfd.sensitivity),
          pregnancy: pfd.pregnancy || "",
          pre_orthodontic_procedures: pfd.pre_orthodontic_procedures || [],
          pre_orthodontic_others: pfd.pre_orthodontic_others || "",
        });
        setFormDocs(pfd.documents || []);
        setSelectedProcedures(pfd.pre_orthodontic_procedures || []);
        setProcedureOthersText(pfd.pre_orthodontic_others || "");
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
    const updatedForm = {
      ...form,
      pregnancy: form.sex === "FEMALE" ? form.pregnancy : "Not Applicable",
      pre_orthodontic_procedures: selectedProcedures,
      pre_orthodontic_others: procedureOthersText,
    };
    const { error } = await supabase
      .from("appointments_booking")
      .update({
        name: form.name,
        age: form.age,
        occupation: form.occupation,
        chief_complaint: form.chief_complaint,
        complete_history: form.medical_history,
        patient_form_data: { ...updatedForm, documents: formDocs },
        form_submitted: true,
      })
      .eq("id", id);
    setFormSaving(false);
    if (error) { alert("Failed to save form."); return; }
    logAudit({ appointmentId: id, actor, action: "Patient Form Submitted", entity: "patient_form_data", newData: { ...updatedForm, documents: formDocs } });
    setFormSubmitted(true);
    setActiveSection(null);
  };

  // ─── PRE-ORTHODONTIC PROCEDURES ────────────────────────────────
  const handleProcedureToggle = (procedure) => {
    setSelectedProcedures((prev) =>
      prev.includes(procedure)
        ? prev.filter((p) => p !== procedure)
        : [...prev, procedure]
    );
  };

  const submitProcedures = async () => {
    const updatedForm = {
      ...form,
      pre_orthodontic_procedures: selectedProcedures,
      pre_orthodontic_others: procedureOthersText,
    };
    await supabase
      .from("appointments_booking")
      .update({ patient_form_data: { ...updatedForm, documents: formDocs } })
      .eq("id", id);
    setShowProcedureModal(false);
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

  const removeImage = (key) => {
    setImages((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
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

  const removeStl = (key) => {
    setStls((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
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

    // Fetch current journey_steps
    const { data: apptData } = await supabase
      .from("appointments_booking")
      .select("journey_steps")
      .eq("id", id)
      .single();

    const updatedJourneySteps = {
      ...(apptData?.journey_steps || {}),
      scanning_done: true,
    };

    const { error } = await supabase.from("appointments_booking").update({
      status: "completed",
      journey_steps: updatedJourneySteps,
      stl_submitted: true
    }).eq("id", id);

    setEnding(false);
    if (error) { alert("Failed to end appointment."); return; }
    logAudit({ appointmentId: id, actor, action: "Appointment Ended by Dentist", entity: "status", newData: { status: "completed", scanning_done: true } });

    // Notify patient of scanning_done step
    await fetch("/api/notify-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: id, stepKey: "scanning_done" }),
    }).catch(() => {});

    alert("Appointment completed successfully!");
    router.push("/dentist");
  };

  // ─── STYLES ───────────────────────────────────────────────────────
  const inp = {
    width: "100%", padding: "11px 12px", borderRadius: "8px",
    border: "1px solid var(--admin-line, #e9e1d0)", fontSize: "14px",
    outline: "none", boxSizing: "border-box",
    background: "white", color: "var(--admin-ink, #1b2a4a)",
  };

  const lbl = { display: "block", fontSize: "13px", fontWeight: "700", color: "var(--admin-ink, #1b2a4a)", marginBottom: "6px" };

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
        <SectionCard sectionKey="form" label="1. Patient Form" done={formSubmitted} activeSection={activeSection} setActiveSection={setActiveSection}>

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
              <Clearable show={!!form.sex} onClear={() => setForm((p) => ({ ...p, sex: "" }))}>
                <select style={inp} value={form.sex} onChange={sf("sex")}>
                  <option value="">Select</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHERS">Others</option>
                </select>
              </Clearable>
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
          <div style={{ marginBottom: "16px" }}>
            <span style={lbl}>Notes</span>
            <textarea style={{ ...inp, minHeight: "70px", resize: "vertical" }} value={form.notes} onChange={sf("notes")} placeholder="Any additional notes..." />
          </div>

          {/* Dental Examination */}
          <p style={{ fontSize: "11px", fontWeight: "800", color: "var(--admin-ink2, #837a66)", textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 12px" }}>Dental Examination</p>

          <ToothField label="Dental Caries" dentition="adult" value={form.dental_caries} onChange={(v) => setForm((p) => ({ ...p, dental_caries: v }))} />
          <ToothField label="Missing Tooth" dentition="adult" value={form.missing_tooth} onChange={(v) => setForm((p) => ({ ...p, missing_tooth: v }))} />
          <ToothField label="Pain" dentition="adult" value={form.pain} onChange={(v) => setForm((p) => ({ ...p, pain: v }))} />
          <ToothField label="Sensitivity" dentition="adult" value={form.sensitivity} onChange={(v) => setForm((p) => ({ ...p, sensitivity: v }))} />
          <ToothField label="Mobility" dentition="adult" value={form.mobility} onChange={(v) => setForm((p) => ({ ...p, mobility: v }))} />
          <ToothField label="Recession" dentition="adult" value={form.recession} onChange={(v) => setForm((p) => ({ ...p, recession: v }))} />
          <ToothField label="Deciduous Tooth" dentition="child" value={form.deciduous_tooth} onChange={(v) => setForm((p) => ({ ...p, deciduous_tooth: v }))} />

          <div style={gr}>
            <div>
              <span style={lbl}>Stains</span>
              <Clearable show={!!form.stains} onClear={() => setForm((p) => ({ ...p, stains: "" }))}>
                <select style={inp} value={form.stains} onChange={sf("stains")}>
                  <option value="">—</option>
                  {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Clearable>
            </div>
            <div>
              <span style={lbl}>Calculus</span>
              <Clearable show={!!form.calculus} onClear={() => setForm((p) => ({ ...p, calculus: "" }))}>
                <select style={inp} value={form.calculus} onChange={sf("calculus")}>
                  <option value="">—</option>
                  {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Clearable>
            </div>
          </div>
          <div style={{ ...gr, marginBottom: "16px" }}>
            <div>
              <span style={lbl}>Pregnancy</span>
              {form.sex === "FEMALE" ? (
                <Clearable show={!!form.pregnancy} onClear={() => setForm((p) => ({ ...p, pregnancy: "" }))}>
                  <select style={inp} value={form.pregnancy} onChange={sf("pregnancy")}>
                    <option value="">—</option>
                    <option value="YES">Yes</option>
                    <option value="NO">No</option>
                  </select>
                </Clearable>
              ) : (
                <input style={{ ...inp, background: "var(--admin-gold-wash, #f3f0e6)", color: "var(--admin-ink2, #837a66)" }} type="text" value="Not Applicable" readOnly />
              )}
            </div>
          </div>

          {/* Pre-Orthodontic Procedures */}
          <div style={{ marginBottom: "16px" }}>
            <span style={lbl}>Pre-orthodontic Procedures</span>
            <button
              onClick={() => setShowProcedureModal(true)}
              style={{
                width: "100%", padding: "12px", borderRadius: "8px",
                border: "2px solid #d1d5db", background: "white",
                color: "var(--admin-ink, #1b2a4a)", fontWeight: "600", fontSize: "13px",
                cursor: "pointer", marginBottom: "8px",
              }}
            >
              {selectedProcedures.length === 0 ? "Select Procedures" : `${selectedProcedures.length} selected`}
            </button>
            {selectedProcedures.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {selectedProcedures.map((proc) => (
                  <div
                    key={proc}
                    style={{
                      padding: "8px 12px", borderRadius: "8px", border: "1px solid #3FB3A4",
                      background: "#EAF7F5", fontSize: "13px", color: "#168F83",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <span>{proc}</span>
                    <button
                      onClick={() => handleProcedureToggle(proc)}
                      style={{
                        background: "none", border: "none", color: "#dc2626",
                        cursor: "pointer", fontSize: "16px", padding: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {selectedProcedures.includes("Others") && (
                  <div style={{ marginTop: "6px" }}>
                    <span style={lbl}>Other Procedures</span>
                    <textarea
                      value={procedureOthersText}
                      onChange={(e) => setProcedureOthersText(e.target.value)}
                      style={{ ...inp, minHeight: "60px", resize: "vertical" }}
                      placeholder="Describe other pre-orthodontic procedures..."
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Procedure Selection Modal */}
          {showProcedureModal && (
            <div style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000,
            }}>
              <div style={{
                background: "white", borderRadius: "12px", padding: "24px",
                maxWidth: "400px", width: "90%", boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
              }}>
                <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "16px", fontWeight: "700" }}>
                  Select Pre-orthodontic Procedures
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                  {PROCEDURE_OPTIONS.map((proc) => (
                    <label
                      key={proc}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--admin-line, #e9e1d0)",
                        cursor: "pointer", background: selectedProcedures.includes(proc) ? "#EAF7F5" : "white",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProcedures.includes(proc)}
                        onChange={() => handleProcedureToggle(proc)}
                        style={{ cursor: "pointer", width: "18px", height: "18px" }}
                      />
                      <span style={{ fontSize: "14px", fontWeight: "500", color: "var(--admin-ink, #1b2a4a)" }}>{proc}</span>
                    </label>
                  ))}
                </div>
                {selectedProcedures.includes("Others") && (
                  <div style={{ marginBottom: "16px" }}>
                    <span style={lbl}>Other Procedures</span>
                    <textarea
                      value={procedureOthersText}
                      onChange={(e) => setProcedureOthersText(e.target.value)}
                      style={{ ...inp, minHeight: "60px", resize: "vertical" }}
                      placeholder="Describe other pre-orthodontic procedures..."
                    />
                  </div>
                )}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => setShowProcedureModal(false)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: "8px",
                      border: "1px solid var(--admin-line, #e9e1d0)", background: "white",
                      color: "var(--admin-ink, #1b2a4a)", fontWeight: "600", fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitProcedures}
                    style={{
                      flex: 1, padding: "10px", borderRadius: "8px",
                      border: "none", background: "var(--admin-ink, #1b2a4a)",
                      color: "white", fontWeight: "600", fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upload Documents */}
          <div style={{ marginBottom: "16px" }}>
            <span style={lbl}>Upload Documents</span>
            <p style={{ fontSize: "11px", color: "var(--admin-ink2, #837a66)", margin: "0 0 8px" }}>Photos (JPG, PNG) and PDFs — multiple files allowed</p>
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
                color: "var(--admin-ink, #1b2a4a)", fontWeight: "600", fontSize: "13px",
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
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--admin-line, #e9e1d0)", background: "var(--admin-bg, #faf6ec)" }}>
                      <span style={{ fontSize: "18px" }}>{isImg ? "🖼️" : "📄"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "var(--admin-ink, #1b2a4a)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</p>
                        {doc.size && <p style={{ margin: 0, fontSize: "10px", color: "var(--admin-ink2, #837a66)" }}>{(doc.size / 1024).toFixed(0)} KB</p>}
                      </div>
                      <a href={doc.url} target="_blank" rel="noreferrer" style={{ padding: "4px 10px", borderRadius: "6px", background: "var(--admin-ink, #1b2a4a)", color: "white", fontWeight: "700", fontSize: "10px", textDecoration: "none" }}>View</a>
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
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "var(--admin-ink, #1b2a4a)", color: "white", fontWeight: "600", cursor: "pointer", opacity: formSaving ? 0.7 : 1 }}
          >
            {formSaving ? "Saving..." : "Submit Form"}
          </button>
        </SectionCard>

        {/* ── SECTION 2: IMAGES ── */}
        <SectionCard sectionKey="images" label="2. Upload Images (9 required)" done={imagesSubmitted} activeSection={activeSection} setActiveSection={setActiveSection}>
          <p style={{ fontSize: "13px", color: "gray", marginBottom: "16px" }}>Upload all 9 required photos before submitting.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {IMAGE_SLOTS.map((slot) => (
              <div key={slot.key} style={{ border: `2px dashed ${images[slot.key] ? "#3FB3A4" : "var(--admin-line, #e9e1d0)"}`, borderRadius: "10px", padding: "10px", textAlign: "center", background: images[slot.key] ? "#EAF7F5" : "#fafafa" }}>
                <p style={{ fontSize: "11px", fontWeight: "600", marginBottom: "6px", color: "var(--admin-ink, #1b2a4a)" }}>{slot.label}</p>
                {images[slot.key] ? (
                  <div>
                    <p style={{ fontSize: "10px", color: "#168F83", margin: "0 0 4px" }}>✓ Selected</p>
                    <p style={{ fontSize: "10px", color: "gray", margin: "0 0 6px", wordBreak: "break-all" }}>{images[slot.key].name.substring(0, 16)}...</p>
                    <button
                      onClick={() => removeImage(slot.key)}
                      style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "10px", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <label style={{ cursor: "pointer" }}>
                    <span style={{ fontSize: "11px", color: "var(--admin-ink2, #837a66)" }}>Tap to upload</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleImageChange(slot.key, e.target.files[0])} />
                  </label>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={submitImages}
            disabled={!allImagesSelected || imagesSaving}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: allImagesSelected ? "var(--admin-ink, #1b2a4a)" : "var(--admin-line, #e9e1d0)", color: allImagesSelected ? "white" : "var(--admin-ink2, #837a66)", fontWeight: "600", cursor: allImagesSelected ? "pointer" : "not-allowed", opacity: imagesSaving ? 0.7 : 1 }}
          >
            {imagesSaving ? "Uploading..." : `Submit Images (${Object.keys(images).length}/9)`}
          </button>
        </SectionCard>

        {/* ── SECTION 3: STL FILES ── */}
        <SectionCard sectionKey="stl" label="3. Upload STL Files (4 required)" done={stlSubmitted} activeSection={activeSection} setActiveSection={setActiveSection}>
          <p style={{ fontSize: "13px", color: "gray", marginBottom: "16px" }}>Upload all 4 scan files before submitting.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {STL_SLOTS.map((slot) => (
              <div key={slot.key} style={{ border: `2px dashed ${stls[slot.key] ? "#3FB3A4" : "var(--admin-line, #e9e1d0)"}`, borderRadius: "10px", padding: "14px", textAlign: "center", background: stls[slot.key] ? "#EAF7F5" : "#fafafa" }}>
                <p style={{ fontSize: "12px", fontWeight: "600", marginBottom: "8px", color: "var(--admin-ink, #1b2a4a)" }}>{slot.label}</p>
                {stls[slot.key] ? (
                  <div>
                    <p style={{ fontSize: "11px", color: "#168F83", margin: "0 0 6px" }}>✓ {stls[slot.key].name.substring(0, 18)}...</p>
                    <button
                      onClick={() => removeStl(slot.key)}
                      style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "10px", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <label style={{ cursor: "pointer" }}>
                    <span style={{ fontSize: "12px", color: "var(--admin-ink2, #837a66)" }}>Tap to upload</span>
                    <input type="file" accept=".stl,.obj,.ply" style={{ display: "none" }} onChange={(e) => handleStlChange(slot.key, e.target.files[0])} />
                  </label>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={submitStls}
            disabled={!allStlsSelected || stlSaving}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: allStlsSelected ? "var(--admin-ink, #1b2a4a)" : "var(--admin-line, #e9e1d0)", color: allStlsSelected ? "white" : "var(--admin-ink2, #837a66)", fontWeight: "600", cursor: allStlsSelected ? "pointer" : "not-allowed", opacity: stlSaving ? 0.7 : 1 }}
          >
            {stlSaving ? "Uploading..." : `Submit STL Files (${Object.keys(stls).length}/4)`}
          </button>
        </SectionCard>

      </div>

      {/* ── SECTION 4: PROVISIONAL PLANNING ── */}
      <div style={{ marginTop: "14px", background: "white", border: "1px solid var(--admin-line, #e9e1d0)", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "18px 20px", background: provisionalPlanSubmitted ? "#EAF7F5" : "#fafafa", borderBottom: "1px solid var(--admin-line, #e9e1d0)" }}>
          <span style={{ fontWeight: "600", color: provisionalPlanSubmitted ? "#168F83" : "var(--admin-ink, #1b2a4a)" }}>4. Provisional Planning</span>
          {provisionalPlanSubmitted && (
            <span style={{ marginLeft: "10px", fontSize: "12px", color: "#168F83", fontWeight: "600" }}>✓ Submitted by orthodontist</span>
          )}
        </div>
        <div style={{ padding: "20px" }}>
          {provisionalPlanSubmitted ? (
            <div>
              <div style={{ background: "#EAF7F5", border: "1px solid #9FD8D1", borderRadius: "8px", padding: "14px", fontSize: "14px", color: "var(--admin-ink, #1b2a4a)", whiteSpace: "pre-wrap", lineHeight: "1.6", marginBottom: orthoNote ? "12px" : 0 }}>
                {provisionalPlan}
              </div>
              {orthoNote ? (
                <div style={{ background: "#EAF7F5", border: "1px solid #9FD8D1", borderRadius: "8px", padding: "14px" }}>
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "#168F83", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 6px" }}>Notes from Orthodontist</p>
                  <p style={{ margin: 0, fontSize: "14px", color: "var(--admin-ink, #1b2a4a)", whiteSpace: "pre-wrap", lineHeight: "1.6" }}>{orthoNote}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p style={{ color: "gray", fontSize: "14px", margin: 0 }}>Waiting for orthodontist to submit the provisional plan...</p>
          )}
        </div>
      </div>

      {/* ── END APPOINTMENT ── */}
      <div style={{ marginTop: "24px", padding: "20px", background: allDone ? "#EAF7F5" : "var(--admin-bg, #faf6ec)", borderRadius: "16px", border: `1px solid ${allDone ? "#3FB3A4" : "var(--admin-line, #e9e1d0)"}` }}>
        {!allDone && (
          <p style={{ fontSize: "13px", color: "gray", marginBottom: "12px", textAlign: "center" }}>
            Complete all 3 sections above to end the appointment.
          </p>
        )}
        <button
          onClick={endAppointment}
          disabled={!allDone || ending}
          style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: allDone ? "#dc2626" : "var(--admin-line, #e9e1d0)", color: allDone ? "white" : "var(--admin-ink2, #837a66)", fontWeight: "700", fontSize: "15px", cursor: allDone ? "pointer" : "not-allowed", opacity: ending ? 0.7 : 1 }}
        >
          {ending ? "Ending..." : "🏁 End Appointment"}
        </button>
      </div>
    </div>
  );
}
