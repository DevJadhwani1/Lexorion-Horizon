import { useState, useId, useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { appPath } from "../../app/hostRouting";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError } from "../../api/types";
import {
  createDepartment,
  updateDepartment,
  type Reference,
} from "../../features/workforce/workforceApi";
import { Page, Notice } from "../../components/ui/Page";
import { StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Dropdown } from "../../components/ui/Dropdown";
import { Table } from "../admin/AdminPage";
import { Icon } from "../../layout/SidebarIcon";
import { keyFromName } from "../../lib/format";
import { useConfirm } from "../../components/ui/ConfirmDialog";

interface DepartmentsPageProps {
  items: Reference[];
  reload(): Promise<void>;
}

interface DepartmentTreeNode {
  dept: Reference;
  depth: number;
  parentName?: string;
}

function buildDepartmentTree(items: Reference[]): DepartmentTreeNode[] {
  const map = new Map<string, Reference>();
  const childrenMap = new Map<string, Reference[]>();

  for (const item of items) {
    map.set(item.key, item);
  }

  const roots: Reference[] = [];
  for (const item of items) {
    if (item.parentDepartmentKey && map.has(item.parentDepartmentKey)) {
      const list = childrenMap.get(item.parentDepartmentKey) ?? [];
      list.push(item);
      childrenMap.set(item.parentDepartmentKey, list);
    } else {
      roots.push(item);
    }
  }

  roots.sort((a, b) => a.name.localeCompare(b.name));

  const result: DepartmentTreeNode[] = [];
  const visited = new Set<string>();

  function traverse(item: Reference, depth: number, parentName?: string) {
    if (visited.has(item.key)) return;
    visited.add(item.key);
    result.push({ dept: item, depth, parentName });
    const children = childrenMap.get(item.key) ?? [];
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      traverse(child, depth + 1, item.name);
    }
  }

  for (const root of roots) {
    traverse(root, 0);
  }

  for (const item of items) {
    if (!visited.has(item.key)) {
      result.push({
        dept: item,
        depth: 0,
        parentName: item.parentDepartmentKey ? map.get(item.parentDepartmentKey)?.name : undefined,
      });
    }
  }

  return result;
}

function getDescendants(key: string, items: Reference[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [key];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const item of items) {
      if (item.parentDepartmentKey === current && !descendants.has(item.key)) {
        descendants.add(item.key);
        queue.push(item.key);
      }
    }
  }
  return descendants;
}

interface DepartmentModalProps {
  open: boolean;
  onClose(): void;
  onSuccess(name: string, isEdit: boolean): void;
  editingDept: Reference | null;
  departments: Reference[];
}

