function compare(left, operator, right) {
  if (left == null || Number.isNaN(left)) return false
  if (operator === 'gte') return left >= right
  if (operator === 'lte') return left <= right
  if (operator === 'eq') return left === right
  return false
}

function evaluateCriteria(criteria, context) {
  if (!criteria || !Array.isArray(criteria.rules) || criteria.rules.length === 0) return false
  const results = criteria.rules.map((rule) => {
    const left = rule.field === 'visit_count_in_days'
      ? context.visitsWithin(rule.windowDays || 0)
      : context[rule.field]
    return compare(left, rule.op, Number(rule.value))
  })
  return criteria.match === 'any' ? results.some(Boolean) : results.every(Boolean)
}

module.exports = { evaluateCriteria }
