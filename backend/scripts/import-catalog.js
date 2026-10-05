require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { importClinicCatalog } = require('../src/modules/pricing/importCatalog')

const prisma = new PrismaClient()
importClinicCatalog(prisma)
  .then((count) => {
    console.log(`imported ${count}`)
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
