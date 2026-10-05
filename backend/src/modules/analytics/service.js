const { prisma } = require('../../lib/prisma')
const { fromCentavos } = require('../../lib/money')
const { manilaRange, manilaDateString, defaultRange, addManilaDays } = require('../../lib/dates')
const { getSettingsMap } = require('../settings/service')
const { unitsSoldSince } = require('../inventory/service')
const { collect } = require('../insights/service')

function resolveRange(query) {
  if (query.from && query.to) return { from: query.from, to: query.to }
  return defaultRange()
}

function eachDay(from, to) {
  const days = []
  let cursor = from
  while (cursor <= to) {
    days.push(cursor)
    cursor = addManilaDays(cursor, 1)
  }
  return days
}

async function salesSeries(from, to, bucket) {
  const orders = await prisma.order.findMany({
    where: { status: 'completed', orderDate: manilaRange(from, to) },
    select: { orderDate: true, totalCentavos: true },
  })
  const totals = new Map()
  for (const order of orders) {
    const day = manilaDateString(order.orderDate)
    let label = day
    if (bucket === 'week') {
      const date = new Date(`${day}T00:00:00+08:00`)
      const weekday = date.getUTCDay()
      const mondayOffset = weekday === 0 ? -6 : 1 - weekday
      label = addManilaDays(day, mondayOffset)
    } else if (bucket === 'month') {
      label = day.slice(0, 7)
    }
    totals.set(label, (totals.get(label) || 0) + order.totalCentavos)
  }
  return [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({
    label,
    value: fromCentavos(value),
  }))
}

