const { prisma } = require('../../lib/prisma')
const { fromCentavos } = require('../../lib/money')
const { getSettingsMap } = require('../settings/service')
const { unitsSoldSince } = require('../inventory/service')
const { manilaRange, daysBetweenManila, defaultRange } = require('../../lib/dates')

const INSUFFICIENT = 'Insufficient data to generate this recommendation.'
const PRIORITY = ['Inactive', 'New', 'VIP', 'Loyal', 'Frequent', 'Regular']

function finding(partial) {
  return {
    producer: 'rule-based',
    confidence: 'deterministic',
    ...partial,
  }
}

function insufficient(category, dataSource, reason) {
  return finding({
    id: `${category}:insufficient`,
    category,
    statement: INSUFFICIENT,
    dataSource,
    reason,
    basis: {},
    recommendedAction: 'Add the missing records, then open this page again.',
  })
}

async function inventoryFindings() {
  const settings = await getSettingsMap()
  const rows = await prisma.inventory.findMany({ include: { product: true } })
  if (rows.length === 0) {
    return [insufficient('inventory', 'inventory', 'No stocked products exist.')]
  }
  const findings = []
  const now = new Date()
  for (const row of rows) {
    const ageDays = daysBetweenManila(row.product.createdAt, now)
    const rateSince = new Date(now.getTime() - settings.sales_rate_window_days * 86400000)
    const recentUnits = await unitsSoldSince(row.productId, rateSince)
    if (ageDays >= 7 && recentUnits > 0 && row.currentStock > 0) {
      const averageDaily = recentUnits / settings.sales_rate_window_days
      const daysOfCover = row.currentStock / averageDaily
      if (daysOfCover <= settings.days_of_cover_threshold) {
        findings.push(finding({
          id: `inventory:restock:${row.productId}`,
          category: 'inventory',
          statement: `${row.product.name} is projected to reach the reorder threshold within ${settings.days_of_cover_threshold} days.`,
          dataSource: 'inventory, order_items, orders',
          reason: `Average daily sales over the last ${settings.sales_rate_window_days} days imply days of cover at or below ${settings.days_of_cover_threshold}.`,
          basis: {
            stock: row.currentStock,
            reorderLevel: row.reorderLevel,
            unitsInWindow: recentUnits,
            windowDays: settings.sales_rate_window_days,
            daysOfCover: Number(daysOfCover.toFixed(1)),
          },
          recommendedAction: `Create a restock for ${row.reorderQuantity} units.`,
        }))
        findings.push(finding({
          id: `inventory:runout:${row.productId}`,
          category: 'inventory',
          statement: `${row.product.name} may run out within ${Math.max(1, Math.round(daysOfCover))} days at the recent sales rate.`,
          dataSource: 'inventory, order_items, orders',
          reason: 'Days of cover are at or below the configured threshold.',
          basis: { stock: row.currentStock, daysOfCover: Number(daysOfCover.toFixed(1)) },
          recommendedAction: 'Restock before the projected stock-out.',
        }))
      } else if (row.currentStock < row.reorderLevel) {
        findings.push(finding({
          id: `inventory:below:${row.productId}`,
          category: 'inventory',
          statement: `${row.product.name} is below its reorder level.`,
          dataSource: 'inventory',
          reason: 'Current stock is lower than the reorder level.',
          basis: { stock: row.currentStock, reorderLevel: row.reorderLevel },
          recommendedAction: `Create a restock for ${row.reorderQuantity} units.`,
        }))
      }
    } else if (row.currentStock < row.reorderLevel) {
      findings.push(finding({
        id: `inventory:below:${row.productId}`,
        category: 'inventory',
        statement: row.currentStock <= 0 ? `${row.product.name} is out of stock.` : `${row.product.name} is below its reorder level.`,
        dataSource: 'inventory',
        reason: 'Current stock is lower than the reorder level.',
        basis: { stock: row.currentStock, reorderLevel: row.reorderLevel },
        recommendedAction: `Create a restock for ${row.reorderQuantity} units.`,
      }))
    }

    if (ageDays >= settings.slow_moving_window_days && row.currentStock > 0) {
      const since = new Date(now.getTime() - settings.slow_moving_window_days * 86400000)
      const sold = await unitsSoldSince(row.productId, since)
      if (sold <= settings.slow_moving_units) {
        findings.push(finding({
          id: `inventory:slow:${row.productId}`,
          category: 'inventory',
          statement: `${row.product.name} is slow-moving.`,
          dataSource: 'inventory, order_items, orders',
          reason: `Units sold in ${settings.slow_moving_window_days} days are at or below ${settings.slow_moving_units}.`,
          basis: { unitsSold: sold, stock: row.currentStock, windowDays: settings.slow_moving_window_days },
          recommendedAction: 'Review whether to reorder this item.',
        }))
      }
    }
    if (ageDays >= settings.dead_stock_window_days && row.currentStock > 0) {
      const since = new Date(now.getTime() - settings.dead_stock_window_days * 86400000)
      const sold = await unitsSoldSince(row.productId, since)
      if (sold === 0) {
        findings.push(finding({
          id: `inventory:dead:${row.productId}`,
          category: 'inventory',
          statement: `${row.product.name} has had no sales in ${settings.dead_stock_window_days} days and still has stock.`,
          dataSource: 'inventory, order_items, orders',
          reason: 'Dead-stock rule: zero completed units in the configured window while stock remains.',
          basis: { unitsSold: 0, stock: row.currentStock, windowDays: settings.dead_stock_window_days },
          recommendedAction: 'Stop reordering this item until sales return.',
        }))
      }
    }
  }
  return findings.length ? findings : [insufficient('inventory', 'inventory', 'Stock exists, but no inventory rule fired and there is not enough sales history.')]
}

