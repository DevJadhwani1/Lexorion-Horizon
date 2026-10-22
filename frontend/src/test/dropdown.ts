import { fireEvent, screen, within } from "@testing-library/react";

/** Chooses an option in a Horizon Dropdown the way a user does: open the combobox, then click the option. */
export function chooseOption(label: string | RegExp, option: string | RegExp) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  const listbox = screen.getByRole("listbox", { name: label });
  fireEvent.click(within(listbox).getByRole("option", { name: option }));
}
