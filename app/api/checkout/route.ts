import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { productId, productName } = await req.json();

    if (!productId) {
      return NextResponse.json({ error: 'Falta el ID del producto' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Listado Destacado (Featured): ${productName || 'Herramienta'}`,
              description: 'Posicionamiento prioritario en la parte superior del directorio.',
            },
            unit_amount: 9900, // 99.00 € (Stripe trabaja en céntimos)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/products?featured_success=true`,
      cancel_url: `${origin}/products?featured_canceled=true`,
      metadata: {
        productId: String(productId), // Guardamos el ID para leerlo tras el pago
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error en Stripe Checkout:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}