import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

const STATUS_COLORS = {
  未着手: '#94a3b8', 対応中: '#3b82f6', 問題発生中: '#ef4444', 完了: '#22c55e',
}

function StatusBar({ counts, total }) {
  if (!total) return <div className="muted">タスクなし</div>
  return (
    <div>
      <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden' }}>
        {Object.entries(counts).map(([status, count]) => count > 0 && (
          <div key={status} title={`${status}: ${count}件`}
               style={{ width: `${(count / total) * 100}%`, background: STATUS_COLORS[status] }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', fontSize: 12 }}>
        {Object.entries(counts).map(([status, count]) => (
          <span key={status}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: STATUS_COLORS[status], borderRadius: 2, marginRight: 4 }} />
            {status}: {count}件
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [projects, setProjects] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [projectId, setProjectId] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get('/api/projects'), api.get('/api/organizations')])
      .then(([p, o]) => { setProjects(p); setOrganizations(o) })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (projectId) params.set('project_id', projectId)
    else if (organizationId) params.set('organization_id', organizationId)
    api.get(`/api/dashboard?${params}`).then(setData).catch((e) => setError(e.message))
  }, [projectId, organizationId])

  if (error) return <div className="error-text">{error}</div>
  if (!data) return <div>読み込み中...</div>

  return (
    <div>
      <h1 className="page-title">ダッシュボード</h1>
      <div className="toolbar">
        <select value={organizationId} onChange={(e) => { setOrganizationId(e.target.value); setProjectId('') }}>
          <option value="">すべての組織</option>
          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">すべてのプロジェクト</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="dash-grid">
        <div className="stat-card">
          <div className="label">平均進捗率</div>
          <div className="value">{data.avg_progress}%</div>
          <div className="progress-bar-bg" style={{ marginTop: 8 }}>
            <div className="progress-bar-fg" style={{ width: `${data.avg_progress}%` }} />
          </div>
        </div>
        <div className="stat-card">
          <div className="label">タスク総数</div>
          <div className="value">{data.total_tasks}</div>
        </div>
        <div className="stat-card">
          <div className="label">遅延タスク</div>
          <div className="value" style={{ color: data.delayed_count > 0 ? 'var(--danger)' : 'var(--ok)' }}>
            {data.delayed_count}件
          </div>
        </div>
        <div className="stat-card">
          <div className="label">課題消化率</div>
          <div className="value">{data.issue_resolution_rate}%</div>
          <div className="muted" style={{ fontSize: 12 }}>{data.issue_closed} / {data.issue_total} 件完了</div>
        </div>
      </div>

      <div className="card">
        <h3>ステータス内訳</h3>
        <StatusBar counts={data.status_counts} total={data.total_tasks} />
      </div>

      <div className="card">
        <h3>遅延タスク一覧</h3>
        {data.delayed_tasks.length === 0 ? (
          <div className="muted">遅延タスクはありません 🎉</div>
        ) : (
          <table className="data">
            <thead>
              <tr><th>タスク名</th><th>期限</th><th>担当者</th><th></th></tr>
            </thead>
            <tbody>
              {data.delayed_tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td style={{ color: 'var(--danger)' }}>{t.planned_end_date}</td>
                  <td>{t.assignee_name || '-'}</td>
                  <td><Link to={`/projects/${t.project_id}/gantt`}>ガントで確認 →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>メンバー負荷状況（未完了タスク数）</h3>
        {data.member_loads.length === 0 ? (
          <div className="muted">対象データがありません</div>
        ) : (
          <table className="data">
            <thead>
              <tr><th>負荷</th><th>メンバー</th><th>未完了タスク数</th></tr>
            </thead>
            <tbody>
              {data.member_loads.map((m) => (
                <tr key={m.user_id}>
                  <td><span className={`load-dot load-${m.level}`} />{m.level === 'red' ? '高負荷' : m.level === 'yellow' ? 'やや負荷' : '問題なし'}</td>
                  <td>{m.name}</td>
                  <td>{m.open_tasks}件</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