async function salesFindings(from, to) {
  const settings = await getSettingsMap()
  const range = manilaRange(from, to)
  const orderCount = await prisma.order.count({ where: { status: 'completed', orderDate: range } })
  if (orderCount === 0) {
    return [insufficient('sales', 'orders', 'There are no completed orders in the selected period.')]
  }
  const products = await prisma.productService.findMany()
  const findings = []
  const now = new Date()
  for (const product of products) {
    if (daysBetweenManila(product.createdAt, now) < 28) continue
    const recentSince = new Date(now.getTime() - 14 * 86400000)
    const priorSince = new Date(now.getTime() - 28 * 86400000)
    const recent = await unitsSoldSince(product.id, recentSince)
    const priorItems = await prisma.orderItem.findMany({
      where: {
        productId: product.id,
        order: { status: 'completed', orderDate: { gte: priorSince, lt: recentSince } },
      },
      select: { quantity: true },
    })
    const prior = priorItems.reduce((sum, item) => sum + item.quantity, 0)
    if (prior > 0 && (prior - recent) / prior >= settings.declining_sales_percent / 100) {
      findings.push(finding({
        id: `sales:declining:${product.id}`,
        category: 'sales',
        statement: `${product.name} has declining sales over the last 4 weeks.`,
        dataSource: 'order_items, orders',
        reason: `Units in the latest 14 days are at least ${settings.declining_sales_percent}% below the prior 14 days.`,
        basis: { recentUnits: recent, priorUnits: prior, percent: settings.declining_sales_percent },
        recommendedAction: 'Check price, stock, and whether a promotion should feature this item.',
      }))
    }
  }
  if (findings.length === 0) {
    const totals = await prisma.order.aggregate({
      where: { status: 'completed', orderDate: range },
      _sum: { totalCentavos: true },
      _count: true,
    })
    findings.push(finding({
      id: 'sales:period-total',
      category: 'sales',
      statement: `Completed sales for the period are ${fromCentavos(totals._sum.totalCentavos || 0)} across ${totals._count} orders.`,
      dataSource: 'orders',
      reason: 'No declining-sales rule fired. This figure is the sum of completed orders in the selected dates.',
      basis: { from, to, orderCount: totals._count, total: fromCentavos(totals._sum.totalCentavos || 0) },
      recommendedAction: 'Widen the date range if you expected a trend finding.',
    }))
  }
  return findings
}

