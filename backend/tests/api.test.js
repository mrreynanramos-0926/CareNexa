const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'file:./test.db'
process.env.JWT_SECRET = 'test-secret-value-please'
process.env.JWT_EXPIRES_IN = '2h'
process.env.BCRYPT_COST = '4'
process.env.CORS_ORIGIN = 'http://localhost:5173'

const backendRoot = path.join(__dirname, '..')
for (const file of ['test.db', 'test.db-journal']) {
  const full = path.join(backendRoot, 'prisma', file)
  if (fs.existsSync(full)) fs.unlinkSync(full)
}
execSync('npx prisma migrate deploy', { cwd: backendRoot, env: process.env, stdio: 'pipe' })

const request = require('supertest')
const { createApp } = require('../src/app')
const { prisma } = require('../src/lib/prisma')
const { hashPassword } = require('../src/modules/auth/service')
const { ensureDefaults, syncNamedSegments } = require('../src/modules/settings/service')

const app = createApp()
let adminToken
let managerToken
let staffToken

async function login(email, password) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  assert.equal(response.status, 200)
  return response.body.data.token
}

function auth(token) {
  return { Authorization: `Bearer ${token}` }
}

test.before(async () => {
  const adminRole = await prisma.role.create({ data: { name: 'ADMIN', description: 'Admin' } })
  const managerRole = await prisma.role.create({ data: { name: 'MANAGER', description: 'Manager' } })
  const staffRole = await prisma.role.create({ data: { name: 'STAFF', description: 'Staff' } })
  const users = [
    ['Admin User', 'admin@test.local', 'Admin12345x', adminRole.id],
    ['Manager User', 'manager@test.local', 'Manager12345x', managerRole.id],
    ['Staff User', 'staff@test.local', 'Staff12345x', staffRole.id],
    ['Inactive User', 'inactive@test.local', 'Inactive123x', staffRole.id],
  ]
  for (const [name, email, password, roleId] of users) {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        roleId,
        status: email.startsWith('inactive') ? 'inactive' : 'active',
      },
    })
  }
  await ensureDefaults()
  await syncNamedSegments(null)
  adminToken = await login('admin@test.local', 'Admin12345x')
  managerToken = await login('manager@test.local', 'Manager12345x')
  staffToken = await login('staff@test.local', 'Staff12345x')
})

test.after(async () => {
  await prisma.$disconnect()
})

test('rejects invalid and inactive logins', async () => {
  const bad = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'wrong-password' })
  assert.equal(bad.status, 401)
  const inactive = await request(app).post('/api/auth/login').send({ email: 'inactive@test.local', password: 'Inactive123x' })
  assert.equal(inactive.status, 401)
  const missing = await request(app).get('/api/customers')
  assert.equal(missing.status, 401)
})

test('staff cannot administer users or open executive insights', async () => {
  const users = await request(app).post('/api/users').set(auth(staffToken)).send({ name: 'X', email: 'x@test.local', password: 'Password123x', role: 'STAFF' })
  assert.equal(users.status, 403)
  const insights = await request(app).get('/api/ai/recommendations').set(auth(staffToken))
  assert.equal(insights.status, 403)
  const basic = await request(app).get('/api/analytics/dashboard/basic').set(auth(staffToken))
  assert.equal(basic.status, 200)
})

test('password change replaces the old password', async () => {
  const changed = await request(app).post('/api/auth/change-password').set(auth(staffToken)).send({ currentPassword: 'Staff12345x', newPassword: 'Staff123456y' })
  assert.equal(changed.status, 204)
  const oldLogin = await request(app).post('/api/auth/login').send({ email: 'staff@test.local', password: 'Staff12345x' })
  assert.equal(oldLogin.status, 401)
  staffToken = await login('staff@test.local', 'Staff123456y')
  const wrong = await request(app).post('/api/auth/password').send({ email: 'staff@test.local', currentPassword: 'Staff12345x', newPassword: 'Staff123456z' })
  assert.equal(wrong.status, 401)
  const fromLogin = await request(app).post('/api/auth/password').send({ email: 'staff@test.local', currentPassword: 'Staff123456y', newPassword: 'Staff123456z' })
  assert.equal(fromLogin.status, 204)
  staffToken = await login('staff@test.local', 'Staff123456z')
})

