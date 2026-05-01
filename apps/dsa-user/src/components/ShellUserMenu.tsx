import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { logout } from '../api/authApi';
import type { AuthStatusResponse } from '../api/authApi';
import { useAuth } from '../auth/AuthContext';

function displayLabel(status: AuthStatusResponse | null): string {
  const n = status?.userName?.trim();
  if (n) {
    return n;
  }
  const e = status?.userEmail?.trim();
  if (e) {
    const local = e.split('@')[0];
    return local && local.length ? local : e;
  }
  if (status?.authEnabled && status?.loggedIn) {
    return '管理员';
  }
  return '账户';
}

/** 登录后顶栏右侧：用户名触发下拉，内含账号设置入口与退出 */
export function ShellUserMenu() {
  const { status, refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const visible =
    Boolean((status?.authEnabled && status?.loggedIn) || status?.portalLoggedIn);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (rootRef.current?.contains(e.target as Node)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('keydown', onKey);
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function onLogout() {
    setOpen(false);
    try {
      await logout({
        authEnabled: Boolean(status?.authEnabled),
        loggedIn: Boolean(status?.loggedIn),
      });
    } catch {
      /* ignore */
    }
    await refresh();
    navigate('/', { replace: true });
  }

  if (!visible || !status) {
    return null;
  }

  const label = displayLabel(status);
  const truncated = label.length > 14 ? `${label.slice(0, 14)}…` : label;

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="user-menu-name" title={label}>
          {truncated}
        </span>
        <span className="user-menu-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="user-menu-dropdown" role="menu">
          <Link
            to="/account#account-profile"
            className="user-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            名字与资料
          </Link>
          <Link
            to="/account#account-avatar"
            className="user-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            头像
          </Link>
          <Link
            to="/account#account-password"
            className="user-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            登录密码
          </Link>
          <div className="user-menu-sep" role="separator" />
          <button
            type="button"
            className="user-menu-item user-menu-danger"
            role="menuitem"
            onClick={() => void onLogout()}
          >
            退出登录
          </button>
        </div>
      ) : null}
    </div>
  );
}
