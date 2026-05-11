document.addEventListener('DOMContentLoaded', () => {
    const diaryInput = document.getElementById('diary-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const aiResponseBox = document.getElementById('ai-response-box');
    const historyContainer = document.getElementById('history-container');

    // 히스토리 불러오기
    async function loadHistory() {
        try {
            historyContainer.innerHTML = '<div class="history-loading">히스토리를 불러오는 중...</div>';
            const response = await fetch('/api/history');
            const data = await response.json();
            
            if (response.ok && data.success) {
                renderHistory(data.history);
            } else {
                historyContainer.innerHTML = `<div class="history-empty">히스토리를 불러오지 못했습니다.</div>`;
            }
        } catch (error) {
            console.error('History fetch error:', error);
            historyContainer.innerHTML = '<div class="history-empty">서버와 연결할 수 없습니다.</div>';
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

    // 앱 시작 시 히스토리 로드
    loadHistory();

    async function getAIAnalysis(diaryText) {
        try {
            // 프론트엔드에서 Vercel의 서버리스 백엔드로 분석 요청
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ diaryContent: diaryText })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return data.result;
            } else {
                return data.message || `서버 오류가 발생했습니다. (${response.status})`;
            }
        } catch (error) {
            console.error('API 호출 중 에러:', error);
            if (!navigator.onLine) {
                return '인터넷 연결이 끊겨 있습니다. 네트워크 상태를 확인해주세요.';
            }
            return 'AI 서버와 연결하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
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

        // 실제 AI 분석 요청
        const analysisResult = await getAIAnalysis(text);
        
        // 결과 표시
        aiResponseBox.classList.remove('loading');
        aiResponseBox.textContent = analysisResult;
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = originalBtnText;

        // 방금 작성한 일기가 서버에 저장되었으므로 히스토리를 다시 불러옵니다
        loadHistory();
        
        // 작성했던 입력창을 비워줍니다
        diaryInput.value = '';
        diaryInput.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    });

    // 기존의 API Key 재설정 버튼 관련 로직은 서버리스 이전으로 삭제되었습니다.    // 음성 인식 및 비주얼라이저 설정
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isRecording = false;
    
    // 비주얼라이저 요소 생성
    const visualizer = document.getElementById('visualizer');
    for (let i = 0; i < 30; i++) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        visualizer.appendChild(bar);
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
        recognition.interimResults = true; // 실시간 응답을 위해 다시 true

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
            let currentTranscript = '';
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
            if (event.error === 'network') {
                console.warn('네트워크 상태를 확인해주세요.');
            }
            // 에러 시에도 안전하게 버튼 상태 초기화
            if (event.error !== 'no-speech') stopVoiceRecognition();
        };

        recognition.onend = () => {
            console.log('>>> [엔진] 세션 종료');
            if (isRecording) {
                // 끊기지 않게 바로 다시 시작 (엔진 깨우기)
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
        
        visualizer.classList.remove('active');
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

    // 입력창 애니메이션 효과 (선택사항)
    diaryInput.addEventListener('input', () => {
        if (diaryInput.value.length > 0) {
            diaryInput.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
        } else {
            diaryInput.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }
    });
});
