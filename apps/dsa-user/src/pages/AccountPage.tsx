/* eslint-disable react-hooks/set-state-in-effect -- 与 Portfolio 等页一致的 mount / 依赖触发拉取 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  changePortalPassword,
  getPortalAccount,
  patchPortalAccount,
  type PortalAccountResponse,
  type PortalNotificationPrefs,
} from '../api/portalAccount';
import { useAuth } from '../auth/AuthContext';

type TabId = 'profile' | 'notify' | 'subscription';

const TAB_META: Record<TabId, { title: string; description: string }> = {
  profile: {
    title: '个人信息',
    description: '展示名、头像链接与登录邮箱；密码可在下方单独修改。',
  },
  notify: {
    title: '订阅与通知',
    description: '配置邮件与各渠道 Webhook；服务端仅保存偏好，实际推送以后台任务为准。',
  },
  subscription: {
    title: '我的套餐',
    description: '当前档位与自然月用量（统计月与服务器本地时间一致）。',
  },
};

function tabFromHash(hash: string): TabId {
  const h = hash.replace(/^#/, '');
  if (h === 'notify' || h === 'subscription') {
    return h;
  }
  return 'profile';
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const cap = limit > 0 ? limit : 0;
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  return (
    <div className="account-usage-row">
      <div className="account-usage-label">
        <span>{label}</span>
        <span className="account-usage-numbers mono">
          {used} / {cap > 0 ? cap : '—'}
        </span>
      </div>
      {cap > 0 ? (
        <div className="account-usage-track" aria-hidden>
          <div className="account-usage-fill" style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <p className="account-usage-unlimited muted">未配置上限</p>
      )}
    </div>
  );
}

export function AccountPage() {
  const { status, refresh: refreshAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const portalOk = Boolean(status?.portalLoggedIn);

  const tab = tabFromHash(location.hash);

  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [account, setAccount] = useState<PortalAccountResponse | null>(null);

  const [profileUsername, setProfileUsername] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<PortalNotificationPrefs | null>(null);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);
  const [prefsErr, setPrefsErr] = useState<string | null>(null);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!portalOk) {
      setAccount(null);
      setPrefs(null);
      setLoadErr(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadErr(null);
    try {
      const data = await getPortalAccount();
      setAccount(data);
      setProfileUsername(data.username || '');
      setProfileAvatar(data.avatarUrl || '');
      setPrefs({ ...data.notificationPrefs });
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : '加载失败');
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [portalOk]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectTab = (t: TabId) => {
    navigate({ pathname: '/account', hash: `#${t}` }, { replace: true });
  };

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileErr(null);
    setProfileMsg(null);
    try {
      const next = await patchPortalAccount({
        username: profileUsername.trim(),
        avatarUrl: profileAvatar.trim() || null,
      });
      setAccount(next);
      setPrefs({ ...next.notificationPrefs });
      setProfileMsg('已保存');
      await refreshAuth();
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : '保存失败');
    }
  };

  const onSavePrefs = async (e: FormEvent) => {
    e.preventDefault();
    if (!prefs) return;
    setPrefsErr(null);
    setPrefsMsg(null);
    try {
      const next = await patchPortalAccount({ notificationPrefs: prefs });
      setAccount(next);
      setPrefs({ ...next.notificationPrefs });
      setPrefsMsg('已保存');
    } catch (err) {
      setPrefsErr(err instanceof Error ? err.message : '保存失败');
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    try {
      await changePortalPassword(curPw, newPw, newPw2);
      setCurPw('');
      setNewPw('');
      setNewPw2('');
      setPwMsg('密码已更新');
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : '修改失败');
    }
  };

  if (!portalOk) {
    return (
      <div className="stack">
        <section className="card account-summary-card">
          <h1 className="h1">账户</h1>
          <p className="lead">请先使用邮箱注册或登录门户账号，再管理个人信息、通知偏好与套餐用量。</p>
          <p className="account-hint muted">管理员口令登录不会自动开启门户资料；请在首页完成邮箱注册/登录。</p>
        </section>
      </div>
    );
  }

  const meta = TAB_META[tab];

  return (
    <div className="account-page-shell">
      <div className="account-layout">
        <aside className="card account-layout-sidebar" aria-label="账户菜单">
          <h1 className="h1 account-sidebar-title">账户</h1>
          <div className="account-sidebar-user">
            {account ? (
              <>
                <p className="account-sidebar-name">{account.username || account.email}</p>
                {account.email ? <p className="account-sidebar-email muted">{account.email}</p> : null}
              </>
            ) : loading ? (
              <p className="account-section-desc">加载中…</p>
            ) : (
              <p className="account-section-desc">门户账户</p>
            )}
          </div>
          <nav className="account-nav" role="tablist" aria-label="账户分区">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'profile'}
              className={tab === 'profile' ? 'account-nav-item is-active' : 'account-nav-item'}
              onClick={() => selectTab('profile')}
            >
              个人信息
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'notify'}
              className={tab === 'notify' ? 'account-nav-item is-active' : 'account-nav-item'}
              onClick={() => selectTab('notify')}
            >
              订阅与通知
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'subscription'}
              className={tab === 'subscription' ? 'account-nav-item is-active' : 'account-nav-item'}
              onClick={() => selectTab('subscription')}
            >
              我的套餐
            </button>
          </nav>
        </aside>

        <div className="account-layout-main">
          <section className="card account-detail-panel" aria-labelledby="account-panel-heading">
            <header className="account-detail-header">
              <h2 id="account-panel-heading" className="h2-account">
                {meta.title}
              </h2>
              <p className="account-section-desc account-detail-desc">{meta.description}</p>
            </header>

            {loadErr ? <p className="workbench-alert workbench-alert-err">{loadErr}</p> : null}

            {tab === 'profile' && loading && !account ? (
              <p className="account-section-desc account-detail-body">加载账户信息…</p>
            ) : null}

            {tab === 'profile' && account ? (
              <div className="account-detail-body">
          <div className="account-profile-layout">
            <div className="account-avatar-preview">
              {profileAvatar && /^https?:\/\//i.test(profileAvatar) ? (
                <img src={profileAvatar} alt="" className="account-avatar-img" referrerPolicy="no-referrer" />
              ) : (
                <div className="account-avatar-placeholder" aria-hidden>
                  {(profileUsername || account.email || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <form className="account-form" onSubmit={onSaveProfile}>
              <label className="account-field">
                <span className="account-field-label">用户名</span>
                <input
                  className="account-input"
                  value={profileUsername}
                  onChange={(ev) => setProfileUsername(ev.target.value)}
                  autoComplete="nickname"
                />
              </label>
              <label className="account-field">
                <span className="account-field-label">头像 URL</span>
                <input
                  className="account-input mono"
                  value={profileAvatar}
                  onChange={(ev) => setProfileAvatar(ev.target.value)}
                  placeholder="https://..."
                  autoComplete="off"
                />
              </label>
              <label className="account-field">
                <span className="account-field-label">邮箱</span>
                <input className="account-input" value={account.email} readOnly disabled />
              </label>
              {profileErr ? <p className="workbench-alert workbench-alert-err">{profileErr}</p> : null}
              {profileMsg ? <p className="workbench-alert workbench-alert-ok">{profileMsg}</p> : null}
              <button type="submit" className="account-primary-btn">
                保存资料
              </button>
            </form>
          </div>

          <hr className="account-divider" />

          <h3 className="h3-account">登录密码</h3>
          <form className="account-form account-form-narrow" onSubmit={onChangePassword}>
            <label className="account-field">
              <span className="account-field-label">当前密码</span>
              <input
                type="password"
                className="account-input"
                value={curPw}
                onChange={(ev) => setCurPw(ev.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="account-field">
              <span className="account-field-label">新密码</span>
              <input
                type="password"
                className="account-input"
                value={newPw}
                onChange={(ev) => setNewPw(ev.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="account-field">
              <span className="account-field-label">确认新密码</span>
              <input
                type="password"
                className="account-input"
                value={newPw2}
                onChange={(ev) => setNewPw2(ev.target.value)}
                autoComplete="new-password"
              />
            </label>
            {pwErr ? <p className="workbench-alert workbench-alert-err">{pwErr}</p> : null}
            {pwMsg ? <p className="workbench-alert workbench-alert-ok">{pwMsg}</p> : null}
            <button type="submit" className="account-secondary-btn">
              更新密码
            </button>
          </form>
              </div>
            ) : null}

            {tab === 'notify' && loading && !prefs ? (
              <p className="account-section-desc account-detail-body">加载通知偏好…</p>
            ) : null}

            {tab === 'notify' && prefs ? (
              <form className="account-form account-detail-body" onSubmit={onSavePrefs}>
            <label className="account-check">
              <input
                type="checkbox"
                checked={prefs.emailEnabled}
                onChange={(ev) => setPrefs({ ...prefs, emailEnabled: ev.target.checked })}
              />
              邮件通知（发送至账户邮箱）
            </label>
            <label className="account-field">
              <span className="account-field-label">钉钉机器人 Webhook</span>
              <input
                className="account-input mono"
                value={prefs.dingtalkWebhook}
                onChange={(ev) => setPrefs({ ...prefs, dingtalkWebhook: ev.target.value })}
                placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                autoComplete="off"
              />
            </label>
            <label className="account-field">
              <span className="account-field-label">飞书机器人 Webhook</span>
              <input
                className="account-input mono"
                value={prefs.feishuWebhook}
                onChange={(ev) => setPrefs({ ...prefs, feishuWebhook: ev.target.value })}
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                autoComplete="off"
              />
            </label>
            <label className="account-check">
              <input
                type="checkbox"
                checked={prefs.dailyDigest}
                onChange={(ev) => setPrefs({ ...prefs, dailyDigest: ev.target.checked })}
              />
              每日汇总推送（偏好占位）
            </label>
            <label className="account-check">
              <input
                type="checkbox"
                checked={prefs.analysisPush}
                onChange={(ev) => setPrefs({ ...prefs, analysisPush: ev.target.checked })}
              />
              单股分析完成推送（偏好占位）
            </label>
            {prefsErr ? <p className="workbench-alert workbench-alert-err">{prefsErr}</p> : null}
            {prefsMsg ? <p className="workbench-alert workbench-alert-ok">{prefsMsg}</p> : null}
            <button type="submit" className="account-primary-btn">
              保存通知偏好
            </button>
              </form>
            ) : null}

            {tab === 'subscription' && loading && !account ? (
              <p className="account-section-desc account-detail-body">加载套餐与用量…</p>
            ) : null}

            {tab === 'subscription' && account ? (
              <div className="account-detail-body">
          <p className="account-section-desc">
            当前档位：<strong>{account.planLabel}</strong>（<span className="mono">{account.planTier}</span>）
          </p>

          <div className="account-usage-block">
            <p className="account-usage-month mono">{account.usage.calendarMonth}</p>
            <UsageBar
              label="AI 分析次数"
              used={account.usage.analysisCountMonth}
              limit={account.limits.aiAnalysisMonth}
            />
            <UsageBar
              label="工作台个股搜索（自动补全选中）"
              used={account.usage.stockSearchCountMonth}
              limit={account.limits.stockSearchMonth}
            />
            <div className="account-usage-row">
              <div className="account-usage-label">
                <span>自选上限</span>
                <span className="account-usage-numbers mono">{account.limits.watchlistMax}</span>
              </div>
            </div>
          </div>
          <button type="button" className="account-secondary-btn" onClick={() => void load()} disabled={loading}>
            {loading ? '刷新中…' : '刷新用量'}
          </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
