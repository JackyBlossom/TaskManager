import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import schemas
from ..audit import record_audit
from ..auth import get_current_user
from ..database import get_db
from ..models import Project, Task, TaskDependency, User

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _get_project(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    return project


@router.get("", response_model=list[schemas.ProjectOut])
def list_projects(organization_id: str | None = None, db: Session = Depends(get_db),
                  _: User = Depends(get_current_user)):
    query = db.query(Project)
    if organization_id:
        query = query.filter(Project.organization_id == organization_id)
    return query.order_by(Project.planned_start_date).all()


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db),
                _: User = Depends(get_current_user)):
    return _get_project(db, project_id)


@router.post("", response_model=schemas.ProjectOut)
def create_project(req: schemas.ProjectCreate, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    project = Project(
        name=req.name,
        description=req.description,
        planned_start_date=req.planned_start_date,
        planned_end_date=req.planned_end_date,
        organization_id=req.organization_id,
    )
    if req.member_ids:
        project.members = db.query(User).filter(User.id.in_(req.member_ids)).all()
    db.add(project)
    record_audit(db, user.id, "create", "project", project.id, req.name)
    db.commit()
    db.refresh(project)
    return project


@router.put("/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: str, req: schemas.ProjectUpdate, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    project = _get_project(db, project_id)
    data = req.model_dump(exclude_unset=True)
    member_ids = data.pop("member_ids", None)
    if member_ids is not None:
        project.members = db.query(User).filter(User.id.in_(member_ids)).all()
    for key, value in data.items():
        setattr(project, key, value)
    record_audit(db, user.id, "update", "project", project.id)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    project = _get_project(db, project_id)
    task_ids = [t.id for t in project.tasks]
    if task_ids:
        db.query(TaskDependency).filter(
            (TaskDependency.predecessor_id.in_(task_ids))
            | (TaskDependency.successor_id.in_(task_ids))
        ).delete(synchronize_session=False)
    db.delete(project)
    record_audit(db, user.id, "delete", "project", project_id)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/duplicate", response_model=schemas.ProjectOut)
def duplicate_project(project_id: str, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    """過去プロジェクトを複製して新規プロジェクトを作成する（タスク・依存関係も複製）。"""
    src = _get_project(db, project_id)
    new_project = Project(
        name=f"{src.name}のコピー",
        description=src.description,
        planned_start_date=src.planned_start_date,
        planned_end_date=src.planned_end_date,
        organization_id=src.organization_id,
        members=list(src.members),
    )
    db.add(new_project)
    db.flush()

    id_map: dict[str, str] = {}
    for task in src.tasks:
        new_task = Task(
            project_id=new_project.id,
            name=task.name,
            description=task.description,
            completion_criteria=task.completion_criteria,
            planned_start_date=task.planned_start_date,
            planned_end_date=task.planned_end_date,
            assignee_id=task.assignee_id,
            is_milestone=task.is_milestone,
            planned_manhour=task.planned_manhour,
            sort_order=task.sort_order,
        )
        db.add(new_task)
        db.flush()
        id_map[task.id] = new_task.id
    # 親子関係を新IDに付け替え
    for task in src.tasks:
        if task.parent_id and task.parent_id in id_map:
            db.get(Task, id_map[task.id]).parent_id = id_map[task.parent_id]

    src_task_ids = list(id_map.keys())
    if src_task_ids:
        deps = db.query(TaskDependency).filter(
            TaskDependency.predecessor_id.in_(src_task_ids),
            TaskDependency.successor_id.in_(src_task_ids),
        ).all()
        for dep in deps:
            db.add(TaskDependency(
                predecessor_id=id_map[dep.predecessor_id],
                successor_id=id_map[dep.successor_id],
                type=dep.type,
            ))

    record_audit(db, user.id, "create", "project", new_project.id, f"duplicate from {project_id}")
    db.commit()
    db.refresh(new_project)
    return new_project


@router.get("/{project_id}/export/csv")
def export_csv(project_id: str, db: Session = Depends(get_db),
               _: User = Depends(get_current_user)):
    project = _get_project(db, project_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["タスク名", "予定開始日", "予定終了日", "実績開始日", "実績終了日",
                     "担当者", "状況", "進捗率(%)", "予定工数(h)", "マイルストーン"])
    for task in sorted(project.tasks, key=lambda t: (t.sort_order, t.planned_start_date or date.min)):
        writer.writerow([
            task.name,
            task.planned_start_date or "",
            task.planned_end_date or "",
            task.actual_start_date or "",
            task.actual_end_date or "",
            task.assignee.name if task.assignee else "",
            task.status,
            task.progress_rate,
            task.planned_manhour,
            "○" if task.is_milestone else "",
        ])
    # Excelで文字化けしないようBOM付きUTF-8で出力
    data = "﻿" + buf.getvalue()
    return StreamingResponse(
        iter([data.encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=project_{project_id}.csv"},
    )