async function dashboard(query, scope) {
  const { from, to } = resolveRange(query)
  const range = manilaRange(from, to)
  if (scope === 'basic') {
    const [total, recent, lowStockCount, newCustomers] = await Promise.all([
      prisma.customer.count(),
      prisma.order.findMany({
        where: { orderDate: range },
        include: { customer: true },
        orderBy: { orderDate: 'desc' },
        take: 10,
      }),
      prisma.inventory.count({ where: { status: { in: ['low_stock', 'out_of_stock'] } } }),
      prisma.customer.count({ where: { createdAt: range } }),
    ])
    return {
      from,
      to,
      customerCounts: { total, new: newCustomers },
      lowStockCount,
      recentOrders: recent.map(briefOrder),
    }
  }

  const [totalCustomers, newCustomers, inactiveSegment, vipSegment, orders, valueAgg, campaigns, openAnomalies] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: range } }),
    prisma.customerSegment.findUnique({ where: { name: 'Inactive' }, include: { _count: { select: { memberships: true } } } }),
    prisma.customerSegment.findUnique({ where: { name: 'VIP' }, include: { _count: { select: { memberships: true } } } }),
    prisma.order.findMany({
      where: { status: 'completed', orderDate: range },
      include: { customer: true, items: { include: { product: true } } },
    }),
    prisma.customerLifetimeValue.aggregate({ _sum: { totalSpentCentavos: true }, _avg: { totalSpentCentavos: true } }),
    prisma.marketingMessage.groupBy({ by: ['status'], where: { sentAt: range }, _count: true }),
    prisma.anomalyAlert.count({ where: { status: { in: ['new', 'reviewing'] } } }),
  ])
  const inactive = inactiveSegment?._count.memberships || 0
  const active = Math.max(0, totalCustomers - inactive)
  const salesTotal = orders.reduce((sum, order) => sum + order.totalCentavos, 0)
  const itemMap = new Map()
  for (const order of orders) {
    for (const item of order.items) {
      const current = itemMap.get(item.productId) || { name: item.product.name, type: item.product.type, quantity: 0, revenue: 0 }
      current.quantity += item.quantity
      current.revenue += item.subtotalCentavos
      itemMap.set(item.productId, current)
    }
  }
  const topItems = [...itemMap.entries()]
    .map(([id, value]) => ({ id, ...value, revenue: fromCentavos(value.revenue) }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
  const lowStock = await prisma.inventory.findMany({
    where: { status: { in: ['low_stock', 'out_of_stock'] } },
    include: { product: true },
  })
  const slowMoving = await slowMovingItems()
  const insights = await collect(from, to)
  const flatInsights = [...insights.inventory, ...insights.sales, ...insights.customer, ...insights.marketing].slice(0, 5)
  const sent = campaigns.find((row) => row.status === 'sent')?._count || 0
  const failed = campaigns.find((row) => row.status === 'failed')?._count || 0
  const segmentRows = await prisma.customerSegment.findMany({ include: { _count: { select: { memberships: true } } }, orderBy: { name: 'asc' } })
  const inventoryRows = await prisma.inventory.groupBy({ by: ['status'], _count: true })

  return {
    from,
    to,
    customerCounts: { total: totalCustomers, new: newCustomers, active, inactive, vip: vipSegment?._count.memberships || 0 },
    sales: {
      total: fromCentavos(salesTotal),
      averageTransactionValue: fromCentavos(orders.length ? Math.round(salesTotal / orders.length) : 0),
      orderCount: orders.length,
    },
    customerValue: {
      totalHistorical: fromCentavos(valueAgg._sum.totalSpentCentavos || 0),
      averageHistorical: fromCentavos(Math.round(valueAgg._avg.totalSpentCentavos || 0)),
    },
    topItems,
    lowStock: lowStock.map((row) => ({
      productId: row.productId,
      name: row.product.name,
      currentStock: row.currentStock,
      reorderLevel: row.reorderLevel,
      status: row.status,
    })),
    slowMoving,
    recentOrders: orders.sort((a, b) => b.orderDate - a.orderDate).slice(0, 10).map(briefOrder),
    campaigns: { sent, failed },
    anomalies: { open: openAnomalies },
    insights: flatInsights,
    overlapNote: 'Customers may belong to more than one segment.',
    charts: {
      salesTrend: await salesSeries(from, to, 'day'),
      customerGrowth: await customerGrowth(from, to),
      segments: segmentRows.map((segment) => ({ label: segment.name, value: segment._count.memberships })),
      topItems: topItems.map((item) => ({ label: item.name, value: item.quantity })),
      inventory: inventoryRows.map((row) => ({ label: row.status, value: row._count })),
      campaigns: [
        { label: 'Sent', value: sent },
        { label: 'Failed', value: failed },
      ],
    },
  }
}

function briefOrder(order) {
  return {
    id: order.id,
    orderDate: order.orderDate,
    customerName: `${order.customer.firstName} ${order.customer.lastName}`,
    total: fromCentavos(order.totalCentavos),
    status: order.status,
  }
}

async function customerGrowth(from, to) {
  const customers = await prisma.customer.findMany({
    where: { createdAt: manilaRange(from, to) },
    select: { createdAt: true },
  })
  const totals = new Map()
  for (const day of eachDay(from, to)) totals.set(day, 0)
  for (const customer of customers) {
    const day = manilaDateString(customer.createdAt)
    if (totals.has(day)) totals.set(day, totals.get(day) + 1)
  }
  return [...totals.entries()].map(([label, value]) => ({ label, value }))
}

async function slowMovingItems() {
  const settings = await getSettingsMap()
  const rows = await prisma.inventory.findMany({ include: { product: true }, where: { currentStock: { gt: 0 } } })
  const since = new Date(Date.now() - settings.slow_moving_window_days * 86400000)
  const results = []
  for (const row of rows) {
    if (daysBetween(row.product.createdAt) < settings.slow_moving_window_days) continue
    const unitsSold = await unitsSoldSince(row.productId, since)
    if (unitsSold <= settings.slow_moving_units) {
      results.push({ productId: row.productId, name: row.product.name, unitsSold, stock: row.currentStock })
    }
  }
  return results
}

function daysBetween(date) {
  const { daysBetweenManila } = require('../../lib/dates')
  return daysBetweenManila(date, new Date())
}

async function sales(query) {
  const { from, to } = resolveRange(query)
  const bucket = query.bucket || 'day'
  const groupBy = query.groupBy
  const where = { status: 'completed', orderDate: manilaRange(from, to) }
  if (!groupBy) {
    const series = await salesSeries(from, to, bucket)
    const orders = await prisma.order.findMany({ where, select: { totalCentavos: true } })
    const total = orders.reduce((sum, order) => sum + order.totalCentavos, 0)
    return {
      from,
      to,
      bucket,
      total: fromCentavos(total),
      averageTransactionValue: fromCentavos(orders.length ? Math.round(total / orders.length) : 0),
      series,
    }
  }
  const orders = await prisma.order.findMany({
    where,
    include: { items: { include: { product: true } }, customer: { include: { memberships: { include: { segment: true } } } } },
  })
  const groups = new Map()
  for (const order of orders) {
    if (groupBy === 'segment') {
      const names = order.customer.memberships.map((membership) => membership.segment.name)
      const labels = names.length ? names : ['Unsegmented']
      for (const label of labels) groups.set(label, (groups.get(label) || 0) + order.totalCentavos)
    } else {
      for (const item of order.items) {
        if (groupBy === 'product' && item.product.type !== 'product') continue
        if (groupBy === 'service' && item.product.type !== 'service') continue
        groups.set(item.product.name, (groups.get(item.product.name) || 0) + item.subtotalCentavos)
      }
    }
  }
  return {
    from,
    to,
    groupBy,
    overlapNote: groupBy === 'segment' ? 'A customer in several segments is counted once in each segment.' : undefined,
    series: [...groups.entries()].map(([label, value]) => ({ label, value: fromCentavos(value) })),
  }
}

async function customers(query) {
  const { from, to } = resolveRange(query)
  return { from, to, growth: await customerGrowth(from, to), total: await prisma.customer.count() }
}

async function inventory(query) {
  const rows = await prisma.inventory.findMany({ include: { product: true } })
  return {
    statuses: rows.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1
      return acc
    }, {}),
    slowMoving: await slowMovingItems(),
    items: rows.map((row) => ({
      name: row.product.name,
      stock: row.currentStock,
      status: row.status,
    })),
    from: query.from,
    to: query.to,
  }
}

module.exports = { dashboard, sales, customers, inventory, resolveRange }
