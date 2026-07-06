"""初回起動時に管理者ユーザーとデモデータを投入する。"""
from datetime import date, timedelta

from .auth import hash_password
from .database import SessionLocal
from .models import Issue, Organization, Project, Task, TaskDependency, User, WorkRecord


def seed_if_empty() -> None:
    db = SessionLocal()
    try:
        if db.query(User).first() is not None:
            return

        org_head = Organization(name="開発本部")
        db.add(org_head)
        db.flush()
        org_dev = Organization(name="開発1課", parent_id=org_head.id)
        org_keiri = Organization(name="経理部")
        db.add_all([org_dev, org_keiri])
        db.flush()

        admin = User(username="admin", password_hash=hash_password("admin123"),
                     name="管理者", department="開発本部", is_admin=True,
                     organization_id=org_head.id)
        sato = User(username="sato", password_hash=hash_password("password"),
                    name="佐藤 一郎", department="開発1課", organization_id=org_dev.id)
        suzuki = User(username="suzuki", password_hash=hash_password("password"),
                      name="鈴木 花子", department="開発1課", organization_id=org_dev.id)
        tanaka = User(username="tanaka", password_hash=hash_password("password"),
                      name="田中 経理", department="経理部", organization_id=org_keiri.id)
        db.add_all([admin, sato, suzuki, tanaka])
        db.flush()

        today = date.today()
        base = today - timedelta(days=14)

        project = Project(
            name="社内ポータル刷新プロジェクト",
            description="社内ポータルサイトのリニューアル",
            planned_start_date=base,
            planned_end_date=base + timedelta(days=60),
            organization_id=org_dev.id,
            members=[admin, sato, suzuki],
        )
        db.add(project)
        db.flush()

        def add_task(name, start, end, assignee=None, parent=None, status="未着手",
                     progress=0, milestone=False, manhour=8.0, order=0):
            task = Task(
                project_id=project.id, name=name,
                planned_start_date=base + timedelta(days=start),
                planned_end_date=base + timedelta(days=end),
                assignee_id=assignee.id if assignee else None,
                parent_id=parent.id if parent else None,
                status=status, progress_rate=progress, is_milestone=milestone,
                planned_manhour=manhour, sort_order=order,
            )
            db.add(task)
            db.flush()
            return task

        t_req = add_task("要件定義", 0, 9, sato, status="完了", progress=100, manhour=40, order=1)
        t_req1 = add_task("現行調査", 0, 4, sato, parent=t_req, status="完了", progress=100, order=2)
        t_req2 = add_task("要件定義書作成", 5, 9, sato, parent=t_req, status="完了", progress=100, order=3)
        t_design = add_task("設計", 10, 24, suzuki, status="対応中", progress=60, manhour=80, order=4)
        t_design1 = add_task("基本設計", 10, 16, suzuki, parent=t_design, status="完了", progress=100, order=5)
        t_design2 = add_task("詳細設計", 17, 24, suzuki, parent=t_design, status="対応中", progress=40, order=6)
        t_dev = add_task("実装", 25, 44, sato, status="未着手", manhour=160, order=7)
        t_test = add_task("テスト", 45, 55, suzuki, status="未着手", manhour=80, order=8)
        t_release = add_task("リリース", 60, 60, admin, milestone=True, manhour=0, order=9)

        for pred, succ in [(t_req, t_design), (t_design, t_dev), (t_dev, t_test), (t_test, t_release)]:
            db.add(TaskDependency(predecessor_id=pred.id, successor_id=succ.id))

        db.add(Issue(task_id=t_design2.id, title="外部API仕様が未確定",
                     content="連携先システムのAPI仕様書の提供待ち。",
                     status="対応中", assignee_id=suzuki.id,
                     due_date=today + timedelta(days=3)))
        db.add(Issue(task_id=t_req2.id, title="要件レビュー指摘の反映",
                     content="レビュー指摘3件を反映済み。", status="完了",
                     assignee_id=sato.id, due_date=today - timedelta(days=5)))

        for i, task in enumerate([t_req1, t_req2, t_design1]):
            db.add(WorkRecord(task_id=task.id, user_id=task.assignee_id,
                              date=base + timedelta(days=i * 3 + 2),
                              actual_manhour=6.5 + i, note="通常作業"))

        # 経理部の軽量利用デモ（Excelガント代替ユース）
        keiri_project = Project(
            name="月次決算(7月度)",
            description="経理部の月次決算スケジュール管理",
            planned_start_date=today - timedelta(days=3),
            planned_end_date=today + timedelta(days=10),
            organization_id=org_keiri.id,
            members=[tanaka],
        )
        db.add(keiri_project)
        db.flush()
        db.add_all([
            Task(project_id=keiri_project.id, name="伝票締め",
                 planned_start_date=today - timedelta(days=3),
                 planned_end_date=today - timedelta(days=1),
                 assignee_id=tanaka.id, status="対応中", progress_rate=80, sort_order=1),
            Task(project_id=keiri_project.id, name="試算表作成",
                 planned_start_date=today,
                 planned_end_date=today + timedelta(days=2),
                 assignee_id=tanaka.id, status="未着手", sort_order=2),
            Task(project_id=keiri_project.id, name="月次報告",
                 planned_start_date=today + timedelta(days=8),
                 planned_end_date=today + timedelta(days=10),
                 assignee_id=tanaka.id, status="未着手", sort_order=3),
        ])

        db.commit()
        print("Seeded initial data (admin/admin123)")
    finally:
        db.close()
