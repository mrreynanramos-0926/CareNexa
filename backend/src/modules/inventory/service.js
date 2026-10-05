const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { toCentavos, fromCentavos } = require('../../lib/money')
const { quotePrices } = require('../pricing/rates')
const { pageParams, listResponse } = require('../../lib/pagination')

function stockStatus(stock, reorderLevel) {
  if (stock <= 0) return 'out_of_stock'
  if (stock < reorderLevel) return 'low_stock'
  return 'in_stock'
}

function presentProduct(product) {
  return {
    id: product.id,
    name: product.name,
    type: product.type,
    description: product.description,
    price: fromCentavos(product.priceCentavos),
    cashPrice: product.cashPriceCentavos == null ? null : fromCentavos(product.cashPriceCentavos),
    commissionPercent: product.commissionPercent || 0,
    commissionFlat: product.commissionFlatCentavos == null ? null : fromCentavos(product.commissionFlatCentavos),
    rates: quotePrices(product),
    tracksInventory: product.tracksInventory,
    status: product.status,
    stock: product.inventory ? product.inventory.currentStock : null,
    inventoryStatus: product.inventory ? product.inventory.status : null,
  }
}

async function listProducts(query) {
  const { page, pageSize, skip } = pageParams(query)
  const where = {}
  if (query.status) where.status = query.status
  if (query.type) where.type = query.type
  const [rows, total] = await Promise.all([
    prisma.productService.findMany({ where, include: { inventory: true }, orderBy: { name: 'asc' }, skip, take: pageSize }),
    prisma.productService.count({ where }),
  ])
  return listResponse(rows.map(presentProduct), page, pageSize, total)
}

async function createProduct(input) {
  if (!['product', 'service'].includes(input.type)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Type must be product or service.')
  }
  const tracksInventory = input.type === 'product' ? input.tracksInventory !== false : false
  const product = await prisma.productService.create({
    data: {
      name: input.name.trim(),
      type: input.type,
      description: input.description?.trim() || null,
      priceCentavos: toCentavos(input.price),
      tracksInventory,
      status: input.status || 'active',
      inventory: tracksInventory
        ? {
            create: {
              currentStock: 0,
              reorderLevel: Number(input.reorderLevel ?? 5),
              reorderQuantity: Number(input.reorderQuantity ?? 10),
              unitCostCentavos: toCentavos(input.unitCost || '0'),
              status: 'out_of_stock',
            },
          }
        : undefined,
    },
    include: { inventory: true },
  })
  return presentProduct(product)
}

async function updateProduct(id, input) {
  const existing = await prisma.productService.findUnique({ where: { id }, include: { inventory: true } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Product or service not found.')
  const data = {
    name: input.name?.trim() || existing.name,
    description: input.description === undefined ? existing.description : input.description,
    status: input.status || existing.status,
  }
  if (input.price != null) data.priceCentavos = toCentavos(input.price)
  const product = await prisma.productService.update({ where: { id }, data, include: { inventory: true } })
  return presentProduct(product)
}

async function getInventoryRow(productId) {
  const inventory = await prisma.inventory.findUnique({ where: { productId }, include: { product: true } })
  if (!inventory) throw new AppError(404, 'NOT_FOUND', 'Inventory record not found.')
  return inventory
}

function presentInventory(inventory) {
  return {
    id: inventory.id,
    productId: inventory.productId,
    name: inventory.product.name,
    type: inventory.product.type,
    currentStock: inventory.currentStock,
    reorderLevel: inventory.reorderLevel,
    reorderQuantity: inventory.reorderQuantity,
    unitCost: fromCentavos(inventory.unitCostCentavos),
    lastRestockDate: inventory.lastRestockDate,
    status: inventory.status,
  }
}

async function listInventory(query) {
  const { page, pageSize, skip } = pageParams(query)
  const where = {}
  if (query.status) where.status = query.status
  const [rows, total] = await Promise.all([
    prisma.inventory.findMany({ where, include: { product: true }, orderBy: { product: { name: 'asc' } }, skip, take: pageSize }),
    prisma.inventory.count({ where }),
  ])
  return listResponse(rows.map(presentInventory), page, pageSize, total)
}

async function updateInventorySettings(id, input) {
  const inventory = await prisma.inventory.findUnique({ where: { id }, include: { product: true } })
  if (!inventory) throw new AppError(404, 'NOT_FOUND', 'Inventory record not found.')
  const reorderLevel = input.reorderLevel ?? inventory.reorderLevel
  const updated = await prisma.inventory.update({
    where: { id },
    data: {
      reorderLevel,
      reorderQuantity: input.reorderQuantity ?? inventory.reorderQuantity,
      unitCostCentavos: input.unitCost != null ? toCentavos(input.unitCost) : inventory.unitCostCentavos,
      status: stockStatus(inventory.currentStock, reorderLevel),
    },
    include: { product: true },
  })
  await evaluateProduct(updated.productId)
  return presentInventory(await getInventoryRow(updated.productId))
}

async function changeStock(productId, delta, { reason, userId, note, referenceType, referenceId, restockDate }) {
  return prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findUnique({ where: { productId } })
    if (!inventory) throw new AppError(422, 'BUSINESS_RULE', 'This item does not track inventory.')
    const next = inventory.currentStock + delta
    if (next < 0) throw new AppError(422, 'BUSINESS_RULE', 'Stock cannot fall below zero.')
    const updated = await tx.inventory.update({
      where: { productId },
      data: {
        currentStock: next,
        status: stockStatus(next, inventory.reorderLevel),
        lastRestockDate: restockDate || inventory.lastRestockDate,
      },
    })
    await tx.inventoryMovement.create({
      data: {
        productId,
        quantityDelta: delta,
        reason,
        referenceType: referenceType || null,
        referenceId: referenceId || null,
        note: note || null,
        createdById: userId || null,
      },
    })
    return updated
  })
}

