const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')
const { pageParams, listResponse } = require('../../lib/pagination')
const { toCentavos, fromCentavos } = require('../../lib/money')
const { stockStatus, evaluateProduct } = require('../inventory/service')
const { recalculateCustomer } = require('../customerValue/service')
const { PAYMENT_METHODS, groupPayments, unitPriceCentavos, lineCommission } = require('../pricing/rates')
const { activeDermtech } = require('../dermtechs/service')
const { recordPayments, voidOrderPayments, presentLine } = require('../payments/service')
const { applyPayments, assertNoSensitive } = require('../payments/summary')

function readAmount(value) {
  if (value == null || value === '') return 0
  return toCentavos(value)
}

function readPayments(input) {
  const source = input?.payments || {}
  const payments = {}
  let tender = 0
  for (const method of PAYMENT_METHODS) {
    const amount = readAmount(source[method])
    payments[method] = amount
    tender += amount
  }
  return { payments, tender }
}

function paymentView(order) {
  const lines = order.orderPayments || []
  if (lines.length > 0) {
    const applied = applyPayments(order.totalCentavos, lines.map((line) => ({
      amountCentavos: line.amountCentavos,
      category: line.method?.category,
      allowsChange: line.method?.allowsChange,
      status: line.paymentStatus,
    })))
    const rollup = { cash: 0, ewallet: 0, qr: 0, card: 0 }
    for (const line of lines) {
      if (line.paymentStatus !== 'PAID') continue
      const key = String(line.method?.category || '').toLowerCase()
      if (key in rollup) rollup[key] += line.amountCentavos
    }
    return {
      payments: Object.fromEntries(Object.entries(rollup).map(([key, amount]) => [key, fromCentavos(amount)])),
      paymentLines: lines.map(presentLine),
      paymentTotal: fromCentavos(applied.totalPaid),
      totalPaid: fromCentavos(applied.totalPaid),
      balance: fromCentavos(applied.balanceDue),
      balanceDue: fromCentavos(applied.balanceDue),
      change: fromCentavos(applied.change),
      paymentStatus: ['VOIDED', 'REFUNDED', 'FAILED'].includes(order.paymentStatus) ? order.paymentStatus : applied.paymentStatus,
    }
  }
  const payments = groupPayments(order.paymentsJson ? JSON.parse(order.paymentsJson) : {})
  const tender = PAYMENT_METHODS.reduce((sum, method) => sum + (payments[method] || 0), 0)
  const tip = order.tipCentavos || 0
  const paymentTotal = tender - tip
  const balance = order.totalCentavos - paymentTotal
  return {
    payments: Object.fromEntries(PAYMENT_METHODS.map((method) => [method, fromCentavos(payments[method] || 0)])),
    paymentLines: [],
    paymentTotal: fromCentavos(paymentTotal),
    totalPaid: fromCentavos(Math.max(0, tender)),
    balance: fromCentavos(balance),
    balanceDue: fromCentavos(Math.max(0, balance)),
    change: '0.00',
    paymentStatus: order.paymentStatus || 'PENDING',
  }
}

function presentOrder(order) {
  const tip = order.tipCentavos || 0
  const paid = paymentView(order)
  const items = (order.items || []).map((item) => {
    const earned = lineCommission({
      subtotalCentavos: item.subtotalCentavos,
      quantity: item.quantity,
      commissionPercent: item.product?.commissionPercent,
      commissionFlatCentavos: item.product?.commissionFlatCentavos,
    })
    return {
      productId: item.productId,
      name: item.product?.name,
      type: item.product?.type,
      priceRate: item.priceRate || 'regular',
      quantity: item.quantity,
      unitPrice: fromCentavos(item.unitPriceCentavos),
      subtotal: fromCentavos(item.subtotalCentavos),
      dermtechId: item.dermtechId || null,
      dermtechName: item.dermtech?.name || null,
      commissionPercent: item.product?.commissionPercent || 0,
      commissionRate: earned.rateLabel,
      commission: fromCentavos(earned.commissionCentavos),
    }
  })
  const commission = (order.items || []).reduce((sum, item) => sum + lineCommission({
    subtotalCentavos: item.subtotalCentavos,
    quantity: item.quantity,
    commissionPercent: item.product?.commissionPercent,
    commissionFlatCentavos: item.product?.commissionFlatCentavos,
  }).commissionCentavos, 0)
  const subtotal = items.reduce((sum, item) => sum + toCentavos(item.subtotal), 0) + (order.ppeCentavos || 0) + (order.gcCentavos || 0)
  return {
    id: order.id,
    customerId: order.customerId,
    customerName: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : undefined,
    orderDate: order.orderDate,
    status: order.status,
    source: order.source,
    subtotal: fromCentavos(subtotal),
    total: fromCentavos(order.totalCentavos),
    discount: fromCentavos(order.discountCentavos),
    ppe: fromCentavos(order.ppeCentavos || 0),
    gc: fromCentavos(order.gcCentavos || 0),
    tip: fromCentavos(tip),
    ...paid,
    commission: fromCentavos(commission),
    voidReason: order.voidReason,
    cashierName: order.createdBy?.name || '',
    items,
  }
}

