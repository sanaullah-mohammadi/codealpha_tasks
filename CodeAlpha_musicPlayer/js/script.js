/**
 * Harmony Music Player — script.js
 * Supports loading local files via file-picker or drag & drop.
 * Uses jsmediatags to read ID3 tags (title, artist, embedded cover art).
 */

// ─── Track store ─────────────────────────────────────────────────────────────
// Each entry: { title, artist, src (object URL), cover (data-URL or null), file }
let tracks = [];

// ─── DOM ─────────────────────────────────────────────────────────────────────
const audio           = document.getElementById("audioPlayer");
const playPauseBtn    = document.getElementById("playPauseBtn");
const playIcon        = document.getElementById("playIcon");
const prevBtn         = document.getElementById("prevBtn");
const nextBtn         = document.getElementById("nextBtn");
const shuffleBtn      = document.getElementById("shuffleBtn");
const repeatBtn       = document.getElementById("repeatBtn");
const progressTrack   = document.getElementById("progressTrack");
const progressFill    = document.getElementById("progressFill");
const progressThumb   = document.getElementById("progressThumb");
const currentTimeEl   = document.getElementById("currentTime");
const totalDurationEl = document.getElementById("totalDuration");
const volumeSlider    = document.getElementById("volumeSlider");
const volumeIcon      = document.getElementById("volumeIcon");
const volumeLabel     = document.getElementById("volumeLabel");
const muteBtn         = document.getElementById("muteBtn");
const autoplayToggle  = document.getElementById("autoplayToggle");
const albumDisc       = document.getElementById("albumArt");
const discImg         = document.getElementById("discImg");
const discPlaceholder = document.getElementById("discPlaceholder");
const albumGlow       = document.getElementById("albumGlow");
const rings           = document.querySelectorAll(".ring");
const songTitleEl     = document.getElementById("songTitle");
const songArtistEl    = document.getElementById("songArtistText");
const playlistEl      = document.getElementById("playlist");
const trackCountEl    = document.getElementById("trackCount");
const waveViz         = document.getElementById("waveViz");
const fileInput       = document.getElementById("fileInput");
const folderInput     = document.getElementById("folderInput");
const addMusicBtn     = document.getElementById("addMusicBtn");
const addFolderBtn    = document.getElementById("addFolderBtn");
const dropZone        = document.getElementById("dropZone");
const playlistPanel   = document.getElementById("playlistPanel");
// dot menu
const dotMenuBtn      = document.getElementById("dotMenuBtn");
const dotDropdown     = document.getElementById("dotDropdown");
const ddAddMusic      = document.getElementById("ddAddMusic");
const ddAddFolder     = document.getElementById("ddAddFolder");
const ddEqualizer     = document.getElementById("ddEqualizer");
const ddClearAll      = document.getElementById("ddClearAll");
// equalizer
const eqPanel         = document.getElementById("eqPanel");
const eqCloseBtn      = document.getElementById("eqCloseBtn");
const eqBass          = document.getElementById("eqBass");
const eqMid           = document.getElementById("eqMid");
const eqTreble        = document.getElementById("eqTreble");
const eqBassVal       = document.getElementById("eqBassVal");
const eqMidVal        = document.getElementById("eqMidVal");
const eqTrebleVal     = document.getElementById("eqTrebleVal");

// ─── State ───────────────────────────────────────────────────────────────────
let currentIndex   = -1;   // -1 = nothing loaded yet
let isPlaying      = false;
let isShuffle      = false;
let isRepeat       = false;
let isMuted        = false;
let lastVolume     = 0.8;
let isDragging     = false;
let shuffleHistory = [];

// ─── Init ────────────────────────────────────────────────────────────────────
function init() {
  audio.volume = lastVolume;
  updateVolumeUI(lastVolume);
  showEmptyState(true);
  setupEqualizer();
}

// ─── Dot Menu ────────────────────────────────────────────────────────────────
function openMenu()  { dotDropdown.classList.add("open");    dotDropdown.setAttribute("aria-hidden","false"); }
function closeMenu() { dotDropdown.classList.remove("open"); dotDropdown.setAttribute("aria-hidden","true");  }

dotMenuBtn.addEventListener("click", e => {
  e.stopPropagation();
  dotDropdown.classList.contains("open") ? closeMenu() : openMenu();
});

// Close when clicking outside
document.addEventListener("click", e => {
  if (!dotDropdown.contains(e.target) && e.target !== dotMenuBtn)
    closeMenu();
});

// ── Add Music (from menu) ────
ddAddMusic.addEventListener("click",  () => { closeMenu(); fileInput.click(); });
ddAddFolder.addEventListener("click", () => { closeMenu(); folderInput.click(); });

