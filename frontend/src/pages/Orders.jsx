import { useEffect, useRef, useState } from 'react'
import { api, peso, when } from '../api'
import { Badge, ErrorText, Modal, Page, SearchSelect } from '../components'
import { useSession } from '../session'
import { PaymentSection, Receipt } from './PaymentSection'

export function OrdersPage() {
  const { can } = useSession()
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState(null)
  const manager = can('orders', 'manage')

  function load() {
    api('/api/orders?pageSize=25').then((result) => setRows(result.data)).catch(setError)
  }
  useEffect(() => { load() }, [])

  return (
    <Page title="Orders" lede="Net total = services + medicines + PPE + gift certificate − discount + tip. Record payments until the balance due is zero." action={manager ? <button type="button" onClick={() => setOpen(true)}>New order</button> : null}>
      <ErrorText error={error} />
      <div className="panel">
        <table>
          <thead><tr><th>Date</th><th>Customer</th><th>Medicine</th><th>Service</th><th>Status</th><th className="right">Total</th><th></th></tr></thead>
          <tbody>
            {rows.map((order) => (
              <tr key={order.id}>
                <td>{when(order.orderDate)}</td>
                <td>{order.customerName}</td>
                <td>{lineSummary(order.items, 'product')}</td>
                <td>{lineSummary(order.items, 'service')}</td>
                <td><Badge value={order.status} /> {order.paymentStatus && order.paymentStatus !== 'PENDING' ? <Badge value={order.paymentStatus} /> : null}</td>
                <td className="right">{peso(order.total)}</td>
                <td className="row-actions">
                  <button className="secondary" type="button" onClick={async () => {
                    try { setReceipt((await api(`/api/orders/${order.id}`)).data) } catch (err) { setError(err) }
                  }}>Receipt</button>
                  {manager && order.status === 'completed' ? <button className="secondary" type="button" onClick={async () => {
                  const reason = window.prompt('Reason for voiding this order')
                  if (!reason) return
                  await api(`/api/orders/${order.id}/void`, { method: 'POST', body: { reason } })
                  load()
                }}>Void</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? <OrderForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load() }} /> : null}
      {receipt ? <Modal title="Receipt" onClose={() => setReceipt(null)}><Receipt order={receipt} onClose={() => setReceipt(null)} /></Modal> : null}
    </Page>
  )
}

function lineSummary(items, type) {
  const rows = (items || []).filter((item) => item.type === type)
  if (rows.length === 0) return '—'
  return rows.map((item) => `${item.name} × ${item.quantity}${item.dermtechName ? ` · ${item.dermtechName}` : ''}`).join(', ')
}

function OrderForm({ onClose, onSaved }) {
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [lines, setLines] = useState([])
  const [dermtechs, setDermtechs] = useState([])
  const [discount, setDiscount] = useState('')
  const [ppe, setPpe] = useState('')
  const [gc, setGc] = useState('')
  const [tip, setTip] = useState('')
  const [error, setError] = useState(null)
  const summaryRef = useRef({ entries: [], summary: { balanceDue: 0, error: null } })
  useEffect(() => {
    api('/api/customers?pageSize=100').then((result) => setCustomers(result.data))
    api('/api/products?pageSize=500').then((result) => setProducts(result.data.filter((item) => item.status === 'active')))
    api('/api/dermtechs?status=active').then((result) => setDermtechs(result.data))
  }, [])

  const medicines = products.filter((item) => item.type === 'product')
  const services = products.filter((item) => item.type === 'service')

  function amountOf(type) {
    return lines.reduce((sum, line) => {
      const item = products.find((product) => product.id === line.productId)
      if (item?.type !== type) return sum
      return sum + unitOf(item, line.priceRate) * line.quantity
    }, 0)
  }
  const serviceAmount = amountOf('service')
  const medicineAmount = amountOf('product')
  const ppeValue = Number(ppe || 0)
  const gcValue = Number(gc || 0)
  const discountValue = Number(discount || 0)
  const tipValue = Number(tip || 0)
  const subtotal = serviceAmount + medicineAmount + (Number.isFinite(ppeValue) ? ppeValue : 0) + (Number.isFinite(gcValue) ? gcValue : 0)
  const net = subtotal - (Number.isFinite(discountValue) ? discountValue : 0) + (Number.isFinite(tipValue) ? tipValue : 0)
  const commission = lines.reduce((sum, line) => {
    const item = products.find((product) => product.id === line.productId)
    return sum + unitOf(item, line.priceRate) * line.quantity * ((item?.commissionPercent || 0) / 100)
  }, 0)

  function addLine(productId, quantity, priceRate, dermtechId) {
    if (!productId) return
    if (!dermtechId) {
      setError(new Error('Choose a dermtech for this item.'))
      return
    }
    const amount = Math.max(1, Number(quantity) || 1)
    const rate = priceRate || 'regular'
    setError(null)
    setLines((current) => {
      const existing = current.find((line) => line.productId === productId && line.priceRate === rate && line.dermtechId === dermtechId)
      if (existing) {
        return current.map((line) => (line.productId === productId && line.priceRate === rate && line.dermtechId === dermtechId ? { ...line, quantity: line.quantity + amount } : line))
      }
      return [...current, { productId, quantity: amount, priceRate: rate, dermtechId }]
    })
  }

  return (
    <Modal className="modal-wide" title="New order" onClose={onClose}>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault()
        if (lines.length === 0) {
          setError(new Error('Add at least one medicine or service.'))
          return
        }
        const payment = summaryRef.current
        if (payment.summary?.error) {
          setError(new Error(payment.summary.error))
          return
        }
        if ((payment.summary?.balanceDue || 0) > 0) {
          setError(new Error(`Payment is incomplete. Remaining balance: ${peso(payment.summary.balanceDue / 100)}`))
          return
        }
        try {
          await api('/api/orders', {
            method: 'POST',
            body: {
              customerId,
              discount: discount || undefined,
              ppe: ppe || undefined,
              gc: gc || undefined,
              tip: tip || undefined,
              payments: (payment.entries || []).map((entry) => ({
                paymentMethodId: entry.paymentMethodId,
                amount: entry.amount,
                referenceNumber: entry.referenceNumber || undefined,
                authorizationCode: entry.authorizationCode || undefined,
                cardLastFour: entry.cardLastFour || undefined,
                notes: entry.notes || undefined,
              })),
              lines: lines.map((line) => ({ productId: line.productId, quantity: line.quantity, priceRate: line.priceRate, dermtechId: line.dermtechId })),
            },
          })
          onSaved()
        } catch (err) { setError(err) }
      }}>
        <label>Customer
          <SearchSelect
            required
            value={customerId}
            placeholder="Type a customer name"
            onChange={setCustomerId}
            options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
          />
        </label>
        <LinePicker
          title="Service"
          hint="Choose the service, the price rate, and who performed it."
          rates={SERVICE_RATES}
          options={services}
          lines={lines}
          products={products}
          dermtechs={dermtechs}
          onAdd={addLine}
          onQuantity={(productId, priceRate, dermtechId, quantity) => setLines((current) => current.map((line) => (line.productId === productId && line.priceRate === priceRate && line.dermtechId === dermtechId ? { ...line, quantity } : line)))}
          onRemove={(productId, priceRate, dermtechId) => setLines((current) => current.filter((line) => !(line.productId === productId && line.priceRate === priceRate && line.dermtechId === dermtechId)))}
        />
        <LinePicker
          title="Medicine"
          hint="Choose the medicine, the price rate, and who sold it."
          rates={MEDICINE_RATES}
          options={medicines}
          lines={lines}
          products={products}
          dermtechs={dermtechs}
          onAdd={addLine}
          onQuantity={(productId, priceRate, dermtechId, quantity) => setLines((current) => current.map((line) => (line.productId === productId && line.priceRate === priceRate && line.dermtechId === dermtechId ? { ...line, quantity } : line)))}
          onRemove={(productId, priceRate, dermtechId) => setLines((current) => current.filter((line) => !(line.productId === productId && line.priceRate === priceRate && line.dermtechId === dermtechId)))}
        />
        <div className="pay-grid">
          <label>PPE<input value={ppe} onChange={(event) => setPpe(event.target.value)} placeholder="0.00" /></label>
          <label>Gift certificate<input value={gc} onChange={(event) => setGc(event.target.value)} placeholder="0.00" /></label>
          <label>Discount<input value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0.00" /></label>
          <label>Tip<input value={tip} onChange={(event) => setTip(event.target.value)} placeholder="0.00" /></label>
        </div>
        <PaymentSection net={net} subtotal={subtotal} discount={discountValue || 0} tip={tipValue || 0} summaryRef={summaryRef} />
        <p className="muted">Services {peso(serviceAmount)} · Medicines {peso(medicineAmount)} · Commission {peso(commission)}</p>
        <ErrorText error={error} />
        <button type="submit">Complete order</button>
      </form>
    </Modal>
  )
}

