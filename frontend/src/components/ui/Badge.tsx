import { humanize, statusTone } from "../../lib/format";
export function Badge({label,variant="neutral"}:{label:string;variant?:"success"|"warning"|"danger"|"neutral"}){return <span className={`badge ${variant}`}>{label}</span>}

/** Status pill with a human label (`ON_LEAVE` → `On leave`) and a tone derived from the status. */
export function StatusBadge({ status }: { status: string }) {
  return <Badge label={humanize(status)} variant={statusTone(status)} />;
}
