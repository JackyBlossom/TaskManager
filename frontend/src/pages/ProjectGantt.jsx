import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, downloadFile } from '../api'
import GanttChart, { fmtDate } from '../components/GanttChart.jsx'
import TaskModal from '../components/TaskModal.jsx'
import TodoList from '../components/TodoList.jsx'

export default function ProjectGantt() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [dependencies, setDependencies] = useState([])
  const [issues, setIssues] = useState([])
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')

  const [view, setView] = useState('gantt') // gantt | todo
  const [scale, setScale] = useState('day')
  const [maxLevel, setMaxLevel] = useState(99)
  const [searchText, setSearchText] = useState('')
  const [lightningOn, setLightningOn] = useState(false)
  const [lightningDate, setLightningDate] = useState(fmtDate(new Date()))
  const [editingTask, setEditingTask] = useState(null)

  const load = useCallback(async () => {
    const [p, t, d, i, u] = await Promise.all([
      api.get(`/api/projects/${projectId}`),
      api.get(`/api/tasks?project_id=${projectId}`),
      api.get(`/api/tasks/dependencies?project_id=${projectId}`),
      api.get(`/api/issues?project_id=${projectId}`),
      api.get('/api/users'),
    ])
    setProject(p)
    setTasks(t)
    setDependencies(d)
    setIssues(i)
    setUsers(u)
  }, [projectId])

  useEffect(() => { load().catch((e) => setError(e.message)) }, [load])

  const saveTask = async (task, payload) => {
    if (task.id) {
      await api.put(`/api/tasks/${task.id}`, payload)
    } else {
      await api.post('/api/tasks', { ...payload, project_id: projectId })
    }
    setEditingTask(null)
    await load()
  }

  const deleteTask = async (task) => {
    await api.delete(`/api/tasks/${task.id}`)
    setEditingTask(null)
    await load()
  }

  // ドラッグ＆ドロップによる日程変更
  const moveTask = async (task, start, end) => {
    try {
      await api.put(`/api/tasks/${task.id}`, {
        planned_start_date: start,
        planned_end_date: end,
      })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const addDependency = async (predecessorId, successorId) => {
    try {
      await api.post('/api/tasks/dependencies', {
        predecessor_id: predecessorId,
        successor_id: successorId,
      })
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  const removeDependency = async (depId) => {
    await api.delete(`/api/tasks/dependencies/${depId}`)
    await load()
  }

  const addIssue = async (taskId, title) => {
    await api.post('/api/issues', { task_id: taskId, title })
    await load()
  }

  const quickStatus = async (task, status) => {
    await api.put(`/api/tasks/${task.id}`, { status })
    await load()
  }

  const maxDepth = useMemo(() => {
    // 階層の深さを計算して表示レベルの選択肢を作る
    const byId = new Map(tasks.map((t) => [t.id, t]))
    let max = 1
    for (const t of tasks) {
      let depth = 1
      let cur = t
      while (cur.parent_id && byId.has(cur.parent_id)) {
        depth += 1
        cur = byId.get(cur.parent_id)
      }
      max = Math.max(max, depth)
    }
    return max
  }, [tasks])

  if (!project) return <div>{error ? <span className="error-text">{error}</span> : '読み込み中...'}</div>

  return (
    <div>
      <div className="toolbar">
        <Link to="/projects">← プロジェクト一覧</Link>
        <h1 className="page-title" style={{ margin: 0 }}>{project.name}</h1>
        <span className="muted">{project.planned_start_date} 〜 {project.planned_end_date}</span>
      </div>

      <div className="toolbar">
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button className={view === 'gantt' ? 'active' : ''} onClick={() => setView('gantt')}>ガントチャート</button>
          <button className={view === 'todo' ? 'active' : ''} onClick={() => setView('todo')}>ToDoリスト</button>
        </div>
        {view === 'gantt' && (
          <>
            <select value={scale} onChange={(e) => setScale(e.target.value)}>
              <option value="day">日単位</option>
              <option value="week">週単位</option>
              <option value="month">月単位</option>
            </select>
            <select value={maxLevel} onChange={(e) => setMaxLevel(Number(e.target.value))}>
              <option value={99}>全階層表示</option>
              {Array.from({ length: maxDepth }, (_, i) => i + 1).map((lv) => (
                <option key={lv} value={lv}>レベル{lv}まで</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={lightningOn} onChange={(e) => setLightningOn(e.target.checked)} />
              いなずま線
            </label>
            {lightningOn && (
              <input type="date" value={lightningDate} onChange={(e) => setLightningDate(e.target.value)} />
            )}
          </>
        )}
        <input placeholder="タスク検索..." value={searchText}
               onChange={(e) => setSearchText(e.target.value)} style={{ width: 160 }} />
        <div className="spacer" />
        <button onClick={() => downloadFile(`/api/projects/${projectId}/export/csv`, `${project.name}.csv`)}>
          CSV出力
        </button>
        <button className="primary" onClick={() => setEditingTask({ project_id: projectId })}>
          + タスク登録
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {view === 'gantt' ? (
        tasks.length === 0 ? (
          <div className="card muted">タスクがありません。「+ タスク登録」から追加してください。</div>
        ) : (
          <>
            <GanttChart
              tasks={tasks}
              dependencies={dependencies}
              scale={scale}
              maxLevel={maxLevel}
              searchText={searchText}
              lightningDate={lightningOn ? lightningDate : null}
              onTaskOpen={(t) => setEditingTask(tasks.find((x) => x.id === t.id) || t)}
              onTaskMove={moveTask}
            />
            <p className="muted" style={{ fontSize: 12 }}>
              バーをドラッグで日程移動、端をドラッグで期間変更、ダブルクリック（またはタスク名クリック）で詳細表示。◆はマイルストーン。
            </p>
          </>
        )
      ) : (
        <TodoList tasks={tasks} searchText={searchText}
                  onOpen={(t) => setEditingTask(t)} onStatusChange={quickStatus} />
      )}

      {editingTask && (
        <TaskModal
          task={editingTask}
          tasks={tasks}
          users={users}
          dependencies={dependencies}
          issues={issues}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={() => setEditingTask(null)}
          onAddDependency={addDependency}
          onRemoveDependency={removeDependency}
          onAddIssue={addIssue}
        />
      )}
    </div>
  )
}
