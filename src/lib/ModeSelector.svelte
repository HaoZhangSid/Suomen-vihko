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

<div class="flex items-center justify-center gap-2">
    {#each modes as mode}
        <button
            class="px-4 py-2 rounded-full text-sm border transition-colors
                   border-slate-300 text-slate-700 bg-white hover:bg-slate-50
                   data-[active=true]:bg-slate-900 data-[active=true]:text-white data-[active=true]:border-slate-900"
            data-active={mode.id === $currentMode}
            on:click={() => selectMode(mode.id)}
        >
            {mode.name}
        </button>
    {/each}
</div>

<style>
/* no scoped css; Tailwind utilities above */
</style>
