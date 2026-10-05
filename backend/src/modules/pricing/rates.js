const { AppError } = require('../../lib/errors')
const { fromCentavos } = require('../../lib/money')

const SERVICE_RATES = ['regular', 'gc_cash', 'gc_card']
const MEDICINE_RATES = ['regular', 'cash', 'card']
const PAYMENT_METHODS = ['cash', 'ewallet', 'card']
const LEGACY_PAYMENTS = {
  gcash: 'ewallet',
  maya: 'ewallet',
  bpi: 'card',
  bdo: 'card',
  metrobank: 'card',
  metrobank_card: 'card',
  maya_card: 'card',
}

function groupPayments(stored) {
  const grouped = { cash: 0, ewallet: 0, card: 0 }
  for (const [key, amount] of Object.entries(stored || {})) {
    const bucket = grouped[key] != null ? key : LEGACY_PAYMENTS[key]
    if (bucket) grouped[bucket] += Number(amount) || 0
  }
  return grouped
}

function ratesFor(type) {
  return type === 'product' ? MEDICINE_RATES : SERVICE_RATES
}

function unitPriceCentavos(product, rate = 'regular') {
  const allowed = ratesFor(product.type)
  if (!allowed.includes(rate)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'That price rate does not apply to this item.')
  }
  const list = product.priceCentavos
  if (rate === 'gc_cash') return Math.round(list / 2)
  if (rate === 'gc_card') return Math.round((list * 55) / 100)
  if (rate === 'card') return Math.round((list * 95) / 100)
  if (rate === 'cash') return product.cashPriceCentavos ?? list
  return list
}

function quotePrices(product) {
  const quote = { commissionPercent: product.commissionPercent || 0 }
  for (const rate of ratesFor(product.type)) {
    quote[rate] = fromCentavos(unitPriceCentavos(product, rate))
  }
  return quote
}

function commissionCentavos(subtotalCentavos, percent) {
  return Math.round((subtotalCentavos * (percent || 0)) / 100)
}

function lineCommission({ subtotalCentavos, quantity, commissionPercent, commissionFlatCentavos }) {
  if (commissionFlatCentavos != null) {
    return {
      kind: 'flat',
      percent: null,
      rateLabel: 'flat',
      commissionCentavos: commissionFlatCentavos * quantity,
    }
  }
  const percent = commissionPercent || 0
  const kind = percent === 10 ? 'rate10' : percent === 15 ? 'rate15' : 'other'
  return {
    kind,
    percent,
    rateLabel: `${percent}%`,
    commissionCentavos: Math.round((subtotalCentavos * percent) / 100),
  }
}

module.exports = {
  PAYMENT_METHODS,
  groupPayments,
  ratesFor,
  unitPriceCentavos,
  quotePrices,
  commissionCentavos,
  lineCommission,
}
