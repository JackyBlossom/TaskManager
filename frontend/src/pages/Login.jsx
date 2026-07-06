import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../api'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api.post('/api/auth/login', { username, password })
      setToken(res.access_token)
      const me = await api.get('/api/auth/me')
      onLogin(me)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={submit}>
        <h1>工程管理アプリ</h1>
        <div className="sub">簡単操作で楽々プロジェクト管理</div>
        <label className="field">
          <span>ユーザー名</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </label>
        <label className="field">
          <span>パスワード</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="error-text">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? 'ログイン中...' : 'ログイン'}</button>
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          初期アカウント: admin / admin123
        </p>
      </form>
    </div>
  )
}