test('customer create, search, duplicate phone, and audit', async () => {
  const created = await request(app).post('/api/customers').set(auth(staffToken)).send({
    firstName: 'Maria', lastName: 'Santos', phone: '09000000111', email: 'maria.santos@example.com', birthday: '1992-04-03',
  })
  assert.equal(created.status, 201)
  const search = await request(app).get('/api/customers').query({ search: 'maria santos' }).set(auth(staffToken))
  assert.equal(search.body.data.some((row) => row.id === created.body.data.id), true)
  const duplicate = await request(app).post('/api/customers').set(auth(staffToken)).send({ firstName: 'Other', lastName: 'Person', phone: '09000000111' })
  assert.equal(duplicate.status, 409)
  const activity = await request(app).post(`/api/customers/${created.body.data.id}/activities`).set(auth(staffToken)).send({ type: 'note', notes: 'Prefers morning visits.' })
  assert.equal(activity.status, 201)
  const updated = await request(app).put(`/api/customers/${created.body.data.id}`).set(auth(staffToken)).send({
    firstName: 'Maria', lastName: 'Santos', phone: '09000000112', email: 'maria.santos@example.com',
  })
  assert.equal(updated.status, 200)
  const audit = await request(app).get('/api/audit-logs').query({ entity: 'customer' }).set(auth(adminToken))
  assert.equal(audit.body.data.some((row) => row.newValue && row.newValue.phone === '09000000112'), true)
})

test('order completion updates value and stock, and services do not', async () => {
  const customer = await request(app).post('/api/customers').set(auth(managerToken)).send({ firstName: 'Juan', lastName: 'Dela Cruz', phone: '09000000222' })
  const product = await request(app).post('/api/products').set(auth(managerToken)).send({ name: 'Facial Kit Test', type: 'product', price: '100.00', tracksInventory: true, reorderLevel: 5, reorderQuantity: 10 })
  const inventory = await request(app).get('/api/inventory').set(auth(managerToken))
  const row = inventory.body.data.find((item) => item.productId === product.body.data.id)
  await request(app).post('/api/inventory/restock').set(auth(managerToken)).send({ productId: product.body.data.id, quantity: 10 })
  const service = await request(app).post('/api/products').set(auth(managerToken)).send({ name: 'Signature Facial Test', type: 'service', price: '2500.00' })
  for (let count = 0; count < 4; count += 1) {
    const order = await request(app).post('/api/orders').set(auth(staffToken)).send({
      customerId: customer.body.data.id,
      lines: [{ productId: service.body.data.id, quantity: 1 }],
    })
    assert.equal(order.status, 201)
  }
  const value = await request(app).get(`/api/customers/${customer.body.data.id}/value`).set(auth(staffToken))
  assert.equal(value.body.data.totalSpent, '10000.00')
  assert.equal(value.body.data.visitCount, 4)
  assert.equal(value.body.data.averageTransactionValue, '2500.00')
  assert.equal(value.body.data.method, 'historical_completed_orders')

  const sold = await request(app).post('/api/orders').set(auth(staffToken)).send({
    customerId: customer.body.data.id,
    lines: [{ productId: product.body.data.id, quantity: 2 }],
  })
  assert.equal(sold.status, 201)
  const stock = await request(app).get(`/api/inventory/${row.id}`).set(auth(managerToken))
  assert.equal(stock.body.data.currentStock, 8)
  const serviceStock = await prisma.inventory.findUnique({ where: { productId: service.body.data.id } })
  assert.equal(serviceStock, null)
})

test('low stock alert is created once', async () => {
  const product = await request(app).post('/api/products').set(auth(managerToken)).send({ name: 'Serum Test', type: 'product', price: '50.00', tracksInventory: true, reorderLevel: 5 })
  await request(app).post('/api/inventory/restock').set(auth(managerToken)).send({ productId: product.body.data.id, quantity: 3 })
  await request(app).post('/api/inventory/evaluate').set(auth(managerToken))
  const first = await prisma.inventoryAlert.count({ where: { productId: product.body.data.id, alertType: 'low_stock', status: 'open' } })
  await request(app).post('/api/inventory/evaluate').set(auth(managerToken))
  const second = await prisma.inventoryAlert.count({ where: { productId: product.body.data.id, alertType: 'low_stock', status: 'open' } })
  assert.equal(first, 1)
  assert.equal(second, 1)
})

