import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://pazhipybwsquaeepejin.supabase.co"
const supabaseAnonKey = "sb_publishable_dd13bqn0NLxboZ7yj7oUjQ_74h28w1H"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
  const { data, error } = await supabase.from('keep_alive').select('*').limit(1)
  if (error) {
    console.log('keep_alive exists?', error.message === 'relation "public.keep_alive" does not exist' ? 'NO' : 'Error: ' + error.message)
  } else {
    console.log('keep_alive exists? YES', data)
  }
}
check()
