<script>
    import { onMount, onDestroy } from 'svelte';
    import { currentLessonData, currentMode, currentLessonIndex } from '../store.js';
    import SpeakerIcon from './SpeakerIcon.svelte';

    let entries = [];
    let currentIndex = 0;
    let userAnswer = '';
    let feedback = { message: '', isCorrect: false, showCorrect: false, correctAnswer: '' };
    let showTranslation = false;
    let sessionCompleted = false;

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

        if (progress && progress.shuffledEntries) {
            entries = progress.shuffledEntries;
            currentIndex = progress.currentIndex || 0;
        } else {
            entries = shuffle([...dayEntries]);
            currentIndex = 0;
            saveProgress();
        }
        sessionCompleted = currentIndex >= entries.length;
    }
    
    function saveProgress() {
        const dayIndex = $currentLessonIndex;
        const mode = $currentMode;
        const savedProgress = JSON.parse(localStorage.getItem('suomenProgress') || '{}');
        
        if (!savedProgress[dayIndex]) savedProgress[dayIndex] = {};
        savedProgress[dayIndex][mode] = {
            shuffledEntries: entries,
            currentIndex: currentIndex
        };
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

        const expectedAnswer = $currentMode === 'test' ? currentEntry.chinese : currentEntry.finnish;
        const isCorrect = userAnswer.trim().toLowerCase() === expectedAnswer.trim().toLowerCase();

        if (isCorrect) {
            feedback = { message: '正确!', isCorrect: true, showCorrect: true, correctAnswer: expectedAnswer };
            setTimeout(() => {
                nextQuestion();
            }, 800);
        } else {
            feedback = { message: '错误. 正确答案:', isCorrect: false, showCorrect: true, correctAnswer: expectedAnswer };
        }
    }

    function nextQuestion() {
        if (currentIndex < entries.length - 1) {
            currentIndex++;
            saveProgress();
            resetState();
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
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    });

    onDestroy(() => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    });

</script>

<div class="practice-view">
    {#if sessionCompleted}
        <div class="card completion-card">
            <p>🎉 恭喜！您已完成本课的所有练习！</p>
            <button class="btn" on:click={resetSession}>重新开始</button>
        </div>
    {:else if currentEntry}
        <div class="card">
            <p class="question">
                <span>{currentEntry.finnish}</span>
                <SpeakerIcon text={currentEntry.finnish} />
            </p>

            {#if $currentMode === 'practice'}
                <div class="translation-container">
                    <p class="translation" class:visible={showTranslation}>
                        {currentEntry.chinese}
                    </p>
                    <button class="btn-toggle" on:mousedown={() => showTranslation = true} on:mouseup={() => showTranslation = false} on:mouseleave={() => showTranslation = false}>
                        {showTranslation ? '隐藏翻译' : '按住显示翻译'}
                    </button>
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
    }
    
    .completion-card {
        text-align: center;
    }
    .completion-card p {
        font-size: 1.2em;
        margin-bottom: 20px;
    }

    .question {
        font-size: 1.4em;
        font-weight: 600;
        margin: 0 0 20px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .translation-container {
        margin-bottom: 20px;
    }
    .translation {
        color: #666;
        min-height: 24px;
        visibility: hidden;
    }
    .translation.visible {
        visibility: visible;
    }

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
    
    .btn, .btn-toggle, .check-btn {
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
    .btn-toggle { background: none; border: 1px solid #ccc; color: #555; }
</style>
