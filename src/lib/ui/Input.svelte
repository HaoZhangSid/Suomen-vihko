<script>
  export let id = '';
  export let name = '';
  export let type = 'text';
  export let value = '';
  export let placeholder = '';
  export let className = '';
  export let disabled = false;
  export let required = false;
  /** @type {'off'|'on'} */
  export let autocomplete = 'off';
  /** @type {'off'|'none'|'sentences'|'words'|'characters'} */
  export let autocapitalize = 'off';
  /** @type {boolean} */
  export let spellcheck = false;

  function onInput(e){
    value = e.currentTarget.value;
  }
</script>

<input
  {id}
  {name}
  {type}
  class={`w-[10ch] px-2 py-1 rounded-md border outline-none transition-colors ${className}`}
  style="border-color:#CBD5E1; background:#ffffff;"
  on:input={onInput}
  bind:value
  {placeholder}
  {disabled}
  {required}
  {autocomplete}
  {autocapitalize}
  {spellcheck}
  on:focus={(e) => (/** @type {HTMLInputElement} */(e.currentTarget)).style.boxShadow = '0 0 0 3px rgba(99,102,241,0.35)'}
  on:blur={(e) => (/** @type {HTMLInputElement} */(e.currentTarget)).style.boxShadow = 'none'}
>

<style>
  /* Ensure visible border and focus state contrasts against white bg */
  input::placeholder{ color:#94a3b8; }
</style>

 