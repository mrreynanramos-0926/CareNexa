class AppError extends Error {
  constructor(status, code, message, details = []) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

function badRequest(message, details = []) {
  return new AppError(400, 'VALIDATION_ERROR', message, details)
}

module.exports = { AppError, badRequest }
