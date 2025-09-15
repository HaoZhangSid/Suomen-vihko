<script>
    import { onMount, onDestroy } from 'svelte';
    import { 
        allCustomSelections, currentLessonIndex, customPlaybackList, 
        finnishPlaybackReps, chinesePlaybackReps, currentLessonData, 
        finnishRate, enableSpellingMode, spellingPause,
        masteredMap, hideMastered, toggleMastered, isMastered
    } from '../store.js';
    import { Eye, EyeOff, Maximize2, PictureInPicture, CheckCircle2, Circle, Filter, FilterX } from 'lucide-svelte';
    import SpeakerIcon from './SpeakerIcon.svelte';
    import { get } from 'svelte/store';
    import { fetchAsObjectUrlCached as fetchAsObjectUrl } from './googleTts.js';
    import { getAudioContext } from '../store.js';
    import { updateMediaSession, clearMediaSession } from './mediaSession.js';

    // --- HTMLAudioElement-based State ---
    let htmlAudio; // main playback audio element
    let isPlaying = false; // Unified playing state
    // Track allocated object URLs to revoke on stop
    let allocatedUrls = [];
    // Prefetch progress state
    let isPrefetching = false;
    let prefetchTotal = 0;
    let prefetchDone = 0;
    let prefetchFailed = 0;
    // --- End State ---

    let isCustomPlaybackPanelOpen = false;
    let playbackQueue = [];
    let currentPlaybackIndex = -1;
    let currentlyPlayingFinnish = '';
    let isPaused = false;
    // Focus Card mode
    let focusMode = (localStorage.getItem('focus_card_enabled') === 'true');
    let focusFinnish = '';
    let focusChinese = '';

    // WebAudio for letter spelling
    let audioCtx;
    /** @type {Record<string, AudioBuffer>} */
    let letterBuffers = {};
    /** @type {AudioBufferSourceNode|null} */
    let currentLetterSource = null;
    let currentItem = null;
    let letterWatchdog = null;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let preferHtmlLetters = isMobile; // on mobile, always use minimized path
    let combinedLettersUrl = null; // temp stitched audio when in background

    // Subscribe to spellingPause for dynamic updates
    let pauseDurationValue;
    const unsubscribe = spellingPause.subscribe(value => {
        pauseDurationValue = value;
    });

    // --- Mobile pause correction for letter spelling ---
    function computeEffectivePauseMs(){
        let base = Number(pauseDurationValue) || 0;
        let correction = 0;
        if (preferHtmlLetters) {
            // in background, HTMLAudio switching has extra latency
            correction = 60;
        } else if (isMobile) {
            // foreground on mobile still has a small inherent delay
            correction = 40;
        }
        const ms = Math.max(0, base - correction);
        return ms;
    }

    function toggleFocusMode() {
        focusMode = !focusMode;
        try { localStorage.setItem('focus_card_enabled', String(focusMode)); } catch {}
    }
    function closeFocus() { focusMode = false; try { localStorage.setItem('focus_card_enabled', 'false'); } catch {} }

    // Selection helpers
    function updateSelections(newSelectionSet) {
        allCustomSelections.update(selections => {
            selections[$currentLessonIndex] = Array.from(newSelectionSet);
            return selections;
        });
    }

    function handleSelectItem(index) {
        // do not select mastered items
        if (isMastered($currentLessonIndex, index, $masteredMap)) return;
        const currentSelections = new Set($customPlaybackList);
        currentSelections.has(index) ? currentSelections.delete(index) : currentSelections.add(index);
        updateSelections(currentSelections);
    }

    function selectAll() {
        const allIndices = new Set(
            $currentLessonData.entries
                .map((_, i) => i)
                .filter(i => !isMastered($currentLessonIndex, i, $masteredMap))
        );
        updateSelections(allIndices);
    }

    function deselectAll() {
        updateSelections(new Set());
    }

    function selectWordsOnly() {
        const wordIndices = new Set($currentLessonData.entries
            .map((entry, i) => ({ entry, i }))
            .filter(({ entry, i }) => !entry.finnish.includes(' ') && entry.finnish.length > 0 && !isMastered($currentLessonIndex, i, $masteredMap))
            .map(({ i }) => i));
        updateSelections(wordIndices);
    }

    function selectSentencesOnly() {
        const sentenceIndices = new Set($currentLessonData.entries
            .map((entry, i) => ({ entry, i }))
            .filter(({ entry, i }) => entry.finnish.includes(' ') && !isMastered($currentLessonIndex, i, $masteredMap))
            .map(({ i }) => i));
        updateSelections(sentenceIndices);
    }

    function revokeAllUrls() {
        allocatedUrls.forEach(url => URL.revokeObjectURL(url));
        allocatedUrls = [];
    }

    function resetAudioEl() {
        if (!htmlAudio) return;
        htmlAudio.onended = null;
        htmlAudio.onerror = null;
        try { htmlAudio.pause(); } catch {}
        try { htmlAudio.removeAttribute('src'); } catch {}
        try { htmlAudio.load(); } catch {}
    }

    // --- Sorting helper: when showing mastered (hideMastered = false), put mastered items first ---
    let sortedEntryItems = [];
    $: if ($currentLessonData) {
        const list = $currentLessonData.entries.map((entry, i) => ({ entry, i }));
        if (!$hideMastered) {
            list.sort((a, b) => {
                const am = isMastered($currentLessonIndex, a.i, $masteredMap);
                const bm = isMastered($currentLessonIndex, b.i, $masteredMap);
                if (am === bm) return 0;
                return am ? -1 : 1; // mastered first
            });
        }
        sortedEntryItems = list;
    }

    function stopAllPlayback() {
        resetAudioEl();
        revokeAllUrls();
        
        isPlaying = false;
        isPaused = false;
        playbackQueue = [];
        currentPlaybackIndex = -1;
        currentlyPlayingFinnish = '';
        if (currentLetterSource) { try { currentLetterSource.onended=null; currentLetterSource.stop(0); } catch {} currentLetterSource=null; }
        if (letterWatchdog) { clearTimeout(letterWatchdog); letterWatchdog=null; }
        if (combinedLettersUrl) { try { URL.revokeObjectURL(combinedLettersUrl); } catch {} combinedLettersUrl=null; }
        
        clearMediaSession();
    }
    
    // Schedule advancing to avoid deep synchronous recursion/tight loops
    function scheduleNextTick(fn){
        try { setTimeout(fn, 0); } catch { fn(); }
    }

    let consecutiveFailures = 0;

    async function playNextInQueue() {
        if (currentPlaybackIndex >= playbackQueue.length) {
            if (isPlaying) {
                currentPlaybackIndex = 0;
            } else {
                stopAllPlayback();
                return;
            }
        }

        if (playbackQueue.length === 0 || !isPlaying) {
            stopAllPlayback();
            return;
        }

        const item = playbackQueue[currentPlaybackIndex];
        currentItem = item;

        const nextStep = () => {
            if (isPaused) return; // do not advance when paused
            currentPlaybackIndex++;
            scheduleNextTick(playNextInQueue);
        };

        try {
            // Best-effort resume AudioContext on every step (covers iOS)
            if (!audioCtx) audioCtx = getAudioContext();
            if (audioCtx && audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch {} }

            if (item.type === 'pause') {
                const ms = item.pauseMs ?? pauseDurationValue;
                // Always schedule via setTimeout to avoid synchronous tight loops
                const delay = preferHtmlLetters ? 0 : ms;
                setTimeout(nextStep, Math.max(0, delay));
                return;
            }

            // Update media session
            if (item.type === 'url' || item.type === 'audio') {
                updateMediaSession({
                    title: item.label || (item.type === 'audio' ? 'Spelling...' : ''),
                    album: $currentLessonData.day,
                    artist: item.lang === 'fi-FI' ? 'Finnish' : (item.lang === 'zh-CN' ? 'Chinese' : '')
                }, { pause: stopAllPlayback });
            }

            if (!htmlAudio) {
                htmlAudio = new Audio();
                htmlAudio.preload = 'auto';
            }

            htmlAudio.onended = () => { consecutiveFailures = 0; nextStep(); };
            htmlAudio.onerror = () => { console.error('Audio playback error for item:', item); consecutiveFailures++; if (consecutiveFailures > 20) { stopAllPlayback(); return; } nextStep(); };

            if (item.type === 'url') {
                if (!item.src && item.text) {
                    try {
                        const url = await fetchAsObjectUrl(item.text, item.lang || 'fi-FI', item.rate || 1.0);
                        item.src = url;
                        allocatedUrls.push(url);
                    } catch (e) {
                        console.error('Lazy fetch TTS failed:', item.text, e);
                        nextStep();
                        return;
                    }
                }
                htmlAudio.src = item.src;
                currentlyPlayingFinnish = item.lang === 'fi-FI' ? (item.label || '') : currentlyPlayingFinnish;
                if (item.f) { focusFinnish = item.f; }
                if (item.c) { focusChinese = item.c; }
                drawPipCard(); updatePipCaption();
                try { await htmlAudio.play(); consecutiveFailures = 0; } catch (e) { console.warn('play() rejected', e); consecutiveFailures++; if (consecutiveFailures > 20) { stopAllPlayback(); return; } nextStep(); return; }
                isPaused = false;
            } else if (item.type === 'audio') {
                // Prefer WebAudio for precise timing of letter spelling
                const buf = letterBuffers[item.letter];
                if (!preferHtmlLetters && buf && audioCtx) {
                    const src = audioCtx.createBufferSource();
                    currentLetterSource = src;
                    src.buffer = buf;
                    src.connect(audioCtx.destination);
                    src.onended = () => { currentLetterSource = null; if (letterWatchdog) { clearTimeout(letterWatchdog); letterWatchdog=null; } nextStep(); };
                    src.start();
                    // watchdog: ensure we advance even if onended isn't fired on some devices
                    if (letterWatchdog) { clearTimeout(letterWatchdog); }
                    letterWatchdog = setTimeout(()=>{ currentLetterSource = null; nextStep(); }, Math.ceil(buf.duration*1000)+50);
                    isPaused = false; // pause only controls HTMLAudio; letters are brief
                } else {
                    // Background or missing buffer: stitch consecutive letters to one audio to avoid per-letter gaps
                    const letters = [];
                    let j = currentPlaybackIndex;
                    while (j < playbackQueue.length) {
                        const it = playbackQueue[j];
                        if (it.type === 'audio') { letters.push(it.letter); j++; continue; }
                        if (it.type === 'pause') { j++; continue; }
                        break;
                    }
                    try {
                        const url = await renderLettersToObjectUrl(letters, computeEffectivePauseMs());
                        if (combinedLettersUrl) { try { URL.revokeObjectURL(combinedLettersUrl); } catch {} }
                        combinedLettersUrl = url;
                        if (!htmlAudio) htmlAudio = new Audio();
                        htmlAudio.onended = () => {
                            if (combinedLettersUrl) { try { URL.revokeObjectURL(combinedLettersUrl); } catch {} combinedLettersUrl=null; }
                            currentPlaybackIndex = j; // skip processed items
                            playNextInQueue();
                        };
                        htmlAudio.onerror = htmlAudio.onended;
                        htmlAudio.src = url;
                        try { await htmlAudio.play(); consecutiveFailures = 0; } catch (e) { console.warn('play() rejected (letters stitched)', e); consecutiveFailures++; if (consecutiveFailures > 20) { stopAllPlayback(); return; } nextStep(); return; }
                        isPaused = false;
                        return; // handled by onended
                    } catch (e) {
                        // fallback to single letter HTMLAudio
                        const encoded = encodeURIComponent(item.letter);
                        htmlAudio.src = `audio/letters/${encoded}.wav`;
                        try { await htmlAudio.play(); consecutiveFailures = 0; } catch (err) { console.warn('play() rejected (single letter)', err); consecutiveFailures++; if (consecutiveFailures > 20) { stopAllPlayback(); return; } nextStep(); return; }
                        isPaused = false;
                    }
                }
            }
        } catch (error) {
            console.error('Playback error in queue:', error);
            // Be tolerant of transient errors on mobile/background: advance to next item when not paused
            if (!isPaused) {
                try { currentPlaybackIndex++; } catch {}
                scheduleNextTick(playNextInQueue);
            }
        }
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function prefetchTTS(text, lang, rate, attempts = 3) {
        let lastError;
        for (let i = 0; i < attempts; i++) {
            try {
                const url = await fetchAsObjectUrl(text, lang, rate);
                return url;
            } catch (e) {
                lastError = e;
                const backoff = 300 * Math.pow(2, i); // 300, 600, 1200ms
                await sleep(backoff);
            }
        }
        throw lastError;
    }

    function computePrefetchTotal(entries, finnishReps, chineseReps, spellMode) {
        let total = 0;
        for (const entry of entries) {
            const isWord = !entry.finnish.includes(' ');
            total += finnishReps * (1 + (spellMode && isWord ? 1 : 0));
            total += chineseReps;
        }
        return total;
    }

    async function prefetchQueue(entries) {
        const spellMode = get(enableSpellingMode);
        const baseRate = $finnishRate;
        const finnishReps = get(finnishPlaybackReps);
        const chineseReps = get(chinesePlaybackReps);

        // 移动端：不做全量预取，改为懒加载，避免卡死/内存压力
        if (isMobile) {
            const queue = [];
            for (const entry of entries) {
                const finnishText = entry.finnish;
                for (let i = 0; i < finnishReps; i++) {
                    queue.push({ type: 'url', src: null, text: finnishText, lang: 'fi-FI', rate: baseRate, label: finnishText, f: finnishText, c: entry.chinese });
                    if (spellMode && !finnishText.includes(' ')) {
                        const letters = finnishText.toUpperCase().split('');
                        letters.forEach((letter, index) => {
                            queue.push({ type: 'audio', letter, lang: 'en-US', label: `Spell ${letter}` });
                            if (index < letters.length - 1) queue.push({ type: 'pause', pauseMs: computeEffectivePauseMs() });
                        });
                        queue.push({ type: 'url', src: null, text: finnishText, lang: 'fi-FI', rate: baseRate, label: finnishText, f: finnishText, c: entry.chinese });
                    }
                }
                for (let i = 0; i < chineseReps; i++) {
                    queue.push({ type: 'url', src: null, text: entry.chinese, lang: 'zh-CN', rate: 1.0, label: entry.chinese, f: finnishText, c: entry.chinese });
                }
            }
            // 轻量化进度：移动端不显示预取遮罩
            prefetchTotal = 0; prefetchDone = 0; prefetchFailed = 0; isPrefetching = false;
            return queue;
        }

        // 桌面端：保留原有预取，提升连贯性
        prefetchTotal = computePrefetchTotal(entries, finnishReps, chineseReps, spellMode);
        prefetchDone = 0;
        prefetchFailed = 0;
        isPrefetching = true;

        const queue = [];
        for (const entry of entries) {
            const finnishText = entry.finnish;
            for (let i = 0; i < finnishReps; i++) {
                try {
                    const url = await prefetchTTS(finnishText, 'fi-FI', baseRate);
                    allocatedUrls.push(url);
                    queue.push({ type: 'url', src: url, lang: 'fi-FI', label: finnishText, f: finnishText, c: entry.chinese });
                    prefetchDone++;
                } catch (e) {
                    console.error('Prefetch failed (fi):', finnishText, e);
                    prefetchFailed++;
                }

                if (spellMode && !finnishText.includes(' ')) {
                    const letters = finnishText.toUpperCase().split('');
                    letters.forEach((letter, index) => {
                        queue.push({ type: 'audio', letter, lang: 'en-US', label: `Spell ${letter}` });
                        if (index < letters.length - 1) queue.push({ type: 'pause', pauseMs: computeEffectivePauseMs() });
                    });
                    try {
                        const url2 = await prefetchTTS(finnishText, 'fi-FI', baseRate);
                        allocatedUrls.push(url2);
                        queue.push({ type: 'url', src: url2, lang: 'fi-FI', label: finnishText, f: finnishText, c: entry.chinese });
                        prefetchDone++;
                    } catch (e) {
                        console.error('Prefetch failed (fi repeat):', finnishText, e);
                        prefetchFailed++;
                    }
                }
            }
            for (let i = 0; i < chineseReps; i++) {
                try {
                    const urlZh = await prefetchTTS(entry.chinese, 'zh-CN', 1.0);
                    allocatedUrls.push(urlZh);
                    queue.push({ type: 'url', src: urlZh, lang: 'zh-CN', label: entry.chinese, f: finnishText, c: entry.chinese });
                    prefetchDone++;
                } catch (e) {
                    console.error('Prefetch failed (zh):', entry.chinese, e);
                    prefetchFailed++;
                }
            }
        }
        isPrefetching = false;
        return queue;
    }

    async function buildAndPlayQueue(entries) {
        if (isPlaying || isPrefetching) {
            return;
        }

        // Prefetch all URLs before playback
        revokeAllUrls();
        playbackQueue = await prefetchQueue(entries);

        if (playbackQueue.length > 0) {
            isPlaying = true;
            currentPlaybackIndex = 0;
            playNextInQueue();
        }
    }

    // --- UI Handlers ---
    async function togglePlayback() {
        if (isPrefetching) {
            return;
        }
        if (isPlaying) {
            stopAllPlayback();
            return;
        }
        if (!$currentLessonData || !$currentLessonData.entries) return;

        // 仅播放：已勾选 且 未掌握 的条目
        const indices = Array.from($customPlaybackList)
            .filter(i => !isMastered($currentLessonIndex, i, $masteredMap))
            .sort((a,b)=>a-b);
        const entries = indices.map(i => $currentLessonData.entries[i]);
        if (entries.length === 0) return;

        const originalFinnishReps = get(finnishPlaybackReps);
        const originalChineseReps = get(chinesePlaybackReps);
        finnishPlaybackReps.set(1);
        chinesePlaybackReps.set(1);

        await buildAndPlayQueue(entries);

        finnishPlaybackReps.set(originalFinnishReps);
        chinesePlaybackReps.set(originalChineseReps);
    }

    async function toggleCustomPlayback() {
        if (isPrefetching) {
            return;
        }
        if (isPlaying) {
            stopAllPlayback();
            return;
        }
        
        const selectedIndices = Array.from($customPlaybackList)
            .filter(i => !isMastered($currentLessonIndex, i, $masteredMap))
            .sort((a, b) => a - b);
        const selectedEntries = selectedIndices.map(index => $currentLessonData.entries[index]);

        if (selectedEntries.length === 0) return;
        
        isCustomPlaybackPanelOpen = false;
        await buildAndPlayQueue(selectedEntries);
    }

    function handleCustomPlaybackClick() {
        if (isPlaying) {
            stopAllPlayback();
        } else if (!isPrefetching) {
            isCustomPlaybackPanelOpen = !isCustomPlaybackPanelOpen;
        }
    }

    async function togglePause() {
        if (!isPlaying || !htmlAudio) return;
        try {
            if (isPaused) {
                isPaused = false;
                // resume current item
                if (currentItem && currentItem.type === 'audio') {
                    if (currentLetterSource) {
                        try { currentLetterSource.onended = null; currentLetterSource.stop(0); } catch {}
                        currentLetterSource = null;
                    }
                    if (letterWatchdog) { clearTimeout(letterWatchdog); letterWatchdog=null; }
                } else {
                    await htmlAudio.play();
                }
            } else {
                isPaused = true;
                if (currentItem && currentItem.type === 'audio') {
                    if (currentLetterSource) {
                        try { currentLetterSource.onended = null; currentLetterSource.stop(0); } catch {}
                        currentLetterSource = null;
                    }
                    if (letterWatchdog) { clearTimeout(letterWatchdog); letterWatchdog=null; }
                } else {
                    htmlAudio.pause();
                }
            }
        } catch {}
    }

    async function preloadLetters(){
        try {
            audioCtx = getAudioContext();
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖ'.split('');
            for (const l of letters) {
                const resp = await fetch(`audio/letters/${encodeURIComponent(l)}.wav`);
                const ab = await resp.arrayBuffer();
                // decodeAudioData uses callback form in some Safari versions; wrap as Promise
                letterBuffers[l] = await new Promise((resolve, reject)=>{
                    const done = (buf)=> resolve(buf);
                    try {
                        const p = audioCtx.decodeAudioData(ab, done, reject);
                        if (p && typeof p.then === 'function') p.then(resolve).catch(reject);
                    } catch(e){ reject(e); }
                });
            }
        } catch (e) {
            console.warn('Letter preloading failed, fallback to HTMLAudio for letters.', e);
        }
    }

    function handleKey(e){ if (e.key === 'Escape') closeFocus(); }
    async function handleVisibility(){
        preferHtmlLetters = isMobile || (document.hidden === true);
        if (preferHtmlLetters && currentItem && currentItem.type === 'audio' && currentLetterSource) {
            try { currentLetterSource.onended=null; currentLetterSource.stop(0); } catch {}
            currentLetterSource = null;
            if (letterWatchdog) { clearTimeout(letterWatchdog); letterWatchdog=null; }
            // Play the same letter via HTMLAudio and continue
            const encoded = encodeURIComponent(currentItem.letter);
            if (!htmlAudio) htmlAudio = new Audio();
            htmlAudio.onended = () => { currentPlaybackIndex++; playNextInQueue(); };
            htmlAudio.onerror = htmlAudio.onended;
            htmlAudio.src = `audio/letters/${encoded}.wav`;
            try { await htmlAudio.play(); } catch {}
        }
    }
    onMount(()=>{ window.addEventListener('keydown', handleKey); document.addEventListener('visibilitychange', handleVisibility); preloadLetters(); });
    onDestroy(() => {
        stopAllPlayback();
        unsubscribe();
        window.removeEventListener('keydown', handleKey);
        document.removeEventListener('visibilitychange', handleVisibility);
    });

    // Stitch letters into one temporary WAV for background playback
    async function renderLettersToObjectUrl(letters, pauseMs){
        if (!letters || letters.length === 0) throw new Error('no letters');
        if (!audioCtx) audioCtx = getAudioContext();
        const sr = audioCtx ? audioCtx.sampleRate : 44100;
        const pauseSec = Math.max(0, Number(pauseMs)||0) / 1000;
        let total = 0;
        for (let i=0;i<letters.length;i++) {
            const b = letterBuffers[letters[i]];
            if (!b) continue;
            total += b.duration;
            if (i < letters.length-1) total += pauseSec;
        }
        const length = Math.max(1, Math.ceil(total * sr));
        const off = new OfflineAudioContext(1, length, sr);
        let t = 0;
        for (let i=0;i<letters.length;i++) {
            const b = letterBuffers[letters[i]];
            if (!b) continue;
            const src = off.createBufferSource();
            src.buffer = b;
            src.connect(off.destination);
            src.start(t);
            t += b.duration;
            if (i < letters.length-1) t += pauseSec;
        }
        const rendered = await off.startRendering();
        const ch = rendered.getChannelData(0);
        const pcm = new Int16Array(ch.length);
        for (let i=0;i<ch.length;i++) {
            let s = Math.max(-1, Math.min(1, ch[i]));
            pcm[i] = (s < 0 ? s * 0x8000 : s * 0x7FFF) | 0;
        }
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        const W = (o,s)=>{ for(let i=0;i<s.length;i++) view.setUint8(o+i, s.charCodeAt(i)); };
        W(0,'RIFF'); view.setUint32(4, 36 + pcm.byteLength, true); W(8,'WAVE'); W(12,'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, sr, true); view.setUint32(28, sr*2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        W(36,'data'); view.setUint32(40, pcm.byteLength, true);
        const blob = new Blob([wavHeader, pcm.buffer], { type: 'audio/wav' });
        return URL.createObjectURL(blob);
    }

    // ----------------------- PiP (Picture-in-Picture) for Focus Card -----------------------
    let pipVideo;
    let pipStream;
    let pipTrack;
    // Generate a tiny placeholder MP4 dynamically (white frame, ~0.5s)
    let cachedPipUrl = null;
    function drawPipCard(){ /* no-op in placeholder mode */ }
    function vttCue(start,end,text){
        // Safari 私有 WebKitTextTrackCue 在类型定义中不存在，使用宽松访问
        const W = /** @type {any} */ (window);
        const C = W.VTTCue || W.TextTrackCue || W.WebKitTextTrackCue;
        return new C(start,end,text);
    }
    function ensurePipTrack(){
        if (!pipVideo) return;
        if (!pipTrack) {
            try {
                pipTrack = pipVideo.addTextTrack('captions','Word','zh-CN');
                pipTrack.mode = 'showing';
            } catch(e) { console.warn('addTextTrack failed', e); }
        }
    }
    function updatePipCaption(){
        if (!pipTrack) return;
        try {
            // clear old cues
            if (pipTrack.cues) {
                for (let i=pipTrack.cues.length-1;i>=0;i--) pipTrack.removeCue(pipTrack.cues[i]);
            }
            const text = (focusFinnish || currentlyPlayingFinnish || '') + (focusChinese ? ('\n'+focusChinese) : '');
            const cue = vttCue(0, 3600, text);
            // Center horizontally & vertically, full width
            try {
                cue.align = 'center';
                cue.position = 50; // percent from left
                cue.size = 100;    // percent width
                cue.snapToLines = false;
                cue.line = 50;     // percent from top
            } catch {}
            pipTrack.addCue(cue);
        } catch(e) { console.warn('updatePipCaption failed', e); }
    }
    async function buildPlaceholderVideoUrl(){
        if (cachedPipUrl) return cachedPipUrl;
        // 1) Prefer local /pip.mp4 if available
        try {
            const head = await fetch('pip.mp4', { method: 'HEAD' });
            if (head.ok) return 'pip.mp4';
        } catch {}
        // 2) Try dynamic generation
        try {
            const cvs = document.createElement('canvas');
            cvs.width = 640; cvs.height = 360;
            const ctx = cvs.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0,0,cvs.width,cvs.height);
            const stream = cvs.captureStream(30);
            const chunks = [];
            const type = 'video/mp4;codecs=h264';
            if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(type)) throw new Error('MediaRecorder unsupported');
            const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 200_000 });
            rec.ondataavailable = (e)=>{ if (e.data && e.data.size) chunks.push(e.data); };
            const done = new Promise(resolve=>{ rec.onstop = resolve; });
            rec.start();
            await new Promise(r=>setTimeout(r, 500));
            rec.stop();
            await done;
            const blob = new Blob(chunks, { type });
            cachedPipUrl = URL.createObjectURL(blob);
            return cachedPipUrl;
        } catch (e) {
            console.warn('buildPlaceholderVideoUrl failed', e);
            // Fallback: use a remote tiny mp4 (for validation only)
            return 'https://mdn.github.io/dom-examples/picture-in-picture/assets/segment.mp4';
        }
    }
    function canUsePip(){
        const hasPiP = document.pictureInPictureEnabled && !!HTMLVideoElement.prototype.requestPictureInPicture;
        // 使用 'in' 检测私有属性，避免类型错误
        const hasWebkitPiP = 'webkitSetPresentationMode' in HTMLVideoElement.prototype;
        return (hasPiP || hasWebkitPiP);
    }
    async function enterPip(){
        if (!canUsePip()) return;
        if (!pipVideo) {
            pipVideo = document.createElement('video');
            pipVideo.setAttribute('playsinline','');
            pipVideo.playsInline = true;
            pipVideo.controls = false;
            pipVideo.muted = true; // 音频由现有播放器负责
            pipVideo.loop = true;
            pipVideo.disableRemotePlayback = true;
            pipVideo.style.position = 'fixed';
            pipVideo.style.left = '-9999px';
            pipVideo.style.width = '1px';
            pipVideo.style.height = '1px';
            pipVideo.className = 'pip-video';
            document.body.appendChild(pipVideo);
        }
        pipVideo.srcObject = null;
        const url = await buildPlaceholderVideoUrl();
        if (!url) { console.warn('No placeholder video available'); return; }
        pipVideo.crossOrigin = 'anonymous';
        pipVideo.src = url;
        await new Promise(res=>{
            if (pipVideo.readyState >= 1) return res();
            pipVideo.onloadedmetadata = ()=> res();
        });
        ensurePipTrack();
        updatePipCaption();
        try { await pipVideo.play(); } catch (e) { console.warn('pipVideo.play() failed', e); }
        try {
            // Prefer WebKit path on iOS
            const v = /** @type {any} */ (pipVideo);
            if (v && typeof v.webkitSetPresentationMode === 'function') {
                v.webkitSetPresentationMode('picture-in-picture');
            } else if ('requestPictureInPicture' in pipVideo) {
                await pipVideo.requestPictureInPicture();
            }
        } catch(e) { console.warn('PiP request failed', e); }
    }
    async function exitPip(){
        try {
            if (document.pictureInPictureElement) await document.exitPictureInPicture();
            const v = /** @type {any} */ (pipVideo);
            if (v && typeof v.webkitSetPresentationMode === 'function') v.webkitSetPresentationMode('inline');
        } catch {}
        if (pipVideo) { try { pipVideo.pause(); } catch {} }
        pipStream = null;
        if (cachedPipUrl) { try { URL.revokeObjectURL(cachedPipUrl); } catch {} cachedPipUrl=null; }
    }
