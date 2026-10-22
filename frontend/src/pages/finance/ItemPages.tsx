import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/types";
import { appPath } from "../../app/hostRouting";
import { StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { Dropdown } from "../../components/ui/Dropdown";
import { Empty, Notice, Page } from "../../components/ui/Page";
import { formatBillingMoney } from "../../features/finance/billingData";
import { createItem, getItem, getItems, getNextItemCode, updateItem, type BillableItem, type ItemInput, type ItemKind } from "../../features/finance/financeApi";
import { useOrganizationDefaults } from "../../features/organization/useOrganizationDefaults";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { Table } from "../admin/AdminPage";
import { Pagination } from "../workforce/WorkforcePage";

const itemsPath = (path = "") => appPath(`/app/finance/items${path}`);
const itemPath = (item: { itemCode: string }) => itemsPath(`/${encodeURIComponent(item.itemCode)}`);
const message = (reason: unknown, fallback: string) => reason instanceof ApiError || reason instanceof Error ? reason.message : fallback;
const PAGE_SIZE = 20;
const HSN_SAC = /^\d{4}(\d{2}){0,2}$/;
export const UNITS = ["Nos", "Hours", "Days", "Months", "Placement", "Candidate", "Project", "Kg", "Litre", "Box"];

export function ItemPages({ section }: { section: "list" | "new" | "profile" }) {
  const key = useWorkspace().workspace?.key;
  if (section === "new") return <NewItem key={key} />;
  if (section === "profile") return <ItemProfile key={key} />;
  return <ItemList key={key} />;
}

/** "Recruitment" → REC: the prefix that groups a service line's codes (REC-001, REC-002…). */
export function codePrefix(source: string): string {
  const letters = source.toUpperCase().normalize("NFKD").replaceAll(/[^A-Z0-9]/g, "");
  return letters.slice(0, 3) || "ITEM";
}

function ItemFields({ item, categories, onCategory }: { item?: BillableItem; categories: string[]; onCategory?(category: string): void }) {
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? "SERVICE");
  const [hsn, setHsn] = useState(item?.hsnSac ?? "");
  const hsnProblem = hsn && !HSN_SAC.test(hsn) ? "Use 4, 6 or 8 digits." : "";
  return <>
    <fieldset className="form-section">
      <legend>What you bill</legend>
      <div className="form-grid">
        <label>Name<input name="name" required maxLength={160} defaultValue={item?.name ?? ""} placeholder="Recruitment fee" /></label>
        <Dropdown label="Type" name="kind" value={kind} onChange={(value) => setKind(value as ItemKind)}
          options={[{ value: "SERVICE", label: "Service", subLabel: "SAC code under GST" }, { value: "GOODS", label: "Goods", subLabel: "HSN code under GST" }]} />
        <label><span>Service line / category <span className="field-optional">(optional)</span></span>
          <input name="category" maxLength={60} list="item-categories" defaultValue={item?.category ?? ""} placeholder="Recruitment, Consulting, Training…"
            onChange={(event) => onCategory?.(event.target.value)} />
          <datalist id="item-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
        </label>
        <label className="form-wide"><span>Description on the bill <span className="field-optional">(optional)</span></span>
          <input name="description" maxLength={300} defaultValue={item?.description ?? ""} placeholder="Shown on the invoice line; defaults to the name" /></label>
      </div>
    </fieldset>
    <fieldset className="form-section">
      <legend>Tax and pricing</legend>
      <div className="form-grid">
        <div className="field">
          <label><span>{kind === "SERVICE" ? "SAC code" : "HSN code"} <span className="field-optional">(optional)</span></span>
            <input name="hsnSac" inputMode="numeric" maxLength={8} value={hsn} aria-invalid={Boolean(hsnProblem)} placeholder={kind === "SERVICE" ? "998512" : "8471"}
              onChange={(event) => setHsn(event.target.value.replaceAll(/\D/g, ""))} /></label>
          <small className={hsnProblem ? "field-error" : "field-hint"} role={hsnProblem ? "alert" : undefined}>
            {hsnProblem || (kind === "SERVICE" ? "Services Accounting Code, 6 digits starting with 99." : "Harmonised System code, 4–8 digits.")}</small>
        </div>
        <Dropdown label="Unit" name="unit" searchable defaultValue={item?.unit ?? ""}
          options={[{ value: "", label: "No unit" }, ...[...new Set([...UNITS, ...(item?.unit ? [item.unit] : [])])].map((unit) => ({ value: unit, label: unit }))]} />
        <label><span>Default rate <span className="field-optional">(optional)</span></span>
          <input name="unitPrice" type="number" min="0" step="0.01" defaultValue={item?.unitPrice ?? ""} /></label>
        <label><span>GST / tax % <span className="field-optional">(optional)</span></span>
          <input name="taxRate" type="number" min="0" max="100" step="any" defaultValue={item?.taxRate ?? ""} placeholder="18" /></label>
      </div>
    </fieldset>
  </>;
}

