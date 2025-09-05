<script>
  import { getCacheStats, clearCache, getCacheMaxBytesMB, setCacheMaxBytesMB } from './googleTts.js';
  import { onMount } from 'svelte';
  import { Settings } from 'lucide-svelte';

  export let compact = false; // icon-only trigger for mobile

  let open = false;
  let stats = { bytes: 0, items: 0, max: getCacheMaxBytesMB() * 1024 * 1024 };
  let loading = false;
  let cap = getCacheMaxBytesMB();

  function formatBytes(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b/1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b/1024/1024).toFixed(1)} MB`;
    return `${(b/1024/1024/1024).toFixed(2)} GB`;
  }

  async function refresh() {
    try {
      stats = await getCacheStats();
    } catch (e) { stats = { bytes: 0, items: 0, max: cap*1024*1024 }; }
  }

  async function handleOpen() {
    open = true;
    await refresh();
  }

  async function handleClear() {
    if (loading) return;
    loading = true;
    try {
      await clearCache();
      await refresh();
    } finally {
      loading = false;
    }
  }

  function applyCap() {
    setCacheMaxBytesMB(cap);
    refresh();
  }
</script>

{#if compact}
  <button class="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" on:click={handleOpen} aria-label="缓存管理">
    <Settings size={18} />
  </button>
{:else}
  <button class="px-3 py-2 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50" on:click={handleOpen}>
    缓存管理
  </button>
{/if}

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" on:click={() => open=false}>
    <div class="bg-white rounded-xl shadow-lg w-[380px] max-w-[92vw] p-4" on:click|stopPropagation>
      <div class="flex items-center justify-between mb-3">
        <h3 class="m-0 text-lg font-semibold">缓存管理</h3>
        <button class="text-slate-500 hover:text-slate-700" on:click={() => open=false}>✕</button>
      </div>
      <div class="text-sm text-slate-700 space-y-1 mb-3">
        <div>项目数量：<span class="font-medium">{stats.items}</span></div>
        <div>占用空间：<span class="font-medium">{formatBytes(stats.bytes)}</span></div>
        <div>容量上限：<span class="font-medium">{cap} MB</span></div>
      </div>
      <div class="flex items-center gap-2 mb-3">
        <label class="text-sm text-slate-600">设置上限：</label>
        <select class="border border-slate-300 rounded-md px-2 py-1 text-sm" bind:value={cap} on:change={applyCap}>
          <option value="50">50MB</option>
          <option value="80">80MB</option>
          <option value="100">100MB</option>
          <option value="200">200MB</option>
        </select>
      </div>
      <div class="flex gap-2 justify-end">
        <button class="px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" on:click={refresh}>刷新</button>
        <button class="px-3 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60" disabled={loading} on:click={handleClear}>
          {loading ? '清理中…' : '清空缓存'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
</style>
