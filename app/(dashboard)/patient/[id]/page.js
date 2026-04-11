"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";

const supabase = getSupabaseClient();

export default function PatientProfile() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);

  useEffect(() => {
    const fetchPatient = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .single();

      setPatient(data);
    };

    fetchPatient();
  }, [id]);

  if (!patient) return <p>Loading...</p>;

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-bold">Appointment Details</h1>

      <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-2">
        <h2 className="text-xl">{patient.patient_name}</h2>
        <p>{patient.age} yrs • {patient.sex}</p>
        <p>📞 {patient.phone}</p>
        <p>🩺 {patient.complaint}</p>
        <p>📍 {patient.address}</p>

        <p className="text-sm opacity-60 mt-2">
          Created: {new Date(patient.created_at).toLocaleString()}
        </p>
      </div>

    </div>
  );
}