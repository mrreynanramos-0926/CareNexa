import { useEffect, useMemo, useState } from 'react'
import { api, peso } from '../api'
import { ErrorText } from '../components'

const CATEGORY_ORDER = ['CASH', 'EWALLET', 'QR', 'CARD']
const CATEGORY_LABELS = { CASH: 'Cash', EWALLET: 'E-Wallet', QR: 'QR', CARD: 'Card' }

function cents(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100)
}

function pesos(amount) {
  return peso(amount / 100)
}

export function summarizePayments(net, entries, methods) {
  const netCents = Math.max(0, cents(net))
  let remaining = netCents
  let change = 0
  let totalPaid = 0
  for (const entry of entries) {
    const method = methods.find((item) => item.id === entry.paymentMethodId)
    const amount = cents(entry.amount)
    const givesChange = method?.category === 'CASH' || method?.allowsChange
    if (!givesChange && amount > remaining) {
      return {
        error: 'Payment amount exceeds the remaining balance.',
        totalPaid,
        balanceDue: remaining,
        change,
        paymentStatus: totalPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING',
      }
    }
    if (givesChange && amount > remaining) {
      change += amount - remaining
      totalPaid += amount
      remaining = 0
    } else {
      totalPaid += amount
      remaining -= amount
    }
  }
  let paymentStatus = 'PENDING'
  if (remaining === 0 && (totalPaid > 0 || netCents === 0)) paymentStatus = 'PAID'
  else if (totalPaid > 0) paymentStatus = 'PARTIALLY_PAID'
  return { error: null, totalPaid, balanceDue: remaining, change, paymentStatus }
}

