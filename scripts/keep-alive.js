import { createClient } from '@supabase/supabase-js'

// Estas variables deben estar en el entorno (GitHub Secrets o .env local)
const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Faltan las variables de entorno SUPABASE_URL o SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function keepAlive() {
  console.log('--- Iniciando Ping de Supabase ---')
  
  try {
    // Actualizamos la tabla keep_alive para generar actividad de escritura
    const { data, error } = await supabase
      .from('keep_alive')
      .update({ last_ping: new Date().toISOString() })
      .eq('id', 1)
      .select()

    if (error) {
      console.error('❌ Error al actualizar keep_alive:', error.message)
      
      // Si la tabla no existe, intentamos una consulta genérica para al menos despertar la API
      console.log('Intentando consulta alternativa...')
      const { error: errorAlt } = await supabase.from('ciudades').select('nombre').limit(1)
      
      if (errorAlt) {
        console.error('❌ Error en consulta alternativa:', errorAlt.message)
        process.exit(1)
      } else {
        console.log('✅ Consulta alternativa exitosa.')
      }
    } else {
      console.log('✅ Ping exitoso en tabla keep_alive:', data[0].last_ping)
    }
  } catch (err) {
    console.error('❌ Error inesperado:', err.message)
    process.exit(1)
  }
  
  console.log('--- Fin del proceso ---')
}

keepAlive()