const includeOrder = {
  customer: true,
  createdBy: true,
  items: { include: { product: true, dermtech: true } },
  orderPayments: { include: { method: true }, orderBy: { createdAt: 'asc' } },
}

async function listOrders(query) {
  const { page, pageSize, skip } = pageParams(query)
  const where = {}
  if (query.status) where.status = query.status
  if (query.customerId) where.customerId = query.customerId
  if (query.source) where.source = query.source
  if (query.from && query.to) {
    const { manilaRange } = require('../../lib/dates')
    where.orderDate = manilaRange(query.from, query.to)
  }
  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, include: includeOrder, orderBy: { orderDate: 'desc' }, skip, take: pageSize }),
    prisma.order.count({ where }),
  ])
  return listResponse(rows.map(presentOrder), page, pageSize, total)
}

async function getOrder(id) {
  const order = await prisma.order.findUnique({ where: { id }, include: includeOrder })
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.')
  return presentOrder(order)
}

async function createOrder(input, user) {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } })
  if (!customer) throw new AppError(404, 'NOT_FOUND', 'Customer not found.')
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Add at least one line.')
  }
  const discount = input.discount ? toCentavos(input.discount) : 0
  const ppe = readAmount(input.ppe)
  const gc = readAmount(input.gc)
  const tip = readAmount(input.tip)
  const recorded = Array.isArray(input.payments)
  if (recorded) assertNoSensitive(input)
  const { payments, tender } = recorded ? { payments: {}, tender: 0 } : readPayments(input)
  if (!recorded && tip > tender) throw new AppError(422, 'BUSINESS_RULE', 'Tip cannot exceed the payments received.')
  const lines = []
  for (const line of input.lines) {
    const product = await prisma.productService.findUnique({ where: { id: line.productId } })
    if (!product || product.status !== 'active') {
      throw new AppError(422, 'BUSINESS_RULE', 'One of the selected items is not available.')
    }
    const quantity = Number(line.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Quantity must be a whole number of at least 1.')
    }
    const rate = line.priceRate || 'regular'
    const unit = line.unitPrice != null && line.unitPrice !== '' && !line.priceRate
      ? toCentavos(line.unitPrice)
      : unitPriceCentavos(product, rate)
    const dermtech = await activeDermtech(prisma, line.dermtechId)
    lines.push({ product, quantity, rate, unit, subtotal: unit * quantity, dermtechId: dermtech?.id || null })
  }
  const gross = lines.reduce((sum, line) => sum + line.subtotal, 0) + ppe + gc
  if (discount > gross) throw new AppError(422, 'BUSINESS_RULE', 'Discount cannot exceed the order total.')
  const total = recorded ? gross - discount + tip : gross - discount
  const orderDate = input.orderDate ? new Date(input.orderDate) : new Date()
  if (Number.isNaN(orderDate.getTime())) throw new AppError(400, 'VALIDATION_ERROR', 'Order date is invalid.')

  const created = await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      if (!line.product.tracksInventory) continue
      const inventory = await tx.inventory.findUnique({ where: { productId: line.product.id } })
      if (!inventory || inventory.currentStock < line.quantity) {
        throw new AppError(422, 'BUSINESS_RULE', `${line.product.name} does not have enough stock.`)
      }
    }
    const order = await tx.order.create({
      data: {
        customerId: customer.id,
        totalCentavos: total,
        discountCentavos: discount,
        ppeCentavos: ppe,
        gcCentavos: gc,
        tipCentavos: tip,
        paymentsJson: recorded ? null : JSON.stringify(payments),
        paymentStatus: 'PENDING',
        createdById: user?.id || null,
        orderDate,
        status: 'completed',
        source: input.source || 'manual',
        externalPosId: input.externalPosId || null,
        items: {
          create: lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            priceRate: line.rate,
            unitPriceCentavos: line.unit,
            subtotalCentavos: line.subtotal,
            dermtechId: line.dermtechId,
          })),
        },
      },
    })
    for (const line of lines) {
      if (!line.product.tracksInventory) continue
      const inventory = await tx.inventory.findUnique({ where: { productId: line.product.id } })
      const next = inventory.currentStock - line.quantity
      await tx.inventory.update({
        where: { productId: line.product.id },
        data: { currentStock: next, status: stockStatus(next, inventory.reorderLevel) },
      })
      await tx.inventoryMovement.create({
        data: {
          productId: line.product.id,
          quantityDelta: -line.quantity,
          reason: 'sale',
          referenceType: 'order',
          referenceId: order.id,
          createdById: user?.id || null,
        },
      })
    }
    if (recorded) {
      await recordPayments(tx, {
        orderId: order.id,
        inputs: input.payments,
        netCentavos: total,
        user,
        allowPartial: Boolean(input.allowPartial),
      })
    }
    await writeAudit(tx, {
      userId: user?.id,
      action: 'create',
      entity: 'order',
      entityId: order.id,
      newValue: { total: fromCentavos(total), discount: fromCentavos(discount), customerId: customer.id },
    })
    return order
  })

  await recalculateCustomer(customer.id)
  for (const line of lines) {
    if (line.product.tracksInventory) await evaluateProduct(line.product.id)
  }
  const { evaluateOrder } = require('../anomalies/service')
  await evaluateOrder(created.id)
  return getOrder(created.id)
}