export function PaymentSection({ net, subtotal, discount, tip, summaryRef }) {
  const [methods, setMethods] = useState([])
  const [category, setCategory] = useState('CASH')
  const [methodId, setMethodId] = useState('')
  const [amount, setAmount] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [authorizationCode, setAuthorizationCode] = useState('')
  const [cardLastFour, setCardLastFour] = useState('')
  const [notes, setNotes] = useState('')
  const [entries, setEntries] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/api/payment-methods/active').then((result) => {
      setMethods(result.data)
      const first = result.data[0]
      if (first) {
        setCategory(first.category)
        setMethodId(first.id)
      }
    }).catch(setError)
  }, [])

  const summary = useMemo(() => summarizePayments(net, entries, methods), [net, entries, methods])
  summaryRef.current = { entries, summary }

  const visible = methods.filter((method) => method.category === category)
  const selected = methods.find((method) => method.id === methodId) || visible[0]
  const draftChange = selected && (selected.category === 'CASH' || selected.allowsChange)
    ? Math.max(0, cents(amount) - summary.balanceDue)
    : 0

  function chooseCategory(next) {
    setCategory(next)
    const first = methods.find((method) => method.category === next)
    setMethodId(first?.id || '')
    setError(null)
  }

  function addPayment() {
    if (!selected) return
    const value = cents(amount)
    if (value <= 0) {
      setError(new Error('Enter a payment amount.'))
      return
    }
    if (selected.requiresReference && !referenceNumber.trim()) {
      setError(new Error(`${selected.name} requires a reference number.`))
      return
    }
    if (selected.category === 'CARD' && cardLastFour && !/^\d{4}$/.test(cardLastFour.trim())) {
      setError(new Error('Enter only the last 4 digits. Full card numbers are not stored.'))
      return
    }
    const givesChange = selected.category === 'CASH' || selected.allowsChange
    if (!givesChange && value > summary.balanceDue) {
      setError(new Error('Payment amount exceeds the remaining balance.'))
      return
    }
    setEntries((current) => [...current, {
      key: `${selected.id}-${current.length}-${value}`,
      paymentMethodId: selected.id,
      name: selected.name,
      category: selected.category,
      amount: (value / 100).toFixed(2),
      referenceNumber: referenceNumber.trim(),
      authorizationCode: authorizationCode.trim(),
      cardLastFour: selected.category === 'CARD' ? cardLastFour.trim() : '',
      notes: notes.trim(),
    }])
    setAmount('')
    setReferenceNumber('')
    setAuthorizationCode('')
    setCardLastFour('')
    setNotes('')
    setError(null)
  }

  const categories = CATEGORY_ORDER.filter((item) => methods.some((method) => method.category === item))

  return (
    <section className="pay-section">
      <h3>Payment</h3>
      <div className="pay-summary">
        <h4>Payment summary</h4>
        <SummaryRow label="Bill total" value={pesos(cents(subtotal))} />
        <SummaryRow label="Discount" value={pesos(cents(discount))} />
        <SummaryRow label="Tip" value={pesos(cents(tip))} />
        <SummaryRow label="Net total" value={pesos(cents(net))} strong />
      </div>
      <div className="pay-tabs" role="tablist" aria-label="Payment category">
        {categories.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={item === category} className={item === category ? 'active' : ''} onClick={() => chooseCategory(item)}>
            <CategoryIcon category={item} />
            {CATEGORY_LABELS[item]}
          </button>
        ))}
      </div>
      <div className="pay-methods" role="radiogroup" aria-label={CATEGORY_LABELS[category] || 'Payment method'}>
        {visible.map((method) => (
          <label key={method.id} className={method.id === selected?.id ? 'selected' : ''}>
            <input type="radio" name="payment-method" checked={method.id === selected?.id} onChange={() => setMethodId(method.id)} />
            <CategoryIcon category={method.category} />
            <span>{method.name}</span>
          </label>
        ))}
      </div>
      {selected ? (
        <div className="pay-entry">
          <p className="muted">Payment method: {selected.name}</p>
          <label>Amount
            <input value={amount} onChange={(event) => setAmount(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); addPayment() }
            }} placeholder="0.00" inputMode="decimal" />
          </label>
          {selected.category === 'CASH' ? <p className="muted">Cash received {pesos(cents(amount))} · Change {pesos(draftChange)}</p> : null}
          {selected.category !== 'CASH' ? (
            <label>Reference number
              <input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder={selected.requiresReference ? 'Required' : 'Optional'} />
            </label>
          ) : null}
          {selected.category === 'CARD' ? (
            <>
              <label>Card last 4 digits
                <input value={cardLastFour} onChange={(event) => setCardLastFour(event.target.value)} placeholder="Optional" maxLength={4} inputMode="numeric" />
              </label>
              <label>Authorization code
                <input value={authorizationCode} onChange={(event) => setAuthorizationCode(event.target.value)} placeholder="Optional" />
              </label>
            </>
          ) : null}
          {selected.category === 'EWALLET' || selected.category === 'QR' ? (
            <label>Notes
              <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
            </label>
          ) : null}
          <button type="button" onClick={addPayment}>Add payment</button>
        </div>
      ) : null}
      <div className="pay-lines">
        <h4>Payments</h4>
        {entries.length === 0 ? <p className="muted">No payments yet.</p> : entries.map((entry) => (
          <div key={entry.key} className="pay-line">
            <span><CategoryIcon category={entry.category} /> {entry.name}{entry.cardLastFour ? ` ···· ${entry.cardLastFour}` : ''}</span>
            <span>{peso(entry.amount)}</span>
            <button type="button" className="secondary" onClick={() => setEntries((current) => current.filter((item) => item.key !== entry.key))}>Remove</button>
          </div>
        ))}
        <SummaryRow label="Total paid" value={pesos(summary.totalPaid)} />
        <SummaryRow label="Balance due" value={pesos(summary.balanceDue)} strong />
        <SummaryRow label="Change" value={pesos(summary.change)} />
        <p className="muted">Payment status: {summary.paymentStatus.replaceAll('_', ' ')}</p>
      </div>
      <ErrorText error={error || (summary.error ? new Error(summary.error) : null)} />
    </section>
  )
}

function SummaryRow({ label, value, strong }) {
  return <div className={strong ? 'pay-row strong' : 'pay-row'}><span>{label}</span><span>{value}</span></div>
}