function DepartmentModal({
  open,
  onClose,
  onSuccess,
  editingDept,
  departments,
}: DepartmentModalProps) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [parentKey, setParentKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const modalId = useId();

  useEffect(() => {
    if (open) {
      setError("");
      setBusy(false);
      if (editingDept) {
        setName(editingDept.name);
        setKey(editingDept.key);
        setKeyEdited(true);
        setParentKey(editingDept.parentDepartmentKey ?? "");
      } else {
        setName("");
        setKey("");
        setKeyEdited(false);
        setParentKey("");
      }
    }
  }, [open, editingDept]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const descendantKeys = editingDept ? getDescendants(editingDept.key, departments) : new Set<string>();
  const parentOptions = [
    { value: "", label: "None (top level)" },
    ...departments
      .filter((d) => d.status === "ACTIVE" && (!editingDept || (d.key !== editingDept.key && !descendantKeys.has(d.key))))
      .map((d) => ({ value: d.key, label: d.name })),
  ];

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingDept && !keyEdited) {
      setKey(keyFromName(val));
    }
  };

  const handleKeyChange = (val: string) => {
    setKey(val.toLowerCase());
    setKeyEdited(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Department name is required.");
      return;
    }

    if (trimmedName.length > 150) {
      setError("Department name cannot exceed 150 characters.");
      return;
    }

    let finalKey = key.trim().toLowerCase();
    if (!editingDept && !finalKey) {
      finalKey = keyFromName(trimmedName);
    }

    if (!editingDept) {
      if (!finalKey) {
        setError("Please provide a valid short code using lowercase letters, numbers, and hyphens.");
        return;
      }
      const keyPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
      if (!keyPattern.test(finalKey)) {
        setError("Short code must start and end with a letter or number, contain only lowercase letters, numbers, or hyphens, and be up to 63 characters.");
        return;
      }
      if (departments.some((d) => d.key === finalKey)) {
        setError(`A department with short code "${finalKey}" already exists.`);
        return;
      }
    }

    setBusy(true);
    setError("");

    try {
      if (editingDept) {
        await updateDepartment(editingDept.key, {
          name: trimmedName,
          parentDepartmentKey: parentKey || null,
        });
        onSuccess(trimmedName, true);
      } else {
        await createDepartment({
          key: finalKey,
          name: trimmedName,
          parentDepartmentKey: parentKey || null,
        });
        onSuccess(trimmedName, false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to save department.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="horizon-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="horizon-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${modalId}-title`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="horizon-modal-header">
          <div>
            <h2 id={`${modalId}-title`}>
              {editingDept ? "Edit department" : "Add department"}
            </h2>
            <p>
              {editingDept
                ? "Update department name and hierarchy."
                : "Departments organize employees and may have parent-child relationships."}
            </p>
          </div>
          <button
            type="button"
            className="horizon-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <div className="horizon-modal-body">
            {error && <Notice tone="error">{error}</Notice>}

            <label className="horizon-field-group">
              <span className="field-label">
                Department name <strong className="required">*</strong>
              </span>
              <input
                id="department-name-input"
                name="name"
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Engineering, Sales, Operations"
                maxLength={150}
                aria-required="true"
              />
            </label>

            <Field
              label="Short code"
              hint={
                editingDept
                  ? "Short codes cannot be changed after creation."
                  : "Unique identifier used in imports and reports. Auto-generated from name if omitted."
              }
            >
              <input
                id="department-key-input"
                name="key"
                type="text"
                disabled={Boolean(editingDept)}
                value={key}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="e.g. engineering"
                pattern="[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?"
                title="Lowercase letters, numbers, and hyphens"
              />
            </Field>

            <Dropdown
              label="Parent department"
              name="parentDepartmentKey"
              value={parentKey}
              onChange={setParentKey}
              options={parentOptions}
            />
          </div>

          <footer className="horizon-modal-footer">
            <Button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={busy || !name.trim()}
            >
              {busy
                ? editingDept
                  ? "Saving…"
                  : "Creating…"
                : editingDept
                  ? "Save changes"
                  : "Add department"}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export function DepartmentsPage({ items, reload }: DepartmentsPageProps) {
  const auth = useAuth();
  const isAdmin = auth.organization?.membershipRole === "ADMIN";

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Reference | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [ask, confirmDialog] = useConfirm();

  const namesMap = new Map(items.map((i) => [i.key, i.name]));
  const treeNodes = buildDepartmentTree(items);

  const handleOpenAdd = () => {
    setEditingDept(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (dept: Reference) => {
    setEditingDept(dept);
    setModalOpen(true);
  };

  const handleModalSuccess = async (name: string, isEdit: boolean) => {
    setModalOpen(false);
    setEditingDept(null);
    setNotice({
      message: isEdit
        ? `Department "${name}" updated successfully.`
        : `Department "${name}" created successfully.`,
      tone: "success",
    });
    await reload();
  };

  const handleToggleStatus = async (dept: Reference) => {
    const isActivating = dept.status !== "ACTIVE";
    const nextStatus = isActivating ? "ACTIVE" : "INACTIVE";

    if (!isActivating) {
      const confirmed = await ask({
        title: `Deactivate ${dept.name}?`,
        body: "Existing employees will keep their department assignment, but this department cannot receive new assignments.",
        confirmLabel: "Deactivate",
        tone: "destructive",
      });
      if (!confirmed) return;
    }

    setBusyKey(dept.key);
    setNotice(null);

    try {
      await updateDepartment(dept.key, { status: nextStatus });
      setNotice({
        message: `Department "${dept.name}" ${isActivating ? "activated" : "deactivated"}.`,
        tone: "success",
      });
      await reload();
    } catch (err) {
      setNotice({
        message: err instanceof ApiError ? err.message : `Unable to update department status.`,
        tone: "error",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const breadcrumb = (
    <nav className="page-breadcrumb" aria-label="Breadcrumb">
      <ol className="page-breadcrumb-list">
        <li>
          <Link to={appPath("/organization")}>Organization</Link>
        </li>
        <li className="page-breadcrumb-separator" aria-hidden="true">
          /
        </li>
        <li>
          <Link to={appPath("/workforce/employees")}>Workforce</Link>
        </li>
        <li className="page-breadcrumb-separator" aria-hidden="true">
          /
        </li>
        <li aria-current="page">Departments</li>
      </ol>
    </nav>
  );

  return (
    <Page
      title="Departments"
      description="Departments organize employees and may have parent-child relationships."
      breadcrumb={breadcrumb}
      actions={
        isAdmin ? (
          <Button variant="primary" onClick={handleOpenAdd}>
            Add department
          </Button>
        ) : undefined
      }
    >
      {confirmDialog}

      {notice && (
        <div style={{ marginBottom: "16px" }}>
          <Notice tone={notice.tone}>{notice.message}</Notice>
        </div>
      )}

      {items.length === 0 ? (
        <div className="departments-empty-state">
          <div className="empty-icon-wrap" aria-hidden="true">
            <Icon name="workforce" size={28} />
          </div>
          <h3>No departments yet</h3>
          <p>
            Departments organize employees and may have parent-child relationships.
            Add your first department to get started.
          </p>
          {isAdmin && (
            <Button variant="primary" onClick={handleOpenAdd}>
              Add department
            </Button>
          )}
        </div>
      ) : (
        <Table headers={["Department", "Short code", "Parent department", "Status", "Actions"]}>
          {treeNodes.map(({ dept, depth, parentName }) => (
            <tr key={dept.key}>
              <td>
                <div
                  className="dept-name-cell"
                  style={{ paddingLeft: depth > 0 ? `${depth * 20}px` : undefined }}
                >
                  <div className="dept-name-row">
                    {depth > 0 && (
                      <span className="dept-tree-branch" aria-hidden="true">
                        ↳{" "}
                      </span>
                    )}
                    <strong>{dept.name}</strong>
                  </div>
                  {depth > 0 && parentName && (
                    <span className="dept-parent-subtext">
                      Sub-department of {parentName}
                    </span>
                  )}
                </div>
              </td>
              <td>
                <code>{dept.key}</code>
              </td>
              <td>
                {dept.parentDepartmentKey ? (
                  <span className="dept-parent-badge">
                    {namesMap.get(dept.parentDepartmentKey) ?? dept.parentDepartmentKey}
                  </span>
                ) : (
                  <span className="cell-note">None (top level)</span>
                )}
              </td>
              <td>
                <StatusBadge status={dept.status} />
              </td>
              <td>
                {isAdmin ? (
                  <div className="table-actions">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleOpenEdit(dept)}
                      disabled={busyKey === dept.key}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={dept.status === "ACTIVE" ? "secondary" : "primary"}
                      onClick={() => void handleToggleStatus(dept)}
                      disabled={busyKey === dept.key}
                    >
                      {busyKey === dept.key
                        ? "Updating…"
                        : dept.status === "ACTIVE"
                          ? "Deactivate"
                          : "Activate"}
                    </Button>
                  </div>
                ) : (
                  <span className="cell-note">—</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <DepartmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleModalSuccess}
        editingDept={editingDept}
        departments={items}
      />
    </Page>
  );
}
