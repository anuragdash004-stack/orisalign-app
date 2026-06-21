"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

const inr = (n) => `₹ ${(Number(n) || 0).toLocaleString("en-IN")}`;

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("coupons")
      .select("id, code, discount_amount, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) console.error("Error loading coupons:", error);
    setCoupons(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCoupons(); }, []);

  const addCoupon = async () => {
    const c = code.trim().toUpperCase();
    const amt = parseFloat(discount);
    if (!c) { alert("Enter a coupon code."); return; }
    if (!amt || amt <= 0) { alert("Enter a valid discount amount."); return; }
    if (coupons.some((x) => (x.code || "").toUpperCase() === c)) {
      alert(`Coupon "${c}" already exists.`);
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("coupons").insert([{ code: c, discount_amount: amt, is_active: true }]);
    setAdding(false);
    if (error) { alert("Failed to add coupon: " + error.message); return; }
    setCode(""); setDiscount("");
    fetchCoupons();
  };

  const toggleActive = async (coupon) => {
    setCoupons((prev) => prev.map((x) => (x.id === coupon.id ? { ...x, is_active: !x.is_active } : x)));
    const { error } = await supabase.from("coupons").update({ is_active: !coupon.is_active }).eq("id", coupon.id);
    if (error) { alert("Failed to update: " + error.message); fetchCoupons(); }
  };

  const deleteCoupon = async (coupon) => {
    if (!window.confirm(`Permanently delete coupon "${coupon.code}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", coupon.id);
    if (error) { alert("Failed to delete: " + error.message); return; }
    setCoupons((prev) => prev.filter((x) => x.id !== coupon.id));
  };

  const input = {
    width: "100%", padding: "11px 12px", borderRadius: "10px", border: "1px solid #e5e7eb",
    fontSize: "14px", outline: "none", background: "white", color: "#111827", boxSizing: "border-box",
  };
  const label = { display: "block", fontSize: "11px", fontWeight: "700", color: "#6b7280", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Loading coupons...</div>;

  return (
    <div style={{ padding: "24px", maxWidth: "760px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>Coupons</h1>
        <p style={{ fontSize: "14px", color: "#6b7280", margin: "4px 0 0" }}>
          {coupons.length} {coupons.length === 1 ? "coupon" : "coupons"} · patients enter these at checkout for a discount.
        </p>
      </div>

      {/* Add coupon */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#111827" }}>Add a Coupon</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", alignItems: "end" }}>
          <div>
            <span style={label}>Coupon Code</span>
            <input style={{ ...input, textTransform: "uppercase" }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ORIS10" />
          </div>
          <div>
            <span style={label}>Discount Amount (₹)</span>
            <input style={input} type="number" min="1" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="e.g. 5000" />
          </div>
          <button
            onClick={addCoupon}
            disabled={adding}
            style={{ padding: "12px 22px", borderRadius: "10px", border: "none", background: "#b8905a", color: "white", fontWeight: "700", fontSize: "14px", cursor: adding ? "not-allowed" : "pointer", opacity: adding ? 0.6 : 1, whiteSpace: "nowrap" }}
          >
            {adding ? "Adding..." : "Add Coupon"}
          </button>
        </div>
      </div>

      {/* Coupon list */}
      {coupons.length === 0 ? (
        <div style={{ padding: "40px 24px", background: "white", borderRadius: "12px", border: "1px solid #e5e7eb", textAlign: "center", color: "#9ca3af" }}>
          No coupons yet. Add one above.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {coupons.map((coupon) => (
            <div key={coupon.id} style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ flex: 1, minWidth: "160px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: "800", letterSpacing: "1px", color: "#111827" }}>{coupon.code}</span>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "99px", background: coupon.is_active ? "#dcfce7" : "#f3f4f6", color: coupon.is_active ? "#16a34a" : "#9ca3af", fontSize: "11px", fontWeight: "700" }}>
                    {coupon.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#6b7280" }}>Discount: <strong style={{ color: "#111827" }}>{inr(coupon.discount_amount)}</strong></p>
              </div>
              <button
                onClick={() => toggleActive(coupon)}
                style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {coupon.is_active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => deleteCoupon(coupon)}
                style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
