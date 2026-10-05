const test = require('node:test')
const assert = require('node:assert/strict')
const { lineCommission } = require('../src/modules/pricing/rates')

test('a 10 percent service pays 10 percent of the line amount', () => {
  const result = lineCommission({ subtotalCentavos: 100000, quantity: 1, commissionPercent: 10, commissionFlatCentavos: null })
  assert.equal(result.kind, 'rate10')
  assert.equal(result.commissionCentavos, 10000)
})

test('a 15 percent service pays 15 percent of the line amount', () => {
  const result = lineCommission({ subtotalCentavos: 150000, quantity: 1, commissionPercent: 15, commissionFlatCentavos: null })
  assert.equal(result.kind, 'rate15')
  assert.equal(result.commissionCentavos, 22500)
})

test('footspa pays the fixed amount per service', () => {
  const result = lineCommission({ subtotalCentavos: 49900, quantity: 2, commissionPercent: 0, commissionFlatCentavos: 10000 })
  assert.equal(result.kind, 'flat')
  assert.equal(result.commissionCentavos, 20000)
})

test('an add-on mask pays 10 pesos each', () => {
  const result = lineCommission({ subtotalCentavos: 10000, quantity: 3, commissionPercent: 0, commissionFlatCentavos: 1000 })
  assert.equal(result.commissionCentavos, 3000)
})
