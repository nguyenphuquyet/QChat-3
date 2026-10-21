import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";
const base = process.env.TEST_API_URL;
test(
  "real API: friendship, authorization, realtime, idempotency and revoked sessions",
  { skip: !base, timeout: 60000 },
  async () => {
    async function request(
      path: string,
      method = "GET",
      body?: unknown,
      token?: string,
    ) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, data: await response.json() };
    }
    const suffix = randomUUID().slice(0, 8);
    const register = async (name: string) =>
      (
        await request("/auth/register", "POST", {
          qchatId: `${name}_${suffix}`,
          email: `${name}_${suffix}@example.test`,
          nickname: name,
          password: "A-long-integration-password!",
        })
      ).data;
    const a = await register("alice"),
      b = await register("bob"),
      outsider = await register("outsider");
    assert.ok(a.accessToken && b.accessToken);
    const invitation = await request(
      "/friends/requests",
      "POST",
      { recipientId: b.userId },
      a.accessToken,
    );
    assert.equal(invitation.status, 200);
    assert.equal(
      (
        await request(
          `/friends/requests/${invitation.data.id}`,
          "PATCH",
          { accept: true },
          b.accessToken,
        )
      ).status,
      200,
    );
    const conversation = (
      await request(
        "/conversations",
        "POST",
        { memberIds: [b.userId] },
        a.accessToken,
      )
    ).data;
    const socket = io(
      process.env.TEST_REALTIME_URL ?? "http://localhost:3001",
      { transports: ["websocket"], auth: { token: b.accessToken } },
    );
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      });
      const received = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("No realtime delivery")),
          10000,
        );
        socket.once("message:new", (data) => {
          clearTimeout(timeout);
          resolve(data);
        });
      });
      const payload = { clientId: randomUUID(), text: "Persist me" };
      const first = await request(
        `/conversations/${conversation.id}/messages`,
        "POST",
        payload,
        a.accessToken,
      );
      assert.equal(first.status, 200);
      assert.equal((await received).id, first.data.id);
      const duplicate = await request(
        `/conversations/${conversation.id}/messages`,
        "POST",
        payload,
        a.accessToken,
      );
      assert.equal(duplicate.data.id, first.data.id);
      assert.equal(
        (
          await request(
            `/conversations/${conversation.id}/messages`,
            "GET",
            undefined,
            outsider.accessToken,
          )
        ).status,
        403,
      );
      const history = await request(
        `/conversations/${conversation.id}/messages`,
        "GET",
        undefined,
        b.accessToken,
      );
      assert.equal(history.data.length, 1);
      const sender = io(process.env.TEST_REALTIME_URL ?? "http://localhost:3001", {
        transports: ["websocket"], auth: {token:a.accessToken},
      });
      try {
        await new Promise<void>((resolve,reject) => {
          sender.once('connect',resolve); sender.once('connect_error',reject);
        });
        for (const state of ['delivered','read']) {
          const event = new Promise<any>((resolve,reject) => {
            const timeout = setTimeout(() => reject(new Error(`Missing ${state} receipt`)),10000);
            sender.once(`message:${state}`, data => { clearTimeout(timeout); resolve(data); });
          });
          assert.equal((await request(`/conversations/${conversation.id}/${state}`,
            'POST',{sequence:first.data.sequence},b.accessToken)).status,200);
          const receipt = await event;
          assert.equal(receipt.userId,b.userId);
          assert.equal(receipt.sequence,first.data.sequence);
        }
        assert.equal((await request(`/conversations/${conversation.id}/read`,
          'POST',{sequence:first.data.sequence+1},b.accessToken)).status,400);
        assert.equal((await request(`/conversations/${conversation.id}/read`,
          'POST',{sequence:first.data.sequence},outsider.accessToken)).status,403);
        await request(`/conversations/${conversation.id}/read`,'POST',{sequence:0},b.accessToken);
        const current = await request(`/conversations/${conversation.id}`,'GET',undefined,a.accessToken);
        const peer = current.data.members.find((m:any) => m.userId === b.userId);
        assert.equal(peer.readSequence,first.data.sequence);
        assert.equal(peer.deliveredSequence,first.data.sequence);
      } finally { sender.disconnect(); }
      const refresh = await request("/auth/refresh", "POST", {
        refreshToken: a.refreshToken,
      });
      assert.equal(refresh.status, 200);
      assert.equal(
        (
          await request("/auth/refresh", "POST", {
            refreshToken: a.refreshToken,
          })
        ).status,
        401,
      );
      assert.equal(
        (await request("/users/me", "GET", undefined, refresh.data.accessToken))
          .status,
        401,
      );
    } finally {
      socket.disconnect();
    }
  },
);
