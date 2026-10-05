import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, peso, when } from '../api'
import { Badge, ErrorText, Modal, Page, SearchSelect } from '../components'
import { useSession } from '../session'

const emptyCustomer = { firstName: '', lastName: '', email: '', phone: '', birthday: '', address: '', customerType: 'individual', status: 'active', smsConsent: true, emailConsent: true }

export function CustomersPage() {
  const { can } = useSession()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  function load(nextPage = page) {
    const params = new URLSearchParams({ page: String(nextPage), pageSize: '25', search, status })
    api(`/api/customers?${params}`).then((result) => {
      setRows(result.data)
      setTotal(result.total)
      setPage(result.page)
    }).catch(setError)
  }

  useEffect(() => { load(1) }, [])

  return (
    <Page title="Customers" lede="Search the clinic book and open a full history." action={can('customers', 'manage') ? <button type="button" onClick={() => setOpen(true)}>New customer</button> : null}>
      <ErrorText error={error} />
      <form className="filters" onSubmit={(event) => { event.preventDefault(); load(1) }}>
        <input placeholder="Name, phone, or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        <SearchSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'Any status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        <button type="submit">Apply</button>
      </form>
      <div className="panel">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Segments</th><th className="right">Spent</th><th>Visits</th><th>Last visit</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/customers/${row.id}`}>{row.name}</Link></td>
                <td>{row.phone}</td>
                <td>{row.segments.join(', ') || '—'}</td>
                <td className="right">{peso(row.totalSpent)}</td>
                <td>{row.visitCount}</td>
                <td>{when(row.lastVisit)}</td>
                <td><Badge value={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager">
          <button className="secondary" type="button" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</button>
          <span>{page} / {Math.max(1, Math.ceil(total / 25))}</span>
          <button className="secondary" type="button" disabled={page * 25 >= total} onClick={() => load(page + 1)}>Next</button>
        </div>
      </div>
      {open ? <CustomerForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(1) }} /> : null}
    </Page>
  )
}

export function CustomerProfilePage() {
  const { id } = useParams()
  const { can } = useSession()
  const manage = can('customers', 'manage')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [notes, setNotes] = useState('')
  const [type, setType] = useState('note')
  const [editing, setEditing] = useState(false)

  function load() {
    api(`/api/customers/${id}`).then((result) => setData(result.data)).catch(setError)
  }
  useEffect(() => { load() }, [id])
  if (!data) return <Page title="Customer"><ErrorText error={error} /></Page>

  return (
    <Page title={data.name} lede="Historical value comes from completed orders. It is not a predictive model." action={manage ? <button type="button" onClick={() => setEditing(true)}>Edit customer</button> : null}>
      <div className="grid cards">
        <article className="card"><div className="muted">Spent</div><div className="metric">{peso(data.value?.totalSpent)}</div></article>
        <article className="card"><div className="muted">Visits</div><div className="metric">{data.value?.visitCount || 0}</div></article>
        <article className="card"><div className="muted">Average</div><div className="metric">{peso(data.value?.averageTransactionValue)}</div></article>
        <article className="card"><div className="muted">Last visit</div><div className="metric" style={{ fontSize: 16 }}>{when(data.value?.lastVisitDate)}</div></article>
      </div>
      <div className="grid two" style={{ marginTop: 12 }}>
        <section className="panel">
          <h2>Contact</h2>
          <p>{data.phone} · {data.email}</p>
          <p>{data.address}</p>
          <p>Birthday {data.birthday || '—'} · <Badge value={data.status} /></p>
          <p>Segments: {data.segments.join(', ') || 'None yet'}</p>
        </section>
        {manage ? <section className="panel">
          <h2>Add activity</h2>
          <form className="stack" onSubmit={async (event) => {
            event.preventDefault()
            await api(`/api/customers/${id}/activities`, { method: 'POST', body: { type, notes, activityDate: new Date().toISOString() } })
            setNotes('')
            load()
          }}>
            <SearchSelect
              value={type}
              onChange={setType}
              options={[
                { value: 'note', label: 'Note' },
                { value: 'call', label: 'Call' },
                { value: 'visit', label: 'Visit' },
                { value: 'follow_up', label: 'Follow up' },
              ]}
            />
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} required />
            <button type="submit">Save activity</button>
          </form>
        </section> : null}
      </div>
      <section className="panel" style={{ marginTop: 12 }}>
        <h2>Orders</h2>
        <table>
          <thead><tr><th>Date</th><th>Medicine</th><th>Service</th><th>Status</th><th className="right">Total</th></tr></thead>
          <tbody>
            {data.orders.map((order) => (
              <tr key={order.id}>
                <td>{when(order.orderDate)}</td>
                <td>{order.items.filter((item) => item.type === 'product').map((item) => `${item.name} × ${item.quantity}`).join(', ') || '—'}</td>
                <td>{order.items.filter((item) => item.type === 'service').map((item) => `${item.name} × ${item.quantity}`).join(', ') || '—'}</td>
                <td><Badge value={order.status} /></td>
                <td className="right">{peso(order.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel" style={{ marginTop: 12 }}>
        <h2>Activities</h2>
        {data.activities.map((activity) => (
          <p key={activity.id}><Badge value={activity.type} /> {when(activity.activityDate)} · {activity.userName}<br />{activity.notes}</p>
        ))}
      </section>
      {editing ? <CustomerForm initial={data} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} /> : null}
      {manage ? <button className="secondary" type="button" onClick={async () => {
        if (!window.confirm('Deactivate this customer? Their history stays on file.')) return
        await api(`/api/customers/${id}/deactivate`, { method: 'POST' })
        load()
      }}>Deactivate</button> : null}
    </Page>
  )
}

function CustomerForm({ onClose, onSaved, initial }) {
  const [form, setForm] = useState(initial ? {
    firstName: initial.firstName,
    lastName: initial.lastName,
    email: initial.email || '',
    phone: initial.phone || '',
    birthday: initial.birthday || '',
    address: initial.address || '',
    customerType: initial.customerType || 'individual',
    status: initial.status,
    smsConsent: initial.smsConsent,
    emailConsent: initial.emailConsent,
  } : emptyCustomer)
  const [error, setError] = useState(null)
  function set(key, value) { setForm((current) => ({ ...current, [key]: value })) }
  return (
    <Modal title={initial ? 'Edit customer' : 'New customer'} onClose={onClose}>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault()
        try {
          if (initial) await api(`/api/customers/${initial.id}`, { method: 'PUT', body: form })
          else await api('/api/customers', { method: 'POST', body: form })
          onSaved()
        } catch (err) { setError(err) }
      }}>
        <label>First name<input value={form.firstName} onChange={(event) => set('firstName', event.target.value)} required /></label>
        <label>Last name<input value={form.lastName} onChange={(event) => set('lastName', event.target.value)} required /></label>
        <label>Phone<input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></label>
        <label>Email<input value={form.email} onChange={(event) => set('email', event.target.value)} /></label>
        <label>Birthday<input type="date" value={form.birthday} onChange={(event) => set('birthday', event.target.value)} /></label>
        <label>Address<input value={form.address} onChange={(event) => set('address', event.target.value)} /></label>
        <ErrorText error={error} />
        <button type="submit">Save customer</button>
      </form>
    </Modal>
  )
}
