const express = require('express')
const rateLimit = require('express-rate-limit')
const { z } = require('zod')
const { asyncHandler } = require('../lib/asyncHandler')
const { authenticate } = require('../middleware/authenticate')
const { authorize } = require('../middleware/authorize')
const { permit } = require('../middleware/permit')
const { AppError } = require('../lib/errors')
const { assertPasswordPolicy } = require('../lib/passwords')
const { prisma } = require('../lib/prisma')
const { pageParams, listResponse } = require('../lib/pagination')
const auth = require('../modules/auth/service')
const users = require('../modules/users/service')
const customers = require('../modules/customers/service')
const segments = require('../modules/segments/service')
const customerValue = require('../modules/customerValue/service')
const inventory = require('../modules/inventory/service')
const orders = require('../modules/orders/service')
const campaigns = require('../modules/campaigns/service')
const promotions = require('../modules/promotions/service')
const analytics = require('../modules/analytics/service')
const insights = require('../modules/insights/service')
const anomalies = require('../modules/anomalies/service')
const reports = require('../modules/reports/service')
const settings = require('../modules/settings/service')
const business = require('../modules/business/service')
const pos = require('../integrations/pos/PosIntegrationService')
const payments = require('../modules/payments/service')
const dermtechs = require('../modules/dermtechs/service')
const commissions = require('../modules/commissions/service')
const access = require('../modules/access/service')

const admin = authorize('ADMIN')

function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Check the highlighted fields.', result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    })))
  }
  return result.data
}

const paymentMethodSchema = z.object({
  name: z.string().min(1).max(80),
  category: z.enum(['CASH', 'EWALLET', 'QR', 'CARD']),
  provider: z.string().min(1).max(80),
  code: z.string().min(2).max(40),
  description: z.string().max(200).optional(),
  displayOrder: z.number().int().optional(),
  allowsChange: z.boolean().optional(),
  requiresReference: z.boolean().optional(),
  isActive: z.boolean().optional(),
  qrConfig: z.string().max(2000).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
})

const newPasswordField = z.string().superRefine((value, ctx) => {
  try {
    assertPasswordPolicy(value)
  } catch (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: error.message })
  }
})

const customerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  birthday: z.string().optional().or(z.literal('')),
  address: z.string().optional(),
  customerType: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  smsConsent: z.boolean().optional(),
  emailConsent: z.boolean().optional(),
})

