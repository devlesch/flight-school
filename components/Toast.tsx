import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ACCENT: Record<ToastType, { border: string; color: string }> = {
  success: { border: '#FDD344', color: '#FDD344' },
  error:   { border: '#f87171', color: '#f87171' },
  info:    { border: 'rgba(243,238,231,0.4)', color: '#F3EEE7' },
};

const ICON: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5" />,
  error:   <XCircle className="w-5 h-5" />,
  info:    <Info className="w-5 h-5" />,
};

const DURATION = 3500;
const MAX_VISIBLE = 3;

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const accent = ACCENT[item.type];

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-2xl"
      style={{
        background: '#013E3F',
        borderLeft: `4px solid ${accent.border}`,
        opacity: item.exiting ? 0 : 1,
        transition: 'opacity 200ms ease-out',
        animation: item.exiting ? undefined : 'toast-slide-in 300ms ease-out',
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <span style={{ color: accent.color }} className="mt-0.5 flex-shrink-0">{ICON[item.type]}</span>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] uppercase font-bold tracking-widest mb-0.5"
            style={{ color: accent.color }}
          >
            {item.type}
          </p>
          <p className="text-sm text-[#F3EEE7]/90 leading-snug">{item.message}</p>
        </div>
        <button
          onClick={() => onDismiss(item.id)}
          className="flex-shrink-0 text-[#F3EEE7]/40 hover:text-[#F3EEE7] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {!item.exiting && (
        <div
          className="h-[2px] origin-left"
          style={{
            background: accent.border,
            animation: `toast-shrink ${DURATION}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Mark as exiting for fade-out
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    // Remove after fade-out
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 200);
    // Clear auto-dismiss timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => {
      const next = [...prev, { id, message, type }];
      // If over max, dismiss oldest
      if (next.length > MAX_VISIBLE) {
        const oldest = next[0];
        setTimeout(() => dismiss(oldest.id), 0);
      }
      return next;
    });
    // Auto-dismiss
    const timer = setTimeout(() => dismiss(id), DURATION);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, []);

  const ctx: ToastContextValue = {
    success: useCallback((msg: string) => addToast('success', msg), [addToast]),
    error: useCallback((msg: string) => addToast('error', msg), [addToast]),
    info: useCallback((msg: string) => addToast('info', msg), [addToast]),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {createPortal(
        <>
          <style>{`
            @keyframes toast-slide-in {
              from { transform: translateY(16px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes toast-shrink {
              from { transform: scaleX(1); }
              to { transform: scaleX(0); }
            }
          `}</style>
          <div
            className="fixed bottom-6 right-6 flex flex-col-reverse gap-3"
            style={{ zIndex: 60, maxWidth: 400, width: '100%', pointerEvents: 'none' }}
          >
            {toasts.map(t => (
              <div key={t.id} style={{ pointerEvents: 'auto' }}>
                <ToastCard item={t} onDismiss={dismiss} />
              </div>
            ))}
          </div>
        </>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