async function customerFindings(from, to) {
  const customers = await prisma.customer.count()
  if (customers === 0) return [insufficient('customer', 'customers', 'No customers exist.')]
  const inactiveSegment = await prisma.customerSegment.findUnique({ where: { name: 'Inactive' }, include: { _count: { select: { memberships: true } } } })
  const inactive = inactiveSegment?._count.memberships || 0
  const share = Math.round((inactive / customers) * 100)
  const findings = [finding({
    id: 'customer:inactive-share',
    category: 'customer',
    statement: `Customers classified as Inactive represent ${share}% of the customer base.`,
    dataSource: 'customers, customer_segment_memberships',
    reason: 'Inactive membership count divided by all customers. Customers may also belong to other segments.',
    basis: { inactive, customers, sharePercent: share },
    recommendedAction: 'Review the Inactive segment before a win-back campaign.',
  })]

  const range = manilaRange(from, to)
  const periodOrders = await prisma.order.findMany({
    where: { status: 'completed', orderDate: range },
    select: { totalCentavos: true, customerId: true },
  })
  if (periodOrders.length === 0) return findings
  const vip = await prisma.customerSegment.findUnique({ where: { name: 'VIP' } })
  const vipIds = new Set(
    vip
      ? (await prisma.customerSegmentMembership.findMany({ where: { segmentId: vip.id }, select: { customerId: true } })).map((row) => row.customerId)
      : [],
  )
  const total = periodOrders.reduce((sum, order) => sum + order.totalCentavos, 0)
  const vipTotal = periodOrders.filter((order) => vipIds.has(order.customerId)).reduce((sum, order) => sum + order.totalCentavos, 0)
  const vipShare = total === 0 ? 0 : Math.round((vipTotal / total) * 100)
  findings.push(finding({
    id: 'customer:vip-share',
    category: 'customer',
    statement: `VIP customers generated ${vipShare}% of total sales during the selected period.`,
    dataSource: 'orders, customer_segment_memberships',
    reason: 'Sum of completed orders for customers in the VIP segment divided by period sales.',
    basis: { from, to, vipSales: fromCentavos(vipTotal), periodSales: fromCentavos(total), sharePercent: vipShare },
    recommendedAction: 'Keep a VIP offer available if this share matters to the clinic.',
  }))
  return findings
}

async function marketingFindings() {
  const segments = await prisma.customerSegment.findMany({ include: { _count: { select: { memberships: true } }, campaigns: true } })
  if (segments.length === 0) return [insufficient('marketing', 'customer_segments', 'No segments exist.')]
  const byName = new Map(segments.map((segment) => [segment.name, segment]))
  for (const name of PRIORITY) {
    const segment = byName.get(name)
    if (!segment || segment._count.memberships === 0) continue
    const active = segment.campaigns.some((campaign) => campaign.status === 'active')
    if (!active) {
      return [finding({
        id: `marketing:suggest:${segment.id}`,
        category: 'marketing',
        statement: `${segment.name} has ${segment._count.memberships} customers and no active campaign.`,
        dataSource: 'customer_segments, marketing_campaigns',
        reason: 'Default contact priority is Inactive, New, VIP, Loyal, Frequent, then Regular. This is the first priority segment with members and no active campaign.',
        basis: { segment: segment.name, members: segment._count.memberships, priority: PRIORITY },
        recommendedAction: `Create a ${segment.name} campaign when you are ready to message them.`,
      })]
    }
  }
  return [finding({
    id: 'marketing:covered',
    category: 'marketing',
    statement: 'Every priority segment that has members already has an active campaign.',
    dataSource: 'customer_segments, marketing_campaigns',
    reason: 'The default priority list was checked against active campaigns.',
    basis: { priority: PRIORITY },
    recommendedAction: 'Open Marketing to review message counts.',
  })]
}

async function collect(from, to) {
  const range = from && to ? { from, to } : defaultRange()
  const [inventory, sales, customer, marketing] = await Promise.all([
    inventoryFindings(),
    salesFindings(range.from, range.to),
    customerFindings(range.from, range.to),
    marketingFindings(),
  ])
  return { from: range.from, to: range.to, inventory, sales, customer, marketing }
}

module.exports = { collect, inventoryFindings, salesFindings, customerFindings, marketingFindings }