function itemBody(form: HTMLFormElement): Record<string, string | number | undefined> {
  const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
  const body: Record<string, string | number | undefined> = {};
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim();
    body[key] = key === "unitPrice" || key === "taxRate" ? (value === "" ? undefined : Number(value)) : value;
  }
  return body;
}

function ItemList() {
  const defaults = useOrganizationDefaults();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "", status = params.get("status") ?? "ACTIVE", category = params.get("category") ?? "";
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const [items, setItems] = useState<BillableItem[] | null>(null), [error, setError] = useState("");
  useEffect(() => { getItems().then(setItems).catch((reason) => setError(message(reason, "Unable to load items"))); }, []);
  const update = (changes: Record<string, string>) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(changes)) if (value) next.set(key, value); else next.delete(key);
    if (!("page" in changes)) next.delete("page");
    return next;
  }, { replace: true });
  const categories = [...new Set((items ?? []).map((item) => item.category).filter((value): value is string => Boolean(value)))].sort();
  const matching = useMemo(() => (items ?? []).filter((item) => (status === "ALL" || item.status === status) && (!category || item.category === category)
    && (!search || [item.itemCode, item.name, item.hsnSac, item.category].some((value) => value?.toLowerCase().includes(search.toLowerCase())))), [items, search, status, category]);
  const filtered = Boolean(search || category) || status !== "ACTIVE";
  const clear = () => setParams(new URLSearchParams(), { replace: true });
  return <Page title="Items and services" description="The registry of what you bill for. Each item has a reference code, HSN/SAC and default rate; pick it on an invoice line to fill everything in."
    actions={<Link className="button primary" to={itemsPath("/new")}>Add item</Link>}>
    <form className="toolbar filter-bar directory-filters" role="search" onSubmit={(event) => event.preventDefault()}>
      <label>Search items<input type="search" placeholder="Code, name or HSN/SAC" value={search} onChange={(event) => update({ q: event.target.value })} /></label>
      <Dropdown label="Service line" value={category} onChange={(next) => update({ category: next })}
        options={[{ value: "", label: "All service lines" }, ...categories.map((value) => ({ value, label: value }))]} />
      <Dropdown label="Status" value={status} onChange={(next) => update({ status: next === "ACTIVE" ? "" : next })}
        options={[{ value: "ACTIVE", label: "Active" }, { value: "ARCHIVED", label: "Archived" }, { value: "ALL", label: "All items" }]} />
      {filtered && <Button type="button" onClick={clear}>Clear filters</Button>}
    </form>
    {error && <Notice>{error}</Notice>}
    {!items && !error ? <p role="status">Loading items…</p> : matching.length ? <>
      <Table headers={["Item", "Service line", "HSN/SAC", "Unit", "Default rate", "Tax", "Status"]}>
        {matching.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item) => <tr key={item.itemCode}>
          <td><Link to={itemPath(item)}>{item.name}</Link><small className="cell-note">{item.itemCode}</small></td>
          <td>{item.category || "—"}</td>
          <td>{item.hsnSac ? <>{item.hsnSac}<small className="cell-note">{item.kind === "SERVICE" ? "SAC" : "HSN"}</small></> : "—"}</td>
          <td>{item.unit || "—"}</td>
          <td>{item.unitPrice === null ? "—" : formatBillingMoney(item.unitPrice, defaults.currency || "INR", defaults.locale)}</td>
          <td>{item.taxRate === null ? "—" : `${item.taxRate}%`}</td>
          <td><StatusBadge status={item.status} /></td>
        </tr>)}
      </Table>
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(matching.length / PAGE_SIZE))} total={matching.length} size={PAGE_SIZE} onPage={(next) => update({ page: next ? String(next) : "" })} />
    </> : filtered
      ? <Empty>No items match these filters. <button type="button" className="link-button" onClick={clear}>Clear filters</button></Empty>
      : <Empty><strong>No items yet.</strong><br />Add the services you bill for, such as a recruitment fee or a monthly retainer, so every invoice uses the same codes and rates. <Link to={itemsPath("/new")}>Add item</Link></Empty>}
  </Page>;
}

