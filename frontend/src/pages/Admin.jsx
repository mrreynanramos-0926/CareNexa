import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, roleLabel, when } from '../api'
import { Badge, ErrorText, Modal, Page, SearchSelect } from '../components'
import { useSession } from '../session'

export function UsersPage() {
  const [rows, setRows] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)
  function load() { api('/api/users').then((result) => setRows(result.data)).catch(setError) }
  useEffect(() => { load() }, [])
  return (
    <Page title="Users" action={<button type="button" onClick={() => setEditing({})}>New user</button>}>
      <ErrorText error={error} />
      <div className="panel">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td>{roleLabel(row.role)}</td>
                <td><Badge value={row.status} /></td>
                <td>
                  <button className="secondary" type="button" onClick={() => setEditing(row)}>Edit</button>
                  {row.status === 'active' ? <button className="secondary" type="button" onClick={async () => {
                    await api(`/api/users/${row.id}`, { method: 'PUT', body: { status: 'inactive' } })
                    load()
                  }}>Deactivate</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? <UserForm initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} /> : null}
    </Page>
  )
}

function fieldMessage(error, field) {
  return error?.details?.find((item) => item.field === field)?.message || ''
}

function UserForm({ onClose, onSaved, initial }) {
  const [roles, setRoles] = useState([])
  const [form, setForm] = useState(initial
    ? { name: initial.name, email: initial.email, password: '', role: initial.role, status: initial.status }
    : { name: '', email: '', password: '', role: 'STAFF', status: 'active' })
  const [error, setError] = useState(null)
  useEffect(() => { api('/api/roles').then((result) => setRoles(result.data)).catch(setError) }, [])
  return (
    <Modal title={initial ? 'Edit user' : 'New user'} onClose={onClose}>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault()
        try {
          if (initial) await api(`/api/users/${initial.id}`, { method: 'PUT', body: { name: form.name, role: form.role, status: form.status } })
          else await api('/api/users', { method: 'POST', body: form })
          onSaved()
        } catch (err) { setError(err) }
      }}>
        <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Email<input type="email" value={form.email} disabled={Boolean(initial)} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
        {initial ? null : (
          <label>Temporary password
            <input className={fieldMessage(error, 'password') ? 'invalid' : ''} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
            <span className={fieldMessage(error, 'password') ? 'error' : 'muted'}>{fieldMessage(error, 'password') || 'At least 10 characters, with a letter and a number.'}</span>
          </label>
        )}
        <label>Role
          <SearchSelect
            value={form.role}
            onChange={(role) => setForm({ ...form, role })}
            options={(roles.length ? roles : [{ name: form.role }]).map((role) => ({ value: role.name, label: roleLabel(role.name) }))}
          />
        </label>
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
        {fieldMessage(error, 'password') ? null : <ErrorText error={error} />}
        <button type="submit">{initial ? 'Save user' : 'Create user'}</button>
      </form>
    </Modal>
  )
}

export function AuditPage() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)
  useEffect(() => { api('/api/audit-logs?pageSize=50').then((result) => setRows(result.data)).catch(setError) }, [])
  return (
    <Page title="Audit logs" lede="Password hashes and tokens are not stored here.">
      <ErrorText error={error} />
      <div className="panel">
        <table>
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{when(row.createdAt)}</td>
                <td>{row.userName}</td>
                <td>{row.action}</td>
                <td>{row.entity}</td>
                <td><button className="secondary" type="button" onClick={() => setOpen(row)}>Values</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? <Modal title="Audit values" onClose={() => setOpen(null)}><pre>{JSON.stringify({ before: open.oldValue, after: open.newValue }, null, 2)}</pre></Modal> : null}
    </Page>
  )
}

const MONEY_KEYS = new Set(['vip_spend_centavos', 'large_transaction_centavos'])

function pesosFromCentavos(value) {
  return (Number(value || 0) / 100).toFixed(2)
}

function centavosFromPesos(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return null
  return Math.round(number * 100)
}

function settingLabel(key) {
  if (MONEY_KEYS.has(key)) return `${key.replace('_centavos', '').replaceAll('_', ' ')} (₱)`
  return key.replaceAll('_', ' ')
}

export function SettingsPage() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState('')
  useEffect(() => {
    api('/api/settings').then((result) => {
      setRows(result.data.map((row) => (
        MONEY_KEYS.has(row.key) ? { ...row, value: pesosFromCentavos(row.value) } : row
      )))
    }).catch(setError)
  }, [])
  return (
    <Page title="Settings" lede="Thresholds are numbers. Money amounts are in pesos. Segment definitions are updated from the related keys when you save.">
      <p><Link to="/access">Access</Link> · <Link to="/settings/business">Business details</Link> · <Link to="/settings/payments">Payment methods</Link></p>
      <ErrorText error={error} />
      {saved ? <p>{saved}</p> : null}
      <form className="panel stack" onSubmit={async (event) => {
        event.preventDefault()
        try {
          for (const row of rows) {
            const value = MONEY_KEYS.has(row.key) ? centavosFromPesos(row.value) : Number(row.value)
            if (value == null || !Number.isFinite(value) || value < 0) {
              setError({ message: `Enter a valid amount for ${settingLabel(row.key)}.` })
              return
            }
            await api(`/api/settings/${row.key}`, { method: 'PUT', body: { value } })
          }
          setSaved('Settings saved.')
        } catch (err) { setError(err) }
      }}>
        {rows.map((row, index) => (
          <label key={row.key}>{settingLabel(row.key)}
            <input
              type="number"
              min="0"
              step={MONEY_KEYS.has(row.key) ? '0.01' : '1'}
              value={row.value}
              onChange={(event) => {
                const next = [...rows]
                next[index] = { ...row, value: event.target.value }
                setRows(next)
              }}
            />
          </label>
        ))}
        <button type="submit">Save settings</button>
      </form>
    </Page>
  )
}

export function PasswordPage() {
  const { user, refresh } = useSession()
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNext] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  return (
    <Page title="Change password" lede={user.mustChangePassword ? 'Set a new password before using CareNexa.' : 'Replace your current password.'}>
      <form className="panel stack" onSubmit={async (event) => {
        event.preventDefault()
        try {
          await api('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } })
          const me = await api('/api/auth/me')
          refresh(me.data)
          setDone(true)
        } catch (err) { setError(err) }
      }}>
        <label>Current password<input type="password" value={currentPassword} onChange={(event) => setCurrent(event.target.value)} required /></label>
        <label>New password<input type="password" value={newPassword} onChange={(event) => setNext(event.target.value)} required /></label>
        <ErrorText error={error} />
        {done ? <p>Password updated.</p> : null}
        <button type="submit">Update password</button>
      </form>
    </Page>
  )
}
