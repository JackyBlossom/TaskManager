import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


project_members = Table(
    "project_members",
    Base.metadata,
    Column("project_id", String, ForeignKey("projects.id"), primary_key=True),
    Column("user_id", String, ForeignKey("users.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    department = Column(String, default="")
    is_admin = Column(Boolean, default=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)

    organization = relationship("Organization", back_populates="members")
    projects = relationship("Project", secondary=project_members, back_populates="members")


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    parent_id = Column(String, ForeignKey("organizations.id"), nullable=True)

    members = relationship("User", back_populates="organization")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    planned_start_date = Column(Date, nullable=True)
    planned_end_date = Column(Date, nullable=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("User", secondary=project_members, back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    parent_id = Column(String, ForeignKey("tasks.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    completion_criteria = Column(Text, default="")
    planned_start_date = Column(Date, nullable=True)
    planned_end_date = Column(Date, nullable=True)
    actual_start_date = Column(Date, nullable=True)
    actual_end_date = Column(Date, nullable=True)
    assignee_id = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="未着手")  # 未着手 / 対応中 / 問題発生中 / 完了
    weather = Column(String, default="晴れ")  # 晴れ / 曇り / 雨
    progress_rate = Column(Integer, default=0)  # 0-100
    is_milestone = Column(Boolean, default=False)
    planned_manhour = Column(Float, default=0.0)  # 予定工数（人時）
    memo = Column(Text, default="")
    handover_note = Column(Text, default="")  # 前後タスクへの引き継ぎ情報
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User")
    issues = relationship("Issue", back_populates="task", cascade="all, delete-orphan")
    work_records = relationship("WorkRecord", back_populates="task", cascade="all, delete-orphan")


class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    id = Column(String, primary_key=True, default=gen_uuid)
    predecessor_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    successor_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    type = Column(String, default="手動")  # 手動 / 自動


class Issue(Base):
    __tablename__ = "issues"

    id = Column(String, primary_key=True, default=gen_uuid)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, default="")
    status = Column(String, default="未対応")  # 未対応 / 対応中 / 完了
    assignee_id = Column(String, ForeignKey("users.id"), nullable=True)
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="issues")
    assignee = relationship("User")


class WorkRecord(Base):
    __tablename__ = "work_records"

    id = Column(String, primary_key=True, default=gen_uuid)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False, default=date.today)
    actual_manhour = Column(Float, default=0.0)  # 実績工数（人時）
    note = Column(String, default="")

    task = relationship("Task", back_populates="work_records")
    user = relationship("User")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=True)
    action = Column(String, nullable=False)  # create / update / delete
    entity = Column(String, nullable=False)
    entity_id = Column(String, nullable=True)
    detail = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
