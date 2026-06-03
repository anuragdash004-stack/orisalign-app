"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";

const supabase = getSupabaseClient();

const IMAGE_SLOTS = [
  { key: "left_occlusion",    label: "Left Occlusion" },
  { key: "right_occlusion",   label: "Right Occlusion" },
  { key: "center_occlusion",  label: "Center Occlusion" },
  { key: "upper",             label: "Upper" },
  { key: "lower",             label: "Lower" },
  { key: "front_profile",     label: "Front Profile" },
  { key: "right_profile",     label: "Right Profile" },
  { key: "smile_45",          label: "45° Smile" },
  { key: "smile_front",       label: "Front Smile" },
];

const STL_SLOTS = [
  { key: "bite_scan_1", label: "Bite Scan 1" },
  { key: "bite_scan_2", label: "Bite Scan 2" },
  { key: "upper_scan",  label: "Upper Scan" },
  { key: "lower_scan",  label: "Lower Scan" },
];

export default function AppointmentWorkflow() {
  const { id } = useParams();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState(null); // "form" | "images" | "stl"
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [imagesSubmitted, setImagesSubmitted] = useState(false);
  const [stlSubmitted, setStlSubmitted] = useState(false);
  const [ending, setEnding] = useState(false);

  // Provisional plan (from ortho, readonly)
  const [provisionalPlan, setProvisionalPlan] = useState("");
  const [provisionalPlanSubmitted, setProvisionalPlanSubmitted] = useState(false);

  // Dentist note
  const [dentistNote, setDentistNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "", age: "", occupation: "",
    chief_complaint: "", complete_history: "",
  });
  const [formSaving, setFormSaving] = useState(false);

  // Image state
  const [images, setImages] = useState({});
  const [imagesSaving, setImagesSaving] = useState(false);

  // STL state
  const [stls, setStls] = useState({});
  const [stlSaving, setStlSaving] = useState(false);

  // Load existing patient data
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("appointments_booking")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setForm({
          name: data.name || "",
          age: data.age || "",
          occupation: data.occupation || "",
          chief_complaint: data.chief_complaint || "",
          complete_history: data.complete_history || "",
        });
        if (data.form_submitted) setFormSubmitted(true);
        if (data.images_submitted) setImagesSubmitted(true);
        if (data.stl_submitted) setStlSubmitted(true);
        if (data.provisional_plan_submitted) {
          setProvisionalPlanSubmitted(true);
          setProvisionalPlan(data.provisional_plan || "");
        }
        setDentistNote(data.dentist_note || "");
      }
    };
    load();
  }, [id]);

  // ─── FORM SUBMIT ────────────────────────────────────────────────
  const submitForm = async () => {
    if (!form.name || !form.age || !form.chief_complaint || !form.complete_history) {
      alert("Please fill in all required fields.");
      return;
    }
    setFormSaving(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({ ...form, form_submitted: true })
      .eq("id", id);
    setFormSaving(false);
    if (error) { alert("Failed to save form."); return; }
    setFormSubmitted(true);
    setActiveSection(null);
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
      const { error } = await supabase.storage
        .from("case-files")
        .upload(path, file, { upsert: true });
      if (error) {
        alert(`Failed to upload ${slot.label}`);
        setImagesSaving(false);
        return;
      }
      paths[slot.key] = path;
    }
    await supabase
      .from("appointments_booking")
      .update({ image_paths: paths, images_submitted: true })
      .eq("id", id);
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
      const { error } = await supabase.storage
        .from("case-files")
        .upload(path, file, { upsert: true });
      if (error) {
        alert(`Failed to upload ${slot.label}`);
        setStlSaving(false);
        return;
      }
      paths[slot.key] = path;
    }
    await supabase
      .from("appointments_booking")
      .update({ stl_paths: paths, stl_submitted: true })
      .eq("id", id);
    setStlSaving(false);
    setStlSubmitted(true);
    setActiveSection(null);
  };

  // ─── DENTIST NOTE ────────────────────────────────────────────────
  const saveDentistNote = async () => {
    setNoteSaving(true);
    await supabase
      .from("appointments_booking")
      .update({ dentist_note: dentistNote })
      .eq("id", id);
    setNoteSaving(false);
  };

  // ─── END APPOINTMENT ─────────────────────────────────────────────
  const allDone = formSubmitted && imagesSubmitted && stlSubmitted;

  const endAppointment = async () => {
    if (!allDone) {
      alert("Please complete all 3 sections before ending the appointment.");
      return;
    }
    const confirmed = window.confirm(
      "End this appointment? It will be marked as completed and cannot be edited again."
    );
    if (!confirmed) return;
    setEnding(true);
    const { error } = await supabase
      .from("appointments_booking")
      .update({ status: "completed" })
      .eq("id", id);
    setEnding(false);
    if (error) { alert("Failed to end appointment."); return; }
    alert("Appointment completed successfully!");
    router.push("/dentist");
  };

  // ─── SECTION CARD ─────────────────────────────────────────────────
  const SectionCard = ({ sectionKey, label, done, children }) => {
    const isOpen = activeSection === sectionKey;
    return (
      <div style={{
        background: "white", border: `1px solid ${done ? "#22c55e" : "#e5e7eb"}`,
        borderRadius: "16px", overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
      }}>
        <div
          onClick={() => !done && setActiveSection(isOpen ? null : sectionKey)}
          style={{
            padding: "18px 20px", display: "flex", justifyContent: "space-between",
            alignItems: "center", cursor: done ? "default" : "pointer",
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
              {label}
            </span>
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

  const inputStyle = {
    width: "100%", padding: "12px", borderRadius: "8px",
    border: "1px solid #e5e7eb", fontSize: "14px",
    outline: "none", boxSizing: "border-box", marginBottom: "12px",
    background: "white", color: "#111827",
  };

  return (
    <div style={{ maxWidth: "680px" }}>
      <h1 style={{ marginBottom: "6px" }}>Appointment</h1>
      <p style={{ color: "gray", fontSize: "13px", marginBottom: "24px" }}>
        Complete all 3 sections to end the appointment.
      </p>

      <div style={{ display: "grid", gap: "14px" }}>

        {/* ── SECTION 1: PATIENT FORM ── */}
        <SectionCard sectionKey="form" label="1. Patient Form" done={formSubmitted}>
          <input style={inputStyle} placeholder="Patient Name *" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input style={inputStyle} placeholder="Age *" value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })} />
          <input style={inputStyle} placeholder="Occupation" value={form.occupation}
            onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
          <textarea style={{ ...inputStyle, minHeight: "80px" }}
            placeholder="Chief Complaint *" value={form.chief_complaint}
            onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} />
          <textarea style={{ ...inputStyle, minHeight: "120px" }}
            placeholder="Complete History *" value={form.complete_history}
            onChange={(e) => setForm({ ...form, complete_history: e.target.value })} />
          <button
            onClick={submitForm} disabled={formSaving}
            style={{
              width: "100%", padding: "12px", borderRadius: "8px", border: "none",
              background: "#111827", color: "white", fontWeight: "600",
              cursor: "pointer", opacity: formSaving ? 0.7 : 1,
            }}
          >
            {formSaving ? "Saving..." : "Submit Form"}
          </button>
        </SectionCard>

        {/* ── SECTION 2: IMAGES ── */}
        <SectionCard sectionKey="images" label="2. Upload Images (9 required)" done={imagesSubmitted}>
          <p style={{ fontSize: "13px", color: "gray", marginBottom: "16px" }}>
            Upload all 9 required photos before submitting.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {IMAGE_SLOTS.map((slot) => (
              <div key={slot.key} style={{
                border: `2px dashed ${images[slot.key] ? "#22c55e" : "#e5e7eb"}`,
                borderRadius: "10px", padding: "10px", textAlign: "center",
                background: images[slot.key] ? "#f0fdf4" : "#fafafa",
              }}>
                <p style={{ fontSize: "11px", fontWeight: "600", marginBottom: "6px", color: "#374151" }}>
                  {slot.label}
                </p>
                {images[slot.key] ? (
                  <div>
                    <p style={{ fontSize: "10px", color: "#16a34a", margin: "0 0 4px" }}>✓ Selected</p>
                    <p style={{ fontSize: "10px", color: "gray", margin: 0, wordBreak: "break-all" }}>
                      {images[slot.key].name.substring(0, 16)}...
                    </p>
                  </div>
                ) : (
                  <label style={{ cursor: "pointer" }}>
                    <span style={{ fontSize: "11px", color: "#6b7280" }}>Tap to upload</span>
                    <input
                      type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => handleImageChange(slot.key, e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={submitImages}
            disabled={!allImagesSelected || imagesSaving}
            style={{
              width: "100%", padding: "12px", borderRadius: "8px", border: "none",
              background: allImagesSelected ? "#111827" : "#e5e7eb",
              color: allImagesSelected ? "white" : "#9ca3af",
              fontWeight: "600", cursor: allImagesSelected ? "pointer" : "not-allowed",
              opacity: imagesSaving ? 0.7 : 1,
            }}
          >
            {imagesSaving ? "Uploading..." : `Submit Images (${Object.keys(images).length}/9)`}
          </button>
        </SectionCard>

        {/* ── SECTION 3: STL FILES ── */}
        <SectionCard sectionKey="stl" label="3. Upload STL Files (4 required)" done={stlSubmitted}>
          <p style={{ fontSize: "13px", color: "gray", marginBottom: "16px" }}>
            Upload all 4 scan files before submitting.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {STL_SLOTS.map((slot) => (
              <div key={slot.key} style={{
                border: `2px dashed ${stls[slot.key] ? "#22c55e" : "#e5e7eb"}`,
                borderRadius: "10px", padding: "14px", textAlign: "center",
                background: stls[slot.key] ? "#f0fdf4" : "#fafafa",
              }}>
                <p style={{ fontSize: "12px", fontWeight: "600", marginBottom: "8px", color: "#374151" }}>
                  {slot.label}
                </p>
                {stls[slot.key] ? (
                  <p style={{ fontSize: "11px", color: "#16a34a", margin: 0 }}>✓ {stls[slot.key].name.substring(0, 18)}...</p>
                ) : (
                  <label style={{ cursor: "pointer" }}>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Tap to upload</span>
                    <input
                      type="file" accept=".stl,.obj,.ply" style={{ display: "none" }}
                      onChange={(e) => handleStlChange(slot.key, e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={submitStls}
            disabled={!allStlsSelected || stlSaving}
            style={{
              width: "100%", padding: "12px", borderRadius: "8px", border: "none",
              background: allStlsSelected ? "#111827" : "#e5e7eb",
              color: allStlsSelected ? "white" : "#9ca3af",
              fontWeight: "600", cursor: allStlsSelected ? "pointer" : "not-allowed",
              opacity: stlSaving ? 0.7 : 1,
            }}
          >
            {stlSaving ? "Uploading..." : `Submit STL Files (${Object.keys(stls).length}/4)`}
          </button>
        </SectionCard>

      </div>

      {/* ── SECTION 4: PROVISIONAL PLANNING (from ortho, readonly) ── */}
      <div style={{
        marginTop: "14px", background: "white",
        border: "1px solid #e5e7eb", borderRadius: "16px", overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
      }}>
        <div style={{ padding: "18px 20px", background: provisionalPlanSubmitted ? "#f0fdf4" : "#fafafa", borderBottom: "1px solid #e5e7eb" }}>
          <span style={{ fontWeight: "600", color: provisionalPlanSubmitted ? "#16a34a" : "#111827" }}>
            4. Provisional Planning
          </span>
          {provisionalPlanSubmitted && (
            <span style={{ marginLeft: "10px", fontSize: "12px", color: "#16a34a", fontWeight: "600" }}>
              ✓ Submitted by orthodontist
            </span>
          )}
        </div>
        <div style={{ padding: "20px" }}>
          {provisionalPlanSubmitted ? (
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: "8px", padding: "14px",
              fontSize: "14px", color: "#111827", whiteSpace: "pre-wrap",
              lineHeight: "1.6",
            }}>
              {provisionalPlan}
            </div>
          ) : (
            <p style={{ color: "gray", fontSize: "14px", margin: 0 }}>
              Waiting for orthodontist to submit the provisional plan...
            </p>
          )}
        </div>
      </div>

      {/* ── SECTION 5: DENTIST NOTE ── */}
      <div style={{
        marginTop: "14px", background: "white",
        border: "1px solid #e5e7eb", borderRadius: "16px", overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
      }}>
        <div style={{ padding: "18px 20px", background: "#fafafa", borderBottom: "1px solid #e5e7eb" }}>
          <span style={{ fontWeight: "600", color: "#111827" }}>5. Note</span>
        </div>
        <div style={{ padding: "20px" }}>
          <textarea
            style={{
              width: "100%", padding: "12px", borderRadius: "8px",
              border: "1px solid #e5e7eb", fontSize: "14px",
              outline: "none", boxSizing: "border-box",
              minHeight: "100px", resize: "vertical",
              marginBottom: "12px", color: "#111827",
            }}
            placeholder="Add any notes or observations..."
            value={dentistNote}
            onChange={(e) => setDentistNote(e.target.value)}
          />
          <button
            onClick={saveDentistNote}
            disabled={noteSaving}
            style={{
              padding: "10px 24px", borderRadius: "8px", border: "none",
              background: "#111827", color: "white", fontWeight: "600",
              cursor: "pointer", opacity: noteSaving ? 0.7 : 1,
            }}
          >
            {noteSaving ? "Saving..." : "Save Note"}
          </button>
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
          style={{
            width: "100%", padding: "14px", borderRadius: "10px", border: "none",
            background: allDone ? "#dc2626" : "#e5e7eb",
            color: allDone ? "white" : "#9ca3af",
            fontWeight: "700", fontSize: "15px",
            cursor: allDone ? "pointer" : "not-allowed",
            opacity: ending ? 0.7 : 1,
          }}
        >
          {ending ? "Ending..." : "🏁 End Appointment"}
        </button>
      </div>
    </div>
  );
}
