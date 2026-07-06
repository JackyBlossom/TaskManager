from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..audit import record_audit
from ..auth import get_current_user
from ..database import get_db
from ..models import Task, TaskDependency, User

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get_task(db: Session, task_id: str) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    return task


@router.get("", response_model=list[schemas.TaskOut])
def list_tasks(project_id: str | None = None, assignee_id: str | None = None,
               db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = db.query(Task)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    return query.order_by(Task.sort_order, Task.planned_start_date).all()


@router.get("/my", response_model=list[schemas.TaskOut])
def my_tasks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (db.query(Task).filter(Task.assignee_id == user.id)
            .order_by(Task.planned_end_date).all())


@router.post("", response_model=schemas.TaskOut)
def create_task(req: schemas.TaskCreate, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    task = Task(**req.model_dump())
    db.add(task)
    record_audit(db, user.id, "create", "task", task.id, req.name)
    db.commit()
    db.refresh(task)
    return task


@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: str, req: schemas.TaskUpdate, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    task = _get_task(db, task_id)
    data = req.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(task, key, value)
    # 状態と進捗率の整合を取る（完了なら100%）
    if data.get("status") == "完了":
        task.progress_rate = 100
    record_audit(db, user.id, "update", "task", task.id)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    task = _get_task(db, task_id)
    db.query(TaskDependency).filter(
        (TaskDependency.predecessor_id == task_id)
        | (TaskDependency.successor_id == task_id)
    ).delete(synchronize_session=False)
    db.query(Task).filter(Task.parent_id == task_id).update({"parent_id": None})
    db.delete(task)
    record_audit(db, user.id, "delete", "task", task_id)
    db.commit()
    return {"ok": True}


# ---------- 依存関係（関連線） ----------
@router.get("/dependencies", response_model=list[schemas.DependencyOut])
def list_dependencies(project_id: str | None = None, db: Session = Depends(get_db),
                      _: User = Depends(get_current_user)):
    query = db.query(TaskDependency)
    if project_id:
        task_ids = [t.id for t in db.query(Task.id).filter(Task.project_id == project_id)]
        query = query.filter(TaskDependency.predecessor_id.in_(task_ids))
    return query.all()


@router.post("/dependencies", response_model=schemas.DependencyOut)
def create_dependency(req: schemas.DependencyCreate, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    if req.predecessor_id == req.successor_id:
        raise HTTPException(status_code=400, detail="同一タスク間に依存関係は設定できません")
    _get_task(db, req.predecessor_id)
    _get_task(db, req.successor_id)
    exists = db.query(TaskDependency).filter_by(
        predecessor_id=req.predecessor_id, successor_id=req.successor_id).first()
    if exists:
        raise HTTPException(status_code=400, detail="この依存関係は既に存在します")
    dep = TaskDependency(**req.model_dump())
    db.add(dep)
    record_audit(db, user.id, "create", "dependency", dep.id)
    db.commit()
    db.refresh(dep)
    return dep


@router.delete("/dependencies/{dep_id}")
def delete_dependency(dep_id: str, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    dep = db.get(TaskDependency, dep_id)
    if dep is None:
        raise HTTPException(status_code=404, detail="依存関係が見つかりません")
    db.delete(dep)
    record_audit(db, user.id, "delete", "dependency", dep_id)
    db.commit()
    return {"ok": True}
