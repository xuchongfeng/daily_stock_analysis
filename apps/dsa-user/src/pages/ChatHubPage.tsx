import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AnalyzeWorkbenchPage } from './AnalyzeWorkbenchPage';
import { ChatPage } from './ChatPage';

export function ChatHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'chat' ? 'chat' : 'workbench';

  const setTab = useCallback(
    (next: 'workbench' | 'chat') => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (next === 'workbench') {
            n.delete('tab');
          } else {
            n.set('tab', 'chat');
          }
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    document.title = tab === 'chat' ? '问股' : '分析工作台';
  }, [tab]);

  return (
    <div className="chat-hub">
      <nav className="chat-hub-tabs card" aria-label="问股模块切换">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'workbench'}
          className={`chat-hub-tab${tab === 'workbench' ? ' is-active' : ''}`}
          onClick={() => setTab('workbench')}
        >
          分析工作台
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'chat'}
          className={`chat-hub-tab${tab === 'chat' ? ' is-active' : ''}`}
          onClick={() => setTab('chat')}
        >
          问股
        </button>
      </nav>
      <div className="chat-hub-body">{tab === 'workbench' ? <AnalyzeWorkbenchPage /> : <ChatPage />}</div>
    </div>
  );
}
