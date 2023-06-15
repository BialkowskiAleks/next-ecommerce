import Stripe from "stripe";
import { buffer } from "micro";
import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/util/prisma";

export const config = {
	api: {
		bodyParser: false,
	},
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
	apiVersion: "2022-11-15",
});

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	const buf = await buffer(req);
	const sig = req.headers["stripe-signature"];

	if (!sig) {
		return res.status(400).send("Missing the stripe signature");
	}

	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(
			buf,
			sig,
			process.env.STRIPE_WEBHOOK_SECRET!
		);
	} catch (err) {
		return res.status(400).send("Webook error" + err);
	}
	switch (event.type) {
		case "payment_intent.created":
			const payment = event.data.object;
			break;
		case "charge.succeeded":
			const charge = event.data.object as Stripe.Charge;
			if (typeof charge.payment_intent === "string") {
				const order = await prisma.order.update({
					where: { paymentIntentID: charge.payment_intent },
					data: { status: "complete" },
				});
			}
			break;
		default:
			console.log("Unhandled event type:" + event.type);
	}
}
