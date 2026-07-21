import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrateWorkspace } from "../scripts/migrate-private-workspace.mjs";

test("migrates memory, archives bootstrap, and injects private policy once", () => {
  const root = mkdtempSync(join(tmpdir(), "openclaw-workspace-"));
  const source = join(root, "source");
  const destination = join(root, "destination");
  const memory = join(root, "memory.md");
  mkdirSync(source);
  writeFileSync(join(source, "AGENTS.md"), "# Existing\n");
  writeFileSync(join(source, "BOOTSTRAP.md"), "bootstrap\n");
  writeFileSync(memory, "private facts\n");

  migrateWorkspace({ source, destination, memory });
  migrateWorkspace({ source, destination, memory });

  assert.equal(readFileSync(join(destination, "MEMORY.md"), "utf8"), "private facts\n");
  assert.equal(readFileSync(join(destination, "archive", "BOOTSTRAP.completed.md"), "utf8"), "bootstrap\n");
  const agents = readFileSync(join(destination, "AGENTS.md"), "utf8");
  assert.equal(agents.match(/career-scout-private-policy/g).length, 1);
});
