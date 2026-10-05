const { prisma } = require('../../lib/prisma')
const { daysBetweenManila } = require('../../lib/dates')

async function buildMetricContext(customer, now = new Date()) {
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id, status: 'completed' },
    select: { totalCentavos: true, orderDate: true },
    orderBy: { orderDate: 'asc' },
  })
  const total = orders.reduce((sum, order) => sum + order.totalCentavos, 0)
  const first = orders[0]
  const last = orders[orders.length - 1]
  return {
    total_spent_centavos: total,
    visit_count: orders.length,
    days_since_last_visit: daysBetweenManila(last ? last.orderDate : customer.createdAt, now),
    days_since_first_visit: first ? daysBetweenManila(first.orderDate, now) : null,
    days_since_created: daysBetweenManila(customer.createdAt, now),
    lastVisitDate: last ? last.orderDate : null,
    average: orders.length ? Math.round(total / orders.length) : 0,
    visitsWithin(days) {
      return orders.filter((order) => {
        const age = daysBetweenManila(order.orderDate, now)
        return age >= 0 && age <= days
      }).length
    },
  }
}

async function recalculateCustomer(customerId, db = prisma) {
  const customer = await db.customer.findUnique({ where: { id: customerId } })
  if (!customer) return null
  const metrics = await buildMetricContext(customer)
  const data = {
    totalSpentCentavos: metrics.total_spent_centavos,
    visitCount: metrics.visit_count,
    averageTransactionCentavos: metrics.average,
    lastVisitDate: metrics.lastVisitDate,
    calculatedAt: new Date(),
  }
  return db.customerLifetimeValue.upsert({
    where: { customerId },
    create: { customerId, ...data },
    update: data,
  })
}

async function recalculateAll() {
  const customers = await prisma.customer.findMany({ select: { id: true } })
  for (const customer of customers) {
    await recalculateCustomer(customer.id)
  }
  return customers.length
}

function presentValue(row) {
  if (!row) return null
  const { fromCentavos } = require('../../lib/money')
  return {
    totalSpent: fromCentavos(row.totalSpentCentavos),
    visitCount: row.visitCount,
    averageTransactionValue: fromCentavos(row.averageTransactionCentavos),
    lastVisitDate: row.lastVisitDate,
    calculatedAt: row.calculatedAt,
    method: 'historical_completed_orders',
  }
}

module.exports = { buildMetricContext, recalculateCustomer, recalculateAll, presentValue }
