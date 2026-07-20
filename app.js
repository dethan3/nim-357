(() => {
  "use strict";

  const INITIAL_HEAPS = [3, 5, 7];
  const PLAYERS = ["玩家一", "玩家二"];
  const HEAP_NAMES = ["三", "五", "七"];

  const elements = {
    appShell: document.querySelector(".app-shell"),
    board: document.querySelector("#board"),
    playerCards: [
      document.querySelector("#playerCard0"),
      document.querySelector("#playerCard1")
    ],
    turnPills: [
      document.querySelector("#turnPill0"),
      document.querySelector("#turnPill1")
    ],
    scores: [
      document.querySelector("#score0"),
      document.querySelector("#score1")
    ],
    roundNumber: document.querySelector("#roundNumber"),
    remainingCount: document.querySelector("#remainingCount"),
    turnKicker: document.querySelector("#turnKicker"),
    turnHeading: document.querySelector("#turnHeading"),
    selectionValue: document.querySelector("#selectionValue"),
    selectionHint: document.querySelector("#selectionHint"),
    takeButton: document.querySelector("#takeButton"),
    takeCount: document.querySelector("#takeCount"),
    clearSelectionButton: document.querySelector("#clearSelectionButton"),
    lastMoveText: document.querySelector("#lastMoveText"),
    undoButton: document.querySelector("#undoButton"),
    newMatchButton: document.querySelector("#newMatchButton"),
    rulesButton: document.querySelector("#rulesButton"),
    rulesModal: document.querySelector("#rulesModal"),
    closeRulesButton: document.querySelector("#closeRulesButton"),
    understoodButton: document.querySelector("#understoodButton"),
    resultModal: document.querySelector("#resultModal"),
    resultTitle: document.querySelector("#resultTitle"),
    resultDescription: document.querySelector("#resultDescription"),
    resultScores: [
      document.querySelector("#resultScore0"),
      document.querySelector("#resultScore1")
    ],
    nextRoundButton: document.querySelector("#nextRoundButton"),
    resetScoresButton: document.querySelector("#resetScoresButton"),
    turnToast: document.querySelector("#turnToast"),
    toastLabel: document.querySelector("#toastLabel")
  };

  const state = {
    heaps: [...INITIAL_HEAPS],
    scores: [0, 0],
    round: 1,
    currentPlayer: 0,
    selectedRow: null,
    selectedIndices: new Set(),
    lastMove: null,
    history: [],
    gesture: null,
    gameOver: false,
    animating: false,
    toastTimer: null
  };

  function remainingTotal() {
    return state.heaps.reduce((sum, count) => sum + count, 0);
  }

  function vibrate(pattern = 10) {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
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

      if (state.selectedRow === rowIndex) {
        row.classList.add("is-selecting");
      }

      const meta = document.createElement("div");
      meta.className = "heap-meta";
      meta.innerHTML = `
        <span class="heap-name">第 ${HEAP_NAMES[rowIndex]} 排</span>
        <strong class="heap-number">${INITIAL_HEAPS[rowIndex]}</strong>
      `;

      const stones = document.createElement("div");
      stones.className = "stones";
      stones.setAttribute(
        "aria-label",
        `第 ${rowIndex + 1} 排，剩余 ${count} 颗石子`
      );

      if (count === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-heap";
        empty.textContent = "这一排已经取完";
        stones.append(empty);
      } else {
        for (let index = 0; index < count; index += 1) {
          const stone = document.createElement("button");
          stone.type = "button";
          stone.className = "stone";
          stone.dataset.row = String(rowIndex);
          stone.dataset.index = String(index);
          stone.setAttribute(
            "aria-label",
            `第 ${rowIndex + 1} 排第 ${index + 1} 颗石子`
          );

          const isSelected =
            state.selectedRow === rowIndex &&
            state.selectedIndices.has(index);

          stone.classList.toggle("selected", isSelected);
          stone.setAttribute("aria-pressed", String(isSelected));
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
    elements.appShell.classList.toggle(
      "player-two-turn",
      state.currentPlayer === 1
    );

    elements.playerCards.forEach((card, index) => {
      card.classList.toggle("is-active", index === state.currentPlayer);
      elements.turnPills[index].textContent =
        index === state.currentPlayer ? "你的回合" : "等待";
      elements.scores[index].textContent = String(state.scores[index]);
    });

    elements.roundNumber.textContent = String(state.round);
    elements.remainingCount.textContent = String(remainingTotal());
    elements.turnKicker.textContent =
      `${PLAYERS[state.currentPlayer]}，请选择`;
    elements.turnHeading.textContent = "从同一排取走任意颗";
  }

  function renderSelection() {
    const selectedCount = state.selectedIndices.size;
    const hasSelection =
      state.selectedRow !== null && selectedCount > 0;

    elements.takeButton.disabled =
      !hasSelection || state.gameOver || state.animating;
    elements.clearSelectionButton.disabled =
      !hasSelection || state.gameOver || state.animating;
    elements.takeCount.textContent = String(selectedCount);

    if (!hasSelection) {
      elements.selectionValue.textContent = "尚未选择";
      elements.selectionHint.textContent =
        "点按石子，或按住横向拖过多颗";
      return;
    }

    elements.selectionValue.textContent =
      `第 ${HEAP_NAMES[state.selectedRow]} 排 · ${selectedCount} 颗`;
    elements.selectionHint.textContent =
      selectedCount === state.heaps[state.selectedRow]
        ? "将取完这一整排"
        : `这一排会剩下 ${state.heaps[state.selectedRow] - selectedCount} 颗`;
  }

  function renderHistory() {
    if (!state.lastMove) {
      elements.lastMoveText.textContent = "比赛刚刚开始";
    } else {
      const { player, row, amount } = state.lastMove;
      elements.lastMoveText.textContent =
        `${PLAYERS[player]}从第 ${HEAP_NAMES[row]} 排取走 ${amount} 颗`;
    }

    elements.undoButton.disabled =
      state.history.length === 0 || state.gameOver || state.animating;
  }

  function clearSelection({ shouldRender = true } = {}) {
    state.selectedRow = null;
    state.selectedIndices.clear();

    if (shouldRender) {
      renderBoard();
      renderSelection();
    }
  }

  function setStoneSelection(rowIndex, stoneIndex, mode) {
    if (state.gameOver || state.animating) {
      return;
    }

    if (
      state.selectedRow !== null &&
      state.selectedRow !== rowIndex
    ) {
      state.selectedIndices.clear();
    }

    state.selectedRow = rowIndex;

    if (mode === "select") {
      state.selectedIndices.add(stoneIndex);
    } else {
      state.selectedIndices.delete(stoneIndex);
    }

    if (state.selectedIndices.size === 0) {
      state.selectedRow = null;
    }

    renderBoard();
    renderSelection();
  }

  function stoneAtPoint(clientX, clientY) {
    return document.elementFromPoint(clientX, clientY)?.closest(".stone") ?? null;
  }

  function onPointerDown(event) {
    const stone = event.target.closest(".stone");

    if (!stone || state.gameOver || state.animating) {
      return;
    }

    event.preventDefault();

    const rowIndex = Number(stone.dataset.row);
    const stoneIndex = Number(stone.dataset.index);
    const isSelected =
      state.selectedRow === rowIndex &&
      state.selectedIndices.has(stoneIndex);

    state.gesture = {
      pointerId: event.pointerId,
      rowIndex,
      mode: isSelected ? "deselect" : "select",
      visited: new Set([stoneIndex])
    };

    setStoneSelection(
      rowIndex,
      stoneIndex,
      state.gesture.mode
    );

    elements.board.setPointerCapture?.(event.pointerId);
    vibrate(7);
  }

  function onPointerMove(event) {
    if (
      !state.gesture ||
      event.pointerId !== state.gesture.pointerId
    ) {
      return;
    }

    event.preventDefault();

    const stone = stoneAtPoint(event.clientX, event.clientY);
    if (!stone) {
      return;
    }

    const rowIndex = Number(stone.dataset.row);
    const stoneIndex = Number(stone.dataset.index);

    if (
      rowIndex !== state.gesture.rowIndex ||
      state.gesture.visited.has(stoneIndex)
    ) {
      return;
    }

    state.gesture.visited.add(stoneIndex);
    setStoneSelection(
      rowIndex,
      stoneIndex,
      state.gesture.mode
    );
    vibrate(5);
  }

  function endPointerGesture(event) {
    if (
      !state.gesture ||
      event.pointerId !== state.gesture.pointerId
    ) {
      return;
    }

    state.gesture = null;
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

    if (
      state.gameOver ||
      state.animating ||
      rowIndex === null ||
      amount === 0
    ) {
      return;
    }

    state.animating = true;
    renderSelection();
    renderHistory();

    saveSnapshot();

    const selectedStones = [
      ...elements.board.querySelectorAll(
        `.stone[data-row="${rowIndex}"].selected`
      )
    ];

    selectedStones.forEach((stone, index) => {
      window.setTimeout(() => {
        stone.classList.add("removing");
      }, index * 28);
    });

    vibrate([18, 25, 18]);

    await delay(190 + selectedStones.length * 28);

    const mover = state.currentPlayer;
    state.heaps[rowIndex] -= amount;
    state.lastMove = {
      player: mover,
      row: rowIndex,
      amount
    };
    clearSelection({ shouldRender: false });

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

    if (!snapshot || state.gameOver || state.animating) {
      return;
    }

    state.heaps = [...snapshot.heaps];
    state.currentPlayer = snapshot.currentPlayer;
    state.lastMove = snapshot.lastMove ? { ...snapshot.lastMove } : null;
    clearSelection({ shouldRender: false });
    render();
    vibrate(12);
  }

  function showTurnToast() {
    window.clearTimeout(state.toastTimer);

    elements.toastLabel.textContent =
      `轮到${PLAYERS[state.currentPlayer]}`;
    elements.turnToast.hidden = false;

    state.toastTimer = window.setTimeout(() => {
      elements.turnToast.hidden = true;
    }, 650);
  }

  function showResult(winner, loser) {
    elements.resultTitle.textContent = `${PLAYERS[winner]}获胜`;
    elements.resultDescription.textContent =
      `${PLAYERS[loser]}取走了全场最后一颗石子，因此本局判负。`;

    elements.resultScores.forEach((score, index) => {
      score.textContent = String(state.scores[index]);
    });

    elements.resultModal.hidden = false;
  }

  function startNextRound() {
    elements.resultModal.hidden = true;
    state.heaps = [...INITIAL_HEAPS];
    state.round += 1;
    state.currentPlayer = state.round % 2 === 1 ? 0 : 1;
    state.selectedRow = null;
    state.selectedIndices.clear();
    state.lastMove = null;
    state.history = [];
    state.gesture = null;
    state.gameOver = false;
    state.animating = false;
    render();
    showTurnToast();
  }

  function startNewMatch() {
    elements.resultModal.hidden = true;
    state.heaps = [...INITIAL_HEAPS];
    state.scores = [0, 0];
    state.round = 1;
    state.currentPlayer = 0;
    state.selectedRow = null;
    state.selectedIndices.clear();
    state.lastMove = null;
    state.history = [];
    state.gesture = null;
    state.gameOver = false;
    state.animating = false;
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

  function delay(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  elements.board.addEventListener("pointerdown", onPointerDown);
  elements.board.addEventListener("pointermove", onPointerMove);
  elements.board.addEventListener("click", (event) => {
    const stone = event.target.closest(".stone");

    if (
      !stone ||
      event.detail !== 0 ||
      state.gameOver ||
      state.animating
    ) {
      return;
    }

    const rowIndex = Number(stone.dataset.row);
    const stoneIndex = Number(stone.dataset.index);
    const isSelected =
      state.selectedRow === rowIndex &&
      state.selectedIndices.has(stoneIndex);

    setStoneSelection(
      rowIndex,
      stoneIndex,
      isSelected ? "deselect" : "select"
    );
  });
  elements.board.addEventListener("pointerup", endPointerGesture);
  elements.board.addEventListener("pointercancel", endPointerGesture);
  elements.board.addEventListener("lostpointercapture", () => {
    state.gesture = null;
  });

  elements.takeButton.addEventListener("click", takeSelectedStones);
  elements.clearSelectionButton.addEventListener("click", () => {
    clearSelection();
    vibrate(7);
  });
  elements.undoButton.addEventListener("click", undoLastMove);
  elements.newMatchButton.addEventListener("click", startNewMatch);
  elements.nextRoundButton.addEventListener("click", startNextRound);
  elements.resetScoresButton.addEventListener("click", startNewMatch);

  elements.rulesButton.addEventListener("click", openRules);
  elements.closeRulesButton.addEventListener("click", closeRules);
  elements.understoodButton.addEventListener("click", closeRules);

  elements.rulesModal.addEventListener("click", (event) => {
    if (event.target === elements.rulesModal) {
      closeRules();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!elements.rulesModal.hidden) {
        closeRules();
      } else if (state.selectedIndices.size > 0) {
        clearSelection();
      }
    }

    if (
      event.key === "Enter" &&
      !elements.takeButton.disabled &&
      elements.resultModal.hidden &&
      elements.rulesModal.hidden
    ) {
      takeSelectedStones();
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // The game remains fully usable without offline caching.
      });
    });
  }

  render();
})();
