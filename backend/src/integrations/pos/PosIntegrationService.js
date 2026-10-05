const { prisma } = require('../../lib/prisma')
const mock = require('../../integrations/pos/MockPosProvider')
const { createOrder } = require('../../modules/orders/service')
const { toCentavos } = require('../../lib/money')
const { stockStatus } = require('../../modules/inventory/service')
const { recalculateCustomer } = require('../../modules/customerValue/service')
const { writeAudit } = require('../../lib/audit')

let lastSyncAt = null

async function sync(resources, user) {
  const selected = resources?.length ? resources : ['customers', 'transactions', 'inventory']
  const summary = { processed: 0, created: 0, updated: 0, skipped: 0, provider: 'mock' }
  if (selected.includes('customers')) await syncCustomers(summary)
  if (selected.includes('inventory')) await syncInventory(summary, user)
  if (selected.includes('transactions')) await syncTransactions(summary, user)
  if (selected.includes('inventory') && selected.includes('transactions')) {
    await syncInventory(summary, user)
  }
  lastSyncAt = new Date()
  await writeAudit(prisma, {
    userId: user.id,
    action: 'sync',
    entity: 'order',
    entityId: 'pos-sync',
    newValue: { ...summary, resources: selected },
  })
  return summary
}

async function syncCustomers(summary) {
  const rows = await mock.getCustomers()
  for (const row of rows) {
    summary.processed += 1
    const existing = await prisma.customer.findUnique({ where: { externalPosId: row.externalPosId } })
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { firstName: row.firstName, lastName: row.lastName, phone: row.phone, email: row.email },
      })
      summary.updated += 1
    } else {
      const customer = await prisma.customer.create({
        data: { ...row, customerType: 'individual', status: 'active' },
      })
      await recalculateCustomer(customer.id)
      summary.created += 1
    }
  }
}

async function syncTransactions(summary, user) {
  const rows = await mock.getTransactions()
  for (const row of rows) {
    summary.processed += 1
    const existing = await prisma.order.findUnique({ where: { externalPosId: row.externalPosId } })
    if (existing) {
      summary.skipped += 1
      continue
    }
    const customer = await prisma.customer.findUnique({ where: { externalPosId: row.customerExternalId } })
    if (!customer) {
      summary.skipped += 1
      continue
    }
    const lines = []
    for (const line of row.lines) {
      const product = await prisma.productService.findUnique({ where: { externalPosId: line.productExternalId } })
      if (!product) continue
      lines.push({ productId: product.id, quantity: line.quantity })
    }
    if (!lines.length) {
      summary.skipped += 1
      continue
    }
    await createOrder({
      customerId: customer.id,
      orderDate: row.orderDate,
      source: 'mock_pos',
      externalPosId: row.externalPosId,
      lines,
    }, user)
    summary.created += 1
  }
}

async function syncInventory(summary, user) {
  const rows = await mock.getInventory()
  for (const row of rows) {
    summary.processed += 1
    let product = await prisma.productService.findUnique({ where: { externalPosId: row.externalPosId }, include: { inventory: true } })
    if (!product) {
      product = await prisma.productService.create({
        data: {
          name: row.name,
          type: row.type,
          priceCentavos: toCentavos(row.price),
          tracksInventory: true,
          status: 'active',
          externalPosId: row.externalPosId,
          inventory: {
            create: {
              currentStock: row.stock,
              reorderLevel: row.reorderLevel,
              reorderQuantity: row.reorderQuantity,
              unitCostCentavos: toCentavos(row.unitCost),
              status: stockStatus(row.stock, row.reorderLevel),
            },
          },
        },
        include: { inventory: true },
      })
      summary.created += 1
      continue
    }
    const delta = row.stock - product.inventory.currentStock
    if (delta !== 0) {
      await prisma.inventory.update({
        where: { productId: product.id },
        data: { currentStock: row.stock, status: stockStatus(row.stock, row.reorderLevel), reorderLevel: row.reorderLevel },
      })
      await prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          quantityDelta: delta,
          reason: 'adjustment',
          note: 'POS snapshot',
          createdById: user.id,
        },
      })
      summary.updated += 1
    } else {
      summary.skipped += 1
    }
  }
}

function status() {
  return { provider: 'mock', lastSyncAt }
}

module.exports = { sync, status }
