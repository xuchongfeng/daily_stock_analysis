import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { login } from '../../api/authApi';
import { useAuth } from '../../auth/AuthContext';

/** 登录子页（与营销站共用顶栏） */
export function LoginPage() {
  const { status, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needConfirm = Boolean(status?.authEnabled && status?.passwordSet === false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(password, needConfirm ? passwordConfirm : undefined);
      await refresh();
      const target =
        from && typeof from === 'string' && from !== '/' && from !== '/login'
          ? from
          : '/today';
      navigate(target.startsWith('/') ? target : '/today', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (!status?.authEnabled) {
    return (
      <div className="page-stack prose-page">
        <h1 className="page-h1">登录</h1>
        <p className="page-lead">当前服务未启用访问密码，无需登录即可使用功能。</p>
        <p>
          <Link to="/today" className="text-link">
            直接进入应用
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="login-page-wrap">
        <h1 className="page-h1 center">登录</h1>
        <p className="page-lead center">登录后可使用今日、自选、问股等完整功能。</p>

        <div className="login-panel standalone">
          {error ? <div className="err">{error}</div> : null}
          <form onSubmit={(e) => void onSubmit(e)}>
            <label htmlFor="login-pw">密码</label>
            <input
              id="login-pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {needConfirm ? (
              <>
                <label htmlFor="login-pw2">确认密码（首次设置管理员密码）</label>
                <input
                  id="login-pw2"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
              </>
            ) : null}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? '登录中…' : '登录'}
            </button>
          </form>
        </div>

        <p className="back-link center">
          <Link to="/">返回首页</Link> · <Link to="/pricing">查看定价</Link>
        </p>
      </div>
    </div>
  );
}
