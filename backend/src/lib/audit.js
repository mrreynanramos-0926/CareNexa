const SENSITIVE = new Set(['password', 'passwordHash', 'password_hash', 'token', 'authorization', 'currentPassword', 'newPassword'])

function redact(value) {
  if (!value || typeof value !== 'object') return value ?? null
  if (Array.isArray(value)) return value.map(redact)
  const copy = {}
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE.has(key)) continue
    copy[key] = entry && typeof entry === 'object' ? redact(entry) : entry
  }
  return copy
}

async function writeAudit(db, { userId, action, entity, entityId, oldValue, newValue }) {
  await db.auditLog.create({
    data: {
      userId: userId || null,
      action,
      entity,
      entityId: String(entityId),
      oldValue: oldValue == null ? undefined : redact(oldValue),
      newValue: newValue == null ? undefined : redact(newValue),
    },
  })
}

module.exports = { writeAudit, redact }
