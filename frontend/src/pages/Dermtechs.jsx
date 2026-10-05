import { useEffect, useState } from 'react'
import { api } from '../api'
import { Badge, ErrorText, Page } from '../components'
import { useSession } from '../session'

const EMPTY = { name: '', phone: '', notes: '' }

export function DermtechsPage() {
  const { can } = useSession()
  const manager = can('dermtechs', 'manage')
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)

  function load() {
    api('/api/dermtechs').then((result) => setRows(result.data)).catch(setError)
  }
  useEffect(() => { load() }, [])

  async function save(event) {
    event.preventDefault()
    try {
      if (editing) await api(`/api/dermtechs/${editing}`, { method: 'PUT', body: form })
      else await api('/api/dermtechs', { method: 'POST', body: form })
      setForm(EMPTY)
      setEditing(null)
      load()
    } catch (err) { setError(err) }
  }

  return (
    <Page title="Dermtech" lede="Therapists who perform services and sell medicine. Inactive profiles stay on past orders.">
      <ErrorText error={error} />
      {manager ? (
        <form className="panel stack" onSubmit={save}>
          <h2>{editing ? 'Edit dermtech' : 'Add dermtech'}</h2>
          <div className="pay-grid">
            <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          </div>
          <label>Notes<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <div className="row-actions">
            <button type="submit">{editing ? 'Save profile' : 'Add dermtech'}</button>
            {editing ? <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(EMPTY) }}>Cancel</button> : null}
          </div>
        </form>
      ) : null}
      <div className="panel" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Notes</th><th>Status</th>{manager ? <th>Actions</th> : null}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}{row.isWalkIn ? ' · walk-in' : ''}</td>
                <td>{row.phone || '—'}</td>
                <td>{row.notes || '—'}</td>
                <td><Badge value={row.status} /></td>
                {manager ? (
                  <td className="row-actions">
                    <button type="button" className="secondary" onClick={() => { setEditing(row.id); setForm({ name: row.name, phone: row.phone, notes: row.notes }) }}>Edit</button>
                    <button type="button" className="secondary" onClick={async () => {
                      await api(`/api/dermtechs/${row.id}`, { method: 'PUT', body: { status: row.status === 'active' ? 'inactive' : 'active' } })
                      load()
                    }}>{row.status === 'active' ? 'Disable' : 'Enable'}</button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  )
}
