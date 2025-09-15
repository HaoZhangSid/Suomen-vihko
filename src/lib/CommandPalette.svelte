<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { lessons, currentLessonIndex, loadLessonData } from '../store.js';

  export let open = false;
  const dispatch = createEventDispatcher();
  let query = '';
  let inputEl;
  let highlighted = 0;

  function close(){ open = false; dispatch('close'); }
  function normalize(str){ return (str||'').toLowerCase(); }

  $: items = ($lessons || []).map((l, i) => ({
    index: i,
    label: `Day ${i+1} · ${l.day || ''}`,
    haystack: normalize(`${i+1} ${l.day || ''}`)
  }));

  $: results = query
    ? items.filter(it => it.haystack.includes(normalize(query))).slice(0, 200)
    : items.slice(0, 200);

  function select(idx){
    const it = results[idx];
    if (!it) return;
    if (it.index === $currentLessonIndex) { close(); return; }
    loadLessonData(it.index);
    close();
  }

  function handleKey(e){
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); highlighted = Math.min(results.length-1, highlighted+1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlighted = Math.max(0, highlighted-1); }
    else if (e.key === 'Enter') { e.preventDefault(); select(highlighted); }
  }

  onMount(()=>{ document.addEventListener('keydown', handleKey); });
  onDestroy(()=>{ document.removeEventListener('keydown', handleKey); });

  $: if (open) {
    // reset & focus when opened
    query = '';
    highlighted = 0;
    setTimeout(()=>{ try{ inputEl && inputEl.focus(); } catch(_){} }, 0);
  }
</script>

{#if open}
  <div class="fixed inset-0 z-[60] bg-black/40" on:click={close}></div>
  <div class="fixed inset-x-2 top-10 z-[61] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[680px]">
    <div class="rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
      <div class="p-3 border-b border-slate-200 flex items-center gap-2">
        <input bind:this={inputEl} bind:value={query} placeholder="搜索 Day/日期/关键字… (Ctrl/⌘+K)" class="w-full outline-none text-base px-2 py-1.5" />
        <button class="text-slate-500 text-sm px-2 py-1 hover:text-slate-700" on:click={close}>关闭</button>
      </div>
      <div class="max-h-[60vh] overflow-auto">
        {#if results.length === 0}
          <div class="px-4 py-8 text-center text-slate-500">没有匹配结果</div>
        {:else}
          <ul class="m-0 p-0 list-none">
            {#each results as it, i}
              <li class="border-b border-slate-100 last:border-0">
                <button class="w-full text-left px-4 py-2.5 hover:bg-indigo-50 data-[active=true]:bg-indigo-600 data-[active=true]:text-white transition"
                        data-active={i===highlighted}
                        on:mouseenter={() => highlighted = i}
                        on:click={() => select(i)}>
                  {it.label}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* minimal styles; Tailwind utilities used */
  :global(body.command-open){ overflow:hidden; }
</style>


