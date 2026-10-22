import { Badge } from "../../components/ui/Badge";
import { Empty } from "../../components/ui/Page";
import { Icon, type IconName } from "../../layout/SidebarIcon";
import {
  type EffectiveEntitlements,
  hasEntitlement,
  getEntitlementLimit,
  formatResourceLimit,
  isProductAvailable,
} from "../../features/entitlements/entitlementApi";

interface ProductCardData {
  key: string;
  name: string;
  icon: IconName;
  iconClass: string;
  description: string;
  available: boolean;
  limits: string[];
}

export function AdminEntitlements({ entitlements }: { entitlements: EffectiveEntitlements }) {
  if (!Array.isArray(entitlements) || entitlements.length === 0) {
    return <Empty>No active organization plan or product entitlements found.</Empty>;
  }

  // Shared resource limits dynamically derived from backend response
  const employeeLimit =
    getEntitlementLimit(entitlements, "platform.employee_limit") ??
    getEntitlementLimit(entitlements, "workforce.employee_limit");
  const workspaceLimit = getEntitlementLimit(entitlements, "platform.workspace_limit");

  const formattedEmployeeLimit = formatResourceLimit(employeeLimit, "employee", "employees");
  const formattedWorkspaceLimit = formatResourceLimit(workspaceLimit, "workspace", "workspaces");

  // Determine product availability from effective entitlements
  const workforceAvailable = isProductAvailable(entitlements, "workforce");
  const payrollAvailable = isProductAvailable(entitlements, "payroll");
  const hasPayrollProcessing = hasEntitlement(entitlements, "payroll.processing");

  const products: ProductCardData[] = [
    {
      key: "workforce",
      name: "Workforce",
      icon: "workforce",
      iconClass: "workforce",
      description:
        "Comprehensive workforce directory, department organization, job designations, and reporting hierarchy management.",
      available: workforceAvailable,
      limits: [
        ...(workforceAvailable && formattedEmployeeLimit ? [formattedEmployeeLimit] : []),
        ...(workforceAvailable && formattedWorkspaceLimit ? [formattedWorkspaceLimit] : []),
      ],
    },
    {
      key: "payroll",
      name: "Payroll",
      icon: "payroll",
      iconClass: "payroll",
      description:
        "Automated compensation management, salary components, calculation rules, and pay run execution.",
      available: payrollAvailable,
      limits: [
        ...(payrollAvailable && formattedEmployeeLimit ? [formattedEmployeeLimit] : []),
        ...(payrollAvailable && hasPayrollProcessing ? ["Automated pay run processing"] : []),
      ],
    },
  ];

  // Dynamically include any additional product present in the backend response (e.g., finance)
  const isFinancePresent =
    hasEntitlement(entitlements, "finance.enabled") ||
    entitlements.some((p) => p.productKey === "finance");
  if (isFinancePresent) {
    const financeAvailable = isProductAvailable(entitlements, "finance");
    products.push({
      key: "finance",
      name: "Finance",
      icon: "card",
      iconClass: "generic",
      description:
        "Financial operations, ledger accounting, invoice tracking, and corporate spend visibility.",
      available: financeAvailable,
      limits: [],
    });
  }

  return (
    <div className="product-access-container" data-testid="product-access-overview">
      <div className="product-access-grid">
        {products.map((product) => (
          <article
            key={product.key}
            className={`product-access-card ${product.available ? "available" : "unavailable"}`}
            data-testid={`product-card-${product.key}`}
          >
            <div className="product-access-card-header">
              <div className="product-access-card-identity">
                <span className={`product-access-card-icon ${product.iconClass}`}>
                  <Icon name={product.icon} size={20} />
                </span>
                <h3 className="product-access-card-name">{product.name}</h3>
              </div>
              <Badge
                label={product.available ? "Available" : "Not available"}
                variant={product.available ? "success" : "neutral"}
              />
            </div>

            <p className="product-access-card-desc">{product.description}</p>

            {product.available ? (
              product.limits.length > 0 && (
                <div className="product-access-limits-box">
                  <span className="product-access-limits-label">Plan allowances</span>
                  <div className="product-access-limits-list">
                    {product.limits.map((limit, idx) => (
                      <span key={idx} className="product-access-limit-badge">
                        <Icon name="shield" size={12} />
                        <span>{limit}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <p className="product-access-unavailable-note">
                This product is not enabled under your organization's current plan.
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