function mount(app) {
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    skip: () => process.env.NODE_ENV === 'test',
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'UNAUTHORIZED', message: 'Too many sign-in attempts. Try again later.', details: [] } },
  })

  app.get('/api/health', asyncHandler(async (req, res) => {
    let database = 'down'
    try {
      await prisma.$queryRaw`SELECT 1`
      database = 'up'
    } catch {
      database = 'down'
    }
    res.json({ data: { status: 'ok', database } })
  }))

  app.post('/api/auth/login', loginLimiter, asyncHandler(async (req, res) => {
    const body = parse(loginSchema, req.body)
    res.json({ data: await auth.login(body.email, body.password) })
  }))
  app.post('/api/auth/password', loginLimiter, asyncHandler(async (req, res) => {
    const body = parse(z.object({
      email: z.string().email(),
      currentPassword: z.string().min(1),
      newPassword: z.string().min(1),
    }), req.body)
    await auth.changePasswordByEmail(body.email, body.currentPassword, body.newPassword)
    res.status(204).end()
  }))

  const secure = express.Router()
  secure.use(authenticate)

  secure.post('/auth/logout', asyncHandler(async (req, res) => {
    await auth.logout(req.user)
    res.status(204).end()
  }))
  secure.get('/auth/me', asyncHandler(async (req, res) => {
    res.json({ data: req.user })
  }))
  secure.post('/auth/change-password', asyncHandler(async (req, res) => {
    const body = parse(passwordSchema, req.body)
    await auth.changePassword(req.user.id, body.currentPassword, body.newPassword)
    res.status(204).end()
  }))

  secure.get('/access', asyncHandler(async (req, res) => {
    res.json({ data: { grants: await access.grantsFor(req.user.role) } })
  }))
  secure.get('/access/matrix', permit('access', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await access.matrix() })
  }))
  secure.put('/access/matrix', permit('access', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await access.updateMatrix(req.body, req.user) })
  }))
  secure.get('/roles', permit('users', 'view'), asyncHandler(async (req, res) => {
    res.json({ data: await access.listRoles() })
  }))
  secure.post('/access/roles', permit('access', 'manage'), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await access.createRole(req.body, req.user) })
  }))

  secure.get('/users', permit('users', 'view'), asyncHandler(async (req, res) => res.json(await users.listUsers(req.query))))
  secure.post('/users', permit('users', 'manage'), asyncHandler(async (req, res) => {
    const body = parse(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: newPasswordField,
      role: z.string().min(1).max(40),
    }), req.body)
    res.status(201).json({ data: await users.createUser(body, req.user) })
  }))
  secure.put('/users/:id', permit('users', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await users.updateUser(req.params.id, req.body, req.user) })
  }))
  secure.post('/users/:id/reset-password', permit('users', 'manage'), asyncHandler(async (req, res) => {
    const body = parse(z.object({ password: newPasswordField }), req.body)
    await users.resetPassword(req.params.id, body.password, req.user)
    res.status(204).end()
  }))

  secure.get('/customers', permit('customers', 'view'), asyncHandler(async (req, res) => res.json(await customers.listCustomers(req.query))))
  secure.post('/customers', permit('customers', 'manage'), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await customers.createCustomer(parse(customerSchema, req.body), req.user) })
  }))
  secure.get('/customers/:id', permit('customers', 'view'), asyncHandler(async (req, res) => res.json({ data: await customers.getCustomer(req.params.id) })))
  secure.put('/customers/:id', permit('customers', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await customers.updateCustomer(req.params.id, parse(customerSchema, req.body), req.user) })
  }))
  secure.post('/customers/:id/deactivate', permit('customers', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await customers.deactivateCustomer(req.params.id, req.user) })
  }))
  secure.delete('/customers/:id', admin, asyncHandler(async (req, res) => {
    await customers.deleteCustomer(req.params.id, req.user)
    res.status(204).end()
  }))
  secure.get('/customers/:id/activities', permit('customers', 'view'), asyncHandler(async (req, res) => {
    const profile = await customers.getCustomer(req.params.id)
    res.json({ data: profile.activities })
  }))
  secure.post('/customers/:id/activities', permit('customers', 'manage'), asyncHandler(async (req, res) => {
    const body = parse(z.object({
      type: z.enum(['note', 'call', 'visit', 'follow_up']),
      notes: z.string().min(1),
      activityDate: z.string().optional(),
    }), req.body)
    res.status(201).json({ data: await customers.addActivity(req.params.id, body, req.user) })
  }))
  secure.get('/customers/:id/value', permit('customers', 'view'), asyncHandler(async (req, res) => {
    const row = await prisma.customerLifetimeValue.findUnique({ where: { customerId: req.params.id } })
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Customer not found.')
    res.json({ data: customerValue.presentValue(row) })
  }))
  secure.post('/customers/:id/value/recalculate', permit('customers', 'manage'), asyncHandler(async (req, res) => {
    const row = await customerValue.recalculateCustomer(req.params.id)
    res.json({ data: customerValue.presentValue(row) })
  }))
  secure.post('/customer-value/recalculate', permit('customers', 'manage'), asyncHandler(async (req, res) => {
    const processed = await customerValue.recalculateAll()
    res.json({ data: { processed, created: 0, updated: processed, skipped: 0 } })
  }))

  secure.get('/segments', permit('segments', 'view'), asyncHandler(async (req, res) => res.json({ data: await segments.listSegments() })))
  secure.post('/segments', permit('segments', 'manage'), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await segments.createSegment(req.body, req.user) })
  }))
  secure.post('/segments/rebuild', permit('segments', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await segments.rebuildMemberships(req.user) })
  }))
  secure.get('/segments/:id', permit('segments', 'view'), asyncHandler(async (req, res) => res.json({ data: await segments.getSegment(req.params.id) })))
  secure.put('/segments/:id', permit('segments', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await segments.updateSegment(req.params.id, req.body, req.user) })
  }))
  secure.get('/segments/:id/members', permit('segments', 'view'), asyncHandler(async (req, res) => res.json(await segments.members(req.params.id, req.query))))

  secure.get('/products', permit('catalog', 'view'), asyncHandler(async (req, res) => res.json(await inventory.listProducts({ ...req.query, pageSize: req.query.pageSize || '100' }))))
  secure.post('/products', permit('catalog', 'manage'), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await inventory.createProduct(req.body) })
  }))
  secure.put('/products/:id', permit('catalog', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await inventory.updateProduct(req.params.id, req.body) })
  }))
  secure.get('/inventory', permit('inventory', 'view'), asyncHandler(async (req, res) => res.json(await inventory.listInventory(req.query))))
  secure.get('/inventory/alerts', permit('inventory', 'view'), asyncHandler(async (req, res) => res.json(await inventory.listAlerts(req.query))))
  secure.post('/inventory/restock', permit('inventory', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await inventory.restock(req.body, req.user) })
  }))
  secure.post('/inventory/adjustments', permit('inventory', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await inventory.adjust(req.body, req.user) })
  }))
  secure.post('/inventory/evaluate', permit('inventory', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await inventory.evaluateAll() })
  }))
  secure.get('/inventory/:id', permit('inventory', 'view'), asyncHandler(async (req, res) => {
    const row = await prisma.inventory.findUnique({ where: { id: req.params.id }, include: { product: true } })
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Inventory record not found.')
    res.json({ data: inventory.presentInventory(row) })
  }))
  secure.put('/inventory/:id', permit('inventory', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await inventory.updateInventorySettings(req.params.id, req.body) })
  }))
  secure.get('/inventory/:id/movements', permit('inventory', 'view'), asyncHandler(async (req, res) => {
    const row = await prisma.inventory.findUnique({ where: { id: req.params.id } })
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Inventory record not found.')
    res.json(await inventory.movements(row.productId, req.query))
  }))

  secure.get('/dermtechs', permit('dermtechs', 'view'), asyncHandler(async (req, res) => {
    res.json({ data: await dermtechs.listDermtechs(req.query) })
  }))
  secure.post('/dermtechs', permit('dermtechs', 'manage'), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await dermtechs.createDermtech(req.body, req.user) })
  }))
  secure.put('/dermtechs/:id', permit('dermtechs', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await dermtechs.updateDermtech(req.params.id, req.body, req.user) })
  }))

  secure.get('/orders', permit('orders', 'view'), asyncHandler(async (req, res) => res.json(await orders.listOrders(req.query))))
  secure.post('/orders', permit('orders', 'manage'), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await orders.createOrder(req.body, req.user) })
  }))
  secure.get('/orders/:id', permit('orders', 'view'), asyncHandler(async (req, res) => res.json({ data: await orders.getOrder(req.params.id) })))
  secure.post('/orders/:id/void', permit('orders', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await orders.voidOrder(req.params.id, req.body.reason, req.user) })
  }))
  secure.post('/orders/:id/cancel', permit('orders', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await orders.cancelOrder(req.params.id, req.body.reason, req.user) })
  }))
  secure.get('/orders/:orderId/payments', permit('orders', 'view'), asyncHandler(async (req, res) => {
    res.json({ data: await payments.listOrderPayments(req.params.orderId) })
  }))
  secure.post('/orders/:orderId/payments', permit('orders', 'manage'), asyncHandler(async (req, res) => {
    await payments.addOrderPayment(req.params.orderId, req.body, req.user)
    res.status(201).json({ data: await orders.getOrder(req.params.orderId) })
  }))
  secure.delete('/orders/:orderId/payments/:paymentId', permit('orders', 'manage'), asyncHandler(async (req, res) => {
    await payments.removeOrderPayment(req.params.orderId, req.params.paymentId, req.user)
    res.json({ data: await orders.getOrder(req.params.orderId) })
  }))
  secure.post('/orders/:orderId/complete', permit('orders', 'manage'), asyncHandler(async (req, res) => {
    await payments.completeOrderPayments(req.params.orderId, req.user)
    res.json({ data: await orders.getOrder(req.params.orderId) })
  }))
  secure.get('/orders/:orderId/payment-summary', permit('orders', 'view'), asyncHandler(async (req, res) => {
    res.json({ data: await payments.paymentSummary(req.params.orderId) })
  }))

  secure.get('/payment-methods/active', asyncHandler(async (req, res) => {
    res.json({ data: await payments.listActiveMethods() })
  }))
  secure.get('/payment-methods', permit('payments', 'view'), asyncHandler(async (req, res) => {
    res.json({ data: await payments.listMethods() })
  }))
  secure.post('/payment-methods', permit('payments', 'manage'), asyncHandler(async (req, res) => {
    const body = parse(paymentMethodSchema, req.body)
    res.status(201).json({ data: await payments.createMethod(body, req.user) })
  }))
  secure.put('/payment-methods/:id', permit('payments', 'manage'), asyncHandler(async (req, res) => {
    const body = parse(paymentMethodSchema.partial(), req.body)
    res.json({ data: await payments.updateMethod(req.params.id, body, req.user) })
  }))
  secure.patch('/payment-methods/:id/status', permit('payments', 'manage'), asyncHandler(async (req, res) => {
    const body = parse(z.object({ isActive: z.boolean() }), req.body)
    res.json({ data: await payments.setMethodStatus(req.params.id, body.isActive, req.user) })
  }))
  secure.get('/analytics/payments', permit('dashboard', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await payments.paymentReport(req.query) })
  }))

  secure.get('/campaigns', permit('marketing', 'view'), asyncHandler(async (req, res) => res.json(await campaigns.listCampaigns(req.query))))
  secure.post('/campaigns', permit('marketing', 'manage'), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await campaigns.createCampaign(req.body, req.user) })
  }))
  secure.get('/campaigns/:id', permit('marketing', 'view'), asyncHandler(async (req, res) => res.json({ data: await campaigns.getCampaign(req.params.id) })))
  secure.put('/campaigns/:id', permit('marketing', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await campaigns.updateCampaign(req.params.id, req.body, req.user) })
  }))
  secure.post('/campaigns/:id/activate', permit('marketing', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await campaigns.activateCampaign(req.params.id, req.user) })
  }))
  secure.post('/campaigns/:id/deactivate', permit('marketing', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await campaigns.deactivateCampaign(req.params.id, req.user) })
  }))
  secure.get('/trigger-rules', permit('promotions', 'view'), asyncHandler(async (req, res) => res.json({ data: await promotions.listRules() })))
  secure.post('/trigger-rules', permit('promotions', 'manage'), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await promotions.createRule(req.body, req.user) })
  }))
  secure.put('/trigger-rules/:id', permit('promotions', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await promotions.updateRule(req.params.id, req.body, req.user) })
  }))
  secure.post('/promotions/evaluate', permit('promotions', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await promotions.evaluatePromotions(req.user) })
  }))
  secure.get('/messages', permit('marketing', 'view'), asyncHandler(async (req, res) => res.json(await campaigns.listMessages(req.query))))

  secure.get('/analytics/dashboard', permit('dashboard', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await analytics.dashboard(req.query, 'executive') })
  }))
  secure.get('/analytics/dashboard/basic', permit('dashboard', 'view'), asyncHandler(async (req, res) => {
    res.json({ data: await analytics.dashboard(req.query, 'basic') })
  }))
  secure.get('/analytics/sales', permit('analytics', 'view'), asyncHandler(async (req, res) => res.json({ data: await analytics.sales(req.query) })))
  secure.get('/analytics/customers', permit('analytics', 'view'), asyncHandler(async (req, res) => res.json({ data: await analytics.customers(req.query) })))
  secure.get('/analytics/inventory', permit('analytics', 'view'), asyncHandler(async (req, res) => res.json({ data: await analytics.inventory(req.query) })))

  secure.get('/ai/recommendations', permit('insights', 'view'), asyncHandler(async (req, res) => {
    const data = await insights.collect(req.query.from, req.query.to)
    res.json({ data: { from: data.from, to: data.to, customer: data.customer, sales: data.sales, marketing: data.marketing, producer: 'rule-based' } })
  }))
  secure.get('/ai/inventory', permit('insights', 'view'), asyncHandler(async (req, res) => {
    res.json({ data: await insights.inventoryFindings(), producer: 'rule-based' })
  }))
  secure.get('/ai/anomalies', permit('insights', 'view'), asyncHandler(async (req, res) => res.json(await anomalies.listAlerts(req.query))))
  secure.post('/ai/anomalies/evaluate', permit('insights', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await anomalies.evaluateAll() })
  }))
  secure.put('/ai/anomalies/:id', permit('insights', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await anomalies.updateAlert(req.params.id, req.body, req.user) })
  }))

  secure.get('/reports/commissions', permit('commissions', 'view'), asyncHandler(async (req, res) => {
    res.json({ data: await commissions.commissionReport(req.query) })
  }))

  const reportRoutes = ['customers', 'sales', 'inventory', 'campaigns', 'segments', 'customer-value', 'anomalies']
  const reportFns = {
    customers: reports.customers,
    sales: reports.sales,
    inventory: reports.inventory,
    campaigns: reports.campaigns,
    segments: reports.segments,
    'customer-value': reports.customerValue,
    anomalies: reports.anomalies,
  }
  for (const name of reportRoutes) {
    secure.get(`/reports/${name}`, permit('reports', 'view'), asyncHandler(async (req, res) => {
      const result = await reportFns[name](req.query)
      if (req.query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`)
        return res.send(result.csv)
      }
      return res.json(result)
    }))
  }

  secure.get('/audit-logs', permit('audit', 'view'), asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = pageParams(req.query)
    const where = {}
    if (req.query.userId) where.userId = req.query.userId
    if (req.query.entity) where.entity = req.query.entity
    if (req.query.action) where.action = req.query.action
    if (req.query.from && req.query.to) {
      const { manilaRange } = require('../lib/dates')
      where.createdAt = manilaRange(req.query.from, req.query.to)
    }
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, include: { user: true }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      prisma.auditLog.count({ where }),
    ])
    res.json(listResponse(rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      userName: row.user?.name || 'System',
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      oldValue: row.oldValue,
      newValue: row.newValue,
      createdAt: row.createdAt,
    })), page, pageSize, total))
  }))

  secure.get('/business', asyncHandler(async (req, res) => {
    res.json({ data: await business.getProfile() })
  }))
  secure.put('/business', permit('business', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await business.updateProfile(req.body, req.user) })
  }))

  secure.get('/settings', permit('settings', 'view'), asyncHandler(async (req, res) => res.json({ data: await settings.listSettings() })))
  secure.put('/settings/:key', permit('settings', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await settings.updateSetting(req.params.key, req.body.value, req.user) })
  }))

  secure.post('/pos/sync', permit('dashboard', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: await pos.sync(req.body.resources, req.user) })
  }))
  secure.get('/pos/sync/status', permit('dashboard', 'manage'), asyncHandler(async (req, res) => {
    res.json({ data: pos.status() })
  }))

  app.use('/api', secure)
}

module.exports = { mount }
