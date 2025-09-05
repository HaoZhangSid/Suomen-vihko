// src/lib/mediaSession.js

// A central place to manage the Media Session API for a better mobile experience.

export function updateMediaSession(metadata, actionHandlers) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata(metadata);

        if (actionHandlers.play) {
            navigator.mediaSession.setActionHandler('play', actionHandlers.play);
        }
        if (actionHandlers.pause) {
            navigator.mediaSession.setActionHandler('pause', actionHandlers.pause);
        }
    }
}

export function clearMediaSession() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
    }
}
