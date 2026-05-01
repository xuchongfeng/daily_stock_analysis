# -*- coding: utf-8 -*-
"""
C 端 (/user) 邮箱账号：注册、会话 cookie、独立于管理员密码与会话轮转。

会话密钥文件：DATA_DIR/.portal_session_secret（与管理员 .session_secret 分离）。
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import secrets
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

PORTAL_COOKIE_NAME = "dsa_portal_session"

# 与管理员模块一致强度的 PBKDF2 参数（密码哈希入库）
_PBKDF2_ITERATIONS = 100_000
_MIN_PASSWORD_LEN = 8


def _get_data_dir() -> Path:
    db_path = os.getenv("DATABASE_PATH", "./data/stock_analysis.db")
    return Path(db_path).resolve().parent


_portal_secret: Optional[bytes] = None


def portal_session_ttl_hours() -> int:
    try:
        raw = os.getenv("PORTAL_SESSION_MAX_AGE_HOURS", "").strip()
        return int(raw) if raw else 24 * 30
    except ValueError:
        return 24 * 30


def _load_or_create_portal_secret() -> Optional[bytes]:
    global _portal_secret
    if _portal_secret is not None:
        return _portal_secret

    data_dir = _get_data_dir()
    secret_path = data_dir / ".portal_session_secret"
    try:
        if secret_path.exists():
            blob = secret_path.read_bytes()
            if len(blob) != 32:
                logger.warning("Invalid .portal_session_secret length; regenerating")
                blob = b""
            if blob:
                _portal_secret = blob
                return _portal_secret

        data_dir.mkdir(parents=True, exist_ok=True)
        new_secret = secrets.token_bytes(32)
        tmp_path = secret_path.with_suffix(".tmp")
        tmp_path.write_bytes(new_secret)
        tmp_path.chmod(0o600)
        tmp_path.replace(secret_path)
        secret_path.chmod(0o600)
        _portal_secret = new_secret
        return _portal_secret
    except OSError as e:
        logger.error("portal session secret I/O failure: %s", e)
        return None


def refresh_portal_auth_state() -> None:
    """Tests / hot-reload hooks：清空内存缓存，下次读写磁盘。"""
    global _portal_secret
    _portal_secret = None


def _validate_plain_password(pw: str) -> Optional[str]:
    if not pw or not pw.strip():
        return "密码不能为空"
    if len(pw) < _MIN_PASSWORD_LEN:
        return f"密码至少 {_MIN_PASSWORD_LEN} 位"
    return None


def hash_plain_password(pw: str) -> tuple[Optional[str], Optional[str]]:
    """Return (error_msg, credential_line salt_b64:hash_b64) or None on success tuple."""
    err = _validate_plain_password(pw)
    if err:
        return err, None
    salt = secrets.token_bytes(32)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        pw.encode("utf-8"),
        salt=salt,
        iterations=_PBKDF2_ITERATIONS,
    )
    salt_b64 = base64.standard_b64encode(salt).decode("ascii")
    hash_b64 = base64.standard_b64encode(derived).decode("ascii")
    line = f"{salt_b64}:{hash_b64}"
    return None, line


def verify_portal_password(plain: str, stored_line: str) -> bool:
    if not plain or not stored_line or ":" not in stored_line:
        return False
    parts = stored_line.strip().split(":", 1)
    if len(parts) != 2:
        return False
    try:
        salt = base64.standard_b64decode(parts[0].strip())
        expected = base64.standard_b64decode(parts[1].strip())
    except (ValueError, TypeError):
        return False
    computed = hashlib.pbkdf2_hmac(
        "sha256",
        plain.encode("utf-8"),
        salt=salt,
        iterations=_PBKDF2_ITERATIONS,
    )
    return hmac.compare_digest(computed, expected)


def create_portal_session_token(user_id: int) -> str:
    """Signed payload `{user_id}.{ts}.sig`。失败返回空字符串。"""
    secret = _load_or_create_portal_secret()
    if secret is None or user_id <= 0:
        return ""
    uid = str(user_id)
    ts = str(int(time.time()))
    payload = f"{uid}.{ts}"
    sig = hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def verify_portal_session_token(value: Optional[str]) -> Optional[int]:
    """校验 cookie；成功返回用户 id。"""
    if not value:
        return None
    secret = _load_or_create_portal_secret()
    if secret is None:
        return None
    parts = value.split(".")
    if len(parts) != 3:
        return None
    uid_str, ts_str, sig = parts[0], parts[1], parts[2]
    payload = f"{uid_str}.{ts_str}"
    expected = hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        ts_i = int(ts_str)
        uid = int(uid_str)
    except ValueError:
        return None
    if uid <= 0:
        return None
    ttl = portal_session_ttl_hours() * 3600
    if ttl > 0 and time.time() - ts_i > ttl:
        return None
    return uid
