from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import schemas
from ..audit import record_audit
from ..auth import get_current_user
from ..database import get_db
from ..models import Task, User, WorkRecord

router = APIRouter(prefix="/api/workrecords", tags=["workrecords"])


@router.get("", response_model=list[schemas.WorkRecordOut])
def list_workrecords(task_id: str | None = None, user_id: str | None = None,
                     project_id: str | None = None,
                     db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = db.query(WorkRecord)
    if task_id:
        query = query.filter(WorkRecord.task_id == task_id)
    if user_id:
        query = query.filter(WorkRecord.user_id == user_id)
    if project_id:
        task_ids = db.query(Task.id).filter(Task.project_id == project_id)
        query = query.filter(WorkRecord.task_id.in_(task_ids))
    return query.order_by(WorkRecord.date.desc()).all()


@router.post("", response_model=schemas.WorkRecordOut)
def create_workrecord(req: schemas.WorkRecordCreate, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    if db.get(Task, req.task_id) is None:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    record = WorkRecord(**req.model_dump())  # user_id指定により代理入力も可能
    db.add(record)
    record_audit(db, user.id, "create", "workrecord", record.id)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}")
def delete_workrecord(record_id: str, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    record = db.get(WorkRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="実績が見つかりません")
    db.delete(record)
    record_audit(db, user.id, "delete", "workrecord", record_id)
    db.commit()
    return {"ok": True}


@router.get("/summary")
def workrecord_summary(project_id: str | None = None, db: Session = Depends(get_db),
                       _: User = Depends(get_current_user)):
    """タスク単位の予定・実績工数集計（プロジェクト指定可）。"""
    task_query = db.query(Task)
    if project_id:
        task_query = task_query.filter(Task.project_id == project_id)
    tasks = task_query.all()
    actual_by_task = dict(
        db.query(WorkRecord.task_id, func.sum(WorkRecord.actual_manhour))
        .group_by(WorkRecord.task_id).all()
    )
    rows = []
    for task in tasks:
        rows.append({
            "task_id": task.id,
            "task_name": task.name,
            "project_id": task.project_id,
            "assignee_name": task.assignee.name if task.assignee else "",
            "planned_manhour": task.planned_manhour or 0.0,
            "actual_manhour": actual_by_task.get(task.id, 0.0) or 0.0,
        })
    return rows
