import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appPath } from "../../app/hostRouting";
import { workflowLink } from "../../components/HorizonWorkflowNav";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { PersonCell } from "../../components/ui/PersonCell";
import { Empty, Notice } from "../../components/ui/Page";
import { getPayRunPreparation, savePayRunPreparation, type PayRun, type PayRunPreparation as Preparation } from "../../features/payroll/payrollApi";
import { Table } from "../admin/AdminPage";

export function PayRunPreparation({ run, busy, onProcess, onSaved, nameOf = (code) => code }: {
  run: PayRun; busy: boolean; onProcess(): void; onSaved(): Promise<void>;
  /** Resolves an employee code to a display name; defaults to the code. */
  nameOf?(code: string): string;
}) {
  const [report, setReport] = useState<Preparation | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setReport(null);
    getPayRunPreparation(run.payRunKey).then(value => {
      if (active) { setReport(value); setSelected(value.employees.filter(e => e.selected).map(e => e.employeeCode)); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to validate this pay run"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [run.payRunKey, revision]);
  const saved = report?.employees.filter(e => e.selected).map(e => e.employeeCode) ?? [];
  const dirty = selected.length !== saved.length || selected.some(code => !saved.includes(code));
  const blockedSelected = report?.employees.filter(e => selected.includes(e.employeeCode) && !e.eligible).length ?? 0;
  const disabled = loading || busy;
  const ready = !!report?.ready && !dirty && !error;
  const returnTo = `${appPath("/payroll/runs")}?run=${encodeURIComponent(run.payRunKey)}`;
  const save = async () => {
    setLoading(true); setError("");
    try {
      const next = await savePayRunPreparation(run.payRunKey, selected);
      setReport(next); setSelected(next.employees.filter(e => e.selected).map(e => e.employeeCode));
      await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save selection. Refresh validation and try again."); }
    finally { setLoading(false); }
  };
  return <section aria-label="Pay-run preparation">
    <h4>Choose who to pay</h4>
    <p className="snapshot-note">Tick the eligible employees, save the selection, then calculate. Eligibility is checked again when pay is calculated.</p>
    {loading && <p role="status">Validating payroll preparation…</p>}
    {error && <Notice>{error} Refresh validation to try again.</Notice>}
    {report && <>
      <p aria-label="Preparation counts" className="run-summary">{report.employeeCount} payroll employees · {report.eligibleCount} eligible · {report.blockedCount} blocked · {selected.length} selected · {blockedSelected} selected blocked</p>
      {report.eligibleCount > 0 && <div className="toolbar">
        <Button size="sm" disabled={disabled} onClick={() => setSelected(report.employees.filter(e => e.eligible).map(e => e.employeeCode))}>Select all eligible ({report.eligibleCount})</Button>
        {selected.length > 0 && <Button size="sm" disabled={disabled} onClick={() => setSelected([])}>Clear selection</Button>}
      </div>}
      {report.issues.map(issue => <Notice key={issue}>{issue}</Notice>)}
      {report.employees.length ? <Table headers={["Include", "Employee", "Eligibility", ""]}>
        {report.employees.map(employee => <tr key={employee.employeeCode}>
          <td><input type="checkbox" aria-label={`Select ${nameOf(employee.employeeCode)}`} checked={selected.includes(employee.employeeCode)}
            disabled={disabled || (!employee.eligible && !selected.includes(employee.employeeCode))}
            onChange={event => setSelected(values => event.target.checked ? [...values, employee.employeeCode] : values.filter(code => code !== employee.employeeCode))} /></td>
          <td><PersonCell name={nameOf(employee.employeeCode)} code={employee.employeeCode} note={employee.selected ? "saved in this draft" : undefined} /></td>
          <td>{employee.eligible ? <StatusBadge status="ELIGIBLE" /> : <span className="blocked-reason">{employee.blockedReason}</span>}</td>
          <td><Link to={workflowLink(`${appPath("/payroll/compensation")}?employee=${encodeURIComponent(employee.employeeCode)}`, returnTo)}>Review compensation</Link>{" · "}
            <Link to={workflowLink(`${appPath("/payroll/employees")}?employee=${encodeURIComponent(employee.employeeCode)}`, returnTo)}>Payroll setup</Link></td>
        </tr>)}
      </Table> : <Empty>No payroll employees in this workspace. Configure an employee for payroll, then return to prepare this run.</Empty>}
      <Link to={workflowLink(appPath("/payroll/employees"), returnTo)}>Configure payroll employees</Link>
      <p role="status">{ready ? "Ready to calculate" : dirty ? "Selection changed. Save and validate before calculating." : blockedSelected ? "Remove blocked employees or resolve their setup, then refresh validation." : selected.length ? "This run is blocked. Review the validation messages." : "Select at least one eligible employee to continue."}</p>
      <div className="toolbar">
        <Button disabled={disabled || !dirty || blockedSelected > 0} onClick={() => void save()}>Save selection</Button>
        <Button variant="primary" disabled={disabled || !ready} onClick={onProcess}>Process</Button>
        <span className="snapshot-note">Process calculates pay for the saved selection.</span>
      </div>
    </>}
    <Button disabled={disabled} onClick={() => setRevision(value => value + 1)}>Refresh validation</Button>
    <p className="snapshot-note">Refresh reloads the saved selection. Period dates are fixed for this draft; create a new run if its dates are incorrect.</p>
  </section>;
}
