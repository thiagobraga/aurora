import request from "supertest";
import { expect, it } from "vitest";
import { createApp } from "./app.js";

it("reports health", async () => {
  const res = await request(createApp({ dbHealthy: async () => true })).get("/api/v1/health").expect(200);
  expect(res.body).toEqual({ ok: true, db: true });
});
