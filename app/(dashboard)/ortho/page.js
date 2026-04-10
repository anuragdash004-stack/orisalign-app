"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OrthoPage() {
  const [orthos, setOrthos] = useState([]);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    fetchOrthos();
  }, []);

  const fetchOrthos = async () => {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("role", "orthodontist");

    setOrthos(data);
  };

  const loadAppointments = async (id) => {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("orthodontist_id", id);

    setAppointments(data);
  };

  return (
    <div>
      <h1>Orthodontists</h1>

      {orthos.map((o) => (
        <div key={o.id}>
          <button onClick={() => loadAppointments(o.id)}>
            {o.email}
          </button>
        </div>
      ))}

      <h3>Cases</h3>

      {appointments.map((a) => (
        <div key={a.id}>
          {a.name} - {a.complaint}
        </div>
      ))}
    </div>
  );
}