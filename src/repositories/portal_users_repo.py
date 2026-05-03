# -*- coding: utf-8 -*-
"""Portal user (C /user) persistence helpers."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.storage import PortalUser


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def get_portal_user_by_email(session: Session, email: str) -> Optional[PortalUser]:
    stmt = select(PortalUser).where(PortalUser.email == normalize_email(email)).limit(1)
    return session.scalars(stmt).first()


def get_portal_user_by_id(session: Session, user_id: int) -> Optional[PortalUser]:
    return session.get(PortalUser, user_id)


def create_portal_user(
    session: Session, email: str, password_hash_line: str, username: str
) -> PortalUser:
    row = PortalUser(email=normalize_email(email), username=username, password_hash=password_hash_line)
    session.add(row)
    try:
        session.commit()
        session.refresh(row)
        return row
    except IntegrityError:
        session.rollback()
        raise


def update_portal_user_profile_fields(
    session: Session,
    user_id: int,
    *,
    username: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> bool:
    vals = {}
    if username is not None:
        vals["username"] = username
    if avatar_url is not None:
        av = (avatar_url or "").strip()
        vals["avatar_url"] = av if av else None
    if not vals:
        return True
    res = session.execute(update(PortalUser).where(PortalUser.id == user_id).values(**vals))
    session.commit()
    return res.rowcount > 0


def update_portal_notification_prefs(session: Session, user_id: int, prefs_json: str) -> None:
    session.execute(
        update(PortalUser).where(PortalUser.id == user_id).values(notification_prefs_json=prefs_json)
    )
    session.commit()


def update_portal_usage_stats(session: Session, user_id: int, stats_json: str) -> None:
    session.execute(update(PortalUser).where(PortalUser.id == user_id).values(usage_stats_json=stats_json))
    session.commit()


def update_portal_password_hash(session: Session, user_id: int, password_hash_line: str) -> None:
    session.execute(update(PortalUser).where(PortalUser.id == user_id).values(password_hash=password_hash_line))
    session.commit()
