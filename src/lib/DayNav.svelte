<script>
    import { lessons, currentLessonIndex, loadLessonData } from '../store.js';

    function selectDay(index) {
        // Don't reload if the same day is clicked
        if (index === $currentLessonIndex) return;
        loadLessonData(index);
    }
</script>

<nav class="days-nav">
    {#if $lessons.length > 0}
        {#each $lessons as lesson, index}
            <button
                class="day-btn"
                class:active={index === $currentLessonIndex}
                on:click={() => selectDay(index)}
            >
                Day {index + 1}
            </button>
        {/each}
    {/if}
</nav>

<style>
    .days-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 20px;
        padding-bottom: 20px;
        border-bottom: 1px solid #eee;
    }

    .day-btn {
        padding: 8px 15px;
        border: 1px solid #ccc;
        background-color: #fff;
        color: #337ab7;
        cursor: pointer;
        border-radius: 20px;
        transition: all 0.2s ease;
    }

    .day-btn:hover {
        background-color: #f0f0f0;
        border-color: #aaa;
    }

    .day-btn.active {
        background-color: #337ab7;
        color: white;
        border-color: #337ab7;
        font-weight: bold;
    }
</style>
