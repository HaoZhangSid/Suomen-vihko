<script>
  import { onMount } from 'svelte';
  import { currentMode } from '../store.js';
  import { fetchCatalog, generatePrice, priceToFinnishWords, priceToNumeric, generatePriceExpressions, validateExpression } from './pricing.js';
  import Input from './ui/Input.svelte';
  import Button from './ui/Button.svelte';
  import TokenSlots from './TokenSlots.svelte';
  import TokenBank from './TokenBank.svelte';

  let catalog = null;
  let currentItem = null; // { item, euros, cents }
  let answer = '';
  let feedback = '';
  let guidance = [];
  let accepted = [];
  let templates = [];
  let activeIdx = 0;
  let fields = [];
  let wordTargets = [];
  let wordFields = [];
  let wordIsFixed = [];
  let bankTokens = [];
  let bankDisabled = [];

  async function initRound(){
    if (!catalog) return;
    const idx = Math.floor(Math.random() * catalog.items.length);
    const item = catalog.items[idx];
    const { euros, cents } = generatePrice(catalog, item);
    currentItem = { item, euros, cents };
    answer = '';
    feedback = '';
    const { variants, guidance: g } = generatePriceExpressions(euros, cents);
    guidance = g;
    templates = g.map(toTemplateParts);
    activeIdx = 0;
    fields = new Array(getBlanksCount(templates[activeIdx] || null)).fill('');
    accepted = variants;

    // build word-by-word targets from canonical phrase
    const canonical = priceToFinnishWords(euros, cents);
    const FIXED_WORDS = new Set(['euro', 'euroa', 'sentti', 'senttiä', 'ja']);
    wordTargets = canonical.split(/\s+/g).filter(Boolean);
    wordIsFixed = wordTargets.map(t => FIXED_WORDS.has(t));
    const blanks = wordIsFixed.reduce((acc, f) => acc + (f ? 0 : 1), 0);
    wordFields = new Array(blanks).fill('');

    // build token bank: correct tokens + distractors
    const correctTokens = wordTargets.filter((_,i)=>!wordIsFixed[i]);
    const distractors = buildDistractors(correctTokens);
    bankTokens = shuffle([...correctTokens, ...distractors]);
    bankDisabled = new Array(bankTokens.length).fill(false);
  }

  function revealExamples(){
    if (!currentItem) return;
    const { euros, cents } = currentItem;
    const numeric = priceToNumeric(euros, cents);
    const words = priceToFinnishWords(euros, cents);
    feedback = `${numeric}\n${words}`;
  }

  function buildFromActiveTemplate(){
    const t = templates[activeIdx];
    if (!t) return '';
    const blanks = getBlanksCount(t);
    if (blanks === 0) return t.parts.join('');
    const filled = [];
    for (let i = 0; i < blanks; i++) {
      filled.push((fields[i] || '').trim());
    }
    let out = '';
    for (let i = 0; i < t.parts.length; i++) {
      out += t.parts[i];
      if (i < filled.length) out += filled[i];
    }
    return out;
  }

  async function submit(){
    if (!currentItem) return;
    // Build candidate from word-by-word inputs mixed with fixed tokens
    let idx = 0;
    const outTokens = [];
    for (let i = 0; i < wordTargets.length; i++) {
      if (wordIsFixed[i]) outTokens.push(wordTargets[i]);
      else outTokens.push((wordFields[idx++] || '').trim());
    }
    const wordCandidate = outTokens.some(s => s && s.length) ? outTokens.join(' ') : '';
    const candidate = wordCandidate || buildFromActiveTemplate() || answer;
    const ok = validateExpression(candidate, accepted || []);
    if (ok) {
      feedback = '✅ 正确！';
    } else {
      const { euros, cents } = currentItem;
      feedback = '❌ 再试试。\n' + priceToNumeric(euros, cents) + '\n' + priceToFinnishWords(euros, cents);
    }
  }

  function switchTemplate(dir=1){
    if (templates.length === 0) return;
    activeIdx = (activeIdx + dir + templates.length) % templates.length;
    fields = new Array(getBlanksCount(templates[activeIdx])).fill('');
    feedback = '';
  }

  function fillStaticAndCheck(){
    const t = templates[activeIdx];
    if (!t) return;
    if (getBlanksCount(t) === 0) {
      answer = t.parts.join('');
      submit();
    }
  }

  function toTemplateParts(pattern){
    // pattern like "__ euro(a) ja __ sentti(ä)" → split by __
    if (!pattern) return { parts: [''] };
    const raw = String(pattern).split('__');
    return { parts: raw };
  }

  function getBlanksCount(t){
    if (!t || !t.parts) return 0;
    // blanks count equals parts.length - 1
    return Math.max(0, t.parts.length - 1);
  }

  function variableIndex(wordIndex){
    // Map word index in tokens to index in wordFields (skipping fixed tokens)
    let idx = 0;
    for (let i = 0; i < wordIndex; i++) {
      if (!wordIsFixed[i]) idx++;
    }
    return idx;
  }

  function onPickToken(e){
    const { token, index } = e.detail || {};
    const emptyIdx = wordFields.findIndex(v => !v || v.trim()==='');
    if (emptyIdx === -1) return;
    wordFields[emptyIdx] = token;
    bankDisabled[index] = true;
  }

  function clearAll(){
    for (let i=0;i<wordFields.length;i++) wordFields[i] = '';
    bankDisabled = bankDisabled.map(()=>false);
  }

  function buildDistractors(correct){
    const out = [];
    for (const t of correct){
      // simple noisy variants
      if (t.endsWith('kymmentä')) out.push(t.replace('kymmentä','kymmenen'));
      if (t==='euro') out.push('euroa');
      if (t==='euroa') out.push('euro');
      if (t==='sentti') out.push('senttiä');
      if (t==='senttiä') out.push('sentti');
    }
    out.push('ja'); // common confusion
    return Array.from(new Set(out)).filter(x=>!correct.includes(x)).slice(0,6);
  }

  function shuffle(arr){
    const a = [...arr];
    for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  onMount(async () => {
    try {
      catalog = await fetchCatalog();
      await initRound();
    } catch (e) {
      console.error(e);
    }
  });
</script>

<div class="flex flex-col gap-3">
  <div class="flex items-center justify-between">
    <h2 class="m-0 text-lg font-semibold">Kassaharjoitus (MVP)</h2>
    <small class="text-slate-500">模式：{$currentMode}</small>
  </div>

  {#if currentItem}
    <div class="rounded-xl border border-slate-200 p-3 bg-slate-50">
      <div class="text-sm text-slate-600">Tuote</div>
      <div class="text-xl">{currentItem.item.nameFi}</div>
      <div class="mt-2 text-sm text-slate-600">Skannattu hinta</div>
      <div class="text-2xl font-semibold">{priceToNumeric(currentItem.euros, currentItem.cents)}</div>
    </div>

    <div class="rounded-xl border border-slate-200 p-3">
      <label class="block text-sm text-slate-600" for="token-bank-first">点击拼句</label>
      <div class="mt-2 overflow-x-auto">
        <TokenSlots targetTokens={wordTargets} fixedMask={wordIsFixed} selected={wordFields} />
      </div>
      <div class="mt-3">
        <TokenBank tokens={bankTokens} disabledMask={bankDisabled} on:pick={onPickToken} firstId="token-bank-first" />
      </div>
      <div class="mt-2 flex gap-2">
        <Button on:click={submit}>检查</Button>
        <Button variant="secondary" on:click={clearAll}>清空</Button>
        <Button variant="secondary" on:click={revealExamples}>提示</Button>
        <Button variant="success" on:click={initRound}>下一题</Button>
      </div>

      {#if feedback}
        <pre class="mt-3 p-2 bg-slate-100 rounded-md overflow-auto">{feedback}</pre>
      {/if}
    </div>
  {:else}
    <p class="text-slate-600">Loading pricing catalog…</p>
  {/if}
</div>

<style>
  /* Tailwind utilities used; keep component styles minimal */
  pre { white-space: pre-wrap; }
  /* legacy chip styles removed */
</style>


