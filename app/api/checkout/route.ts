import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-10-28.endive' as any,
});

export async function POST(req: Request) {
  try {
    const { productId, productName } = await req.json();

    if (!productId) {
      return NextResponse.json({ error: 'Falta el ID del producto' }, { status: 400 });
    }

    // Detecta dinámicamente el origen real de la web desde donde opera el usuario
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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
            unit_amount: 9900, // 99.00 €
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/products?featured_success=true`,
      cancel_url: `${origin}/products?featured_canceled=true`,
      metadata: {
        productId: String(productId),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error interno desconocido';
    console.error('Error en Stripe Checkout:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}