export function CategoryIcon({ category }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg className="pay-icon" viewBox="0 0 24 24" aria-hidden="true">
      {category === 'CASH' && <path {...common} d="M4 7h16v10H4zM7 12h.01M12 12a2 2 0 100.01 2 2 0 000-.01zM17 12h.01" />}
      {category === 'EWALLET' && <path {...common} d="M6 6h12v12H6zM9 10h6M8 15h8" />}
      {category === 'QR' && (
        <>
          <path {...common} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
          <path {...common} d="M14 14h2v2h-2zM18 14h2v6h-6v-2" />
        </>
      )}
      {category === 'CARD' && <path {...common} d="M3 7h18v10H3zM3 11h18" />}
    </svg>
  )
}

export function ReceiptLogo() {
  return <img className="receipt-logo" src="/receipt-logo.jpg" alt="The Executive Facial Care, Sucat Parañaque" />
}

export function Receipt({ order, onClose }) {
  const [business, setBusiness] = useState(null)
  useEffect(() => { api('/api/business').then((result) => setBusiness(result.data)).catch(() => {}) }, [])
  const address = [business?.addressLine1, business?.barangay, business?.city].filter(Boolean).join(' ')
  const payments = (order.paymentLines || []).filter((line) => line.paymentStatus !== 'VOIDED')
  return (
    <div className="receipt">
      <article className="receipt-slip">
        <ReceiptLogo />
        <p className="legal">{business?.legalName || 'Executive Facial Care'}</p>
        {address ? <p className="center">{address}</p> : null}
        <div className="slip-gap" />
        {order.cashierName ? <p>Cashier: {order.cashierName}</p> : null}
        <p>POS: {business?.tradeName || business?.legalName || 'CareNexa'}</p>
        <div className="rule" />
        {(order.items || []).map((item) => (
          <div key={`${item.productId}-${item.priceRate}-${item.dermtechId || ''}`} className="slip-item">
            <div className="slip-row"><span>{item.name}</span><span>{slipAmount(item.subtotal)}</span></div>
            <p className="slip-sub">{item.quantity} x {slipAmount(item.unitPrice)}</p>
          </div>
        ))}
        <div className="rule" />
        {Number(order.discount) > 0 ? <div className="slip-row"><span>Discount</span><span>{slipAmount(order.discount)}</span></div> : null}
        {Number(order.tip) > 0 ? <div className="slip-row"><span>Tip</span><span>{slipAmount(order.tip)}</span></div> : null}
        <div className="slip-row total"><span>Total</span><span>{slipAmount(order.total)}</span></div>
        <div className="slip-gap" />
        {payments.map((line) => (
          <div key={line.id} className="slip-row">
            <span>{line.method}{line.cardLastFour ? ` ${line.cardLastFour}` : ''}</span>
            <span>{slipAmount(line.amount)}</span>
          </div>
        ))}
        {Number(order.change) > 0 ? <div className="slip-row"><span>Change</span><span>{slipAmount(order.change)}</span></div> : null}
        {Number(order.balanceDue) > 0 ? <div className="slip-row"><span>Balance</span><span>{slipAmount(order.balanceDue)}</span></div> : null}
        <div className="rule" />
        {address ? <p className="center">{address}</p> : null}
        {business?.phone ? <p className="center">{business.phone}</p> : null}
        {business?.receiptFooter ? <p className="center">{business.receiptFooter}</p> : null}
        <div className="slip-row foot">
          <span>{slipWhen(order.orderDate)}</span>
          <span>#{String(order.id || '').slice(-6)}</span>
        </div>
      </article>
      <div className="receipt-actions">
        <button type="button" onClick={() => window.print()}>Print</button>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function slipAmount(value) {
  return new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))
}

function slipWhen(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const get = (type) => parts.find((part) => part.type === type)?.value || ''
  return `${get('month')}/${get('day')}/${get('year')} ${get('hour')}:${get('minute')}`
}
