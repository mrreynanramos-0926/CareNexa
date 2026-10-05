import { useEffect, useState } from 'react'
import { api } from '../api'
import { Badge, ErrorText, Modal, Page, SearchSelect } from '../components'

export function PromotionsPage() {
  const [rules, setRules] = useState([])
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(null)
  function load() { api('/api/trigger-rules').then((result) => setRules(result.data)).catch(setError) }
  useEffect(() => { load() }, [])
  return (
    <Page title="Promotions" lede="Rules create a logged message. Buy-3 eligibility is a message, not a discount applied at the POS." action={<button type="button" onClick={async () => {
      const result = await api('/api/promotions/evaluate', { method: 'POST' })
      setNotice(`Created ${result.data.created} messages. Skipped ${result.data.skipped} already logged.`)
      load()
    }}>Run evaluation</button>}>
      <ErrorText error={error} />
      {notice ? <p>{notice}</p> : null}
      <div className="panel">
        <table>
          <thead><tr><th>Rule</th><th>Event</th><th>Channel</th><th>Active</th><th>Template</th><th></th></tr></thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>{rule.eventType}</td>
                <td>{rule.channel}</td>
                <td><Badge value={rule.isActive ? 'active' : 'inactive'} /></td>
                <td>{rule.messageTemplate}</td>
                <td><button className="secondary" type="button" onClick={() => setEditing(rule)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? <RuleForm rule={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} /> : null}
    </Page>
  )
}

function RuleForm({ rule, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: rule.name,
    eventType: rule.eventType,
    channel: rule.channel,
    messageTemplate: rule.messageTemplate,
    isActive: rule.isActive,
    conditionValue: rule.conditionValue || {},
  })
  const [error, setError] = useState(null)
  return (
    <Modal title="Edit promotion" onClose={onClose}>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault()
        try {
          await api(`/api/trigger-rules/${rule.id}`, { method: 'PUT', body: form })
          onSaved()
        } catch (err) { setError(err) }
      }}>
        <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Event
          <SearchSelect
            value={form.eventType}
            onChange={(eventType) => setForm({ ...form, eventType })}
            options={[
              { value: 'birthday', label: 'Birthday' },
              { value: 'anniversary', label: 'Anniversary' },
              { value: 'inactivity', label: 'Inactivity' },
              { value: 'purchase_count', label: 'Purchase count' },
              { value: 'new_customer', label: 'New customer' },
              { value: 'vip', label: 'VIP' },
            ]}
          />
        </label>
        <label>Channel
          <SearchSelect
            value={form.channel}
            onChange={(channel) => setForm({ ...form, channel })}
            options={[
              { value: 'sms', label: 'SMS' },
              { value: 'email', label: 'Email' },
            ]}
          />
        </label>
        <label>Message<textarea value={form.messageTemplate} onChange={(event) => setForm({ ...form, messageTemplate: event.target.value })} required /></label>
        <label>Active
          <SearchSelect
            value={form.isActive ? 'yes' : 'no'}
            onChange={(value) => setForm({ ...form, isActive: value === 'yes' })}
            options={[
              { value: 'yes', label: 'Active' },
              { value: 'no', label: 'Inactive' },
            ]}
          />
        </label>
        <ErrorText error={error} />
        <button type="submit">Save promotion</button>
      </form>
    </Modal>
  )
}
