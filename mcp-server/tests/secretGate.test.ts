import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { secretGate, SECRET_HEADER } from "../src/app.js";

function appWith(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === "") delete process.env[k];
    else process.env[k] = v;
  }
  const app = express();
  app.use(express.json());
  app.post("/mcp", secretGate, (_req, res) => res.json({ ok: true }));
  return app;
}

describe("secretGate", () => {
  it("allows requests when REPOMEDIC_MCP_SECRET is unset (local mode)", async () => {
    const res = await request(appWith({ REPOMEDIC_MCP_SECRET: "" })).post("/mcp").send({});
    expect(res.status).toBe(200);
  });

  it("rejects requests without the header when a secret is required", async () => {
    const res = await request(appWith({ REPOMEDIC_MCP_SECRET: "s3cret" })).post("/mcp").send({});
    expect(res.status).toBe(401);
  });

  it("rejects wrong secrets", async () => {
    const res = await request(appWith({ REPOMEDIC_MCP_SECRET: "s3cret" }))
      .post("/mcp")
      .set(SECRET_HEADER, "wrong")
      .send({});
    expect(res.status).toBe(401);
  });

  it("accepts the matching secret header", async () => {
    const res = await request(appWith({ REPOMEDIC_MCP_SECRET: "s3cret" }))
      .post("/mcp")
      .set(SECRET_HEADER, "s3cret")
      .send({});
    expect(res.status).toBe(200);
  });
});
