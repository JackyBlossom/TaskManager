import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import GanttChart, { fmtDate } from '../components/GanttChart.jsx'
import TodoList from '../components/TodoList.jsx'

// 個人ガントチャート / ToDoリスト
export default function Personal({ user }) {
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(user.id)
  const [tasks, setTasks] = useState([])
  const [view, setView] = useState('gantt')
  const [scale, setScale] = useState('day')
  const [searchText, setSearchText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get('/api/users'), api.get('/api/projects')])
      .then(([u, p]) => { setUsers(u); setProjects(p) })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    api.get(`/api/tasks?assignee_id=${selectedUserId}`)
      .then(setTasks)
      .catch((e) => setError(e.message))
  }, [selectedUserId])

  // 個人ビューでは階層ではなくプロジェクト単位で見るため、親子関係は外してフラット表示
  const flatTasks = useMemo(
    () => tasks.map((t) => ({ ...t, parent_id: null })),
    [tasks],
  )

  // 負荷状況（未完了タスク数: 0-2 青 / 3-4 黄 / 5+ 赤）
  const loadLevel = (count) => (count >= 5 ? 'red' : count >= 3 ? 'yellow' : 'blue')
  const [loads, setLoads] = useState({})
  useEffect(() => {
    api.get('/api/dashboard').then((d) => {
      const map = {}
      for (const m of d.member_loads) map[m.user_id] = m.open_tasks
      setLoads(map)
    }).catch(() => {})
  }, [])

  const quickStatus = async (task, status) => {
    await api.put(`/api/tasks/${task.id}`, { status })
    setTasks(await api.get(`/api/tasks?assignee_id=${selectedUserId}`))
  }

  const selectedUser = users.find((u) => u.id === selectedUserId)

  return (
    <div>
      <h1 className="page-title">個人ガントチャート / ToDoリスト</h1>
      <div className="toolbar">
        <span>メンバー:</span>
        {users.map((u) => {
          const count = loads[u.id] || 0
          return (
            <button key={u.id}
                    className={u.id === selectedUserId ? 'primary' : ''}
                    onClick={() => setSelectedUserId(u.id)}>
              <span className={`load-dot load-${loadLevel(count)}`} />
              {u.name}{count > 0 ? `（${count}）` : ''}
            </button>
          )
        })}
      </div>
      <div className="toolbar">
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button className={view === 'gantt' ? 'active' : ''} onClick={() => setView('gantt')}>ガントチャート</button>
          <button className={view === 'todo' ? 'active' : ''} onClick={() => setView('todo')}>ToDoリスト</button>
        </div>
        {view === 'gantt' && (
          <select value={scale} onChange={(e) => setScale(e.target.value)}>
            <option value="day">日単位</option>
            <option value="week">週単位</option>
            <option value="month">月単位</option>
          </select>
        )}
        <input placeholder="タスク検索..." value={searchText}
               onChange={(e) => setSearchText(e.target.value)} style={{ width: 160 }} />
      </div>

      {error && <div className="error-text">{error}</div>}
      {selectedUser && (
        <p className="muted">
          {selectedUser.name} さんのタスク（{tasks.filter((t) => t.status !== '完了').length}件が未完了）
        </p>
      )}

      {view === 'gantt' ? (
        flatTasks.length === 0 ? (
          <div className="card muted">割り当てられたタスクがありません</div>
        ) : (
          <GanttChart tasks={flatTasks} scale={scale} searchText={searchText}
                      lightningDate={null} />
        )
      ) : (
        <TodoList tasks={tasks} searchText={searchText} showProject projects={projects}
                  onStatusChange={quickStatus} />
      )}
    </div>
  )
}
