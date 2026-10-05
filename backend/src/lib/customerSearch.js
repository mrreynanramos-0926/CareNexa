const { prisma } = require('./prisma')

function likeTerm(value) {
  return `%${String(value).replace(/[\\%_]/g, '\\$&')}%`
}

async function customerIdsMatching(search) {
  const term = likeTerm(search.trim())
  const rows = await prisma.$queryRaw`
    SELECT id FROM customers
    WHERE lower(first_name || ' ' || last_name) LIKE lower(${term}) ESCAPE '\\'
       OR lower(coalesce(phone, '')) LIKE lower(${term}) ESCAPE '\\'
       OR lower(coalesce(email, '')) LIKE lower(${term}) ESCAPE '\\'
  `
  return rows.map((row) => row.id)
}

module.exports = { customerIdsMatching }
