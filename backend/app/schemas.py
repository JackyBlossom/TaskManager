from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ---------- Auth ----------
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- User ----------
class UserBase(BaseModel):
    username: str
    name: str
    department: str = ""
    is_admin: bool = False
    organization_id: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    is_admin: Optional[bool] = None
    organization_id: Optional[str] = None
    password: Optional[str] = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ---------- Organization ----------
class OrganizationBase(BaseModel):
    name: str
    parent_id: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationOut(OrganizationBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ---------- Project ----------
class ProjectBase(BaseModel):
    name: str
    description: str = ""
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    organization_id: Optional[str] = None


class ProjectCreate(ProjectBase):
    member_ids: list[str] = []


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    organization_id: Optional[str] = None
    member_ids: Optional[list[str]] = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    members: list[UserOut] = []


# ---------- Task ----------
class TaskBase(BaseModel):
    name: str
    description: str = ""
    completion_criteria: str = ""
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    assignee_id: Optional[str] = None
    parent_id: Optional[str] = None
    status: str = "未着手"
    weather: str = "晴れ"
    progress_rate: int = 0
    is_milestone: bool = False
    planned_manhour: float = 0.0
    memo: str = ""
    handover_note: str = ""
    sort_order: int = 0


class TaskCreate(TaskBase):
    project_id: str


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    completion_criteria: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    assignee_id: Optional[str] = None
    parent_id: Optional[str] = None
    status: Optional[str] = None
    weather: Optional[str] = None
    progress_rate: Optional[int] = None
    is_milestone: Optional[bool] = None
    planned_manhour: Optional[float] = None
    memo: Optional[str] = None
    handover_note: Optional[str] = None
    sort_order: Optional[int] = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    assignee: Optional[UserOut] = None


# ---------- TaskDependency ----------
class DependencyCreate(BaseModel):
    predecessor_id: str
    successor_id: str
    type: str = "手動"


class DependencyOut(DependencyCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ---------- Issue ----------
class IssueBase(BaseModel):
    task_id: str
    title: str
    content: str = ""
    status: str = "未対応"
    assignee_id: Optional[str] = None
    due_date: Optional[date] = None


class IssueCreate(IssueBase):
    pass


class IssueUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[date] = None


class IssueOut(IssueBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    assignee: Optional[UserOut] = None


# ---------- WorkRecord ----------
class WorkRecordCreate(BaseModel):
    task_id: str
    user_id: str
    date: date
    actual_manhour: float
    note: str = ""


class WorkRecordOut(WorkRecordCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
