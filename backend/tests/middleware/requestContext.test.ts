import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { requestContext } from "@/middleware/requestContext";

function buildApp() {
  const app = express();
  app.use(requestContext);
  app.get("/ping", (req, res) => {
    res.json({ pong: true, requestId: req.requestId });
  });
  return app;
}

describe("requestContext middleware", () => {
  it("generates a UUID request id and echoes it via header + body", async () => {
    const app = buildApp();
    const res = await request(app).get("/ping");
    expect(res.status).toBe(200);
    expect(res.body.pong).toBe(true);
    expect(res.body.requestId).toBeTruthy();
    expect(res.headers["x-request-id"]).toBe(res.body.requestId);
    expect(res.body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("respects an upstream x-request-id header when it is well-formed", async () => {
    const app = buildApp();
    const incoming = "trace-abcdef-12345";
    const res = await request(app).get("/ping").set("x-request-id", incoming);
    expect(res.status).toBe(200);
    expect(res.body.requestId).toBe(incoming);
    expect(res.headers["x-request-id"]).toBe(incoming);
  });

  it("rejects malformed upstream ids and replaces them with a fresh UUID", async () => {
    const app = buildApp();
    const res = await request(app).get("/ping").set("x-request-id", "$$bad value$$");
    expect(res.body.requestId).not.toBe("$$bad value$$");
    expect(res.body.requestId).toMatch(/-/);
  });
});
