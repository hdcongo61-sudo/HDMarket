"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const processes = [
  { name: "backend", cwd: path.resolve(__dirname, "..", "backend") },
  { name: "frontend", cwd: path.resolve(__dirname, "..", "frontend") }
];

const running = new Map();
let shuttingDown = false;

const terminateAll = (signal = "SIGTERM") => {
  shuttingDown = true;

  for (const child of running.values()) {
    if (process.platform === "win32") {
      child.kill();
    } else {
      child.kill(signal);
    }
  }
};

const spawnProcess = ({ name, cwd }) => {
  const child = spawn(npmCommand, ["run", "dev"], {
    cwd,
    stdio: "inherit",
    shell: false
  });

  running.set(name, child);

  child.on("exit", (code, signal) => {
    running.delete(name);

    if (!shuttingDown) {
      terminateAll(signal ?? (code === 0 ? "SIGTERM" : "SIGINT"));
      process.exitCode = code ?? 0;
    } else if (running.size === 0) {
      process.exitCode ??= code ?? 0;
    }
  });

  child.on("error", (error) => {
    console.error(`[${name}] failed to start:`, error);
    terminateAll();
    process.exitCode = 1;
  });
};

process.on("SIGINT", () => {
  terminateAll("SIGINT");
});

process.on("SIGTERM", () => {
  terminateAll("SIGTERM");
});

for (const proc of processes) {
  spawnProcess(proc);
}
