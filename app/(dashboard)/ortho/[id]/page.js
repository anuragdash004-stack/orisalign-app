"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function OrthoCase() {
  const { id } = useParams();
  const [plan, setPlan] = useState("");
  const [patient, setPatient] = useState(null);

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

  const submitPlan = async () => {
    await supabase
      .from("appointments")
      .update({
        treatment_plan: plan,
        status: "planned",
      })
      .eq("id", id);

    alert("Plan submitted");
  };

  if (!patient) return null;

  return (
    <div className="space-y-4">
      <h1>{patient.patient_name}</h1>

      <p>{patient.complaint}</p>
      <p>{patient.history}</p>

      <textarea
        placeholder="Treatment Plan"
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        className="input"
      />

      <button onClick={submitPlan} className="btn">
        Submit Plan
      </button>
    </div>
  );
}