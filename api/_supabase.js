import { createClient } from '@supabase/supabase-js';

// Vercel 환경 변수에서 Supabase URL과 API Key를 가져옵니다.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Supabase 클라이언트 초기화 (설정값이 있을 때만 생성)
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (!supabase) {
  console.warn("⚠️ SUPABASE_URL 또는 SUPABASE_ANON_KEY 환경 변수가 설정되지 않았습니다.");
}
