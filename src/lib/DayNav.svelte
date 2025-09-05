<script>
    import { lessons, currentLessonIndex, loadLessonData } from '../store.js';

    function selectDay(index) {
        if (index === $currentLessonIndex) return;
        loadLessonData(index);
    }
</script>

<nav class="flex items-center gap-2 overflow-x-auto pb-2">
    {#if $lessons.length > 0}
        {#each $lessons as lesson, index}
            <button
                class="shrink-0 px-3 py-1.5 rounded-full border text-sm transition-colors
                       border-slate-300 text-slate-700 bg-white hover:bg-slate-50
                       data-[active=true]:bg-slate-900 data-[active=true]:text-white data-[active=true]:border-slate-900"
                data-active={index === $currentLessonIndex}
                on:click={() => selectDay(index)}
            >
                Day {index + 1}
            </button>
        {/each}
    {/if}
</nav>

<style>
  /* no scoped css; Tailwind utilities above */
</style>
