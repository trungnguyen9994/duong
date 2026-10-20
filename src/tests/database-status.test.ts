import { describe, expect, it } from "vitest";
import { databaseUnavailable } from "../../server/database-status";

describe("temporary database outages", () => {
  it("recognizes refused connections and nested connection failures", () => {
    expect(
      databaseUnavailable(
        Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" }),
      ),
    ).toBe(true);
    expect(
      databaseUnavailable(
        new AggregateError([Object.assign(new Error(), { code: "ETIMEDOUT" })]),
      ),
    ).toBe(true);
    expect(
      databaseUnavailable(new Error("connect ECONNREFUSED 127.0.0.1:3306")),
    ).toBe(true);
  });
  it("does not mark validation, permissions or SQL bugs as temporary outages", () => {
    expect(databaseUnavailable({ code: "ER_ACCESS_DENIED_ERROR" })).toBe(false);
    expect(databaseUnavailable({ code: "ER_BAD_FIELD_ERROR" })).toBe(false);
    expect(databaseUnavailable(new Error("FORBIDDEN"))).toBe(false);
    expect(databaseUnavailable(undefined)).toBe(false);
  });
});
