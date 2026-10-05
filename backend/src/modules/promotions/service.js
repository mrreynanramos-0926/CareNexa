const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')
const { manilaParts, manilaDateString, calendarDate } = require('../../lib/dates')
const { buildMetricContext } = require('../customerValue/service')
const { getSettingsMap } = require('../settings/service')
const { deliver } = require('../../integrations/messaging/MessageGateway')
const { render } = require('../campaigns/service')

const EVENTS = ['birthday', 'anniversary', 'inactivity', 'purchase_count', 'new_customer', 'vip']

async function listRules() {
  const rules = await prisma.triggerRule.findMany({ orderBy: { name: 'asc' } })
  return rules.map(presentRule)
}

function presentRule(rule) {
  return {
    id: rule.id,
    name: rule.name,
    eventType: rule.eventType,
    conditionValue: rule.conditionValue,
    action: rule.action,
    messageTemplate: rule.messageTemplate,
    channel: rule.channel,
    conditionValue: rule.conditionValue,
    isActive: rule.isActive,
  }
}

function assertRule(input) {
  if (!EVENTS.includes(input.eventType)) throw new AppError(400, 'VALIDATION_ERROR', 'Event type is not supported.')
  if (!['sms', 'email'].includes(input.channel)) throw new AppError(400, 'VALIDATION_ERROR', 'Channel must be sms or email.')
  if (!input.messageTemplate || !input.messageTemplate.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A message template is required.')
  }
}

async function createRule(input, user) {
  assertRule(input)
  const rule = await prisma.triggerRule.create({
    data: {
      name: input.name.trim(),
      eventType: input.eventType,
      conditionValue: input.conditionValue || {},
      action: 'create_message',
      messageTemplate: input.messageTemplate.trim(),
      channel: input.channel,
      isActive: input.isActive !== false,
    },
  })
  await writeAudit(prisma, {
    userId: user.id,
    action: 'create',
    entity: 'trigger_rule',
    entityId: rule.id,
    newValue: { name: rule.name, eventType: rule.eventType },
  })
  return presentRule(rule)
}

async function updateRule(id, input, user) {
  const existing = await prisma.triggerRule.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Trigger rule not found.')
  assertRule(input)
  const rule = await prisma.triggerRule.update({
    where: { id },
    data: {
      name: input.name.trim(),
      eventType: input.eventType,
      conditionValue: input.conditionValue || {},
      messageTemplate: input.messageTemplate.trim(),
      channel: input.channel,
      isActive: Boolean(input.isActive),
    },
  })
  await writeAudit(prisma, {
    userId: user.id,
    action: 'update',
    entity: 'trigger_rule',
    entityId: id,
    oldValue: { isActive: existing.isActive, messageTemplate: existing.messageTemplate },
    newValue: { isActive: rule.isActive, messageTemplate: rule.messageTemplate },
  })
  return presentRule(rule)
}

function monthDay(date) {
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

async function logMessage(customer, rule, dedupeKey) {
  const existing = await prisma.marketingMessage.findUnique({ where: { dedupeKey } })
  if (existing) return false
  const body = render(rule.messageTemplate, customer)
  const result = await deliver(body)
  await prisma.marketingMessage.create({
    data: {
      customerId: customer.id,
      triggerRuleId: rule.id,
      channel: rule.channel,
      message: body,
      status: result.status,
      dedupeKey,
      sentAt: result.status === 'sent' ? new Date() : null,
    },
  })
  return true
}

async function evaluatePromotions(actor) {
  const rules = await prisma.triggerRule.findMany({ where: { isActive: true } })
  const customers = await prisma.customer.findMany({
    where: { status: 'active' },
    include: { memberships: { include: { segment: true } } },
  })
  const settings = await getSettingsMap()
  const today = manilaParts()
  const year = today.year
  let created = 0
  let skipped = 0
  for (const customer of customers) {
    const metrics = await buildMetricContext(customer)
    for (const rule of rules) {
      const condition = rule.conditionValue || {}
      let dedupeKey = null
      if (rule.eventType === 'birthday' && customer.birthday) {
        const birth = monthDay(customer.birthday)
        if (birth.month === today.month && birth.day === today.day) {
          dedupeKey = `trigger:birthday:customer:${customer.id}:year:${year}`
        }
      }
      if (rule.eventType === 'anniversary') {
        const createdParts = manilaParts(customer.createdAt)
        if (createdParts.month === today.month && createdParts.day === today.day && createdParts.year !== year) {
          dedupeKey = `trigger:anniversary:customer:${customer.id}:year:${year}`
        }
      }
      if (rule.eventType === 'inactivity') {
        const days = Number(condition.days ?? settings.inactive_days)
        if (metrics.days_since_last_visit >= days && metrics.visit_count > 0) {
          const since = calendarDate(metrics.lastVisitDate)
          dedupeKey = `trigger:inactivity:customer:${customer.id}:since:${since}`
        }
      }
      if (rule.eventType === 'purchase_count') {
        const count = Number(condition.count ?? settings.purchase_count_threshold)
        if (metrics.visit_count >= count) {
          dedupeKey = `trigger:purchase_count:customer:${customer.id}:count:${count}`
        }
      }
      if (rule.eventType === 'new_customer') {
        const days = Number(condition.days ?? settings.new_customer_days)
        if (metrics.days_since_first_visit != null && metrics.days_since_first_visit <= days) {
          dedupeKey = `trigger:new_customer:customer:${customer.id}`
        }
      }
      if (rule.eventType === 'vip') {
        const isVip = customer.memberships.some((membership) => membership.segment.name === 'VIP')
        if (isVip) dedupeKey = `trigger:vip:customer:${customer.id}`
      }
      if (!dedupeKey) continue
      const wrote = await logMessage(customer, rule, dedupeKey)
      if (wrote) created += 1
      else skipped += 1
    }
  }
  if (actor) {
    await writeAudit(prisma, {
      userId: actor.id,
      action: 'update',
      entity: 'trigger_rule',
      entityId: 'evaluation',
      newValue: { created, skipped },
    })
  }
  return { processed: customers.length, created, updated: 0, skipped }
}

module.exports = { listRules, createRule, updateRule, evaluatePromotions }
