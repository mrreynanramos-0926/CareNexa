import { useEffect, useState } from 'react'
import { api, peso } from '../api'
import { ErrorText, Page, SearchSelect } from '../components'

const PRESETS = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['week', 'This week'],
  ['month', 'This month'],
]

export function CommissionPage() {
  const [preset, setPreset] = useState('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState(null)
  const [selected, setSelected] = useState('all')
  const [error, setError] = useState(null)

  function load(nextPreset, nextFrom = from, nextTo = to) {
    const query = nextPreset === 'custom' ? `from=${nextFrom}&to=${nextTo}` : `preset=${nextPreset}`
    api(`/api/reports/commissions?${query}`).then((result) => setReport(result.data)).catch(setError)
  }
  useEffect(() => { load('month') }, [])

  const rows = report?.dermtechs || []
  const focus = selected === 'all' ? rows : rows.filter((row) => row.id === selected)

  return (
    <Page title="Commission report" lede="One row per dermtech. Service commission is 10% or 15% of the line amount. FOOTSPA, paraffin, sunblock, and masks use the fixed amounts from the commission sheet. Medicine is 15% of the line amount." action={report ? <button type="button" onClick={() => downloadReport(report)}>Export CSV</button> : null}>
      <div className="pay-tabs">
        {PRESETS.map(([key, label]) => (
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
          <p className="muted">{report.from} to {report.to} · Total commission {peso(report.totalCommission)}</p>
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Dermtech</th>
                  <th className="right">Service sales</th>
                  <th className="right">10% commission</th>
                  <th className="right">15% commission</th>
                  <th className="right">Fixed commission</th>
                  <th className="right">Medicine sales</th>
                  <th className="right">Medicine commission</th>
                  <th className="right">Total commission</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td className="right">{peso(row.serviceSales)}</td>
                    <td className="right">{peso(row.commission10)}</td>
                    <td className="right">{peso(row.commission15)}</td>
                    <td className="right">{peso(row.flatCommission)}</td>
                    <td className="right">{peso(row.medicineSales)}</td>
                    <td className="right">{peso(row.medicineCommission)}</td>
                    <td className="right">{peso(row.totalCommission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="filters" style={{ marginTop: 12 }}>
            <SearchSelect
              value={selected}
              onChange={setSelected}
              options={[{ value: 'all', label: 'All dermtechs' }, ...rows.map((row) => ({ value: row.id, label: row.name }))]}
            />
          </div>
          {focus.map((row) => (
            <article key={row.id} className="panel" style={{ marginTop: 12 }}>
              <h2>{row.name}</h2>
              <p className="muted">Total commission {peso(row.totalCommission)}</p>
              {row.lines.length === 0 ? <p className="muted">No completed lines in this range.</p> : (
                <table>
                  <thead><tr><th>Date</th><th>Customer</th><th>Item</th><th>Type</th><th>Qty</th><th>Rate</th><th className="right">Sales</th><th className="right">Commission</th></tr></thead>
                  <tbody>
                    {row.lines.map((line, index) => (
                      <tr key={`${line.orderId}-${index}`}>
                        <td>{new Date(line.orderDate).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td>
                        <td>{line.customerName}</td>
                        <td>{line.item}</td>
                        <td>{line.type}</td>
                        <td>{line.quantity}</td>
                        <td>{line.rate}</td>
                        <td className="right">{peso(line.sales)}</td>
                        <td className="right">{peso(line.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          ))}
        </>
      ) : null}
    </Page>
  )
}

function downloadReport(report) {
  const header = ['Dermtech', 'Service sales', '10% commission', '15% commission', 'Fixed commission', 'Medicine sales', 'Medicine commission', 'Total commission']
  const body = report.dermtechs.map((row) => [row.name, row.serviceSales, row.commission10, row.commission15, row.flatCommission, row.medicineSales, row.medicineCommission, row.totalCommission])
  const csv = [header, ...body].map((line) => line.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `commission-${report.from}-to-${report.to}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function csvCell(value) {
  const text = value == null ? '' : String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}
