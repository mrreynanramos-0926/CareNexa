const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')

const DEFAULTS = [
  ['Antonet', false],
  ['Icel', false],
  ['Jeniviv', false],
  ['Mary', false],
  ['Khel', false],
  ['Lei', false],
  ['Mitzie', false],
  ['Criza', false],
  ['Emmy', false],
  ['Trixie', false],
  ['Dreana', false],
  ['Rose', false],
  ['Walk-in', true],
]

function presentDermtech(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    notes: row.notes || '',
    isWalkIn: row.isWalkIn,
    status: row.status,
    displayOrder: row.displayOrder,
  }
}

async function ensureDermtechs(db) {
  for (const [index, [name, isWalkIn]] of DEFAULTS.entries()) {
    await db.dermtech.upsert({
      where: { name },
      update: {},
      create: { name, isWalkIn, status: 'active', displayOrder: index + 1, notes: isWalkIn ? 'Sales that are not assigned to a named dermtech.' : '' },
    })
  }
}

async function listDermtechs(query = {}) {
  const where = {}
  if (query.status) where.status = query.status
  const rows = await prisma.dermtech.findMany({ where, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] })
  return rows.map(presentDermtech)
}

async function createDermtech(input, user) {
  const name = String(input.name || '').trim()
  if (!name) throw new AppError(400, 'VALIDATION_ERROR', 'Enter the dermtech name.')
  const existing = await prisma.dermtech.findUnique({ where: { name } })
  if (existing) throw new AppError(409, 'CONFLICT', 'That dermtech name is already in use.')
  const last = await prisma.dermtech.findFirst({ orderBy: { displayOrder: 'desc' } })
  const created = await prisma.dermtech.create({
    data: {
      name,
      phone: String(input.phone || '').trim(),
      notes: String(input.notes || '').trim(),
      isWalkIn: Boolean(input.isWalkIn),
      status: 'active',
      displayOrder: Number.isInteger(input.displayOrder) ? input.displayOrder : (last?.displayOrder || 0) + 1,
    },
  })
  await writeAudit(prisma, {
    userId: user?.id,
    action: 'create',
    entity: 'dermtech',
    entityId: created.id,
    newValue: { name: created.name },
  })
  return presentDermtech(created)
}

async function updateDermtech(id, input, user) {
  const existing = await prisma.dermtech.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Dermtech not found.')
  const data = {}
  if (input.name != null) {
    const name = String(input.name).trim()
    if (!name) throw new AppError(400, 'VALIDATION_ERROR', 'Enter the dermtech name.')
    const clash = await prisma.dermtech.findFirst({ where: { name, NOT: { id } } })
    if (clash) throw new AppError(409, 'CONFLICT', 'That dermtech name is already in use.')
    data.name = name
  }
  if (input.phone != null) data.phone = String(input.phone).trim()
  if (input.notes != null) data.notes = String(input.notes).trim()
  if (input.status != null) data.status = input.status === 'inactive' ? 'inactive' : 'active'
  if (input.displayOrder != null) data.displayOrder = Number(input.displayOrder)
  const updated = await prisma.dermtech.update({ where: { id }, data })
  await writeAudit(prisma, {
    userId: user?.id,
    action: 'update',
    entity: 'dermtech',
    entityId: id,
    oldValue: { name: existing.name, status: existing.status },
    newValue: { name: updated.name, status: updated.status },
  })
  return presentDermtech(updated)
}

async function activeDermtech(db, id) {
  if (!id) return null
  const row = await db.dermtech.findUnique({ where: { id } })
  if (!row || row.status !== 'active') {
    throw new AppError(422, 'BUSINESS_RULE', 'Choose an active dermtech.')
  }
  return row
}

module.exports = { ensureDermtechs, listDermtechs, createDermtech, updateDermtech, presentDermtech, activeDermtech }
