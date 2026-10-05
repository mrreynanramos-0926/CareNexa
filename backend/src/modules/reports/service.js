const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { fromCentavos } = require('../../lib/money')
const { pageParams } = require('../../lib/pagination')
const { manilaRange } = require('../../lib/dates')
const { presentCustomer } = require('../customers/service')

const EXPORT_CAP = 10000

function csvCell(value) {
  const text = value == null ? '' : String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(rows, columns) {
  const header = columns.map((column) => csvCell(column.header)).join(',')
  const body = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(','))
  return [header, ...body].join('\r\n')
}

async function limited(query, loader) {
  if (query.format === 'csv') {
    const rows = await loader(0, EXPORT_CAP + 1)
    if (rows.length > EXPORT_CAP) {
      throw new AppError(422, 'BUSINESS_RULE', `Export is limited to ${EXPORT_CAP} rows. Narrow the filters.`)
    }
    return { rows, csv: true }
  }
  const { page, pageSize, skip } = pageParams(query)
  const rows = await loader(skip, pageSize)
  const total = await loader.count()
  return { rows, page, pageSize, total, csv: false }
}

function dateWhere(query, field) {
  if (!query.from || !query.to) return {}
  return { [field]: manilaRange(query.from, query.to) }
}

async function customers(query) {
  const where = {}
  if (query.status) where.status = query.status
  const loader = async (skip, take) => prisma.customer.findMany({
    where,
    include: { memberships: { include: { segment: true } }, value: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    skip,
    take,
  })
  loader.count = () => prisma.customer.count({ where })
  const result = await limited(query, loader)
  const columns = [
    { header: 'Name', value: (row) => `${row.firstName} ${row.lastName}` },
    { header: 'Phone', value: (row) => row.phone },
    { header: 'Email', value: (row) => row.email },
    { header: 'Status', value: (row) => row.status },
    { header: 'Type', value: (row) => row.customerType },
    { header: 'Segments', value: (row) => row.memberships.map((item) => item.segment.name).join('|') },
    { header: 'Last visit', value: (row) => row.value?.lastVisitDate?.toISOString() || '' },
  ]
  return finish(query, result, result.rows.map(presentCustomer), columns, result.rows)
}

async function sales(query) {
  const where = { ...dateWhere(query, 'orderDate') }
  if (query.status) where.status = query.status
  const loader = async (skip, take) => prisma.order.findMany({
    where,
    include: { customer: true, items: { include: { product: true } } },
    orderBy: { orderDate: 'desc' },
    skip,
    take,
  })
  loader.count = () => prisma.order.count({ where })
  const result = await limited(query, loader)
  const mapped = result.rows.map((order) => ({
    orderDate: order.orderDate.toISOString(),
    id: order.id,
    customer: `${order.customer.firstName} ${order.customer.lastName}`,
    status: order.status,
    total: fromCentavos(order.totalCentavos),
    items: order.items.map((item) => `${item.product.name} x${item.quantity}`).join('; '),
  }))
  const columns = [
    { header: 'Order date', value: (row) => row.orderDate },
    { header: 'Order id', value: (row) => row.id },
    { header: 'Customer', value: (row) => row.customer },
    { header: 'Status', value: (row) => row.status },
    { header: 'Total', value: (row) => row.total },
    { header: 'Items', value: (row) => row.items },
  ]
  return finish(query, result, mapped, columns, mapped)
}

async function inventory(query) {
  const where = {}
  if (query.status) where.status = query.status
  const loader = async (skip, take) => prisma.inventory.findMany({
    where,
    include: { product: true },
    skip,
    take,
    orderBy: { product: { name: 'asc' } },
  })
  loader.count = () => prisma.inventory.count({ where })
  const result = await limited(query, loader)
  const mapped = result.rows.map((row) => ({
    item: row.product.name,
    type: row.product.type,
    stock: row.currentStock,
    reorderLevel: row.reorderLevel,
    status: row.status,
    lastRestock: row.lastRestockDate ? row.lastRestockDate.toISOString().slice(0, 10) : '',
  }))
  const columns = [
    { header: 'Item', value: (row) => row.item },
    { header: 'Type', value: (row) => row.type },
    { header: 'Stock', value: (row) => row.stock },
    { header: 'Reorder level', value: (row) => row.reorderLevel },
    { header: 'Status', value: (row) => row.status },
    { header: 'Last restock', value: (row) => row.lastRestock },
  ]
  return finish(query, result, mapped, columns, mapped)
}

async function campaigns(query) {
  const loader = async (skip, take) => prisma.marketingCampaign.findMany({
    include: { segment: true, messages: true },
    skip,
    take,
    orderBy: { createdAt: 'desc' },
  })
  loader.count = () => prisma.marketingCampaign.count()
  const result = await limited(query, loader)
  const mapped = result.rows.map((campaign) => ({
    name: campaign.name,
    channel: campaign.channel,
    segment: campaign.segment.name,
    sent: campaign.messages.filter((item) => item.status === 'sent').length,
    failed: campaign.messages.filter((item) => item.status === 'failed').length,
    status: campaign.status,
  }))
  const columns = [
    { header: 'Campaign', value: (row) => row.name },
    { header: 'Channel', value: (row) => row.channel },
    { header: 'Segment', value: (row) => row.segment },
    { header: 'Sent', value: (row) => row.sent },
    { header: 'Failed', value: (row) => row.failed },
    { header: 'Status', value: (row) => row.status },
  ]
  return finish(query, result, mapped, columns, mapped)
}

async function segments(query) {
  const where = {}
  if (query.segmentId) where.segmentId = query.segmentId
  const loader = async (skip, take) => prisma.customerSegmentMembership.findMany({
    where,
    include: { customer: { include: { value: true } }, segment: true },
    skip,
    take,
  })
  loader.count = () => prisma.customerSegmentMembership.count({ where })
  const result = await limited(query, loader)
  const mapped = result.rows.map((row) => ({
    segment: row.segment.name,
    customer: `${row.customer.firstName} ${row.customer.lastName}`,
    assignedAt: row.assignedAt.toISOString(),
    totalSpent: fromCentavos(row.customer.value?.totalSpentCentavos || 0),
    visits: row.customer.value?.visitCount || 0,
  }))
  const columns = [
    { header: 'Segment', value: (row) => row.segment },
    { header: 'Customer', value: (row) => row.customer },
    { header: 'Assigned at', value: (row) => row.assignedAt },
    { header: 'Total spent', value: (row) => row.totalSpent },
    { header: 'Visits', value: (row) => row.visits },
  ]
  return finish(query, result, mapped, columns, mapped)
}

async function customerValue(query) {
  const loader = async (skip, take) => prisma.customerLifetimeValue.findMany({
    include: { customer: true },
    skip,
    take,
    orderBy: { totalSpentCentavos: 'desc' },
  })
  loader.count = () => prisma.customerLifetimeValue.count()
  const result = await limited(query, loader)
  const mapped = result.rows.map((row) => ({
    customer: `${row.customer.firstName} ${row.customer.lastName}`,
    totalSpent: fromCentavos(row.totalSpentCentavos),
    visits: row.visitCount,
    average: fromCentavos(row.averageTransactionCentavos),
    lastVisit: row.lastVisitDate ? row.lastVisitDate.toISOString() : '',
    calculatedAt: row.calculatedAt.toISOString(),
  }))
  const columns = [
    { header: 'Customer', value: (row) => row.customer },
    { header: 'Total spent', value: (row) => row.totalSpent },
    { header: 'Visits', value: (row) => row.visits },
    { header: 'Average', value: (row) => row.average },
    { header: 'Last visit', value: (row) => row.lastVisit },
    { header: 'Calculated at', value: (row) => row.calculatedAt },
  ]
  return finish(query, result, mapped, columns, mapped)
}

async function anomalies(query) {
  const where = { ...dateWhere(query, 'createdAt') }
  if (query.status) where.status = query.status
  const loader = async (skip, take) => prisma.anomalyAlert.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } })
  loader.count = () => prisma.anomalyAlert.count({ where })
  const result = await limited(query, loader)
  const mapped = result.rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    type: row.anomalyType,
    severity: row.severity,
    status: row.status,
    transactionId: row.transactionId,
    description: row.description,
  }))
  const columns = [
    { header: 'Created at', value: (row) => row.createdAt },
    { header: 'Type', value: (row) => row.type },
    { header: 'Severity', value: (row) => row.severity },
    { header: 'Status', value: (row) => row.status },
    { header: 'Transaction id', value: (row) => row.transactionId },
    { header: 'Description', value: (row) => row.description },
  ]
  return finish(query, result, mapped, columns, mapped)
}

function finish(query, result, data, columns, csvRows) {
  if (query.format === 'csv') return { csv: toCsv(csvRows, columns) }
  return { data, page: result.page, pageSize: result.pageSize, total: result.total }
}

module.exports = { customers, sales, inventory, campaigns, segments, customerValue, anomalies, toCsv }
