"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

const inr = (n) => (n === null || n === undefined || n === "" ? "" : `₹ ${Number(n).toLocaleString("en-IN")}`);

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(null); // id currently saving
  const [drafts, setDrafts] = useState({}); // id -> { price, discount, benefits, notes }
  const [editing, setEditing] = useState({}); // id -> bool, whether the card is in edit mode
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const { data } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
      setIsAdmin(data?.role === "admin");
    })();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, campaign_number, price, discount, benefits, notes, created_at")
      .order("campaign_number", { ascending: true });
    if (error) console.error("Error loading campaigns:", error);
    setCampaigns(data || []);
    setDrafts((prev) => {
      const next = { ...prev };
      (data || []).forEach((c) => {
        if (!next[c.id]) next[c.id] = { price: c.price ?? "", discount: c.discount || "", benefits: c.benefits || "", notes: c.notes || "" };
      });
      return next;
    });
    setEditing((prev) => {
      const next = { ...prev };
      (data || []).forEach((c) => {
        // Brand-new campaigns (nothing saved yet) open straight into edit mode.
        if (next[c.id] === undefined) next[c.id] = c.price === null && !c.discount && !c.benefits && !c.notes;
      });
      return next;
    });
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const addCampaign = async () => {
    setAdding(true);
    const { error } = await supabase.from("campaigns").insert([{}]);
    setAdding(false);
    if (error) { alert("Failed to add campaign: " + error.message); return; }
    fetchCampaigns();
  };

  const setDraft = (id, key, value) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const startEdit = (campaign) => {
    setDrafts((prev) => ({
      ...prev,
      [campaign.id]: { price: campaign.price ?? "", discount: campaign.discount || "", benefits: campaign.benefits || "", notes: campaign.notes || "" },
    }));
    setEditing((prev) => ({ ...prev, [campaign.id]: true }));
  };

  const saveCampaign = async (campaign) => {
    const d = drafts[campaign.id] || {};
    setSaving(campaign.id);
    const { error } = await supabase
      .from("campaigns")
      .update({
        price: d.price === "" ? null : Number(d.price),
        discount: d.discount || null,
        benefits: d.benefits || null,
        notes: d.notes || null,
      })
      .eq("id", campaign.id);
    setSaving(null);
    if (error) { alert("Failed to save: " + error.message); return; }
    setEditing((prev) => ({ ...prev, [campaign.id]: false }));
    fetchCampaigns();
  };

  const deleteCampaign = async (campaign) => {
    if (!window.confirm(`Permanently delete Campaign ${campaign.campaign_number}? This cannot be undone.`)) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", campaign.id);
    if (error) { alert("Failed to delete: " + error.message); return; }
    setCampaigns((prev) => prev.filter((x) => x.id !== campaign.id));
  };

  const input = {
    width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--admin-line, #e9e1d0)",
    fontSize: "14px", outline: "none", background: "white", color: "var(--admin-ink, #1b2a4a)", boxSizing: "border-box",
  };
  const label = { display: "block", fontSize: "11px", fontWeight: "700", color: "var(--admin-ink2, #837a66)", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" };
  const fieldLabel = { display: "block", fontSize: "11px", fontWeight: "700", color: "var(--admin-ink2, #837a66)", marginBottom: "2px", letterSpacing: "0.5px", textTransform: "uppercase" };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "var(--admin-ink2, #837a66)" }}>Loading campaigns...</div>;

  return (
    <div style={{ padding: "24px", maxWidth: "900px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--admin-ink, #1b2a4a)", margin: 0 }}>Campaigns</h1>
          <p style={{ fontSize: "14px", color: "var(--admin-ink2, #837a66)", margin: "4px 0 0" }}>
            {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"} · tag leads with the ad campaign they came from.
          </p>
        </div>
        <button
          onClick={addCampaign}
          disabled={adding}
          style={{ padding: "12px 22px", borderRadius: "10px", border: "none", background: "var(--admin-gold, #b8905a)", color: "white", fontWeight: "700", fontSize: "14px", cursor: adding ? "not-allowed" : "pointer", opacity: adding ? 0.6 : 1, whiteSpace: "nowrap" }}
        >
          {adding ? "Adding..." : `+ Add Campaign ${campaigns.length + 1}`}
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div style={{ padding: "40px 24px", background: "white", borderRadius: "12px", border: "1px solid var(--admin-line, #e9e1d0)", textAlign: "center", color: "var(--admin-ink2, #837a66)" }}>
          No campaigns yet. Click "+ Add Campaign 1" above to create your first one.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "14px" }}>
          {campaigns.map((campaign) => {
            const d = drafts[campaign.id] || { price: "", discount: "", benefits: "", notes: "" };
            const isEditing = !!editing[campaign.id];
            return (
              <div key={campaign.id} style={{ background: "white", border: "1px solid var(--admin-line, #e9e1d0)", borderRadius: "16px", padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "var(--admin-ink, #1b2a4a)" }}>Campaign {campaign.campaign_number}</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(campaign)}
                        style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--admin-line, #e9e1d0)", background: "white", color: "var(--admin-ink, #1b2a4a)", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
                      >
                        Edit
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => deleteCampaign(campaign)}
                        style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <div>
                        <span style={label}>Price (₹)</span>
                        <input style={input} type="number" min="0" value={d.price} onChange={(e) => setDraft(campaign.id, "price", e.target.value)} placeholder="e.g. 47999" />
                      </div>
                      <div>
                        <span style={label}>Discount</span>
                        <input style={input} value={d.discount} onChange={(e) => setDraft(campaign.id, "discount", e.target.value)} placeholder="e.g. 10% off or ₹5,000 off" />
                      </div>
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                      <span style={label}>Benefits</span>
                      <textarea style={{ ...input, minHeight: "60px", resize: "vertical" }} value={d.benefits} onChange={(e) => setDraft(campaign.id, "benefits", e.target.value)} placeholder="What's included with this campaign offer" />
                    </div>
                    <div style={{ marginBottom: "14px" }}>
                      <span style={label}>Notes</span>
                      <textarea style={{ ...input, minHeight: "50px", resize: "vertical" }} value={d.notes} onChange={(e) => setDraft(campaign.id, "notes", e.target.value)} placeholder="Internal notes about this campaign" />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                      {!(campaign.price === null && !campaign.discount && !campaign.benefits && !campaign.notes) && (
                        <button
                          onClick={() => setEditing((prev) => ({ ...prev, [campaign.id]: false }))}
                          style={{ padding: "9px 18px", borderRadius: "8px", border: "1px solid var(--admin-line, #e9e1d0)", background: "white", color: "var(--admin-ink, #1b2a4a)", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => saveCampaign(campaign)}
                        disabled={saving === campaign.id}
                        style={{ padding: "9px 20px", borderRadius: "8px", border: "none", background: "var(--admin-ink, #1b2a4a)", color: "white", fontWeight: "700", fontSize: "13px", cursor: saving === campaign.id ? "not-allowed" : "pointer", opacity: saving === campaign.id ? 0.6 : 1 }}
                      >
                        {saving === campaign.id ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <span style={fieldLabel}>Price</span>
                        <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--admin-ink, #1b2a4a)" }}>{campaign.price !== null ? inr(campaign.price) : "—"}</p>
                      </div>
                      <div>
                        <span style={fieldLabel}>Discount</span>
                        <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--admin-ink, #1b2a4a)" }}>{campaign.discount || "—"}</p>
                      </div>
                    </div>
                    <div>
                      <span style={fieldLabel}>Benefits</span>
                      <p style={{ margin: 0, fontSize: "14px", color: "var(--admin-ink, #1b2a4a)", whiteSpace: "pre-wrap" }}>{campaign.benefits || "—"}</p>
                    </div>
                    <div>
                      <span style={fieldLabel}>Notes</span>
                      <p style={{ margin: 0, fontSize: "14px", color: "var(--admin-ink, #1b2a4a)", whiteSpace: "pre-wrap" }}>{campaign.notes || "—"}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
