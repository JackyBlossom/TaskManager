from sqlalchemy.orm import Session

from .models import AuditLog


def record_audit(db: Session, user_id: str | None, action: str, entity: str,
                 entity_id: str | None = None, detail: str = "") -> None:
    db.add(AuditLog(user_id=user_id, action=action, entity=entity,
                    entity_id=entity_id, detail=detail))
