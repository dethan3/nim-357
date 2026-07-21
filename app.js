(() => {
  "use strict";

  const INITIAL_HEAPS = [3, 5, 7];
  const DEFAULT_PLAYER_NAMES = ["玩家一", "玩家二"];
  const PLAYER_NAME_STORAGE_KEY = "nim-357-player-names";
  const ROW_NAMES = ["一", "二", "三"];

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    appShell: $(".app-shell"),
    board: $("#board"),
    playerCards: [$("#playerCard0"), $("#playerCard1")],
    playerNameButtons: [$("#playerNameButton0"), $("#playerNameButton1")],
    playerNameLabels: [$("#playerName0"), $("#playerName1")],
    turnPills: [$("#turnPill0"), $("#turnPill1")],
    scores: [$("#score0"), $("#score1")],
    roundNumber: $("#roundNumber"),
    remainingCount: $("#remainingCount"),
    turnKicker: $("#turnKicker"),
    turnHeading: $("#turnHeading"),
    selectionValue: $("#selectionValue"),
    selectionHint: $("#selectionHint"),
    takeButton: $("#takeButton"),
    takeCount: $("#takeCount"),
    clearSelectionButton: $("#clearSelectionButton"),
    lastMoveText: $("#lastMoveText"),
    undoButton: $("#undoButton"),
    newMatchButton: $("#newMatchButton"),
    rulesButton: $("#rulesButton"),
    rulesModal: $("#rulesModal"),
    closeRulesButton: $("#closeRulesButton"),
    understoodButton: $("#understoodButton"),
    resultModal: $("#resultModal"),
    resultTitle: $("#resultTitle"),
    resultDescription: $("#resultDescription"),
    resultPlayerNames: [$("#resultPlayerName0"), $("#resultPlayerName1")],
    resultScores: [$("#resultScore0"), $("#resultScore1")],
    nextStarterButtons: [$("#nextStarterButton0"), $("#nextStarterButton1")],
    nextStarterNames: [$("#nextStarterName0"), $("#nextStarterName1")],
    resetScoresButton: $("#resetScoresButton"),
    nameModal: $("#nameModal"),
    nameForm: $("#nameForm"),
    playerNameInputs: [$("#playerNameInput0"), $("#playerNameInput1")],
    closeNameButton: $("#closeNameButton"),
    cancelNameButton: $("#cancelNameButton"),
    resetNamesButton: $("#resetNamesButton"),
    turnToast: $("#turnToast"),
    toastLabel: $("#toastLabel")
  };

  const state = {
    heaps: [...INITIAL_HEAPS],
    playerNames: loadPlayerNames(),
    scores: [0, 0],
    round: 1,
    roundStarter: 0,
    currentPlayer: 0,
    selectedRow: null,
    selectedIndices: new Set(),
    lastMove: null,
    history: [],
    gesture: null,
    gameOver: false,
    animating: false,
    toastTimer: null,
    nameEditorTrigger: 0
  };

  const remainingTotal = () => state.heaps.reduce((sum, count) => sum + count, 0);
  const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const playerName = (playerIndex) => state.playerNames[playerIndex];

  function normalizePlayerName(value, playerIndex) {
    const trimmed = String(value ?? "").trim().slice(0, 12);
    return trimmed || DEFAULT_PLAYER_NAMES[playerIndex];
  }

  function loadPlayerNames() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PLAYER_NAME_STORAGE_KEY));
      if (!Array.isArray(saved) || saved.length !== 2) {
        return [...DEFAULT_PLAYER_NAMES];
      }

      return saved.map((name, playerIndex) => normalizePlayerName(name, playerIndex));
    } catch {
      return [...DEFAULT_PLAYER_NAMES];
    }
  }

  function savePlayerNames() {
    try {
      sessionStorage.setItem(PLAYER_NAME_STORAGE_KEY, JSON.stringify(state.playerNames));
    } catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
  }

  function vibrate(pattern = 10) {
    navigator.vibrate?.(pattern);
  }

  function render() {
    renderBoard();
    renderStatus();
    renderSelection();
    renderHistory();
  }

  function renderBoard() {
    const fragment = document.createDocumentFragment();

    state.heaps.forEach((count, rowIndex) => {
      const row = document.createElement("div");
      row.className = "heap-row";
      row.dataset.row = String(rowIndex);
      row.classList.toggle("is-selecting", state.selectedRow === rowIndex);

      const meta = document.createElement("div");
      meta.className = "heap-meta";
      meta.innerHTML = `<span class="heap-name">第 ${ROW_NAMES[rowIndex]} 排</span>`;

      const stones = document.createElement("div");
      stones.className = "stones";
      stones.setAttribute("aria-label", `第 ${rowIndex + 1} 排，剩余 ${count} 颗石子`);

      if (count === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-heap";
        empty.textContent = "这一排已经取完";
        stones.append(empty);
      } else {
        for (let stoneIndex = 0; stoneIndex < count; stoneIndex += 1) {
          const stone = document.createElement("button");
          const selected = state.selectedRow === rowIndex && state.selectedIndices.has(stoneIndex);

          stone.type = "button";
          stone.className = "stone";
          stone.dataset.row = String(rowIndex);
          stone.dataset.index = String(stoneIndex);
          stone.classList.toggle("selected", selected);
          stone.setAttribute("aria-pressed", String(selected));
          stone.setAttribute("aria-label", `第 ${rowIndex + 1} 排第 ${stoneIndex + 1} 颗石子`);
          stones.append(stone);
        }
      }

      const counter = document.createElement("div");
      counter.className = "heap-count";
      counter.innerHTML = `${count}<small>剩余</small>`;

      row.append(meta, stones, counter);
      fragment.append(row);
    });

    elements.board.replaceChildren(fragment);
  }

  function renderStatus() {
    elements.appShell.classList.toggle("player-two-turn", state.currentPlayer === 1);

    elements.playerCards.forEach((card, playerIndex) => {
      const active = playerIndex === state.currentPlayer;
      card.classList.toggle("is-active", active);
      elements.playerNameLabels[playerIndex].textContent = playerName(playerIndex);
      elements.playerNameButtons[playerIndex].setAttribute(
        "aria-label",
        `编辑${playerName(playerIndex)}的姓名`
      );
      elements.turnPills[playerIndex].textContent = active ? "你的回合" : "等待";
      elements.scores[playerIndex].textContent = String(state.scores[playerIndex]);
    });

    elements.roundNumber.textContent = String(state.round);
    elements.remainingCount.textContent = String(remainingTotal());
    elements.turnKicker.textContent = `${playerName(state.currentPlayer)}，请选择`;
    elements.turnHeading.textContent = "从同一排取走任意颗";
  }

  function renderSelection() {
    const selectedCount = state.selectedIndices.size;
    const hasSelection = state.selectedRow !== null && selectedCount > 0;

    elements.takeButton.disabled = !hasSelection || state.gameOver || state.animating;
    elements.clearSelectionButton.disabled = !hasSelection || state.gameOver || state.animating;
    elements.takeCount.textContent = String(selectedCount);

    if (!hasSelection) {
      elements.selectionValue.textContent = "尚未选择";
      elements.selectionHint.textContent = "点按石子，或按住横向拖过多颗";
      return;
    }

    elements.selectionValue.textContent = `第 ${ROW_NAMES[state.selectedRow]} 排 · ${selectedCount} 颗`;
    elements.selectionHint.textContent = selectedCount === state.heaps[state.selectedRow]
      ? "将取完这一整排"
      : `这一排会剩下 ${state.heaps[state.selectedRow] - selectedCount} 颗`;
  }

  function renderHistory() {
    elements.lastMoveText.textContent = state.lastMove
      ? `${playerName(state.lastMove.player)}从第 ${ROW_NAMES[state.lastMove.row]} 排取走 ${state.lastMove.amount} 颗`
      : "比赛刚刚开始";

    elements.undoButton.disabled = state.history.length === 0 || state.gameOver || state.animating;
  }

  function clearSelection(shouldRender = true) {
    state.selectedRow = null;
    state.selectedIndices.clear();

    if (shouldRender) {
      renderBoard();
      renderSelection();
    }
  }

  function setStoneSelection(rowIndex, stoneIndex, mode) {
    if (state.gameOver || state.animating) return;

    if (state.selectedRow !== null && state.selectedRow !== rowIndex) {
      state.selectedIndices.clear();
    }

    state.selectedRow = rowIndex;

    if (mode === "select") state.selectedIndices.add(stoneIndex);
    else state.selectedIndices.delete(stoneIndex);

    if (state.selectedIndices.size === 0) state.selectedRow = null;

    renderBoard();
    renderSelection();
  }

  function stoneAtPoint(clientX, clientY) {
    return document.elementFromPoint(clientX, clientY)?.closest(".stone") ?? null;
  }

  function onPointerDown(event) {
    const stone = event.target.closest(".stone");
    if (!stone || state.gameOver || state.animating) return;

    event.preventDefault();

    const rowIndex = Number(stone.dataset.row);
    const stoneIndex = Number(stone.dataset.index);
    const selected = state.selectedRow === rowIndex && state.selectedIndices.has(stoneIndex);

    state.gesture = {
      pointerId: event.pointerId,
      rowIndex,
      mode: selected ? "deselect" : "select",
      visited: new Set([stoneIndex])
    };

    setStoneSelection(rowIndex, stoneIndex, state.gesture.mode);
    elements.board.setPointerCapture?.(event.pointerId);
    vibrate(7);
  }

  function onPointerMove(event) {
    if (!state.gesture || event.pointerId !== state.gesture.pointerId) return;

    event.preventDefault();
    const stone = stoneAtPoint(event.clientX, event.clientY);
    if (!stone) return;

    const rowIndex = Number(stone.dataset.row);
    const stoneIndex = Number(stone.dataset.index);

    if (rowIndex !== state.gesture.rowIndex || state.gesture.visited.has(stoneIndex)) return;

    state.gesture.visited.add(stoneIndex);
    setStoneSelection(rowIndex, stoneIndex, state.gesture.mode);
    vibrate(5);
  }

  function endPointerGesture(event) {
    if (state.gesture?.pointerId === event.pointerId) state.gesture = null;
  }

  function saveSnapshot() {
    state.history.push({
      heaps: [...state.heaps],
      currentPlayer: state.currentPlayer,
      lastMove: state.lastMove ? { ...state.lastMove } : null
    });
  }

  async function takeSelectedStones() {
    const amount = state.selectedIndices.size;
    const rowIndex = state.selectedRow;

    if (state.gameOver || state.animating || rowIndex === null || amount === 0) return;

    state.animating = true;
    renderSelection();
    renderHistory();
    saveSnapshot();

    const selectedStones = [...elements.board.querySelectorAll(`.stone[data-row="${rowIndex}"].selected`)];
    selectedStones.forEach((stone, index) => {
      window.setTimeout(() => stone.classList.add("removing"), index * 28);
    });

    vibrate([18, 25, 18]);
    await delay(190 + selectedStones.length * 28);

    const mover = state.currentPlayer;
    state.heaps[rowIndex] -= amount;
    state.lastMove = { player: mover, row: rowIndex, amount };
    clearSelection(false);

    if (remainingTotal() === 0) {
      const winner = mover === 0 ? 1 : 0;
      state.gameOver = true;
      state.scores[winner] += 1;
      state.animating = false;
      render();
      showResult(winner, mover);
      return;
    }

    state.currentPlayer = mover === 0 ? 1 : 0;
    state.animating = false;
    render();
    showTurnToast();
  }

  function undoLastMove() {
    const snapshot = state.history.pop();
    if (!snapshot || state.gameOver || state.animating) return;

    state.heaps = [...snapshot.heaps];
    state.currentPlayer = snapshot.currentPlayer;
    state.lastMove = snapshot.lastMove ? { ...snapshot.lastMove } : null;
    clearSelection(false);
    render();
    vibrate(12);
  }

  function showTurnToast() {
    window.clearTimeout(state.toastTimer);
    elements.toastLabel.textContent = `轮到${playerName(state.currentPlayer)}`;
    elements.turnToast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      elements.turnToast.hidden = true;
    }, 650);
  }

  function showResult(winner, loser) {
    elements.resultTitle.textContent = `${playerName(winner)}获胜`;
    elements.resultDescription.textContent = `${playerName(loser)}取走了全场最后一颗石子，因此本局判负。`;

    elements.resultScores.forEach((score, playerIndex) => {
      elements.resultPlayerNames[playerIndex].textContent = playerName(playerIndex);
      score.textContent = String(state.scores[playerIndex]);
      elements.nextStarterNames[playerIndex].textContent = playerName(playerIndex);
    });

    elements.resultModal.hidden = false;
    elements.nextStarterButtons[0].focus();
  }

  function resetRoundState() {
    state.heaps = [...INITIAL_HEAPS];
    state.selectedRow = null;
    state.selectedIndices.clear();
    state.lastMove = null;
    state.history = [];
    state.gesture = null;
    state.gameOver = false;
    state.animating = false;
  }

  function startNextRound(starter) {
    if (starter !== 0 && starter !== 1) return;

    elements.resultModal.hidden = true;
    state.round += 1;
    state.roundStarter = starter;
    state.currentPlayer = starter;
    resetRoundState();
    render();
    showTurnToast();
  }

  function startNewMatch() {
    elements.resultModal.hidden = true;
    state.scores = [0, 0];
    state.round = 1;
    state.roundStarter = 0;
    state.currentPlayer = 0;
    resetRoundState();
    render();
    vibrate(12);
  }

  function openRules() {
    elements.rulesModal.hidden = false;
    elements.closeRulesButton.focus();
  }

  function closeRules() {
    elements.rulesModal.hidden = true;
    elements.rulesButton.focus();
  }

  function openNameEditor(playerIndex = 0) {
    state.nameEditorTrigger = playerIndex;
    elements.playerNameInputs.forEach((input, index) => {
      input.value = playerName(index);
    });
    elements.nameModal.hidden = false;
    elements.playerNameInputs[playerIndex].focus();
    elements.playerNameInputs[playerIndex].select();
  }

  function closeNameEditor() {
    elements.nameModal.hidden = true;
    elements.playerNameButtons[state.nameEditorTrigger].focus();
  }

  function updatePlayerNames() {
    state.playerNames = elements.playerNameInputs.map((input, playerIndex) => (
      normalizePlayerName(input.value, playerIndex)
    ));
    savePlayerNames();
    render();
    closeNameEditor();
  }

  function resetPlayerNames() {
    state.playerNames = [...DEFAULT_PLAYER_NAMES];
    savePlayerNames();
    elements.playerNameInputs.forEach((input, playerIndex) => {
      input.value = state.playerNames[playerIndex];
    });
    render();
    elements.playerNameInputs[0].focus();
  }

  elements.board.addEventListener("pointerdown", onPointerDown);
  elements.board.addEventListener("pointermove", onPointerMove);
  elements.board.addEventListener("pointerup", endPointerGesture);
  elements.board.addEventListener("pointercancel", endPointerGesture);
  elements.board.addEventListener("lostpointercapture", () => {
    state.gesture = null;
  });

  elements.board.addEventListener("click", (event) => {
    const stone = event.target.closest(".stone");
    if (!stone || event.detail !== 0 || state.gameOver || state.animating) return;

    const rowIndex = Number(stone.dataset.row);
    const stoneIndex = Number(stone.dataset.index);
    const selected = state.selectedRow === rowIndex && state.selectedIndices.has(stoneIndex);
    setStoneSelection(rowIndex, stoneIndex, selected ? "deselect" : "select");
  });

  elements.takeButton.addEventListener("click", takeSelectedStones);
  elements.clearSelectionButton.addEventListener("click", () => {
    clearSelection();
    vibrate(7);
  });
  elements.undoButton.addEventListener("click", undoLastMove);
  elements.newMatchButton.addEventListener("click", startNewMatch);
  elements.nextStarterButtons.forEach((button, playerIndex) => {
    button.addEventListener("click", () => startNextRound(playerIndex));
  });
  elements.resetScoresButton.addEventListener("click", startNewMatch);
  elements.rulesButton.addEventListener("click", openRules);
  elements.closeRulesButton.addEventListener("click", closeRules);
  elements.understoodButton.addEventListener("click", closeRules);
  elements.playerNameButtons.forEach((button, playerIndex) => {
    button.addEventListener("click", () => openNameEditor(playerIndex));
  });
  elements.closeNameButton.addEventListener("click", closeNameEditor);
  elements.cancelNameButton.addEventListener("click", closeNameEditor);
  elements.resetNamesButton.addEventListener("click", resetPlayerNames);
  elements.nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updatePlayerNames();
  });

  elements.rulesModal.addEventListener("click", (event) => {
    if (event.target === elements.rulesModal) closeRules();
  });

  elements.nameModal.addEventListener("click", (event) => {
    if (event.target === elements.nameModal) closeNameEditor();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!elements.nameModal.hidden) closeNameEditor();
      else if (!elements.rulesModal.hidden) closeRules();
      else if (state.selectedIndices.size > 0) clearSelection();
    }

    if (
      event.key === "Enter" &&
      !elements.takeButton.disabled &&
      elements.resultModal.hidden &&
      elements.rulesModal.hidden &&
      elements.nameModal.hidden
    ) {
      takeSelectedStones();
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  render();
})();
