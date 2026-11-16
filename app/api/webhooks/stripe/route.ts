import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Se omite apiVersion para alinearse con los tipos de la versión instalada del SDK
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Importante: Usar Service Role Key para operaciones administrativas del webhook
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: Request) {
  const body = await req.text();
  
  // Se añade 'await' ya que headers() es una promesa en esta versión de Next.js
  const headersList = await headers();
  const signature = headersList.get('stripe-signature') as string;
  
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    }
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Manejar el evento de pago completado con éxito
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    const productId = session.client_reference_id || session.metadata?.productId;

    if (productId) {
      // Actualizar el estado de la herramienta a Destacada (Featured)
      const { error } = await supabaseAdmin
        .from('products') // o 'tools' según tu tabla
        .update({ 
          is_featured: true,
          featured_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 días de destacado
        })
        .eq('id', productId);

      if (error) {
        console.error('Error updating product in Supabase:', error);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}