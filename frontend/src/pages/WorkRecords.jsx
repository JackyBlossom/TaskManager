import { useEffect, useState } from 'react'
import { api } from '../api'

// 工数管理（予実績入力・集計）
export default function WorkRecords({ user }) {
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [tasks, setTasks] = useState([])
  const [summary, setSummary] = useState([])
  const [records, setRecords] = useState([])
  const [projectId, setProjectId] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    task_id: '',
    user_id: user.id,
    date: new Date().toISOString().slice(0, 10),
    actual_manhour: '',
    note: '',
  })

  const load = async () => {
    const q = projectId ? `?project_id=${projectId}` : ''
    const [p, u, t, s, r] = await Promise.all([
      api.get('/api/projects'),
      api.get('/api/users'),
      api.get(`/api/tasks${projectId ? `?project_id=${projectId}` : ''}`),
      api.get(`/api/workrecords/summary${q}`),
      api.get(`/api/workrecords${q}`),
    ])
    setProjects(p)
    setUsers(u)
    setTasks(t)
    setSummary(s)
    setRecords(r)
  }

  useEffect(() => { load().catch((e) => setError(e.message)) }, [projectId])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/api/workrecords', {
        ...form,
        actual_manhour: Number(form.actual_manhour),
      })
      setForm((f) => ({ ...f, actual_manhour: '', note: '' }))
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const removeRecord = async (r) => {
    if (!confirm('この実績を削除しますか？')) return
    await api.delete(`/api/workrecords/${r.id}`)
    await load()
  }

  const totalPlanned = summary.reduce((a, s) => a + s.planned_manhour, 0)
  const totalActual = summary.reduce((a, s) => a + s.actual_manhour, 0)
  const taskName = (id) => tasks.find((t) => t.id === id)?.name || '(不明)'
  const userName = (id) => users.find((u) => u.id === id)?.name || '(不明)'

  return (
    <div>
      <h1 className="page-title">工数管理</h1>
      <div className="toolbar">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">すべてのプロジェクト</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {error && <div className="error-text">{error}</div>}

      <div className="card">
        <h3>実績工数の入力（代理入力可）</h3>
        <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="field" style={{ minWidth: 220, marginBottom: 0 }}>
            <span>タスク *</span>
            <select value={form.task_id} required
                    onChange={(e) => setForm((f) => ({ ...f, task_id: e.target.value }))}>
              <option value="">選択してください</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>作業者</span>
            <select value={form.user_id}
                    onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>作業日</span>
            <input type="date" value={form.date} required
                   onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </label>
          <label className="field" style={{ width: 110, marginBottom: 0 }}>
            <span>工数（人時）*</span>
            <input type="number" min="0.25" step="0.25" value={form.actual_manhour} required
                   onChange={(e) => setForm((f) => ({ ...f, actual_manhour: e.target.value }))} />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
            <span>備考</span>
            <input value={form.note}
                   onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </label>
          <button className="primary">登録</button>
        </form>
      </div>

      <div className="card">
        <h3>予実集計（タスク別）　合計: 予定 {totalPlanned.toFixed(1)}h / 実績 {totalActual.toFixed(1)}h</h3>
        <table className="data">
          <thead>
            <tr><th>タスク</th><th>担当者</th><th>予定工数(h)</th><th>実績工数(h)</th><th>差分(h)</th></tr>
          </thead>
          <tbody>
            {summary.map((s) => {
              const diff = s.actual_manhour - s.planned_manhour
              return (
                <tr key={s.task_id}>
                  <td>{s.task_name}</td>
                  <td>{s.assignee_name || '-'}</td>
                  <td style={{ textAlign: 'right' }}>{s.planned_manhour.toFixed(1)}</td>
                  <td style={{ textAlign: 'right' }}>{s.actual_manhour.toFixed(1)}</td>
                  <td style={{ textAlign: 'right', color: diff > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                  </td>
                </tr>
              )
            })}
            {summary.length === 0 && <tr><td colSpan={5} className="muted">データがありません</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>実績履歴</h3>
        <table className="data">
          <thead>
            <tr><th>作業日</th><th>タスク</th><th>作業者</th><th>工数(h)</th><th>備考</th><th></th></tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{taskName(r.task_id)}</td>
                <td>{userName(r.user_id)}</td>
                <td style={{ textAlign: 'right' }}>{r.actual_manhour}</td>
                <td className="muted">{r.note}</td>
                <td><button className="small danger" onClick={() => removeRecord(r)}>削除</button></td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={6} className="muted">実績がありません</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
