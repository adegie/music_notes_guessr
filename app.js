const SVG_NS = "http://www.w3.org/2000/svg";
const NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const VALID_KEYS = new Set(NOTE_LETTERS);

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

const TREBLE_NOTES = [
  "C4",
  "D4",
  "E4",
  "F4",
  "G4",
  "A4",
  "B4",
  "C5",
  "D5",
  "E5",
  "F5",
  "G5",
  "A5",
];

const BASS_NOTES = [
  "E2",
  "F2",
  "G2",
  "A2",
  "B2",
  "C3",
  "D3",
  "E3",
  "F3",
  "G3",
  "A3",
  "B3",
  "C4",
];

const NOTE_BANK = [
  ...TREBLE_NOTES.map((id) => createNote(id, "treble")),
  ...BASS_NOTES.map((id) => createNote(id, "bass")),
];

const CLEF_SYMBOLS = {
  treble: {
    glyph: String.fromCodePoint(0x1d11e),
    fontSize: 88,
    xOffset: -18,
    yOffsetLines: 2,
  },
  bass: {
    glyph: String.fromCodePoint(0x1d122),
    fontSize: 72,
    xOffset: -14,
    yOffsetLines: 3,
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
};

const elements = {};

function init() {
  cacheElements();
  updateScoreboard();
  setupStaffCards();
  setupStaffSvgs();
  renderAnswerButtons();
  bindEvents();
  nextQuestion();
}

function cacheElements() {
  elements.feedback = document.getElementById("feedback");
  elements.scoreCorrect = document.getElementById("scoreCorrect");
  elements.scoreTotal = document.getElementById("scoreTotal");
  elements.scoreAccuracy = document.getElementById("scoreAccuracy");
  elements.scoreStreak = document.getElementById("scoreStreak");
  elements.answerButtons = document.getElementById("answerButtons");
  elements.nextButton = document.getElementById("nextButton");
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

  const letter = event.key.toUpperCase();
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
  const index = Math.floor(Math.random() * NOTE_BANK.length);
  return NOTE_BANK[index];
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
  const y =
    config.baseLineY - clef.yOffsetLines * config.lineSpacing + config.stepSpacing;
  text.setAttribute("y", y);
  text.setAttribute("font-size", clef.fontSize);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.textContent = clef.glyph;

  return text;
}

function createNote(id, staff) {
  const { letter, octave } = parseNoteId(id);
  return {
    id,
    staff,
    letter,
    octave,
    note: { letter, octave },
  };
}

function fullNoteName(note) {
  return `${note.letter}${note.octave}`;
}

function parseNoteId(id) {
  const match = /^([A-G])([0-9])$/.exec(id);
  if (!match) {
    throw new Error(`Invalid note identifier: ${id}`);
  }
  return {
    letter: match[1],
    octave: Number(match[2]),
  };
}

function createPitch(letter, octave) {
  return { letter, octave };
}

document.addEventListener("DOMContentLoaded", init);
