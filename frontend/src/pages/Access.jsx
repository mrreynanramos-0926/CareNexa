import { Fragment, useEffect, useState } from 'react'
import { api, roleLabel } from '../api'
import { ErrorText, Page } from '../components'
import { useSession } from '../session'

const LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'view', label: 'View' },
  { value: 'manage', label: 'Manage' },
]

export function AccessPage() {
  const { reloadAccess } = useSession()
  const [matrix, setMatrix] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState('')
  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')

  useEffect(() => {
    api('/api/access/matrix').then((result) => setMatrix(result.data)).catch(setError)
  }, [])

  function setLevel(role, moduleKey, access) {
    setSaved('')
    setMatrix((current) => ({
      ...current,
      grants: {
        ...current.grants,
        [role]: { ...current.grants[role], [moduleKey]: access },
      },
    }))
  }

  if (!matrix) return <Page title="Access"><ErrorText error={error} />{error ? null : <p>Loading access…</p>}</Page>

  const groups = []
  for (const item of matrix.modules) {
    const group = groups.find((entry) => entry.label === item.group)
    if (group) group.items.push(item)
    else groups.push({ label: item.group, items: [item] })
  }

  return (
    <Page title="Access" lede="View lets a role open the module. Manage also lets them add and change its records. An admin always keeps Manage on Access.">
      <ErrorText error={error} />
      {saved ? <p>{saved}</p> : null}
      <form className="panel filters role-create" onSubmit={async (event) => {
        event.preventDefault()
        try {
          const result = await api('/api/access/roles', { method: 'POST', body: { name: roleName, description: roleDescription } })
          setMatrix(result.data)
          setRoleName('')
          setRoleDescription('')
          setSaved('Role added. Set what it can open, then save access.')
        } catch (err) { setError(err) }
      }}>
        <label>New role
          <input value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="Reception" required />
        </label>
        <label>Description
          <input value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} placeholder="Front desk" />
        </label>
        <button type="submit">Add role</button>
      </form>
      <form className="panel" onSubmit={async (event) => {
        event.preventDefault()
        const grants = []
        for (const role of matrix.roles) {
          for (const item of matrix.modules) grants.push({ role, module: item.key, access: matrix.grants[role][item.key] })
        }
        try {
          const result = await api('/api/access/matrix', { method: 'PUT', body: { grants } })
          setMatrix(result.data)
          await reloadAccess()
          setSaved('Access saved.')
        } catch (err) { setError(err) }
      }}>
        <table className="access-table">
          <thead>
            <tr>
              <th>Module</th>
              {matrix.roles.map((role) => <th key={role}>{roleLabel(role)}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.label}>
                <tr className="access-group"><th colSpan={matrix.roles.length + 1}>{group.label}</th></tr>
                {group.items.map((item) => (
                  <tr key={item.key}>
                    <td>{item.label}</td>
                    {matrix.roles.map((role) => {
                      const locked = role === 'ADMIN' && item.key === 'access'
                      return (
                        <td key={role}>
                          <div className="access-choice">
                            {LEVELS.map((level) => (
                              <button
                                key={level.value}
                                type="button"
                                className={matrix.grants[role][item.key] === level.value ? 'active' : ''}
                                disabled={locked}
                                onClick={() => setLevel(role, item.key, level.value)}
                              >{level.label}</button>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        <button type="submit">Save access</button>
      </form>
    </Page>
  )
}
