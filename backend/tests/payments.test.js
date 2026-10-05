const test = require('node:test')
const assert = require('node:assert/strict')
const { applyPayments, incompleteMessage } = require('../src/modules/payments/summary')

function cash(amount) {
  return { amountCentavos: amount, category: 'CASH', allowsChange: true, status: 'PAID', name: 'Cash' }
}
function wallet(amount) {
  return { amountCentavos: amount, category: 'EWALLET', allowsChange: false, status: 'PAID', name: 'GCash' }
}
function card(amount) {
  return { amountCentavos: amount, category: 'CARD', allowsChange: false, status: 'PAID', name: 'Visa' }
}

test('exact cash payment settles with no change', () => {
  const result = applyPayments(100000, [cash(100000)])
  assert.equal(result.error, null)
  assert.equal(result.totalPaid, 100000)
  assert.equal(result.balanceDue, 0)
  assert.equal(result.change, 0)
  assert.equal(result.paymentStatus, 'PAID')
})

test('cash over the bill produces change', () => {
  const result = applyPayments(100000, [cash(120000)])
  assert.equal(result.totalPaid, 120000)
  assert.equal(result.balanceDue, 0)
  assert.equal(result.change, 20000)
  assert.equal(result.paymentStatus, 'PAID')
})

test('a short wallet payment leaves a balance', () => {
  const result = applyPayments(100000, [wallet(50000)])
  assert.equal(result.totalPaid, 50000)
  assert.equal(result.balanceDue, 50000)
  assert.equal(result.change, 0)
  assert.equal(result.paymentStatus, 'PARTIALLY_PAID')
})

test('cash and wallet can split a bill', () => {
  const result = applyPayments(100000, [cash(50000), wallet(50000)])
  assert.equal(result.error, null)
  assert.equal(result.totalPaid, 100000)
  assert.equal(result.balanceDue, 0)
  assert.equal(result.change, 0)
})

test('cash, wallet, and card can split a bill', () => {
  const result = applyPayments(100000, [cash(30000), wallet(30000), card(40000)])
  assert.equal(result.error, null)
  assert.equal(result.totalPaid, 100000)
  assert.equal(result.balanceDue, 0)
  assert.equal(result.change, 0)
})

test('a non-cash payment over the balance is rejected', () => {
  const result = applyPayments(100000, [wallet(120000)])
  assert.equal(result.error, 'Payment amount exceeds the remaining balance.')
})

test('incomplete payments name the remaining balance', () => {
  assert.match(incompleteMessage(150000), /Payment is incomplete\. Remaining balance: ₱1,500\.00/)
})
