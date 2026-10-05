const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')
const { DEFAULTS, SETTING_KEYS, criteriaFromSettings } = require('../../lib/settingsDefaults')

async function ensureDefaults() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    })
  }
}

async function getSettingsMap() {
  const rows = await prisma.systemSetting.findMany()
  const map = { ...DEFAULTS }
  for (const row of rows) map[row.key] = row.value
  return map
}

async function listSettings() {
  await ensureDefaults()
  const map = await getSettingsMap()
  return SETTING_KEYS.map((key) => ({ key, value: map[key] }))
}

async function updateSetting(key, value, user) {
  if (!SETTING_KEYS.includes(key)) {
    throw new AppError(404, 'NOT_FOUND', 'That setting does not exist.')
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Setting value must be a non-negative number.')
  }
  const existing = await prisma.systemSetting.findUnique({ where: { key } })
  const saved = await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value, updatedById: user.id },
    update: { value, updatedById: user.id },
  })
  await writeAudit(prisma, {
    userId: user.id,
    action: 'update',
    entity: 'setting',
    entityId: key,
    oldValue: { value: existing?.value ?? null },
    newValue: { value },
  })
  await syncNamedSegments(user)
  return { key: saved.key, value: saved.value }
}

async function syncNamedSegments(user) {
  const settings = await getSettingsMap()
  const named = criteriaFromSettings(settings)
  for (const [name, spec] of Object.entries(named)) {
    const existing = await prisma.customerSegment.findUnique({ where: { name } })
    if (!existing) {
      await prisma.customerSegment.create({
        data: { name, description: spec.description, criteria: spec.criteria },
      })
    } else {
      await prisma.customerSegment.update({
        where: { id: existing.id },
        data: { description: spec.description, criteria: spec.criteria },
      })
    }
  }
  if (user) {
    await writeAudit(prisma, {
      userId: user.id,
      action: 'update',
      entity: 'segment',
      entityId: 'named-segments',
      oldValue: null,
      newValue: { syncedFromSettings: true },
    })
  }
}

module.exports = { ensureDefaults, getSettingsMap, listSettings, updateSetting, syncNamedSegments }
