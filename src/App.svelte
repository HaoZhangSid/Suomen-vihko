<script>
  import { onMount } from 'svelte';
  import { lessons, currentLessonData, fetchLessonsManifest, currentMode } from './store.js';
  import DayNav from './lib/DayNav.svelte';
  import ModeSelector from './lib/ModeSelector.svelte';
  import StudyView from './lib/StudyView.svelte';
  import PracticeView from './lib/PracticeView.svelte';
  import VConsole from 'vconsole';
  import CacheSettings from './lib/CacheSettings.svelte';

  onMount(async () => {
    new VConsole();
    console.log('vConsole force-loaded for debugging.');

    if ($lessons.length === 0) {
      await fetchLessonsManifest();
    }

    if (navigator.storage && navigator.storage.persist) {
      try {
        const persisted = await navigator.storage.persist();
        console.log('Storage persist requested:', persisted);
      } catch {}
    }
  });
</script>

<!-- Top Bar -->
<header class="w-full bg-slate-900 text-white">
  <div class="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
    <div class="flex items-center gap-3 min-w-0">
      <h1 class="m-0 text-xl sm:text-2xl font-semibold">Suomen Oppiminen</h1>
      <p class="hidden sm:block m-0 mt-1 text-slate-300 text-sm">芬兰语学习笔记</p>
    </div>
    <div class="sm:hidden">
      <CacheSettings compact={true} />
    </div>
  </div>
</header>

<main class="max-w-5xl mx-auto px-2 sm:px-4 py-3 sm:py-6">
  {#if $lessons.length > 0}
    <section class="sticky top-0 z-10 bg-white rounded-md border border-slate-200 p-2 sm:p-3 mb-3 sm:mb-4">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <DayNav />
          <div class="mt-2 sm:mt-3">
            <ModeSelector />
          </div>
        </div>
        <div class="shrink-0 hidden sm:block">
          <CacheSettings />
        </div>
      </div>
    </section>

    <section class="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-6">
      {#if $currentLessonData}
         {#if $currentMode === 'study'}
            <StudyView />
         {:else}
            <PracticeView />
         {/if}
      {:else}
        <p class="text-slate-700">Loading day's content...</p>
      {/if}
    </section>
  {:else}
    <p class="text-slate-700">Loading lesson manifest...</p>
  {/if}
</main>

<footer class="max-w-5xl mx-auto px-4 py-8 text-center text-slate-500">
  <p class="m-0">Opetellaan suomea yhdessä!</p>
</footer>

<style>
  :global(html) { color-scheme: light; }
  :global(body) {
    margin: 0;
    background-color: #f8fafc; /* slate-50 */
    color: #0f172a; /* slate-900 */
  }
  :global(.btn-primary){ background-color:#4f46e5;}
</style>
