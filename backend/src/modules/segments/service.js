const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')
const { pageParams, listResponse } = require('../../lib/pagination')
const { evaluateCriteria } = require('./rules')
const { buildMetricContext } = require('../customerValue/service')
const { presentCustomer } = require('../customers/service')

const ALLOWED_FIELDS = new Set([
  'total_spent_centavos',
  'visit_count',
  'visit_count_in_days',
  'days_since_last_visit',
  'days_since_first_visit',
  'days_since_created',
])

function assertCriteria(criteria) {
  if (!criteria || !['all', 'any'].includes(criteria.match) || !Array.isArray(criteria.rules) || criteria.rules.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Criteria need a match mode and at least one rule.')
  }
  for (const rule of criteria.rules) {
    if (!ALLOWED_FIELDS.has(rule.field) || !['gte', 'lte', 'eq'].includes(rule.op) || typeof rule.value !== 'number') {
      throw new AppError(400, 'VALIDATION_ERROR', 'A segment rule is incomplete or uses an unknown field.')
    }
  }
}

async function listSegments() {
  const segments = await prisma.customerSegment.findMany({
    include: { _count: { select: { memberships: true } } },
    orderBy: { name: 'asc' },
  })
  return segments.map((segment) => ({
    id: segment.id,
    name: segment.name,
    description: segment.description,
    criteria: segment.criteria,
    memberCount: segment._count.memberships,
    createdAt: segment.createdAt,
  }))
}

async function getSegment(id) {
  const segment = await prisma.customerSegment.findUnique({
    where: { id },
    include: { _count: { select: { memberships: true } } },
  })
  if (!segment) throw new AppError(404, 'NOT_FOUND', 'Segment not found.')
  return {
    id: segment.id,
    name: segment.name,
    description: segment.description,
    criteria: segment.criteria,
    memberCount: segment._count.memberships,
  }
}

async function createSegment(input, actor) {
  assertCriteria(input.criteria)
  const segment = await prisma.customerSegment.create({
    data: {
      name: input.name.trim(),
      description: input.description.trim(),
      criteria: input.criteria,
    },
  })
  await writeAudit(prisma, {
    userId: actor.id,
    action: 'create',
    entity: 'segment',
    entityId: segment.id,
    newValue: { name: segment.name, criteria: input.criteria },
  })
  return getSegment(segment.id)
}

async function updateSegment(id, input, actor) {
  const existing = await prisma.customerSegment.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Segment not found.')
  assertCriteria(input.criteria)
  await prisma.customerSegment.update({
    where: { id },
    data: {
      name: input.name.trim(),
      description: input.description.trim(),
      criteria: input.criteria,
    },
  })
  await writeAudit(prisma, {
    userId: actor.id,
    action: 'update',
    entity: 'segment',
    entityId: id,
    oldValue: { criteria: existing.criteria },
    newValue: { criteria: input.criteria, name: input.name.trim() },
  })
  return getSegment(id)
}

async function members(id, query) {
  await getSegment(id)
  const { page, pageSize, skip } = pageParams(query)
  const where = { segmentId: id }
  const [rows, total] = await Promise.all([
    prisma.customerSegmentMembership.findMany({
      where,
      include: { customer: { include: { memberships: { include: { segment: true } }, value: true } } },
      orderBy: { assignedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.customerSegmentMembership.count({ where }),
  ])
  return listResponse(rows.map((row) => ({
    ...presentCustomer(row.customer),
    assignedAt: row.assignedAt,
  })), page, pageSize, total)
}

async function rebuildMemberships(actor) {
  const customers = await prisma.customer.findMany({ where: { status: 'active' } })
  const segments = await prisma.customerSegment.findMany()
  let created = 0
  let removed = 0
  for (const customer of customers) {
    const context = await buildMetricContext(customer)
    for (const segment of segments) {
      const match = evaluateCriteria(segment.criteria, context)
      const existing = await prisma.customerSegmentMembership.findUnique({
        where: { customerId_segmentId: { customerId: customer.id, segmentId: segment.id } },
      })
      if (match && !existing) {
        await prisma.customerSegmentMembership.create({
          data: { customerId: customer.id, segmentId: segment.id },
        })
        created += 1
      } else if (!match && existing) {
        await prisma.customerSegmentMembership.delete({ where: { id: existing.id } })
        removed += 1
      }
    }
  }
  if (actor) {
    await writeAudit(prisma, {
      userId: actor.id,
      action: 'update',
      entity: 'segment',
      entityId: 'rebuild',
      newValue: { created, removed, processed: customers.length },
    })
  }
  return { processed: customers.length, created, updated: 0, skipped: removed }
}

module.exports = { listSegments, getSegment, createSegment, updateSegment, members, rebuildMemberships }
