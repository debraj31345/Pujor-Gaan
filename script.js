// --- CLOCK ---
function updateClock() {
    const clockEl = document.getElementById('clock');
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    
    hours = hours % 12;
    hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0' + minutes : minutes;
    
    clockEl.textContent = `${hours}:${minutes} ${ampm}`;
}
setInterval(updateClock, 1000);
updateClock();

// --- CONFIGURATION ---
// IMPORTANT: Change this to your live Render URL before deploying to Vercel!
// Example: const BACKEND_URL = "https://mazdoorplaylist.onrender.com";
const BACKEND_URL = "https://mazdoorplaylist.onrender.com"; 

// --- SOCKET.IO ---
const socket = io(BACKEND_URL);
const listenerCountEl = document.getElementById('listener-count');

socket.on('count', (count) => {
    listenerCountEl.textContent = `${count} listening right now`;
});

socket.on('connect_error', () => {
    listenerCountEl.textContent = "Offline";
});

// Removed rotating captions per user request

// --- MUSIC PLAYER (YOUTUBE API) ---
const PLAYLIST_ID = 'PLE5lMB1jmOCo'; // User's custom playlist

// Load the IFrame Player API code asynchronously to prevent race conditions
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;
let isPlaying = false;
let progressInterval;

function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '1',
        width: '1',
        playerVars: {
            'listType': 'playlist',
            'list': PLAYLIST_ID,
            'playsinline': 1,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'rel': 0
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

const trackTitleEl = document.getElementById('track-title');
const trackArtistEl = document.getElementById('track-artist');
const trackThumbnail = document.getElementById('track-thumbnail');
const playBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const bufferingIcon = document.getElementById('buffering-icon');
const volumeSlider = document.getElementById('volume-slider');
const muteBtn = document.getElementById('mute-btn');
const volIcon = document.getElementById('vol-icon');
const muteIcon = document.getElementById('mute-icon');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');

let isMuted = false;
let previousVolume = 100;

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function updateTrackInfo() {
    if (player && player.getVideoData) {
        const data = player.getVideoData();
        if (data && data.title) {
            trackTitleEl.textContent = data.title;
            trackArtistEl.textContent = data.author || 'YouTube Music';
            
            if (data.video_id) {
                trackThumbnail.src = `https://img.youtube.com/vi/${data.video_id}/hqdefault.jpg`;
                trackThumbnail.style.display = 'block';
            }
        }
    }
}

function onPlayerError(event) {
    console.error("YouTube Player Error:", event.data);
    
    if (event.data === 150 || event.data === 101) {
        trackTitleEl.textContent = "Skipping restricted video...";
        trackArtistEl.textContent = "Please wait";
        if (player && player.nextVideo) {
            setTimeout(() => { player.nextVideo(); }, 1000);
        }
    } else {
        trackTitleEl.textContent = "Error loading playlist";
        trackArtistEl.textContent = "Code: " + event.data;
    }
}

function onPlayerReady(event) {
    trackTitleEl.textContent = "Ready to Play";
    trackArtistEl.textContent = "Hit the play button";
}

let vh1Flags = { first: false, middle: false, end: false };
let currentPlayingVideoId = null;

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        bufferingIcon.classList.remove('active');
        trackThumbnail.classList.add('playing');
        
        updateTrackInfo();
        
        const videoData = player.getVideoData();
        if (videoData && videoData.video_id !== currentPlayingVideoId) {
            currentPlayingVideoId = videoData.video_id;
            vh1Flags = { first: false, middle: false, end: false };
        }
        
        clearInterval(progressInterval);
        progressInterval = setInterval(updateProgressBar, 100);
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        isPlaying = false;
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        trackThumbnail.classList.remove('playing');
        clearInterval(progressInterval);
    } else if (event.data === YT.PlayerState.BUFFERING) {
        bufferingIcon.classList.add('active');
    } else if (event.data === YT.PlayerState.UNSTARTED) {
        updateTrackInfo();
        bufferingIcon.classList.remove('active');
    }
}