async function restock(input, user) {
  const product = await prisma.productService.findUnique({ where: { id: input.productId } })
  if (!product?.tracksInventory) throw new AppError(422, 'BUSINESS_RULE', 'This item does not track inventory.')
  const quantity = Number(input.quantity)
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Restock quantity must be at least 1.')
  }
  await changeStock(product.id, quantity, {
    reason: 'restock',
    userId: user.id,
    restockDate: new Date(),
  })
  if (input.unitCost != null) {
    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } })
    await prisma.inventory.update({
      where: { id: inventory.id },
      data: { unitCostCentavos: toCentavos(input.unitCost) },
    })
  }
  await writeAuditSafe(user, product.id, { restocked: quantity })
  await evaluateProduct(product.id)
  return presentInventory(await getInventoryRow(product.id))
}

async function adjust(input, user) {
  const quantityDelta = Number(input.quantityDelta)
  if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a non-zero whole-number adjustment.')
  }
  await changeStock(input.productId, quantityDelta, {
    reason: 'adjustment',
    userId: user.id,
    note: input.note || null,
  })
  await writeAuditSafe(user, input.productId, { quantityDelta, note: input.note || null })
  await evaluateProduct(input.productId)
  return presentInventory(await getInventoryRow(input.productId))
}

async function writeAuditSafe(user, productId, payload) {
  const { writeAudit } = require('../../lib/audit')
  await writeAudit(prisma, {
    userId: user.id,
    action: 'update',
    entity: 'inventory',
    entityId: productId,
    newValue: payload,
  })
}

async function movements(productId, query) {
  await getInventoryRow(productId)
  const { page, pageSize, skip } = pageParams(query)
  const where = { productId }
  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { createdBy: true } }),
    prisma.inventoryMovement.count({ where }),
  ])
  return listResponse(rows.map((row) => ({
    id: row.id,
    quantityDelta: row.quantityDelta,
    reason: row.reason,
    note: row.note,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    createdAt: row.createdAt,
    createdBy: row.createdBy?.name || 'System',
  })), page, pageSize, total)
}

async function evaluateProduct(productId) {
  const inventory = await prisma.inventory.findUnique({ where: { productId }, include: { product: true } })
  if (!inventory) return
  const desired = []
  if (inventory.currentStock <= 0) {
    desired.push({ alertType: 'out_of_stock', severity: 'high', message: `${inventory.product.name} is out of stock.` })
  } else if (inventory.currentStock < inventory.reorderLevel) {
    desired.push({
      alertType: 'low_stock',
      severity: 'medium',
      message: `${inventory.product.name} is below its reorder level (${inventory.currentStock} on hand, reorder at ${inventory.reorderLevel}).`,
    })
  }
  const open = await prisma.inventoryAlert.findMany({ where: { productId, status: 'open' } })
  for (const alert of open) {
    if (!desired.some((item) => item.alertType === alert.alertType)) {
      await prisma.inventoryAlert.update({
        where: { id: alert.id },
        data: { status: 'resolved', resolvedAt: new Date() },
      })
    }
  }
  for (const item of desired) {
    const exists = open.find((alert) => alert.alertType === item.alertType && alert.status === 'open')
    if (!exists) {
      await prisma.inventoryAlert.create({
        data: { productId, alertType: item.alertType, message: item.message, severity: item.severity, status: 'open' },
      })
    }
  }
}

async function evaluateAll() {
  const rows = await prisma.inventory.findMany({ select: { productId: true } })
  for (const row of rows) await evaluateProduct(row.productId)
  return { processed: rows.length, created: 0, updated: 0, skipped: 0 }
}

async function listAlerts(query) {
  const { page, pageSize, skip } = pageParams(query)
  const where = {}
  if (query.status) where.status = query.status
  const [rows, total] = await Promise.all([
    prisma.inventoryAlert.findMany({ where, include: { product: true }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    prisma.inventoryAlert.count({ where }),
  ])
  return listResponse(rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    alertType: row.alertType,
    message: row.message,
    severity: row.severity,
    status: row.status,
    createdAt: row.createdAt,
  })), page, pageSize, total)
}

async function unitsSoldSince(productId, since) {
  const rows = await prisma.orderItem.findMany({
    where: {
      productId,
      order: { status: 'completed', orderDate: { gte: since } },
    },
    select: { quantity: true },
  })
  return rows.reduce((sum, row) => sum + row.quantity, 0)
}

module.exports = {
  stockStatus,
  listProducts,
  createProduct,
  updateProduct,
  listInventory,
  updateInventorySettings,
  restock,
  adjust,
  changeStock,
  movements,
  evaluateProduct,
  evaluateAll,
  listAlerts,
  unitsSoldSince,
  presentInventory,
  getInventoryRow,
}
