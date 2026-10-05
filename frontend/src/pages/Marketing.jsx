import { useEffect, useState } from 'react'
import { api } from '../api'
import { Badge, ErrorText, Modal, Page, SearchSelect } from '../components'

export function MarketingPage() {
  const [rows, setRows] = useState([])
  const [segments, setSegments] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  function load() {
    api('/api/campaigns?pageSize=50').then((result) => setRows(result.data)).catch(setError)
    api('/api/segments').then((result) => setSegments(result.data)).catch(setError)
  }
  useEffect(() => { load() }, [])

  return (
    <Page title="Marketing" lede="Activation writes a simulated SMS or email. Nothing is delivered to a phone or inbox." action={<button type="button" onClick={() => setEditing({})}>New campaign</button>}>
      <ErrorText error={error} />
      {notice ? <p>{notice}</p> : null}
      <div className="panel">
        <table>
          <thead><tr><th>Name</th><th>Channel</th><th>Segment</th><th>Status</th><th>Sent</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.channel}</td>
                <td>{row.segmentName}</td>
                <td><Badge value={row.status} /></td>
                <td>{row.counts.sent}</td>
                <td>
                  <button className="secondary" type="button" onClick={() => setEditing(row)}>Edit</button>
                  {row.status !== 'inactive' ? <button className="secondary" type="button" onClick={async () => {
                    const result = await api(`/api/campaigns/${row.id}/activate`, { method: 'POST' })
                    setNotice(`Simulated send created ${result.data.created} messages and skipped ${result.data.skipped}.`)
                    load()
                  }}>Activate</button> : null}
                  {row.status === 'active' ? <button className="secondary" type="button" onClick={async () => {
                    await api(`/api/campaigns/${row.id}/deactivate`, { method: 'POST' })
                    setNotice(`${row.name} is inactive.`)
                    load()
                  }}>Deactivate</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? <CampaignForm initial={editing.id ? editing : null} segments={segments} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} /> : null}
    </Page>
  )
}

function CampaignForm({ segments, onClose, onSaved, initial }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name,
    type: initial.type,
    channel: initial.channel,
    targetSegmentId: initial.targetSegmentId,
    message: initial.message,
    startDate: initial.startDate,
    endDate: initial.endDate,
  } : { name: '', type: 'promotional', channel: 'sms', targetSegmentId: segments[0]?.id || '', message: 'Hi {{first_name}}, ', startDate: '', endDate: '' })
  const [error, setError] = useState(null)
  return (
    <Modal title={initial ? 'Edit campaign' : 'New campaign'} onClose={onClose}>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault()
        try {
          if (initial) await api(`/api/campaigns/${initial.id}`, { method: 'PUT', body: form })
          else await api('/api/campaigns', { method: 'POST', body: form })
          onSaved()
        } catch (err) { setError(err) }
      }}>
        <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Type
          <SearchSelect
            value={form.type}
            onChange={(type) => setForm({ ...form, type })}
            options={[
              { value: 'promotional', label: 'Promotional' },
              { value: 'informational', label: 'Informational' },
              { value: 'win_back', label: 'Win-back' },
              { value: 'birthday', label: 'Birthday' },
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
        <label>Segment
          <SearchSelect
            value={form.targetSegmentId}
            onChange={(targetSegmentId) => setForm({ ...form, targetSegmentId })}
            options={segments.map((segment) => ({ value: segment.id, label: segment.name }))}
          />
        </label>
        <label>Start<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required /></label>
        <label>End<input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required /></label>
        <label>Message<textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required /></label>
        <ErrorText error={error} />
        <button type="submit">{initial ? 'Save campaign' : 'Save draft'}</button>
      </form>
    </Modal>
  )
}
