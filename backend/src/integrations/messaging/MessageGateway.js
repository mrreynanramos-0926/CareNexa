async function deliver(message) {
  if (!message || !String(message).trim()) {
    return { status: 'failed', providerMessageId: null }
  }
  return { status: 'sent', providerMessageId: `mock-${Date.now()}-${Math.round(Math.random() * 1000)}` }
}

module.exports = { deliver }
