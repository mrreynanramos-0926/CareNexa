import { useEffect, useState } from 'react'
import { api, peso } from '../api'
import { Badge, ErrorText, Modal, Page, SearchSelect } from '../components'
import { useSession } from '../session'

export function CatalogPage() {
  const { can } = useSession()
  const [rows, setRows] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)
  const manager = can('catalog', 'manage')
  function load() { api('/api/products?pageSize=500').then((result) => setRows(result.data)).catch(setError) }
  useEffect(() => { load() }, [])
  return (
    <Page title="Products & Services" lede="Services are not stocked unless you mark an item as tracking inventory." action={manager ? <button type="button" onClick={() => setEditing({})}>Add item</button> : null}>
      <ErrorText error={error} />
      <div className="panel">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th className="right">Price</th><th>Stock</th><th>Status</th>{manager ? <th></th> : null}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.type}</td>
                <td className="right">{peso(row.price)}</td>
                <td>{row.tracksInventory ? row.stock : 'Not tracked'}</td>
                <td><Badge value={row.status} /></td>
                {manager ? <td><button className="secondary" type="button" onClick={() => setEditing(row)}>Edit</button></td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? <ItemForm initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} /> : null}
    </Page>
  )
}

function ItemForm({ onClose, onSaved, initial }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name,
    type: initial.type,
    price: initial.price,
    description: initial.description || '',
    status: initial.status,
    reorderLevel: 5,
  } : { name: '', type: 'service', price: '', description: '', status: 'active', reorderLevel: 5 })
  const [error, setError] = useState(null)
  return (
    <Modal title={initial ? 'Edit item' : 'Add item'} onClose={onClose}>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault()
        try {
          if (initial) await api(`/api/products/${initial.id}`, { method: 'PUT', body: form })
          else await api('/api/products', { method: 'POST', body: { ...form, tracksInventory: form.type === 'product' } })
          onSaved()
        } catch (err) { setError(err) }
      }}>
        <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Type
          <SearchSelect
            value={form.type}
            disabled={Boolean(initial)}
            onChange={(type) => setForm({ ...form, type })}
            options={[
              { value: 'service', label: 'Service' },
              { value: 'product', label: 'Product' },
            ]}
          />
        </label>
        <label>Price<input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label>
        <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        {initial ? (
          <label>Status
            <SearchSelect
              value={form.status}
              onChange={(status) => setForm({ ...form, status })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </label>
        ) : null}
        <ErrorText error={error} />
        <button type="submit">Save</button>
      </form>
    </Modal>
  )
}
