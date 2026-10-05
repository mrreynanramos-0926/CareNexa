const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')
const { assertPasswordPolicy } = require('../../lib/passwords')

const GENERIC = 'Email or password is incorrect.'

function cost() {
  return Number(process.env.BCRYPT_COST || 12)
}

function presentUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
  }
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role.name }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  })
}

async function login(email, password) {
  const normalized = String(email || '').trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email: normalized }, include: { role: true } })
  const matches = user ? await bcrypt.compare(String(password || ''), user.passwordHash) : false
  if (!user || user.status !== 'active' || !matches) {
    await writeAudit(prisma, {
      userId: user && user.status === 'active' ? user.id : null,
      action: 'login',
      entity: 'user',
      entityId: user?.id || normalized,
      newValue: { result: 'failed' },
    })
    throw new AppError(401, 'UNAUTHORIZED', GENERIC)
  }
  await writeAudit(prisma, {
    userId: user.id,
    action: 'login',
    entity: 'user',
    entityId: user.id,
    newValue: { result: 'success' },
  })
  return { token: signToken(user), user: presentUser(user) }
}

async function logout(user) {
  await writeAudit(prisma, {
    userId: user.id,
    action: 'logout',
    entity: 'user',
    entityId: user.id,
    newValue: { result: 'logout' },
  })
}

async function changePasswordByEmail(email, currentPassword, newPassword) {
  const normalized = String(email || '').trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email: normalized } })
  const matches = user && user.status === 'active' ? await bcrypt.compare(String(currentPassword || ''), user.passwordHash) : false
  if (!user || user.status !== 'active' || !matches) throw new AppError(401, 'UNAUTHORIZED', GENERIC)
  await changePassword(user.id, currentPassword, newPassword)
}

async function changePassword(userId, currentPassword, newPassword) {
  assertPasswordPolicy(newPassword)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const matches = await bcrypt.compare(String(currentPassword || ''), user.passwordHash)
  if (!matches) throw new AppError(401, 'UNAUTHORIZED', 'Current password is incorrect.')
  const passwordHash = await bcrypt.hash(newPassword, cost())
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  })
  await writeAudit(prisma, {
    userId,
    action: 'update',
    entity: 'user',
    entityId: userId,
    newValue: { passwordChanged: true },
  })
}

async function hashPassword(password) {
  assertPasswordPolicy(password)
  return bcrypt.hash(password, cost())
}

module.exports = { login, logout, changePassword, changePasswordByEmail, presentUser, hashPassword }
