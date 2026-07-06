from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Issue, Project, Task, User

router = APIRouter(prefix="/api", tags=["dashboard"])

STATUS_LIST = ["未着手", "対応中", "問題発生中", "完了"]


@router.get("/dashboard")
def dashboard(project_id: str | None = None, organization_id: str | None = None,
              db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    today = date.today()
    task_query = db.query(Task)
    if project_id:
        task_query = task_query.filter(Task.project_id == project_id)
    elif organization_id:
        project_ids = db.query(Project.id).filter(Project.organization_id == organization_id)
        task_query = task_query.filter(Task.project_id.in_(project_ids))
    tasks = task_query.all()

    total = len(tasks)
    status_counts = {s: 0 for s in STATUS_LIST}
    delayed = []
    for task in tasks:
        status_counts[task.status] = status_counts.get(task.status, 0) + 1
        if (task.status != "完了" and task.planned_end_date
                and task.planned_end_date < today):
            delayed.append({
                "id": task.id,
                "name": task.name,
                "project_id": task.project_id,
                "planned_end_date": str(task.planned_end_date),
                "assignee_name": task.assignee.name if task.assignee else "",
            })

    avg_progress = round(sum(t.progress_rate for t in tasks) / total, 1) if total else 0.0

    issue_query = db.query(Issue)
    if project_id:
        task_ids = db.query(Task.id).filter(Task.project_id == project_id)
        issue_query = issue_query.filter(Issue.task_id.in_(task_ids))
    issues = issue_query.all()
    issue_total = len(issues)
    issue_closed = len([i for i in issues if i.status == "完了"])

    # メンバー負荷: 未完了タスク数で判定（0-2: 青 / 3-4: 黄 / 5以上: 赤）
    load_by_user: dict[str, dict] = {}
    for task in tasks:
        if task.assignee_id and task.status != "完了":
            entry = load_by_user.setdefault(
                task.assignee_id,
                {"user_id": task.assignee_id,
                 "name": task.assignee.name if task.assignee else "",
                 "open_tasks": 0})
            entry["open_tasks"] += 1
    member_loads = []
    for entry in load_by_user.values():
        count = entry["open_tasks"]
        entry["level"] = "red" if count >= 5 else ("yellow" if count >= 3 else "blue")
        member_loads.append(entry)
    member_loads.sort(key=lambda e: -e["open_tasks"])

    return {
        "total_tasks": total,
        "status_counts": status_counts,
        "avg_progress": avg_progress,
        "delayed_tasks": delayed,
        "delayed_count": len(delayed),
        "issue_total": issue_total,
        "issue_closed": issue_closed,
        "issue_resolution_rate": round(issue_closed / issue_total * 100, 1) if issue_total else 0.0,
        "member_loads": member_loads,
    }


@router.get("/notifications")
def notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """ログイン時ポップアップ用: 自分のタスクの期限接近（3日以内）・超過を返す。"""
    today = date.today()
    soon = today + timedelta(days=3)
    tasks = (db.query(Task)
             .filter(Task.assignee_id == user.id, Task.status != "完了",
                     Task.planned_end_date.isnot(None))
             .all())
    items = []
    for task in tasks:
        if task.planned_end_date < today:
            items.append({"type": "overdue", "task_id": task.id, "task_name": task.name,
                          "project_id": task.project_id,
                          "planned_end_date": str(task.planned_end_date)})
        elif task.planned_end_date <= soon:
            items.append({"type": "due_soon", "task_id": task.id, "task_name": task.name,
                          "project_id": task.project_id,
                          "planned_end_date": str(task.planned_end_date)})
    items.sort(key=lambda i: i["planned_end_date"])
    return items
