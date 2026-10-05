const { AppError } = require('../lib/errors')
const { RANK } = require('../modules/access/catalog')
const { grantsFor } = require('../modules/access/service')

function permit(moduleKey, level) {
  return async (req, res, next) => {
    try {
      const grants = await grantsFor(req.user?.role)
      const current = grants[moduleKey] || 'none'
      if ((RANK[current] || 0) < (RANK[level] || 1)) {
        return next(new AppError(403, 'FORBIDDEN', 'You do not have access to this action.'))
      }
      return next()
    } catch (error) {
      return next(error)
    }
  }
}

module.exports = { permit }
