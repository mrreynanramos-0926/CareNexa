import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useSession } from './session'
import { api } from './api'
import { Layout, ErrorText } from './components'
import { DashboardPage } from './pages/Dashboard'
import { CustomersPage, CustomerProfilePage } from './pages/Customers'
import { SegmentsPage } from './pages/Segments'
import { OrdersPage } from './pages/Orders'
import { DermtechsPage } from './pages/Dermtechs'
import { CommissionPage } from './pages/Commission'
import { CatalogPage } from './pages/Catalog'
import { InventoryPage } from './pages/Inventory'
import { MarketingPage } from './pages/Marketing'
import { PromotionsPage } from './pages/Promotions'
import { AnalyticsPage } from './pages/Analytics'
import { InsightsPage } from './pages/Insights'
import { ReportsPage } from './pages/Reports'
import { UsersPage, AuditPage, SettingsPage, PasswordPage } from './pages/Admin'
import { PaymentMethodsPage } from './pages/PaymentMethods'
import { BusinessPage } from './pages/Business'
import { AccessPage } from './pages/Access'

function LoginPage() {
  const { user, login, logout } = useSession()
  const forced = Boolean(user?.mustChangePassword)
  const [changing, setChanging] = useState(false)
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const showChange = forced || changing

  async function submitSignIn(event) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try { await login(email, password) } catch (err) { setError(err) } finally { setPending(false) }
  }

  async function submitChange(event) {
    event.preventDefault()
    if (nextPassword !== confirmPassword) {
      setError({ message: 'Enter the same new password in both fields.' })
      return
    }
    setPending(true)
    setError(null)
    try {
      await api('/api/auth/password', { method: 'POST', body: { email, currentPassword: password, newPassword: nextPassword } })
      await login(email, nextPassword)
    } catch (err) { setError(err) } finally { setPending(false) }
  }

  return (
    <div className="login">
      {showChange ? (
        <form className="panel stack" onSubmit={submitChange}>
          <div className="brand">
            <img className="logo-login" src="/logo.png" alt="CareNexa" />
            <small>{forced ? 'Set a new password before continuing.' : 'Change your password, then sign in.'}</small>
          </div>
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required disabled={forced} /></label>
          <label>Current password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required autoComplete="current-password" /></label>
          <label>New password<input value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} type="password" required autoComplete="new-password" minLength={10} /></label>
          <label>Confirm new password<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" required autoComplete="new-password" minLength={10} /></label>
          <p className="muted">Use at least 10 characters, with a letter and a number.</p>
          <ErrorText error={error} />
          <button disabled={pending} type="submit">{pending ? 'Updating…' : 'Update password'}</button>
          {forced ? <button className="secondary" type="button" onClick={logout}>Sign out</button> : <button className="secondary" type="button" onClick={() => { setChanging(false); setError(null) }}>Back to sign in</button>}
        </form>
      ) : (
        <form className="panel stack" onSubmit={submitSignIn}>
          <div className="brand">
            <img className="logo-login" src="/logo.png" alt="CareNexa" />
            <small>Connect. Understand. Engage. Grow.</small>
          </div>
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label>
          <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required autoComplete="current-password" /></label>
          <ErrorText error={error} />
          <button disabled={pending} type="submit">{pending ? 'Signing in…' : 'Sign in'}</button>
          <button className="secondary" type="button" onClick={() => { setChanging(true); setError(null); setNextPassword(''); setConfirmPassword('') }}>Change password</button>
        </form>
      )}
    </div>
  )
}

function Guard({ children, module }) {
  const { user, ready, can } = useSession()
  const location = useLocation()
  if (!ready) return <p className="main">Loading…</p>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.mustChangePassword) return <Navigate to="/login" replace />
  return (
    <Layout>
      {module && !can(module) ? <p>You do not have access to this module.</p> : children}
    </Layout>
  )
}

export function App() {
  const { user, ready } = useSession()
  if (!ready) return <p className="main">Loading…</p>
  return (
    <Routes>
      <Route path="/login" element={user && !user.mustChangePassword ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/account/password" element={<Guard><PasswordPage /></Guard>} />
      <Route path="/" element={<Guard module="dashboard"><DashboardPage /></Guard>} />
      <Route path="/customers" element={<Guard module="customers"><CustomersPage /></Guard>} />
      <Route path="/customers/:id" element={<Guard module="customers"><CustomerProfilePage /></Guard>} />
      <Route path="/segments" element={<Guard module="segments"><SegmentsPage /></Guard>} />
      <Route path="/orders" element={<Guard module="orders"><OrdersPage /></Guard>} />
      <Route path="/dermtechs" element={<Guard module="dermtechs"><DermtechsPage /></Guard>} />
      <Route path="/commissions" element={<Guard module="commissions"><CommissionPage /></Guard>} />
      <Route path="/catalog" element={<Guard module="catalog"><CatalogPage /></Guard>} />
      <Route path="/inventory" element={<Guard module="inventory"><InventoryPage /></Guard>} />
      <Route path="/marketing" element={<Guard module="marketing"><MarketingPage /></Guard>} />
      <Route path="/promotions" element={<Guard module="promotions"><PromotionsPage /></Guard>} />
      <Route path="/analytics" element={<Guard module="analytics"><AnalyticsPage /></Guard>} />
      <Route path="/insights" element={<Guard module="insights"><InsightsPage /></Guard>} />
      <Route path="/reports" element={<Guard module="reports"><ReportsPage /></Guard>} />
      <Route path="/users" element={<Guard module="users"><UsersPage /></Guard>} />
      <Route path="/audit" element={<Guard module="audit"><AuditPage /></Guard>} />
      <Route path="/settings" element={<Guard module="settings"><SettingsPage /></Guard>} />
      <Route path="/settings/business" element={<Guard module="business"><BusinessPage /></Guard>} />
      <Route path="/settings/payments" element={<Guard module="payments"><PaymentMethodsPage /></Guard>} />
      <Route path="/access" element={<Guard module="access"><AccessPage /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
