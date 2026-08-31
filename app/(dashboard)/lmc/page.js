"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

export default function LMCPage() {
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("appointments_booking")
        .select("id, name, phone, email, lmc_data")
        .eq("lmc_active", true)
        .order("name", { ascending: true });
      if (error) console.error("Error fetching LMC members:", error);
      setMembers(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? members.filter((m) => {
        const cardholderName = m.lmc_data?.cardholder?.name || "";
        const plusOneName = m.lmc_data?.plus_one?.name || "";
        return (
          (m.name || "").toLowerCase().includes(q) ||
          cardholderName.toLowerCase().includes(q) ||
          plusOneName.toLowerCase().includes(q) ||
          (m.phone || "").includes(q)
        );
      })
    : members;

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "var(--admin-ink2, #837a66)" }}>Loading members...</div>;

  return (
    <div style={{ padding: "24px", maxWidth: "800px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--admin-ink, #1b2a4a)", margin: 0 }}>Lifetime Membership Card</h1>
        <p style={{ fontSize: "14px", color: "var(--admin-ink2, #837a66)", margin: "4px 0 0" }}>
          {members.length} {members.length === 1 ? "member" : "members"} · click a name to open their full patient page
        </p>
      </div>

      <input
        type="text"
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--admin-line, #e9e1d0)",
          fontSize: "14px", outline: "none", background: "white", color: "var(--admin-ink, #1b2a4a)",
          boxSizing: "border-box", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      />

      {filtered.length === 0 ? (
        <div style={{ padding: "40px 24px", background: "white", borderRadius: "12px", border: "1px solid var(--admin-line, #e9e1d0)", textAlign: "center", color: "var(--admin-ink2, #837a66)" }}>
          {members.length === 0 ? "No Lifetime Membership Cards issued yet." : "No members match your search."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {filtered.map((m) => {
            const cardholderName = m.lmc_data?.cardholder?.name;
            return (
              <button
                key={m.id}
                onClick={() => router.push(`/patients/${m.id}`)}
                style={{
                  display: "flex", alignItems: "center", gap: "14px", textAlign: "left",
                  background: "white", border: "1px solid var(--admin-line, #e9e1d0)", borderRadius: "14px",
                  padding: "14px 18px", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  width: "100%",
                }}
              >
                <div style={{
                  width: "44px", height: "44px", borderRadius: "50%",
                  background: "var(--admin-gold-strong, #a9762e)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontWeight: "800", fontSize: "18px", flexShrink: 0,
                }}>
                  {(m.name || "P")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--admin-ink, #1b2a4a)" }}>{m.name || "Unnamed Patient"}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--admin-ink2, #837a66)" }}>
                    {m.phone || "—"}
                    {cardholderName && cardholderName !== m.name ? ` · Card: ${cardholderName}` : ""}
                  </p>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "99px", background: "#dcfce7", color: "#16a34a", flexShrink: 0 }}>
                  ACTIVE ✓
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