function updateProgressBar() {
    if (player && player.getCurrentTime && player.getDuration) {
        const current = player.getCurrentTime();
        const duration = player.getDuration();
        const percentage = current / duration;
        progressBar.style.width = `${percentage * 100}%`;
        
        if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
        if (totalTimeEl && duration > 0) totalTimeEl.textContent = formatTime(duration);
        
        // VH1 Banner Trigger Logic
        if (duration > 0) {
            // First: 2 seconds in
            if (current >= 2 && !vh1Flags.first) {
                vh1Flags.first = true;
                showNextUpVH1();
            }
            // Middle: halfway point
            if (current >= (duration / 2) && !vh1Flags.middle) {
                vh1Flags.middle = true;
                showNextUpVH1();
            }
            // End: 15 seconds before finish (only if song is longer than 30s)
            if (duration > 30 && current >= (duration - 15) && !vh1Flags.end) {
                vh1Flags.end = true;
                showNextUpVH1();
            }
        }
    }
}

async function showNextUpVH1() {
    if (!player || !player.getPlaylist) return;
    const playlist = player.getPlaylist();
    const currentIndex = player.getPlaylistIndex();
    
    if (playlist && playlist.length > 0 && currentIndex !== -1) {
        let nextIndex = currentIndex + 1;
        if (nextIndex >= playlist.length) nextIndex = 0;
        
        const nextVideoId = playlist[nextIndex];
        
        try {
            // Fetch metadata from the backend
            const res = await fetch(`${BACKEND_URL}/api/video-info/${nextVideoId}`);
            if (res.ok) {
                const data = await res.json();
                document.getElementById('vh1-title').textContent = data.title;
                document.getElementById('vh1-thumbnail').src = `https://img.youtube.com/vi/${nextVideoId}/mqdefault.jpg`;
                
                const banner = document.getElementById('vh1-banner');
                banner.classList.add('show');
                
                clearTimeout(vh1Timeout);
                vh1Timeout = setTimeout(() => {
                    banner.classList.remove('show');
                }, 7000);
            }
        } catch (error) {
            console.error("Failed to fetch next video info for VH1 banner", error);
        }
    }
}

function togglePlay() {
    if (!player || !player.getPlayerState) return;
    
    if (isPlaying) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function playNext() {
    if (player && player.nextVideo) {
        player.nextVideo();
    }
}

function playPrev() {
    if (player && player.previousVideo) {
        player.previousVideo();
    }
}

playBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', playNext);
prevBtn.addEventListener('click', playPrev);

progressContainer.addEventListener('click', (e) => {
    if (!player || !player.getDuration) return;
    
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    const duration = player.getDuration();
    if (duration > 0) {
        const seekTime = duration * percentage;
        player.seekTo(seekTime, true);
        progressBar.style.width = `${percentage * 100}%`;
    }
});

volumeSlider.addEventListener('input', (e) => {
    if (player && player.setVolume) {
        player.setVolume(e.target.value);
        if (e.target.value > 0 && isMuted) {
            player.unMute();
            isMuted = false;
            volIcon.style.display = 'block';
            muteIcon.style.display = 'none';
        } else if (e.target.value == 0 && !isMuted) {
            player.mute();
            isMuted = true;
            volIcon.style.display = 'none';
            muteIcon.style.display = 'block';
        }
    }
});

muteBtn.addEventListener('click', () => {
    if (!player || !player.mute) return;
    
    if (isMuted) {
        player.unMute();
        player.setVolume(previousVolume > 0 ? previousVolume : 100);
        volumeSlider.value = previousVolume > 0 ? previousVolume : 100;
        isMuted = false;
        volIcon.style.display = 'block';
        muteIcon.style.display = 'none';
    } else {
        previousVolume = volumeSlider.value;
        player.mute();
        volumeSlider.value = 0;
        isMuted = true;
        volIcon.style.display = 'none';
        muteIcon.style.display = 'block';
    }
});