// ── Equalizer toggle ─────────
function openEq()  {
  eqPanel.classList.add("open");
  eqPanel.setAttribute("aria-hidden", "false");
  ddEqualizer.querySelector("span:last-child").textContent = "Hide Equalizer";
}
function closeEq() {
  eqPanel.classList.remove("open");
  eqPanel.setAttribute("aria-hidden", "true");
  ddEqualizer.querySelector("span:last-child").textContent = "Equalizer";
}

ddEqualizer.addEventListener("click", () => {
  closeMenu();
  eqPanel.classList.contains("open") ? closeEq() : openEq();
});

// Close button inside eq panel
eqCloseBtn.addEventListener("click", closeEq);

// ── Clear Queue ──────────────
ddClearAll.addEventListener("click", () => {
  closeMenu();
  if (tracks.length === 0) return;
  // Revoke all object URLs (only for user-added blob tracks)
  tracks.forEach(t => {
    if (t.objUrl) URL.revokeObjectURL(t.objUrl);
    if (t.cover && t.cover.startsWith("blob:")) URL.revokeObjectURL(t.cover);
  });
  tracks = [];
  audio.pause();
  audio.src = "";
  currentIndex = -1;
  setPlayingState(false);
  songTitleEl.textContent  = "No Track Selected";
  songArtistEl.textContent = "Add music to get started";
  discImg.style.display         = "none";
  discPlaceholder.style.display = "flex";
  progressFill.style.width  = "0%";
  progressThumb.style.left  = "0%";
  currentTimeEl.textContent   = "0:00";
  totalDurationEl.textContent = "0:00";
  rebuildPlaylist();
});

// ─── Equalizer (Web Audio API) ───────────────────────────────────────────────
let audioCtx, sourceNode, bassFilter, midFilter, trebleFilter;

function setupEqualizer() {
  // Only create AudioContext on first user gesture to respect autoplay policy
  const createCtx = () => {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode   = audioCtx.createMediaElementSource(audio);
    bassFilter   = audioCtx.createBiquadFilter();
    midFilter    = audioCtx.createBiquadFilter();
    trebleFilter = audioCtx.createBiquadFilter();

    bassFilter.type   = "lowshelf";  bassFilter.frequency.value   = 200;
    midFilter.type    = "peaking";   midFilter.frequency.value    = 1000; midFilter.Q.value = 1;
    trebleFilter.type = "highshelf"; trebleFilter.frequency.value = 4000;

    sourceNode.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(audioCtx.destination);

    // Apply stored values immediately
    bassFilter.gain.value   = parseFloat(eqBass.value);
    midFilter.gain.value    = parseFloat(eqMid.value);
    trebleFilter.gain.value = parseFloat(eqTreble.value);

    document.removeEventListener("click", createCtx);
  };
  document.addEventListener("click", createCtx);

  // Slider listeners — update filter gain and display value
  function bindEq(slider, valEl, getFilter) {
    slider.addEventListener("input", () => {
      const v = parseFloat(slider.value);
      valEl.textContent = v > 0 ? `+${v}` : String(v);
      updateEqSliderBg(slider, v);
      const f = getFilter();
      if (f) f.gain.value = v;
    });
    updateEqSliderBg(slider, 0);
  }

  bindEq(eqBass,   eqBassVal,   () => bassFilter);
  bindEq(eqMid,    eqMidVal,    () => midFilter);
  bindEq(eqTreble, eqTrebleVal, () => trebleFilter);
}

