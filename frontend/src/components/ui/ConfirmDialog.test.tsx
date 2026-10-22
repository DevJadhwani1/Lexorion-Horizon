import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useConfirm } from "./ConfirmDialog";

afterEach(cleanup);

function Harness() {
  const [ask, dialog] = useConfirm();
  const [result, setResult] = useState("");
  return <>{dialog}<button onClick={async () => setResult(String(await ask({ title: "Finalize JAN?", body: "This cannot be undone.", confirmLabel: "Finalize", tone: "destructive" })))}>Open</button><output>{result}</output></>;
}

it("asks in-product, starts on Cancel and resolves with the choice", async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const dialog = await screen.findByRole("dialog", { name: "Finalize JAN?" });
  expect(dialog.textContent).toContain("This cannot be undone.");
  expect(document.activeElement?.textContent).toBe("Cancel");
  fireEvent.click(screen.getByRole("button", { name: "Finalize" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("true"));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("false"));
});
