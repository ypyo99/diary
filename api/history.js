import Redis from 'ioredis';

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

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

  if (!redis) {
    return res.status(500).json({ error: 'Configuration Error', message: 'REDIS_URL이 설정되지 않았습니다.' });
  }

  try {
    // 모든 일기 키 가져오기
    const keys = await redis.keys('diary_*');
    
    if (keys.length === 0) {
      return res.status(200).json({ success: true, history: [] });
    }

    // 값 가져오기
    const values = await redis.mget(keys);
    
    // 파싱 및 정렬 (최신순)
    const history = values
      .filter(val => val !== null)
      .map(val => JSON.parse(val))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error('Redis fetch error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: '히스토리를 가져오는 중 오류가 발생했습니다.' });
  }
}
