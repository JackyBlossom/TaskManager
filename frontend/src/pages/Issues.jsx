import { useEffect, useState } from 'react'
import { api, downloadFile } from '../api'

const ISSUE_STATUS = ['未対応', '対応中', '完了']

// 課題管理表
export default function Issues() {
  const [issues, setIssues] = useState([])
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [projectId, setProjectId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const params = new URLSearchParams()
    if (projectId) params.set('project_id', projectId)
    if (statusFilter) params.set('status', statusFilter)
    const [i, p, u] = await Promise.all([
      api.get(`/api/issues?${params}`),
      api.get('/api/projects'),
      api.get('/api/users'),
    ])
    setIssues(i)
    setProjects(p)
    setUsers(u)
  }

  useEffect(() => { load().catch((e) => setError(e.message)) }, [projectId, statusFilter])

  const update = async (issue, patch) => {
    await api.put(`/api/issues/${issue.id}`, patch)
    await load()
  }

  const remove = async (issue) => {
    if (!confirm(`課題「${issue.title}」を削除しますか？`)) return
    await api.delete(`/api/issues/${issue.id}`)
    await load()
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <h1 className="page-title">課題管理表</h1>
      <div className="toolbar">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">すべてのプロジェクト</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">すべての状態</option>
          {ISSUE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="spacer" />
        <button onClick={() => downloadFile(`/api/issues/export/csv${projectId ? `?project_id=${projectId}` : ''}`, 'issues.csv')}>
          CSV出力
        </button>
      </div>
      {error && <div className="error-text">{error}</div>}
      <p className="muted" style={{ fontSize: 12 }}>
        課題の登録は、ガントチャートのタスク詳細画面から行えます。
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>課題</th><th>内容</th><th>状態</th><th>担当者</th><th>期日</th><th></th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => {
            const overdue = i.status !== '完了' && i.due_date && i.due_date < today
            return (
              <tr key={i.id} style={overdue ? { background: '#fef2f2' } : undefined}>
                <td>{i.title}</td>
                <td className="muted">{i.content}</td>
                <td>
                  <select value={i.status} onChange={(e) => update(i, { status: e.target.value })}>
                    {ISSUE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <select value={i.assignee_id || ''} onChange={(e) => update(i, { assignee_id: e.target.value || null })}>
                    <option value="">（未割当）</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </td>
                <td style={overdue ? { color: 'var(--danger)', fontWeight: 'bold' } : undefined}>
                  <input type="date" value={i.due_date || ''}
                         onChange={(e) => update(i, { due_date: e.target.value || null })} />
                </td>
                <td><button className="small danger" onClick={() => remove(i)}>削除</button></td>
              </tr>
            )
          })}
          {issues.length === 0 && (
            <tr><td colSpan={6} className="muted">課題はありません</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
