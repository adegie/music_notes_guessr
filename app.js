const SVG_NS = "http://www.w3.org/2000/svg";
const NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const KEY_ALIASES = {
  H: "B",
};
const VALID_KEYS = new Set(NOTE_LETTERS);
const NOTE_RANGES = {
  standard: {
    treble: { min: -2, max: 10 },
    bass: { min: -2, max: 10 },
  },
  advanced: {
    treble: { min: -6, max: 14 },
    bass: { min: -6, max: 14 },
  },
};

const STAFF_CONFIG = {
  treble: {
    svgId: "trebleStaff",
    label: "Treble",
    width: 320,
    height: 220,
    paddingX: 32,
    baseLineY: 150,
    lineSpacing: 18,
    noteX: 160,
    bottomNote: createPitch("E", 4),
  },
  bass: {
    svgId: "bassStaff",
    label: "Bass",
    width: 320,
    height: 220,
    paddingX: 32,
    baseLineY: 150,
    lineSpacing: 18,
    noteX: 160,
    bottomNote: createPitch("G", 2),
  },
};

Object.values(STAFF_CONFIG).forEach((config) => {
  config.stepSpacing = config.lineSpacing / 2;
});

const CLEF_SYMBOLS = {
  treble: {
    glyph: String.fromCodePoint(0x1d11e),
    fontSize: 88,
    xOffset: -18,
    yAdjust: -2,
  },
  bass: {
    glyph: String.fromCodePoint(0x1d122),
    fontSize: 72,
    xOffset: -14,
    yAdjust: 1,
  },
};

const staffState = {};
const staffCards = {};
const buttonMap = new Map();

const state = {
  total: 0,
  correct: 0,
  streak: 0,
  allowAnswer: true,
  current: null,
  nextTimeout: null,
  sessionStart: null,
  scoreboardInterval: null,
  advancedMode: false,
  sameStaffProbability: 0.7,
  notePool: [],
  notePoolByStaff: {},
};

const elements = {};

function init() {
  cacheElements();
  state.sessionStart = performance.now();
  updateScoreboard();
  setupStaffCards();
  setupStaffSvgs();
  updateNotePool();
  renderAnswerButtons();
  bindEvents();
  if (state.scoreboardInterval) {
    window.clearInterval(state.scoreboardInterval);
  }
  state.scoreboardInterval = window.setInterval(updateScoreboard, 1000);
  nextQuestion();
}

function cacheElements() {
  elements.feedback = document.getElementById("feedback");
  elements.scoreCorrect = document.getElementById("scoreCorrect");
  elements.scoreTotal = document.getElementById("scoreTotal");
  elements.scoreAccuracy = document.getElementById("scoreAccuracy");
  elements.scoreGuessesPerMinute = document.getElementById(
    "scoreGuessesPerMinute"
  );
  elements.scoreStreak = document.getElementById("scoreStreak");
  elements.answerButtons = document.getElementById("answerButtons");
  elements.nextButton = document.getElementById("nextButton");
  elements.advancedToggle = document.getElementById("advancedModeToggle");
  if (elements.advancedToggle) {
    elements.advancedToggle.checked = state.advancedMode;
  }
  elements.sameStaffProbabilitySlider =
    document.getElementById("sameStaffProbability");
  elements.sameStaffProbabilityValue = document.getElementById(
    "sameStaffProbabilityValue"
  );
  updateSameStaffProbabilityDisplay();
}

function setupStaffCards() {
  document.querySelectorAll(".staff-card").forEach((card) => {
    const key = card.dataset.staff;
    if (key) {
      staffCards[key] = card;
    }
  });
}

