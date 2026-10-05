const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')
const { toCentavos, fromCentavos } = require('../../lib/money')
const { manilaDateString, manilaRange, addManilaDays, manilaParts } = require('../../lib/dates')
const { providerFor } = require('../../integrations/payments/ManualPaymentProvider')
const {
  CATEGORIES,
  applyPayments,
  incompleteMessage,
  assertNoSensitive,
  assertNoPan,
  summaryDto,
} = require('./summary')

function presentMethod(method) {
  return {
    id: method.id,
    name: method.name,
    category: method.category,
    provider: method.provider,
    code: method.code,
    description: method.description || '',
    isActive: method.isActive,
    displayOrder: method.displayOrder,
    allowsChange: method.allowsChange,
    requiresReference: method.requiresReference,
    qrConfig: method.qrConfig || '',
    createdAt: method.createdAt,
    updatedAt: method.updatedAt,
  }
}

function presentLine(line) {
  const lastFour = line.cardLastFour || ''
  return {
    id: line.id,
    paymentMethodId: line.paymentMethodId,
    method: line.method?.name,
    category: line.method?.category,
    provider: line.method?.provider,
    code: line.method?.code,
    amount: fromCentavos(line.amountCentavos),
    referenceNumber: line.referenceNumber || '',
    authorizationCode: line.authorizationCode || '',
    cardLastFour: lastFour,
    cardMask: lastFour ? `**** **** **** ${lastFour}` : '',
    notes: line.notes || '',
    paymentStatus: line.paymentStatus,
    paidAt: line.paidAt,
  }
}

function appliedFromLine(line) {
  return {
    amountCentavos: line.amountCentavos,
    category: line.method.category,
    allowsChange: line.method.allowsChange,
    status: line.paymentStatus,
    name: line.method.name,
  }
}

async function listMethods() {
  const rows = await prisma.paymentMethod.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] })
  return rows.map(presentMethod)
}

async function listActiveMethods() {
  const rows = await prisma.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
  return rows.map(presentMethod)
}

function cleanCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '_')
}

async function createMethod(input, user) {
  const code = cleanCode(input.code)
  const category = input.category
  if (!CATEGORIES.includes(category)) throw new AppError(400, 'VALIDATION_ERROR', 'Choose a payment category.')
  const existing = await prisma.paymentMethod.findUnique({ where: { code } })
  if (existing) throw new AppError(409, 'CONFLICT', 'That payment code is already in use.')
  const created = await prisma.paymentMethod.create({
    data: {
      name: input.name.trim(),
      category,
      provider: input.provider.trim(),
      code,
      description: input.description?.trim() || '',
      isActive: input.isActive !== false,
      displayOrder: Number.isInteger(input.displayOrder) ? input.displayOrder : await nextDisplayOrder(),
      allowsChange: category === 'CASH' ? true : Boolean(input.allowsChange),
      requiresReference: Boolean(input.requiresReference),
      qrConfig: input.qrConfig?.trim() || null,
    },
  })
  await writeAudit(prisma, {
    userId: user?.id,
    action: 'create',
    entity: 'payment_method',
    entityId: created.id,
    newValue: { name: created.name, code: created.code, category: created.category },
  })
  return presentMethod(created)
}

async function nextDisplayOrder() {
  const last = await prisma.paymentMethod.findFirst({ orderBy: { displayOrder: 'desc' } })
  return (last?.displayOrder || 0) + 1
}