</script>

<!-- Main playback audio element -->
<audio bind:this={htmlAudio} style="display:none"></audio>

<div class="study-view">
    <div class="controls flex flex-wrap items-center gap-3 mb-4">
        <button on:click={togglePlayback} class:playing={isPlaying && !isCustomPlaybackPanelOpen}
                class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            {isPlaying && !isCustomPlaybackPanelOpen ? '停止朗读' : '整课循环朗读'}
        </button>
        <div class="custom-playback-controls relative">
            <button on:click={handleCustomPlaybackClick} disabled={isPrefetching} class:playing={isPlaying}
                    class="px-4 py-2 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                {isPlaying ? '停止自定义循环' : '自定义循环播放'}
            </button>
            {#if isCustomPlaybackPanelOpen}
                <div class="playback-panel absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-md p-4 w-[300px] z-10">
                    <div class="slider-group flex flex-col gap-1 mb-3">
                        <label for="finnish-reps" class="text-sm text-slate-600">芬兰语重复: <span class="font-medium">{$finnishPlaybackReps}次</span></label>
                        <input type="range" id="finnish-reps" bind:value={$finnishPlaybackReps} min="1" max="5" step="1" />
                    </div>
                    <div class="slider-group flex flex-col gap-1 mb-4">
                        <label for="chinese-reps" class="text-sm text-slate-600">中文重复: <span class="font-medium">{$chinesePlaybackReps}次</span></label>
                        <input type="range" id="chinese-reps" bind:value={$chinesePlaybackReps} min="1" max="5" step="1" />
                    </div>
                    <button class="play-custom w-full px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" disabled={$customPlaybackList.size === 0 || isPlaying || isPrefetching} on:click={toggleCustomPlayback}>
                        {#if isPlaying}
                            停止循环
                        {:else}
                            开始循环 ({$customPlaybackList.size}项)
                        {/if}
                    </button>
                </div>
            {/if}
        </div>
        <div class="slider-container flex items-center gap-4 flex-wrap">
            <div class="rate-slider flex items-center gap-2 text-slate-700">
                <span>语速:</span>
                <input class="w-32" type="range" min="0.5" max="1.2" step="0.1" bind:value={$finnishRate} />
                <span class="tabular-nums">{$finnishRate.toFixed(1)}x</span>
            </div>
            <div class="spelling-toggle flex items-center gap-2">
                <input type="checkbox" id="spelling-mode" bind:checked={$enableSpellingMode} />
                <label for="spelling-mode" class="text-slate-700">拼写模式</label>
            </div>
            <div class="rate-slider flex items-center gap-2 text-slate-700">
                <span>停顿:</span>
                <input class="w-36" type="range" min="0" max="500" step="10" bind:value={$spellingPause} />
                <span class="tabular-nums">{$spellingPause}ms</span>
            </div>
        </div>
        <div class="ml-auto flex items-center gap-2">
            <button class="icon-btn" title={focusMode ? '退出专注卡片' : '专注卡片模式'} on:click={toggleFocusMode}>
                <Maximize2 size={18} />
            </button>
            <button class="icon-btn" title={$hideMastered ? '显示已掌握' : '隐藏已掌握'} on:click={() => hideMastered.set(!$hideMastered)}>
                {@html ''}
                {#if $hideMastered}<Filter size={18} />{:else}<FilterX size={18} />{/if}
            </button>
            {#if canUsePip()}
            <button class="icon-btn" title="画中画" on:click={enterPip}>
                <PictureInPicture size={18} />
            </button>
            {/if}
        </div>
    </div>

    {#if isPrefetching}
        <div class="prefetch-overlay fixed inset-0 flex items-center justify-center bg-black/25 z-40">
            <div class="prefetch-card bg-white rounded-lg shadow-lg px-5 py-4 text-center">
                <div class="font-medium mb-1">准备音频中…</div>
                <div class="text-sm text-slate-600">{prefetchDone} / {prefetchTotal} 已完成{prefetchFailed ? `，失败 ${prefetchFailed}` : ''}</div>
            </div>
        </div>
    {/if}

    {#if $currentLessonData}
        <div class="action-bar bg-white border border-slate-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-3 text-sm text-slate-700">
            <span>已选择 {$customPlaybackList.size} / {$currentLessonData.entries.length} 项</span>
            <button on:click={selectAll} disabled={isPrefetching} class="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">全选</button>
            <button on:click={deselectAll} disabled={isPrefetching} class="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">取消全选</button>
            <button on:click={selectWordsOnly} disabled={isPrefetching} class="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">只选单词</button>
            <button on:click={selectSentencesOnly} disabled={isPrefetching} class="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">只选句子</button>
        </div>

        <div class="entries-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
            {#each sortedEntryItems as item}
                {#if !($hideMastered && isMastered($currentLessonIndex, item.i, $masteredMap))}
                <div class="entry-item rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition data-[selected=true]:bg-indigo-50 data-[selected=true]:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500 data-[playing=true]:border-l-4 data-[playing=true]:border-l-indigo-600"
                     data-selected={$customPlaybackList.has(item.i)} data-playing={currentlyPlayingFinnish===item.entry.finnish}
                     on:click={() => !isPrefetching && handleSelectItem(item.i)}>
                    <div class="entry-header flex items-center justify-between mb-1">
                        <div class="flex items-center gap-2">
                            <input class="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" type="checkbox" checked={$customPlaybackList.has(item.i)} on:click|stopPropagation on:change={() => handleSelectItem(item.i)} disabled={isPrefetching} />
                            <span class="finnish-text text-lg font-medium text-slate-900">{item.entry.finnish}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="icon-btn" title={isMastered($currentLessonIndex, item.i, $masteredMap) ? '已掌握' : '标记掌握'} on:click|stopPropagation={() => { toggleMastered($currentLessonIndex, item.i); if ($customPlaybackList.has(item.i)) { const s = new Set($customPlaybackList); s.delete(item.i); updateSelections(s); } }}>
                                {#if isMastered($currentLessonIndex, item.i, $masteredMap)}<CheckCircle2 size={18} />{:else}<Circle size={18} />{/if}
                            </button>
                            <SpeakerIcon text={item.entry.finnish} lang="fi-FI" />
                        </div>
                    </div>
                    <p class="chinese-text text-slate-600 text-sm m-0">{item.entry.chinese}</p>
                </div>
                {/if}
            {/each}
        </div>
    {:else}
        <p>Loading lesson...</p>
    {/if}
</div>

{#if isPlaying}
  <div class="fixed bottom-0 left-0 right-0 z-40">
    <div class="mx-auto max-w-5xl px-4 pb-4">
      <div class="rounded-xl border border-slate-200 bg-white shadow-md px-4 py-3 flex items-center justify-between">
        <div class="truncate text-sm text-slate-700">
          正在播放：<span class="font-medium text-slate-900 truncate inline-block max-w-[60vw]">{currentlyPlayingFinnish || '...'}</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" on:click={togglePause}>{isPaused ? '继续' : '暂停'}</button>
          <button class="px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500" on:click={stopAllPlayback}>停止</button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if isPlaying && focusMode}
  <div class="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 select-none" on:click={closeFocus}>
    <div class="absolute top-3 right-4">
      <button class="px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50">退出</button>
    </div>
    <div class="text-4xl sm:text-6xl font-bold text-slate-900 text-center leading-snug mb-4 break-words">
      {focusFinnish || currentlyPlayingFinnish || '…'}
    </div>
    <div class="text-xl sm:text-2xl text-slate-600 text-center break-words">
      {focusChinese}
    </div>
  </div>
{/if}

<style>
    .study-view {
        animation: fadeIn 0.5s ease;
    }
    .controls button.playing, .main-fab.active {
        background-color: #e11d48; /* rose-600 for stop state */
        color: white;
    }
    @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
    /* Enlarge and beautify captions shown in PiP */
    :global(.pip-video::cue) {
      font-size: 20px;
      line-height: 1.25;
      color: #fff;
      text-shadow: none;
      white-space: 100%;
      /* padding: 6px 10px; */
      /* border-radius: 8px; */
    }
    .icon-btn { width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #cbd5e1; border-radius:8px; background:#fff; color:#334155 }
    .icon-btn:hover { background:#f1f5f9 }
</style>

