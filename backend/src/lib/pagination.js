const { AppError } = require('./errors')

function pageParams(query) {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1)
  const pageSize = Number.parseInt(query.pageSize || '25', 10) || 25
  if (pageSize < 1 || pageSize > 500) {
    throw new AppError(400, 'VALIDATION_ERROR', 'pageSize must be between 1 and 500.')
  }
  return { page, pageSize, skip: (page - 1) * pageSize }
}

function listResponse(data, page, pageSize, total) {
  return { data, page, pageSize, total }
}

module.exports = { pageParams, listResponse }
