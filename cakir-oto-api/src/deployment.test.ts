import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = fileURLToPath(new URL("../", import.meta.url));
const appOrigin = "https://cakir-panel-vue-wvf7.vercel.app";

test(
  "isolated API deployment starts and serves credentialed login CORS",
  { timeout: 30_000 },
  async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "cakir-api-deploy-"));
    const dependencyLink = join(temporaryRoot, "node_modules");
    let child: ReturnType<typeof spawn> | undefined;
    try {
      // Copy only the API package: no parent shared directory or real .env files.
      for (const directory of ["src", "generated", "shared"]) {
        await cp(join(apiRoot, directory), join(temporaryRoot, directory), { recursive: true });
      }
      await cp(join(apiRoot, "package.json"), join(temporaryRoot, "package.json"));
      await symlink(join(apiRoot, "node_modules"), dependencyLink, "junction");
      await writeFile(
        join(temporaryRoot, "boot.mts"),
        [
          'import { app } from "./src/app.js";',
          'const server = app.listen(0, "127.0.0.1", () => {',
          '  console.log("API_READY:" + server.address().port);',
          "});",
        ].join("\n"),
      );
      child = spawn(process.execPath, ["--import", "tsx", "boot.mts"], {
        cwd: temporaryRoot,
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://deployment-test:unused@127.0.0.1:1/deployment-test",
          APP_ORIGIN: appOrigin,
          AUTH_USERNAME: "deployment-test",
          AUTH_PASSWORD: "deployment-test-password",
          AUTH_SECRET: "deployment-test-secret-at-least-32-characters",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      const processHandle = child;
      let logs = "";
      const baseUrl = await new Promise<string>((resolveReady, reject) => {
        const timer = setTimeout(() => reject(new Error(`API startup timed out: ${logs}`)), 15_000);
        processHandle.stderr?.on("data", (data) => {
          logs += data.toString();
        });
        processHandle.stdout?.on("data", (data) => {
          logs += data.toString();
          const port = logs.match(/API_READY:(\d+)/)?.[1];
          if (port) {
            clearTimeout(timer);
            resolveReady(`http://127.0.0.1:${port}`);
          }
        });
        processHandle.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        processHandle.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`API exited (${code}): ${logs}`));
        });
      });
      const health = await fetch(`${baseUrl}/api/health`, { headers: { Origin: appOrigin } });
      assert.equal(health.status, 200);
      assert.equal(health.headers.get("access-control-allow-origin"), appOrigin);
      assert.equal(health.headers.get("access-control-allow-credentials"), "true");
      const preflight = await fetch(`${baseUrl}/api/auth/login`, {
        method: "OPTIONS",
        headers: {
          Origin: appOrigin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type,x-app-request",
        },
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("access-control-allow-origin"), appOrigin);
      assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
      assert.ok(
        preflight.headers
          .get("access-control-allow-headers")
          ?.toLowerCase()
          .includes("x-app-request"),
      );
      const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          Origin: appOrigin,
          "Content-Type": "application/json",
          "X-App-Request": "cakir-panel",
        },
        body: JSON.stringify({ username: "deployment-test", password: "deployment-test-password" }),
      });
      assert.equal(login.status, 200);
      assert.equal(login.headers.get("access-control-allow-origin"), appOrigin);
      assert.ok(login.headers.get("set-cookie")?.includes("SameSite=None"));
      assert.ok(login.headers.get("set-cookie")?.includes("Secure"));
      const rejected = await fetch(`${baseUrl}/api/auth/login`, {
        method: "OPTIONS",
        headers: { Origin: "https://unlisted.example", "Access-Control-Request-Method": "POST" },
      });
      assert.equal(rejected.headers.get("access-control-allow-origin"), null);
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "exit");
        child.kill();
        await exited;
      }
      // Unlink our junction before recursive cleanup to protect the real dependencies.
      const linkTarget = await realpath(dependencyLink).catch(() => null);
      if (linkTarget) {
        assert.equal(linkTarget, await realpath(join(apiRoot, "node_modules")));
        await unlink(dependencyLink);
      }
      // Verify the resolved Windows cleanup target is the explicitly created temp folder.
      assert.equal(dirname(resolve(temporaryRoot)), resolve(tmpdir()));
      assert.ok(basename(temporaryRoot).startsWith("cakir-api-deploy-"));
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  },
);

test("relative imports stay inside the independently deployed API package", async () => {
  const inspect = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        await inspect(file);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(/\b(?:from\s+|import\s*\()\s*["'](\.[^"']+)["']/g)) {
        const location = relative(apiRoot, resolve(dirname(file), match[1]!));
        assert.ok(
          location !== ".." && !location.startsWith(`..${sep}`),
          `${relative(apiRoot, file)} imports outside the API: ${match[1]}`,
        );
      }
    }
  };
  await inspect(join(apiRoot, "src"));
  await inspect(join(apiRoot, "shared"));
});
