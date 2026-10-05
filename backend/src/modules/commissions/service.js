const { prisma } = require('../../lib/prisma')
const { fromCentavos } = require('../../lib/money')
const { manilaDateString, manilaRange, addManilaDays, manilaParts } = require('../../lib/dates')
const { lineCommission } = require('../pricing/rates')

function rangeFor(query) {
  const today = manilaDateString()
  if (query.from && query.to) return { from: query.from, to: query.to }
  if (query.preset === 'yesterday') {
    const day = addManilaDays(today, -1)
    return { from: day, to: day }
  }
  if (query.preset === 'week') return { from: addManilaDays(today, -6), to: today }
  if (query.preset === 'month') {
    const { year, month } = manilaParts()
    return { from: `${year}-${String(month).padStart(2, '0')}-01`, to: today }
  }
  return { from: today, to: today }
}

function emptyBucket(id, name, displayOrder = 9999) {
  return {
    id,
    name,
    displayOrder,
    serviceSalesCentavos: 0,
    commission10Centavos: 0,
    commission15Centavos: 0,
    flatCommissionCentavos: 0,
    medicineSalesCentavos: 0,
    medicineCommissionCentavos: 0,
    lines: [],
  }
}

function addLine(bucket, line) {
  const earned = lineCommission({
    subtotalCentavos: line.subtotalCentavos,
    quantity: line.quantity,
    commissionPercent: line.product?.commissionPercent,
    commissionFlatCentavos: line.product?.commissionFlatCentavos,
  })
  const isMedicine = line.product?.type === 'product'
  if (isMedicine) {
    bucket.medicineSalesCentavos += line.subtotalCentavos
    bucket.medicineCommissionCentavos += earned.commissionCentavos
  } else {
    bucket.serviceSalesCentavos += line.subtotalCentavos
    if (earned.kind === 'flat') bucket.flatCommissionCentavos += earned.commissionCentavos
    else if (earned.kind === 'rate15') bucket.commission15Centavos += earned.commissionCentavos
    else bucket.commission10Centavos += earned.commissionCentavos
  }
  bucket.lines.push({
    orderId: line.orderId,
    orderDate: line.orderDate,
    customerName: line.customerName,
    item: line.product?.name,
    type: isMedicine ? 'medicine' : 'service',
    quantity: line.quantity,
    sales: fromCentavos(line.subtotalCentavos),
    rate: isMedicine ? earned.rateLabel : earned.rateLabel,
    commission: fromCentavos(earned.commissionCentavos),
  })
}

function presentBucket(bucket) {
  const total = bucket.commission10Centavos + bucket.commission15Centavos + bucket.flatCommissionCentavos + bucket.medicineCommissionCentavos
  return {
    id: bucket.id,
    name: bucket.name,
    displayOrder: bucket.displayOrder,
    serviceSales: fromCentavos(bucket.serviceSalesCentavos),
    commission10: fromCentavos(bucket.commission10Centavos),
    commission15: fromCentavos(bucket.commission15Centavos),
    flatCommission: fromCentavos(bucket.flatCommissionCentavos),
    medicineSales: fromCentavos(bucket.medicineSalesCentavos),
    medicineCommission: fromCentavos(bucket.medicineCommissionCentavos),
    totalCommission: fromCentavos(total),
    lines: bucket.lines,
  }
}

async function commissionReport(query) {
  const range = rangeFor(query)
  const orders = await prisma.order.findMany({
    where: { status: 'completed', orderDate: manilaRange(range.from, range.to) },
    include: {
      customer: true,
      items: { include: { product: true, dermtech: true } },
    },
    orderBy: { orderDate: 'asc' },
  })
  const people = await prisma.dermtech.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] })
  const buckets = new Map()
  for (const person of people) {
    if (person.status === 'active') buckets.set(person.id, emptyBucket(person.id, person.name, person.displayOrder))
  }
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.dermtechId || 'unassigned'
      if (!buckets.has(key)) {
        buckets.set(key, emptyBucket(key, item.dermtech?.name || 'Unassigned', item.dermtech?.displayOrder ?? 10000))
      }
      addLine(buckets.get(key), {
        ...item,
        orderDate: order.orderDate,
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
      })
    }
  }
  const rows = [...buckets.values()].map(presentBucket).sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
  const totalCentavos = [...buckets.values()].reduce((sum, bucket) => (
    sum + bucket.commission10Centavos + bucket.commission15Centavos + bucket.flatCommissionCentavos + bucket.medicineCommissionCentavos
  ), 0)
  return {
    from: range.from,
    to: range.to,
    totalCommission: fromCentavos(totalCentavos),
    rule: 'Most services pay 10% of the line amount. Carbon, pico, and butt laser services pay 15%. FOOTSPA pays ₱100 each, FOOTSPA WITH PARAFFIN pays ₱120 each, and Sunblock, Lifting Mask, and Whitening Mask pay ₱10 each. Medicine pays 15% of the line amount.',
    dermtechs: rows,
  }
}

module.exports = { commissionReport, lineCommission }