function NewItem() {
  const navigate = useNavigate();
  const [items, setItems] = useState<BillableItem[]>([]);
  const [category, setCategory] = useState(""), [name, setName] = useState("");
  const [suggestion, setSuggestion] = useState(""), [code, setCode] = useState(""), [edited, setEdited] = useState(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { getItems().then(setItems).catch(() => undefined); }, []);
  const prefix = codePrefix(category || name);
  useEffect(() => {
    if (!category && !name) { setSuggestion(""); return; }
    let current = true;
    const timer = window.setTimeout(() => getNextItemCode(prefix).then((result) => { if (current) setSuggestion(result.code); }).catch(() => undefined), 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [prefix]);
  const value = edited ? code : suggestion;
  const taken = items.some((item) => item.itemCode === value.toUpperCase());
  const codeError = value && !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,31}$/.test(value) ? "Use letters, numbers, . _ / or -." : taken ? `${value.toUpperCase()} is already used.` : "";
  return <Page title="Add item or service" description="Register something you bill for. Its code groups by service line, for example REC-001, REC-002 for recruitment.">
    <section className="card wizard-step">
      <form aria-label="Item details" onChange={(event) => { const target = event.target as unknown as HTMLInputElement; if (target.name === "name") setName(target.value); }}
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          if (codeError || event.currentTarget.querySelector("[aria-invalid=true]")) { setError("Fix the highlighted fields first."); return; }
          setBusy(true); setError("");
          void createItem({ ...itemBody(event.currentTarget), itemCode: value || undefined, codePrefix: value ? undefined : prefix } as ItemInput)
            .then((created) => navigate(itemPath(created)))
            .catch((reason) => setError(message(reason, "Unable to save the item"))).finally(() => setBusy(false));
        }}>
        {error && <Notice>{error}</Notice>}
        <ItemFields categories={[...new Set(items.map((item) => item.category).filter((v): v is string => Boolean(v)))]} onCategory={setCategory} />
        <fieldset className="form-section">
          <legend>Reference code</legend>
          <div className="form-grid">
            <div className="field">
              <label>Item code<input value={value} maxLength={32} spellCheck={false} aria-invalid={Boolean(codeError)} placeholder="Filled in from the service line"
                onChange={(event) => { setCode(event.target.value.toUpperCase()); setEdited(true); }} /></label>
              <small className={codeError ? "field-error" : "field-hint"} role={codeError ? "alert" : undefined}>
                {codeError || (!edited ? `Next free code for ${prefix}. You can change it; it cannot change after saving.` : "Custom code.")}</small>
              {edited && suggestion && value !== suggestion && <Button type="button" size="sm" onClick={() => { setEdited(false); setCode(""); }}>Use {suggestion}</Button>}
            </div>
          </div>
        </fieldset>
        <div className="form-actions">
          <Button variant="primary" disabled={busy}>{busy ? "Saving…" : "Save item"}</Button>
          <Link className="button secondary" to={itemsPath()}>Cancel</Link>
        </div>
      </form>
    </section>
  </Page>;
}