async function updateMethod(id, input, user) {
  const existing = await prisma.paymentMethod.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Payment method not found.')
  const data = {}
  if (input.name != null) data.name = input.name.trim()
  if (input.category != null) {
    if (!CATEGORIES.includes(input.category)) throw new AppError(400, 'VALIDATION_ERROR', 'Choose a payment category.')
    data.category = input.category
  }
  if (input.provider != null) data.provider = input.provider.trim()
  if (input.code != null) {
    const code = cleanCode(input.code)
    const clash = await prisma.paymentMethod.findFirst({ where: { code, NOT: { id } } })
    if (clash) throw new AppError(409, 'CONFLICT', 'That payment code is already in use.')
    data.code = code
  }
  if (input.description != null) data.description = input.description.trim()
  if (input.isActive != null) data.isActive = Boolean(input.isActive)
  if (input.displayOrder != null) data.displayOrder = Number(input.displayOrder)
  if (input.allowsChange != null) data.allowsChange = Boolean(input.allowsChange)
  if (input.requiresReference != null) data.requiresReference = Boolean(input.requiresReference)
  if (input.qrConfig != null) data.qrConfig = input.qrConfig.trim() || null
  const updated = await prisma.paymentMethod.update({ where: { id }, data })
  await writeAudit(prisma, {
    userId: user?.id,
    action: 'update',
    entity: 'payment_method',
    entityId: id,
    oldValue: { name: existing.name, isActive: existing.isActive, displayOrder: existing.displayOrder },
    newValue: { name: updated.name, isActive: updated.isActive, displayOrder: updated.displayOrder },
  })
  return presentMethod(updated)
}

async function setMethodStatus(id, isActive, user) {
  return updateMethod(id, { isActive: Boolean(isActive) }, user)
}

async function buildRows(db, inputs) {
  const rows = []
  for (const input of inputs) {
    assertNoSensitive(input)
    const method = await db.paymentMethod.findUnique({ where: { id: input.paymentMethodId } })
    if (!method || !method.isActive) {
      throw new AppError(422, 'BUSINESS_RULE', 'Only active payment methods may be selected.')
    }
    const amountCentavos = toCentavos(input.amount)
    if (amountCentavos <= 0) throw new AppError(400, 'VALIDATION_ERROR', 'Enter a payment amount.')
    const referenceNumber = String(input.referenceNumber || '').trim()
    const authorizationCode = String(input.authorizationCode || '').trim()
    const notes = String(input.notes || '').trim()
    assertNoPan(referenceNumber, 'Reference number')
    assertNoPan(authorizationCode, 'Authorization code')
    assertNoPan(notes, 'Notes')
    let cardLastFour = ''
    if (method.category === 'CARD' && input.cardLastFour) {
      const raw = String(input.cardLastFour).trim()
      assertNoPan(raw, 'Card last 4 digits')
      if (!/^\d{4}$/.test(raw)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Enter only the last 4 digits. Full card numbers are not stored.')
      }
      cardLastFour = raw
    }
    if (method.requiresReference && !referenceNumber) {
      throw new AppError(400, 'VALIDATION_ERROR', `${method.name} requires a reference number.`)
    }
    rows.push({
      method,
      amountCentavos,
      referenceNumber,
      authorizationCode,
      cardLastFour,
      notes,
      category: method.category,
      allowsChange: method.allowsChange,
      status: 'PAID',
      name: method.name,
    })
  }
  return rows
}

async function recordPayments(tx, { orderId, inputs, netCentavos, user, allowPartial }) {
  const rows = await buildRows(tx, inputs || [])
  const applied = applyPayments(netCentavos, rows)
  if (applied.error) throw new AppError(422, 'BUSINESS_RULE', applied.error)
  if (applied.balanceDue > 0 && !allowPartial) {
    throw new AppError(422, 'BUSINESS_RULE', incompleteMessage(applied.balanceDue))
  }
  const provider = providerFor()
  for (const row of rows) {
    const recorded = await provider.createPayment({ amountCentavos: row.amountCentavos, methodCode: row.method.code })
    const payment = await tx.orderPayment.create({
      data: {
        orderId,
        paymentMethodId: row.method.id,
        amountCentavos: row.amountCentavos,
        referenceNumber: row.referenceNumber,
        authorizationCode: row.authorizationCode,
        cardLastFour: row.cardLastFour,
        notes: row.notes,
        paymentStatus: recorded.status,
        paidAt: new Date(),
        createdById: user?.id || null,
      },
    })
    await writeAudit(tx, {
      userId: user?.id,
      action: 'PAYMENT_RECORDED',
      entity: 'order',
      entityId: orderId,
      newValue: {
        paymentId: payment.id,
        method: row.method.name,
        category: row.method.category,
        amount: fromCentavos(row.amountCentavos),
      },
    })
  }
  const paymentStatus = rows.length === 0 && netCentavos > 0 ? 'PENDING' : applied.paymentStatus
  await tx.order.update({ where: { id: orderId }, data: { paymentStatus } })
  return applied
}

