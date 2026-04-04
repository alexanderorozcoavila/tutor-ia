import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos la service role key para saltear RLS (solo desde el servidor)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_CONFIG = {
  rango_manana: '00:00-11:59',
  rango_tarde: '12:00-17:59',
  rango_noche: '18:00-23:59',
};

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('configuracion_jornadas')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || DEFAULT_CONFIG);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { rango_manana, rango_tarde, rango_noche } = body;

  if (!rango_manana || !rango_tarde || !rango_noche) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  // Buscar si ya existe un registro
  const { data: existing } = await supabaseAdmin
    .from('configuracion_jornadas')
    .select('id')
    .limit(1)
    .maybeSingle();

  let error;

  if (existing?.id) {
    ({ error } = await supabaseAdmin
      .from('configuracion_jornadas')
      .update({ rango_manana, rango_tarde, rango_noche })
      .eq('id', existing.id));
  } else {
    ({ error } = await supabaseAdmin
      .from('configuracion_jornadas')
      .insert([{ rango_manana, rango_tarde, rango_noche }]));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
