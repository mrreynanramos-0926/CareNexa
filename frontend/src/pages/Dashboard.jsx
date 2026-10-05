import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, peso } from '../api'
import { Page, Badge, ErrorText } from '../components'
import { useSession } from '../session'

export function DashboardPage() {
  const { can } = useSession()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const manager = can('dashboard', 'manage')

  useEffect(() => {
    const path = manager ? '/api/analytics/dashboard' : '/api/analytics/dashboard/basic'
    api(path).then((result) => setData(result.data)).catch(setError)
  }, [manager])

  if (!data) return <Page title="Dashboard"><ErrorText error={error} />{error ? null : <p>Loading dashboard…</p>}</Page>

  async function syncPos() {
    try {
      const result = await api('/api/pos/sync', { method: 'POST', body: { resources: ['customers', 'inventory', 'transactions'] } })
      const next = await api('/api/analytics/dashboard')
      setData(next.data)
      window.alert(`Mock POS sync finished. Created ${result.data.created}, updated ${result.data.updated}, skipped ${result.data.skipped}.`)
    } catch (err) {
      setError(err)
    }
  }

  if (!manager) {
    return (
      <Page title="Dashboard" lede="A desk view of customers and recent visits.">
        <div className="grid cards">
          <article className="card"><div className="muted">Customers</div><div className="metric">{data.customerCounts.total}</div></article>
          <article className="card"><div className="muted">New in range</div><div className="metric">{data.customerCounts.new}</div></article>
          <article className="card"><div className="muted">Low or out of stock</div><div className="metric">{data.lowStockCount}</div></article>
        </div>
        <OrderTable orders={data.recentOrders} />
      </Page>
    )
  }

  const counts = data.customerCounts
  return (
    <Page title="Dashboard" lede={`${data.from} to ${data.to}. ${data.overlapNote}`} action={<button type="button" onClick={syncPos}>Sync mock POS</button>}>
      <div className="grid cards">
        <Metric label="Customers" value={counts.total} />
        <Metric label="New" value={counts.new} />
        <Metric label="Active" value={counts.active} />
        <Metric label="Inactive" value={counts.inactive} />
        <Metric label="VIP" value={counts.vip} />
        <Metric label="Sales" value={peso(data.sales.total)} />
        <Metric label="Avg ticket" value={peso(data.sales.averageTransactionValue)} />
        <Metric label="Historical value" value={peso(data.customerValue.totalHistorical)} />
        <Metric label="Open anomalies" value={data.anomalies.open} />
        <Metric label="Messages sent" value={data.campaigns.sent} />
      </div>
      <PaymentReport />
      <div className="grid charts" style={{ marginTop: 12 }}>
        <Chart title="Sales trend" data={data.charts.salesTrend} line />
        <Chart title="Customer growth" data={data.charts.customerGrowth} />
        <Chart title="Segments" data={data.charts.segments} />
        <Chart title="Top items" data={data.charts.topItems} />
        <Chart title="Inventory status" data={data.charts.inventory} />
        <Chart title="Campaign messages" data={data.charts.campaigns} />
      </div>
      <div className="grid two" style={{ marginTop: 12 }}>
        <div className="panel">
          <h2>Recent transactions</h2>
          <OrderTable orders={data.recentOrders} />
        </div>
        <div className="panel">
          <h2>Stock and insights</h2>
          {data.lowStock.map((item) => <p key={item.productId}>{item.name}: {item.currentStock} on hand <Badge value={item.status} /></p>)}
          {data.slowMoving.slice(0, 5).map((item) => <p key={item.productId}>{item.name} is slow-moving ({item.unitsSold} sold, {item.stock} on hand).</p>)}
          {data.insights.map((item) => <p key={item.id}>{item.statement}</p>)}
        </div>
      </div>
    </Page>
  )
}

function PaymentReport() {
  const [preset, setPreset] = useState('today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)

  function load(nextPreset, nextFrom = from, nextTo = to) {
    const query = nextPreset === 'custom' ? `from=${nextFrom}&to=${nextTo}` : `preset=${nextPreset}`
    api(`/api/analytics/payments?${query}`).then((result) => setReport(result.data)).catch(setError)
  }
  useEffect(() => { load('today') }, [])

  return (
    <article className="panel" style={{ marginTop: 12 }}>
      <h2>Sales by payment method</h2>
      <div className="pay-tabs">
        {[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month']].map(([key, label]) => (
          <button key={key} type="button" className={preset === key ? 'active' : ''} onClick={() => { setPreset(key); load(key) }}>{label}</button>
        ))}
      </div>
      <div className="pay-grid" style={{ marginTop: 8 }}>
        <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button type="button" className="secondary" onClick={() => { setPreset('custom'); load('custom', from, to) }}>Custom range</button>
      </div>
      <ErrorText error={error} />
      {report ? (
        <>
          <div className="grid cards" style={{ marginTop: 12 }}>
            <Metric label="Sales" value={peso(report.sales)} />
            <Metric label="Payments" value={peso(report.payments)} />
            <Metric label="Change" value={peso(report.change)} />
          </div>
          <p className="muted">{report.from} to {report.to}</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(report.breakdown || []).map((row) => ({ ...row, value: Number(row.value) }))}>
                <CartesianGrid stroke="#e2e8ee" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#0f6e6b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(report.breakdown || []).map((row) => <p key={row.label}>{row.label} {peso(row.value)}</p>)}
        </>
      ) : null}
    </article>
  )
}

function Metric({ label, value }) {
  return <article className="card"><div className="muted">{label}</div><div className="metric">{value}</div></article>
}

function Chart({ title, data, line }) {
  const rows = (data || []).map((row) => ({ ...row, value: Number(row.value) }))
  return (
    <article className="panel">
      <h2>{title}</h2>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {line ? (
            <LineChart data={rows}><CartesianGrid stroke="#e2e8ee" /><XAxis dataKey="label" hide /><YAxis /><Tooltip /><Line dataKey="value" stroke="#0f6e6b" dot={false} /></LineChart>
          ) : (
            <BarChart data={rows}><CartesianGrid stroke="#e2e8ee" /><XAxis dataKey="label" hide /><YAxis /><Tooltip /><Bar dataKey="value" fill="#0f6e6b" /></BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </article>
  )
}

function OrderTable({ orders }) {
  return (
    <table>
      <thead><tr><th>When</th><th>Customer</th><th>Status</th><th className="right">Total</th></tr></thead>
      <tbody>
        {(orders || []).map((order) => (
          <tr key={order.id}><td>{new Date(order.orderDate).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td><td>{order.customerName}</td><td><Badge value={order.status} /></td><td className="right">{peso(order.total)}</td></tr>
        ))}
      </tbody>
    </table>
  )
}
