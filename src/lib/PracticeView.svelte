<script>
    import { onMount, onDestroy } from 'svelte';
    import { currentLessonData, currentMode, currentLessonIndex, finnishRate, masteredMap, hideMastered, toggleMastered, isMastered } from '../store.js';
    import SpeakerIcon from './SpeakerIcon.svelte';
    import { fetchAsObjectUrlCached as fetchAsObjectUrl } from './googleTts.js';
    import { Eye, EyeOff, CheckCircle2, Circle, Filter, FilterX } from 'lucide-svelte';

    let entries = [];
    let currentIndex = 0;
    let userAnswer = '';
    let feedback = { message: '', isCorrect: false, showCorrect: false, correctAnswer: '' };
    let showTranslation = false;
    let sessionCompleted = false;
    let ttsAudioEl;
    let lastSpokenIndex = -1;

    function getEntryIndex(entry, baseList){
        if (!entry || !baseList) return -1;
        return baseList.findIndex(e => e && e.finnish === entry.finnish && e.chinese === entry.chinese);
    }

    // Helper to shuffle array
    function shuffle(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    // Load and save progress
    function loadProgress(dayIndex, mode, dayEntries) {
        const savedProgress = JSON.parse(localStorage.getItem('suomenProgress') || '{}');
        const progress = savedProgress?.[dayIndex]?.[mode];

        const base = $hideMastered ? dayEntries.filter((_, idx)=> !isMastered(dayIndex, idx, $masteredMap)) : dayEntries;

        if (progress && (progress.shuffledIndices || progress.shuffledEntries)) {
            let indices = progress.shuffledIndices;
            if (!indices && progress.shuffledEntries) {
                // backward-compat: map objects to indices
                indices = progress.shuffledEntries.map(e => getEntryIndex(e, $currentLessonData.entries)).filter(i => i>=0);
            }
            // reconstruct from current base (filter may have去除 mastered)
            const indexSet = new Set(indices);
            entries = baseListFromIndices(indexSet, dayEntries);
            currentIndex = Math.min(progress.currentIndex || 0, Math.max(0, entries.length - 1));
        } else {
            entries = shuffle([...base]);
            currentIndex = 0;
            saveProgress();
        }
        sessionCompleted = currentIndex >= entries.length;
        // speak after load
        queueSpeak();
    }

    function baseListFromIndices(setOrArr, dayEntries){
        const result = [];
        const arr = Array.isArray(setOrArr) ? setOrArr : Array.from(setOrArr);
        for (const i of arr) {
            if ($hideMastered && isMastered($currentLessonIndex, i, $masteredMap)) continue;
            if (dayEntries[i]) result.push(dayEntries[i]);
        }
        return result;
    }
    
    function saveProgress() {
        const dayIndex = $currentLessonIndex;
        const mode = $currentMode;
        const savedProgress = JSON.parse(localStorage.getItem('suomenProgress') || '{}');
        
        if (!savedProgress[dayIndex]) savedProgress[dayIndex] = {};
        const indices = entries.map(e => getEntryIndex(e, $currentLessonData.entries)).filter(i=>i>=0);
        savedProgress[dayIndex][mode] = { shuffledIndices: indices, currentIndex };
        localStorage.setItem('suomenProgress', JSON.stringify(savedProgress));
    }
    
    // Reactive logic: Reset when day or mode changes
    $: if ($currentLessonData) {
        loadProgress($currentLessonIndex, $currentMode, $currentLessonData.entries);
        resetState();
    }
    
    let currentEntry;
    $: currentEntry = entries[currentIndex];

    function checkAnswer() {
        if (!currentEntry) return;

        const expectedAnswer = currentEntry.finnish;
        const isCorrect = userAnswer.trim().toLowerCase() === expectedAnswer.trim().toLowerCase();

        if (isCorrect) {
            feedback = { message: '正确!', isCorrect: true, showCorrect: true, correctAnswer: expectedAnswer };
            showTranslation = true; // 显示翻译
            setTimeout(() => {
                nextQuestion();
            }, 800);
        } else {
            feedback = { message: '错误. 正确答案:', isCorrect: false, showCorrect: true, correctAnswer: expectedAnswer };
            showTranslation = true; // 显示翻译
        }
    }

    function nextQuestion() {
        if (currentIndex < entries.length - 1) {
            currentIndex++;
            saveProgress();
            resetState();
            queueSpeak();
        } else {
            currentIndex++;
            saveProgress();
            sessionCompleted = true;
        }
    }

    function prevQuestion() {
        if (currentIndex > 0) {
            currentIndex--;
            saveProgress();
            resetState();
            queueSpeak();
        }
    }

    function resetState() {
        userAnswer = '';
        feedback = { message: '', isCorrect: false, showCorrect: false, correctAnswer: '' };
        showTranslation = false;
        // Focus the input
        setTimeout(() => {
            const input = document.getElementById('answer-input');
            if (input) input.focus();
        }, 0);
    }
    
    function resetSession() {
        entries = shuffle([...$currentLessonData.entries]);
        currentIndex = 0;
        sessionCompleted = false;
        saveProgress();
        resetState();
    }
    
    // Keyboard shortcuts for translation
    function handleKeyDown(e) {
        if (e.key === 'Alt' && $currentMode === 'practice') {
            e.preventDefault();
            showTranslation = true;
        }
    }
    function handleKeyUp(e) {
        if (e.key === 'Alt' && $currentMode === 'practice') {
            showTranslation = false;
        }
    }
    
    onMount(() => {
        ttsAudioEl = new Audio();
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    });

    onDestroy(() => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    });

    // --- auto speak current word ---
    async function queueSpeak(){
        // Avoid re-speaking same index
        if (currentIndex === lastSpokenIndex) return;
        lastSpokenIndex = currentIndex;
        await speakCurrent();
    }
    async function speakCurrent(){
        try {
            const entry = entries[currentIndex];
            if (!entry) return;
            const url = await fetchAsObjectUrl(entry.finnish, 'fi-FI', $finnishRate || 1.0);
            ttsAudioEl.src = url;
            await ttsAudioEl.play();
        } catch (e) {
            // ignore
        }
    }

