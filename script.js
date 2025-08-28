const modeSelector = document.getElementById('mode-selector');

let allData = [];
let currentDayIndex = 0;
let currentMode = 'study'; // 'study', 'test', 'practice'
let progressData = {}; // 用于存储学习进度

const synth = window.speechSynthesis;
let isPlayingAll = false;
let playbackQueue = [];
let currentPlaybackIndex = 0;

// --- Keyboard Shortcuts ---

document.addEventListener('keydown', (e) => {
    // 当Alt键被按下时
    if (e.key === 'Alt' && currentMode === 'practice') {
        e.preventDefault(); // 阻止浏览器的默认行为 (例如，激活菜单栏)
        const translationP = contentArea.querySelector('.practice-translation');
        const toggleBtn = contentArea.querySelector('.toggle-translation-btn');
        if (translationP) {
            translationP.classList.add('visible');
            if (toggleBtn) toggleBtn.textContent = '隐藏翻译';
        }
    }
});

document.addEventListener('keyup', (e) => {
    // 当Alt键被松开时
    if (e.key === 'Alt' && currentMode === 'practice') {
        const translationP = contentArea.querySelector('.practice-translation');
        const toggleBtn = contentArea.querySelector('.toggle-translation-btn');
        if (translationP) {
            translationP.classList.remove('visible');
            if (toggleBtn) toggleBtn.textContent = '显示翻译';
        }
    }
});

// --- Progress Management ---

function loadProgress() {
    const savedProgress = localStorage.getItem('suomenProgress');
    if (savedProgress) {
        progressData = JSON.parse(savedProgress);
    } else {
        progressData = {};
    }
}

function saveProgress(dayIndex, mode, shuffledEntries, entryIndex) {
    if (!progressData[dayIndex]) {
        progressData[dayIndex] = {};
    }
    if (!progressData[dayIndex][mode]) {
        progressData[dayIndex][mode] = {};
    }
    progressData[dayIndex][mode] = {
        shuffledEntries: shuffledEntries,
        currentIndex: entryIndex
    };
    localStorage.setItem('suomenProgress', JSON.stringify(progressData));
}
    
// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const nav = document.getElementById('days-nav');
    const contentArea = document.getElementById('content-area');
    const modeSelector = document.getElementById('mode-selector');

    // Application State
    let allData = [];
    let progressData = {}; // Object to hold all progress
    let currentDayIndex = 0;
    let currentMode = 'study'; // 'study', 'test', 'practice'

    const synth = window.speechSynthesis;
    let isPlayingAll = false;
    let playbackQueue = [];
    let currentPlaybackIndex = 0;

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            allData = data;
            loadProgress();
            createNavButtons();
            setupModeSwitcher();
            renderContent();
        })
        .catch(error => {
            console.error('加载笔记数据时出错:', error);
            contentArea.innerHTML = '<p>加载笔记失败，请检查 data.json 文件是否存在或格式是否正确。</p>';
        });

    // --- UI Setup ---

    function createNavButtons() {
        allData.forEach((_, index) => {
            const button = document.createElement('button');
            button.textContent = `第 ${index + 1} 天`;
            button.addEventListener('click', () => {
                if (currentDayIndex !== index) {
                    currentDayIndex = index;
                    nav.querySelector('.active')?.classList.remove('active');
                    button.classList.add('active');
                    renderContent();
                }
            });
            nav.appendChild(button);
        });
        nav.querySelector('button')?.classList.add('active');
    }

    function setupModeSwitcher() {
        modeSelector.addEventListener('click', (event) => {
            if (event.target.classList.contains('mode-btn')) {
                const newMode = event.target.id.split('-')[1];
                if (currentMode !== newMode) {
                    currentMode = newMode;
                    modeSelector.querySelector('.active')?.classList.remove('active');
                    event.target.classList.add('active');
                    renderContent();
                }
            }
        });
    }

    // --- Rendering Logic ---

    function renderContent() {
        if (isPlayingAll) {
            stopPlayback();
        }
        contentArea.innerHTML = ''; // 清空内容区

        const dayData = allData[currentDayIndex];

        // Create and add playback button
        const playbackContainer = document.createElement('div');
        playbackContainer.id = 'playback-controls';
        const playAllBtn = document.createElement('button');
        playAllBtn.id = 'play-all-btn';
        playAllBtn.textContent = '▶️ 整课循环朗读';
        playAllBtn.addEventListener('click', () => togglePlayback(dayData, playAllBtn));
        playbackContainer.appendChild(playAllBtn);
        contentArea.appendChild(playbackContainer);

        if (!dayData || dayData.entries.length === 0) {
            contentArea.innerHTML = '<p>今天没有笔记内容。</p>';
            return;
        }
        
        if (currentMode === 'study') {
            renderStudyMode(dayData, dayData.entries);
        } else {
            // Check for saved progress for this day and mode
            let progress = progressData[currentDayIndex]?.[currentMode];
            let currentEntries, currentEntryIndex;

            if (progress && progress.shuffledEntries.length === dayData.entries.length) {
                // Progress exists and is valid
                currentEntries = progress.shuffledEntries;
                currentEntryIndex = progress.currentIndex;
            } else {
                // No progress or data mismatch, create new session
                currentEntries = [...dayData.entries].sort(() => Math.random() - 0.5);
                currentEntryIndex = 0;
                saveProgress(currentDayIndex, currentMode, currentEntries, currentEntryIndex);
            }
            renderPracticeOrTestMode(currentEntries, currentEntryIndex);
        }
    }

    function renderStudyMode(dayData, entries) {
        entries.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'entry';

            const finnishP = document.createElement('p');
            finnishP.className = 'finnish';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = entry.finnish;
            finnishP.appendChild(textSpan);

            const speakerIcon = createSpeakerIcon(entry.finnish);
            finnishP.appendChild(speakerIcon);

            const chineseP = document.createElement('p');
            chineseP.className = 'chinese';
            chineseP.textContent = entry.chinese;
            entryDiv.appendChild(finnishP);
            entryDiv.appendChild(chineseP);
            contentArea.appendChild(entryDiv);
        });
    }

    function renderPracticeOrTestMode(entries, entryIndex) {
        contentArea.innerHTML = ''; // 清空之前的内容
        
        // 复用播放按钮逻辑
        const dayData = allData[currentDayIndex];
        const playbackContainer = document.createElement('div');
        playbackContainer.id = 'playback-controls';
        const playAllBtn = document.createElement('button');
        playAllBtn.id = 'play-all-btn';
        playAllBtn.textContent = '▶️ 整课循环朗读';
        playAllBtn.addEventListener('click', () => togglePlayback(dayData, playAllBtn));
        playbackContainer.appendChild(playAllBtn);
        contentArea.appendChild(playbackContainer);


        if (entryIndex >= entries.length) {
            const completedP = document.createElement('p');
            completedP.textContent = '🎉 恭喜！您已完成本课的所有练习！';
            contentArea.appendChild(completedP);
            const resetBtn = document.createElement('button');
            resetBtn.id = 'reset-progress';
            resetBtn.textContent = '重新开始';
            resetBtn.addEventListener('click', () => {
                saveProgress(currentDayIndex, currentMode, entries, 0);
                renderContent();
            });
            contentArea.appendChild(resetBtn);
            return;
        }

        const entry = entries[entryIndex];
        const questionText = currentMode === 'test' ? entry.finnish : entry.chinese;
        const questionLabel = currentMode === 'test' ? '中文' : '芬兰语';

        const card = document.createElement('div');
        card.className = 'practice-card';

        const questionP = document.createElement('p');
        questionP.className = 'practice-question';
        const questionTextSpan = document.createElement('span');
        questionTextSpan.textContent = questionText;
        questionP.appendChild(questionTextSpan);
        
        if (currentMode === 'test') {
            const speakerIcon = createSpeakerIcon(entry.finnish);
            questionP.appendChild(speakerIcon);
        }
        card.appendChild(questionP);


        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'answer-input';
        input.placeholder = '输入你的答案...';
        input.autocomplete = 'off';
        input.autocorrect = 'off';
        input.autocapitalize = 'off';
        input.spellcheck = false;
        card.appendChild(input);

        const checkBtn = document.createElement('button');
        checkBtn.className = 'check-btn';
        checkBtn.textContent = '检查';
        card.appendChild(checkBtn);

        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'feedback';
        card.appendChild(feedbackDiv);

        const navigationDiv = document.createElement('div');
        navigationDiv.className = 'navigation-buttons';

        const prevBtn = document.createElement('button');
        prevBtn.id = 'prev-btn';
        prevBtn.textContent = '上一题';
        prevBtn.disabled = entryIndex === 0;
        navigationDiv.appendChild(prevBtn);

        const span = document.createElement('span');
        span.textContent = `${entryIndex + 1} / ${entries.length}`;
        navigationDiv.appendChild(span);

        const nextBtn = document.createElement('button');
        nextBtn.id = 'next-btn';
        nextBtn.textContent = entryIndex === entries.length - 1 ? '完成' : '下一题';
        navigationDiv.appendChild(nextBtn);

        card.appendChild(navigationDiv);
        contentArea.appendChild(card);

        const inputElement = document.getElementById('answer-input');
        const checkBtnElement = contentArea.querySelector('.check-btn');
        const feedbackDivElement = contentArea.querySelector('.feedback');

        if (currentMode === 'practice') {
            const toggleBtn = contentArea.querySelector('.toggle-translation-btn');
            const translationP = contentArea.querySelector('.practice-translation');
            toggleBtn.addEventListener('click', () => {
                const isVisible = translationP.classList.toggle('visible');
                toggleBtn.textContent = isVisible ? '隐藏翻译' : '显示翻译';
            });
        }

        const checkAnswer = () => {
            const userAnswer = inputElement.value.trim();
            if (!userAnswer) return;

            let isCorrect = false;
            let feedbackP = feedbackDivElement;

            const expectedAnswer = currentMode === 'test' ? entry.chinese : entry.finnish;
            if (userAnswer.trim().toLowerCase() === expectedAnswer.trim().toLowerCase()) {
                isCorrect = true;
                feedbackP.textContent = '正确!';
                feedbackP.style.color = 'green';
                
                const answerContainer = document.createElement('div');
                answerContainer.style.marginTop = '10px';
                const answerLabel = document.createElement('span');
                answerLabel.textContent = `${questionLabel}: `;
                const answerText = document.createElement('span');
                answerText.textContent = expectedAnswer;
                answerContainer.appendChild(answerLabel);
                answerContainer.appendChild(answerText);

                const speakerIcon = createSpeakerIcon(entry.finnish);
                answerContainer.appendChild(speakerIcon);
                
                feedbackP.appendChild(document.createElement('br'));
                feedbackP.appendChild(answerContainer);

                inputElement.style.borderColor = 'green';
                inputElement.disabled = true; // 答对后禁止修改
                checkBtnElement.style.display = 'none'; // 隐藏检查按钮
                nextBtn.style.display = 'inline-block'; // 显示下一题按钮
                // 答对后自动播放读音
                speak(entry.finnish, 'fi-FI');

            } else {
                feedbackP.textContent = `错误. 正确答案: `;
                feedbackP.style.color = 'red';

                const correctAnswerSpan = document.createElement('span');
                correctAnswerSpan.textContent = expectedAnswer;
                const speakerIcon = createSpeakerIcon(expectedAnswer, currentMode !== 'test');
                
                feedbackP.appendChild(correctAnswerSpan);
                feedbackP.appendChild(speakerIcon);

                inputElement.style.borderColor = 'red';
            }
        };
        
        checkBtnElement.addEventListener('click', checkAnswer);
        inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') checkAnswer();
        });
        
        prevBtn.addEventListener('click', () => {
            const newIndex = entryIndex - 1;
            saveProgress(currentDayIndex, currentMode, entries, newIndex);
            renderPracticeOrTestMode(entries, newIndex);
        });

        nextBtn.addEventListener('click', () => {
            const newIndex = entryIndex + 1;
            saveProgress(currentDayIndex, currentMode, entries, newIndex);
            renderPracticeOrTestMode(entries, newIndex);
        });

        inputElement.focus();
    }
});