test('inactive and overlapping segments rebuild from rules', async () => {
  const customer = await request(app).post('/api/customers').set(auth(managerToken)).send({ firstName: 'Ana', lastName: 'Reyes', phone: '09000000333' })
  const service = await prisma.productService.findFirst({ where: { type: 'service' } })
  const old = new Date(Date.now() - 40 * 86400000).toISOString()
  await request(app).post('/api/orders').set(auth(managerToken)).send({
    customerId: customer.body.data.id,
    orderDate: old,
    lines: [{ productId: service.id, quantity: 1 }],
  })
  await request(app).post('/api/segments/rebuild').set(auth(managerToken))
  const profile = await request(app).get(`/api/customers/${customer.body.data.id}`).set(auth(managerToken))
  assert.equal(profile.body.data.segments.includes('Inactive'), true)

  const vip = await prisma.customerSegment.findUnique({ where: { name: 'VIP' } })
  const frequent = await prisma.customerSegment.findUnique({ where: { name: 'Frequent' } })
  await prisma.customerSegment.update({
    where: { id: vip.id },
    data: { criteria: { match: 'all', rules: [{ field: 'visit_count', op: 'gte', value: 1 }] } },
  })
  await prisma.customerSegment.update({
    where: { id: frequent.id },
    data: { criteria: { match: 'all', rules: [{ field: 'visit_count', op: 'gte', value: 1 }] } },
  })
  await request(app).post('/api/segments/rebuild').set(auth(managerToken))
  const again = await request(app).get(`/api/customers/${customer.body.data.id}`).set(auth(managerToken))
  assert.equal(again.body.data.segments.includes('VIP'), true)
  assert.equal(again.body.data.segments.includes('Frequent'), true)
})

test('campaign activation does not duplicate messages', async () => {
  const segment = await request(app).post('/api/segments').set(auth(managerToken)).send({
    name: 'Everyone test',
    description: 'All customers',
    criteria: { match: 'all', rules: [{ field: 'visit_count', op: 'gte', value: 0 }] },
  })
  await request(app).post('/api/segments/rebuild').set(auth(managerToken))
  const today = new Date().toISOString().slice(0, 10)
  const campaign = await request(app).post('/api/campaigns').set(auth(managerToken)).send({
    name: 'Test SMS',
    type: 'informational',
    channel: 'sms',
    targetSegmentId: segment.body.data.id,
    message: 'Hi {{first_name}}',
    startDate: today,
    endDate: today,
  })
  const first = await request(app).post(`/api/campaigns/${campaign.body.data.id}/activate`).set(auth(managerToken))
  const second = await request(app).post(`/api/campaigns/${campaign.body.data.id}/activate`).set(auth(managerToken))
  assert.ok(first.body.data.created >= 1)
  assert.equal(second.body.data.created, 0)
})

test('birthday promotion is logged once', async () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const month = parts.find((part) => part.type === 'month').value
  const day = parts.find((part) => part.type === 'day').value
  const customer = await request(app).post('/api/customers').set(auth(managerToken)).send({
    firstName: 'Birthday', lastName: 'Guest', phone: '09000000444', birthday: `1990-${month}-${day}`,
  })
  await request(app).post('/api/trigger-rules').set(auth(managerToken)).send({
    name: 'Birthday test', eventType: 'birthday', conditionValue: {}, channel: 'sms', isActive: true,
    messageTemplate: 'Hi {{first_name}} happy birthday',
  })
  const first = await request(app).post('/api/promotions/evaluate').set(auth(managerToken))
  const second = await request(app).post('/api/promotions/evaluate').set(auth(managerToken))
  assert.ok(first.body.data.created >= 1)
  const messages = await prisma.marketingMessage.count({ where: { customerId: customer.body.data.id, dedupeKey: { contains: 'trigger:birthday' } } })
  assert.equal(messages, 1)
  assert.ok(second.body.data.skipped >= 1)
})

