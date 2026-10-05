const { prisma } = require('../../lib/prisma')
const { AppError } = require('../../lib/errors')
const { writeAudit } = require('../../lib/audit')

const PROFILE_ID = 'default'

const DEFAULT_PROFILE = {
  legalName: 'Executive Facial Care',
  tradeName: 'The Executive Facial Care',
  businessType: 'Sole proprietorship',
  tin: '',
  addressLine1: 'Jaka Plaza',
  barangay: 'Sucat',
  city: 'Parañaque',
  province: 'Metro Manila',
  postalCode: '',
  country: 'Philippines',
  phone: '0942-052-7720',
  email: '',
  website: '',
  hours: 'Daily, 10:00 AM – 8:00 PM',
  receiptFooter: '',
}

const BUSINESS_TYPES = ['Sole proprietorship', 'Partnership', 'Corporation', 'Cooperative']

function present(row) {
  return {
    legalName: row.legalName,
    tradeName: row.tradeName,
    businessType: row.businessType,
    tin: row.tin,
    addressLine1: row.addressLine1,
    barangay: row.barangay,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
    country: row.country,
    phone: row.phone,
    email: row.email,
    website: row.website,
    hours: row.hours,
    receiptFooter: row.receiptFooter,
    updatedAt: row.updatedAt,
  }
}

async function ensureProfile(db = prisma) {
  return db.businessProfile.upsert({
    where: { id: PROFILE_ID },
    update: {},
    create: { id: PROFILE_ID, ...DEFAULT_PROFILE },
  })
}

async function getProfile() {
  return present(await ensureProfile())
}

function clean(value, max) {
  return String(value ?? '').trim().slice(0, max)
}

async function updateProfile(input, user) {
  const legalName = clean(input.legalName, 120)
  const tradeName = clean(input.tradeName, 120)
  if (!legalName) throw new AppError(400, 'VALIDATION_ERROR', 'Enter the business name.')
  if (!tradeName) throw new AppError(400, 'VALIDATION_ERROR', 'Enter the name shown to customers.')
  if (!BUSINESS_TYPES.includes(input.businessType)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Choose a business type.')
  }
  const tin = clean(input.tin, 20)
  if (tin && !/^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/.test(tin)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a TIN as 000-000-000 or leave it blank.')
  }
  const email = clean(input.email, 120)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid email or leave it blank.')
  }
  const existing = await ensureProfile()
  const data = {
    legalName,
    tradeName,
    businessType: input.businessType,
    tin,
    addressLine1: clean(input.addressLine1, 160),
    barangay: clean(input.barangay, 80),
    city: clean(input.city, 80),
    province: clean(input.province, 80),
    postalCode: clean(input.postalCode, 12),
    country: clean(input.country, 60) || 'Philippines',
    phone: clean(input.phone, 40),
    email,
    website: clean(input.website, 160),
    hours: clean(input.hours, 160),
    receiptFooter: clean(input.receiptFooter, 240),
  }
  const saved = await prisma.businessProfile.update({ where: { id: PROFILE_ID }, data })
  await writeAudit(prisma, {
    userId: user?.id,
    action: 'update',
    entity: 'business_profile',
    entityId: PROFILE_ID,
    oldValue: { legalName: existing.legalName, tradeName: existing.tradeName },
    newValue: { legalName: saved.legalName, tradeName: saved.tradeName },
  })
  return present(saved)
}

module.exports = { BUSINESS_TYPES, DEFAULT_PROFILE, ensureProfile, getProfile, updateProfile }