async function loadOrder(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderPayments: { include: { method: true }, orderBy: { createdAt: 'asc' } } },
  })
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.')
  return order
}

async function paymentSummary(orderId) {
  const order = await loadOrder(orderId)
  const applied = applyPayments(order.totalCentavos, order.orderPayments.map(appliedFromLine))
  return summaryDto(order, applied, order.orderPayments)
}

async function listOrderPayments(orderId) {
  const order = await loadOrder(orderId)
  return order.orderPayments.map(presentLine)
}

async function addOrderPayment(orderId, input, user) {
  assertNoSensitive(input)
  const order = await loadOrder(orderId)
  if (order.status !== 'completed') {
    throw new AppError(422, 'BUSINESS_RULE', 'Payments can only be recorded on a completed order.')
  }
  if (['VOIDED', 'REFUNDED'].includes(order.paymentStatus)) {
    throw new AppError(422, 'BUSINESS_RULE', 'This order no longer accepts payments.')
  }
  await prisma.$transaction(async (tx) => {
    const [row] = await buildRows(tx, [input])
    const existing = order.orderPayments.map(appliedFromLine)
    const applied = applyPayments(order.totalCentavos, [...existing, row])
    if (applied.error) throw new AppError(422, 'BUSINESS_RULE', applied.error)
    const recorded = await providerFor().createPayment({ amountCentavos: row.amountCentavos, methodCode: row.method.code })
    const payment = await tx.orderPayment.create({
      data: {
        orderId,
        paymentMethodId: row.method.id,
        amountCentavos: row.amountCentavos,
        referenceNumber: row.referenceNumber,
        authorizationCode: row.authorizationCode,
        cardLastFour: row.cardLastFour,
        notes: row.notes,
        paymentStatus: recorded.status,
        paidAt: new Date(),
        createdById: user?.id || null,
      },
    })
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: applied.paymentStatus } })
    await writeAudit(tx, {
      userId: user?.id,
      action: 'PAYMENT_RECORDED',
      entity: 'order',
      entityId: orderId,
      newValue: { paymentId: payment.id, method: row.method.name, amount: fromCentavos(row.amountCentavos) },
    })
  })
}

async function removeOrderPayment(orderId, paymentId, user) {
  const order = await loadOrder(orderId)
  const payment = order.orderPayments.find((line) => line.id === paymentId)
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'Payment not found.')
  if (order.paymentStatus === 'PAID' || order.status !== 'completed') {
    throw new AppError(422, 'BUSINESS_RULE', 'Completed payments cannot be deleted.')
  }
  await prisma.$transaction(async (tx) => {
    await tx.orderPayment.delete({ where: { id: paymentId } })
    const remaining = order.orderPayments.filter((line) => line.id !== paymentId).map(appliedFromLine)
    const applied = applyPayments(order.totalCentavos, remaining)
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: applied.paymentStatus } })
    await writeAudit(tx, {
      userId: user?.id,
      action: 'PAYMENT_REMOVED',
      entity: 'order',
      entityId: orderId,
      oldValue: { paymentId, method: payment.method.name, amount: fromCentavos(payment.amountCentavos) },
    })
  })
}

