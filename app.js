document.addEventListener('DOMContentLoaded', () => {
    // Auth DOM 요소
    const authApp = document.getElementById('auth-app');
    const diaryApp = document.getElementById('diary-app');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // 기존 일기장 DOM 요소
    const diaryInput = document.getElementById('diary-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const aiResponseBox = document.getElementById('ai-response-box');
    const historyContainer = document.getElementById('history-container');
    const resetApiKeyBtn = document.getElementById('reset-api-key-btn');

    // Supabase 설정 및 초기화 (CDN 라이브러리 사용)
    const supabaseUrl = "https://drqzkttiqljpqceiqdic.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRycXprdHRpcWxqcHFjZWlxZGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODE2OTUsImV4cCI6MjA5NDA1NzY5NX0.8bD6o4wYRcMyLzq6-HopHjjPTgRT1xjQxTLniL6sWBw";
    
    const supabase = (window.supabase) 
        ? window.supabase.createClient(supabaseUrl, supabaseKey) 
        : null;

    if (!supabase) {
        console.warn("⚠️ Supabase 라이브러리를 로드하지 못했습니다.");
    }

    // ==========================================
    // 🔐 SUPABASE AUTH (인증 로그인 비즈니스 로직)
    // ==========================================

    // 로그인된 사용자 세션 여부 체크
    async function checkUserSession() {
        if (!supabase) return;
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            
            if (session) {
                showDiaryApp();
            } else {
                showAuthApp();
            }
        } catch (error) {
            console.error("세션 확인 중 에러:", error);
            showAuthApp();
        }
    }

    function showDiaryApp() {
        authApp.style.display = 'none';
        diaryApp.style.display = 'block';
        loadHistory(); // 일기 기록 최신순 불러오기
    }

    function showAuthApp() {
        authApp.style.display = 'flex';
        diaryApp.style.display = 'none';
    }

    // 이메일 로그인 이벤트
    loginBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            alert('이메일과 비밀번호를 모두 입력해 주세요!');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = '로그인 중...';

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            
            // 로그인 성공 시 세션 다시 감지
            checkUserSession();
        } catch (error) {
            alert(`로그인 실패: ${error.message}`);
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = '로그인';
        }
    });

    // 이메일 회원가입 이벤트
    signupBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            alert('이메일과 비밀번호를 모두 입력해 주세요!');
            return;
        }

        signupBtn.disabled = true;
        signupBtn.textContent = '가입 진행 중...';

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });

            if (error) throw error;
            
            alert('가입 확인 이메일을 확인해 주세요!');
        } catch (error) {
            alert(`회원가입 실패: ${error.message}`);
        } finally {
            signupBtn.disabled = false;
            signupBtn.textContent = '회원가입';
        }
    });

    // Google 소셜 로그인 이벤트
    googleLoginBtn.addEventListener('click', async () => {
        if (!supabase) return;
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (error) {
            alert(`Google 로그인 실패: ${error.message}`);
        }
    });

    // 로그아웃 이벤트
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const confirmLogout = confirm('정말 로그아웃 하시겠습니까?');
            if (confirmLogout) {
                try {
                    const { error } = await supabase.auth.signOut();
                    if (error) throw error;
                    
                    showAuthApp();
                    emailInput.value = '';
                    passwordInput.value = '';
                } catch (error) {
                    alert(`로그아웃 실패: ${error.message}`);
                }
            }
        });
    }

    // Supabase 인증 상태 실시간 리스너 등록 (OAuth 등 복귀 시 자동 반응)
    if (supabase) {
        supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                showDiaryApp();
            } else {
                showAuthApp();
            }
        });
    }

    // 앱 구동 시 로그인 세션 검사 시작
    checkUserSession();

    // ==========================================
    // ⚙️ GEMINI API KEY & HISTORY MANAGEMENT
    // ==========================================

    // Gemini API Key 로드 및 프롬프트 관리
    function getGeminiApiKey() {
        let apiKey = localStorage.getItem('GEMINI_API_KEY');
        if (!apiKey) {
            apiKey = prompt('Gemini API Key를 입력해주세요.\n입력하신 키는 사용자의 브라우저 로컬 저장소(localStorage)에만 안전하게 보관됩니다:');
            if (apiKey) {
                apiKey = apiKey.trim();
                localStorage.setItem('GEMINI_API_KEY', apiKey);
            }
        }
        return apiKey;
    }

    // API Key 리셋 이벤트
    if (resetApiKeyBtn) {
        resetApiKeyBtn.addEventListener('click', () => {
            const confirmReset = confirm('저장된 Gemini API Key를 삭제하시겠습니까?');
            if (confirmReset) {
                localStorage.removeItem('GEMINI_API_KEY');
                alert('API Key가 성공적으로 삭제되었습니다. 다음 분석 요청 시 새로운 키를 입력받습니다.');
            }
        });
    }

    // Supabase 데이터베이스로부터 히스토리 직접 불러오기
    async function loadHistory() {
        if (!supabase) {
            historyContainer.innerHTML = '<div class="history-empty">Supabase 연결을 구성할 수 없습니다.</div>';
            return;
        }

        try {
            historyContainer.innerHTML = '<div class="history-loading">히스토리를 불러오는 중...</div>';
            
            // Supabase에서 직접 diaries 테이블 데이터 최신순 정렬 조회 (최대 50개)
            const { data, error } = await supabase
                .from('diaries')
                .select('created_at, original_content, ai_response')
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (error) throw error;

            // 프론트엔드 렌더링에 적합한 데이터 구조로 맵핑
            const history = data.map(item => ({
                timestamp: item.created_at,
                originalContent: item.original_content,
                aiResponse: item.ai_response
            }));

            renderHistory(history);
        } catch (error) {
            console.error('History fetch error:', error);
            historyContainer.innerHTML = '<div class="history-empty">데이터베이스로부터 기록을 불러올 수 없습니다.</div>';
        }
    }

    // 히스토리 렌더링
    function renderHistory(historyItems) {
        if (!historyItems || historyItems.length === 0) {
            historyContainer.innerHTML = '<div class="history-empty">아직 작성된 일기가 없습니다. 첫 일기를 작성해보세요!</div>';
            return;
        }

        historyContainer.innerHTML = '';
        historyItems.forEach(item => {
            const dateObj = new Date(item.timestamp);
            
            // 날짜 포맷 (예: 2026. 5. 11. 오후 8:45)
            const formattedDate = dateObj.toLocaleString('ko-KR', { 
                year: 'numeric', month: 'long', day: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            });
            
            const historyDiv = document.createElement('div');
            historyDiv.className = 'history-item';
            
            // 이스케이프 및 줄바꿈 처리
            const safeContent = item.originalContent ? item.originalContent.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>') : '';
            const safeResponse = item.aiResponse ? item.aiResponse.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>') : '';

            historyDiv.innerHTML = `
                <div class="history-date">${formattedDate}</div>
                <div class="history-content">${safeContent}</div>
                <div class="history-ai">✨ AI의 답변:<br>${safeResponse}</div>
            `;
            historyContainer.appendChild(historyDiv);
        });
    }

    // 브라우저에서 직접 Gemini API 호출 및 Supabase 저장
    async function getAIAnalysis(diaryText) {
        try {
            const apiKey = getGeminiApiKey();
            if (!apiKey) {
                return 'Gemini API Key가 입력되지 않았습니다. API Key를 입력하셔야 감정 분석 서비스를 이용하실 수 있습니다.';
            }

            // 구동 가능한 Gemini 모델 우선 순위 목록
            const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
            let lastError = null;
            let resultText = '';

            for (const model of models) {
                const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                
                try {
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `당신은 따뜻하고 공감 능력이 뛰어난 AI 감정 상담사입니다. \n다음은 사용자가 쓴 일기입니다: "${diaryText}"\n\n이 일기를 읽고 사용자의 감정을 분석한 뒤, \n1. 사용자의 감정에 공감해주고 \n2. 따뜻한 조언이나 응원의 메시지를 보내주세요.\n답변은 친근한 '해요체'를 사용하고, 너무 길지 않게(3~4문장) 작성해주세요.`
                                }]
                            }]
                        })
                     });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                            resultText = data.candidates[0].content.parts[0].text;
                            break; // 성공 시 루프 탈출
                        }
                    }

                    if (response.status === 404) {
                        continue; // 모델 미지원 시 다음 모델 탐색
                    }

                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error?.message || `API 오류 (상태 코드: ${response.status})`);
                } catch (error) {
                    console.error(`${model} 호출 중 에러:`, error);
                    lastError = error;
                }
            }

            // 모든 모델 호출 실패 시
            if (!resultText) {
                if (lastError?.message?.includes('API key') || lastError?.message?.toLowerCase().includes('key not valid')) {
                    localStorage.removeItem('GEMINI_API_KEY'); // 키가 무효하면 로컬스토리지 비움
                    return '입력하신 Gemini API Key가 유효하지 않습니다. 다시 시도하셔서 올바른 API Key를 입력해주세요.';
                }
                return `AI 분석 중 오류가 발생했습니다. (에러: ${lastError?.message})`;
            }

            // 분석 결과를 Supabase 데이터베이스에 직접 저장
            if (supabase) {
                try {
                    const { error } = await supabase
                        .from('diaries')
                        .insert([
                            { original_content: diaryText, ai_response: resultText }
                        ]);

                    if (error) throw error;
                    console.log(`[Supabase 데이터 직접 저장 완료]`);
                } catch (dbError) {
                    console.error('Supabase 저장 오류:', dbError);
                }
            }

            return resultText;

        } catch (error) {
            console.error('Error analyzing diary:', error);
            return 'AI 분석 중 알 수 없는 예외 오류가 발생했습니다. 네트워크 상태를 확인해주세요.';
        }
    }

    // 분석 요청하기 버튼 클릭 이벤트
    analyzeBtn.addEventListener('click', async () => {
        const text = diaryInput.value.trim();
        
        if (!text) {
            alert('일기 내용을 입력해주세요!');
            return;
        }

        // 로딩 상태 표시
        aiResponseBox.textContent = 'AI가 당신의 일기를 분석하고 있습니다...';
        aiResponseBox.style.color = 'rgba(255, 255, 255, 0.9)';
        aiResponseBox.classList.add('loading');
        analyzeBtn.disabled = true;
        const originalBtnText = analyzeBtn.innerHTML;
        analyzeBtn.innerHTML = '분석 중...';

        // 실제 AI 분석 요청 및 Supabase 직접 인서트 실행
        const analysisResult = await getAIAnalysis(text);
        
        // 결과 표시
        aiResponseBox.classList.remove('loading');
        aiResponseBox.textContent = analysisResult;
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = originalBtnText;

        // 히스토리를 다시 불러와 실시간 업데이트
        loadHistory();
        
        // 입력창 비우기 및 배경 복원
        diaryInput.value = '';
        diaryInput.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    });

    // ==========================================
    // 🎙️ VOICE RECOGNITION & AUDIO VISUALIZER
    // ==========================================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isRecording = false;
    
    // 비주얼라이저 요소 생성
    const visualizer = document.getElementById('visualizer');
    
    // index.html의 visualizer 안에 파형 바가 아직 생성되지 않은 상태라면 동적 생성합니다.
    if (visualizer && visualizer.children.length === 0) {
        for (let i = 0; i < 30; i++) {
            const bar = document.createElement('div');
            bar.className = 'bar';
            visualizer.appendChild(bar);
        }
    }
    
    const bars = document.querySelectorAll('.bar');

    // 오디오 컨텍스트 (비주얼라이저용)
    let audioContext = null;
    let analyser = null;
    let dataArray = null;
    let animationId = null;

    async function startAudioVisualizer() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 64;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            visualizer.classList.add('active');
            draw();
        } catch (err) {
            console.error('오디오 컨텍스트 에러:', err);
        }
    }

    function draw() {
        if (!isRecording) return;
        animationId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        
        bars.forEach((bar, i) => {
            const height = (dataArray[i] || 0) / 2;
            bar.style.height = `${Math.max(4, height)}px`;
        });
    }

    function startVoiceRecognition() {
        if (isRecording) return;
        
        recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.continuous = false; 
        recognition.interimResults = true;

        recognition.onstart = () => {
            console.log('>>> [엔진] 인식 시작');
            isRecording = true;
            voiceBtn.classList.add('recording');
            voiceBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="12" height="12" />
                </svg>
                중지하기
            `;
            startAudioVisualizer();
        };

        recognition.onresult = (event) => {
            console.log('>>> [엔진] 결과 수신 중...');
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    const transcript = event.results[i][0].transcript;
                    diaryInput.value += (diaryInput.value ? ' ' : '') + transcript;
                }
            }
            diaryInput.scrollTop = diaryInput.scrollHeight;
        };

        recognition.onerror = (event) => {
            console.error('>>> [엔진] 에러:', event.error);
            if (event.error !== 'no-speech') stopVoiceRecognition();
        };

        recognition.onend = () => {
            console.log('>>> [엔진] 세션 종료');
            if (isRecording) {
                setTimeout(() => {
                    if (isRecording) recognition.start();
                }, 50);
            } else {
                stopVoiceRecognition();
            }
        };

        recognition.start();
    }

    function stopVoiceRecognition() {
        isRecording = false;
        if (recognition) {
            recognition.onend = null;
            recognition.stop();
        }
        if (animationId) cancelAnimationFrame(animationId);
        if (audioContext) audioContext.close();
        
        if (visualizer) visualizer.classList.remove('active');
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            음성으로 입력하기
        `;
    }

    voiceBtn.addEventListener('click', () => {
        if (isRecording) {
            stopVoiceRecognition();
        } else {
            startVoiceRecognition();
        }
    });

    diaryInput.addEventListener('input', () => {
        if (diaryInput.value.length > 0) {
            diaryInput.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
        } else {
            diaryInput.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }
    });
});
