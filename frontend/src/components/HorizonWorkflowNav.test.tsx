import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HorizonWorkflowNav, workflowLink, workflowReturn } from "./HorizonWorkflowNav";
afterEach(cleanup);
it("returns from compensation to the original pay run", () => {
  const target = workflowLink("/payroll/compensation?employee=EMP-1", "/payroll/runs?run=RUN-1");
  render(<MemoryRouter initialEntries={[target]}><HorizonWorkflowNav /></MemoryRouter>);
  expect(screen.getByRole("link", { name: /Back to pay run/ }).getAttribute("href")).toBe("/payroll/runs?run=RUN-1");
});
it("does not permit an external or authentication return destination", () => {
  expect(workflowReturn("?returnTo=https://external.test/payroll/runs")).toBeNull();
  expect(workflowReturn("?returnTo=/login")).toBeNull();
});
it("renders nothing without a return destination, leaving navigation to the sidebar", () => {
  const view = render(<MemoryRouter initialEntries={["/workforce/employees"]}><HorizonWorkflowNav /></MemoryRouter>);
  expect(view.container.innerHTML).toBe("");
  expect(screen.queryByText(/Horizon overview/)).toBeNull();
});
