const { AppError } = require('./errors')

function assertPasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Password must be at least 10 characters and include a letter and a number.')
  }
}

module.exports = { assertPasswordPolicy }
