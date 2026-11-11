import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Usamos la Service Role Key para saltar las políticas RLS y actualizar desde el servidor
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Falta la firma de Stripe' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Error verificando firma del Webhook:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Cuando el pago en Stripe Checkout se completa con éxito
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const productId = session.metadata?.productId;

    if (productId) {
      const { error } = await supabaseAdmin
        .from('products') // Asegúrate de que tu tabla se llama 'products'
        .update({ is_featured: true })
        .eq('id', productId);

      if (error) {
        console.error('Error actualizando Supabase:', error);
        return NextResponse.json({ error: 'Error al actualizar base de datos' }, { status: 500 });
      }
      
      console.log(`✅ Herramienta ${productId} marcada como Featured.`);
    }
  }

  return NextResponse.json({ received: true });
}