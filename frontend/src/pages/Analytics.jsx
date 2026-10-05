import { useEffect, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, peso } from '../api'
import { ErrorText, Page } from '../components'

export function AnalyticsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sales, setSales] = useState(null)
  const [byProduct, setByProduct] = useState([])
  const [bySegment, setBySegment] = useState(null)
  const [error, setError] = useState(null)

  function load(event) {
    event?.preventDefault()
    const params = new URLSearchParams()
    if (from && to) { params.set('from', from); params.set('to', to) }
    api(`/api/analytics/sales?bucket=week&${params}`).then((result) => setSales(result.data)).catch(setError)
    api(`/api/analytics/sales?groupBy=product&${params}`).then((result) => setByProduct(result.data.series)).catch(setError)
    api(`/api/analytics/sales?groupBy=segment&${params}`).then((result) => setBySegment(result.data)).catch(setError)
  }
  useEffect(() => { load() }, [])

  return (
    <Page title="Analytics" lede="Totals use completed orders only.">
      <form className="filters" onSubmit={load}>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <button type="submit">Apply</button>
      </form>
      <ErrorText error={error} />
      {sales ? <p>Period sales {peso(sales.total)} · average ticket {peso(sales.averageTransactionValue)}</p> : null}
      <div className="grid charts">
        <article className="panel"><h2>Weekly sales</h2><Chart data={sales?.series || []} /></article>
        <article className="panel"><h2>By product</h2><Chart data={byProduct} /></article>
      </div>
      <article className="panel" style={{ marginTop: 12 }}>
        <h2>By segment</h2>
        <p className="muted">{bySegment?.overlapNote}</p>
        <Chart data={bySegment?.series || []} />
      </article>
    </Page>
  )
}

function Chart({ data }) {
  const rows = data.map((row) => ({ ...row, value: Number(row.value) }))
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}><XAxis dataKey="label" hide /><YAxis /><Tooltip /><Bar dataKey="value" fill="#0f6e6b" /></BarChart>
      </ResponsiveContainer>
    </div>
  )
}
