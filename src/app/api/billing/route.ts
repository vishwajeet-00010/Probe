import Stripe from "stripe";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { readState } from "@/lib/database";
import { authorize, DomainError } from "@/lib/permissions";
import { failure, jsonBody, sameOrigin } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await getActor();
    authorize(a, "billing");
    if (a.demo || !process.env.STRIPE_SECRET_KEY)
      throw new DomainError(
        "Billing is not activated in this environment.",
        503,
      );
    const body = z
      .object({
        action: z.enum(["checkout", "portal"]),
        plan: z.enum(["Pro", "Group"]).optional(),
      })
      .parse(await jsonBody(req));
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const state = await readState(a);
    const customer = state.subscriptions[0]?.customerId;
    const origin = process.env.APP_URL!;
    if (body.action === "portal") {
      if (!customer) throw new DomainError("No billing account exists yet.");
      const session = await stripe.billingPortal.sessions.create({
        customer,
        return_url: `${origin}/app/settings/billing`,
      });
      return NextResponse.json({ url: session.url });
    }
    const price =
      body.plan === "Group"
        ? process.env.STRIPE_GROUP_PRICE_ID
        : process.env.STRIPE_PRO_PRICE_ID;
    if (!price)
      throw new DomainError("Plan pricing has not been configured.", 503);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer || undefined,
      line_items: [{ price, quantity: Math.max(1, state.sites.length) }],
      metadata: { organizationId: a.organizationId },
      subscription_data: { metadata: { organizationId: a.organizationId } },
      success_url: `${origin}/app/settings/billing?success=1`,
      cancel_url: `${origin}/app/settings/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return failure(e);
  }
}
