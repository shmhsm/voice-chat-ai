import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!secret || !priceId || !appUrl) {
    return NextResponse.json(
      { error: "Stripe is not configured (STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, NEXT_PUBLIC_APP_URL)" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(secret);
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  const prisma = getPrisma();
  await prisma.user.upsert({
    where: { clerkId: userId },
    create: { clerkId: userId, email },
    update: { email: email ?? undefined },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/?checkout=success`,
    cancel_url: `${appUrl}/?checkout=cancel`,
    customer_email: email ?? undefined,
    metadata: { clerkUserId: userId },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
