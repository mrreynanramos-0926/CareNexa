import { useEffect, useState } from 'react'
import { api } from '../api'
import { ErrorText, Page, SearchSelect } from '../components'
import { useSession } from '../session'

const FIELDS = [
  ['total_spent_centavos', 'Total spent (₱)'],
  ['visit_count', 'Visit count'],
  ['visit_count_in_days', 'Visits in a window'],
  ['days_since_last_visit', 'Days since last visit'],
  ['days_since_first_visit', 'Days since first visit'],
  ['days_since_created', 'Days since created'],
]

export function SegmentsPage() {
  const { can } = useSession()
  const canEdit = can('segments', 'manage')
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)

  function load() {
    api('/api/segments').then((result) => {
      setRows(result.data)
      setSelected((current) => result.data.find((row) => row.id === current?.id) || result.data[0] || null)
    }).catch(setError)
  }
  useEffect(() => { load() }, [])

  return (
    <Page title="Segments" lede="A customer can belong to more than one segment. Rebuild after you change a rule." action={canEdit ? <button type="button" onClick={async () => {
      const result = await api('/api/segments/rebuild', { method: 'POST' })
      setMessage(`Memberships added ${result.data.created}, removed ${result.data.skipped}.`)
      load()
    }}>Rebuild memberships</button> : null}>
      <ErrorText error={error} />
      {message ? <p>{message}</p> : null}
      <div className="grid two">
        <div className="panel">
          <table>
            <thead><tr><th>Segment</th><th>Members</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}><td><button className="secondary" type="button" onClick={() => setSelected(row)}>{row.name}</button></td><td>{row.memberCount}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected ? <SegmentEditor segment={selected} canEdit={canEdit} onSaved={load} /> : null}
      </div>
    </Page>
  )
}

function SegmentEditor({ segment, canEdit, onSaved }) {
  const [name, setName] = useState(segment.name)
  const [description, setDescription] = useState(segment.description)
  const [match, setMatch] = useState(segment.criteria.match)
  const [rules, setRules] = useState(segment.criteria.rules)
  const [error, setError] = useState(null)
  useEffect(() => {
    setName(segment.name)
    setDescription(segment.description)
    setMatch(segment.criteria.match)
    setRules(segment.criteria.rules.map(showRule))
  }, [segment])

  return (
    <form className="panel stack" onSubmit={async (event) => {
      event.preventDefault()
      try {
        await api(`/api/segments/${segment.id}`, { method: 'PUT', body: { name, description, criteria: { match, rules: rules.map(storeRule) } } })
        onSaved()
      } catch (err) { setError(err) }
    }}>
      <h2>{segment.name}</h2>
      <p className="muted">{segment.memberCount} current members</p>
      <label>Name<input value={name} disabled={!canEdit} onChange={(event) => setName(event.target.value)} /></label>
      <label>Description<textarea value={description} disabled={!canEdit} onChange={(event) => setDescription(event.target.value)} /></label>
      <label>Match
        <SearchSelect
          value={match}
          disabled={!canEdit}
          onChange={setMatch}
          options={[
            { value: 'all', label: 'All rules' },
            { value: 'any', label: 'Any rule' },
          ]}
        />
      </label>
      {rules.map((rule, index) => (
        <div key={index} className="filters">
          <SearchSelect
            value={rule.field}
            disabled={!canEdit}
            onChange={(field) => update(index, { field })}
            options={FIELDS.map(([value, label]) => ({ value, label }))}
          />
          <SearchSelect
            value={rule.op}
            disabled={!canEdit}
            onChange={(op) => update(index, { op })}
            options={[
              { value: 'gte', label: 'at least' },
              { value: 'lte', label: 'at most' },
              { value: 'eq', label: 'equal to' },
            ]}
          />
          <input type="number" min="0" step={rule.field === 'total_spent_centavos' ? '0.01' : '1'} value={rule.value} disabled={!canEdit} onChange={(event) => update(index, { value: event.target.value })} />
          {rule.field === 'visit_count_in_days' ? <input type="number" value={rule.windowDays || 0} disabled={!canEdit} onChange={(event) => update(index, { windowDays: Number(event.target.value) })} /> : null}
        </div>
      ))}
      <ErrorText error={error} />
      {canEdit ? <button type="submit">Save segment</button> : <p className="muted">Staff can view rules.</p>}
    </form>
  )

  function update(index, patch) {
    setRules((current) => current.map((rule, ruleIndex) => {
      if (ruleIndex !== index) return rule
      const next = { ...rule, ...patch }
      if (patch.field && patch.field !== rule.field) {
        const amount = Number(rule.value || 0)
        if (patch.field === 'total_spent_centavos') next.value = (amount / 100).toFixed(2)
        else if (rule.field === 'total_spent_centavos') next.value = Math.round(amount * 100)
      }
      return next
    }))
  }
}

function showRule(rule) {
  if (rule.field !== 'total_spent_centavos') return rule
  return { ...rule, value: (Number(rule.value || 0) / 100).toFixed(2) }
}

function storeRule(rule) {
  if (rule.field !== 'total_spent_centavos') return { ...rule, value: Number(rule.value) }
  return { ...rule, value: Math.round(Number(rule.value || 0) * 100) }
}
