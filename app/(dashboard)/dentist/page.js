"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

export default function DentistPage() {
  const [dentists, setDentists] = useState([]);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadDentists() {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("role", "dentist");

      if (active) {
        setDentists(data || []);
      }
    }

    loadDentists();

    return () => {
      active = false;
    };
  }, []);

  const loadAppointments = async (id) => {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("assigned_to", id);

    setAppointments(data || []);
  };

  return (
    <div>
      <h1>Dentists</h1>

      {dentists.map((d) => (
        <div key={d.id}>
          <button onClick={() => loadAppointments(d.id)}>
            {d.email}
          </button>
        </div>
      ))}

      <h3>Appointments</h3>

      {appointments.map((a) => (
        <div key={a.id}>
          {a.name} - {a.complaint}
        </div>
      ))}
    </div>
  );
}
