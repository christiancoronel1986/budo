import { createClient } from '@supabase/supabase-js'

// Estas variables pueden venir de GitHub Secrets (SUPABASE_URL) o de un .env local (VITE_SUPABASE_URL)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: No se encontraron las variables de entorno de Supabase.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function keepAlive() {
  console.log('--- Iniciando Ping de Supabase ---')
  
  try {
    // Usamos upsert en lugar de update para asegurar que la fila con id: 1 exista.
    // Si no existe, se inserta; si existe, se actualiza el last_ping.
    const { data, error } = await supabase
      .from('keep_alive')
      .upsert({ id: 1, last_ping: new Date().toISOString() })
      .select()

    if (error) {
      console.error('❌ Error al realizar upsert en keep_alive:', error.message)
      
      // Fallback: Consulta genérica si falla el upsert
      console.log('Intentando consulta alternativa (SELECT)...')
      const { error: errorAlt } = await supabase.from('ciudades').select('nombre').limit(1)
      
      if (errorAlt) {
        console.error('❌ Error en consulta alternativa:', errorAlt.message)
        process.exit(1)
      } else {
        console.log('✅ Consulta alternativa exitosa.')
      }
    } else {
      console.log('✅ Ping exitoso (UPSERT) en tabla keep_alive:', data[0].last_ping)
    }
  } catch (err) {
    console.error('❌ Error inesperado:', err.message)
    process.exit(1)
  }
  
  console.log('--- Fin del proceso ---')
}

keepAlive()