test('large transaction alert does not change the order', async () => {
  const customer = await prisma.customer.findFirst()
  const service = await prisma.productService.findFirst({ where: { type: 'service' } })
  const order = await request(app).post('/api/orders').set(auth(managerToken)).send({
    customerId: customer.id,
    lines: [{ productId: service.id, quantity: 1, unitPrice: '16000.00' }],
  })
  assert.equal(order.status, 201)
  const before = order.body.data.total
  const alert = await prisma.anomalyAlert.findFirst({ where: { transactionId: order.body.data.id, anomalyType: 'large_transaction' } })
  assert.ok(alert)
  const reviewed = await request(app).put(`/api/ai/anomalies/${alert.id}`).set(auth(managerToken)).send({ status: 'reviewing' })
  assert.equal(reviewed.status, 200)
  const after = await request(app).get(`/api/orders/${order.body.data.id}`).set(auth(managerToken))
  assert.equal(after.body.data.total, before)
})

test('sales csv and empty-period insights', async () => {
  const csv = await request(app).get('/api/reports/sales').query({ format: 'csv' }).set(auth(managerToken))
  assert.equal(csv.status, 200)
  assert.match(csv.headers['content-type'], /text\/csv/)
  assert.match(csv.text, /Order date/)
  const insights = await request(app).get('/api/ai/recommendations').query({ from: '2000-01-01', to: '2000-01-02' }).set(auth(managerToken))
  assert.equal(insights.body.data.sales[0].statement, 'Insufficient data to generate this recommendation.')
  assert.equal(insights.body.data.sales[0].producer, 'rule-based')
})

test('mock POS sync is idempotent for the same transaction', async () => {
  const first = await request(app).post('/api/pos/sync').set(auth(managerToken)).send({ resources: ['customers', 'inventory', 'transactions'] })
  const second = await request(app).post('/api/pos/sync').set(auth(managerToken)).send({ resources: ['customers', 'inventory', 'transactions'] })
  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  const count = await prisma.order.count({ where: { externalPosId: 'pos-order-1' } })
  assert.equal(count, 1)
})

async function methodByCode(code) {
  const listed = await request(app).get('/api/payment-methods/active').set(auth(staffToken))
  assert.equal(listed.status, 200)
  const method = listed.body.data.find((row) => row.code === code)
  assert.ok(method, code)
  return method
}

test('disabled payment methods cannot be used, paid lines are kept, and cards store last 4 only', async () => {
  const customer = await request(app).post('/api/customers').set(auth(staffToken)).send({ firstName: 'Payment', lastName: 'Client', phone: '09000000991' })
  const service = await request(app).post('/api/products').set(auth(managerToken)).send({ name: 'Payment Facial', type: 'service', price: '1000.00' })
  const gcash = await methodByCode('GCASH')
  const disabled = await request(app).patch(`/api/payment-methods/${gcash.id}/status`).set(auth(adminToken)).send({ isActive: false })
  assert.equal(disabled.status, 200)
  const rejected = await request(app).post('/api/orders').set(auth(staffToken)).send({
    customerId: customer.body.data.id,
    lines: [{ productId: service.body.data.id, quantity: 1 }],
    payments: [{ paymentMethodId: gcash.id, amount: '1000.00' }],
  })
  assert.equal(rejected.status, 422)
  assert.match(rejected.body.error.message, /Only active payment methods/)
  await request(app).patch(`/api/payment-methods/${gcash.id}/status`).set(auth(adminToken)).send({ isActive: true })

  const cash = await methodByCode('CASH')
  const visa = await methodByCode('VISA')
  const paid = await request(app).post('/api/orders').set(auth(staffToken)).send({
    customerId: customer.body.data.id,
    lines: [{ productId: service.body.data.id, quantity: 1 }],
    payments: [
      { paymentMethodId: cash.id, amount: '500.00' },
      { paymentMethodId: visa.id, amount: '500.00', cardLastFour: '1234', referenceNumber: 'AUTH1' },
    ],
  })
  assert.equal(paid.status, 201)
  assert.equal(paid.body.data.paymentStatus, 'PAID')
  assert.equal(paid.body.data.totalPaid, '1000.00')
  assert.equal(paid.body.data.balanceDue, '0.00')
  assert.equal(paid.body.data.change, '0.00')
  const cardLine = paid.body.data.paymentLines.find((line) => line.code === 'VISA')
  assert.equal(cardLine.cardLastFour, '1234')
  assert.equal(cardLine.cardMask, '**** **** **** 1234')
  assert.equal(JSON.stringify(paid.body).includes('4111111111111111'), false)
  const stored = await prisma.orderPayment.findFirst({ where: { orderId: paid.body.data.id, cardLastFour: { not: '' } } })
  assert.equal(stored.cardLastFour, '1234')
  assert.equal(stored.authorizationCode, '')

  const sensitive = await request(app).post(`/api/orders/${paid.body.data.id}/payments`).set(auth(staffToken)).send({
    paymentMethodId: visa.id, amount: '1.00', cardNumber: '4111111111111111', cvv: '123',
  })
  assert.equal(sensitive.status, 400)

  const removed = await request(app).delete(`/api/orders/${paid.body.data.id}/payments/${cardLine.id}`).set(auth(staffToken))
  assert.equal(removed.status, 422)
  const stillThere = await prisma.orderPayment.count({ where: { id: cardLine.id } })
  assert.equal(stillThere, 1)

  const audit = await request(app).get('/api/audit-logs').query({ action: 'PAYMENT_RECORDED', entityId: paid.body.data.id }).set(auth(adminToken))
  assert.equal(audit.body.data.length >= 2, true)

  const summary = await request(app).get(`/api/orders/${paid.body.data.id}/payment-summary`).set(auth(staffToken))
  assert.equal(summary.body.data.paymentStatus, 'PAID')
  assert.equal(summary.body.data.orderTotal, '1000.00')
})

