import { useEffect, useState } from 'react'

const STATUS_OPTIONS = ['未着手', '対応中', '問題発生中', '完了']
const WEATHER_OPTIONS = ['晴れ', '曇り', '雨']

// タスク詳細画面（新規作成・編集の両対応）
export default function TaskModal({
  task,            // 編集対象。新規の場合は { project_id } のみ
  tasks = [],      // 同一プロジェクトのタスク（親・先行タスク選択用）
  users = [],
  dependencies = [],
  issues = [],
  onSave,
  onDelete,
  onClose,
  onAddDependency,
  onRemoveDependency,
  onAddIssue,
}) {
  const isNew = !task.id
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [issueTitle, setIssueTitle] = useState('')
  const [predecessorId, setPredecessorId] = useState('')

  useEffect(() => {
    setForm({
      name: task.name || '',
      planned_start_date: task.planned_start_date || '',
      planned_end_date: task.planned_end_date || '',
      actual_start_date: task.actual_start_date || '',
      actual_end_date: task.actual_end_date || '',
      assignee_id: task.assignee_id || '',
      parent_id: task.parent_id || '',
      status: task.status || '未着手',
      weather: task.weather || '晴れ',
      progress_rate: task.progress_rate ?? 0,
      is_milestone: task.is_milestone || false,
      planned_manhour: task.planned_manhour ?? 0,
      description: task.description || '',
      completion_criteria: task.completion_criteria || '',
      memo: task.memo || '',
      handover_note: task.handover_note || '',
    })
  }, [task])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const payload = {
      ...form,
      assignee_id: form.assignee_id || null,
      parent_id: form.parent_id || null,
      planned_start_date: form.planned_start_date || null,
      planned_end_date: form.planned_end_date || null,
      actual_start_date: form.actual_start_date || null,
      actual_end_date: form.actual_end_date || null,
      progress_rate: Number(form.progress_rate),
      planned_manhour: Number(form.planned_manhour),
    }
    try {
      await onSave(task, payload)
    } catch (err) {
      setError(err.message)
    }
  }

  const myDeps = dependencies.filter((d) => d.successor_id === task.id)
  const taskName = (id) => tasks.find((t) => t.id === id)?.name || '(不明)'
  const taskIssues = issues.filter((i) => i.task_id === task.id)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{isNew ? 'タスク登録' : 'タスク詳細'}</h2>
        <div className="form-grid">
          <label className="field full">
            <span>タスク名 *</span>
            <input value={form.name || ''} onChange={set('name')} required />
          </label>
          <label className="field">
            <span>予定開始日</span>
            <input type="date" value={form.planned_start_date || ''} onChange={set('planned_start_date')} />
          </label>
          <label className="field">
            <span>予定終了日（期日）</span>
            <input type="date" value={form.planned_end_date || ''} onChange={set('planned_end_date')} />
          </label>
          <label className="field">
            <span>実績開始日</span>
            <input type="date" value={form.actual_start_date || ''} onChange={set('actual_start_date')} />
          </label>
          <label className="field">
            <span>実績終了日</span>
            <input type="date" value={form.actual_end_date || ''} onChange={set('actual_end_date')} />
          </label>
          <label className="field">
            <span>担当者</span>
            <select value={form.assignee_id || ''} onChange={set('assignee_id')}>
              <option value="">（未割当）</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>親タスク</span>
            <select value={form.parent_id || ''} onChange={set('parent_id')}>
              <option value="">（なし）</option>
              {tasks.filter((t) => t.id !== task.id).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>状況</span>
            <select value={form.status || '未着手'} onChange={set('status')}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="field">
            <span>進行状況（天気）</span>
            <select value={form.weather || '晴れ'} onChange={set('weather')}>
              {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
          <label className="field">
            <span>進捗率: {form.progress_rate}%</span>
            <input type="range" min="0" max="100" step="5"
                   value={form.progress_rate ?? 0} onChange={set('progress_rate')} />
          </label>
          <label className="field">
            <span>予定工数（人時）</span>
            <input type="number" min="0" step="0.5" value={form.planned_manhour ?? 0} onChange={set('planned_manhour')} />
          </label>
          <label className="field">
            <span style={{ visibility: 'hidden' }}>マイルストーン</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={form.is_milestone || false} onChange={set('is_milestone')} />
              マイルストーンとして表示
            </label>
          </label>
          <label className="field full">
            <span>内容</span>
            <textarea rows={2} value={form.description || ''} onChange={set('description')} />
          </label>
          <label className="field full">
            <span>完了条件</span>
            <textarea rows={2} value={form.completion_criteria || ''} onChange={set('completion_criteria')} />
          </label>
          <label className="field full">
            <span>メモ</span>
            <textarea rows={2} value={form.memo || ''} onChange={set('memo')} />
          </label>
          <label className="field full">
            <span>前後タスクへの引き継ぎ情報</span>
            <textarea rows={2} value={form.handover_note || ''} onChange={set('handover_note')} />
          </label>
        </div>

        {!isNew && (
          <>
            <h3 style={{ margin: '8px 0' }}>先行タスク（関連線）</h3>
            {myDeps.length === 0 && <div className="muted" style={{ marginBottom: 6 }}>設定なし</div>}
            {myDeps.map((d) => (
              <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span>← {taskName(d.predecessor_id)}</span>
                <button type="button" className="small danger" onClick={() => onRemoveDependency(d.id)}>解除</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <select value={predecessorId} onChange={(e) => setPredecessorId(e.target.value)} style={{ flex: 1 }}>
                <option value="">先行タスクを選択...</option>
                {tasks.filter((t) => t.id !== task.id).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button type="button" className="small" disabled={!predecessorId}
                      onClick={() => { onAddDependency(predecessorId, task.id); setPredecessorId('') }}>
                追加
              </button>
            </div>

            <h3 style={{ margin: '14px 0 8px' }}>課題</h3>
            {taskIssues.map((i) => (
              <div key={i.id} style={{ marginBottom: 4 }}>
                <span className={`badge status-${i.status}`}>{i.status}</span> {i.title}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input placeholder="新しい課題のタイトル" value={issueTitle}
                     onChange={(e) => setIssueTitle(e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="small" disabled={!issueTitle.trim()}
                      onClick={() => { onAddIssue(task.id, issueTitle.trim()); setIssueTitle('') }}>
                課題追加
              </button>
            </div>
          </>
        )}

        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          {!isNew && (
            <button type="button" className="danger"
                    onClick={() => { if (confirm('このタスクを削除しますか？')) onDelete(task) }}>
              削除
            </button>
          )}
          <div className="spacer" />
          <button type="button" onClick={onClose}>キャンセル</button>
          <button type="submit" className="primary">{isNew ? '登録' : '保存'}</button>
        </div>
      </form>
    </div>
  )
}
