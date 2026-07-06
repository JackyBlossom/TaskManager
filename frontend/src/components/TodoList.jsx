const STATUS_OPTIONS = ['未着手', '対応中', '問題発生中', '完了']

// ToDoリスト表示（期限切れ強調・状態のインライン変更）
export default function TodoList({ tasks, searchText = '', showProject = false, projects = [], onOpen, onStatusChange }) {
  const today = new Date().toISOString().slice(0, 10)
  const search = searchText.trim().toLowerCase()
  const filtered = tasks.filter((t) => !search || t.name.toLowerCase().includes(search))
  const projectName = (id) => projects.find((p) => p.id === id)?.name || '-'

  const sorted = [...filtered].sort((a, b) =>
    String(a.planned_end_date || '9999').localeCompare(String(b.planned_end_date || '9999')))

  return (
    <table className="data">
      <thead>
        <tr>
          <th>タスク名</th>
          {showProject && <th>プロジェクト</th>}
          <th>担当者</th>
          <th>予定開始</th>
          <th>期限</th>
          <th>状態</th>
          <th>進捗</th>
          <th>実績（開始/終了）</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) => {
          const overdue = t.status !== '完了' && t.planned_end_date && t.planned_end_date < today
          return (
            <tr key={t.id} style={overdue ? { background: '#fef2f2' } : undefined}>
              <td style={{ cursor: onOpen ? 'pointer' : undefined, color: onOpen ? 'var(--primary)' : undefined }}
                  onClick={() => onOpen && onOpen(t)}>
                {t.is_milestone ? '◆ ' : ''}{t.name}
                {overdue && <strong style={{ color: 'var(--danger)', marginLeft: 6 }}>期限超過</strong>}
              </td>
              {showProject && <td>{projectName(t.project_id)}</td>}
              <td>{t.assignee ? t.assignee.name : '-'}</td>
              <td>{t.planned_start_date || '-'}</td>
              <td style={overdue ? { color: 'var(--danger)', fontWeight: 'bold' } : undefined}>
                {t.planned_end_date || '-'}
              </td>
              <td>
                {onStatusChange ? (
                  <select value={t.status} onChange={(e) => onStatusChange(t, e.target.value)}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span className={`badge status-${t.status}`}>{t.status}</span>
                )}
              </td>
              <td>
                <div className="progress-bar-bg" style={{ width: 70 }}>
                  <div className="progress-bar-fg" style={{ width: `${t.progress_rate}%` }} />
                </div>
                <span style={{ fontSize: 12 }}>{t.progress_rate}%</span>
              </td>
              <td className="muted">{t.actual_start_date || '-'} / {t.actual_end_date || '-'}</td>
            </tr>
          )
        })}
        {sorted.length === 0 && (
          <tr><td colSpan={showProject ? 8 : 7} className="muted">タスクがありません</td></tr>
        )}
      </tbody>
    </table>
  )
}
