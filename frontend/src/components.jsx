import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { api, roleLabel } from './api'
import { useSession } from './session'

const GROUPS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: 'dashboard', module: 'dashboard' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { label: 'Customers', path: '/customers', icon: 'customers', module: 'customers' },
      { label: 'Segments', path: '/segments', icon: 'segments', module: 'segments' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Orders', path: '/orders', icon: 'orders', module: 'orders' },
      { label: 'Dermtech', path: '/dermtechs', icon: 'dermtech', module: 'dermtechs' },
      { label: 'Products & Services', path: '/catalog', icon: 'catalog', module: 'catalog' },
      { label: 'Inventory', path: '/inventory', icon: 'inventory', module: 'inventory' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { label: 'Marketing', path: '/marketing', icon: 'marketing', module: 'marketing' },
      { label: 'Promotions', path: '/promotions', icon: 'promotions', module: 'promotions' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Analytics', path: '/analytics', icon: 'analytics', module: 'analytics' },
      { label: 'AI Insights', path: '/insights', icon: 'insights', module: 'insights' },
      { label: 'Reports', path: '/reports', icon: 'reports', module: 'reports' },
      { label: 'Commission', path: '/commissions', icon: 'commission', module: 'commissions' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', path: '/users', icon: 'users', module: 'users' },
      { label: 'Audit Logs', path: '/audit', icon: 'audit', module: 'audit' },
      { label: 'Business', path: '/settings/business', icon: 'business', module: 'business' },
      { label: 'Settings', path: '/settings', icon: 'settings', module: 'settings' },
      { label: 'Payment methods', path: '/settings/payments', icon: 'payments', module: 'payments' },
      { label: 'Access', path: '/access', icon: 'access', module: 'access' },
    ],
  },
]

export function Layout({ children }) {
  const { user, logout, can } = useSession()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => sessionStorage.getItem('nav-collapsed') === '1')
  const [businessName, setBusinessName] = useState('')
  useEffect(() => {
    api('/api/business').then((result) => setBusinessName(result.data.tradeName || result.data.legalName)).catch(() => {})
  }, [])
  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.module)),
  })).filter((group) => group.items.length > 0)

  function toggleMenu() {
    setCollapsed((value) => {
      const next = !value
      sessionStorage.setItem('nav-collapsed', next ? '1' : '0')
      return next
    })
  }

  return (
    <div className={collapsed ? 'shell collapsed' : 'shell'}>
      <header className="topbar">
        <div className="brand-lockup">
          <img className="logo" src="/logo.png" alt="CareNexa" />
          {businessName ? <strong>{businessName}</strong> : null}
        </div>
        <AccountMenu
          user={user}
          onPassword={() => navigate('/account/password')}
          onLogout={logout}
        />
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-head">
            <button type="button" className="collapse" aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} onClick={toggleMenu}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <nav className="nav-links" aria-label="Main">
            {groups.map((group) => (
              <div className="nav-group" key={group.label}>
                <div className="nav-group-label">{group.label}</div>
                <div className="nav-group-items">
                  {group.items.map((item) => (
                    <NavLink key={item.path} to={item.path} end title={item.label}>
                      <NavIcon name={item.icon} />
                      <span className="nav-label">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <main className="main">{children}</main>
      </div>
    </div>
  )
}

function NavIcon({ name }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'dashboard' && (
        <>
          <rect {...common} x="3" y="3" width="7" height="7" rx="1" />
          <rect {...common} x="14" y="3" width="7" height="7" rx="1" />
          <rect {...common} x="3" y="14" width="7" height="7" rx="1" />
          <rect {...common} x="14" y="14" width="7" height="7" rx="1" />
        </>
      )}
      {name === 'customers' && (
        <>
          <circle {...common} cx="9" cy="8" r="3" />
          <circle {...common} cx="17" cy="9" r="2.2" />
          <path {...common} d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
          <path {...common} d="M14.5 14.7c1.8.3 3.2 1.5 3.8 4.3" />
        </>
      )}
      {name === 'segments' && (
        <>
          <circle {...common} cx="12" cy="12" r="8" />
          <path {...common} d="M12 4.5V12l6 3" />
        </>
      )}
      {name === 'dermtech' && (
        <>
          <circle {...common} cx="12" cy="8" r="3" />
          <path {...common} d="M5.5 19c1.2-2.6 3.2-4 6.5-4s5.3 1.4 6.5 4" />
        </>
      )}
      {name === 'commission' && (
        <>
          <path {...common} d="M12 4v16M16 8H9.5a2.5 2.5 0 000 5H14a2.5 2.5 0 010 5H8" />
        </>
      )}
      {name === 'orders' && (
        <>
          <path {...common} d="M7 3.5h10v17H7z" />
          <path {...common} d="M10 8h4M10 12h4M10 16h3" />
        </>
      )}
      {name === 'catalog' && (
        <>
          <path {...common} d="M12 3.5l8 4.2v9.1l-8 4.2-8-4.2V7.7z" />
          <path {...common} d="M12 12.2l8-4.2M12 12.2v8.6M12 12.2L4 8" />
        </>
      )}
      {name === 'inventory' && (
        <>
          <path {...common} d="M3 8l9-4 9 4-9 4z" />
          <path {...common} d="M3 8v9l9 4V12" />
          <path {...common} d="M21 8v9l-9 4" />
        </>
      )}
      {name === 'marketing' && (
        <>
          <path {...common} d="M4 10v4h3l8 4.5V5.5L7 10H4z" />
          <path {...common} d="M18.5 9.2a3.6 3.6 0 010 5.6" />
        </>
      )}
      {name === 'promotions' && (
        <>
          <path {...common} d="M20 12.2L12 20.2 4 12.2V4.2h8z" />
          <circle cx="8.2" cy="8.2" r="1.1" fill="currentColor" />
        </>
      )}
      {name === 'analytics' && (
        <>
          <path {...common} d="M4 19V5M4 19h16" />
          <path {...common} d="M8 15l3.5-4.5 3 2.8 5-6.3" />
        </>
      )}
      {name === 'insights' && (
        <>
          <path {...common} d="M9 18h6M10 21h4" />
          <path {...common} d="M8 14.5a6 6 0 118 0c-.6.7-1 1.5-1 2.5H9c0-1-.4-1.8-1-2.5z" />
        </>
      )}
      {name === 'reports' && (
        <>
          <path {...common} d="M7 3.5h7l5 5V20.5H7z" />
          <path {...common} d="M14 3.5v5h5M10 13h6M10 17h4" />
        </>
      )}
      {name === 'users' && (
        <>
          <circle {...common} cx="12" cy="8" r="3" />
          <path {...common} d="M5 19.5c1.4-3 3.6-4.5 7-4.5s5.6 1.5 7 4.5" />
        </>
      )}
      {name === 'audit' && (
        <>
          <path {...common} d="M8 4h6v2H8z" />
          <path {...common} d="M7 4H5.5v16h13V4H15" />
          <path {...common} d="M9 12.5l2 2 4-4" />
        </>
      )}
      {name === 'payments' && (
        <>
          <rect {...common} x="3" y="6" width="18" height="12" rx="2" />
          <path {...common} d="M3 10h18M7 15h4" />
        </>
      )}
      {name === 'business' && (
        <>
          <path {...common} d="M4 20V9l8-5 8 5v11" />
          <path {...common} d="M9 20v-6h6v6" />
        </>
      )}
      {name === 'access' && (
        <>
          <rect {...common} x="4" y="4" width="16" height="16" rx="2" />
          <path {...common} d="M8 12h8M12 8v8" />
        </>
      )}
      {name === 'settings' && (
        <>
          <circle {...common} cx="12" cy="12" r="3" />
          <path {...common} d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18" />
        </>
      )}
    </svg>
  )
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U'
}

function AccountMenu({ user, onPassword, onLogout }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function closeOnOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  return (
    <div className="account" ref={menuRef}>
      <button
        type="button"
        className="avatar"
        aria-label={`${user.name}, ${roleLabel(user.role)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {initials(user.name)}
      </button>
      {open ? (
        <div className="account-menu" role="menu">
          <div className="account-id">
            <strong>{user.name}</strong>
            <span>{roleLabel(user.role)}</span>
          </div>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onPassword() }}>Change password</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onLogout() }}>Log out</button>
        </div>
      ) : null}
    </div>
  )
}

export function Page({ title, lede, action, children }) {
  return (
    <section>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {lede ? <p className="muted">{lede}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Badge({ value }) {
  return <span className={`badge ${String(value || '').toLowerCase()}`}>{String(value || '').replaceAll('_', ' ')}</span>
}

export function Modal({ title, children, onClose, className = '' }) {
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className={`modal ${className}`.trim()} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="page-head">
          <h2>{title}</h2>
          <button className="secondary" type="button" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ErrorText({ error }) {
  if (!error) return null
  return <p className="error">{error.message || String(error)}</p>
}

export function SearchSelect({ value, onChange, options, placeholder = 'Type to search', required = false, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [box, setBox] = useState(null)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const selected = options.find((option) => option.value === value)
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !value ? 'Select an item from the list.' : '')
  }, [required, value])

  useEffect(() => {
    if (!open) return undefined
    function place() {
      const rect = inputRef.current?.getBoundingClientRect()
      if (!rect) return
      const menuHeight = 220
      const below = window.innerHeight - rect.bottom
      const top = below < 160 && rect.top > below ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4
      setBox({ top, left: rect.left, width: rect.width })
    }
    function closeOnOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('mousedown', closeOnOutside)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('mousedown', closeOnOutside)
    }
  }, [open])

  function choose(option) {
    onChange(option.value)
    setQuery('')
    setOpen(false)
  }

  function openList() {
    if (disabled) return
    const index = options.findIndex((option) => option.value === value)
    setHighlight(index >= 0 ? index : 0)
    setQuery('')
    setOpen(true)
  }

  return (
    <div className={`combo ${disabled ? 'disabled' : ''}`} ref={rootRef}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : (selected?.label || '')}
        onFocus={openList}
        onClick={() => { if (!open) openList() }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setHighlight(0) }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (!open) openList()
            else setHighlight((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlight((index) => Math.max(index - 1, 0))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            if (open && filtered[highlight]) choose(filtered[highlight])
          } else if (event.key === 'Escape') {
            setOpen(false)
            setQuery('')
          }
        }}
      />
      {open && !disabled && box ? (
        <ul className="combo-list" role="listbox" style={{ top: box.top, left: box.left, width: box.width }}>
          {filtered.length === 0 ? <li className="combo-empty">No matches</li> : filtered.map((option, index) => (
            <li
              key={`${option.value}-${option.label}`}
              role="option"
              aria-selected={option.value === value}
              className={index === highlight ? 'active' : ''}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={(event) => { event.preventDefault(); choose(option) }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
