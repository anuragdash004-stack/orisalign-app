export async function logAudit({ appointmentId, actor, action, entity, newData, oldData }) {
  try {
    await fetch("/api/audit-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: appointmentId || null,
        actorEmail: actor?.email || null,
        actorRole: actor?.role || null,
        action,
        entity: entity || null,
        newData: newData || null,
        oldData: oldData || null,
      }),
    })
  } catch {}
}
