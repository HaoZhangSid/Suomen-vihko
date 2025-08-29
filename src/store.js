import { writable, derived } from 'svelte/store';

// --- CORE STORES ---
// Stores the list of all lessons (the manifest)
export const lessons = writable([]); 
// Stores the index of the currently selected lesson
export const currentLessonIndex = writable(0); 
// Stores the current active mode ('study', 'test', 'practice')
export const currentMode = writable('study');
// Stores the fully loaded data for the currently selected lesson
export const currentLessonData = writable(null);


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
    const $lessons = get(lessons); // Helper to get store value once
    if (!$lessons[index]) {
        console.error(`Lesson with index ${index} not found in manifest.`);
        currentLessonData.set(null);
        return;
    }

    const lessonPath = $lessons[index].path;
    try {
        const response = await fetch(lessonPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        currentLessonData.set(data);
        currentLessonIndex.set(index); // Update the index *after* successful load
    } catch (error) {
        console.error(`Could not fetch ${lessonPath}:`, error);
        currentLessonData.set(null); // Set to null on error
    }
}

// A little helper function to get a store's value without subscribing
function get(store) {
    let value;
    store.subscribe(v => value = v)();
    return value;
}
