import Stripe from "stripe";
import { NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/firebase/admin";
export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET)
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      req.headers.get("stripe-signature") ?? "",
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  if (
    ![
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)
  )
    return NextResponse.json({ received: true });
  const sub = event.data.object as Stripe.Subscription;
  const organizationId = sub.metadata.organizationId;
  if (!organizationId)
    return NextResponse.json(
      { error: "Missing organization metadata." },
      { status: 400 },
    );
  const { db } = firebaseAdmin();
  try {
    await db.runTransaction(async (tx) => {
      const marker = db.collection("stripeEvents").doc(event.id),
        org = db.collection("organizations").doc(organizationId),
        ref = org.collection("subscriptions").doc(sub.id);
      const [seen, existing, organization] = await Promise.all([
        tx.get(marker),
        tx.get(ref),
        tx.get(org),
      ]);
      if (seen.exists) return;
      if (!organization.exists) throw new Error("Unknown organization");
      if (
        !existing.exists ||
        Number(existing.get("lastEventAt")) <= event.created
      ) {
        const price = sub.items.data[0]?.price.id;
        const paid = ["active", "trialing"].includes(sub.status);
        const plan = paid
          ? price === process.env.STRIPE_GROUP_PRICE_ID
            ? "Group"
            : price === process.env.STRIPE_PRO_PRICE_ID
              ? "Pro"
              : "Free"
          : "Free";
        tx.set(ref, {
          id: sub.id,
          organizationId,
          customerId:
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          subscriptionId: sub.id,
          status: sub.status,
          plan,
          lastEventAt: event.created,
        });
        tx.update(org, { plan });
        tx.create(org.collection("auditEvents").doc(event.id), {
          id: event.id,
          organizationId,
          actor: "Stripe",
          at: new Date().toISOString(),
          action: "billing.updated",
          entity: sub.id,
          oldValue: "",
          newValue: plan,
          metadata: { eventId: event.id },
        });
      }
      tx.create(marker, { processedAt: new Date().toISOString() });
    });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Webhook processing failed; retry required." },
      { status: 500 },
    );
  }
}
