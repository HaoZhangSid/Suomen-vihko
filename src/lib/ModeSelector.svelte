<script>
    import { currentMode } from '../store.js';

    const modes = [
        { id: 'study', name: '学习模式' },
        { id: 'test', name: '默写模式' },
        { id: 'practice', name: '练习模式' }
    ];

    function selectMode(modeId) {
        currentMode.set(modeId);
    }
</script>

<div class="mode-selector">
    {#each modes as mode}
        <button
            class="mode-btn"
            class:active={mode.id === $currentMode}
            on:click={() => selectMode(mode.id)}
        >
            {mode.name}
        </button>
    {/each}
</div>

<style>
    .mode-selector {
        display: flex;
        justify-content: center;
        gap: 15px;
        margin-bottom: 25px;
    }

    .mode-btn {
        padding: 10px 20px;
        border: none;
        background-color: #e0e0e0;
        color: #555;
        cursor: pointer;
        border-radius: 25px;
        font-size: 0.95em;
        font-weight: 500;
        transition: all 0.2s ease-in-out;
    }

    .mode-btn:hover {
        background-color: #d0d0d0;
    }

    .mode-btn.active {
        background-color: #2c3e50;
        color: white;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        transform: translateY(-2px);
    }
</style>