function setupStaffSvgs() {
  Object.entries(STAFF_CONFIG).forEach(([key, config]) => {
    const svg = document.getElementById(config.svgId);
    if (!svg) {
      return;
    }

    svg.setAttribute("viewBox", `0 0 ${config.width} ${config.height}`);
    svg.setAttribute("width", config.width);
    svg.setAttribute("height", config.height);

    const linesGroup = document.createElementNS(SVG_NS, "g");
    linesGroup.setAttribute("class", "staff-lines");

    for (let i = 0; i < 5; i += 1) {
      const y = config.baseLineY - i * config.lineSpacing;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", config.paddingX);
      line.setAttribute("x2", config.width - config.paddingX);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("class", "staff-line");
      linesGroup.appendChild(line);
    }
    svg.appendChild(linesGroup);

    const clefSymbol = createClefSymbol(key, config);
    if (clefSymbol) {
      svg.appendChild(clefSymbol);
    }

    const ledgerGroup = document.createElementNS(SVG_NS, "g");
    ledgerGroup.setAttribute("class", "ledger-lines");
    svg.appendChild(ledgerGroup);

    const noteGroup = document.createElementNS(SVG_NS, "g");
    noteGroup.setAttribute("class", "note-group hidden");

    const noteHead = document.createElementNS(SVG_NS, "ellipse");
    noteHead.setAttribute("class", "note-head");
    noteHead.setAttribute("cx", config.noteX);
    noteHead.setAttribute("rx", 11);
    noteHead.setAttribute("ry", 7.6);

    noteGroup.appendChild(noteHead);
    svg.appendChild(noteGroup);

    staffState[key] = {
      svg,
      ledgerGroup,
      noteGroup,
      noteHead,
      clefSymbol,
    };
  });
}

function renderAnswerButtons() {
  NOTE_LETTERS.forEach((letter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.textContent = letter;
    button.dataset.letter = letter;
    button.addEventListener("click", () => submitAnswer(letter));
    elements.answerButtons.appendChild(button);
    buttonMap.set(letter, button);
  });
}

function bindEvents() {
  window.addEventListener("keydown", handleKeydown);
  elements.nextButton.addEventListener("click", () => {
    cancelScheduledQuestion();
    setNeutralFeedback("New note incoming - what do you see?");
    state.allowAnswer = true;
    nextQuestion();
  });
  if (elements.advancedToggle) {
    elements.advancedToggle.addEventListener("change", handleAdvancedToggle);
  }
  if (elements.sameStaffProbabilitySlider) {
    elements.sameStaffProbabilitySlider.addEventListener(
      "input",
      handleSameStaffProbabilityChange
    );
  }
}

function handleAdvancedToggle(event) {
  state.advancedMode = event.target.checked;
  updateNotePool();
  cancelScheduledQuestion();
  state.allowAnswer = true;
  nextQuestion();
  if (event.target instanceof HTMLInputElement) {
    event.target.blur();
  }
}

function updateNotePool() {
  const { all, byStaff } = buildNotePool(state.advancedMode);
  state.notePool = all;
  state.notePoolByStaff = byStaff;
}

function handleSameStaffProbabilityChange(event) {
  const value = Number(event.target.value);
  if (Number.isNaN(value)) {
    return;
  }
  const normalized = Math.min(Math.max(value / 100, 0), 1);
  state.sameStaffProbability = normalized;
  updateSameStaffProbabilityDisplay();
}

function updateSameStaffProbabilityDisplay() {
  const percent = Math.round(state.sameStaffProbability * 100);
  if (elements.sameStaffProbabilitySlider) {
    elements.sameStaffProbabilitySlider.value = String(percent);
  }
  if (elements.sameStaffProbabilityValue) {
    elements.sameStaffProbabilityValue.textContent = `${percent}%`;
  }
}

function handleKeydown(event) {
  if (!state.allowAnswer) {
    return;
  }

  const target = event.target;
  const isEditable =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable;

  if (isEditable) {
    return;
  }

  const rawLetter = event.key.toUpperCase();
  const letter = KEY_ALIASES[rawLetter] || rawLetter;
  if (!VALID_KEYS.has(letter)) {
    return;
  }

  event.preventDefault();
  submitAnswer(letter);
}

function submitAnswer(letter) {
  if (!state.allowAnswer || !state.current) {
    return;
  }

  const expected = state.current.note.letter;
  const isCorrect = letter === expected;

  state.total += 1;
  if (isCorrect) {
    state.correct += 1;
    state.streak += 1;
  } else {
    state.streak = 0;
  }

  updateScoreboard();
  highlightAnswerButtons(letter, expected, isCorrect);

  if (isCorrect) {
    setPositiveFeedback(
      `Nice! That was ${fullNoteName(
        state.current.note
      )} on the ${state.current.staffLabel} staff.`
    );
  } else {
    setNegativeFeedback(
      `Not quite. The note is ${fullNoteName(
        state.current.note
      )} on the ${state.current.staffLabel} staff.`
    );
  }

  state.allowAnswer = false;
  scheduleNextQuestion();
}

