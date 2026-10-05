const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { fromCentavos } = require('../../lib/money')
const { getSettingsMap } = require('../settings/service')
const { manilaDateString, manilaRange, daysBetweenManila } = require('../../lib/dates')
const { pageParams, listResponse } = require('../../lib/pagination')

async function ensureAlert(input) {
  if (input.dedupeKey) {
    const existing = await prisma.anomalyAlert.findUnique({ where: { dedupeKey: input.dedupeKey } })
    if (existing) return null
  }
  return prisma.anomalyAlert.create({
    data: {
      transactionId: input.transactionId,
      anomalyType: input.anomalyType,
      description: input.description,
      severity: input.severity,
      status: 'new',
      dedupeKey: input.dedupeKey,
    },
  })
}

async function evaluateSpike(orderDate, settings) {
  const day = manilaDateString(orderDate)
  const dayRange = manilaRange(day, day)
  const dayOrders = await prisma.order.findMany({
    where: { status: 'completed', orderDate: dayRange },
    select: { id: true, totalCentavos: true },
  })
  if (dayOrders.length === 0) return null
  const dayTotal = dayOrders.reduce((sum, order) => sum + order.totalCentavos, 0)
  const baselineStart = new Date(`${day}T00:00:00+08:00`)
  baselineStart.setUTCDate(baselineStart.getUTCDate() - settings.spike_baseline_days)
  const baselineEnd = new Date(`${day}T00:00:00+08:00`)
  baselineEnd.setUTCMilliseconds(-1)
  const prior = await prisma.order.findMany({
    where: { status: 'completed', orderDate: { gte: baselineStart, lte: baselineEnd } },
    select: { totalCentavos: true, orderDate: true },
  })
  if (prior.length === 0) return null
  const priorTotal = prior.reduce((sum, order) => sum + order.totalCentavos, 0)
  const average = priorTotal / settings.spike_baseline_days
  if (average <= 0 || dayTotal < average * settings.spike_multiplier) return null
  const anchor = dayOrders.sort((a, b) => b.totalCentavos - a.totalCentavos)[0]
  return ensureAlert({
    transactionId: anchor.id,
    anomalyType: 'sales_spike',
    severity: 'medium',
    dedupeKey: `spike:${day}`,
    description: `Sales on ${day} were ${fromCentavos(dayTotal)}, at least ${settings.spike_multiplier} times the prior ${settings.spike_baseline_days}-day daily average of ${fromCentavos(Math.round(average))}.`,
  })
}

async function evaluateOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 'completed') return []
  const settings = await getSettingsMap()
  const created = []
  if (order.totalCentavos >= settings.large_transaction_centavos) {
    const alert = await ensureAlert({
      transactionId: order.id,
      anomalyType: 'large_transaction',
      severity: 'high',
      dedupeKey: `large:${order.id}`,
      description: `Completed order total ${fromCentavos(order.totalCentavos)} meets the large-transaction threshold of ${fromCentavos(settings.large_transaction_centavos)}.`,
    })
    if (alert) created.push(alert)
  }
  const gross = order.totalCentavos + order.discountCentavos
  if (gross > 0 && (order.discountCentavos / gross) * 100 > settings.excessive_discount_percent) {
    const percent = Math.round((order.discountCentavos / gross) * 100)
    const alert = await ensureAlert({
      transactionId: order.id,
      anomalyType: 'excessive_discount',
      severity: 'high',
      dedupeKey: `discount:${order.id}`,
      description: `Discount of ${fromCentavos(order.discountCentavos)} is ${percent}% of the gross amount, above the ${settings.excessive_discount_percent}% threshold.`,
    })
    if (alert) created.push(alert)
  }
  const spike = await evaluateSpike(order.orderDate, settings)
  if (spike) created.push(spike)
  return created
}

async function evaluateRepeatedVoids(userId, orderId) {
  const settings = await getSettingsMap()
  const since = new Date(Date.now() - settings.void_repeat_window_hours * 60 * 60 * 1000)
  const count = await prisma.order.count({
    where: { status: 'voided', voidedById: userId, updatedAt: { gte: since } },
  })
  if (count < settings.void_repeat_count) return null
  return ensureAlert({
    transactionId: orderId,
    anomalyType: 'repeated_void',
    severity: 'medium',
    dedupeKey: `repeated_void:${orderId}`,
    description: `${count} voids by the same user within ${settings.void_repeat_window_hours} hours.`,
  })
}

