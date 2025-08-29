<script>
    export let text;
    export let lang = 'fi-FI';

    const synth = window.speechSynthesis;

    function speak() {
        // This is a simplified approach. For a more robust solution,
        // a shared store would be used to manage the global isPlayingAll state.
        // However, cancelling any ongoing speech before starting a new one
        // effectively prevents overlap.
        if (synth.speaking) {
            synth.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        synth.speak(utterance);
    }

    function handleKeyPress(event) {
        if (event.key === 'Enter') {
            speak();
        }
    }

    // A simple way to check a global 'isPlaying' state if needed, but for now direct call is fine.
    // Ideally, this would use a store to check global playback state.
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
