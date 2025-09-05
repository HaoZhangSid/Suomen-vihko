<script>
    import { finnishRate, enableSpellingMode, spellingPause } from '../store.js';
    import { onDestroy } from 'svelte';
    import { fetchAsObjectUrlCached as fetchAsObjectUrl } from './googleTts.js';

    export let text;
    export let lang = 'fi-FI';

    let isPlaying = false;
    let playbackQueue = [];
    let currentPlaybackIndex = -1;
    let audioEl;
    let currentUrl = null;

    let pauseDurationValue;
    const unsubscribe = spellingPause.subscribe(value => {
        pauseDurationValue = value;
    });

    function cleanupUrl() {
        if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
            currentUrl = null;
        }
    }

    function stopAllPlayback() {
        if (audioEl) {
            audioEl.onended = null;
            audioEl.onerror = null;
            audioEl.pause();
            audioEl.src = '';
        }
        cleanupUrl();
        isPlaying = false;
        playbackQueue = [];
        currentPlaybackIndex = -1;
    }

    async function playNextInQueue() {
        if (currentPlaybackIndex >= playbackQueue.length || !isPlaying) {
            stopAllPlayback();
            return;
        }

        const item = playbackQueue[currentPlaybackIndex];
        const nextStep = () => {
            currentPlaybackIndex++;
            playNextInQueue();
        };

        try {
            if (item.type === 'pause') {
                setTimeout(nextStep, pauseDurationValue);
                return;
            }

            if (!audioEl) {
                audioEl = new Audio();
            }

            audioEl.onended = () => {
                cleanupUrl();
                nextStep();
            };
            audioEl.onerror = () => {
                cleanupUrl();
                nextStep();
            };

            if (item.type === 'tts') {
                cleanupUrl();
                const url = await fetchAsObjectUrl(item.text, item.lang, item.rate);
                currentUrl = url;
                audioEl.src = url;
                await audioEl.play();
            } else if (item.type === 'audio') {
                const encoded = encodeURIComponent(item.letter);
                audioEl.src = `audio/letters/${encoded}.wav`;
                await audioEl.play();
            }
        } catch (e) {
            stopAllPlayback();
        }
    }

    async function speak() {
        if (isPlaying) {
            stopAllPlayback();
            return;
        }
        isPlaying = true;

        const spellMode = $enableSpellingMode;
        const baseRate = $finnishRate;

        playbackQueue = [];
        playbackQueue.push({ type: 'tts', text: text, lang: lang, rate: baseRate });
        if (spellMode && lang === 'fi-FI' && !text.includes(' ')) {
            const letters = text.toUpperCase().split('');
            letters.forEach((letter, index) => {
                playbackQueue.push({ type: 'audio', letter });
                if (index < letters.length - 1) playbackQueue.push({ type: 'pause' });
            });
            playbackQueue.push({ type: 'tts', text: text, lang: lang, rate: baseRate });
        }

        currentPlaybackIndex = 0;
        playNextInQueue();
    }

    function handleKeyPress(event) {
        if (event.key === 'Enter') speak();
    }

    onDestroy(() => {
        stopAllPlayback();
        unsubscribe();
    });
</script>

<span class="speaker-icon" on:click|stopPropagation={speak} role="button" tabindex="0" on:keypress={handleKeyPress}>
    🔊
</span>
<style>
    .speaker-icon {
        cursor: pointer;
        margin-left: 10px;
        font-size: 0.9em;
        display: inline-block;
        transition: transform 0.2s;
        user-select: none;
    }

    .speaker-icon:hover {
        transform: scale(1.2);
    }
</style>
