import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  billing: null as null | { stripe_subscription_id: string | null; source: string; plan: string },
  stripe: {
    retrieve: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: async () => state.user,
  createClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.billing }) }) }) }),
  }),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ subscriptions: { retrieve: state.stripe.retrieve, cancel: state.stripe.cancel } }),
}));

import { POST } from "./route";

const call = async () => {
  const res = await POST();
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  state.user = { id: "u1" };
  state.billing = null;
  state.stripe.retrieve.mockReset();
  state.stripe.cancel.mockReset();
});

describe("cancel-subscription (runs before an account is deleted)", () => {
  it("refuses signed-out callers", async () => {
    state.user = null;
    expect((await call()).status).toBe(401);
  });

  it("does nothing for someone who never subscribed", async () => {
    const r = await call();
    expect(r.status).toBe(200);
    expect(state.stripe.cancel).not.toHaveBeenCalled();
  });

  it("cancels an active Stripe subscription", async () => {
    state.billing = { stripe_subscription_id: "sub_1", source: "stripe", plan: "premium" };
    state.stripe.retrieve.mockResolvedValue({ status: "active" });
    const r = await call();
    expect(r).toEqual({ status: 200, body: { ok: true, cancelled: true } });
    expect(state.stripe.cancel).toHaveBeenCalledWith("sub_1");
  });

  it("doesn't cancel twice when it's already cancelled", async () => {
    state.billing = { stripe_subscription_id: "sub_1", source: "stripe", plan: "free" };
    state.stripe.retrieve.mockResolvedValue({ status: "canceled" });
    expect((await call()).status).toBe(200);
    expect(state.stripe.cancel).not.toHaveBeenCalled();
  });

  it("treats a subscription Stripe no longer knows about as done", async () => {
    state.billing = { stripe_subscription_id: "sub_gone", source: "stripe", plan: "premium" };
    state.stripe.retrieve.mockRejectedValue({ code: "resource_missing" });
    expect((await call()).status).toBe(200);
  });

  it("stops the deletion (502) if Stripe can't be reached, so nobody is left billed", async () => {
    state.billing = { stripe_subscription_id: "sub_1", source: "stripe", plan: "premium" };
    state.stripe.retrieve.mockResolvedValue({ status: "active" });
    state.stripe.cancel.mockRejectedValue(new Error("network down"));
    const r = await call();
    expect(r.status).toBe(502);
    expect(r.body.error).toBeTruthy();
  });

  it("tells the caller Apple subscriptions can't be cancelled from here, and doesn't touch Stripe", async () => {
    state.billing = { stripe_subscription_id: null, source: "apple", plan: "premium" };
    const r = await call();
    expect(r.body).toEqual({ ok: true, apple: true });
    expect(state.stripe.retrieve).not.toHaveBeenCalled();
  });
});
