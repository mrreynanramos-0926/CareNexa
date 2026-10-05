const catalog = require('./clinic-catalog.json')
const { toCentavos } = require('../../lib/money')

async function importClinicCatalog(client) {
  let saved = 0
  for (const item of catalog) {
    const data = {
      name: item.name,
      type: item.type,
      description: item.description,
      priceCentavos: toCentavos(item.price),
      cashPriceCentavos: item.cashPrice ? toCentavos(item.cashPrice) : null,
      commissionPercent: item.commissionPercent || 0,
      commissionFlatCentavos: item.commissionFlat ? toCentavos(item.commissionFlat) : null,
      tracksInventory: false,
      status: 'active',
    }
    const existing = await client.productService.findFirst({ where: { name: item.name, type: item.type } })
    if (existing) await client.productService.update({ where: { id: existing.id }, data })
    else await client.productService.create({ data })
    saved += 1
  }
  const sampleOnly = [
    'Signature Facial',
    'Deep Cleansing Facial',
    'Acne Clear Facial',
    'Brightening Facial',
    'Hydra Glow Facial',
    'Facial Kit',
    'Sunscreen SPF 50',
    'Gentle Cleanser',
    'Sheet Mask Set',
    'Vitamin C Cream',
    'Hydrating Serum',
  ]
  await client.productService.updateMany({
    where: { name: { in: sampleOnly } },
    data: { status: 'inactive' },
  })
  return saved
}

module.exports = { importClinicCatalog }
