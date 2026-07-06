import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import schemas
from ..audit import record_audit
from ..auth import get_current_user
from ..database import get_db
from ..models import Issue, Task, User

router = APIRouter(prefix="/api/issues", tags=["issues"])


def _project_filter(query, db: Session, project_id: str | None):
    if project_id:
        task_ids = db.query(Task.id).filter(Task.project_id == project_id)
        query = query.filter(Issue.task_id.in_(task_ids))
    return query


@router.get("", response_model=list[schemas.IssueOut])
def list_issues(project_id: str | None = None, status: str | None = None,
                db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = _project_filter(db.query(Issue), db, project_id)
    if status:
        query = query.filter(Issue.status == status)
    return query.order_by(Issue.due_date).all()


@router.post("", response_model=schemas.IssueOut)
def create_issue(req: schemas.IssueCreate, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    if db.get(Task, req.task_id) is None:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    issue = Issue(**req.model_dump())
    db.add(issue)
    record_audit(db, user.id, "create", "issue", issue.id, req.title)
    db.commit()
    db.refresh(issue)
    return issue


@router.put("/{issue_id}", response_model=schemas.IssueOut)
def update_issue(issue_id: str, req: schemas.IssueUpdate, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(status_code=404, detail="課題が見つかりません")
    for key, value in req.model_dump(exclude_unset=True).items():
        setattr(issue, key, value)
    record_audit(db, user.id, "update", "issue", issue.id)
    db.commit()
    db.refresh(issue)
    return issue


@router.delete("/{issue_id}")
def delete_issue(issue_id: str, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(status_code=404, detail="課題が見つかりません")
    db.delete(issue)
    record_audit(db, user.id, "delete", "issue", issue_id)
    db.commit()
    return {"ok": True}


@router.get("/export/csv")
def export_issues_csv(project_id: str | None = None, db: Session = Depends(get_db),
                      _: User = Depends(get_current_user)):
    issues = _project_filter(db.query(Issue), db, project_id).order_by(Issue.due_date).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["課題", "内容", "対象タスク", "状態", "担当者", "期日", "登録日"])
    for issue in issues:
        writer.writerow([
            issue.title, issue.content,
            issue.task.name if issue.task else "",
            issue.status,
            issue.assignee.name if issue.assignee else "",
            issue.due_date or "",
            issue.created_at.date() if issue.created_at else "",
        ])
    data = "﻿" + buf.getvalue()
    return StreamingResponse(
        iter([data.encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=issues.csv"},
    )
