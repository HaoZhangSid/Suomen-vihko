import { writable, derived } from 'svelte/store';

// --- Web Audio API Integration ---
// Create a single, global AudioContext to be shared across the app.
// It's created on user interaction to comply with browser policies.
let audioContextInstance = null;
export const getAudioContext = () => {
  if (!audioContextInstance) {
    const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    audioContextInstance = new AC();
  }
  return audioContextInstance;
};
// --- End Web Audio API Integration ---

// --- CORE STORES ---
// Stores the list of all lessons (the manifest)
export const lessons = writable([]); 
// Stores the index of the currently selected lesson
export const currentLessonIndex = writable(getLocalStorage('currentLessonIndex', 0)); 
// Stores the current active mode ('study', 'test', 'practice')
export const currentMode = writable('study');
// Stores the fully loaded data for the currently selected lesson
export const currentLessonData = writable(null); // Keep it simple, populate in loadLessonData
// Stores the user-defined playback rate for Finnish audio
export const finnishRate = writable(0.8);
// Stores whether the spelling-out audio mode is enabled
export const enableSpellingMode = writable(false);
// Stores the pause duration in ms between spelled-out letters
export const spellingPause = writable(getLocalStorage('spellingPause', 150));

// --- New Stores for Custom Playback ---

// Helper for migration and loading initial selections
function loadInitialSelections() {
    const selectionsStr = getLocalStorage('customPlaybackSelections', '{}');
    /** @type {Record<string, number[]>} */
    let selections = {};
    try {
        const parsed = JSON.parse(selectionsStr);
        if (parsed && typeof parsed === 'object') {
            selections = parsed;
        }
    } catch {
        selections = {};
    }

    // --- Graceful Migration from old format ---
    const oldListStr = localStorage.getItem('customPlaybackList');
    if (oldListStr) {
        try {
            const oldList = JSON.parse(oldListStr);
            // Ensure it's a non-empty array before migrating
            if (Array.isArray(oldList) && oldList.length > 0) {
                // Migrate to lesson 0's selection, only if not already set
                if (!selections['0']) {
                    selections['0'] = oldList;
                }
            }
        } catch(e) {
            console.error("Error migrating old custom playback list", e);
        }
        // Clean up the old key after checking it
        localStorage.removeItem('customPlaybackList');
    }
    
    return selections;
}

// Base store: holds selection objects for ALL lessons. e.g., { "0": [1, 5], "1": [2, 3] }
export const allCustomSelections = writable(loadInitialSelections());

// Derived store: automatically provides the selection SET for the CURRENT lesson.
// This is what UI components will primarily read from.
export const customPlaybackList = derived(
    [allCustomSelections, currentLessonIndex],
    ([$allCustomSelections, $currentLessonIndex]) => {
        const currentList = $allCustomSelections[$currentLessonIndex] || [];
        return new Set(currentList);
    }
);

export const finnishPlaybackReps = writable(getLocalStorage('finnishPlaybackReps', 1));
export const chinesePlaybackReps = writable(getLocalStorage('chinesePlaybackReps', 1));
// --- End New Stores ---


// --- ASYNCHRONOUS ACTIONS ---

/**
 * Fetches the manifest of all lessons.
 * Should be called once when the application starts.
 */
export async function fetchLessonsManifest() {
    try {
        const response = await fetch('lessons.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const manifest = await response.json();
        lessons.set(manifest);
        // After fetching the manifest, load the very first lesson
        if (manifest.length > 0) {
            await loadLessonData(0);
        }
    } catch (error) {
        console.error("Could not fetch lessons.json:", error);
        lessons.set([]);
    }
}

/**
 * Loads the data for a specific lesson by its index in the manifest.
 * It fetches the corresponding JSON file and updates the currentLessonData store.
 * @param {number} index - The index of the lesson to load.
 */
export async function loadLessonData(index) {
    try {
        const manifestArr = get(lessons) || [];
        const lessonInfo = manifestArr[index];
        if (!lessonInfo) {
            console.error(`Lesson with index ${index} not found in manifest.`);
            return;
        }
        const response = await fetch(lessonInfo.path);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        currentLessonData.set(data);
        currentLessonIndex.set(index); // Update the index *after* successful load
    } catch (error) {
        console.error("Failed to load lesson data:", error);
        currentLessonData.set(null); // Clear data on error
    }
}

// A little helper function to get a store's value without subscribing
function get(store) {
    let value;
    store.subscribe(v => value = v)();
    return value;
}

// Function to get from local storage
function getLocalStorage(key, defaultValue) {
    const storedValue = localStorage.getItem(key);
    if (storedValue !== null) {
        if (key === 'currentLessonIndex' || key === 'finnishRate' || key === 'spellingPause' || key === 'finnishPlaybackReps' || key === 'chinesePlaybackReps') {
            return Number(storedValue);
        }
        if (key === 'enableSpellingMode') {
            return storedValue === 'true';
        }
        return storedValue;
    }
    return defaultValue;
}

// Function to set to local storage
function setLocalStorage(key, value) {
    localStorage.setItem(key, value);
}

// Subscribe to stores and update local storage
currentLessonIndex.subscribe(value => setLocalStorage('currentLessonIndex', value));
currentMode.subscribe(value => setLocalStorage('currentMode', value));
finnishRate.subscribe(value => setLocalStorage('finnishRate', value));
enableSpellingMode.subscribe(value => setLocalStorage('enableSpellingMode', value));
spellingPause.subscribe(value => setLocalStorage('spellingPause', value));

// --- New Subscriptions for Custom Playback ---
allCustomSelections.subscribe(value => setLocalStorage('customPlaybackSelections', JSON.stringify(value)));
finnishPlaybackReps.subscribe(value => setLocalStorage('finnishPlaybackReps', value));
chinesePlaybackReps.subscribe(value => setLocalStorage('chinesePlaybackReps', value));
// --- End New Subscriptions ---