function nextQuestion() {
  resetAnswerButtons();
  const next = pickRandomNote();
  state.current = {
    ...next,
    staffLabel: STAFF_CONFIG[next.staff].label,
  };

  Object.keys(STAFF_CONFIG).forEach((staffKey) => {
    const note = staffKey === next.staff ? next.note : null;
    updateStaffNote(staffKey, note);
    toggleStaffHighlight(staffKey, staffKey === next.staff);
  });

  if (state.allowAnswer) {
    setNeutralFeedback(
      `What note is highlighted on the ${state.current.staffLabel} staff?`
    );
  }
}

function scheduleNextQuestion(delay = 1200) {
  cancelScheduledQuestion();
  state.nextTimeout = window.setTimeout(() => {
    state.allowAnswer = true;
    nextQuestion();
  }, delay);
}

function cancelScheduledQuestion() {
  if (state.nextTimeout) {
    window.clearTimeout(state.nextTimeout);
    state.nextTimeout = null;
  }
}

function pickRandomNote() {
  if (!state.notePool || state.notePool.length === 0) {
    updateNotePool();
  }
  const previousStaff = state.current ? state.current.staff : null;
  const previousNote = state.current;
  let pool = state.notePool;

  if (
    previousStaff &&
    state.notePoolByStaff &&
    state.notePoolByStaff[previousStaff] &&
    state.notePoolByStaff[previousStaff].length > 0 &&
    Math.random() < state.sameStaffProbability
  ) {
    pool = state.notePoolByStaff[previousStaff];
  }

  return selectRandomNote(pool, previousNote);
}

function buildNotePool(useAdvanced) {
  const rangeKey = useAdvanced ? "advanced" : "standard";
  const ranges = NOTE_RANGES[rangeKey];
  const all = [];
  const byStaff = {};

  Object.keys(STAFF_CONFIG).forEach((staffKey) => {
    const staffConfig = STAFF_CONFIG[staffKey];
    const staffRange = ranges[staffKey];
    if (!staffConfig || !staffRange) {
      return;
    }

    const staffNotes = [];
    for (let step = staffRange.min; step <= staffRange.max; step += 1) {
      const pitch = shiftPitch(staffConfig.bottomNote, step);
      const noteEntry = {
        id: `${pitch.letter}${pitch.octave}`,
        staff: staffKey,
        letter: pitch.letter,
        octave: pitch.octave,
        note: pitch,
      };
      staffNotes.push(noteEntry);
      all.push(noteEntry);
    }
    byStaff[staffKey] = staffNotes;
  });

  return { all, byStaff };
}

function updateStaffNote(staffKey, note) {
  const config = STAFF_CONFIG[staffKey];
  const current = staffState[staffKey];
  if (!config || !current) {
    return;
  }

  clearLedgerLines(current.ledgerGroup);

  if (!note) {
    current.noteGroup.classList.add("hidden");
    return;
  }

  const steps = computeStepOffset(note, config.bottomNote);
  const y = config.baseLineY - steps * config.stepSpacing;

  current.noteGroup.classList.remove("hidden");
  current.noteHead.setAttribute("cx", config.noteX);
  current.noteHead.setAttribute("cy", y);
  current.noteHead.setAttribute(
    "transform",
    `rotate(-20 ${config.noteX} ${y})`
  );

  const ledgerSteps = computeLedgerSteps(steps);
  ledgerSteps.forEach((step) => {
    const ledgerY = config.baseLineY - step * config.stepSpacing;
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", config.noteX - 22);
    line.setAttribute("x2", config.noteX + 22);
    line.setAttribute("y1", ledgerY);
    line.setAttribute("y2", ledgerY);
    line.setAttribute("class", "ledger-line");
    current.ledgerGroup.appendChild(line);
  });
}

function toggleStaffHighlight(staffKey, active) {
  const card = staffCards[staffKey];
  if (!card) {
    return;
  }
  card.classList.toggle("active", active);
}

function highlightAnswerButtons(selectedLetter, expectedLetter, isCorrect) {
  resetAnswerButtons();

  const selectedButton = buttonMap.get(selectedLetter);
  if (selectedButton) {
    selectedButton.classList.add(isCorrect ? "correct" : "incorrect");
  }

  if (!isCorrect) {
    const expectedButton = buttonMap.get(expectedLetter);
    if (expectedButton) {
      expectedButton.classList.add("correct");
    }
  }
}

function resetAnswerButtons() {
  buttonMap.forEach((button) => {
    button.classList.remove("correct", "incorrect");
  });
}