function updateEqSliderBg(slider, val) {
  // Map -10..+10 to 0..100% for CSS fill
  const pct = ((val + 10) / 20) * 100;
  const color = val >= 0 ? "#c77dff" : "#48bfe3";
  slider.style.background =
    `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
}

// ─── Empty / filled state ────────────────────────────────────────────────────
function showEmptyState(empty) {
  dropZone.style.display  = empty ? "flex"  : "none";
  playlistEl.style.display = empty ? "none" : "flex";
}

// ─── File input buttons ──────────────────────────────────────────────────────
addMusicBtn.addEventListener("click",  () => fileInput.click());
addFolderBtn.addEventListener("click", () => folderInput.click());
fileInput.addEventListener("change",   e  => { handleFiles(e.target.files); fileInput.value = ""; });
folderInput.addEventListener("change", e  => { handleFiles(e.target.files); folderInput.value = ""; });

// Clicking anywhere on the drop zone opens the file picker
dropZone.addEventListener("click", () => fileInput.click());

// ─── Drag & Drop ─────────────────────────────────────────────────────────────
playlistPanel.addEventListener("dragover", e => {
  e.preventDefault();
  playlistPanel.classList.add("drag-over");
});
playlistPanel.addEventListener("dragleave", e => {
  if (!playlistPanel.contains(e.relatedTarget))
    playlistPanel.classList.remove("drag-over");
});
playlistPanel.addEventListener("drop", e => {
  e.preventDefault();
  playlistPanel.classList.remove("drag-over");
  handleFiles(e.dataTransfer.files);
});

// ─── Process files ───────────────────────────────────────────────────────────
function handleFiles(fileList, metaHints = []) {
  const audioFiles = Array.from(fileList).filter(
    f => f.type.startsWith("audio/") || /\.(mp3|wav|flac|ogg|aac|m4a|opus)$/i.test(f.name)
  );
  if (!audioFiles.length) return;

  const startIndex = tracks.length;
  let processed    = 0;

  audioFiles.forEach((file, i) => {
    const objUrl = URL.createObjectURL(file);
    // Use meta hint title if provided, otherwise strip extension from filename
    const hint   = metaHints[i] || {};
    const fallbackTitle  = hint.title  || file.name.replace(/\.[^.]+$/, "");
    const fallbackArtist = hint.artist || "Unknown Artist";

    const slot = tracks.length;
    tracks.push({
      title:  fallbackTitle,
      artist: fallbackArtist,
      src:    objUrl,
      cover:  null,
      file:   file,
      objUrl: objUrl,
    });

    // Try reading ID3 tags — they override the fallback if present
    if (window.jsmediatags) {
      window.jsmediatags.read(file, {
        onSuccess(tag) {
          const t = tag.tags;
          if (t.title)  tracks[slot].title  = t.title;
          if (t.artist) tracks[slot].artist = t.artist;
          if (t.picture) {
            const { data, format } = t.picture;
            const bytes = new Uint8Array(data);
            const blob  = new Blob([bytes], { type: format });
            tracks[slot].cover = URL.createObjectURL(blob);
          }
          finalize();
        },
        onError() { finalize(); },
      });
    } else {
      finalize();
    }

    function finalize() {
      processed++;
      if (processed === audioFiles.length) {
        rebuildPlaylist();
        if (currentIndex === -1) loadTrack(startIndex, false);
      }
    }
  });
}

// ─── Rebuild playlist UI ─────────────────────────────────────────────────────
function rebuildPlaylist() {
  playlistEl.innerHTML = "";
  tracks.forEach((track, i) => {
    const li = document.createElement("li");
    li.className = "playlist-item";
    li.dataset.index = i;

    // thumbnail — cover art if available, else music icon
    const thumbHTML = track.cover
      ? `<div class="track-thumb"><img src="${track.cover}" alt="cover" /></div>`
      : `<div class="track-thumb"><i class="fa-solid fa-music"></i></div>`;

    li.innerHTML = `
      <span class="track-number">${i + 1}</span>
      <span class="now-playing-bars" aria-hidden="true">
        <span class="bar"></span><span class="bar"></span>
        <span class="bar"></span><span class="bar"></span>
      </span>
      ${thumbHTML}
      <div class="track-meta">
        <div class="track-name">${escapeHTML(track.title)}</div>
        <div class="track-artist">${escapeHTML(track.artist)}</div>
      </div>
      <div class="track-right">
        <span class="track-duration" id="dur-${i}">--:--</span>
        <button class="remove-btn" data-index="${i}" title="Remove track" aria-label="Remove ${escapeHTML(track.title)}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>`;

    li.addEventListener("click", () => loadTrack(i, true));
    li.querySelector(".remove-btn").addEventListener("click", e => {
      e.stopPropagation();
      removeTrack(i);
    });

    playlistEl.appendChild(li);
  });

  trackCountEl.textContent = `${tracks.length} track${tracks.length !== 1 ? "s" : ""}`;
  showEmptyState(tracks.length === 0);
  updatePlaylistActive();

  // Pre-load durations
  tracks.forEach((track, i) => {
    const tmp = new Audio();
    tmp.preload = "metadata";
    tmp.src = track.src;
    tmp.addEventListener("loadedmetadata", () => {
      const el = document.getElementById(`dur-${i}`);
      if (el) el.textContent = formatTime(tmp.duration);
    });
    tmp.addEventListener("error", () => {});
  });
}

