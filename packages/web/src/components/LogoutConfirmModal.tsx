import { LogOut } from "lucide-react";

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LogoutConfirmModal({ onConfirm, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="card p-5 w-full max-w-xs shadow-xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center flex-shrink-0">
            <LogOut size={18} className="text-danger" />
          </div>
          <div>
            <p className="font-semibold text-text text-sm">Çıkış yap</p>
            <p className="text-xs text-text-tertiary">Oturumunu kapatmak istediğinden emin misin?</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1 py-2 text-xs">
            İptal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 text-xs rounded-lg font-medium bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}
