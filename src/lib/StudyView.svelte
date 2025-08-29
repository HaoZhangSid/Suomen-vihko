<script>
    import { onDestroy } from 'svelte';
    import { currentLessonData } from '../store.js';
    import SpeakerIcon from './SpeakerIcon.svelte';

    const synth = window.speechSynthesis;
    let isPlayingAll = false;
    let playbackQueue = [];
    let currentPlaybackIndex = 0;
    let currentlyPlayingFinnish = '';

    function speak(text, lang, onEndCallback) {
        if (synth.speaking) {
            synth.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        utterance.onend = onEndCallback;
        synth.speak(utterance);
    }

    function playNextInQueue() {
        if (currentPlaybackIndex < playbackQueue.length && isPlayingAll) {
            const item = playbackQueue[currentPlaybackIndex];
            currentlyPlayingFinnish = item.finnishForHighlight;
            speak(item.text, item.lang, playNextInQueue);
            currentPlaybackIndex++;
        } else {
            stopPlayback();
        }
    }

    function togglePlayback() {
        if (isPlayingAll) {
            stopPlayback();
        } else {
            playbackQueue = [];
            $currentLessonData.entries.forEach(entry => {
                playbackQueue.push({ text: entry.finnish, lang: 'fi-FI', finnishForHighlight: entry.finnish });
                playbackQueue.push({ text: entry.chinese, lang: 'zh-CN', finnishForHighlight: entry.finnish });
            });
            
            isPlayingAll = true;
            currentPlaybackIndex = 0;
            playNextInQueue();
        }
    }
    
    function stopPlayback() {
        isPlayingAll = false;
        currentlyPlayingFinnish = '';
        if (synth.speaking) {
            synth.cancel();
        }
    }

    onDestroy(() => {
        stopPlayback(); // Cleanup on component destruction
    });
</script>

<div class="study-view">
    {#if $currentLessonData}
        <div class="header-controls">
            <h2 class="day-title">{$currentLessonData.day}</h2>
            <button class="btn-play-all" on:click={togglePlayback}>
                {isPlayingAll ? '停止朗读' : '整课循环朗读'}
            </button>
        </div>
        <div class="entries-grid">
            {#each $currentLessonData.entries as entry (entry.finnish)}
                <div class="entry" class:playing={entry.finnish === currentlyPlayingFinnish}>
                    <p class="finnish">
                        <span>{entry.finnish}</span>
                        <SpeakerIcon text={entry.finnish} lang="fi-FI" />
                    </p>
                    <p class="chinese">{entry.chinese}</p>
                </div>
            {/each}
        </div>
    {:else}
        <p>Loading lesson...</p>
    {/if}
</div>

<style>
    .study-view {
        animation: fadeIn 0.5s ease;
    }

    .header-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
    }

    .day-title {
        text-align: center;
        color: #2c3e50;
        margin: 0;
        font-size: 1.8em;
    }

    .btn-play-all {
        padding: 8px 16px;
        background-color: #3498db;
        color: white;
        border: none;
        border-radius: 20px;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .btn-play-all:hover {
        background-color: #2980b9;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .entries-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 20px;
    }

    .entry {
        background-color: #f9f9f9;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 15px;
        transition: box-shadow 0.3s ease;
    }
    
    .entry:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .entry.playing {
        background-color: #e8f5e9;
        border-color: #4caf50;
    }

    .finnish {
        font-weight: 600;
        font-size: 1.1em;
        color: #34495e;
        margin: 0 0 8px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .chinese {
        font-size: 1em;
        color: #555;
        margin: 0;
    }
</style>
