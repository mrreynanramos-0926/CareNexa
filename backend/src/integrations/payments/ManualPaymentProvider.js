class ManualPaymentProvider {
  async createPayment(input) {
    return {
      status: 'PAID',
      mode: 'manual',
      provider: 'manual',
      amountCentavos: input.amountCentavos,
      methodCode: input.methodCode,
    }
  }

  async verifyPayment() {
    return { status: 'PAID', verified: false, mode: 'manual' }
  }

  async getPaymentStatus(record) {
    return record?.paymentStatus || 'PENDING'
  }

  async refundPayment() {
    return { status: 'REFUNDED', mode: 'manual' }
  }
}

function providerFor() {
  return new ManualPaymentProvider()
}

module.exports = { ManualPaymentProvider, providerFor }
