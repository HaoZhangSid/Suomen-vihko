<script>
  import { createEventDispatcher } from 'svelte';
  /** @type {'button'|'submit'|'reset'} */
  export let type = 'button';
  export let id = '';
  export let variant = 'primary'; // primary | secondary | success | danger
  export let size = 'md'; // sm | md
  export let disabled = false;
  export let className = '';

  /** @type {Record<string,string>} */
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500',
    secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300 focus-visible:ring-slate-400',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500'
  };

  /** @type {Record<string,string>} */
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-sm',
    md: 'px-3.5 py-2 text-sm'
  };

  const dispatch = createEventDispatcher();
  function handleClick(event){
    if (disabled) { event.preventDefault(); return; }
    dispatch('click', event);
  }
  function handleKeydown(event){ dispatch('keydown', event); }
  function handleFocus(event){ dispatch('focus', event); }
  function handleBlur(event){ dispatch('blur', event); }
</script>

<button
  {id}
  {type}
  class={`rounded-md inline-flex items-center justify-center border border-transparent shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors ${variantClasses[variant] || ''} ${sizeClasses[size] || ''} ${className}`}
  disabled={disabled}
  on:click={handleClick}
  on:keydown={handleKeydown}
  on:focus={handleFocus}
  on:blur={handleBlur}
>
  <slot />
  {#if disabled}
    <span class="sr-only">disabled</span>
  {/if}
</button>

<style>
  .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
</style>

 