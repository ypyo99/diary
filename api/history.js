import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'GET 요청만 지원합니다.' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Configuration Error', message: 'Supabase가 설정되지 않았습니다.' });
  }

  try {
    const { data, error } = await supabase
      .from('diaries')
      .select('created_at, original_content, ai_response')
      .order('created_at', { ascending: false })
      .limit(50); // 최근 50개만 가져오기

    if (error) throw error;

    // 프론트엔드 형식(timestamp, originalContent, aiResponse)에 맞게 변환
    const history = data.map(item => ({
      timestamp: item.created_at,
      originalContent: item.original_content,
      aiResponse: item.ai_response
    }));

    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error('Supabase fetch error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: '히스토리를 가져오는 중 오류가 발생했습니다.' });
  }
}
