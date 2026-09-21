#!/usr/bin/env python3
"""Reference verifier for Plukh! levels. Standard library only, not game runtime."""
from __future__ import annotations
import argparse
from collections import deque
import json
from pathlib import Path
from typing import Any

Pos = tuple[int, int]
State = tuple[Pos, tuple[Pos, ...]]
DIRECTIONS: tuple[Pos, ...] = ((0,-1),(1,0),(0,1),(-1,0))


def inside(p: Pos, level: dict[str, Any]) -> bool:
    return 0 <= p[0] < level['width'] and 0 <= p[1] < level['height']


def initial(level: dict[str, Any]) -> State:
    return tuple(level['start']), tuple(sorted(tuple(p['at']) for p in level['pads']))


def transition(level: dict[str, Any], state: State, target: Pos) -> tuple[State, list[dict[str, Any]]] | None:
    """Move one or two cells orthogonally. Waves occur only on pad landings."""
    frog, pad_positions = state
    if frog == tuple(level['goal']):
        return None
    dx, dy = target[0]-frog[0], target[1]-frog[1]
    distance = abs(dx)+abs(dy)
    if not inside(target, level) or (dx != 0 and dy != 0) or distance not in (1,2):
        return None
    pads = set(pad_positions)
    land = {tuple(p) for p in level['land']}
    rocks = {tuple(p) for p in level.get('rocks', [])}
    if target in rocks or target not in pads | land:
        return None
    if distance == 2:
        mid = (frog[0]+dx//2, frog[1]+dy//2)
        if mid in rocks:
            return None
    moves: list[dict[str, Any]] = []
    if target in pads:
        updates: dict[Pos, Pos] = {}
        for ux, uy in DIRECTIONS:
            source = (target[0]+ux, target[1]+uy)
            if source not in pads:
                continue
            dest = (source[0]+ux, source[1]+uy)
            reason = None
            if not inside(dest, level): reason = 'boundary'
            elif dest in rocks: reason = 'rock'
            elif dest in land: reason = 'land'
            elif dest in pads: reason = 'pad'
            if reason is None:
                updates[source] = dest
            moves.append({'from': list(source), 'to': list(dest), 'blocked': reason})
        pads = {updates.get(p,p) for p in pads}
    return (target, tuple(sorted(pads))), moves


def solve(level: dict[str, Any], max_states: int = 200_000, allow_west: bool = True,
          start: State | None = None) -> dict[str, Any]:
    begin = start if start is not None else initial(level)
    goal = tuple(level['goal'])
    frontier = deque([begin])
    parent: dict[State, tuple[State, Pos, list[dict[str, Any]]] | None] = {begin: None}
    while frontier:
        state = frontier.popleft()
        if state[0] == goal:
            route = []
            current = state
            while parent[current] is not None:
                prev, target, waves = parent[current]
                route.append({'jumpTo': list(target), 'waves': waves})
                current = prev
            route.reverse()
            return {'status': 'solved', 'minMoves': len(route), 'visitedStates': len(parent), 'solution': route}
        frog = state[0]
        for ux,uy in DIRECTIONS:
            if not allow_west and ux < 0:
                continue
            for distance in (1,2):
                target = (frog[0]+ux*distance, frog[1]+uy*distance)
                result = transition(level, state, target)
                if result is None: continue
                next_state, waves = result
                if next_state in parent: continue
                if len(parent) >= max_states:
                    return {'status':'budget_exceeded', 'visitedStates':len(parent)}
                parent[next_state] = state, target, waves
                frontier.append(next_state)
    return {'status':'unreachable', 'visitedStates':len(parent)}


def validate(level: dict[str, Any]) -> None:
    assert level['width'] == 7 and level['height'] == 7, 'MVP boards are 7x7'
    land = [tuple(p) for p in level['land']]
    rocks = [tuple(p) for p in level.get('rocks', [])]
    pads = [tuple(p['at']) for p in level['pads']]
    all_pos = land+rocks+pads
    assert all(inside(p,level) for p in all_pos)
    assert len(set(all_pos)) == len(all_pos), 'Overlapping or duplicate terrain/pads'
    assert tuple(level['start']) in land and tuple(level['goal']) in land
    assert level['start'] != level['goal']
    ids = [p['id'] for p in level['pads']]
    assert len(set(ids)) == len(ids)


def verify(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding='utf-8'))
    results = []
    for level in payload['levels']:
        validate(level)
        result = solve(level)
        assert result['status'] == 'solved', (level['id'], result)
        assert result['minMoves'] == level['optimalMoves'], (level['id'], result['minMoves'])
        state = initial(level)
        for index, target in enumerate(level['referenceSolution'], start=1):
            advanced = transition(level, state, tuple(target))
            assert advanced is not None, (level['id'], index, target)
            next_state,_ = advanced
            assert len(state[1]) == len(next_state[1])
            assert len(set(next_state[1])) == len(next_state[1])
            assert next_state[0] in set(next_state[1]) | {tuple(p) for p in level['land']}
            state = next_state
        assert state[0] == tuple(level['goal']), level['id']
        assert len(level['referenceSolution']) == result['minMoves']
        results.append({'id':level['id'], 'title':level['title'], **result})
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('levels', type=Path, nargs='?', default=Path(__file__).with_name('levels.json'))
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    results = verify(args.levels)
    for result in results:
        print(f"{result['id']}: {result['minMoves']} moves, {result['visitedStates']} states, {result['status']}")
    if args.output:
        args.output.write_text(json.dumps({'rulesVersion':1,'verification':'exhaustive breadth-first search; shortest path in unweighted state graph', 'levels':results}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
