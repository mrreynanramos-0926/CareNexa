const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')
const { pageParams, listResponse } = require('../../lib/pagination')
const { fromCentavos } = require('../../lib/money')
const { customerIdsMatching } = require('../../lib/customerSearch')
const { presentValue, recalculateCustomer } = require('../customerValue/service')

function presentCustomer(customer) {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    name: `${customer.firstName} ${customer.lastName}`,
    email: customer.email,
    phone: customer.phone,
    birthday: customer.birthday ? customer.birthday.toISOString().slice(0, 10) : null,
    address: customer.address,
    customerType: customer.customerType,
    status: customer.status,
    smsConsent: customer.smsConsent,
    emailConsent: customer.emailConsent,
    segments: (customer.memberships || []).map((membership) => membership.segment.name),
    totalSpent: customer.value ? fromCentavos(customer.value.totalSpentCentavos) : '0.00',
    visitCount: customer.value?.visitCount || 0,
    lastVisit: customer.value?.lastVisitDate || null,
    createdAt: customer.createdAt,
  }
}

const includeList = {
  memberships: { include: { segment: true } },
  value: true,
}

async function listCustomers(query) {
  const { page, pageSize, skip } = pageParams(query)
  const where = {}
  if (query.status) where.status = query.status
  if (query.customerType) where.customerType = query.customerType
  if (query.segmentId) where.memberships = { some: { segmentId: query.segmentId } }
  if (query.search && query.search.trim()) {
    const ids = await customerIdsMatching(query.search)
    where.id = { in: ids.length ? ids : ['__none__'] }
  }
  const direction = query.direction === 'asc' ? 'asc' : 'desc'
  const sort = {
    name: [{ lastName: 'asc' }, { firstName: 'asc' }],
    createdAt: [{ createdAt: direction }],
    lastVisit: [{ value: { lastVisitDate: direction } }],
    totalSpent: [{ value: { totalSpentCentavos: direction } }],
  }[query.sort] || [{ lastName: 'asc' }, { firstName: 'asc' }]

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({ where, include: includeList, orderBy: sort, skip, take: pageSize }),
    prisma.customer.count({ where }),
  ])
  return listResponse(rows.map(presentCustomer), page, pageSize, total)
}

function parseBirthday(value) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Birthday must be a calendar date.')
  }
  return new Date(`${value}T00:00:00.000Z`)
}

function customerData(input) {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email ? input.email.trim().toLowerCase() : null,
    phone: input.phone ? input.phone.trim() : null,
    birthday: parseBirthday(input.birthday),
    address: input.address?.trim() || null,
    customerType: input.customerType?.trim() || 'individual',
    status: input.status || 'active',
    smsConsent: Boolean(input.smsConsent),
    emailConsent: Boolean(input.emailConsent),
  }
}

async function createCustomer(input, actor) {
  if (input.status && !['active', 'inactive'].includes(input.status)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Status must be active or inactive.')
  }
  const customer = await prisma.customer.create({ data: customerData(input) })
  await recalculateCustomer(customer.id)
  await writeAudit(prisma, {
    userId: actor.id,
    action: 'create',
    entity: 'customer',
    entityId: customer.id,
    newValue: { name: `${customer.firstName} ${customer.lastName}`, phone: customer.phone, email: customer.email },
  })
  return getCustomer(customer.id)
}

async function updateCustomer(id, input, actor) {
  const existing = await prisma.customer.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Customer not found.')
  const customer = await prisma.customer.update({ where: { id }, data: customerData({ ...existing, ...input, birthday: input.birthday === undefined ? (existing.birthday ? existing.birthday.toISOString().slice(0, 10) : null) : input.birthday }) })
  await writeAudit(prisma, {
    userId: actor.id,
    action: 'update',
    entity: 'customer',
    entityId: id,
    oldValue: { phone: existing.phone, email: existing.email, status: existing.status, address: existing.address },
    newValue: { phone: customer.phone, email: customer.email, status: customer.status, address: customer.address },
  })
  return getCustomer(id)
}

async function deactivateCustomer(id, actor) {
  return updateCustomer(id, { status: 'inactive' }, actor)
}

async function deleteCustomer(id, actor) {
  const existing = await prisma.customer.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Customer not found.')
  const orders = await prisma.order.count({ where: { customerId: id } })
  if (orders > 0) {
    throw new AppError(409, 'CONFLICT', 'This customer has orders and can only be deactivated.')
  }
  await prisma.$transaction([
    prisma.activity.deleteMany({ where: { customerId: id } }),
    prisma.customerSegmentMembership.deleteMany({ where: { customerId: id } }),
    prisma.marketingMessage.deleteMany({ where: { customerId: id } }),
    prisma.customerLifetimeValue.deleteMany({ where: { customerId: id } }),
    prisma.customer.delete({ where: { id } }),
  ])
  await writeAudit(prisma, {
    userId: actor.id,
    action: 'update',
    entity: 'customer',
    entityId: id,
    oldValue: { deleted: false },
    newValue: { deleted: true },
  })
}

async function getCustomer(id) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      ...includeList,
      orders: { include: { items: { include: { product: true } } }, orderBy: { orderDate: 'desc' } },
      activities: { include: { user: true }, orderBy: { activityDate: 'desc' } },
    },
  })
  if (!customer) throw new AppError(404, 'NOT_FOUND', 'Customer not found.')
  return {
    ...presentCustomer(customer),
    value: presentValue(customer.value),
    orders: customer.orders.map((order) => ({
      id: order.id,
      orderDate: order.orderDate,
      status: order.status,
      source: order.source,
      total: fromCentavos(order.totalCentavos),
      items: order.items.map((item) => ({
        name: item.product.name,
        type: item.product.type,
        quantity: item.quantity,
        unitPrice: fromCentavos(item.unitPriceCentavos),
        subtotal: fromCentavos(item.subtotalCentavos),
      })),
    })),
    activities: customer.activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      notes: activity.notes,
      activityDate: activity.activityDate,
      userName: activity.user.name,
    })),
  }
}

async function addActivity(customerId, input, actor) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) throw new AppError(404, 'NOT_FOUND', 'Customer not found.')
  const activity = await prisma.activity.create({
    data: {
      customerId,
      userId: actor.id,
      type: input.type,
      notes: input.notes.trim(),
      activityDate: input.activityDate ? new Date(input.activityDate) : new Date(),
    },
  })
  await writeAudit(prisma, {
    userId: actor.id,
    action: 'create',
    entity: 'customer',
    entityId: customerId,
    newValue: { activityId: activity.id, type: activity.type },
  })
  return {
    id: activity.id,
    type: activity.type,
    notes: activity.notes,
    activityDate: activity.activityDate,
    userName: actor.name,
  }
}

module.exports = {
  listCustomers,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  deleteCustomer,
  getCustomer,
  addActivity,
  presentCustomer,
}
