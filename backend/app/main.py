from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import (
    auth_router,
    dashboard,
    issues,
    organizations,
    projects,
    tasks,
    users,
    workrecords,
)
from .seed import seed_if_empty

Base.metadata.create_all(bind=engine)
seed_if_empty()

app = FastAPI(title="工程管理アプリ API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(users.router)
app.include_router(organizations.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(issues.router)
app.include_router(workrecords.router)
app.include_router(dashboard.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
