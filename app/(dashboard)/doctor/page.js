"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (active) {
        setUser(data.user);
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome: {user?.email}</p>
    </div>
  );
}