async function evaluateAll() {
  const orders = await prisma.order.findMany({ where: { status: 'completed' }, select: { id: true } })
  let created = 0
  for (const order of orders) {
    const alerts = await evaluateOrder(order.id)
    created += alerts.length
  }
  return { processed: orders.length, created, updated: 0, skipped: 0 }
}

function presentAlert(alert) {
  return {
    id: alert.id,
    transactionId: alert.transactionId,
    anomalyType: alert.anomalyType,
    description: alert.description,
    severity: alert.severity,
    status: alert.status,
    reviewNotes: alert.reviewNotes,
    createdAt: alert.createdAt,
    orderTotal: alert.transaction ? fromCentavos(alert.transaction.totalCentavos) : undefined,
    orderDate: alert.transaction?.orderDate,
  }
}

async function listAlerts(query) {
  const { page, pageSize, skip } = pageParams(query)
  const where = {}
  if (query.status) where.status = query.status
  if (query.severity) where.severity = query.severity
  if (query.type) where.anomalyType = query.type
  if (query.from && query.to) where.createdAt = manilaRange(query.from, query.to)
  const [rows, total] = await Promise.all([
    prisma.anomalyAlert.findMany({
      where,
      include: { transaction: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.anomalyAlert.count({ where }),
  ])
  const open = await prisma.anomalyAlert.count({ where: { status: { in: ['new', 'reviewing'] } } })
  return {
    ...listResponse(rows.map(presentAlert), page, pageSize, total),
    summary: anomalySummary(open),
  }
}

function anomalySummary(open) {
  if (open === 0) {
    return {
      id: 'anomaly:none',
      category: 'anomaly',
      statement: 'There are no open anomaly alerts.',
      dataSource: 'anomaly_alerts',
      reason: 'No alerts are in New or Reviewing status.',
      basis: { openAlerts: 0 },
      recommendedAction: 'No review is waiting.',
      producer: 'rule-based',
      confidence: 'deterministic',
    }
  }
  return {
    id: 'anomaly:open',
    category: 'anomaly',
    statement: `${open} anomaly alert${open === 1 ? '' : 's'} still need review.`,
    dataSource: 'anomaly_alerts',
    reason: 'Alerts stay open until a manager marks them resolved or a false positive.',
    basis: { openAlerts: open },
    recommendedAction: 'Open the anomaly queue and set a status.',
    producer: 'rule-based',
    confidence: 'deterministic',
  }
}

async function updateAlert(id, input, user) {
  const existing = await prisma.anomalyAlert.findUnique({ where: { id }, include: { transaction: true } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Anomaly alert not found.')
  const allowed = ['new', 'reviewing', 'resolved', 'false_positive']
  if (input.status && !allowed.includes(input.status)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Status must be new, reviewing, resolved, or false positive.')
  }
  const totalBefore = existing.transaction.totalCentavos
  const updated = await prisma.anomalyAlert.update({
    where: { id },
    data: {
      status: input.status || existing.status,
      reviewNotes: input.reviewNotes === undefined ? existing.reviewNotes : input.reviewNotes,
    },
    include: { transaction: true },
  })
  if (updated.transaction.totalCentavos !== totalBefore) {
    throw new AppError(500, 'INTERNAL', 'Anomaly review must not change the transaction.')
  }
  const { writeAudit } = require('../../lib/audit')
  await writeAudit(prisma, {
    userId: user.id,
    action: 'update',
    entity: 'order',
    entityId: existing.transactionId,
    oldValue: { anomalyStatus: existing.status },
    newValue: { anomalyStatus: updated.status, reviewNotes: updated.reviewNotes },
  })
  return presentAlert(updated)
}

module.exports = {
  evaluateOrder,
  evaluateRepeatedVoids,
  evaluateAll,
  listAlerts,
  updateAlert,
  anomalySummary,
  daysBetweenManila,
}
