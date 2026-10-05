const { AppError } = require('../../lib/errors')
const { fromCentavos } = require('../../lib/money')

const CATEGORIES = ['CASH', 'EWALLET', 'QR', 'CARD']
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'PARTIALLY_PAID', 'FAILED', 'VOIDED', 'REFUNDED']
const SENSITIVE_KEYS = new Set([
  'cvv', 'cvc', 'cid', 'pin', 'cardnumber', 'card_number', 'pan', 'fullcardnumber',
  'expiry', 'expiration', 'expmonth', 'expyear', 'securitycode',
])

function applyPayments(netCentavos, payments) {
  let remaining = netCentavos
  let change = 0
  let totalPaid = 0
  for (const payment of payments) {
    if (payment.status && payment.status !== 'PAID') continue
    const amount = payment.amountCentavos
    if (!Number.isInteger(amount) || amount <= 0) {
      return { error: 'Enter a payment amount.' }
    }
    const givesChange = payment.category === 'CASH' || payment.allowsChange === true
    if (!givesChange && amount > remaining) {
      return { error: 'Payment amount exceeds the remaining balance.' }
    }
    if (givesChange && amount > remaining) {
      change += amount - remaining
      totalPaid += amount
      remaining = 0
    } else {
      totalPaid += amount
      remaining -= amount
    }
  }
  const balanceDue = remaining
  let paymentStatus = 'PENDING'
  if (balanceDue === 0 && (totalPaid > 0 || netCentavos === 0)) paymentStatus = 'PAID'
  else if (totalPaid > 0 && balanceDue > 0) paymentStatus = 'PARTIALLY_PAID'
  return {
    orderTotal: netCentavos,
    totalPaid,
    balanceDue,
    change,
    paymentStatus,
    error: null,
  }
}

function incompleteMessage(balanceCentavos) {
  const formatted = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(balanceCentavos / 100)
  return `Payment is incomplete. Remaining balance: ${formatted}`
}

function assertNoSensitive(value) {
  if (!value || typeof value !== 'object') return
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Card numbers, CVV, PIN, and expiration data are not stored.')
    }
    if (entry && typeof entry === 'object') assertNoSensitive(entry)
  }
}

function assertNoPan(value, label) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length >= 13 && digits.length <= 19) {
    throw new AppError(400, 'VALIDATION_ERROR', `${label} looks like a full card number. Only the last 4 digits may be stored.`)
  }
}

function summaryDto(order, applied, lines) {
  const status = ['VOIDED', 'REFUNDED', 'FAILED'].includes(order.paymentStatus)
    ? order.paymentStatus
    : (order.paymentStatus === 'PAID' && applied.balanceDue === 0 ? 'PAID' : applied.paymentStatus)
  return {
    orderTotal: fromCentavos(order.totalCentavos),
    totalPaid: fromCentavos(applied.totalPaid),
    balanceDue: fromCentavos(applied.balanceDue),
    change: fromCentavos(applied.change),
    paymentStatus: status,
    payments: lines
      .filter((line) => line.paymentStatus === 'PAID')
      .map((line) => ({
        method: line.method.name,
        category: line.method.category,
        amount: fromCentavos(line.amountCentavos),
      })),
  }
}

module.exports = {
  CATEGORIES,
  PAYMENT_STATUSES,
  applyPayments,
  incompleteMessage,
  assertNoSensitive,
  assertNoPan,
  summaryDto,
}
