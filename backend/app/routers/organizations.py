from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..audit import record_audit
from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import Organization, User

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


@router.get("", response_model=list[schemas.OrganizationOut])
def list_organizations(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Organization).order_by(Organization.name).all()


@router.post("", response_model=schemas.OrganizationOut)
def create_organization(req: schemas.OrganizationCreate, db: Session = Depends(get_db),
                        admin: User = Depends(require_admin)):
    org = Organization(name=req.name, parent_id=req.parent_id)
    db.add(org)
    record_audit(db, admin.id, "create", "organization", org.id, req.name)
    db.commit()
    db.refresh(org)
    return org


@router.put("/{org_id}", response_model=schemas.OrganizationOut)
def update_organization(org_id: str, req: schemas.OrganizationCreate,
                        db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="組織が見つかりません")
    org.name = req.name
    org.parent_id = req.parent_id
    record_audit(db, admin.id, "update", "organization", org.id)
    db.commit()
    db.refresh(org)
    return org


@router.delete("/{org_id}")
def delete_organization(org_id: str, db: Session = Depends(get_db),
                        admin: User = Depends(require_admin)):
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="組織が見つかりません")
    db.delete(org)
    record_audit(db, admin.id, "delete", "organization", org_id)
    db.commit()
    return {"ok": True}
