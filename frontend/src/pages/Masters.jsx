import { useEffect, useState } from 'react'
import { api } from '../api'

function UserModal({ target, organizations, onSave, onClose }) {
  const isNew = !target.id
  const [form, setForm] = useState({
    username: target.username || '',
    name: target.name || '',
    department: target.department || '',
    organization_id: target.organization_id || '',
    is_admin: target.is_admin || false,
    password: '',
  })
  const [error, setError] = useState('')
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      await onSave({ ...form, organization_id: form.organization_id || null })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{isNew ? 'アカウント登録' : 'アカウント編集'}</h2>
        <label className="field">
          <span>ログインID（ユーザー名）*</span>
          <input value={form.username} onChange={set('username')} required disabled={!isNew} />
        </label>
        <label className="field">
          <span>{isNew ? 'パスワード *' : 'パスワード（変更する場合のみ入力）'}</span>
          <input type="password" value={form.password} onChange={set('password')} required={isNew} />
        </label>
        <label className="field">
          <span>氏名 *</span>
          <input value={form.name} onChange={set('name')} required />
        </label>
        <label className="field">
          <span>部署</span>
          <input value={form.department} onChange={set('department')} />
        </label>
        <label className="field">
          <span>所属組織</span>
          <select value={form.organization_id} onChange={set('organization_id')}>
            <option value="">（未設定）</option>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={form.is_admin} onChange={set('is_admin')} />
          管理者権限
        </label>
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <div className="spacer" />
          <button type="button" onClick={onClose}>キャンセル</button>
          <button type="submit" className="primary">{isNew ? '登録' : '保存'}</button>
        </div>
      </form>
    </div>
  )
}

// マスタメンテナンス（ユーザー・組織）
export default function Masters({ user }) {
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [editingUser, setEditingUser] = useState(null)
  const [orgName, setOrgName] = useState('')
  const [orgParent, setOrgParent] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const [u, o] = await Promise.all([api.get('/api/users'), api.get('/api/organizations')])
    setUsers(u)
    setOrganizations(o)
  }

  useEffect(() => { load().catch((e) => setError(e.message)) }, [])

  const saveUser = async (form) => {
    if (editingUser.id) {
      const payload = { ...form }
      delete payload.username
      if (!payload.password) delete payload.password
      await api.put(`/api/users/${editingUser.id}`, payload)
    } else {
      await api.post('/api/users', form)
    }
    setEditingUser(null)
    await load()
  }

  const deleteUser = async (u) => {
    if (!confirm(`ユーザー「${u.name}」を削除しますか？`)) return
    try {
      await api.delete(`/api/users/${u.id}`)
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  const addOrg = async (e) => {
    e.preventDefault()
    await api.post('/api/organizations', { name: orgName, parent_id: orgParent || null })
    setOrgName('')
    setOrgParent('')
    await load()
  }

  const deleteOrg = async (o) => {
    if (!confirm(`組織「${o.name}」を削除しますか？`)) return
    try {
      await api.delete(`/api/organizations/${o.id}`)
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  const orgName_ = (id) => organizations.find((o) => o.id === id)?.name || '-'

  return (
    <div>
      <h1 className="page-title">マスタメンテナンス</h1>
      <div className="tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>アカウント管理</button>
        <button className={tab === 'orgs' ? 'active' : ''} onClick={() => setTab('orgs')}>組織管理</button>
      </div>
      {error && <div className="error-text">{error}</div>}

      {tab === 'users' && (
        <>
          <div className="toolbar">
            <div className="spacer" />
            <button className="primary" onClick={() => setEditingUser({})}>+ アカウント登録</button>
          </div>
          <table className="data">
            <thead>
              <tr><th>ログインID</th><th>氏名</th><th>部署</th><th>所属組織</th><th>権限</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.name}</td>
                  <td>{u.department}</td>
                  <td>{orgName_(u.organization_id)}</td>
                  <td>{u.is_admin ? <span className="badge status-対応中">管理者</span> : '一般'}</td>
                  <td>
                    <button className="small" onClick={() => setEditingUser(u)}>編集</button>{' '}
                    {u.id !== user.id && (
                      <button className="small danger" onClick={() => deleteUser(u)}>削除</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'orgs' && (
        <>
          <div className="card">
            <h3>組織の追加</h3>
            <form onSubmit={addOrg} style={{ display: 'flex', gap: 8 }}>
              <input placeholder="組織名（例: 開発1課）" value={orgName}
                     onChange={(e) => setOrgName(e.target.value)} required style={{ flex: 1 }} />
              <select value={orgParent} onChange={(e) => setOrgParent(e.target.value)}>
                <option value="">親組織なし</option>
                {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <button className="primary">追加</button>
            </form>
          </div>
          <table className="data">
            <thead>
              <tr><th>組織名</th><th>親組織</th><th></th></tr>
            </thead>
            <tbody>
              {organizations.map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td>{orgName_(o.parent_id)}</td>
                  <td><button className="small danger" onClick={() => deleteOrg(o)}>削除</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {editingUser && (
        <UserModal target={editingUser} organizations={organizations}
                   onSave={saveUser} onClose={() => setEditingUser(null)} />
      )}
    </div>
  )
}
