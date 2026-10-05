const { AppError } = require('../lib/errors')

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details || [] },
    })
  }
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with that value already exists.', details: [] },
    })
  }
  console.error(err)
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong. Try again.', details: [] },
  })
}

module.exports = { errorHandler }