// ─── Remove track ─────────────────────────────────────────────────────────────
function removeTrack(index) {
  const removed = tracks[index];
  // Free memory only for blob URLs (user-added files)
  if (removed.objUrl) URL.revokeObjectURL(removed.objUrl);
  if (removed.cover && removed.cover.startsWith("blob:")) URL.revokeObjectURL(removed.cover);

  tracks.splice(index, 1);

  if (tracks.length === 0) {
    // Reset player
    audio.pause();
    audio.src = "";
    currentIndex = -1;
    setPlayingState(false);
    songTitleEl.textContent  = "No Track Selected";
    songArtistEl.textContent = "Add music to get started";
    discImg.style.display         = "none";
    discPlaceholder.style.display = "flex";
    progressFill.style.width  = "0%";
    progressThumb.style.left  = "0%";
    currentTimeEl.textContent = "0:00";
    totalDurationEl.textContent = "0:00";
    rebuildPlaylist();
    return;
  }

  // Adjust currentIndex
  if (index < currentIndex) {
    currentIndex--;
  } else if (index === currentIndex) {
    // Was playing — load next (or wrap to 0)
    currentIndex = Math.min(currentIndex, tracks.length - 1);
    rebuildPlaylist();
    loadTrack(currentIndex, isPlaying);
    return;
  }

  rebuildPlaylist();
}

// ─── Load Track ──────────────────────────────────────────────────────────────
function loadTrack(index, autoPlay = false) {
  if (tracks.length === 0) return;
  currentIndex = index;
  const track  = tracks[index];

  songTitleEl.textContent  = track.title;
  songArtistEl.textContent = track.artist;

  // Cover art
  if (track.cover) {
    discImg.src = track.cover;
    discImg.alt = track.title;
    discImg.style.display         = "block";
    discPlaceholder.style.display = "none";
  } else {
    discImg.style.display         = "none";
    discPlaceholder.style.display = "flex";
  }

  audio.src = track.src;
  audio.load();

  progressFill.style.width  = "0%";
  progressThumb.style.left  = "0%";
  currentTimeEl.textContent = "0:00";
  totalDurationEl.textContent = "0:00";

  updatePlaylistActive();
  autoPlay ? playAudio() : setPlayingState(false);
}

// ─── Play / Pause ─────────────────────────────────────────────────────────────
function playAudio() {
  if (tracks.length === 0) return;
  const p = audio.play();
  if (p !== undefined) p.then(() => setPlayingState(true)).catch(() => setPlayingState(false));
}

function pauseAudio() {
  audio.pause();
  setPlayingState(false);
}

function togglePlayPause() {
  if (tracks.length === 0) { addMusicBtn.click(); return; }
  isPlaying ? pauseAudio() : playAudio();
}

function setPlayingState(playing) {
  isPlaying = playing;
  playIcon.className = playing ? "fa-solid fa-pause" : "fa-solid fa-play";
  albumDisc.classList.toggle("playing", playing);
  albumGlow.classList.toggle("active", playing);
  rings.forEach(r => r.classList.toggle("pulsing", playing));
  waveViz.classList.toggle("active", playing);
  waveViz.classList.toggle("paused", !playing);
  document.querySelectorAll(".now-playing-bars").forEach(el =>
    el.classList.toggle("paused", !playing)
  );
}

// ─── Next / Previous ─────────────────────────────────────────────────────────
function nextTrack() {
  if (!tracks.length) return;
  const next = isShuffle ? getShuffleNext() : (currentIndex + 1) % tracks.length;
  loadTrack(next, isPlaying || autoplayToggle.checked);
}

