import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { api, clearToken, getToken } from './api'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Projects from './pages/Projects.jsx'
import ProjectGantt from './pages/ProjectGantt.jsx'
import Personal from './pages/Personal.jsx'
import Issues from './pages/Issues.jsx'
import WorkRecords from './pages/WorkRecords.jsx'
import Masters from './pages/Masters.jsx'
import NotificationPopup from './components/NotificationPopup.jsx'

function Layout({ user, onLogout, children }) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">工程管理アプリ</div>
        <nav>
          <NavLink to="/" end>HOME（ダッシュボード）</NavLink>
          <NavLink to="/projects">プロジェクト管理</NavLink>
          <NavLink to="/personal">個人ガント / ToDo</NavLink>
          <NavLink to="/issues">課題管理表</NavLink>
          <NavLink to="/workrecords">工数管理</NavLink>
          {user.is_admin && <NavLink to="/masters">マスタメンテナンス</NavLink>}
        </nav>
        <div className="user-box">
          <div>{user.name}{user.is_admin ? '（管理者）' : ''}</div>
          <div className="muted">{user.department}</div>
          <button className="small" onClick={onLogout}>ログアウト</button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api.get('/api/auth/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = () => {
    clearToken()
    setUser(null)
    navigate('/login')
  }

  if (loading) return <div style={{ padding: 40 }}>読み込み中...</div>

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <NotificationPopup />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:projectId/gantt" element={<ProjectGantt user={user} />} />
        <Route path="/personal" element={<Personal user={user} />} />
        <Route path="/issues" element={<Issues />} />
        <Route path="/workrecords" element={<WorkRecords user={user} />} />
        {user.is_admin && <Route path="/masters" element={<Masters user={user} />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
