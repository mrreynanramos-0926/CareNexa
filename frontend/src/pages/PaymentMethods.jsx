import { useEffect, useState } from 'react'
import { api } from '../api'
import { Badge, ErrorText, Page, SearchSelect } from '../components'

const CATEGORIES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'EWALLET', label: 'E-Wallet' },
  { value: 'QR', label: 'QR' },
  { value: 'CARD', label: 'Card' },
]

const EMPTY = { name: '', category: 'EWALLET', provider: '', code: '', description: '', displayOrder: '', allowsChange: false, requiresReference: false, qrConfig: '' }

export function PaymentMethodsPage() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)

  function load() {
    api('/api/payment-methods').then((result) => setRows(result.data)).catch(setError)
  }
  useEffect(() => { load() }, [])

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save(event) {
    event.preventDefault()
    const body = {
      name: form.name,
      category: form.category,
      provider: form.provider,
      code: form.code,
      description: form.description,
      allowsChange: Boolean(form.allowsChange),
      requiresReference: Boolean(form.requiresReference),
      qrConfig: form.qrConfig,
    }
    if (form.displayOrder !== '') body.displayOrder = Number(form.displayOrder)
    try {
      if (editing) await api(`/api/payment-methods/${editing}`, { method: 'PUT', body })
      else await api('/api/payment-methods', { method: 'POST', body })
      setForm(EMPTY)
      setEditing(null)
      load()
    } catch (err) { setError(err) }
  }

  async function move(row, direction) {
    const ordered = [...rows].sort((a, b) => a.displayOrder - b.displayOrder)
    const index = ordered.findIndex((item) => item.id === row.id)
    const neighbor = ordered[index + direction]
    if (!neighbor) return
    await api(`/api/payment-methods/${row.id}`, { method: 'PUT', body: { displayOrder: neighbor.displayOrder } })
    await api(`/api/payment-methods/${neighbor.id}`, { method: 'PUT', body: { displayOrder: row.displayOrder } })
    load()
  }

  return (
    <Page title="Payment methods" lede="Settings for how the clinic records payments. Disabling a method keeps it on past orders.">
      <ErrorText error={error} />
      <form className="panel stack" onSubmit={save}>
        <h2>{editing ? 'Edit payment method' : 'Add payment method'}</h2>
        <div className="pay-grid">
          <label>Name<input value={form.name} onChange={(event) => setField('name', event.target.value)} required /></label>
          <label>Category
            <SearchSelect value={form.category} onChange={(value) => setField('category', value)} options={CATEGORIES} />
          </label>
          <label>Provider<input value={form.provider} onChange={(event) => setField('provider', event.target.value)} required /></label>
          <label>Code<input value={form.code} onChange={(event) => setField('code', event.target.value)} required /></label>
        </div>
        <label>Description<input value={form.description} onChange={(event) => setField('description', event.target.value)} /></label>
        <label>Display order<input type="number" value={form.displayOrder} onChange={(event) => setField('displayOrder', event.target.value)} /></label>
        {form.category === 'QR' ? <label>QR configuration<input value={form.qrConfig} onChange={(event) => setField('qrConfig', event.target.value)} placeholder="Optional note or future QR payload" /></label> : null}
        <label className="check"><input type="checkbox" checked={Boolean(form.allowsChange)} onChange={(event) => setField('allowsChange', event.target.checked)} /> Allow change on this method</label>
        <label className="check"><input type="checkbox" checked={Boolean(form.requiresReference)} onChange={(event) => setField('requiresReference', event.target.checked)} /> Require a reference number</label>
        <div className="row-actions">
          <button type="submit">{editing ? 'Save method' : 'Add method'}</button>
          {editing ? <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(EMPTY) }}>Cancel edit</button> : null}
        </div>
      </form>
      <div className="panel" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>Payment method</th><th>Category</th><th>Provider</th><th>Code</th><th>Status</th><th>Display order</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{CATEGORIES.find((item) => item.value === row.category)?.label || row.category}</td>
                <td>{row.provider}</td>
                <td>{row.code}</td>
                <td><Badge value={row.isActive ? 'active' : 'inactive'} /></td>
                <td>{row.displayOrder}</td>
                <td className="row-actions">
                  <button type="button" className="secondary" onClick={() => { setEditing(row.id); setForm(row) }}>Edit</button>
                  <button type="button" className="secondary" onClick={async () => {
                    await api(`/api/payment-methods/${row.id}/status`, { method: 'PATCH', body: { isActive: !row.isActive } })
                    load()
                  }}>{row.isActive ? 'Disable' : 'Enable'}</button>
                  <button type="button" className="secondary" onClick={() => move(row, -1)}>Up</button>
                  <button type="button" className="secondary" onClick={() => move(row, 1)}>Down</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  )
}
