<script>
  import Button from './ui/Button.svelte';
  import { createEventDispatcher } from 'svelte';
  export let tokens = [];
  export let disabledMask = [];
  export let firstId = '';
  const dispatch = createEventDispatcher();
  function pick(t, idx){
    if (disabledMask?.[idx]) return;
    dispatch('pick', { token: t, index: idx });
  }
</script>

<div class="bank">
  {#each tokens as t, i}
    <button class="tok" id={i===0 ? firstId : undefined} disabled={disabledMask?.[i]} on:click={() => pick(t, i)}>{t}</button>
  {/each}
</div>

<style>
  .bank{ display:flex; flex-wrap:wrap; gap:0.5rem; }
  .tok{ padding:0.5rem 0.75rem; border-radius:0.5rem; background:#f1f5f9; border:1px solid #cbd5e1; cursor:pointer; white-space:nowrap; }
  .tok[disabled]{ opacity:0.5; cursor:not-allowed; }
</style>