async function completeOrderPayments(orderId, user) {
  const order = await loadOrder(orderId)
  if (order.status !== 'completed') {
    throw new AppError(422, 'BUSINESS_RULE', 'Only a completed order can be settled.')
  }
  const applied = applyPayments(order.totalCentavos, order.orderPayments.map(appliedFromLine))
  if (applied.error) throw new AppError(422, 'BUSINESS_RULE', applied.error)
  if (applied.balanceDue > 0) throw new AppError(422, 'BUSINESS_RULE', incompleteMessage(applied.balanceDue))
  await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'PAID' } })
  await writeAudit(prisma, {
    userId: user?.id,
    action: 'PAYMENT_COMPLETED',
    entity: 'order',
    entityId: orderId,
    newValue: { paymentStatus: 'PAID', totalPaid: fromCentavos(applied.totalPaid) },
  })
}

async function voidOrderPayments(tx, orderId) {
  await tx.orderPayment.updateMany({
    where: { orderId, paymentStatus: 'PAID' },
    data: { paymentStatus: 'VOIDED' },
  })
}

function reportRange(query) {
  const today = manilaDateString()
  if (query.from && query.to) return { from: query.from, to: query.to }
  if (query.preset === 'yesterday') {
    const day = addManilaDays(today, -1)
    return { from: day, to: day }
  }
  if (query.preset === 'week') return { from: addManilaDays(today, -6), to: today }
  if (query.preset === 'month') {
    const { year, month } = manilaParts()
    return { from: `${year}-${String(month).padStart(2, '0')}-01`, to: today }
  }
  return { from: today, to: today }
}

async function paymentReport(query) {
  const range = reportRange(query)
  const when = manilaRange(range.from, range.to)
  const [orders, payments] = await Promise.all([
    prisma.order.findMany({
      where: { status: 'completed', orderDate: when },
      select: { totalCentavos: true },
    }),
    prisma.orderPayment.findMany({
      where: { paymentStatus: 'PAID', paidAt: when, order: { status: 'completed' } },
      include: { method: true },
    }),
  ])
  const buckets = new Map()
  let change = 0
  const byOrder = new Map()
  for (const payment of payments) {
    const key = payment.method.id
    const current = buckets.get(key) || {
      method: payment.method.name,
      category: payment.method.category,
      amountCentavos: 0,
    }
    current.amountCentavos += payment.amountCentavos
    buckets.set(key, current)
    const list = byOrder.get(payment.orderId) || []
    list.push(appliedFromLine(payment))
    byOrder.set(payment.orderId, list)
  }
  const orderTotals = byOrder.size === 0 ? [] : await prisma.order.findMany({
    where: { id: { in: [...byOrder.keys()] } },
    select: { id: true, totalCentavos: true },
  })
  for (const order of orderTotals) {
    const applied = applyPayments(order.totalCentavos, byOrder.get(order.id) || [])
    change += applied.change
  }
  const sales = orders.reduce((sum, order) => sum + order.totalCentavos, 0)
  const paid = payments.reduce((sum, payment) => sum + payment.amountCentavos, 0)
  return {
    from: range.from,
    to: range.to,
    sales: fromCentavos(sales),
    payments: fromCentavos(paid),
    change: fromCentavos(change),
    breakdown: [...buckets.values()]
      .sort((a, b) => b.amountCentavos - a.amountCentavos)
      .map((row) => ({
        label: row.method,
        category: row.category,
        value: fromCentavos(row.amountCentavos),
      })),
  }
}

module.exports = {
  presentMethod,
  presentLine,
  listMethods,
  listActiveMethods,
  createMethod,
  updateMethod,
  setMethodStatus,
  recordPayments,
  paymentSummary,
  listOrderPayments,
  addOrderPayment,
  removeOrderPayment,
  completeOrderPayments,
  voidOrderPayments,
  paymentReport,
  applyPayments,
}
