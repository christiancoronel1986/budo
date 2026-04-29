import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://pazhipybwsquaeepejin.supabase.co"
const supabaseAnonKey = "sb_publishable_dd13bqn0NLxboZ7yj7oUjQ_74h28w1H"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
  console.log('Checking connection...')
  try {
    const { data, error } = await supabase.from('ciudades').select('nombre').limit(1)
    if (error) {
      console.log('Error:', error.message)
    } else {
      console.log('Connection OK, found data:', data)
    }
  } catch (e) {
    console.log('Unexpected error:', e.message)
  }
}
check()
