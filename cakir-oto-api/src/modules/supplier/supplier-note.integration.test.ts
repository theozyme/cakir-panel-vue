import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { after, before, describe, test } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

type Note = {
  id: string;
  supplierId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

describe("supplier notebook API", { skip: !testDatabaseUrl }, () => {
  const supplierId = randomUUID();
  const otherSupplierId = randomUUID();
  let prisma: ReturnType<(typeof import("../../lib/prisma.js"))["getPrisma"]>;
  let server: Server;
  let baseUrl: string;
  let cookie: string;

  before(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.AUTH_USERNAME = "notebook-integration";
    process.env.AUTH_PASSWORD = randomUUID();
    process.env.AUTH_SECRET = randomUUID() + randomUUID();
    const { app } = await import("../../app.js");
    const { createSessionToken, SESSION_COOKIE_NAME } = await import("../auth/auth.service.js");
    cookie = `${SESSION_COOKIE_NAME}=${createSessionToken()}`;
    prisma = (await import("../../lib/prisma.js")).getPrisma();
    await prisma.supplier.createMany({
      data: [
        { id: supplierId, name: `Notebook test ${supplierId}`, currency: "TRY" },
        {
          id: otherSupplierId,
          name: `Notebook test ${otherSupplierId}`,
          currency: "USD",
          isActive: false,
        },
      ],
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}/api/suppliers`;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    if (prisma) {
      await prisma.supplier.deleteMany({ where: { id: { in: [supplierId, otherSupplierId] } } });
      await prisma.$disconnect();
    }
  });

  const request = (path: string, method = "GET", body?: unknown) =>
    fetch(`${baseUrl}/${path}`, {
      method,
      headers: {
        Cookie: cookie,
        "X-App-Request": "cakir-panel",
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  test("CRUD preserves multiline content, sorts by latest change, and creates no financial movements", async () => {
    assert.deepEqual(await (await request(`${supplierId}/notes`)).json(), []);
    const created = await request(`${supplierId}/notes`, "POST", {
      content: "  İlk satır\nİkinci satır  ",
    });
    assert.equal(created.status, 201);
    const first = (await created.json()) as Note;
    assert.equal(first.content, "İlk satır\nİkinci satır");
    assert.equal(first.supplierId, supplierId);
    await prisma.supplierNote.update({
      where: { id: first.id },
      data: {
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
    const second = (await (
      await request(`${supplierId}/notes`, "POST", { content: "Yeni not" })
    ).json()) as Note;
    let listed = (await (await request(`${supplierId}/notes?year=2000&month=1`)).json()) as Note[];
    assert.deepEqual(
      listed.map((note) => note.id),
      [second.id, first.id],
    );
    const patched = await request(`${supplierId}/notes/${first.id}`, "PATCH", {
      content: "Düzenlenmiş\nnot",
    });
    assert.equal(patched.status, 200);
    listed = (await (await request(`${supplierId}/notes`)).json()) as Note[];
    assert.deepEqual(
      listed.map((note) => note.id),
      [first.id, second.id],
    );
    assert.equal(listed[0]?.content, "Düzenlenmiş\nnot");
    assert.equal(listed[0]?.createdAt, "2026-01-01T00:00:00.000Z");
    assert.equal(await prisma.supplierTransaction.count({ where: { supplierId } }), 0);
    assert.equal((await request(`${supplierId}/notes/${first.id}`, "DELETE")).status, 200);
    assert.equal((await request(`${supplierId}/notes/${first.id}`, "DELETE")).status, 404);
    assert.equal((await request(`${supplierId}/notes/${second.id}`, "DELETE")).status, 200);
    assert.deepEqual(await (await request(`${supplierId}/notes`)).json(), []);
  });

  test("validates empty, invalid and oversized content on create and update", async () => {
    for (const content of ["", " \n ", 123, null, "x".repeat(10001)]) {
      assert.equal((await request(`${supplierId}/notes`, "POST", { content })).status, 400);
    }
    const note = (await (
      await request(`${supplierId}/notes`, "POST", { content: "x".repeat(10000) })
    ).json()) as Note;
    assert.ok(note.id);
    assert.equal(
      (await request(`${supplierId}/notes/${note.id}`, "PATCH", { content: " " })).status,
      400,
    );
    assert.equal((await request(`${supplierId}/notes/${note.id}`, "DELETE")).status, 200);
  });

  test("scopes notes to their supplier and supports inactive suppliers", async () => {
    const created = await request(`${otherSupplierId}/notes`, "POST", {
      content: "Pasif firma notu",
    });
    assert.equal(created.status, 201);
    const note = (await created.json()) as Note;
    assert.deepEqual(await (await request(`${supplierId}/notes`)).json(), []);
    assert.equal(
      (await request(`${supplierId}/notes/${note.id}`, "PATCH", { content: "Başka firma" })).status,
      404,
    );
    assert.equal((await request(`${supplierId}/notes/${note.id}`, "DELETE")).status, 404);
    assert.equal(
      ((await (await request(`${otherSupplierId}/notes`)).json()) as Note[])[0]?.content,
      "Pasif firma notu",
    );
    assert.equal(
      await prisma.supplierTransaction.count({ where: { supplierId: otherSupplierId } }),
      0,
    );
  });

  test("returns 404 for missing suppliers and notes", async () => {
    const missingId = randomUUID();
    assert.equal((await request(`${missingId}/notes`)).status, 404);
    assert.equal((await request(`${missingId}/notes`, "POST", { content: "Not" })).status, 404);
    assert.equal(
      (await request(`${supplierId}/notes/${missingId}`, "PATCH", { content: "Not" })).status,
      404,
    );
    assert.equal((await request(`${supplierId}/notes/${missingId}`, "DELETE")).status, 404);
  });

  test("retains existing authentication and app-request protections", async () => {
    assert.equal((await fetch(`${baseUrl}/${supplierId}/notes`)).status, 401);
    assert.equal(
      (
        await fetch(`${baseUrl}/${supplierId}/notes`, {
          method: "POST",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Not" }),
        })
      ).status,
      403,
    );
  });
});
