import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => vi.restoreAllMocks());

it("renders the project name", () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
  render(<App />);
  expect(screen.getByRole("heading").textContent).toBe("__NAME__");
});
