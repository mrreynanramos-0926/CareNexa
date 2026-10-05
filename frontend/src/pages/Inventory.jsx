import { useEffect, useState } from 'react'
import { api, peso, when } from '../api'
import { Badge, ErrorText, Modal, Page } from '../components'
import { useSession } from '../session'

export function InventoryPage() {
  const { can } = useSession()
  const manager = can('inventory', 'manage')
  const [rows, setRows] = useState([])
  const [alerts, setAlerts] = useState([])
  const [movements, setMovements] = useState([])
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState(null)
  const [error, setError] = useState(null)

  function load() {
    api('/api/inventory?pageSize=100').then((result) => setRows(result.data)).catch(setError)
    api('/api/inventory/alerts?status=open&pageSize=100').then((result) => setAlerts(result.data)).catch(setError)
  }
  useEffect(() => { load() }, [])

  return (
    <Page title="Inventory" lede="Low-stock and out-of-stock alerts open when stock is below the reorder level.">
      <ErrorText error={error} />
      <div className="grid two">
        <div className="panel">
          <table>
            <thead><tr><th>Item</th><th>On hand</th><th>Reorder</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><button className="secondary" type="button" onClick={async () => {
                    setSelected(row)
                    const result = await api(`/api/inventory/${row.id}/movements`)
                    setMovements(result.data)
                  }}>{row.name}</button></td>
                  <td>{row.currentStock}</td>
                  <td>{row.reorderLevel}</td>
                  <td><Badge value={row.status} /></td>
                  <td>{manager ? <>
                    <button type="button" onClick={() => { setSelected(row); setMode('restock') }}>Restock</button>
                    <button className="secondary" type="button" onClick={() => { setSelected(row); setMode('adjust') }}>Adjust</button>
                    <button className="secondary" type="button" onClick={() => { setSelected(row); setMode('settings') }}>Edit</button>
                  </> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h2>Open alerts</h2>
          {alerts.length === 0 ? <p>No open stock alerts.</p> : alerts.map((alert) => <p key={alert.id}><Badge value={alert.severity} /> {alert.message}</p>)}
          <h2>History</h2>
          {selected ? movements.map((row) => <p key={row.id}>{when(row.createdAt)} · {row.reason} · {row.quantityDelta} · {row.createdBy}</p>) : <p className="muted">Select an item.</p>}
        </div>
      </div>
      {mode === 'restock' && selected ? <RestockForm item={selected} onClose={() => setMode(null)} onSaved={() => { setMode(null); load() }} /> : null}
      {mode === 'adjust' && selected ? <AdjustForm item={selected} onClose={() => setMode(null)} onSaved={() => { setMode(null); load() }} /> : null}
      {mode === 'settings' && selected ? <SettingsForm item={selected} onClose={() => setMode(null)} onSaved={() => { setMode(null); load() }} /> : null}
    </Page>
  )
}

function SettingsForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    reorderLevel: item.reorderLevel,
    reorderQuantity: item.reorderQuantity,
    unitCost: item.unitCost,
  })
  const [error, setError] = useState(null)
  return (
    <Modal title={`Edit ${item.name}`} onClose={onClose}>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault()
        try {
          await api(`/api/inventory/${item.id}`, { method: 'PUT', body: { ...form, reorderLevel: Number(form.reorderLevel), reorderQuantity: Number(form.reorderQuantity) } })
          onSaved()
        } catch (err) { setError(err) }
      }}>
        <label>Reorder level<input type="number" min="0" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })} required /></label>
        <label>Reorder quantity<input type="number" min="1" value={form.reorderQuantity} onChange={(event) => setForm({ ...form, reorderQuantity: event.target.value })} required /></label>
        <label>Unit cost<input value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} required /></label>
        <ErrorText error={error} />
        <button type="submit">Save</button>
      </form>
    </Modal>
  )
}

function RestockForm({ item, onClose, onSaved }) {
  const [quantity, setQuantity] = useState(item.reorderQuantity)
  const [error, setError] = useState(null)
  return (
    <Modal title={`Restock ${item.name}`} onClose={onClose}>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault()
        try {
          await api('/api/inventory/restock', { method: 'POST', body: { productId: item.productId, quantity: Number(quantity) } })
          onSaved()
        } catch (err) { setError(err) }
      }}>
        <p className="muted">Unit cost on file: {peso(item.unitCost)}</p>
        <label>Quantity<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        <ErrorText error={error} />
        <button type="submit">Receive stock</button>
      </form>
    </Modal>
  )
}

function AdjustForm({ item, onClose, onSaved }) {
  const [quantityDelta, setQuantityDelta] = useState('-1')
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  return (
    <Modal title={`Adjust ${item.name}`} onClose={onClose}>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault()
        try {
          await api('/api/inventory/adjustments', { method: 'POST', body: { productId: item.productId, quantityDelta: Number(quantityDelta), note } })
          onSaved()
        } catch (err) { setError(err) }
      }}>
        <label>Quantity change<input type="number" value={quantityDelta} onChange={(event) => setQuantityDelta(event.target.value)} required /></label>
        <label>Note<input value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <ErrorText error={error} />
        <button type="submit">Save adjustment</button>
      </form>
    </Modal>
  )
}
