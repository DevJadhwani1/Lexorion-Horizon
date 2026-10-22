import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "destructive";
}

/**
 * In-product confirmation instead of `window.confirm`. Uses a modal `<dialog>`, so focus is trapped, Escape
 * cancels and focus returns to the control that opened it. Focus starts on Cancel so Enter never confirms by accident.
 *
 *   const [confirm, dialog] = useConfirm();
 *   if (await confirm({ title: "Finalize JAN?", confirmLabel: "Finalize" })) …
 *   return <>{dialog}…</>;
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve(value: boolean): void }) | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })), []);
  const close = (value: boolean) => { request?.resolve(value); setRequest(null); };
  return [confirm, request ? <ConfirmDialog {...request} onClose={close} /> : null];
}

function ConfirmDialog({ title, body, confirmLabel, cancelLabel = "Cancel", tone = "primary", onClose }: ConfirmOptions & { onClose(value: boolean): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) {
      // jsdom has no showModal; the dialog is still rendered and operable there.
      if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    }
    cancel.current?.focus();
    return () => { opener?.focus?.(); };
  }, []);
  return <dialog ref={ref} className="confirm-dialog" aria-labelledby={`${id}-title`} aria-describedby={body ? `${id}-body` : undefined}
    onCancel={(event) => { event.preventDefault(); onClose(false); }}>
    <h2 id={`${id}-title`}>{title}</h2>
    {body && <div id={`${id}-body`} className="confirm-dialog-body">{body}</div>}
    <div className="form-actions">
      <Button ref={cancel} type="button" onClick={() => onClose(false)}>{cancelLabel}</Button>
      <Button type="button" variant={tone} onClick={() => onClose(true)}>{confirmLabel}</Button>
    </div>
  </dialog>;
}
