require('dotenv').config()
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const { toCentavos } = require('../src/lib/money')
const { stockStatus } = require('../src/modules/inventory/service')
const { manilaParts, manilaDateString, addManilaDays } = require('../src/lib/dates')
const { ensureDefaults, syncNamedSegments } = require('../src/modules/settings/service')
const { createOrder, voidOrder } = require('../src/modules/orders/service')
const { rebuildMemberships } = require('../src/modules/segments/service')
const { evaluatePromotions } = require('../src/modules/promotions/service')
const { evaluateAll } = require('../src/modules/anomalies/service')
const { createCampaign, activateCampaign } = require('../src/modules/campaigns/service')

const prisma = new PrismaClient()

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Set ${name} in backend/.env before seeding.`)
  return value
}

function atManilaDaysAgo(days, hour = 11) {
  const day = addManilaDays(manilaDateString(), -days)
  return new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+08:00`)
}

async function wipe() {
  await prisma.roleModuleAccess.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.marketingMessage.deleteMany()
  await prisma.marketingCampaign.deleteMany()
  await prisma.triggerRule.deleteMany()
  await prisma.anomalyAlert.deleteMany()
  await prisma.inventoryMovement.deleteMany()
  await prisma.inventoryAlert.deleteMany()
  await prisma.orderPayment.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.customerLifetimeValue.deleteMany()
  await prisma.customerSegmentMembership.deleteMany()
  await prisma.activity.deleteMany()
  await prisma.inventory.deleteMany()
  await prisma.productService.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.systemSetting.deleteMany()
  await prisma.user.deleteMany()
  await prisma.role.deleteMany()
}