</script>

<div class="practice-view">
    {#if sessionCompleted}
        <div class="card completion-card">
            <p>🎉 恭喜！您已完成本课的所有练习！</p>
            <button class="btn" on:click={resetSession}>重新开始</button>
        </div>
    {:else if currentEntry}
        <div class="card">
            <div class="question-row">
                <p class="question"><span>{$currentMode === 'test' ? currentEntry.chinese : currentEntry.finnish}</span> <SpeakerIcon text={currentEntry.finnish} /></p>
                <div class="icon-toolbar">
                    <button class="icon-btn" title={showTranslation ? '隐藏翻译' : '显示翻译'} on:click={() => showTranslation = !showTranslation}>
                        {#if showTranslation}<Eye size={18} />{:else}<EyeOff size={18} />{/if}
                    </button>
                    <button class="icon-btn" title={$hideMastered ? '显示已掌握' : '隐藏已掌握'} on:click={() => { hideMastered.set(!$hideMastered); loadProgress($currentLessonIndex, $currentMode, $currentLessonData.entries); }}>
                        {#if $hideMastered}<Filter size={18} />{:else}<FilterX size={18} />{/if}
                    </button>
                    <button class="icon-btn" title={isMastered($currentLessonIndex, getEntryIndex(currentEntry, $currentLessonData.entries), $masteredMap) ? '已掌握' : '标记掌握'} on:click={() => { const idx=getEntryIndex(currentEntry, $currentLessonData.entries); toggleMastered($currentLessonIndex, idx); if($hideMastered){ loadProgress($currentLessonIndex,$currentMode,$currentLessonData.entries);} }}>
                        {#if isMastered($currentLessonIndex, getEntryIndex(currentEntry, $currentLessonData.entries), $masteredMap)}<CheckCircle2 size={18} />{:else}<Circle size={18} />{/if}
                    </button>
                </div>
            </div>

            {#if $currentMode === 'practice'}
                <div class="translation-container">
                    <p class="translation" class:visible={showTranslation}>
                        {currentEntry.chinese}
                    </p>
                </div>
            {/if}

            <input
                id="answer-input"
                type="text"
                placeholder="输入你的答案..."
                bind:value={userAnswer}
                on:keydown={(e) => e.key === 'Enter' && checkAnswer()}
                disabled={feedback.showCorrect}
            />

            {#if !feedback.showCorrect}
                <button class="btn check-btn" on:click={checkAnswer}>检查</button>
            {/if}

            {#if feedback.showCorrect}
                <div class="feedback" class:correct={feedback.isCorrect} class:incorrect={!feedback.isCorrect}>
                    <p>{feedback.message}</p>
                    <p class="correct-answer">
                        <span>{feedback.correctAnswer}</span>
                        <SpeakerIcon text={currentEntry.finnish} />
                    </p>
                </div>
            {/if}

            <div class="navigation">
                <button class="btn" on:click={prevQuestion} disabled={currentIndex === 0}>上一题</button>
                <span>{currentIndex + 1} / {entries.length}</span>
                <button class="btn" on:click={nextQuestion}>
                    {feedback.showCorrect ? '下一题' : '跳过'}
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .practice-view, .card {
        animation: fadeIn 0.5s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .card {
        padding: 25px;
        border: 1px solid #ddd;
        border-radius: 12px;
        background: #fff;
        position: relative;
        padding-top: 56px; /* reserve one icon row height at top */
    }
    
    .completion-card {
        text-align: center;
    }
    .completion-card p {
        font-size: 1.2em;
        margin-bottom: 20px;
    }

    .question-row { display:flex; justify-content:space-between; align-items:center; gap:12px; }
    .icon-toolbar { display:flex; align-items:center; gap:8px; position:absolute; top:12px; right:12px; }
    .question {
        font-size: 1.4em;
        font-weight: 600;
        margin: 0 0 20px 0;
    }
    /* .toolbar-row removed */

    .translation-container {
        margin-bottom: 20px;
        display: flex;
        flex-direction: column;
    }
    .translation {
        color: #666;
        min-height: 24px;
        visibility: hidden;
    }
    .translation.visible {
        visibility: visible;
    }
    /* translation-actions removed; toolbar moved to header */

    input {
        width: 100%;
        padding: 12px;
        font-size: 1em;
        border-radius: 6px;
        border: 1px solid #ccc;
        box-sizing: border-box;
        margin-bottom: 15px;
    }

    .feedback {
        padding: 15px;
        border-radius: 6px;
        margin: 15px 0;
    }
    .feedback.correct { background-color: #e8f5e9; }
    .feedback.incorrect { background-color: #ffebee; }
    .feedback p { margin: 0; font-weight: bold; }
    .feedback .correct-answer {
        font-weight: normal;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
    }

    .navigation {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
    }
    
    .btn, .check-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 1em;
        transition: background-color 0.2s;
    }
    .btn:disabled { cursor: not-allowed; opacity: 0.6; }
    .check-btn {
        width: 100%;
        background-color: #337ab7;
        color: white;
    }
    .check-btn:hover { background-color: #286090; }
    .icon-btn { width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #cbd5e1; border-radius:8px; background:#fff; color:#334155 }
    .icon-btn:hover { background:#f1f5f9 }
</style>