test('a payment method added by an administrator is available for new orders', async () => {
  const created = await request(app).post('/api/payment-methods').set(auth(adminToken)).send({
    name: 'GrabPay', category: 'EWALLET', provider: 'GrabPay', code: 'GRABPAY',
  })
  assert.equal(created.status, 201)
  const active = await request(app).get('/api/payment-methods/active').set(auth(staffToken))
  assert.equal(active.body.data.some((row) => row.code === 'GRABPAY' && row.name === 'GrabPay'), true)
  const staffCreate = await request(app).post('/api/payment-methods').set(auth(staffToken)).send({
    name: 'ShopeePay', category: 'EWALLET', provider: 'ShopeePay', code: 'SHOPEEPAY',
  })
  assert.equal(staffCreate.status, 403)
})

test('an order assigns a dermtech and the commission report uses that line', async () => {
  const dermtech = await request(app).post('/api/dermtechs').set(auth(managerToken)).send({ name: 'Report Dermtech' })
  assert.equal(dermtech.status, 201)
  const customer = await request(app).post('/api/customers').set(auth(staffToken)).send({ firstName: 'Commission', lastName: 'Guest', phone: '09000000981' })
  const service = await request(app).post('/api/products').set(auth(managerToken)).send({ name: 'Commission Facial', type: 'service', price: '1000.00' })
  await prisma.productService.update({ where: { id: service.body.data.id }, data: { commissionPercent: 10 } })
  const order = await request(app).post('/api/orders').set(auth(staffToken)).send({
    customerId: customer.body.data.id,
    lines: [{ productId: service.body.data.id, quantity: 1, dermtechId: dermtech.body.data.id }],
  })
  assert.equal(order.status, 201)
  assert.equal(order.body.data.items[0].dermtechName, 'Report Dermtech')
  assert.equal(order.body.data.items[0].commission, '100.00')
  const inactive = await request(app).put(`/api/dermtechs/${dermtech.body.data.id}`).set(auth(managerToken)).send({ status: 'inactive' })
  assert.equal(inactive.status, 200)
  const blocked = await request(app).post('/api/orders').set(auth(staffToken)).send({
    customerId: customer.body.data.id,
    lines: [{ productId: service.body.data.id, quantity: 1, dermtechId: dermtech.body.data.id }],
  })
  assert.equal(blocked.status, 422)
  await request(app).put(`/api/dermtechs/${dermtech.body.data.id}`).set(auth(managerToken)).send({ status: 'active' })
  const report = await request(app).get('/api/reports/commissions').query({ from: '2000-01-01', to: '2100-01-01' }).set(auth(managerToken))
  const row = report.body.data.dermtechs.find((item) => item.name === 'Report Dermtech')
  assert.equal(row.commission10, '100.00')
  assert.equal(row.totalCommission, '100.00')
  const staffReport = await request(app).get('/api/reports/commissions').set(auth(staffToken))
  assert.equal(staffReport.status, 403)
})