async function reverseCompleted(id, status, reason, user) {
  const existing = await prisma.order.findUnique({ where: { id }, include: { items: { include: { product: true } } } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Order not found.')
  if (existing.status !== 'completed') {
    throw new AppError(422, 'BUSINESS_RULE', 'Only a completed order can be voided or cancelled.')
  }
  if (!reason || !String(reason).trim()) throw new AppError(400, 'VALIDATION_ERROR', 'A reason is required.')

  await prisma.$transaction(async (tx) => {
    await voidOrderPayments(tx, id)
    await tx.order.update({
      where: { id },
      data: { status, paymentStatus: 'VOIDED', voidReason: String(reason).trim(), voidedById: user.id },
    })
    for (const item of existing.items) {
      if (!item.product.tracksInventory) continue
      const inventory = await tx.inventory.findUnique({ where: { productId: item.productId } })
      const next = inventory.currentStock + item.quantity
      await tx.inventory.update({
        where: { productId: item.productId },
        data: { currentStock: next, status: stockStatus(next, inventory.reorderLevel) },
      })
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          quantityDelta: item.quantity,
          reason: 'void_reversal',
          referenceType: 'order',
          referenceId: id,
          createdById: user.id,
          note: String(reason).trim(),
        },
      })
    }
    await writeAudit(tx, {
      userId: user.id,
      action: 'void',
      entity: 'order',
      entityId: id,
      oldValue: { status: 'completed', total: fromCentavos(existing.totalCentavos) },
      newValue: { status, reason: String(reason).trim() },
    })
  })

  await recalculateCustomer(existing.customerId)
  for (const item of existing.items) {
    if (item.product.tracksInventory) await evaluateProduct(item.productId)
  }
  if (status === 'voided') {
    const { evaluateRepeatedVoids } = require('../anomalies/service')
    await evaluateRepeatedVoids(user.id, id)
  }
  return getOrder(id)
}

module.exports = { listOrders, getOrder, createOrder, presentOrder, voidOrder: (id, reason, user) => reverseCompleted(id, 'voided', reason, user), cancelOrder: (id, reason, user) => reverseCompleted(id, 'cancelled', reason, user) }
