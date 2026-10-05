const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')
const { pageParams, listResponse } = require('../../lib/pagination')
const { manilaDateString } = require('../../lib/dates')
const { deliver } = require('../../integrations/messaging/MessageGateway')

function render(template, customer) {
  return template.replaceAll('{{first_name}}', customer.firstName)
}

async function listCampaigns(query) {
  const { page, pageSize, skip } = pageParams(query)
  const [rows, total] = await Promise.all([
    prisma.marketingCampaign.findMany({
      include: { segment: true, messages: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.marketingCampaign.count(),
  ])
  return listResponse(rows.map(presentCampaign), page, pageSize, total)
}

function presentCampaign(campaign) {
  const messages = campaign.messages || []
  return {
    id: campaign.id,
    name: campaign.name,
    type: campaign.type,
    channel: campaign.channel,
    targetSegmentId: campaign.targetSegmentId,
    segmentName: campaign.segment?.name,
    message: campaign.message,
    startDate: campaign.startDate.toISOString().slice(0, 10),
    endDate: campaign.endDate.toISOString().slice(0, 10),
    status: campaign.status,
    counts: {
      sent: messages.filter((item) => item.status === 'sent').length,
      failed: messages.filter((item) => item.status === 'failed').length,
      queued: messages.filter((item) => item.status === 'queued').length,
    },
  }
}

async function getCampaign(id) {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id },
    include: { segment: true, messages: true },
  })
  if (!campaign) throw new AppError(404, 'NOT_FOUND', 'Campaign not found.')
  return presentCampaign(campaign)
}

function assertCampaign(input) {
  const types = ['promotional', 'informational', 'win_back', 'birthday']
  if (!types.includes(input.type)) throw new AppError(400, 'VALIDATION_ERROR', 'Campaign type is not supported.')
  if (!['sms', 'email'].includes(input.channel)) throw new AppError(400, 'VALIDATION_ERROR', 'Channel must be sms or email.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Use calendar dates for the campaign period.')
  }
  if (input.endDate < input.startDate) throw new AppError(400, 'VALIDATION_ERROR', 'End date must be on or after the start date.')
}

async function createCampaign(input, user) {
  assertCampaign(input)
  const segment = await prisma.customerSegment.findUnique({ where: { id: input.targetSegmentId } })
  if (!segment) throw new AppError(404, 'NOT_FOUND', 'Segment not found.')
  const campaign = await prisma.marketingCampaign.create({
    data: {
      name: input.name.trim(),
      type: input.type,
      channel: input.channel,
      targetSegmentId: input.targetSegmentId,
      message: input.message.trim(),
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      endDate: new Date(`${input.endDate}T00:00:00.000Z`),
      status: 'draft',
      createdById: user.id,
    },
  })
  await writeAudit(prisma, {
    userId: user.id,
    action: 'create',
    entity: 'campaign',
    entityId: campaign.id,
    newValue: { name: campaign.name, channel: campaign.channel, segmentId: campaign.targetSegmentId },
  })
  return getCampaign(campaign.id)
}

async function updateCampaign(id, input, user) {
  const existing = await prisma.marketingCampaign.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Campaign not found.')
  assertCampaign(input)
  await prisma.marketingCampaign.update({
    where: { id },
    data: {
      name: input.name.trim(),
      type: input.type,
      channel: input.channel,
      targetSegmentId: input.targetSegmentId,
      message: input.message.trim(),
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      endDate: new Date(`${input.endDate}T00:00:00.000Z`),
    },
  })
  await writeAudit(prisma, {
    userId: user.id,
    action: 'update',
    entity: 'campaign',
    entityId: id,
    oldValue: { name: existing.name, message: existing.message },
    newValue: { name: input.name.trim(), message: input.message.trim() },
  })
  return getCampaign(id)
}

async function activateCampaign(id, user) {
  const campaign = await prisma.marketingCampaign.findUnique({ where: { id }, include: { segment: true } })
  if (!campaign) throw new AppError(404, 'NOT_FOUND', 'Campaign not found.')
  const today = manilaDateString()
  const start = campaign.startDate.toISOString().slice(0, 10)
  const end = campaign.endDate.toISOString().slice(0, 10)
  if (today < start || today > end) {
    throw new AppError(422, 'BUSINESS_RULE', 'Today is outside the campaign dates.')
  }
  const memberships = await prisma.customerSegmentMembership.findMany({
    where: { segmentId: campaign.targetSegmentId },
    include: { customer: true },
  })
  let created = 0
  let skipped = 0
  for (const membership of memberships) {
    const dedupeKey = `campaign:${campaign.id}:customer:${membership.customerId}`
    const existing = await prisma.marketingMessage.findUnique({ where: { dedupeKey } })
    if (existing) {
      skipped += 1
      continue
    }
    const body = render(campaign.message, membership.customer)
    const result = await deliver(body)
    await prisma.marketingMessage.create({
      data: {
        customerId: membership.customerId,
        campaignId: campaign.id,
        channel: campaign.channel,
        message: body,
        status: result.status,
        dedupeKey,
        sentAt: result.status === 'sent' ? new Date() : null,
      },
    })
    created += 1
  }
  await prisma.marketingCampaign.update({ where: { id }, data: { status: 'active' } })
  await writeAudit(prisma, {
    userId: user.id,
    action: 'activate',
    entity: 'campaign',
    entityId: id,
    newValue: { created, skipped },
  })
  return { processed: memberships.length, created, updated: 0, skipped }
}

async function deactivateCampaign(id, user) {
  const existing = await prisma.marketingCampaign.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Campaign not found.')
  await prisma.marketingCampaign.update({ where: { id }, data: { status: 'inactive' } })
  await writeAudit(prisma, {
    userId: user.id,
    action: 'update',
    entity: 'campaign',
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { status: 'inactive' },
  })
  return getCampaign(id)
}

async function listMessages(query) {
  const { page, pageSize, skip } = pageParams(query)
  const where = {}
  if (query.campaignId) where.campaignId = query.campaignId
  if (query.customerId) where.customerId = query.customerId
  if (query.status) where.status = query.status
  if (query.channel) where.channel = query.channel
  const [rows, total] = await Promise.all([
    prisma.marketingMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { customer: true } }),
    prisma.marketingMessage.count({ where }),
  ])
  return listResponse(rows.map((row) => ({
    id: row.id,
    customerId: row.customerId,
    customerName: `${row.customer.firstName} ${row.customer.lastName}`,
    campaignId: row.campaignId,
    channel: row.channel,
    message: row.message,
    status: row.status,
    sentAt: row.sentAt,
  })), page, pageSize, total)
}

module.exports = {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  activateCampaign,
  deactivateCampaign,
  listMessages,
  render,
}
