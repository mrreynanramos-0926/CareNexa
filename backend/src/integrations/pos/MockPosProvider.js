const customers = [
  { externalPosId: 'pos-cust-1', firstName: 'Liza', lastName: 'Bautista', phone: '09000000901', email: 'liza.bautista@example.com' },
  { externalPosId: 'pos-cust-2', firstName: 'Paolo', lastName: 'Garcia', phone: '09000000902', email: 'paolo.garcia@example.com' },
]

const inventory = [
  {
    externalPosId: 'pos-prod-1',
    name: 'POS Brow Gel',
    type: 'product',
    price: '450.00',
    stock: 18,
    reorderLevel: 6,
    reorderQuantity: 12,
    unitCost: '180.00',
  },
]

function transactions() {
  return [
    {
      externalPosId: 'pos-order-1',
      customerExternalId: 'pos-cust-1',
      orderDate: new Date().toISOString(),
      lines: [{ productExternalId: 'pos-prod-1', quantity: 1 }],
    },
  ]
}

module.exports = {
  async getCustomers() { return customers },
  async getTransactions() { return transactions() },
  async getInventory() { return inventory },
}
