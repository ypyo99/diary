import { createClient } from '@supabase/supabase-js';

// Vercel Supabase 통합(Integration)을 통해 자동 주입되는 환경변수를 우선적으로 사용합니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

// 백엔드 API에서 데이터베이스 접근 시 권한 제약(RLS)을 받지 않기 위해 Service Role Key를 우선 사용합니다.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (!supabase) {
  console.warn("⚠️ Supabase 환경 변수가 설정되지 않았습니다.");
}
