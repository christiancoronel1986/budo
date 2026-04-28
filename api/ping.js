import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    // Leemos las claves directamente del entorno de Vercel (process.env)
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'Faltan credenciales de Supabase en Vercel.' });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Intentamos una escritura (upsert) en la tabla keep_alive.
    // Esto es mucho más efectivo para evitar la pausa que un simple SELECT.
    const { data, error } = await supabase
      .from('keep_alive')
      .upsert({ id: 1, last_ping: new Date().toISOString() })
      .select();

    if (error) {
      // Si falla el upsert (ej. la tabla no existe aún), intentamos el SELECT como fallback
      console.warn('Upsert falló, intentando SELECT de respaldo:', error.message);
      const { error: errorAlt } = await supabase.from('ciudades').select('nombre').limit(1);
      if (errorAlt) throw errorAlt;
    }

    res.status(200).json({ 
      success: true, 
      message: 'Supabase ping exitoso (Actividad de escritura registrada).',
      timestamp: new Date().toISOString(),
      data: data ? data[0] : 'Fallback SELECT used'
    });
  } catch (error) {
    console.error('Error despertando Supabase:', error);
    res.status(500).json({ error: 'Error al contactar Supabase', details: error.message });
  }
}
