import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, downloadFile } from '../api'

function ProjectModal({ project, users, organizations, onSave, onClose }) {
  const isNew = !project.id
  const [form, setForm] = useState({
    name: project.name || '',
    description: project.description || '',
    planned_start_date: project.planned_start_date || '',
    planned_end_date: project.planned_end_date || '',
    organization_id: project.organization_id || '',
    member_ids: (project.members || []).map((m) => m.id),
  })
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const toggleMember = (id) => setForm((f) => ({
    ...f,
    member_ids: f.member_ids.includes(id)
      ? f.member_ids.filter((m) => m !== id)
      : [...f.member_ids, id],
  }))

  const submit = async (e) => {
    e.preventDefault()
    try {
      await onSave({
        ...form,
        planned_start_date: form.planned_start_date || null,
        planned_end_date: form.planned_end_date || null,
        organization_id: form.organization_id || null,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{isNew ? 'プロジェクト登録' : 'プロジェクト編集'}</h2>
        <div className="form-grid">
          <label className="field full">
            <span>プロジェクト名 *</span>
            <input value={form.name} onChange={set('name')} required />
          </label>
          <label className="field">
            <span>開始予定日</span>
            <input type="date" value={form.planned_start_date} onChange={set('planned_start_date')} />
          </label>
          <label className="field">
            <span>終了予定日</span>
            <input type="date" value={form.planned_end_date} onChange={set('planned_end_date')} />
          </label>
          <label className="field full">
            <span>組織</span>
            <select value={form.organization_id} onChange={set('organization_id')}>
              <option value="">（未設定）</option>
              {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="field full">
            <span>概要</span>
            <textarea rows={2} value={form.description} onChange={set('description')} />
          </label>
          <div className="full">
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>メンバー</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
              {users.map((u) => (
                <label key={u.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="checkbox" checked={form.member_ids.includes(u.id)}
                         onChange={() => toggleMember(u.id)} />
                  {u.name}
                </label>
              ))}
            </div>
          </div>
        </div>
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

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [orgFilter, setOrgFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const load = async (org = orgFilter) => {
    const query = org ? `?organization_id=${org}` : ''
    const [p, u, o] = await Promise.all([
      api.get(`/api/projects${query}`),
      api.get('/api/users'),
      api.get('/api/organizations'),
    ])
    setProjects(p)
    setUsers(u)
    setOrganizations(o)
  }

  useEffect(() => { load().catch((e) => setError(e.message)) }, [orgFilter])

  const save = async (form) => {
    if (editing.id) {
      await api.put(`/api/projects/${editing.id}`, form)
    } else {
      await api.post('/api/projects', form)
    }
    setEditing(null)
    await load()
  }

  const duplicate = async (p) => {
    if (!confirm(`「${p.name}」を複製しますか？（タスク・関連線も複製されます）`)) return
    await api.post(`/api/projects/${p.id}/duplicate`)
    await load()
  }

  const remove = async (p) => {
    if (!confirm(`「${p.name}」を削除しますか？タスクもすべて削除されます。`)) return
    await api.delete(`/api/projects/${p.id}`)
    await load()
  }

  return (
    <div>
      <h1 className="page-title">プロジェクト管理</h1>
      <div className="toolbar">
        <select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
          <option value="">すべての組織</option>
          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <div className="spacer" />
        <button className="primary" onClick={() => setEditing({})}>+ プロジェクト登録</button>
      </div>
      {error && <div className="error-text">{error}</div>}
      <table className="data">
        <thead>
          <tr>
            <th>プロジェクト名</th>
            <th>期間</th>
            <th>組織</th>
            <th>メンバー</th>
            <th style={{ width: 320 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td><Link to={`/projects/${p.id}/gantt`}>{p.name}</Link></td>
              <td>{p.planned_start_date || '-'} 〜 {p.planned_end_date || '-'}</td>
              <td>{organizations.find((o) => o.id === p.organization_id)?.name || '-'}</td>
              <td>{(p.members || []).map((m) => m.name).join(', ')}</td>
              <td>
                <Link to={`/projects/${p.id}/gantt`}><button className="small primary">ガントチャート</button></Link>{' '}
                <button className="small" onClick={() => setEditing(p)}>編集</button>{' '}
                <button className="small" onClick={() => duplicate(p)}>複製</button>{' '}
                <button className="small" onClick={() => downloadFile(`/api/projects/${p.id}/export/csv`, `${p.name}.csv`)}>CSV</button>{' '}
                <button className="small danger" onClick={() => remove(p)}>削除</button>
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr><td colSpan={5} className="muted">プロジェクトがありません</td></tr>
          )}
        </tbody>
      </table>
      {editing && (
        <ProjectModal project={editing} users={users} organizations={organizations}
                      onSave={save} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
