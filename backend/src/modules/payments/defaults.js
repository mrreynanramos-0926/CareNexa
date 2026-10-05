const DEFAULT_METHODS = [
  ['Cash', 'CASH', 'Cash', 'CASH', 1, true],
  ['GCash', 'EWALLET', 'GCash', 'GCASH', 2, false],
  ['Maya', 'EWALLET', 'Maya', 'MAYA', 3, false],
  ['GCash QR', 'QR', 'GCash', 'GCASH_QR', 4, false],
  ['Maya QR', 'QR', 'Maya', 'MAYA_QR', 5, false],
  ['Other QR', 'QR', 'Other', 'OTHER_QR', 6, false],
  ['Visa', 'CARD', 'Visa', 'VISA', 7, false],
  ['Mastercard', 'CARD', 'Mastercard', 'MASTERCARD', 8, false],
  ['American Express', 'CARD', 'American Express', 'AMEX', 9, false],
  ['JCB', 'CARD', 'JCB', 'JCB', 10, false],
  ['Other Card', 'CARD', 'Other', 'OTHER_CARD', 11, false],
]

async function ensurePaymentMethods(db) {
  for (const [name, category, provider, code, displayOrder, allowsChange] of DEFAULT_METHODS) {
    await db.paymentMethod.upsert({
      where: { code },
      update: {},
      create: {
        name,
        category,
        provider,
        code,
        description: '',
        isActive: true,
        displayOrder,
        allowsChange,
        requiresReference: false,
      },
    })
  }
}

module.exports = { DEFAULT_METHODS, ensurePaymentMethods }
