import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Badge, ErrorText, Page } from '../components'

export function InsightsPage() {
  const [groups, setGroups] = useState([])
  const [alerts, setAlerts] = useState([])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  function load() {
    Promise.all([
      api('/api/ai/recommendations'),
      api('/api/ai/inventory'),
      api('/api/ai/anomalies?pageSize=20'),
    ]).then(([recommendations, inventory, anomalies]) => {
      setGroups([
        ['Inventory', inventory.data],
        ['Sales', recommendations.data.sales],
        ['Customers', recommendations.data.customer],
        ['Marketing', recommendations.data.marketing],
      ])
      setAlerts(anomalies.data)
      setSummary(anomalies.summary)
    }).catch(setError)
  }
  useEffect(() => { load() }, [])

  return (
    <Page title="Rule-based insights" lede="These findings are calculated from CareNexa records. They are not a machine-learning model.">
      <ErrorText error={error} />
      {summary ? <InsightCard item={summary} /> : null}
      {groups.map(([title, items]) => (
        <section key={title} style={{ marginTop: 16 }}>
          <h2>{title}</h2>
          <div className="grid">
            {(items || []).map((item) => <InsightCard key={item.id} item={item} />)}
          </div>
        </section>
      ))}
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Anomaly queue</h2>
        <table>
          <thead><tr><th>Type</th><th>Severity</th><th>Status</th><th>Description</th><th></th></tr></thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td>{alert.anomalyType}</td>
                <td><Badge value={alert.severity} /></td>
                <td><Badge value={alert.status} /></td>
                <td>{alert.description}</td>
                <td>{alert.status === 'new' ? <button type="button" onClick={async () => {
                  await api(`/api/ai/anomalies/${alert.id}`, { method: 'PUT', body: { status: 'reviewing' } })
                  load()
                }}>Mark reviewing</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p><Link to="/reports">Open reports</Link></p>
      </section>
    </Page>
  )
}

function InsightCard({ item }) {
  return (
    <article className="panel insight">
      <strong>{item.statement}</strong>
      <span className="muted">Source: {item.dataSource}</span>
      <span>{item.reason}</span>
      <span className="muted">Basis: {JSON.stringify(item.basis)}</span>
      <span>Action: {item.recommendedAction}</span>
      <Badge value={item.producer} />
    </article>
  )
}