function ItemProfile() {
  const { itemCode = "" } = useParams();
  const defaults = useOrganizationDefaults();
  const [item, setItem] = useState<BillableItem | null>(null), [items, setItems] = useState<BillableItem[]>([]);
  const [error, setError] = useState(""), [saved, setSaved] = useState(""), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false);
  const [ask, confirmDialog] = useConfirm();
  const load = () => getItem(itemCode).then(setItem).catch((reason) => setError(message(reason, "Unable to load the item")));
  useEffect(() => { void load(); getItems().then(setItems).catch(() => undefined); }, [itemCode]);
  if (error && !item) return <Page title="Item"><Notice>{error}</Notice><Link to={itemsPath()}>Back to items</Link></Page>;
  if (!item) return <Page title="Item"><p role="status">Loading item…</p></Page>;
  const archive = async () => {
    const archiving = item.status === "ACTIVE";
    if (!(await ask({ title: archiving ? `Archive ${item.itemCode}?` : `Restore ${item.itemCode}?`, confirmLabel: archiving ? "Archive item" : "Restore item", tone: archiving ? "destructive" : "primary",
      body: archiving ? "It won't be offered on new invoice lines. Invoices that already bill it are not changed, and the code stays reserved." : "It will be offered on invoice lines again." }))) return;
    setBusy(true);
    void updateItem(item.itemCode, { status: archiving ? "ARCHIVED" : "ACTIVE" }).then(async () => { setSaved(archiving ? "Item archived." : "Item restored."); await load(); })
      .catch((reason) => setError(message(reason, "Unable to update the item"))).finally(() => setBusy(false));
  };
  return <Page title={item.name} description={`${item.itemCode}${item.category ? ` · ${item.category}` : ""}`}
    actions={!editing ? <div className="toolbar"><Button onClick={() => { setEditing(true); setSaved(""); }}>Edit details</Button>
      <Button variant={item.status === "ACTIVE" ? "destructive" : "secondary"} disabled={busy} onClick={() => void archive()}>{item.status === "ACTIVE" ? "Archive" : "Restore"}</Button></div> : undefined}>
    {confirmDialog}
    <p><Link to={itemsPath()}>← All items</Link></p>
    {error && <Notice>{error}</Notice>}
    {saved && <Notice tone="success">{saved}</Notice>}
    {editing ? <form className="card employee-form" aria-label={`Edit ${item.itemCode}`} onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (event.currentTarget.querySelector("[aria-invalid=true]")) { setError("Fix the highlighted fields first."); return; }
      const body = itemBody(event.currentTarget);
      setBusy(true); setError("");
      void updateItem(item.itemCode, { ...body, clearUnitPrice: body.unitPrice === undefined, clearTaxRate: body.taxRate === undefined } as Partial<ItemInput>)
        .then(async () => { setEditing(false); setSaved("Item saved. New invoice lines use these values; existing invoices keep what they billed."); await load(); })
        .catch((reason) => setError(message(reason, "Unable to save the item"))).finally(() => setBusy(false));
    }}>
      <ItemFields item={item} categories={[...new Set(items.map((entry) => entry.category).filter((v): v is string => Boolean(v)))]} />
      <div className="form-actions"><Button variant="primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button><Button type="button" onClick={() => setEditing(false)}>Cancel</Button></div>
    </form> : <div className="cards">
      <article><h3>Item</h3><dl className="detail-list">
        <div><dt>Code</dt><dd><strong>{item.itemCode}</strong></dd></div>
        <div><dt>Status</dt><dd><StatusBadge status={item.status} /></dd></div>
        <div><dt>Type</dt><dd>{item.kind === "SERVICE" ? "Service" : "Goods"}</dd></div>
        <div><dt>Service line</dt><dd>{item.category || "—"}</dd></div>
        <div><dt>On the bill</dt><dd>{item.description || item.name}</dd></div>
      </dl></article>
      <article><h3>Tax and pricing</h3><dl className="detail-list">
        <div><dt>{item.kind === "SERVICE" ? "SAC" : "HSN"}</dt><dd>{item.hsnSac || "—"}</dd></div>
        <div><dt>Unit</dt><dd>{item.unit || "—"}</dd></div>
        <div><dt>Default rate</dt><dd>{item.unitPrice === null ? "—" : formatBillingMoney(item.unitPrice, defaults.currency || "INR", defaults.locale)}</dd></div>
        <div><dt>Tax</dt><dd>{item.taxRate === null ? "—" : `${item.taxRate}%`}</dd></div>
      </dl></article>
    </div>}
  </Page>;
}
