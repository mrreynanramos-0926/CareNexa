import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'

const SessionContext = createContext(null)

const RANK = { none: 0, view: 1, manage: 2 }

async function loadGrants() {
  const result = await api('/api/access')
  return result.data.grants || {}
}

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null)
  const [access, setAccess] = useState({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = sessionStorage.getItem('token')
    if (!token) {
      setReady(true)
      return
    }
    api('/api/auth/me')
      .then(async (result) => {
        setUser(result.data)
        if (!result.data.mustChangePassword) setAccess(await loadGrants())
      })
      .catch(() => sessionStorage.removeItem('token'))
      .finally(() => setReady(true))
  }, [])

  const value = useMemo(() => ({
    user,
    access,
    ready,
    can(module, level = 'view') {
      return (RANK[access[module]] || 0) >= (RANK[level] || 1)
    },
    async login(email, password) {
      const result = await api('/api/auth/login', { method: 'POST', body: { email, password } })
      sessionStorage.setItem('token', result.data.token)
      setUser(result.data.user)
      if (result.data.user.mustChangePassword) setAccess({})
      else setAccess(await loadGrants())
      return result.data.user
    },
    async changePassword(currentPassword, newPassword) {
      await api('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } })
      const me = await api('/api/auth/me')
      setUser(me.data)
      setAccess(await loadGrants())
      return me.data
    },
    async logout() {
      try { await api('/api/auth/logout', { method: 'POST' }) } catch { /* token may already be expired */ }
      sessionStorage.removeItem('token')
      setUser(null)
      setAccess({})
    },
    refresh(next) { setUser(next) },
    async reloadAccess() {
      setAccess(await loadGrants())
    },
  }), [user, access, ready])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  return useContext(SessionContext)
}
