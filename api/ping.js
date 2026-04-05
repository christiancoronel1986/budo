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

    // Hacemos una consulta rápida a cualquier tabla (en este caso pedimos 1 registro de ciudades)
    // Esto es suficiente para que Supabase registre "actividad" y no pase al estado inactivo
    const { data, error } = await supabase.from('ciudades').select('nombre').limit(1);

    if (error) {
      throw error;
    }

    res.status(200).json({ 
      success: true, 
      message: 'Supabase ping exitoso. La base de datos sigue despierta.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error despertando Supabase:', error);
    res.status(500).json({ error: 'Error al contactar Supabase', details: error.message });
  }
}
