"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";

const supabase = getSupabaseClient();

export default function DentistCase() {
  const { id } = useParams();

  const [patient, setPatient] = useState(null);
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .single();

      setPatient(data);
    };

    fetch();
  }, []);

  const submitCase = async () => {
    await supabase
      .from("appointments")
      .update({
        notes,
        history,
        status: "submitted",
      })
      .eq("id", id);

    alert("Sent to Orthodontist");
  };

  if (!patient) return <p>Loading...</p>;

  return (
    <div className="space-y-4">

      <h1 className="text-xl">Patient Case</h1>

      {/* BASIC INFO */}
      <div className="card">
        <p>Name: {patient.patient_name}</p>
        <p>Age: {patient.age}</p>
        <p>Sex: {patient.sex}</p>
        <p>Complaint: {patient.complaint}</p>
      </div>

      {/* NOTES */}
      <textarea
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="input"
      />

      {/* HISTORY */}
      <textarea
        placeholder="History Taking"
        value={history}
        onChange={(e) => setHistory(e.target.value)}
        className="input"
      />

      {/* IMAGE UPLOAD (simple version) */}
      <input type="file" multiple />

      {/* SUBMIT */}
      <button onClick={submitCase} className="btn">
        Submit Case
      </button>

      {/* TREATMENT PLAN */}
      {patient.treatment_plan && (
        <div className="card">
          <h3>Treatment Plan</h3>
          <p>{patient.treatment_plan}</p>
        </div>
      )}
    </div>
  );
}