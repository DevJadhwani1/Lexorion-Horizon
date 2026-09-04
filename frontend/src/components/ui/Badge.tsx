export function Badge({label,variant="neutral"}:{label:string;variant?:"success"|"warning"|"danger"|"neutral"}){return <span className={`badge ${variant}`}>{label}</span>}
