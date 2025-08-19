/* RSVP Reader — ORP-centered, prefix/suffix aligned to pivot edges */

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const playBtn = document.getElementById('playBtn');
const wpmSlider = document.getElementById('wpmSlider');
const wpmLabel = document.getElementById('wpmLabel');
const status = document.getElementById('status');
const wordEl = document.getElementById('word');
const guide = document.getElementById('guide');
const tickTop = document.getElementById('tickTop');
const tickBottom = document.getElementById('tickBottom');

let words = [];
let index = 0;
let timerId = null;
let isPlaying = false;
let wpm = parseInt(wpmSlider.value, 10) || 300;

const pdfjs = window.pdfjsLib;
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Default demo text (preloaded if no PDF is loaded)
const demoText = `
Welcome to the RSVP Reader demo. 
This tool shows one word at a time, keeping your eyes focused on the most important letter. 
This letter is called the Optimal Recognition Point, or ORP. 
It is the letter that helps your brain recognize the word fastest. 
The key is that the ORP letter stays in the same spot, while the rest of the word moves around it. 

By keeping your eyes fixed on the ORP, you don’t need to scan across lines of text. 
This lets you read much faster and with less effort. 

Press Play to start reading. 
Use the slider to change the speed, from slow practice to hundreds of words per minute. 
You can also upload your own PDF to read your own content.
`;



words = demoText.replace(/\s+/g, ' ').trim().split(' ');
index = 0;
showWord(words[index]); // Show first word immediately




// ------- Drag & click file handlers -------
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) handleFile(f);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.background = '#eef6ff';
});
dropZone.addEventListener('dragleave', () => {
  dropZone.style.background = '';
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.background = '';
  const f = (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  if (f) handleFile(f);
});

function handleFile(file) {
  if (file.type !== 'application/pdf') {
    alert('Please drop a PDF file.');
    return;
  }
  status.textContent = 'Loading PDF...';
  readPdfFile(file).then(count => {
    status.textContent = `Loaded ${count} words.`;
  }).catch(err => {
    console.error(err);
    status.textContent = 'Failed to read PDF.';
  });
}

// ------- PDF reading -------
async function readPdfFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(it => it.str).join(' ');
    fullText += ' ' + pageText;
  }

  words = fullText.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  index = 0;
  return words.length;
}

// ------- ORP rules -------
function getPivotIndex(word) {
  const L = word.length;
  if (L <= 1) return 0;
  if (L === 2) return 1;   // second letter for 2-char words
  if (L <= 5) return 1;
  if (L <= 9) return 2;
  if (L <= 13) return 3;
  return 4;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ------- Rendering -------
function showWord(rawWord) {
  if (!rawWord) {
    wordEl.innerHTML = '';
    return;
  }

  const w = rawWord;
  const pivotIndex = Math.min(Math.max(0, getPivotIndex(w)), w.length - 1);
  const prefix = w.slice(0, pivotIndex);
  const pivot = w[pivotIndex] || '';
  const suffix = w.slice(pivotIndex + 1);

  // Build DOM
  wordEl.innerHTML = `
    <span class="prefix">${escapeHtml(prefix)}</span>
    <span class="pivot">${escapeHtml(pivot)}</span>
    <span class="suffix">${escapeHtml(suffix)}</span>
  `;

  // After DOM paints, align prefix/suffix tightly to pivot edges
  requestAnimationFrame(() => {
    const pivotSpan = wordEl.querySelector('.pivot');
    const prefixSpan = wordEl.querySelector('.prefix');
    const suffixSpan = wordEl.querySelector('.suffix');
    if (!pivotSpan) return;

    const pivotRect = pivotSpan.getBoundingClientRect();
    const pivotWidth = pivotRect.width;

    // Pivot fixed at center
    pivotSpan.style.position = 'absolute';
    pivotSpan.style.left = '50%';
    pivotSpan.style.top = '50%';
    pivotSpan.style.transform = 'translate(-50%, -50%)';

    // Prefix: right aligned to pivot’s left edge
    prefixSpan.style.position = 'absolute';
    prefixSpan.style.top = '50%';
    prefixSpan.style.right = `calc(50% + ${pivotWidth / 2}px)`;
    prefixSpan.style.transform = 'translateY(-50%)';
    prefixSpan.style.textAlign = 'right';

    // Suffix: left aligned to pivot’s right edge
    suffixSpan.style.position = 'absolute';
    suffixSpan.style.top = '50%';
    suffixSpan.style.left = `calc(50% + ${pivotWidth / 2}px)`;
    suffixSpan.style.transform = 'translateY(-50%)';
    suffixSpan.style.textAlign = 'left';

    adjustTicksToPivot();
  });
}

function adjustTicksToPivot() {
  const pivotSpan = wordEl.querySelector('.pivot');
  if (!pivotSpan) return;

  const pivotRect = pivotSpan.getBoundingClientRect();
  const pivotHeight = pivotRect.height || 48;

  const gap = 8; // px
  const tickH = parseFloat(getComputedStyle(tickTop).height) || 26;

  const topOffset = -(pivotHeight / 2 + gap + tickH);
  const bottomOffset = (pivotHeight / 2 + gap);

  tickTop.style.top = `${topOffset}px`;
  tickBottom.style.top = `${bottomOffset}px`;
}

// ------- Playback -------
function scheduleNext(delay = 0) {
  clearTimeout(timerId);
  timerId = setTimeout(() => {
    if (!isPlaying) return;
    if (index >= words.length) {
      stopPlayback();
      return;
    }
    const w = words[index++];
    showWord(w);

    // Look up current WPM *each time* before scheduling next word
    if (wpm > 0) {
      const nextDelay = Math.round(60000 / wpm);
      scheduleNext(nextDelay);
    } else {
      pausePlayback();
    }
  }, delay);
}


function startPlayback() {
  if (!words.length) {
    alert('Load a PDF first (drag & drop).');
    return;
  }
  if (wpm <= 0) {
    alert('WPM is 0 — increase slider to start playback.');
    return;
  }
  if (isPlaying) return;
  isPlaying = true;
  playBtn.textContent = 'Pause';
  if (index >= words.length) index = 0;
  scheduleNext(0);
}

function pausePlayback() {
  isPlaying = false;
  clearTimeout(timerId);
  playBtn.textContent = 'Play';
}

function stopPlayback() {
  isPlaying = false;
  clearTimeout(timerId);
  playBtn.textContent = 'Play';
}

// ------- Controls -------
playBtn.addEventListener('click', () => {
  if (isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
});

wpmSlider.addEventListener('input', () => {
  wpm = parseInt(wpmSlider.value, 10) || 0;
  wpmLabel.textContent = wpm;

  // if (isPlaying) {
  //   clearTimeout(timerId);
  //   scheduleNext(0);
  // }
});

window.addEventListener('beforeunload', () => clearTimeout(timerId));

function home(){
  window.open("https://rossbarrettgit.github.io/home-webpage/");
}