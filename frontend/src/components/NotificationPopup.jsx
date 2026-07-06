import { useEffect, useState } from 'react'
import { api } from '../api'

// ログイン時ポップアップ通知（期限接近・超過タスク）
export default function NotificationPopup() {
  const [items, setItems] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // 同一セッション中に何度も出さない
    if (sessionStorage.getItem('notif_shown')) return
    api.get('/api/notifications').then((data) => {
      if (data.length > 0) {
        setItems(data)
        setOpen(true)
        sessionStorage.setItem('notif_shown', '1')
      }
    }).catch(() => {})
  }, [])

  if (!open || !items) return null

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <h2>期限のお知らせ</h2>
        <ul className="notif-list">
          {items.map((n, i) => (
            <li key={i} className={n.type}>
              {n.type === 'overdue' ? '【期限超過】' : '【期限間近】'}
              {n.task_name}（期限: {n.planned_end_date}）
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <div className="spacer" />
          <button className="primary" onClick={() => setOpen(false)}>閉じる</button>
        </div>
      </div>
    </div>
  )
}
