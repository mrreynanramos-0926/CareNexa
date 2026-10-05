const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')
const { pageParams, listResponse } = require('../../lib/pagination')
const { hashPassword, presentUser } = require('../auth/service')

async function listUsers(query) {
  const { page, pageSize, skip } = pageParams(query)
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      include: { role: true },
      orderBy: { name: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.user.count(),
  ])
  return listResponse(rows.map(presentUser), page, pageSize, total)
}

async function createUser(input, actor) {
  const role = await prisma.role.findUnique({ where: { name: input.role } })
  if (!role) throw new AppError(400, 'VALIDATION_ERROR', 'Choose a valid role.')
  const passwordHash = await hashPassword(input.password)
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash,
      roleId: role.id,
      status: 'active',
      mustChangePassword: true,
    },
    include: { role: true },
  })
  await writeAudit(prisma, {
    userId: actor.id,
    action: 'create',
    entity: 'user',
    entityId: user.id,
    newValue: { name: user.name, email: user.email, role: role.name },
  })
  return presentUser(user)
}

async function updateUser(id, input, actor) {
  const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found.')
  const data = {}
  if (input.name) data.name = input.name.trim()
  if (input.status) {
    if (!['active', 'inactive', 'invited'].includes(input.status)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Status must be active, inactive, or invited.')
    }
    data.status = input.status
  }
  if (input.role) {
    const role = await prisma.role.findUnique({ where: { name: input.role } })
    if (!role) throw new AppError(400, 'VALIDATION_ERROR', 'Choose a valid role.')
    data.roleId = role.id
  }
  const user = await prisma.user.update({ where: { id }, data, include: { role: true } })
  await writeAudit(prisma, {
    userId: actor.id,
    action: 'update',
    entity: 'user',
    entityId: id,
    oldValue: { name: existing.name, status: existing.status, role: existing.role.name },
    newValue: { name: user.name, status: user.status, role: user.role.name },
  })
  return presentUser(user)
}

async function resetPassword(id, password, actor) {
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found.')
  const passwordHash = await hashPassword(password)
  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true, status: existing.status === 'invited' ? 'invited' : existing.status },
  })
  await writeAudit(prisma, {
    userId: actor.id,
    action: 'update',
    entity: 'user',
    entityId: id,
    newValue: { passwordReset: true },
  })
}

module.exports = { listUsers, createUser, updateUser, resetPassword }
