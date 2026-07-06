from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..audit import record_audit
from ..auth import get_current_user, hash_password, require_admin
from ..database import get_db
from ..models import User

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(User).order_by(User.name).all()


@router.post("", response_model=schemas.UserOut)
def create_user(req: schemas.UserCreate, db: Session = Depends(get_db),
                admin: User = Depends(require_admin)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="このユーザー名は既に使用されています")
    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        name=req.name,
        department=req.department,
        is_admin=req.is_admin,
        organization_id=req.organization_id,
    )
    db.add(user)
    record_audit(db, admin.id, "create", "user", user.id, req.username)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: str, req: schemas.UserUpdate, db: Session = Depends(get_db),
                admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    data = req.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    if password:
        user.password_hash = hash_password(password)
    for key, value in data.items():
        setattr(user, key, value)
    record_audit(db, admin.id, "update", "user", user.id)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db),
                admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="自分自身は削除できません")
    db.delete(user)
    record_audit(db, admin.id, "delete", "user", user_id)
    db.commit()
    return {"ok": True}
