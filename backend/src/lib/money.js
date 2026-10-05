const { AppError } = require('./errors')

function toCentavos(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value < 0) throw new AppError(400, 'VALIDATION_ERROR', 'Amount cannot be negative.')
    return value
  }
  const text = String(value ?? '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter an amount with up to two decimal places.')
  }
  const [whole, fraction = '0'] = text.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2))
}

function fromCentavos(centavos) {
  const sign = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

module.exports = { toCentavos, fromCentavos }
