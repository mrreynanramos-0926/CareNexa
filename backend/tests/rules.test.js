const test = require('node:test')
const assert = require('node:assert/strict')
const { evaluateCriteria } = require('../src/modules/segments/rules')

test('segment rules match all and any', () => {
  const context = {
    total_spent_centavos: 1000,
    visit_count: 2,
    days_since_last_visit: 40,
    visitsWithin(days) { return days >= 30 ? 4 : 1 },
  }
  assert.equal(evaluateCriteria({
    match: 'all',
    rules: [{ field: 'days_since_last_visit', op: 'gte', value: 30 }],
  }, context), true)
  assert.equal(evaluateCriteria({
    match: 'any',
    rules: [
      { field: 'total_spent_centavos', op: 'gte', value: 5000000 },
      { field: 'visit_count_in_days', op: 'gte', value: 3, windowDays: 30 },
    ],
  }, context), true)
  assert.equal(evaluateCriteria({
    match: 'all',
    rules: [{ field: 'days_since_first_visit', op: 'lte', value: 30 }],
  }, context), false)
})
