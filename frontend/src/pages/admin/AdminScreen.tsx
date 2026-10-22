import type { ReactNode } from "react";
import { Page } from "../../components/ui/Page";

export function AdminScreen({
  sectionKey: _sectionKey,
  title,
  description,
  actions,
  children,
}: {
  sectionKey?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Page title={title} description={description} actions={actions}>
      <div className="admin-content-stage">
        {children}
      </div>
    </Page>
  );
}

