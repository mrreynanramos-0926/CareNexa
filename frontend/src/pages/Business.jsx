import { useEffect, useState } from 'react'
import { api } from '../api'
import { ErrorText, Page, SearchSelect } from '../components'
import { ReceiptLogo } from './PaymentSection'

const TYPES = [
  { value: 'Sole proprietorship', label: 'Sole proprietorship' },
  { value: 'Partnership', label: 'Partnership' },
  { value: 'Corporation', label: 'Corporation' },
  { value: 'Cooperative', label: 'Cooperative' },
]

const EMPTY = {
  legalName: '',
  tradeName: '',
  businessType: 'Sole proprietorship',
  tin: '',
  addressLine1: '',
  barangay: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Philippines',
  phone: '',
  email: '',
  website: '',
  hours: '',
  receiptFooter: '',
}

export function BusinessPage() {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState('')

  useEffect(() => {
    api('/api/business').then((result) => setForm({ ...EMPTY, ...result.data })).catch(setError)
  }, [])

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setSaved('')
  }

  const address = [form.addressLine1, form.barangay, form.city].filter(Boolean).join(' ')

  return (
    <Page title="Business" lede="These details print at the top and bottom of every receipt.">
      <ErrorText error={error} />
      {saved ? <p>{saved}</p> : null}
      <div className="business-setup">
        <form className="panel stack" onSubmit={async (event) => {
          event.preventDefault()
          try {
            const result = await api('/api/business', { method: 'PUT', body: form })
            setForm({ ...EMPTY, ...result.data })
            setSaved('Business details saved.')
          } catch (err) { setError(err) }
        }}>
          <h2>Receipt</h2>
          <label>POS name
            <input value={form.tradeName} onChange={(event) => setField('tradeName', event.target.value)} required />
          </label>
          <label>Business name
            <input value={form.legalName} onChange={(event) => setField('legalName', event.target.value)} required />
          </label>
          <div className="pay-grid">
            <label>Branch
              <input value={form.barangay} onChange={(event) => setField('barangay', event.target.value)} placeholder="Sucat" />
            </label>
            <label>City
              <input value={form.city} onChange={(event) => setField('city', event.target.value)} placeholder="Parañaque" />
            </label>
          </div>
          <label>Address
            <input value={form.addressLine1} onChange={(event) => setField('addressLine1', event.target.value)} placeholder="Jaka Plaza" />
          </label>
          {address ? <p className="muted">Prints as {address}</p> : null}
          <label>Phone
            <input value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="0942-052-7720" />
          </label>
          <label>Footer message
            <input value={form.receiptFooter} onChange={(event) => setField('receiptFooter', event.target.value)} />
          </label>
          <h2>Other details</h2>
          <div className="pay-grid">
            <label>Business type
              <SearchSelect value={form.businessType} onChange={(value) => setField('businessType', value)} options={TYPES} />
            </label>
            <label>TIN
              <input value={form.tin} onChange={(event) => setField('tin', event.target.value)} placeholder="000-000-000" />
            </label>
            <label>Email
              <input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} />
            </label>
            <label>Website
              <input value={form.website} onChange={(event) => setField('website', event.target.value)} placeholder="https://" />
            </label>
            <label>Business hours
              <input value={form.hours} onChange={(event) => setField('hours', event.target.value)} />
            </label>
            <label>Province
              <input value={form.province} onChange={(event) => setField('province', event.target.value)} />
            </label>
            <label>Postal code
              <input value={form.postalCode} onChange={(event) => setField('postalCode', event.target.value)} />
            </label>
            <label>Country
              <input value={form.country} onChange={(event) => setField('country', event.target.value)} />
            </label>
          </div>
          <button type="submit">Save business details</button>
        </form>
        <aside className="panel stack">
          <h2>How it prints</h2>
          <article className="receipt-slip">
            <ReceiptLogo />
            <p className="legal">{form.legalName || 'Executive Facial Care'}</p>
            {address ? <p className="center">{address}</p> : null}
            <div className="slip-gap" />
            <p>POS: {form.tradeName || form.legalName || 'CareNexa'}</p>
            <div className="rule" />
            <p className="center muted">Items, cashier, and payment print from the order.</p>
            <div className="rule" />
            {address ? <p className="center">{address}</p> : null}
            {form.phone ? <p className="center">{form.phone}</p> : null}
            {form.receiptFooter ? <p className="center">{form.receiptFooter}</p> : null}
          </article>
        </aside>
      </div>
    </Page>
  )
}
