import type { Cell, GameState, LevelDefinition, MoveResult } from '../core/types';
import { getLegalTargets, same } from '../core/rules';
import { symbols } from './art';
const pos = (c: Cell) => `${c[0] * 100 + 50}px, ${c[1] * 100 + 50}px`;
const use = (id: string, w = 100, h = 100, y = -50) => `<use href="#${id}" x="${-w / 2}" y="${y}" width="${w}" height="${h}"/>`;
export function drawBoard(root: HTMLElement, level: LevelDefinition, state: GameState, selected: Cell | null, preview: MoveResult | null, hint: Cell | null, busy: boolean) {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.testid : undefined;
  const legal = getLegalTargets(level, state);
  const cells = Array.from({ length: 49 }, (_, i): Cell => [i % 7, Math.floor(i / 7)]);
  root.dataset.busy = String(busy);
  root.innerHTML = `<svg class="pond" viewBox="0 0 700 700" aria-hidden="true">${symbols}
    <g fill="#3899be" fill-opacity=".08" stroke="#b7f4f5" stroke-opacity=".4" stroke-width="2.5">${cells.map(([x, y]) => `<rect x="${x * 100 + 2}" y="${y * 100 + 2}" width="96" height="96" rx="18"/>`).join('')}</g>
    <g fill="none" stroke="#d0ffff" stroke-width="3" stroke-linecap="round" opacity=".6">${cells.filter((_, i) => i % 3 !== 1).map(([x, y]) => `<path d="M${x * 100 + 9} ${y * 100 + 18}q0-8 8-9m7-2h4M${x * 100 + 78} ${y * 100 + 93}q8 0 12-7"/>`).join('')}</g>
    <g>${level.land.map(c => `<g style="transform:translate(${pos(c)})">${use('island')}${same(c, level.goal) ? use('home-art', 87, 100, -62) : ''}</g>`).join('')}</g>
    <g>${level.rocks.map(c => `<g style="transform:translate(${pos(c)})">${use('rock-art', 90, 90, -45)}</g>`).join('')}</g>
    <g>${state.pads.map(p => `<g id="pad-${p.id}" data-testid="pad-${p.id}" data-at="${p.at.join(',')}" style="transform:translate(${pos(p.at)})">${use('lily', 90, 90, -45)}</g>`).join('')}</g>
    <g class="target-rings" fill="none">${legal.map(c => `<circle cx="${c[0] * 100 + 50}" cy="${c[1] * 100 + 50}" r="46" stroke="#f4ffe2" stroke-width="${selected && same(c, selected) ? 4 : 2.5}" ${selected && same(c, selected) ? '' : 'stroke-dasharray="4 7"'} opacity="${busy ? 0 : 1}"/>`).join('')}</g>
    <g data-testid="preview">${preview?.ok ? `
      <path d="M${preview.jump.from[0] * 100 + 50} ${preview.jump.from[1] * 100 + 40}Q${(preview.jump.from[0] + preview.jump.to[0]) * 50 + 50} ${(preview.jump.from[1] + preview.jump.to[1]) * 50 - 35} ${preview.jump.to[0] * 100 + 50} ${preview.jump.to[1] * 100 + 30}" fill="none" stroke="#fffbe4" stroke-width="3" stroke-dasharray="5 9" marker-end="url(#arrow)"/>
      ${preview.wave.map(w => w.blockedBy ? `<g transform="translate(${w.from[0] * 100 + 50} ${w.from[1] * 100 + 20})"><circle r="13" fill="#fff6d9"/><path d="M-5-5L5 5M5-5L-5 5" stroke="#926748" stroke-width="3" stroke-linecap="round"/></g>` : `<g data-testid="wave-preview"><g opacity=".38" style="transform:translate(${pos(w.to)})">${use('lily', 90, 90, -45)}</g><path d="M${w.from[0] * 100 + 50} ${w.from[1] * 100 + 50}L${w.to[0] * 100 + 50} ${w.to[1] * 100 + 50}" fill="none" stroke="#fffbe4" stroke-width="4" marker-end="url(#arrow)"/></g>`).join('')}` : ''}</g>
    <g id="wave-effect"></g>
    <g id="frog" data-testid="frog" data-at="${state.frog.join(',')}" style="transform:translate(${pos(state.frog)})">${use('frog-art', 78, 86, -60)}</g>
    ${hint ? `<g data-testid="hint-marker" transform="translate(${hint[0] * 100 + 50} ${hint[1] * 100 + 4})"><path d="M-13-14H13L0 0Z" fill="#fff8ce" stroke="#638444" stroke-width="2"/></g>` : ''}
  </svg><div class="cell-targets" role="group" aria-label="Пруд, поле 7 на 7">${cells.map(c => {
    const valid = legal.some(t => same(t, c));
    const kind = same(c, level.goal) ? 'Домик' : level.land.some(t => same(t, c)) ? 'Берег' : state.pads.some(p => same(p.at, c)) ? 'Кувшинка' : level.rocks.some(t => same(t, c)) ? 'Камень' : 'Вода';
    const isSelected = selected !== null && same(selected, c);
    return `<button class="cell" data-cell="${c.join(',')}" data-testid="cell-${c.join('-')}" tabindex="${valid && !busy ? 0 : -1}" aria-label="${kind}, столбец ${c[0] + 1}, строка ${c[1] + 1}${isSelected ? '. Нажми ещё раз, чтобы прыгнуть' : valid ? '. Можно прыгнуть' : ''}" aria-pressed="${isSelected}" ${busy ? 'disabled' : ''}></button>`;
  }).join('')}</div>`;
  if (active) root.querySelector<HTMLElement>(`[data-testid="${active}"]`)?.focus({ preventScroll: true });
}
export function animateMove(root: HTMLElement, result: Extract<MoveResult, { ok: true }>, reduced: boolean): Animation[] {
  if (reduced) return [];
  const animations: Animation[] = [];
  const { from, to } = result.jump;
  const frog = root.querySelector('#frog')!;
  animations.push(frog.animate([
    { transform: `translate(${pos(from)}) scale(1.08,.85)`, offset: 0 },
    { transform: `translate(${(from[0] + to[0]) * 50 + 50}px, ${(from[1] + to[1]) * 50 - 30}px) scale(.94,1.06)`, offset: .36 },
    { transform: `translate(${pos(to)}) scale(1.12,.84)`, offset: .65 },
    { transform: `translate(${pos(to)}) scale(1,1)`, offset: 1 },
  ], { duration: 520, easing: 'ease-in-out' }));
  for (const w of result.wave) if (!w.blockedBy) {
    const pad = root.querySelector(`#pad-${w.padId}`)!;
    animations.push(pad.animate([{ transform: `translate(${pos(w.from)})` }, { transform: `translate(${pos(w.to)})` }], { duration: 280, delay: 220, fill: 'backwards', easing: 'ease-out' }));
  }
  if (result.next.pads.some(p => same(p.at, to))) {
    root.querySelector('#wave-effect')!.innerHTML = `<g style="transform:translate(${pos(to)})"><circle id="ripple" r="42" fill="none" stroke="#e6ffed" stroke-width="3"/></g>`;
    animations.push(root.querySelector('#ripple')!.animate([{ transform: 'scale(.4)', opacity: .9 }, { transform: 'scale(2.3)', opacity: 0 }], { duration: 300, delay: 220, fill: 'both', easing: 'ease-out' }));
  }
  return animations;
}
