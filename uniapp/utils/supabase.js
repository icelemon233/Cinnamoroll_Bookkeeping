// utils/supabase.js - Supabase 客户端初始化
// uni-app H5 环境下直接使用 @supabase/supabase-js

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ajelqpkzjlyxlhvygdne.supabase.co'
const SUPABASE_KEY = 'sb_publishable_nDopAOtwS0oFf3Ulxj1AhA_J7AaahQc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // H5/浏览器环境下使用 localStorage 持久化 session
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