function prevTrack() {
  if (!tracks.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  let prev;
  if (isShuffle && shuffleHistory.length > 1) {
    shuffleHistory.pop();
    prev = shuffleHistory.pop();
  } else {
    prev = (currentIndex - 1 + tracks.length) % tracks.length;
  }
  loadTrack(prev, isPlaying || autoplayToggle.checked);
}

function getShuffleNext() {
  if (shuffleHistory.length === tracks.length) shuffleHistory = [];
  let pool = tracks.map((_, i) => i).filter(i => !shuffleHistory.includes(i));
  if (!pool.length) { shuffleHistory = []; pool = tracks.map((_, i) => i).filter(i => i !== currentIndex); }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  shuffleHistory.push(pick);
  return pick;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
audio.addEventListener("timeupdate", () => {
  if (isDragging || !audio.duration) return;
  setProgress((audio.currentTime / audio.duration) * 100);
  currentTimeEl.textContent = formatTime(audio.currentTime);
});

audio.addEventListener("loadedmetadata", () => {
  totalDurationEl.textContent = formatTime(audio.duration);
  const el = document.getElementById(`dur-${currentIndex}`);
  if (el) el.textContent = formatTime(audio.duration);
});

function setProgress(pct) {
  progressFill.style.width = `${pct}%`;
  progressThumb.style.left = `${pct}%`;
}

progressTrack.addEventListener("click", seek);
progressTrack.addEventListener("mousedown", e => {
  e.preventDefault();          // stop text selection & page scroll
  isDragging = true;
  seek(e);
});
document.addEventListener("mousemove", e => {
  if (!isDragging) return;
  e.preventDefault();          // stop page scroll while dragging
  seek(e);
});
document.addEventListener("mouseup", () => { isDragging = false; });

progressTrack.addEventListener("touchstart", e => {
  isDragging = true;
  seekTouch(e);
}, { passive: true });
document.addEventListener("touchmove", e => {
  if (!isDragging) return;
  e.preventDefault();          // stop page scroll while touch-dragging
  seekTouch(e);
}, { passive: false });        // must be non-passive to allow preventDefault
document.addEventListener("touchend", () => { isDragging = false; });

function seek(e) {
  const rect = progressTrack.getBoundingClientRect();
  const pct  = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
  setProgress(pct);
  if (audio.duration) {
    audio.currentTime = (pct / 100) * audio.duration;
    currentTimeEl.textContent = formatTime(audio.currentTime);
  }
}
function seekTouch(e) { seek({ clientX: e.touches[0].clientX }); }

// ─── Audio ended ──────────────────────────────────────────────────────────────
audio.addEventListener("ended", () => {
  if (isRepeat) { audio.currentTime = 0; playAudio(); }
  else if (autoplayToggle.checked) nextTrack();
  else setPlayingState(false);
});

// ─── Volume ───────────────────────────────────────────────────────────────────
volumeSlider.addEventListener("input", () => {
  const val = parseFloat(volumeSlider.value);
  audio.volume = val;
  isMuted = val === 0;
  if (val > 0) lastVolume = val;
  updateVolumeUI(val);
});

muteBtn.addEventListener("click", () => {
  if (isMuted) {
    audio.volume = lastVolume;
    volumeSlider.value = lastVolume;
    isMuted = false;
    updateVolumeUI(lastVolume);
  } else {
    lastVolume = audio.volume;
    audio.volume = 0;
    volumeSlider.value = 0;
    isMuted = true;
    updateVolumeUI(0);
  }
});

function updateVolumeUI(val) {
  const pct = Math.round(val * 100);
  volumeLabel.textContent = `${pct}%`;
  volumeIcon.className = val === 0 ? "fa-solid fa-volume-xmark"
    : val < 0.5 ? "fa-solid fa-volume-low" : "fa-solid fa-volume-high";
  volumeSlider.style.background =
    `linear-gradient(to right, #c77dff ${pct}%, rgba(255,255,255,0.09) ${pct}%)`;
}

// ─── Shuffle / Repeat ─────────────────────────────────────────────────────────
shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle("active", isShuffle);
  shuffleHistory = isShuffle ? [currentIndex] : [];
});

repeatBtn.addEventListener("click", () => {
  isRepeat = !isRepeat;
  repeatBtn.classList.toggle("active", isRepeat);
});

// ─── Control buttons ──────────────────────────────────────────────────────────
playPauseBtn.addEventListener("click", togglePlayPause);
prevBtn.addEventListener("click", prevTrack);
nextBtn.addEventListener("click", nextTrack);

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") return;
  switch (e.code) {
    case "Space":      e.preventDefault(); togglePlayPause(); break;
    case "ArrowRight": audio.currentTime = Math.min(audio.duration||0, audio.currentTime+5); break;
    case "ArrowLeft":  audio.currentTime = Math.max(0, audio.currentTime-5); break;
    case "ArrowUp":
      e.preventDefault();
      volumeSlider.value = Math.min(1, +volumeSlider.value + 0.1);
      volumeSlider.dispatchEvent(new Event("input")); break;
    case "ArrowDown":
      e.preventDefault();
      volumeSlider.value = Math.max(0, +volumeSlider.value - 0.1);
      volumeSlider.dispatchEvent(new Event("input")); break;
    case "KeyN": nextTrack(); break;
    case "KeyP": prevTrack(); break;
    case "KeyM": muteBtn.click(); break;
  }
});

// ─── Playlist active state ────────────────────────────────────────────────────
function updatePlaylistActive() {
  document.querySelectorAll(".playlist-item").forEach(item =>
    item.classList.toggle("active", +item.dataset.index === currentIndex)
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(s) {
  if (isNaN(s) || s === Infinity) return "0:00";
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
}
function escapeHTML(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

init();
