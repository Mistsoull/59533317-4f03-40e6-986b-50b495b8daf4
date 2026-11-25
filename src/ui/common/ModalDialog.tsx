import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { getTranslations } from '../../i18n/translations';
import { useLanguageStore } from '../../store/useLanguageStore';

interface ModalDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: string;
  dismissible?: boolean;
  compact?: boolean;
  onClose: () => void;
  headerRight?: ReactNode;
  children: ReactNode;
}

export function ModalDialog({
  open,
  title,
  subtitle,
  icon,
  dismissible = true,
  compact = false,
  onClose,
  headerRight,
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    dialog.addEventListener('close', handleClose);

    let removeSafariFallback: (() => void) | undefined;
    if (dismissible && !('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (e: PointerEvent) => {
        const rect = dialog.getBoundingClientRect();
        return (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        );
      };
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e) && dialog.open) {
          dialog.close();
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
      removeSafariFallback = () => {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      removeSafariFallback?.();
    };
  }, [dismissible, onClose]);

  const closedByAttr = {
    closedby: dismissible ? 'any' : 'closerequest',
  } as Record<string, string>;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`${compact ? 'w-[min(90dvw,28rem)]' : 'w-[min(92dvw,46rem)]'} overflow-hidden`}
      {...closedByAttr}
    >
      <header
        className="flex items-center justify-between gap-3 border-b px-4 py-3 safe-x"
        style={{
          background: 'var(--dialog-header)',
          borderColor: 'var(--border-soft)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span className="text-2xl leading-none" aria-hidden="true">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 id={titleId} className="text-base font-extrabold tracking-tight sm:text-lg">
              {title}
            </h1>
            {subtitle && <p className="text-xs ui-muted">{subtitle}</p>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {headerRight}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t.closeLabel}
            className="ui-subtle inline-flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="modal-scroll-area flex-1 overflow-y-auto p-4">{children}</div>
    </dialog>
  );
}
