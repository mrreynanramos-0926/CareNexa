import { useEffect, useState } from 'react'
import { api, downloadCsv } from '../api'
import { ErrorText, Page, SearchSelect } from '../components'

const REPORTS = [
  ['customers', 'Customers'],
  ['sales', 'Sales'],
  ['inventory', 'Inventory'],
  ['campaigns', 'Campaigns'],
  ['segments', 'Segmentation'],
  ['customer-value', 'Customer value'],
  ['anomalies', 'Anomalies'],
]

export function ReportsPage() {
  const [name, setName] = useState('sales')
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  function load(next = name) {
    api(`/api/reports/${next}?pageSize=25`).then((result) => setRows(result.data)).catch(setError)
  }
  useEffect(() => { load('sales') }, [])
  const columns = rows[0] ? Object.keys(rows[0]) : []
  return (
    <Page title="Reports" lede="CSV uses the same filters as this preview, up to 10,000 rows." action={<button type="button" onClick={() => downloadCsv(`/api/reports/${name}?format=csv`, `${name}.csv`).catch(setError)}>Export CSV</button>}>
      <div className="filters">
        <SearchSelect
          value={name}
          onChange={(value) => { setName(value); load(value) }}
          options={REPORTS.map(([value, label]) => ({ value, label }))}
        />
      </div>
      <ErrorText error={error} />
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{format(row[column])}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </Page>
  )
}

function format(value) {
  if (value == null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
