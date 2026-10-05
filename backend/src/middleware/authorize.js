const { AppError } = require('../lib/errors')

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have access to this action.'))
    }
    return next()
  }
}

module.exports = { authorize }
