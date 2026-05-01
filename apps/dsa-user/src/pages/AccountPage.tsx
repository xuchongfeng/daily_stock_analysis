import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

export function AccountPage() {
  const { status } = useAuth();
  const location = useLocation();
  const email = status?.userEmail;
  const displayName = status?.userName;

  useEffect(() => {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return;
    const el = document.getElementById(raw);
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [location.hash]);

  return (
    <div className="stack">
      <section className="card account-summary-card">
        <h1 className="h1">账户</h1>
        <p className="lead">
          {email || displayName ? (
            <>
              {displayName ? (
                <>
                  用户名：<strong>{displayName}</strong>
                  <br />
                </>
              ) : null}
              {email ? (
                <>
                  邮箱：<strong>{email}</strong>
                </>
              ) : null}
            </>
          ) : (
            <>登录、订阅与通知偏好将在此统一管理。</>
          )}
        </p>
        <p className="account-hint muted">
          可通过右上角下拉菜单打开下方各设置区块；暂未接入后端的功能会标注「接入中」。
        </p>
      </section>

      <section id="account-profile" className="card account-section-card scroll-margin">
        <h2 className="h2-account">名字与资料</h2>
        <p className="account-section-desc">
          修改展示名与个人资料（接入中）。当前展示名仍以注册时为准，可在服务端数据就绪后在此处编辑。
        </p>
      </section>

      <section id="account-avatar" className="card account-section-card scroll-margin">
        <h2 className="h2-account">头像</h2>
        <p className="account-section-desc">上传或更换头像（接入中）。</p>
      </section>

      <section id="account-password" className="card account-section-card scroll-margin">
        <h2 className="h2-account">登录密码</h2>
        <p className="account-section-desc">
          修改邮箱账户登录密码（接入中）；管理员口令请在管理 Web 的「修改密码」中维护。
        </p>
      </section>
    </div>
  );
}
