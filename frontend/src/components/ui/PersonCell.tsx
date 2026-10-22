/** Name with the employee code underneath. When no name is known the code is shown once, not twice. */
export function PersonCell({ name, code, note }: { name: string; code: string; note?: string }) {
  const detail = [name && name !== code ? code : "", note ?? ""].filter(Boolean).join(" · ");
  return <><strong>{name || code}</strong>{detail && <small className="cell-note">{detail}</small>}</>;
}
