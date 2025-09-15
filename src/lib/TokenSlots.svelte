<script>
  import Button from './ui/Button.svelte';
  import { createEventDispatcher } from 'svelte';
  export let targetTokens = []; // array of strings representing desired sequence
  export let fixedMask = [];    // same length; true means fixed token
  export let selected = [];     // user-selected tokens for variable positions
  const dispatch = createEventDispatcher();

  // derive slots: interleave fixed tokens with blanks for variables
  $: total = targetTokens.length;
  $: variableIndexes = [];
  $: (() => { variableIndexes = []; for (let i=0;i<total;i++) if (!fixedMask[i]) variableIndexes.push(i); })();

  function removeAt(varIdx){
    const copy = [...selected];
    copy[varIdx] = '';
    selected = copy;
    dispatch('remove', { varIdx });
  }
</script>

<div class="slots">
  {#each targetTokens as tok, i}
    {#if fixedMask[i]}
      <span class="chip fixed">{tok}</span>
    {:else}
      {#if selected[variableIndexes.indexOf(i)]}
        <span class="chip filled">
          {selected[variableIndexes.indexOf(i)]}
          <button class="x" on:click={() => removeAt(variableIndexes.indexOf(i))}>×</button>
        </span>
      {:else}
        <span class="blank">&nbsp;</span>
      {/if}
    {/if}
  {/each}
  <slot />
  </div>

<style>
  .slots{ display:flex; flex-wrap:nowrap; gap:0.25rem; overflow-x:auto; padding-bottom:0.25rem; }
  .chip{ display:inline-flex; align-items:center; padding:0.35rem 0.5rem; border-radius:0.5rem; background:#e2e8f0; color:#0f172a; white-space:nowrap; }
  .chip.fixed{ background:#e2e8f0; }
  .chip.filled{ background:#c7d2fe; }
  .x{ margin-left:0.25rem; background:transparent; border:none; cursor:pointer; color:#334155; }
  .blank{ min-width:10ch; height:2.25rem; border-radius:0.5rem; border:1px dashed #94a3b8; background:#ffffff; display:inline-block; }
</style>