// --- 新增语音功能 ---

function createSpeakerIcon(textToSpeak, isFinnish = true) {
    const speakerIcon = document.createElement('span');
    speakerIcon.className = 'speaker-icon';
    speakerIcon.textContent = '🔊';
    speakerIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isPlayingAll) {
            const playAllBtn = document.getElementById('play-all-btn');
            stopPlayback(playAllBtn);
        }
        synth.cancel(); // 停止任何当前的发音
        const lang = isFinnish ? 'fi-FI' : 'zh-CN';
        speak(textToSpeak, lang);
    });
    return speakerIcon;
}

function speak(text, lang, onEndCallback) {
    if (text && text.trim() !== '') {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        utterance.onend = onEndCallback;
        utterance.onerror = (event) => {
            console.error(`SpeechSynthesis Error: ${event.error}`);
            if (onEndCallback) onEndCallback(); // 即使出错也继续队列
        };
        synth.speak(utterance);
    } else {
        if (onEndCallback) {
            onEndCallback(); // 如果文本为空，立即调用回调以继续队列
        }
    }
}

function playNextInQueue() {
    if (!isPlayingAll) return;

    if (currentPlaybackIndex >= playbackQueue.length) {
        // 循环播放
        currentPlaybackIndex = 0;
    }

    const item = playbackQueue[currentPlaybackIndex];
    currentPlaybackIndex++;
    speak(item.text, item.lang, playNextInQueue);
}

function togglePlayback(dayData, btn) {
    isPlayingAll = !isPlayingAll;
    if (isPlayingAll) {
        btn.textContent = '⏹️ 停止朗读';
        playbackQueue = [];
        dayData.entries.forEach(entry => {
            playbackQueue.push({ text: entry.finnish, lang: 'fi-FI' });
            playbackQueue.push({ text: entry.chinese, lang: 'zh-CN' });
        });
        currentPlaybackIndex = 0;
        synth.cancel(); // 确保在开始前没有其他语音在播放
        playNextInQueue();
    } else {
        stopPlayback(btn);
    }
}

function stopPlayback(btn) {
    isPlayingAll = false;
    synth.cancel();
    if (btn) {
        btn.textContent = '▶️ 整课循环朗读';
    }
}
