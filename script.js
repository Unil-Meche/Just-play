
const STORAGE_KEY = "koreanVocabularyStudio.v1";

let words = loadWords();
let currentIndex = 0;
let speechQueueToken = 0;

const $ = id => document.getElementById(id);

function loadWords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveWords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function currentWord() {
  return words[currentIndex] || null;
}

function render() {
  const word = currentWord();

  $("counter").textContent =
    words.length ? `${currentIndex + 1} / ${words.length}` : "0 / 0";

  $("totalCount").textContent = `${words.length} words`;

  $("progressBar").style.width = words.length
    ? `${((currentIndex + 1) / words.length) * 100}%`
    : "0%";

  $("emptyState").classList.toggle("hidden", !!word);

  if (word) {
    $("koreanWord").textContent = word.korean;
    $("englishMeaning").textContent = word.english;
    $("nepaliMeaning").textContent = word.nepali;

    $("imageWrap").classList.toggle("hidden", !word.image);

    if (word.image) {
      $("wordImage").src = word.image;
      $("wordImage").onerror = () => {
        $("imageWrap").classList.add("hidden");
      };
    }
  } else {
    $("koreanWord").textContent = "";
    $("englishMeaning").textContent = "";
    $("nepaliMeaning").textContent = "";
    $("imageWrap").classList.add("hidden");
  }

  applyVisibility();
  renderList();
}

function applyVisibility() {
  const word = currentWord();

  $("koreanBlock").classList.toggle(
    "hidden",
    !$("showKorean").checked || !word
  );

  $("englishBlock").classList.toggle(
    "hidden",
    !$("showEnglish").checked || !word
  );

  $("nepaliBlock").classList.toggle(
    "hidden",
    !$("showNepali").checked || !word
  );
}

function renderList(filter = $("searchInput").value.trim().toLowerCase()) {
  const list = $("vocabList");

  const matches = words
    .map((word, index) => ({ ...word, index }))
    .filter(w =>
      [w.korean, w.english, w.nepali]
        .some(v => String(v).toLowerCase().includes(filter))
    );

  if (!matches.length) {
    list.innerHTML = `
      <div class="no-results">
        ${words.length ? "No matching vocabulary." : "Your saved words will appear here."}
      </div>`;
    return;
  }

  list.innerHTML = matches.map(w => `
    <div class="vocab-item ${w.index === currentIndex ? "active" : ""}">
      <div class="vocab-summary"
           data-select="${w.index}"
           role="button"
           tabindex="0">

        <strong>${escapeHTML(w.korean)}</strong>

        <small>
          ${escapeHTML(w.english)} · ${escapeHTML(w.nepali)}
        </small>

      </div>

      <div class="item-actions">
        <button class="mini-btn" data-select="${w.index}">↗</button>
        <button class="mini-btn delete" data-delete="${w.index}">×</button>
      </div>
    </div>
  `).join("");
}

function move(delta) {
  if (!words.length) return;

  currentIndex =
    (currentIndex + delta + words.length) % words.length;

  render();
}

