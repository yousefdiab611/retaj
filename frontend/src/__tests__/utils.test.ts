import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn (tailwind-merge)", () => {
  it("merges conditional classes", () => {
    expect(cn("p-2", false && "hidden", "text-red-500")).toBe("p-2 text-red-500");
  });

  it("dedupes conflicting tailwind utilities (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("supports arrays and falsy values", () => {
    expect(cn(["p-2", null, undefined, "m-1"], false, "rounded")).toContain("p-2");
    expect(cn(["p-2", null, undefined, "m-1"], false, "rounded")).toContain("m-1");
    expect(cn(["p-2", null, undefined, "m-1"], false, "rounded")).toContain("rounded");
  });
});
