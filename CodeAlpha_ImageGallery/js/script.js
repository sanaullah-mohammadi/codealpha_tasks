/**
 * Image Gallery — script.js
 * CodeAlpha Task 1
 *
 * Features:
 *  ✅ Category filter buttons
 *  ✅ Lightbox open / close
 *  ✅ Next / Previous navigation
 *  ✅ Image counter  (e.g. "3 / 10")
 *  ✅ Keyboard support  (Esc, ArrowLeft, ArrowRight)
 *  ✅ Click-on-backdrop to close
 *  ✅ Smooth image-swap animation
 */

/* ─────────────────────────────────────────
   DOM References
───────────────────────────────────────── */
const gallery       = document.getElementById('gallery');
const lightbox      = document.getElementById('lightbox');
const lbImage       = document.getElementById('lbImage');
const lbCaption     = document.getElementById('lbCaption');
const lbCounter     = document.getElementById('lbCounter');
const lbClose       = document.getElementById('lbClose');
const lbPrev        = document.getElementById('lbPrev');
const lbNext        = document.getElementById('lbNext');
const lbBackdrop    = document.getElementById('lightboxBackdrop');
const filterBtns    = document.querySelectorAll('.filter-btn');
const noResults     = document.getElementById('noResults');

/* ─────────────────────────────────────────
   State
───────────────────────────────────────── */
let allItems        = [];   // All .gallery-item elements
let visibleItems    = [];   // Items currently visible (after filtering)
let currentIndex    = 0;    // Index inside visibleItems
let activeFilter    = 'all';

/* ─────────────────────────────────────────
   Init — collect items, attach events
───────────────────────────────────────── */
function init() {
  allItems = Array.from(gallery.querySelectorAll('.gallery-item'));
  visibleItems = [...allItems];

  // Gallery item click / keyboard
  allItems.forEach(item => {
    item.addEventListener('click', () => openLightbox(item));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(item);
      }
    });
  });

  // Filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
  });

  // Lightbox controls
  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', showPrev);
  lbNext.addEventListener('click', showNext);
  lbBackdrop.addEventListener('click', closeLightbox);

  // Keyboard navigation
  document.addEventListener('keydown', handleKeyboard);
}

/* ─────────────────────────────────────────
   Category Filter
───────────────────────────────────────── */
function applyFilter(filter) {
  activeFilter = filter;

  // Update active button
  filterBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  // Show / hide items
  let count = 0;
  allItems.forEach(item => {
    const match = filter === 'all' || item.dataset.category === filter;
    item.classList.toggle('hidden', !match);
    if (match) count++;
  });

  // Re-build visible list
  visibleItems = allItems.filter(item => !item.classList.contains('hidden'));

  // Show "no results" message if needed
  noResults.hidden = count > 0;
}

