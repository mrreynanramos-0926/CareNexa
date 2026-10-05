const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const fs = require('fs')
const path = require('path')
const yaml = require('yaml')
const swaggerUi = require('swagger-ui-express')
const { errorHandler } = require('./middleware/errorHandler')
const { mount } = require('./routes')

function createApp() {
  const app = express()
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
  app.use(express.json({ limit: '1mb' }))
  const specPath = path.join(__dirname, '..', 'openapi.yaml')
  if (fs.existsSync(specPath)) {
    const spec = yaml.parse(fs.readFileSync(specPath, 'utf8'))
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec))
  }
  mount(app)
  app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.', details: [] } })
  })
  app.use(errorHandler)
  return app
}

module.exports = { createApp }
