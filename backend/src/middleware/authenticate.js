const jwt = require('jsonwebtoken')
const { prisma } = require('../lib/prisma')
const { AppError } = require('../lib/errors')

async function authenticate(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.'))
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    })
    if (!user || user.status !== 'active') {
      return next(new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.'))
    }
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      mustChangePassword: user.mustChangePassword,
    }
    const requestPath = (req.originalUrl || req.path).split('?')[0]
    const allowedWhileReset = ['/api/auth/me', '/api/auth/logout', '/api/auth/change-password']
    if (user.mustChangePassword && !allowedWhileReset.includes(requestPath)) {
      return next(new AppError(403, 'FORBIDDEN', 'Change your password before continuing.'))
    }
    return next()
  } catch {
    return next(new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.'))
  }
}

module.exports = { authenticate }