function updateScoreboard() {
  elements.scoreCorrect.textContent = state.correct;
  elements.scoreTotal.textContent = state.total;
  elements.scoreStreak.textContent = state.streak;
  const accuracy =
    state.total > 0 ? Math.round((state.correct / state.total) * 100) : null;
  elements.scoreAccuracy.textContent = accuracy === null ? "N/A" : `${accuracy}%`;
  if (elements.scoreGuessesPerMinute) {
    let guessesPerMinuteText = "0.0";
    if (state.sessionStart !== null) {
      const elapsedMinutes = (performance.now() - state.sessionStart) / 60000;
      if (state.correct > 0 && elapsedMinutes > 0) {
        const rate = state.correct / elapsedMinutes;
        guessesPerMinuteText = rate >= 10 ? rate.toFixed(0) : rate.toFixed(1);
      }
    } else {
      guessesPerMinuteText = "N/A";
    }
    elements.scoreGuessesPerMinute.textContent = guessesPerMinuteText;
  }
}

function setNeutralFeedback(message) {
  setFeedback(message);
}

function setPositiveFeedback(message) {
  setFeedback(message, "positive");
}

function setNegativeFeedback(message) {
  setFeedback(message, "negative");
}

function setFeedback(message, tone = "neutral") {
  elements.feedback.textContent = message;
  elements.feedback.classList.remove("positive", "negative");
  if (tone === "positive") {
    elements.feedback.classList.add("positive");
  } else if (tone === "negative") {
    elements.feedback.classList.add("negative");
  }
}

function shiftPitch(base, stepOffset) {
  const baseIndex = NOTE_LETTERS.indexOf(base.letter);
  if (baseIndex === -1) {
    throw new Error(`Unknown base letter: ${base.letter}`);
  }

  const totalSteps = baseIndex + stepOffset;
  const letterIndex =
    ((totalSteps % NOTE_LETTERS.length) + NOTE_LETTERS.length) %
    NOTE_LETTERS.length;
  const octaveOffset = Math.floor(totalSteps / NOTE_LETTERS.length);
  const octave = base.octave + octaveOffset;

  return createPitch(NOTE_LETTERS[letterIndex], octave);
}

function computeStepOffset(note, reference) {
  const letterDiff =
    NOTE_LETTERS.indexOf(note.letter) - NOTE_LETTERS.indexOf(reference.letter);
  const octaveDiff = (note.octave - reference.octave) * NOTE_LETTERS.length;
  return letterDiff + octaveDiff;
}

function computeLedgerSteps(steps) {
  const ledger = [];
  if (steps < 0) {
    for (let s = -2; s >= steps; s -= 1) {
      if (s % 2 === 0) {
        ledger.push(s);
      }
    }
  } else if (steps > 8) {
    for (let s = 10; s <= steps; s += 1) {
      if (s % 2 === 0) {
        ledger.push(s);
      }
    }
  }
  return ledger;
}

function clearLedgerLines(group) {
  while (group.firstChild) {
    group.removeChild(group.firstChild);
  }
}

function createClefSymbol(staffKey, config) {
  const clef = CLEF_SYMBOLS[staffKey];
  if (!clef) {
    return null;
  }

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("class", `clef clef-${staffKey}`);
  text.setAttribute("x", config.paddingX + clef.xOffset);
  const staffCenterY = config.baseLineY - 2 * config.lineSpacing;
  const y = staffCenterY + (clef.yAdjust || 0);
  text.setAttribute("y", y);
  text.setAttribute("font-size", clef.fontSize);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.textContent = clef.glyph;

  return text;
}

function fullNoteName(note) {
  return `${note.letter}${note.octave}`;
}

function createPitch(letter, octave) {
  return { letter, octave };
}

function selectRandomNote(pool, previousNote) {
  if (!pool || pool.length === 0) {
    throw new Error("Note pool is empty");
  }

  if (!previousNote || pool.length === 1) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const filtered = pool.filter(
    (candidate) => !isSameNote(candidate, previousNote)
  );

  const selectionPool = filtered.length > 0 ? filtered : pool;
  return selectionPool[Math.floor(Math.random() * selectionPool.length)];
}

function isSameNote(a, b) {
  if (!a || !b) {
    return false;
  }
  return a.id === b.id && a.staff === b.staff;
}

document.addEventListener("DOMContentLoaded", init);
