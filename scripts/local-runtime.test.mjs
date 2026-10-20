import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureDocker } from "./docker-ready.mjs";

test("a healthy engine never stops Desktop or touches its runtime", async () => {
  const calls = [];
  await ensureDocker({
    platform: "win32",
    run: async (_file, args) => {
      calls.push(args);
      return "28.0.4";
    },
    files: { rename: () => assert.fail("must not move runtime") },
  });
  assert.equal(calls.length, 1);
});

test("a stopped Desktop parks stale sockets before starting and waits for the engine", async () => {
  const calls = [],
    moves = [];
  let running = false;
  await ensureDocker({
    platform: "win32",
    localAppData: "C:/Users/test/AppData/Local",
    log: () => {},
    run: async (file, args) => {
      calls.push([file, ...args]);
      if (args[0] === "info") {
        if (!running) throw new Error("pipe absent");
        return "28.0.4";
      }
      if (args[0] === "context")
        return JSON.stringify("npipe:////./pipe/dockerDesktopLinuxEngine");
      if (args[1] === "status") return JSON.stringify({ Status: "stopped" });
      if (file === "powershell.exe") return "0";
      if (args[1] === "start") running = true;
      return "";
    },
    files: {
      readdir: async () => ["userAnalyticsOtlpHttp.sock"],
      rename: async (from, to) => moves.push([from, to]),
      mkdir: async () => {},
    },
  });
  assert.equal(moves.length, 1);
  assert.match(moves[0][1], /run-stale-/);
  assert.ok(
    calls.findIndex((call) => call[2] === "stop") <
      calls.findIndex((call) => call[2] === "start"),
  );
});

test("an engine already starting is not stopped or modified", async () => {
  let probes = 0;
  await ensureDocker({
    platform: "win32",
    sleep: async () => {},
    log: () => {},
    run: async (_file, args) => {
      if (args[0] === "info") {
        if (++probes < 3) throw new Error("starting");
        return "28.0.4";
      }
      if (args[0] === "context")
        return JSON.stringify("npipe:////./pipe/dockerDesktopLinuxEngine");
      if (args[1] === "status") return JSON.stringify({ Status: "starting" });
      assert.notEqual(args[1], "stop");
      return "";
    },
    files: { rename: () => assert.fail("must not move runtime") },
  });
});

test("remote contexts and live Desktop processes block local socket recovery", async () => {
  const base = {
    platform: "win32",
    localAppData: "C:/Users/test/AppData/Local",
    log: () => {},
    files: {
      readdir: async () => ["userAnalyticsOtlpHttp.sock"],
      rename: () => assert.fail("must not move runtime"),
    },
  };
  await assert.rejects(
    ensureDocker({
      ...base,
      run: async (_file, args) => {
        if (args[0] === "info") throw new Error();
        return JSON.stringify("ssh://remote");
      },
    }),
    /context/,
  );
  await assert.rejects(
    ensureDocker({
      ...base,
      run: async (file, args) => {
        if (args[0] === "info") throw new Error();
        if (args[0] === "context")
          return JSON.stringify("npipe:////./pipe/dockerDesktopLinuxEngine");
        if (args[1] === "status") return JSON.stringify({ Status: "stopped" });
        return file === "powershell.exe" ? "1" : "";
      },
    }),
    /vẫn còn tiến trình/,
  );
});

test("a cold Desktop that fails its first start recovers the stopped runtime once", async () => {
  let starts = 0,
    moved = 0,
    tick = 0;
  await ensureDocker({
    platform: "win32",
    localAppData: "C:/Users/test/AppData/Local",
    log: () => {},
    now: () => tick,
    sleep: async () => {
      tick += 2000;
    },
    run: async (file, args) => {
      if (args[0] === "info") {
        if (starts < 2) throw new Error("engine absent");
        return "28.0.4";
      }
      if (args[0] === "context")
        return JSON.stringify("npipe:////./pipe/dockerDesktopLinuxEngine");
      if (args[1] === "status") {
        if (!starts) throw new Error("Desktop not running");
        return JSON.stringify({ Status: "stopped" });
      }
      if (args[1] === "start") starts++;
      return file === "powershell.exe" ? "0" : "";
    },
    files: {
      readdir: async () => ["userAnalyticsOtlpHttp.sock"],
      rename: async () => {
        moved++;
      },
      mkdir: async () => {},
    },
  });
  assert.equal(starts, 2);
  assert.equal(moved, 1);
});