// Individual language audio
function speak(text, lang) {
  if (!text || !("speechSynthesis" in window)) {
    alert("Audio is not supported by this browser.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = lang;
  utterance.rate = 0.88;

  window.speechSynthesis.speak(utterance);
}

// Play Korean, English and Nepali one by one
function playAll() {
  const word = currentWord();

  if (!word || !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const token = ++speechQueueToken;

  const queue = [
    [word.korean, "ko-KR"],
    [word.english, "en-US"],
    [word.nepali, "ne-NP"]
  ];

  function playNext(index) {
    if (token !== speechQueueToken || index >= queue.length) return;

    const [text, lang] = queue[index];

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = lang;
    utterance.rate = 0.88;

    utterance.onend = () => playNext(index + 1);
    utterance.onerror = () => playNext(index + 1);

    speechSynthesis.speak(utterance);
  }

  playNext(0);
}

// CSV parser supporting quoted commas
function parseCSVLine(line) {
  const result = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if ((ch === "," || ch === "\t") && !quoted) {
      result.push(value.trim());
      value = "";
    } else {
      value += ch;
    }
  }

  result.push(value.trim());

  return result;
}

// Bulk vocabulary import
function parseBulk(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const parsed = [];

  for (const line of lines) {
    const cols = parseCSVLine(line);

    if (cols.length < 3) continue;

    // Skip header row
    if (/^(korean|한국어)$/i.test(cols[0]) &&
        /english/i.test(cols[1])) {
      continue;
    }

    const [korean, english, nepali, image = ""] = cols;

    if (korean && english && nepali) {
      parsed.push({
        korean,
        english,
        nepali,
        image
      });
    }
  }

  return parsed;
}

function addWords(items) {
  const valid = items.filter(
    w => w.korean && w.english && w.nepali
  );

  if (!valid.length) return 0;

  words.push(...valid.map(w => ({
    ...w,
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now() + Math.random())
  })));

  saveWords();

  currentIndex = words.length - valid.length;

  render();

  return valid.length;
}

// Navigation
$("nextBtn").addEventListener("click", () => move(1));
$("previousBtn").addEventListener("click", () => move(-1));

// Language visibility
["showKorean", "showEnglish", "showNepali"].forEach(id => {
  $(id).addEventListener("change", applyVisibility);
});

// Audio buttons
$("speakKorean").addEventListener("click", () => {
  const w = currentWord();
  if (w) speak(w.korean, "ko-KR");
});

$("speakEnglish").addEventListener("click", () => {
  const w = currentWord();
  if (w) speak(w.english, "en-US");
});

$("speakNepali").addEventListener("click", () => {
  const w = currentWord();
  if (w) speak(w.nepali, "ne-NP");
});

$("speakAll").addEventListener("click", playAll);

// Open and close panels
$("addToggle").addEventListener("click", () => {
  $("addPanel").classList.toggle("hidden");
  $("importPanel").classList.add("hidden");
});

$("importToggle").addEventListener("click", () => {
  $("importPanel").classList.toggle("hidden");
  $("addPanel").classList.add("hidden");
});

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => {
    $(btn.dataset.close).classList.add("hidden");
  });
});

// Add individual vocabulary
$("addForm").addEventListener("submit", event => {
  event.preventDefault();

  const item = {
    korean: $("newKorean").value.trim(),
    english: $("newEnglish").value.trim(),
    nepali: $("newNepali").value.trim(),
    image: $("newImage").value.trim()
  };

  const count = addWords([item]);

  if (count) {
    event.target.reset();
    $("addPanel").classList.add("hidden");
  }
});

// Bulk import
$("importButton").addEventListener("click", () => {
  const items = parseBulk($("bulkInput").value);

  const count = addWords(items);

  $("importMessage").textContent = count
    ? `Successfully imported ${count} word(s).`
    : "No valid rows found. Add Korean, English and Nepali fields.";

  $("importMessage").style.color = count
    ? "#16856a"
    : "#c35d65";

  if (count) {
    $("bulkInput").value = "";
  }
});

// Upload CSV or TXT
$("fileInput").addEventListener("change", async event => {
  const file = event.target.files[0];

  if (file) {
    $("bulkInput").value = await file.text();
  }
});

// Download sample CSV
$("downloadSample").addEventListener("click", () => {
  const csv =
`Korean,English,Nepali,Image URL
사랑,Love,माया,
학교,School,विद्यालय,
물,Water,पानी,
`;

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = "korean-vocabulary-sample.csv";

  a.click();

  URL.revokeObjectURL(url);
});

// Search
$("searchInput").addEventListener("input", () => {
  renderList();
});

// Select or delete vocabulary
$("vocabList").addEventListener("click", event => {
  const select = event.target.closest("[data-select]");
  const del = event.target.closest("[data-delete]");

  if (select) {
    currentIndex = Number(select.dataset.select);
    render();
  }

  if (del) {
    const index = Number(del.dataset.delete);

    if (confirm(`Delete "${words[index].korean}"?`)) {
      words.splice(index, 1);

      if (currentIndex >= words.length) {
        currentIndex = Math.max(0, words.length - 1);
      }

      saveWords();
      render();
    }
  }
});

// Keyboard navigation
$("vocabList").addEventListener("keydown", event => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches("[data-select]")
  ) {
    currentIndex = Number(event.target.dataset.select);
    render();
  }
});

document.addEventListener("keydown", event => {
  if (event.target.matches("input,textarea")) return;

  if (event.key === "ArrowRight") move(1);
  if (event.key === "ArrowLeft") move(-1);
});

// Start application
render();
