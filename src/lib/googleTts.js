import { getAudioContext } from '../store.js';

const apiKey = import.meta.env.VITE_GOOGLE_TTS_API_KEY;
const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

const audioCache = new Map();
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// --- IndexedDB helpers ---
const DB_NAME = 'suomen-audio-cache';
const DB_VERSION = 1;
const STORE = 'audio';
const DEFAULT_MAX_MB = 80;
let MAX_BYTES = (Number(localStorage.getItem('audio_cache_max_mb')) || DEFAULT_MAX_MB) * 1024 * 1024;

export function setCacheMaxBytesMB(mb) {
  const v = Number(mb) || DEFAULT_MAX_MB;
  MAX_BYTES = v * 1024 * 1024;
  try { localStorage.setItem('audio_cache_max_mb', String(v)); } catch {}
}
export function getCacheMaxBytesMB() {
  return Math.round(MAX_BYTES / 1024 / 1024);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('t', 't');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function estimateBytes(base64) {
  return Math.ceil((base64.length * 3) / 4);
}

async function getFromDbRaw(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const st = tx.objectStore(STORE);
    const req = st.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function getFromDb(key) {
  const db = await openDb();
  const row = await getFromDbRaw(db, key);
  if (row) {
    // touch timestamp (LRU)
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const st = tx.objectStore(STORE);
        st.put({ key, base64: row.base64, t: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch {}
  }
  return row;
}

async function setToDb(key, base64) {
  const db = await openDb();
  await evictIfNeeded(db, estimateBytes(base64));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const st = tx.objectStore(STORE);
    const now = Date.now();
    st.put({ key, base64, t: now });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function getUsage(db) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let items = 0;
    const tx = db.transaction(STORE, 'readonly');
    const st = tx.objectStore(STORE);
    const req = st.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) {
        items++;
        bytes += estimateBytes(cur.value.base64 || '');
        cur.continue();
      } else {
        resolve({ bytes, items });
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function evictIfNeeded(db, incomingBytes = 0) {
  const { bytes } = await getUsage(db);
  if (bytes + incomingBytes <= MAX_BYTES) return;
  const need = bytes + incomingBytes - MAX_BYTES;
  let freed = 0;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const st = tx.objectStore(STORE);
    const idx = st.index('t');
    const req = idx.openCursor(); // ascending by timestamp
    req.onsuccess = () => {
      const cur = req.result;
      if (cur && freed < need) {
        const size = estimateBytes(cur.value.base64 || '');
        freed += size;
        st.delete(cur.primaryKey);
        cur.continue();
      } else {
        resolve(true);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getCacheStats() {
  const db = await openDb();
  const s = await getUsage(db);
  return { ...s, max: MAX_BYTES };
}

export async function clearCache() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
// --- end IndexedDB helpers ---

/**
 * Fetches audio from Google TTS API or serves from cache.
 * @param {string} text - The text to synthesize.
 * @param {string} lang - The language code.
 * @param {number} rate - The speaking rate.
 * @returns {Promise<string>} - base64 audio
 */
async function getAudio(text, lang = 'fi-FI', rate = 1.0) {
    if (!apiKey) {
        throw new Error("API key is not set in environment variables.");
    }
    
    const cacheKey = `${lang}:${rate}:${text}`;
    if (audioCache.has(cacheKey)) {
        return audioCache.get(cacheKey);
    }

    const cached = await getFromDb(cacheKey);
    if (cached && cached.base64) {
        audioCache.set(cacheKey, cached.base64);
        return cached.base64;
    }
    
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    const body = JSON.stringify({
        input: { text: text },
        voice: { 
            languageCode: lang, 
            name: lang === 'fi-FI' ? 'fi-FI-Wavenet-A' : 'cmn-CN-Wavenet-A' 
        },
        audioConfig: { 
            audioEncoding: 'MP3', 
            speakingRate: rate 
        }
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body
    });

    if (!response.ok) {
        console.error("Google TTS API error response:", await response.text());
        throw new Error(`Google TTS API error: ${response.statusText}`);
    }

    const data = await response.json();
    const base64 = data.audioContent;
    audioCache.set(cacheKey, base64);
    try { await setToDb(cacheKey, base64); } catch {}
    return base64;
}

export function playGoogleTTS(audioBuffer, onEndCallback) {
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.onended = onEndCallback;
    source.start(0);
    return source;
}

export async function fetchAndDecode(text, lang, rate) {
    try {
        const audioContent = await getAudio(text, lang, rate);
        const audioContext = getAudioContext();
        
        const binaryString = window.atob(audioContent);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        return audioBuffer;

    } catch (error) {
        console.error("Failed to fetch and decode TTS audio:", error);
        throw error; // Re-throw the error to be handled by the caller
    }
}

export async function fetchAsObjectUrl(text, lang, rate) {
    const base64 = await getAudio(text, lang, rate);
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
}

export async function fetchAsObjectUrlCached(text, lang, rate) {
    return fetchAsObjectUrl(text, lang, rate);
}
