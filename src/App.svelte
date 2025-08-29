<script>
  import { onMount } from 'svelte';
  import { lessons, currentLessonData, fetchLessonsManifest, currentMode } from './store.js';
  import DayNav from './lib/DayNav.svelte';
  import ModeSelector from './lib/ModeSelector.svelte';
  import StudyView from './lib/StudyView.svelte';
  import PracticeView from './lib/PracticeView.svelte';

  onMount(() => {
    fetchLessonsManifest();
  });
</script>

<header>
  <h1>Suomen Oppiminen</h1>
  <p>芬兰语学习笔记</p>
</header>

<main>
  {#if $lessons.length > 0}
    <DayNav />
    <ModeSelector />
    
    <div class="content-area">
      {#if $currentLessonData}
         {#if $currentMode === 'study'}
            <StudyView />
         {:else}
            <PracticeView />
         {/if}
      {:else}
        <p>Loading day's content...</p>
      {/if}
    </div>
  {:else}
    <p>Loading lesson manifest...</p>
  {/if}
</main>

<footer>
  <p>Opetellaan suomea yhdessä!</p>
</footer>

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    margin: 0;
    background-color: #f4f4f4;
    color: #333;
  }

  header {
    background-color: #2c3e50;
    color: white;
    padding: 1rem 2rem;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  header h1 {
    margin: 0;
    font-size: 2rem;
  }

  header p {
    margin: 0.5rem 0 0;
    font-style: italic;
  }

  main {
    max-width: 800px;
    margin: 2rem auto;
    padding: 1rem;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  footer {
    text-align: center;
    margin-top: 2rem;
    padding: 1rem;
    color: #777;
  }
</style>
