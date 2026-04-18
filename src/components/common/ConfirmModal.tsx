// ═══ CONFIRM MODAL — Reusable confirmation dialog ═══

import { useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface ConfirmModalProps {
  title?: string;
  message?: string | ComponentChildren;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title = 'Confirmar',
  message = '¿Estás seguro?',
  icon,
  confirmLabel = 'Sí',
  cancelLabel = 'No',
  confirmColor = '#007AFF',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Enter to confirm, Escape to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onConfirm, onCancel]);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.15)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Dialog */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: '#FFF',
          borderRadius: 18,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 12px 40px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04)',
          animation: 'fadeIn .15s ease',
        }}
      >
        {/* Content */}
        <div style={{ padding: '28px 28px 16px', textAlign: 'center' }}>
          {icon && <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>}
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 10px', color: '#1D1D1F' }}>
            {title}
          </h3>
          {typeof message === 'string' ? (
            <p style={{ fontSize: 13, color: '#6E6E73', lineHeight: 1.6, margin: 0 }}>
              {message}
            </p>
          ) : (
            <div style={{ fontSize: 13, color: '#6E6E73', lineHeight: 1.6 }}>{message}</div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '8px 28px 24px', display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1.5px solid #E5E5EA',
              background: '#FFF',
              color: '#6E6E73',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: confirmColor,
              color: '#FFF',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