const SERVICE_RATES = [
  { value: 'regular', label: 'Regular' },
  { value: 'gc_cash', label: 'GC cash 50%' },
  { value: 'gc_card', label: 'GC card 55%' },
]
const MEDICINE_RATES = [
  { value: 'regular', label: 'List' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card 5% off' },
]
function unitOf(item, rate) {
  const quoted = item?.rates?.[rate || 'regular']
  return Number(quoted ?? item?.price ?? 0)
}

function commissionOf(item, rate, quantity) {
  if (item?.commissionFlat != null) return Number(item.commissionFlat) * quantity
  return unitOf(item, rate) * quantity * ((item?.commissionPercent || 0) / 100)
}

function LinePicker({ title, hint, rates, options, lines, products, dermtechs, onAdd, onQuantity, onRemove }) {
  const [productId, setProductId] = useState('')
  const [priceRate, setPriceRate] = useState(rates[0].value)
  const [dermtechId, setDermtechId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const chosen = lines.filter((line) => options.some((option) => option.id === line.productId))
  function addCurrent(event) {
    event.preventDefault()
    onAdd(productId, quantity, priceRate, dermtechId)
    setProductId('')
    setQuantity(1)
  }
  return (
    <section className="line-group">
      <h3>{title}</h3>
      <p className="muted">{hint}</p>
      <div className="line-add">
        <label>Item
          <SearchSelect
            value={productId}
            placeholder={`Type a ${title.toLowerCase()} name`}
            onChange={setProductId}
            options={options.map((item) => ({
              value: item.id,
              label: `${item.name} · ${peso(unitOf(item, priceRate))}${item.tracksInventory ? ` · ${item.stock} on hand` : ''}`,
            }))}
          />
        </label>
        <div className="line-add-row">
          <label>Rate
            <SearchSelect value={priceRate} onChange={setPriceRate} options={rates} />
          </label>
          <label>Dermtech
            <SearchSelect value={dermtechId} placeholder="Type a dermtech" onChange={setDermtechId} options={dermtechs.map((person) => ({ value: person.id, label: person.name }))} />
          </label>
          <label>Qty
            <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addCurrent(event) }} />
          </label>
          <button type="button" onClick={addCurrent}>Add</button>
        </div>
      </div>
      {chosen.length === 0 ? <p className="muted">Nothing added yet.</p> : (
        <ul className="line-cards">
          {chosen.map((line) => {
            const item = products.find((product) => product.id === line.productId)
            const rateLabel = rates.find((rate) => rate.value === line.priceRate)?.label || line.priceRate
            const person = dermtechs.find((row) => row.id === line.dermtechId)
            return (
              <li key={`${line.productId}-${line.priceRate}-${line.dermtechId}`} className="line-card">
                <div className="line-card-main">
                  <strong>{item?.name}</strong>
                  <span className="muted">{person?.name || 'No dermtech'} · {rateLabel}</span>
                </div>
                <div className="line-card-money">
                  <span>Amount <strong>{peso(unitOf(item, line.priceRate) * line.quantity)}</strong></span>
                  <span>Commission <strong>{peso(commissionOf(item, line.priceRate, line.quantity))}</strong></span>
                </div>
                <label>Qty
                  <input type="number" min="1" value={line.quantity} onChange={(event) => onQuantity(line.productId, line.priceRate, line.dermtechId, Math.max(1, Number(event.target.value) || 1))} />
                </label>
                <button className="secondary" type="button" onClick={() => onRemove(line.productId, line.priceRate, line.dermtechId)}>Remove</button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