/* ─────────────────────────────────────────
   Lightbox — Open
───────────────────────────────────────── */
function openLightbox(item) {
  // Find position of this item inside visibleItems
  currentIndex = visibleItems.indexOf(item);
  if (currentIndex === -1) return;

  updateLightboxImage();

  lightbox.removeAttribute('hidden');
  lightbox.classList.add('lb-open');

  // Trap focus on close button
  lbClose.focus();

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

/* ─────────────────────────────────────────
   Lightbox — Close
───────────────────────────────────────── */
function closeLightbox() {
  lightbox.setAttribute('hidden', '');
  lightbox.classList.remove('lb-open');
  document.body.style.overflow = '';

  // Return focus to the last opened item
  const item = visibleItems[currentIndex];
  if (item) item.focus();
}

/* ─────────────────────────────────────────
   Lightbox — Update image
───────────────────────────────────────── */
function updateLightboxImage() {
  const item  = visibleItems[currentIndex];
  const img   = item.querySelector('img');
  const label = item.querySelector('.overlay-label');

  // Fade-out animation
  lbImage.classList.add('changing');

  setTimeout(() => {
    lbImage.src = img.src;
    lbImage.alt = img.alt;
    lbCaption.textContent = img.alt;
    lbCounter.textContent = `${currentIndex + 1} / ${visibleItems.length}`;
    lbImage.classList.remove('changing');
  }, 220);

  // Disable prev/next at boundaries
  lbPrev.disabled = currentIndex === 0;
  lbNext.disabled = currentIndex === visibleItems.length - 1;

  lbPrev.style.opacity = currentIndex === 0 ? '0.3' : '1';
  lbNext.style.opacity = currentIndex === visibleItems.length - 1 ? '0.3' : '1';
}

/* ─────────────────────────────────────────
   Navigation
───────────────────────────────────────── */
function showPrev() {
  if (currentIndex > 0) {
    currentIndex--;
    updateLightboxImage();
  }
}

function showNext() {
  if (currentIndex < visibleItems.length - 1) {
    currentIndex++;
    updateLightboxImage();
  }
}

/* ─────────────────────────────────────────
   Keyboard Support
───────────────────────────────────────── */
function handleKeyboard(e) {
  if (lightbox.hasAttribute('hidden')) return;   // Lightbox must be open

  switch (e.key) {
    case 'Escape':
      closeLightbox();
      break;
    case 'ArrowLeft':
      showPrev();
      break;
    case 'ArrowRight':
      showNext();
      break;
  }
}

/* ─────────────────────────────────────────
   Add Image Modal
───────────────────────────────────────── */
function initAddPanel() {
  const toggleBtn      = document.getElementById('addToggleBtn');
  const addModal       = document.getElementById('addModal');
  const addModalClose  = document.getElementById('addModalClose');
  const addModalBackdrop = document.getElementById('addModalBackdrop');
  const cancelBtn      = document.getElementById('addCancelBtn');
  const submitBtn      = document.getElementById('addSubmitBtn');
  const fileInput      = document.getElementById('fileInput');
  const dropZone       = document.getElementById('dropZone');
  const dropZoneInner  = document.getElementById('dropZoneInner');
  const dropPreview    = document.getElementById('dropPreview');
  const categorySelect = document.getElementById('categorySelect');
  const captionInput   = document.getElementById('captionInput');
  const addError       = document.getElementById('addError');

  let selectedFile = null;

  /* ── Open modal ── */
  toggleBtn.addEventListener('click', openModal);

  function openModal() {
    addModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    addModalClose.focus();
  }

  /* ── Close modal ── */
  addModalClose.addEventListener('click', closeModal);
  addModalBackdrop.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !addModal.hasAttribute('hidden')) closeModal();
  });

  function closeModal() {
    addModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    resetForm();
    toggleBtn.focus();
  }

  function resetForm() {
    selectedFile = null;
    fileInput.value = '';
    captionInput.value = '';
    dropPreview.setAttribute('hidden', '');
    dropPreview.src = '';
    dropZoneInner.style.display = '';
    addError.setAttribute('hidden', '');
  }

  /* ── File input ── */
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) loadFile(fileInput.files[0]);
  });

  /* ── Drag & Drop ── */
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadFile(file);
  });

  /* ── Load file → preview ── */
  function loadFile(file) {
    selectedFile = file;
    addError.setAttribute('hidden', '');
    const reader = new FileReader();
    reader.onload = e => {
      dropPreview.src = e.target.result;
      dropPreview.removeAttribute('hidden');
      dropZoneInner.style.display = 'none';
    };
    reader.readAsDataURL(file);
    if (!captionInput.value) {
      captionInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    }
  }

  /* ── Submit ── */
  submitBtn.addEventListener('click', () => {
    if (!selectedFile) {
      addError.removeAttribute('hidden');
      return;
    }
    const category = categorySelect.value;
    const caption  = captionInput.value.trim() || selectedFile.name.replace(/\.[^/.]+$/, '');
    addItemToGallery(dropPreview.src, caption, category);
    closeModal();
  });
}

/* ─────────────────────────────────────────
   Add a new item to the gallery DOM
───────────────────────────────────────── */
function addItemToGallery(src, caption, category) {
  const newIndex = allItems.length;

  // Build element
  const item = document.createElement('div');
  item.className = 'gallery-item new-item';
  item.dataset.category = category;
  item.dataset.index    = newIndex;
  item.setAttribute('tabindex', '0');
  item.setAttribute('role', 'button');
  item.setAttribute('aria-label', `Open image ${newIndex + 1}`);

  item.innerHTML = `
    <img src="${src}" alt="${caption}" loading="lazy" />
    <div class="overlay">
      <span class="overlay-icon"><i class="fa-solid fa-magnifying-glass-plus"></i></span>
      <span class="overlay-label">${capitalise(category)}</span>
    </div>
  `;

  gallery.appendChild(item);

  // Register events
  item.addEventListener('click', () => openLightbox(item));
  item.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLightbox(item);
    }
  });

  // Update state
  allItems.push(item);

  // Respect active filter
  if (activeFilter !== 'all' && item.dataset.category !== activeFilter) {
    item.classList.add('hidden');
  }

  // Rebuild visible list
  visibleItems = allItems.filter(i => !i.classList.contains('hidden'));

  // Remove pop-in class after animation
  item.addEventListener('animationend', () => item.classList.remove('new-item'), { once: true });

  // Scroll to new item
  item.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ─────────────────────────────────────────
   Start
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  init();
  initAddPanel();
});
