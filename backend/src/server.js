require('dotenv').config()
const { createApp } = require('./app')

const port = Number(process.env.API_PORT || 4000)
createApp().listen(port, () => {
  console.log(`CareNexa API listening on ${port}`)
})
