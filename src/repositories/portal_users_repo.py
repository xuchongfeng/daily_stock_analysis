# -*- coding: utf-8 -*-
"""Portal user (C /user) persistence helpers."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
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