async function main() {
  const adminPassword = required('SEED_ADMIN_PASSWORD')
  const managerPassword = required('SEED_MANAGER_PASSWORD')
  const staffPassword = required('SEED_STAFF_PASSWORD')
  await wipe()
  const cost = Number(process.env.BCRYPT_COST || 12)
  const roles = {}
  for (const role of [
    ['ADMIN', 'Full system access'],
    ['MANAGER', 'Clinic operations, campaigns, and insights'],
    ['STAFF', 'Customers, activities, and orders'],
  ]) {
    roles[role[0]] = await prisma.role.create({ data: { name: role[0], description: role[1] } })
  }
  const users = [
    ['Amina Cruz', 'admin@carenexa.local', adminPassword, 'ADMIN'],
    ['Benicio Ramos', 'manager@carenexa.local', managerPassword, 'MANAGER'],
    ['Cora Villanueva', 'staff@carenexa.local', staffPassword, 'STAFF'],
  ]
  const actor = {}
  for (const [name, email, password, role] of users) {
    actor[role] = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, cost),
        roleId: roles[role].id,
        status: 'active',
      },
    })
  }
  await ensureDefaults()
  await syncNamedSegments(null)

  const aged = atManilaDaysAgo(90)
  async function addItem(data) {
    return prisma.productService.create({
      data: {
        name: data.name,
        type: data.type,
        description: data.description,
        priceCentavos: toCentavos(data.price),
        tracksInventory: data.tracks,
        status: 'active',
        createdAt: data.createdAt || aged,
        inventory: data.tracks
          ? {
              create: {
                currentStock: data.stock,
                reorderLevel: data.reorder,
                reorderQuantity: data.reorderQuantity || 10,
                unitCostCentavos: toCentavos(data.cost || '250.00'),
                status: stockStatus(data.stock, data.reorder),
                lastRestockDate: aged,
              },
            }
          : undefined,
      },
    })
  }

  const services = []
  for (const item of [
    ['Signature Facial', '1800.00', 'Classic cleanse, massage, and mask.'],
    ['Deep Cleansing Facial', '1500.00', 'Extraction and purifying mask.'],
    ['Acne Clear Facial', '2200.00', 'Treatment facial for breakout-prone skin.'],
    ['Brightening Facial', '2000.00', 'Vitamin treatment for dull skin.'],
    ['Anti-Aging Facial', '2800.00', 'Firming facial with targeted serum.'],
    ['Hydra Glow Facial', '2500.00', 'Hydration facial for dry skin.'],
  ]) {
    services.push(await addItem({ name: item[0], type: 'service', price: item[1], description: item[2], tracks: false }))
  }
  const kit = await addItem({ name: 'Facial Kit', type: 'product', price: '890.00', description: 'Home-care kit.', tracks: true, stock: 14, reorder: 8, reorderQuantity: 12, cost: '420.00' })
  const sunscreen = await addItem({ name: 'Sunscreen SPF 50', type: 'product', price: '650.00', description: 'Daily sunscreen.', tracks: true, stock: 9, reorder: 8, reorderQuantity: 12, cost: '280.00' })
  const cleanser = await addItem({ name: 'Gentle Cleanser', type: 'product', price: '480.00', description: 'Fragrance-free cleanser.', tracks: true, stock: 30, reorder: 8, reorderQuantity: 12, cost: '190.00' })
  const masks = await addItem({ name: 'Sheet Mask Set', type: 'product', price: '360.00', description: 'Set of five masks.', tracks: true, stock: 8, reorder: 3, reorderQuantity: 10, cost: '140.00' })
  const vitamin = await addItem({ name: 'Vitamin C Cream', type: 'product', price: '920.00', description: 'Night cream.', tracks: true, stock: 9, reorder: 4, reorderQuantity: 8, cost: '410.00' })
  await addItem({ name: 'Hydrating Serum', type: 'product', price: '1100.00', description: 'Serum for dry skin.', tracks: true, stock: 0, reorder: 5, reorderQuantity: 8, cost: '500.00' })

  const firstNames = ['Maria', 'Juan', 'Ana', 'Jose', 'Rosa', 'Carlo', 'Liza', 'Miguel', 'Sofia', 'Andres', 'Isabel', 'Rafael', 'Carmen', 'Diego', 'Lucia', 'Antonio', 'Elena', 'Gabriel', 'Patricia', 'Fernando', 'Bianca', 'Ricardo', 'Angela', 'Hector', 'Diana', 'Marco', 'Teresa', 'Luis', 'Joanna', 'Paolo', 'Cecilia', 'Ramon', 'Gloria', 'Emilio', 'Nadia', 'Victor']
  const lastNames = ['Santos', 'Dela Cruz', 'Reyes', 'Garcia', 'Gonzales', 'Torres', 'Ramos', 'Flores', 'Rivera', 'Gomez', 'Cruz', 'Mendoza', 'Castillo', 'Vargas', 'Aquino', 'Bautista', 'Domingo', 'Navarro', 'Santiago', 'Villanueva', 'Salazar', 'Pascual', 'Castro', 'Fernandez', 'Jimenez', 'Romero', 'Aguilar', 'Medina', 'Silva', 'Ortega', 'Del Rosario', 'Padilla', 'Gutierrez', 'Hernandez', 'Morales', 'Cabrera']
  const today = manilaParts()
  const month = String(today.month).padStart(2, '0')
  const day = String(today.day).padStart(2, '0')
  const customers = []
  for (let index = 0; index < firstNames.length; index += 1) {
    const birthday = index === 15 ? `${1988}-${month}-${day}` : `${1985 + (index % 15)}-${String((index % 12) + 1).padStart(2, '0')}-15`
    let createdAt = atManilaDaysAgo(index >= 30 ? 3 + (index % 5) : 140)
    if (index === 16) createdAt = new Date(`${today.year - 1}-${month}-${day}T02:00:00+08:00`)
    customers.push(await prisma.customer.create({
      data: {
        firstName: firstNames[index],
        lastName: lastNames[index],
        email: `${firstNames[index].toLowerCase()}.${lastNames[index].toLowerCase().replace(/\s+/g, '')}${index}@example.com`,
        phone: `0900000${String(index + 1).padStart(4, '0')}`,
        birthday: new Date(`${birthday}T00:00:00.000Z`),
        address: index % 2 === 0 ? 'Makati, Metro Manila' : 'Quezon City, Metro Manila',
        customerType: 'individual',
        status: 'active',
        smsConsent: true,
        emailConsent: true,
        createdAt,
      },
    }))
  }

  const staff = { id: actor.STAFF.id, role: 'STAFF' }
  async function sell(customer, days, lines, extra = {}) {
    return createOrder({
      customerId: customer.id,
      orderDate: atManilaDaysAgo(days, 10 + (days % 6)).toISOString(),
      lines,
      ...extra,
    }, staff)
  }

  for (const index of [0, 1, 2]) {
    await sell(customers[index], 8, [{ productId: services[4].id, quantity: 1, unitPrice: '22000.00' }])
    await sell(customers[index], 12, [{ productId: services[5].id, quantity: 1, unitPrice: '18000.00' }])
  }
  for (let index = 0; index < 10; index += 1) {
    for (let visit = 0; visit < 4; visit += 1) {
      const lines = [{ productId: services[(index + visit) % services.length].id, quantity: 1 }]
      if (index === 0 && visit === 0) lines[0] = { productId: services[0].id, quantity: 1, unitPrice: '16000.00' }
      if (index === 1 && visit === 0) {
        await sell(customers[index], 2 + visit, lines, { discount: '800.00' })
        continue
      }
      await sell(customers[index], 1 + visit * 3, lines)
    }
  }
  for (let index = 10; index < 15; index += 1) {
    await sell(customers[index], 45, [{ productId: services[index % services.length].id, quantity: 1 }])
  }
  for (let index = 15; index < customers.length; index += 1) {
    await sell(customers[index], index >= 30 ? 2 : 6, [{ productId: services[index % services.length].id, quantity: 1 }])
  }
  for (let dayOffset = 1; dayOffset <= 10; dayOffset += 1) {
    await sell(customers[dayOffset % 8], dayOffset, [{ productId: kit.id, quantity: 1 }])
  }
  for (const dayOffset of [4, 6, 9]) {
    await sell(customers[2], dayOffset, [{ productId: sunscreen.id, quantity: 1 }])
  }
  for (const dayOffset of [16, 18, 21, 24]) {
    await sell(customers[3], dayOffset, [{ productId: cleanser.id, quantity: 2 }])
  }
  for (const dayOffset of [3, 8]) {
    await sell(customers[4], dayOffset, [{ productId: cleanser.id, quantity: 1 }])
  }
  await sell(customers[5], 9, [{ productId: masks.id, quantity: 1 }])

  const voids = []
  for (let count = 0; count < 3; count += 1) {
    voids.push(await sell(customers[6], 1, [{ productId: services[1].id, quantity: 1 }]))
  }
  for (const order of voids) {
    await voidOrder(order.id, 'Duplicate ticket entered at the desk', { id: actor.MANAGER.id })
  }

  await prisma.activity.createMany({
    data: [
      { customerId: customers[0].id, userId: actor.STAFF.id, type: 'visit', notes: 'Preferred a lighter mask after the facial.', activityDate: atManilaDaysAgo(2) },
      { customerId: customers[15].id, userId: actor.STAFF.id, type: 'call', notes: 'Confirmed a birthday visit this week.', activityDate: atManilaDaysAgo(1) },
      { customerId: customers[12].id, userId: actor.MANAGER.id, type: 'follow_up', notes: 'Has not visited in more than a month.', activityDate: atManilaDaysAgo(3) },
    ],
  })

  await rebuildMemberships(actor.MANAGER)
  const vip = await prisma.customerSegment.findUnique({ where: { name: 'VIP' } })
  const inactive = await prisma.customerSegment.findUnique({ where: { name: 'Inactive' } })
  const todayText = manilaDateString()
  const campaign = await createCampaign({
    name: 'VIP glow week',
    type: 'promotional',
    channel: 'sms',
    targetSegmentId: vip.id,
    message: 'Hi {{first_name}}, VIP glow week is open at Executive Facial Care. Reply if you want a reserved slot.',
    startDate: addManilaDays(todayText, -2),
    endDate: addManilaDays(todayText, 20),
  }, actor.MANAGER)
  await activateCampaign(campaign.id, actor.MANAGER)
  await createCampaign({
    name: 'Win-back draft',
    type: 'win_back',
    channel: 'email',
    targetSegmentId: inactive.id,
    message: 'Hi {{first_name}}, we saved a facial credit for your next visit.',
    startDate: todayText,
    endDate: addManilaDays(todayText, 30),
  }, actor.MANAGER)

  const templates = [
    ['Birthday greeting', 'birthday', {}, 'Hi {{first_name}}, happy birthday from Executive Facial Care.'],
    ['Anniversary thank you', 'anniversary', {}, 'Hi {{first_name}}, thank you for another year with us.'],
    ['Inactive win-back', 'inactivity', { days: 30 }, 'Hi {{first_name}}, it has been a while. A return facial is ready when you are.'],
    ['Third-visit eligibility', 'purchase_count', { count: 3 }, 'Hi {{first_name}}, you are eligible for a loyalty reward. This does not apply a POS discount.'],
    ['New client welcome', 'new_customer', { days: 30 }, 'Hi {{first_name}}, welcome to Executive Facial Care.'],
    ['VIP thank you', 'vip', {}, 'Hi {{first_name}}, your VIP visits are appreciated.'],
  ]
  for (const [name, eventType, conditionValue, messageTemplate] of templates) {
    await prisma.triggerRule.create({
      data: { name, eventType, conditionValue, action: 'create_message', messageTemplate, channel: 'sms', isActive: true },
    })
  }
  await evaluatePromotions(actor.MANAGER)
  await evaluateAll()
  const { evaluateProduct } = require('../src/modules/inventory/service')
  const stocked = await prisma.inventory.findMany({ select: { productId: true } })
  for (const row of stocked) await evaluateProduct(row.productId)
  const { ensurePaymentMethods } = require('../src/modules/payments/defaults')
  await ensurePaymentMethods(prisma)
  const { ensureDermtechs } = require('../src/modules/dermtechs/service')
  await ensureDermtechs(prisma)
  const { ensureProfile } = require('../src/modules/business/service')
  await ensureProfile(prisma)
  const { ensureAccess } = require('../src/modules/access/service')
  await ensureAccess(prisma)
  const { importClinicCatalog } = require('../src/modules/pricing/importCatalog')
  const saved = await importClinicCatalog(prisma)
  console.log(`CareNexa demo data is ready. Clinic price list: ${saved} items.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
