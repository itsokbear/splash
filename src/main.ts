import './style.css';
import data from '../plukh_codex/levels.json';
import type { Cell, LevelDefinition, MoveResult } from './core/types';
import type { SolveResult } from './core/solver';
import { getStateKey } from './core/solver';
import { createInitialState, getLegalTargets, same, simulateMove, validateLevel } from './core/rules';
import { GameSession } from './app/session';
import { isUnlocked, readProgress, recordWin, writeProgress, type StorageLike } from './app/storage';
import { drawBoard, animateMove } from './ui/board';
import { icon, miniFrog, referencePiece } from './ui/art';
import { GameAudio } from './presentation/audio';

const levels = data.levels as unknown as LevelDefinition[];
for (const level of levels) {
  const validation = validateLevel(level);
  if (!validation.valid) throw new Error(`${level.id}: ${validation.errors.join(', ')}`);
}
let storage: StorageLike | undefined;
try { storage = localStorage; } catch { /* Private mode can disable access. */ }
let progress = readProgress(levels, storage);
const session = new GameSession(levels.find(l => l.id === progress.lastLevel) ?? levels[0]);
const audio = new GameAudio();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let hint: Cell | null = null;
let message = '';
let searching = false;
let worker: Worker | null = null;
let workerTimeout: ReturnType<typeof setTimeout> | undefined;
let animations: Animation[] = [];
let transitionId = 0;
type Screen = 'menu' | 'levels' | 'win' | 'restart' | 'leave';
let screen: Screen | null = null;
let pendingLevel: LevelDefinition | null = null;
let focusBeforeDialog: HTMLElement | null = null;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="scenery" aria-hidden="true"></div>
  <main class="game-shell">
    <section class="game" aria-label="Игра Плюх!">
      <header class="game-header">
        <div class="moves-card" aria-live="polite" aria-atomic="true"><span>Ходы</span><strong data-testid="moves">0</strong></div>
        <div class="brand"><h1 class="visually-hidden">Плюх!</h1>${referencePiece('242 18 490 204', 'brand-art', 'M248 85Q249 50 291 47L298 27L340 17L381 40L567 34L618 18L657 22L661 76L711 91L730 150L705 207L590 207L590 169L352 169L352 207L267 207L247 173Z')}</div>
        <button class="menu-button" data-action="menu" aria-label="Меню">${referencePiece('780 55 127 130', 'pause-art', 'M846 58C924 57 922 179 846 180C770 180 765 63 846 58Z')}</button>
      </header>
      <div class="level-strip"><span class="level-number" data-testid="level-number">Уровень 1</span><span class="level-line"></span><h2 data-testid="level-title"></h2><button data-action="levels" class="level-dots" aria-label="Выбрать уровень"></button></div>
      <div class="pond-frame">
        <div class="board" data-testid="board"></div>
      </div>
      <div class="guidance" role="status" aria-live="polite"><div class="guide-frog">${miniFrog}</div><div><strong data-testid="guidance-title"></strong><p data-testid="guidance-text"></p></div></div>
      <nav class="controls" aria-label="Управление игрой">
        <button data-action="undo" class="control undo">${referencePiece('135 1428 199 185', 'control-art', 'M151 1462Q163 1430 202 1430L278 1430Q316 1430 323 1475L332 1545Q332 1605 288 1608L183 1608Q140 1602 137 1559L140 1498Z')}<span class="visually-hidden">Отменить</span></button>
        <button data-action="restart" class="control restart">${referencePiece('374 1428 199 185', 'control-art', 'M390 1460Q403 1430 438 1430L520 1430Q554 1433 561 1470L573 1546Q577 1597 538 1608L427 1611Q381 1607 377 1563L378 1497Z')}<span class="visually-hidden">Заново</span></button>
        <button data-action="hint" class="control hint">${referencePiece('610 1428 201 185', 'control-art', 'M630 1456Q644 1431 682 1431L751 1431Q795 1432 803 1477L811 1549Q814 1603 770 1609L667 1611Q620 1607 615 1566L616 1498Z')}<span class="visually-hidden">Подсказка</span></button>
      </nav>
    </section>
  </main>
  <dialog aria-labelledby="dialog-title" data-testid="dialog"></dialog>`;
const board = app.querySelector<HTMLDivElement>('.board')!;
const dialog = app.querySelector<HTMLDialogElement>('dialog')!;
const find = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector)!;

function cancelHint() {
  worker?.terminate(); worker = null;
  clearTimeout(workerTimeout); searching = false; hint = null; message = '';
}
function save() { writeProgress(progress, storage); }
function tutorial(): [string, string] {
  if (searching) return ['Ищем дорожку…', 'Лягушка немного подумает.'];
  if (message) return ['Маленькая подсказка', message];
  if (session.state.status === 'won') return ['Ты дома!', 'Можно немного отдохнуть — или отправиться к следующему пруду.'];
  if (session.selected) {
    const p = simulateMove(session.level, session.state, session.selected);
    const blocked = p.ok ? p.wave.find(w => w.blockedBy) : undefined;
    const why = blocked ? ({ rock: 'Мешает камень.', land: 'Дальше берег.', boundary: 'Дальше берег.', pad: 'Мешает другой лист.' } as const)[blocked.blockedBy!] : '';
    const first = session.level.id === 'level-01' && getStateKey(session.level, session.state) === getStateKey(session.level, createInitialState(session.level));
    return [first ? 'Волна сдвинет соседний лист.' : why || 'Дорожка готова.', 'Нажми ещё раз, чтобы прыгнуть.'];
  }
  if (!getLegalTargets(session.level, session.state).length) return ['Прыгать некуда.', 'Отмени ход или начни заново.'];
  if (hint) return ['Вот следующий прыжок.', 'Выбери клетку со стрелочкой и нажми на неё ещё раз.'];
  if (session.level.id === 'level-01') {
    let state = createInitialState(session.level);
    const key = getStateKey(session.level, session.state);
    if (key === getStateKey(session.level, state)) return ['Нажми на подсвеченную кувшинку.', 'После прыжка волна сдвинет соседние листья.'];
    for (const [i, target] of session.level.referenceSolution.entries()) {
      const result = simulateMove(session.level, state, target);
      if (!result.ok) break; state = result.next;
      if (key === getStateKey(session.level, state)) return i === 0 ? ['Теперь следующий лист ближе к дому.', 'Прыгай на него.'] : ['Домик уже рядом.', 'Прыгай на берег!'];
    }
  }
  return ['Помоги лягушке добраться домой.', 'Прыгай прямо на 1–2 клетки. Волна отталкивает соседние листья.'];
}
function render() {
  const index = levels.indexOf(session.level);
  find('[data-testid="moves"]').textContent = String(session.state.moves);
  find('[data-testid="moves"]').setAttribute('aria-label', `Ходы: ${session.state.moves}`);
  find('[data-testid="level-number"]').textContent = `Уровень ${index + 1}`;
  find('[data-testid="level-title"]').textContent = session.level.title;
  find('.level-dots').setAttribute('aria-description', `Уровень ${index + 1} из ${levels.length}`);
  const preview = session.selected ? simulateMove(session.level, session.state, session.selected) : null;
  drawBoard(board, session.level, session.state, session.selected, preview, hint, session.busy);
  const [title, text] = tutorial();
  find('[data-testid="guidance-title"]').textContent = title;
  find('[data-testid="guidance-text"]').textContent = text;
  find<HTMLButtonElement>('[data-action="undo"]').disabled = session.busy || session.history.length === 0;
  find<HTMLButtonElement>('[data-action="restart"]').disabled = session.busy;
  find<HTMLButtonElement>('[data-action="hint"]').disabled = session.busy || searching || session.state.status === 'won';
}
function stopAnimation() {
  transitionId++;
  for (const animation of animations) animation.cancel();
  animations = []; session.busy = false;
}
function openScreen(next: Screen) {
  stopAnimation(); cancelHint(); session.invalidate(); render(); screen = next;
  if (!dialog.open) focusBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  drawScreen();
  if (!dialog.open) dialog.showModal();
  const focusTarget = dialog.querySelector<HTMLElement>(next === 'levels' ? '.level-option.active' : 'button:not([disabled])');
  focusTarget?.focus();
  if (next === 'levels') focusTarget?.scrollIntoView({ block: 'nearest' });
}
function closeScreen() {
  screen = null; dialog.close(); pendingLevel = null; render();
  if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus({ preventScroll: true });
}
const dialogButton = (action: string, text: string, primary = false) => `<button data-action="${action}" class="dialog-button ${primary ? 'primary' : ''}">${text}</button>`;
function drawScreen() {
  const index = levels.indexOf(session.level);
  const isLastLevel = index === levels.length - 1;
  const close = `<button data-action="close" class="dialog-close" aria-label="Закрыть">${icon('close')}</button>`;
  let html = '';
  if (screen === 'menu') html = `${close}<span class="eyebrow">МОЖНО НЕМНОГО ОТДОХНУТЬ</span><h2 id="dialog-title">Тихий час</h2><p class="dialog-description">Пруд никуда не спешит.<br>Продолжим, когда будешь готов.</p>${dialogButton('continue', 'Продолжить', true)}${dialogButton('levels', 'Уровни')}<button data-action="sound" class="sound-switch" role="switch" aria-checked="${progress.sound}">${icon('sound')}<span>Звук</span><span class="toggle ${progress.sound ? 'on' : ''}"><i></i></span><small>${progress.sound ? 'Включён' : 'Выключен'}</small></button><p class="keyboard-note">Два нажатия — один прыжок<br>Tab · Enter / Пробел · U — отмена · Esc — меню</p>`;
  if (screen === 'levels') html = `${close}<span class="eyebrow">МАЛЕНЬКАЯ ДОРОГА ДОМОЙ</span><h2 id="dialog-title">Тихие пруды</h2><p class="dialog-description">Пройдено ${levels.filter(l => progress.best[l.id] !== undefined).length} из ${levels.length}. Каждый — новое приключение.</p><div class="level-list">${levels.map((l, i) => {
    const unlocked = isUnlocked(levels, progress, i), best = progress.best[l.id];
    return `<button class="level-option ${l.id === session.level.id ? 'active' : ''}" data-action="level" data-level="${i}" ${unlocked ? '' : 'disabled'}><span class="level-badge">${String(i + 1).padStart(2, '0')}</span><span><strong>${l.title}</strong><small>${best !== undefined ? `Лучший результат: ${best} ходов` : unlocked ? 'Дорога ждёт' : `Пройди уровень ${i}`}</small></span>${icon(!unlocked ? 'lock' : best !== undefined ? 'check' : 'arrow')}</button>`;
  }).join('')}</div>`;
  if (screen === 'win') html = `<div class="victory-frog">${miniFrog}</div><span class="eyebrow">${isLastLevel ? 'ВСЕ ПРУДЫ ПОЗАДИ' : 'ЕЩЁ ОДНО МАЛЕНЬКОЕ ПРИКЛЮЧЕНИЕ'}</span><h2 id="dialog-title">Ты дома!</h2><p class="dialog-description">${isLastLevel ? 'Все уровни пройдены. Спасибо за эту прогулку!' : 'В домике тепло. А впереди — новый пруд.'}</p><div class="result-stats"><div><span>ХОДЫ</span><strong>${session.state.moves}</strong></div><span class="stats-divider"></span><div><span>ЛУЧШИЙ РЕЗУЛЬТАТ</span><strong>${progress.best[session.level.id]}</strong></div></div>${dialogButton(isLastLevel ? 'levels' : 'next', isLastLevel ? 'Уровни' : `Следующий уровень ${icon('arrow')}`, true)}${dialogButton('replay', 'Переиграть')}${dialogButton('win-undo', 'Отменить последний ход')}`;
  if (screen === 'restart' || screen === 'leave') html = `<div class="confirm-icon">${icon('restart')}</div><h2 id="dialog-title">${screen === 'restart' ? 'Начать уровень заново?' : 'Перейти к другому пруду?'}</h2><p class="dialog-description">Текущая попытка начнётся сначала.<br>Пройденные уровни и рекорды сохранятся.</p>${dialogButton(screen === 'restart' ? 'confirm-restart' : 'confirm-leave', screen === 'restart' ? 'Заново' : 'Перейти', true)}${dialogButton('continue', 'Продолжить')}`;
  dialog.innerHTML = `<div class="dialog-content">${html}</div>`;
}
function changeLevel(level: LevelDefinition) {
  stopAnimation(); cancelHint(); session.changeLevel(level);
  progress.lastLevel = level.id; save(); closeScreen();
}
function requestLevel(level: LevelDefinition) {
  if (session.state.moves > 0 && session.state.status === 'playing') { pendingLevel = level; openScreen('leave'); }
  else changeLevel(level);
}
function undo() { if (session.undo()) { cancelHint(); audio.play('ui', progress.sound); if (screen) closeScreen(); else render(); } }
async function select(cell: Cell) {
  if (screen || session.busy) return;
  const result = session.select(cell);
  if (!result?.ok) { message = ''; render(); audio.play('ui', progress.sound); return; }
  cancelHint();
  if (result.next.status === 'won') { progress = recordWin(progress, session.level.id, result.next.moves); save(); }
  render(); audio.play(result.next.status === 'won' ? 'win' : 'jump', progress.sound);
  const token = ++transitionId;
  animations = animateMove(board, result, reducedMotion.matches);
  await Promise.all(animations.map(a => a.finished.catch(() => {})));
  if (transitionId !== token) return;
  for (const animation of animations) animation.cancel();
  animations = []; session.busy = false; render();
  if (session.state.status === 'won') openScreen('win');
}
function requestHint() {
  if (screen || session.busy || searching || session.state.status === 'won') return;
  cancelHint(); searching = true;
  const revision = session.revision;
  const unavailable = () => {
    if (revision !== session.revision || screen) return;
    cancelHint(); message = 'Не удалось быстро найти подсказку. Можно отменить ход или продолжить самому'; render();
  };
  try {
    worker = new Worker(new URL('./workers/solver.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ revision: number; result: SolveResult }>) => {
      if (event.data.revision !== session.revision || screen) return;
      const { result } = event.data; cancelHint();
      if (result.status === 'solved') hint = result.path[0] ?? null;
      else message = result.status === 'unreachable' ? 'Из этой позиции к дому не попасть. Попробуй отменить ход' : 'Не удалось быстро найти подсказку. Можно отменить ход или продолжить самому';
      render();
    };
    worker.onerror = event => { event.preventDefault(); unavailable(); };
    worker.postMessage({ revision, level: session.level, state: session.state });
    workerTimeout = setTimeout(unavailable, 1800);
  } catch { unavailable(); }
  render();
}
let pointerStart: { x: number; y: number; cell: string | undefined; id: number } | null = null;
let dragged = false;
board.addEventListener('pointerdown', event => {
  const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-cell]')?.dataset.cell;
  pointerStart = { x: event.clientX, y: event.clientY, cell, id: event.pointerId }; dragged = false;
});
window.addEventListener('pointermove', event => {
  if (pointerStart && pointerStart.id === event.pointerId && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) dragged = true;
});
window.addEventListener('pointerup', event => {
  if (pointerStart) {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-cell]')?.dataset.cell;
    if (cell !== pointerStart.cell) dragged = true;
    pointerStart = null;
  }
});
window.addEventListener('pointercancel', () => { dragged = true; pointerStart = null; });
app.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button');
  if (!button || button.disabled) return;
  if (button.dataset.cell) {
    if (event.detail !== 0 && dragged) return;
    void select(button.dataset.cell.split(',').map(Number) as unknown as Cell); return;
  }
  const action = button.dataset.action;
  if (screen && !dialog.contains(button)) return;
  if (action !== 'hint') audio.play('ui', progress.sound);
  switch (action) {
    case 'menu': openScreen('menu'); break;
    case 'close': case 'continue': closeScreen(); if (session.state.status === 'won') openScreen('win'); break;
    case 'levels': openScreen('levels'); break;
    case 'undo': case 'win-undo': undo(); break;
    case 'restart': if (session.state.moves > 0) openScreen('restart'); else { cancelHint(); session.restart(); render(); } break;
    case 'replay': case 'confirm-restart': cancelHint(); session.restart(); closeScreen(); break;
    case 'hint': requestHint(); break;
    case 'sound': progress.sound = !progress.sound; save(); audio.play('ui', progress.sound); drawScreen(); dialog.querySelector<HTMLElement>('[data-action="sound"]')?.focus(); break;
    case 'next': if (indexOfLevel() < levels.length - 1) changeLevel(levels[indexOfLevel() + 1]); break;
    case 'level': { const i = Number(button.dataset.level); if (isUnlocked(levels, progress, i)) requestLevel(levels[i]); break; }
    case 'confirm-leave': if (pendingLevel) changeLevel(pendingLevel); break;
  }
});
function indexOfLevel() { return levels.indexOf(session.level); }
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (screen) { if (screen !== 'win') closeScreen(); }
    else if (session.selected) { session.selected = null; render(); }
    else openScreen('menu');
  } else if ((event.code === 'KeyU' && !event.ctrlKey && !event.metaKey) || ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ')) {
    if (!screen || screen === 'win') { event.preventDefault(); undo(); }
  }
});
dialog.addEventListener('cancel', event => { event.preventDefault(); });
function finishPresentation() {
  if (session.busy) { stopAnimation(); render(); if (session.state.status === 'won' && !screen) openScreen('win'); }
}
window.addEventListener('resize', finishPresentation);
document.addEventListener('visibilitychange', () => { if (document.hidden) finishPresentation(); });
reducedMotion.addEventListener('change', finishPresentation);
render();
