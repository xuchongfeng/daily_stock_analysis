import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { AuthStatusResponse } from '../api/authApi';
import { getPortalAccount } from '../api/portalAccount';
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

/** 登录后顶栏右侧：头像 + 用户名，点击进入账户页 */
export function ShellUserMenu() {
  const { status } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const visible =
    Boolean((status?.authEnabled && status?.loggedIn) || status?.portalLoggedIn);

  useEffect(() => {
    if (!status?.portalLoggedIn) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const acc = await getPortalAccount();
        if (!cancelled && acc.avatarUrl?.trim()) {
          setAvatarUrl(acc.avatarUrl.trim());
        } else if (!cancelled) {
          setAvatarUrl(null);
        }
      } catch {
        if (!cancelled) {
          setAvatarUrl(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status?.portalLoggedIn, status?.userEmail]);

  if (!visible || !status) {
    return null;
  }

  const label = displayLabel(status);
  const truncated = label.length > 14 ? `${label.slice(0, 14)}…` : label;
  const initial = (label.slice(0, 1) || '?').toUpperCase();
  const displayAvatarUrl = status.portalLoggedIn ? avatarUrl : null;

  return (
    <div className="user-menu">
      <div className="user-menu-bar">
        <Link to="/account" className="user-menu-profile" title={label}>
          <span className="user-menu-avatar-wrap" aria-hidden>
            {displayAvatarUrl ? (
              <img
                src={displayAvatarUrl}
                alt=""
                className="user-menu-avatar-img"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="user-menu-avatar-fallback">{initial}</span>
            )}
          </span>
          <span className="user-menu-name">{truncated}</span>
        </Link>
      </div>
    </div>
  );
}
