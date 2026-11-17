interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl border p-6 max-w-sm w-full animate-in zoom-in-95" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-lg font-black tracking-tight mb-2" style={{ color: destructive ? 'var(--destructive)' : 'var(--foreground)' }}>
          {title}
        </h3>
        <p className="text-sm font-medium mb-6 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl border font-semibold text-sm cursor-pointer transition active:scale-95 hover:bg-black/5"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-10 rounded-xl font-bold text-sm text-white cursor-pointer transition active:scale-95 shadow-xs"
            style={{ background: destructive ? 'var(--destructive)' : 'var(--primary)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
