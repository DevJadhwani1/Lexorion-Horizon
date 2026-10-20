import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HorizonWorkflowNav, workflowLink, workflowReturn } from "./HorizonWorkflowNav";
afterEach(cleanup);
it("returns from compensation to the original pay run", () => {
  const target = workflowLink("/app/payroll/compensation?employee=EMP-1", "/app/payroll/pay-runs?run=RUN-1");
  render(<MemoryRouter initialEntries={[target]}><HorizonWorkflowNav /></MemoryRouter>);
  expect(screen.getByRole("link", { name: /Return to pay run/ }).getAttribute("href")).toBe("/app/payroll/pay-runs?run=RUN-1");
});
it("does not permit an external or authentication return destination", () => {
  expect(workflowReturn("?returnTo=https://external.test/app/payroll/pay-runs")).toBeNull();
  expect(workflowReturn("?returnTo=/login")).toBeNull();
});
