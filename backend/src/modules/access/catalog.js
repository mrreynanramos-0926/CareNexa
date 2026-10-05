const ROLES = ['ADMIN', 'MANAGER', 'STAFF']
const LEVELS = ['none', 'view', 'manage']
const RANK = { none: 0, view: 1, manage: 2 }

const MODULES = [
  { key: 'dashboard', label: 'Dashboard', group: 'Overview' },
  { key: 'customers', label: 'Customers', group: 'Customers' },
  { key: 'segments', label: 'Segments', group: 'Customers' },
  { key: 'orders', label: 'Orders', group: 'Operations' },
  { key: 'dermtechs', label: 'Dermtech', group: 'Operations' },
  { key: 'catalog', label: 'Products & Services', group: 'Operations' },
  { key: 'inventory', label: 'Inventory', group: 'Operations' },
  { key: 'marketing', label: 'Marketing', group: 'Marketing' },
  { key: 'promotions', label: 'Promotions', group: 'Marketing' },
  { key: 'analytics', label: 'Analytics', group: 'Intelligence' },
  { key: 'insights', label: 'AI Insights', group: 'Intelligence' },
  { key: 'reports', label: 'Reports', group: 'Intelligence' },
  { key: 'commissions', label: 'Commission', group: 'Intelligence' },
  { key: 'users', label: 'Users', group: 'Administration' },
  { key: 'audit', label: 'Audit Logs', group: 'Administration' },
  { key: 'business', label: 'Business', group: 'Administration' },
  { key: 'settings', label: 'Settings', group: 'Administration' },
  { key: 'payments', label: 'Payment methods', group: 'Administration' },
  { key: 'access', label: 'Access', group: 'Administration' },
]

const DEFAULTS = {
  ADMIN: Object.fromEntries(MODULES.map((item) => [item.key, 'manage'])),
  MANAGER: {
    dashboard: 'manage', customers: 'manage', segments: 'manage', orders: 'manage',
    dermtechs: 'manage', catalog: 'manage', inventory: 'manage', marketing: 'manage',
    promotions: 'manage', analytics: 'manage', insights: 'manage', reports: 'manage',
    commissions: 'manage', users: 'none', audit: 'none', business: 'none',
    settings: 'none', payments: 'none', access: 'none',
  },
  STAFF: {
    dashboard: 'view', customers: 'manage', segments: 'view', orders: 'manage',
    dermtechs: 'view', catalog: 'view', inventory: 'view', marketing: 'none',
    promotions: 'none', analytics: 'none', insights: 'none', reports: 'none',
    commissions: 'none', users: 'none', audit: 'none', business: 'none',
    settings: 'none', payments: 'none', access: 'none',
  },
}

module.exports = { ROLES, LEVELS, RANK, MODULES, DEFAULTS }
