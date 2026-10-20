import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ApplicationContextProvider, useApplicationContext } from "./ApplicationContext";
import { session } from "../api/session";

vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ loading: true, user: null }) }));
afterEach(() => { cleanup(); sessionStorage.clear(); });

it("restores local platform mode before route guards run during session loading", () => {
  session.setMode("platform");
  function View() { return <output>{useApplicationContext().mode}</output>; }
  render(<ApplicationContextProvider><View /></ApplicationContextProvider>);
  expect(screen.getByRole("status").textContent).toBe("platform");
});
