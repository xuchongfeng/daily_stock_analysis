import { FormEvent, useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import { gatewayRequiresLogin, isGatewayLoggedIn, portalLogin, portalRegister } from '../../api/authApi';
import { useAuth } from '../../auth/AuthContext';

type Panel = 'login' | 'register';

function parsePanel(searchParams: URLSearchParams): Panel {
  return searchParams.get('tab') === 'register' ? 'register' : 'login';
}

/** C 端邮箱登录与注册合一页（管理员口令请使用管理 Web，不在此处提供）。 */
export function LoginPage() {
  const { status, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const panel = parsePanel(searchParams);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setPanel(next: Panel) {
    if (next === 'register') {
      setSearchParams({ tab: 'register' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (panel === 'register') {
        await portalRegister(username.trim(), email.trim(), password, passwordConfirm);
      } else {
        await portalLogin(email.trim(), password);
      }
      await refresh();
      const target =
        from && typeof from === 'string' && from !== '/' && from !== '/login'
          ? from
          : '/today';
      navigate(target.startsWith('/') ? target : '/today', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : panel === 'register' ? '注册失败' : '登录失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (!status) {
    return <div className="loading-screen">加载中…</div>;
  }

  const needGate = gatewayRequiresLogin(status);

  if (needGate && isGatewayLoggedIn(status)) {
    return <Navigate to="/today" replace />;
  }

  return (
    <div className="page-stack">
      <div className="login-page-wrap">
        <h1 className="page-h1 center">{panel === 'register' ? '创建账户' : '登录'}</h1>
        <p className="page-lead center">
          {panel === 'register'
            ? '填写用户名（必填）、邮箱与密码完成注册后将自动登录。'
            : needGate
              ? '使用邮箱登录。本站若开启管理员门禁，邮箱会话与管理员会话均可用于访问 API；此处不提供管理员口令。'
              : '使用邮箱登录或注册账户；管理员门禁未开启时也可直接进入应用。'}
        </p>

        <div className="login-tab-row center" role="tablist">
          <button
            type="button"
            className={`login-tab ${panel === 'login' ? 'active' : ''}`}
            role="tab"
            aria-selected={panel === 'login'}
            onClick={() => {
              setPanel('login');
            }}
          >
            登录
          </button>
          <button
            type="button"
            className={`login-tab ${panel === 'register' ? 'active' : ''}`}
            role="tab"
            aria-selected={panel === 'register'}
            onClick={() => {
              setPanel('register');
            }}
          >
            注册
          </button>
        </div>

        <div className="login-panel standalone">
          {error ? <div className="err">{error}</div> : null}
          <form onSubmit={(e) => void onSubmit(e)}>
            {panel === 'register' ? (
              <>
                <label htmlFor="auth-username">用户名</label>
                <input
                  id="auth-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={2}
                  maxLength={128}
                  placeholder="2～128 个字符"
                />
              </>
            ) : null}
            <label htmlFor="auth-email">邮箱</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label htmlFor="auth-pw">密码</label>
            <input
              id="auth-pw"
              type="password"
              autoComplete={panel === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={panel === 'register' ? 8 : undefined}
            />
            {panel === 'register' ? (
              <>
                <label htmlFor="auth-pw2">确认密码</label>
                <input
                  id="auth-pw2"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </>
            ) : null}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting
                ? panel === 'register'
                  ? '提交中…'
                  : '登录中…'
                : panel === 'register'
                  ? '注册并登录'
                  : '登录'}
            </button>
          </form>
        </div>

        <p className="back-link center">
          <Link to="/">返回首页</Link> · <Link to="/pricing">查看定价</Link>
          {!needGate ? (
            <>
              {' '}
              · <Link to="/today">进入应用（无需登录）</Link>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
