import Redis from 'ioredis';

// Vercel 환경 변수 REDIS_URL을 통해 Redis 클라이언트 생성 (연결 풀링을 위해 함수 외부에 선언)
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

export default async function handler(req, res) {
  // CORS 설정 (프론트엔드에서 API를 호출할 수 있도록 허용)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POST 요청만 처리
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', message: 'POST 요청만 지원합니다.' });
  }

  try {
    const { diaryContent } = req.body;

    if (!diaryContent) {
      return res.status(400).json({ error: 'Bad Request', message: '일기 내용(diaryContent)이 필요합니다.' });
    }

    // Vercel 환경 변수에서 안전하게 API 키를 가져옵니다. 프론트엔드엔 절대 노출되지 않습니다.
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
      return res.status(500).json({ 
        error: 'Configuration Error', 
        message: '서버에 API Key가 설정되지 않았습니다. Vercel 대시보드에서 환경변수를 설정해주세요.' 
      });
    }

    // 서버리스 환경에서 기본 fetch를 사용하여 Gemini API 직접 호출
    // 패키지 의존성(@google/genai 등) 없이 순수 HTTP 요청으로 구현하여 구글 드라이브 권한 및 npm 에러를 방지합니다.
    const models = ['gemini-3-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError = null;

    for (const model of models) {
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `당신은 따뜻하고 공감 능력이 뛰어난 AI 감정 상담사입니다. \n다음은 사용자가 쓴 일기입니다: "${diaryContent}"\n\n이 일기를 읽고 사용자의 감정을 분석한 뒤, \n1. 사용자의 감정에 공감해주고 \n2. 따뜻한 조언이나 응원의 메시지를 보내주세요.\n답변은 친근한 '해요체'를 사용하고, 너무 길지 않게(3~4문장) 작성해주세요.`
                        }]
                    }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                    const resultText = data.candidates[0].content.parts[0].text;
                    
                    // --- Redis에 데이터 저장 로직 추가 ---
                    if (redis) {
                        try {
                            const now = new Date();
                            // 현재 시간을 기준으로 한 고유 ID 생성 (예: diary_1715421532000)
                            const uniqueId = `diary_${now.getTime()}`;
                            
                            // 저장할 데이터 묶음
                            const record = {
                                timestamp: now.toISOString(),
                                originalContent: diaryContent,
                                aiResponse: resultText
                            };
                            
                            // JSON 문자열로 변환하여 Redis에 저장
                            await redis.set(uniqueId, JSON.stringify(record));
                            console.log(`[Redis 저장 완료] ID: ${uniqueId}`);
                        } catch (redisError) {
                            console.error('Redis 저장 중 오류 발생:', redisError);
                            // Redis 저장에 실패해도 일기 응답은 정상적으로 내려보내기 위해 예외만 처리
                        }
                    } else {
                        console.warn("REDIS_URL 환경변수가 없어 Redis에 저장하지 못했습니다.");
                    }
                    // ------------------------------------

                    return res.status(200).json({
                        success: true,
                        result: resultText
                    });
                }
            }

            if (response.status === 404) {
                continue; // 이 모델이 없으면 다음 모델 시도
            }

            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API 오류 (상태 코드: ${response.status})`);

        } catch (error) {
            console.error(`${model} 호출 중 에러:`, error);
            lastError = error;
        }
    }

    // 모든 모델 호출 실패 시
    return res.status(500).json({ 
        error: 'API Error', 
        message: `AI 분석 중 오류가 발생했습니다. (마지막 에러: ${lastError?.message})` 
    });

  } catch (error) {
    console.error('Error analyzing diary:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: '서버 내부 오류가 발생했습니다.' });
  }
}
