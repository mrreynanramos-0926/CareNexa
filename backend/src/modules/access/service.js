const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')
const { LEVELS, MODULES, DEFAULTS } = require('./catalog')

const BUILT_IN = ['ADMIN', 'MANAGER', 'STAFF']

async function roleNames(db = prisma) {
  const rows = await db.role.findMany({ select: { name: true } })
  const names = rows.map((row) => row.name)
  const first = BUILT_IN.filter((name) => names.includes(name))
  const rest = names.filter((name) => !first.includes(name)).sort((left, right) => left.localeCompare(right))
  return [...first, ...rest]
}

function emptyGrants(roles) {
  const grants = {}
  for (const role of roles) {
    grants[role] = Object.fromEntries(MODULES.map((item) => [item.key, DEFAULTS[role]?.[item.key] || 'none']))
  }
  return grants
}

function applyRows(grants, rows) {
  for (const row of rows) {
    if (grants[row.role] && Object.prototype.hasOwnProperty.call(grants[row.role], row.module)) {
      grants[row.role][row.module] = row.access
    }
  }
  if (grants.ADMIN) grants.ADMIN.access = 'manage'
  return grants
}

async function ensureAccess(db = prisma) {
  for (const role of ROLES) {
    for (const item of MODULES) {
      await db.roleModuleAccess.upsert({
        where: { role_module: { role, module: item.key } },
        update: {},
        create: { role, module: item.key, access: DEFAULTS[role][item.key] },
      })
    }
  }
}

async function matrix() {
  const [roles, rows] = await Promise.all([
    roleNames(),
    prisma.roleModuleAccess.findMany(),
  ])
  return {
    roles,
    levels: LEVELS,
    modules: MODULES,
    grants: applyRows(emptyGrants(roles), rows),
  }
}

async function listRoles() {
  const roles = await roleNames()
  const rows = await prisma.role.findMany()
  const descriptions = Object.fromEntries(rows.map((row) => [row.name, row.description || '']))
  return roles.map((name) => ({ name, description: descriptions[name] || '' }))
}

function cleanRoleName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ').toUpperCase()
  if (!/^[A-Z][A-Z0-9 ]{1,39}$/.test(name)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a role name using letters, numbers, and spaces.')
  }
  return name
}

async function createRole(input, user) {
  const name = cleanRoleName(input?.name)
  const description = String(input?.description || '').trim().slice(0, 160)
  const existing = await prisma.role.findUnique({ where: { name } })
  if (existing) throw new AppError(400, 'VALIDATION_ERROR', 'That role already exists.')
  await prisma.$transaction([
    prisma.role.create({ data: { name, description } }),
    ...MODULES.map((item) => prisma.roleModuleAccess.create({
      data: { role: name, module: item.key, access: 'none' },
    })),
  ])
  await writeAudit(prisma, {
    userId: user?.id,
    action: 'create',
    entity: 'role',
    entityId: name,
    newValue: { name, description },
  })
  return matrix()
}

async function grantsFor(role) {
  const current = await matrix()
  return current.grants[role] || Object.fromEntries(MODULES.map((item) => [item.key, 'none']))
}

async function updateMatrix(input, user) {
  const grants = Array.isArray(input?.grants) ? input.grants : null
  if (!grants) throw new AppError(400, 'VALIDATION_ERROR', 'Send the access list for each role and module.')
  const roles = await roleNames()
  const known = new Set(MODULES.map((item) => item.key))
  const next = emptyGrants(roles)
  for (const grant of grants) {
    if (!roles.includes(grant.role) || !known.has(grant.module) || !LEVELS.includes(grant.access)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Each access entry needs a role, a module, and a level of none, view, or manage.')
    }
    next[grant.role][grant.module] = grant.access
  }
  if (next.ADMIN.access !== 'manage') {
    throw new AppError(400, 'VALIDATION_ERROR', 'An admin must keep Manage on Access.')
  }
  const before = await matrix()
  await prisma.$transaction(roles.flatMap((role) => MODULES.map((item) => prisma.roleModuleAccess.upsert({
    where: { role_module: { role, module: item.key } },
    update: { access: next[role][item.key] },
    create: { role, module: item.key, access: next[role][item.key] },
  }))))
  await writeAudit(prisma, {
    userId: user?.id,
    action: 'update',
    entity: 'role_module_access',
    entityId: 'matrix',
    oldValue: before.grants,
    newValue: next,
  })
  return matrix()
}

module.exports = { ensureAccess, matrix, listRoles, createRole, grantsFor, updateMatrix }
