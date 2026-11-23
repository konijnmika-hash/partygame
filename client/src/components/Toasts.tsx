import { dismissToast, useStore } from '../state/store';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)}>
          <span className="t-emoji">{t.emoji ?? (t.kind === 'error' ? '⚠️' : t.kind === 'success' ? '✅' : '💬')}</span>
          <span className="grow">{t.text}</span>
          {t.action && (
            <button
              className="btn btn-pink btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
