import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

/**
 * A labelled control with optional help text. The hint stays outside the label so it does not become part of the
 * control's accessible name; it is announced as a description instead.
 */
export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactElement<{ "aria-describedby"?: string }> }) {
  const id = useId();
  return <div className="field">
    <label>{label}{hint ? cloneElement(children, { "aria-describedby": `${id}-hint` }) : children}</label>
    {hint && <small id={`${id}-hint`} className="field-hint">{hint}</small>}
  </div>;
}