test('business profile starts with the clinic name and only an admin can change it', async () => {
  const current = await request(app).get('/api/business').set(auth(staffToken))
  assert.equal(current.status, 200)
  assert.equal(current.body.data.legalName, 'Executive Facial Care')
  assert.equal(current.body.data.country, 'Philippines')
  const denied = await request(app).put('/api/business').set(auth(staffToken)).send({ ...current.body.data, legalName: 'Other Clinic' })
  assert.equal(denied.status, 403)
  const saved = await request(app).put('/api/business').set(auth(adminToken)).send({
    ...current.body.data,
    tradeName: 'EFC Studio',
    tin: '123-456-789',
    phone: '02-8888-1000',
    email: 'hello@executivefacial.care',
  })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.data.tradeName, 'EFC Studio')
  assert.equal(saved.body.data.legalName, 'Executive Facial Care')
  const badTin = await request(app).put('/api/business').set(auth(adminToken)).send({ ...saved.body.data, tin: 'not-a-tin' })
  assert.equal(badTin.status, 400)
})

test('an admin sets module access and staff follows it', async () => {
  const mine = await request(app).get('/api/access').set(auth(staffToken))
  assert.equal(mine.status, 200)
  assert.equal(mine.body.data.grants.orders, 'manage')
  assert.equal(mine.body.data.grants.commissions, 'none')
  const denied = await request(app).get('/api/access/matrix').set(auth(staffToken))
  assert.equal(denied.status, 403)
  const matrix = await request(app).get('/api/access/matrix').set(auth(adminToken))
  assert.equal(matrix.status, 200)
  const grants = []
  for (const role of matrix.body.data.roles) {
    for (const item of matrix.body.data.modules) {
      const access = role === 'STAFF' && item.key === 'commissions' ? 'view' : matrix.body.data.grants[role][item.key]
      grants.push({ role, module: item.key, access })
    }
  }
  const saved = await request(app).put('/api/access/matrix').set(auth(adminToken)).send({ grants })
  assert.equal(saved.status, 200)
  const opened = await request(app).get('/api/reports/commissions').set(auth(staffToken))
  assert.equal(opened.status, 200)
  const locked = grants.map((grant) => (grant.role === 'ADMIN' && grant.module === 'access' ? { ...grant, access: 'none' } : grant))
  const rejected = await request(app).put('/api/access/matrix').set(auth(adminToken)).send({ grants: locked })
  assert.equal(rejected.status, 400)
  const restored = grants.map((grant) => (grant.role === 'STAFF' && grant.module === 'commissions' ? { ...grant, access: 'none' } : grant))
  const back = await request(app).put('/api/access/matrix').set(auth(adminToken)).send({ grants: restored })
  assert.equal(back.status, 200)
})

test('an admin can create a role and assign it to a user', async () => {
  const denied = await request(app).post('/api/access/roles').set(auth(staffToken)).send({ name: 'Reception' })
  assert.equal(denied.status, 403)
  const created = await request(app).post('/api/access/roles').set(auth(adminToken)).send({ name: 'Reception', description: 'Front desk' })
  assert.equal(created.status, 201)
  assert.equal(created.body.data.roles.includes('RECEPTION'), true)
  assert.equal(created.body.data.grants.RECEPTION.orders, 'none')
  const duplicate = await request(app).post('/api/access/roles').set(auth(adminToken)).send({ name: 'reception' })
  assert.equal(duplicate.status, 400)
  const user = await request(app).post('/api/users').set(auth(adminToken)).send({
    name: 'Desk User', email: 'desk@test.local', password: 'Password123x', role: 'RECEPTION',
  })
  assert.equal(user.status, 201)
  assert.equal(user.body.data.role, 'RECEPTION')
  const listed = await request(app).get('/api/roles').set(auth(adminToken))
  assert.equal(listed.body.data.some((role) => role.name === 'RECEPTION' && role.description === 'Front desk'), true)
})
