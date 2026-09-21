#!/usr/bin/env python3
"""Checks for the reference rules, not a substitute for the game's TS/browser tests."""
from __future__ import annotations
from collections import deque
from copy import deepcopy
import json
from pathlib import Path
import unittest
from verify_levels import DIRECTIONS, initial, solve, transition, validate, verify

ROOT = Path(__file__).parent
LEVELS = json.loads((ROOT/'levels.json').read_text(encoding='utf-8'))['levels']


def fixture(land=None, rocks=None, goal=(6,6)):
    land = land if land is not None else [(0,0),goal]
    return dict(id='fixture',title='fixture',width=7,height=7,start=list(land[0]),goal=list(goal),
                land=[list(p) for p in land],rocks=[list(p) for p in (rocks or [])],pads=[])


def state(frog, pads):
    return tuple(frog), tuple(sorted(tuple(p) for p in pads))


class ReferenceRulesTests(unittest.TestCase):
    def test_one_cell_jump(self):
        lev=fixture()
        result=transition(lev,state((0,0),[(1,0)]),(1,0))
        self.assertIsNotNone(result)
        self.assertEqual(result[0][0],(1,0))

    def test_two_cell_jump(self):
        result=transition(fixture(),state((0,0),[(2,0)]),(2,0))
        self.assertIsNotNone(result)
        self.assertEqual(result[0][0],(2,0))

    def test_invalid_targets(self):
        lev=fixture();st=state((0,0),[(1,1),(3,0)])
        for target in [(1,1),(3,0),(0,0),(1,0),(-1,0)]:
            with self.subTest(target=target):
                self.assertIsNone(transition(lev,st,target))

    def test_rock_blocks_intermediate_cell(self):
        lev=fixture(rocks=[(1,0)])
        self.assertIsNone(transition(lev,state((0,0),[(2,0)]),(2,0)))

    def test_rock_cannot_be_landing_target(self):
        lev=fixture(rocks=[(1,0)])
        self.assertIsNone(transition(lev,state((0,0),[]),(1,0)))

    def test_landing_on_land_does_not_create_wave(self):
        lev=fixture(land=[(0,0),(2,0),(6,6)])
        result=transition(lev,state((0,0),[(3,0)]),(2,0))
        self.assertEqual(result[0][1],((3,0),))
        self.assertEqual(result[1],[])

    def test_adjacent_pad_moves_one_cell(self):
        lev=LEVELS[0]
        result=transition(lev,initial(lev),(2,3))
        self.assertEqual(result[0],((2,3),((2,3),(4,3))))

    def test_diagonal_and_distant_pads_do_not_get_impulse(self):
        lev=fixture()
        st=state((0,2),[(0,2),(2,2),(3,3),(4,2)])
        result=transition(lev,st,(2,2))
        self.assertEqual(result[0][1],st[1])
        self.assertEqual(result[1],[])

    def test_rock_blocks_wave(self):
        lev=LEVELS[2]
        result=transition(lev,initial(lev),(2,3))
        self.assertIn((3,3),result[0][1])
        self.assertEqual(result[1][0]['blocked'],'rock')

    def test_land_blocks_wave(self):
        lev=LEVELS[4]
        result=transition(lev,initial(lev),(2,3))
        self.assertIn((1,3),result[0][1])
        self.assertTrue(any(w['blocked']=='land' for w in result[1]))

    def test_boundary_blocks_wave(self):
        lev=fixture(land=[(6,0),(6,6)])
        st=state((0,2),[(0,2),(0,1),(0,0)])
        result=transition(lev,st,(0,1))
        self.assertIn((0,0),result[0][1])
        self.assertTrue(any(w['blocked']=='boundary' for w in result[1]))

    def test_no_chain_push(self):
        lev=fixture()
        st=state((1,3),[(1,3),(2,3),(3,3),(4,3)])
        result=transition(lev,st,(2,3))
        self.assertIn((3,3),result[0][1]);self.assertIn((4,3),result[0][1])
        self.assertTrue(any(w['blocked']=='pad' for w in result[1]))

    def test_four_simultaneous_pushes(self):
        lev=fixture()
        st=state((3,4),[(3,4),(3,3),(3,2),(4,3),(2,3)])
        result=transition(lev,st,(3,3))
        self.assertEqual(set(result[0][1]),{(3,3),(3,5),(3,1),(5,3),(1,3)})
        self.assertEqual(sum(w['blocked'] is None for w in result[1]),4)

    def test_old_support_can_move(self):
        st=state((2,3),[(2,3),(3,3)])
        result=transition(fixture(),st,(3,3))
        self.assertEqual(result[0],((3,3),((1,3),(3,3))))

    def test_flying_over_pad_only_produces_landing_wave(self):
        lev=fixture(land=[(0,3),(6,6)])
        result=transition(lev,state((0,3),[(1,3),(2,3)]),(2,3))
        self.assertEqual(result[0][1],((1,3),(2,3)))
        self.assertEqual(len(result[1]),1)
        self.assertEqual(result[1][0]['blocked'],'land')

    def test_input_immutability_and_iteration_order(self):
        lev=LEVELS[4];before=deepcopy(lev);st=initial(lev);st_before=deepcopy(st)
        a=transition(lev,st,(2,3))
        b=transition(lev,(st[0],tuple(reversed(st[1]))),(2,3))
        self.assertEqual(a,b);self.assertEqual(lev,before);self.assertEqual(st,st_before)

    def test_goal_is_terminal(self):
        lev=fixture(land=[(0,0),(2,0)],goal=(2,0))
        result=transition(lev,state((0,0),[]),(2,0))
        self.assertEqual(result[0][0],(2,0))
        self.assertIsNone(transition(lev,result[0],(0,0)))

    def test_all_reference_routes_and_minima(self):
        result=verify(ROOT/'levels.json')
        self.assertEqual(len(result),20)
        self.assertEqual([r['minMoves'] for r in result[:5]],[3,5,5,9,12])
        self.assertTrue(all(9 <= r['minMoves'] <= 30 for r in result[5:]))

    def test_new_rocks_change_shortest_solution(self):
        for lev in LEVELS[5:]:
            for rock in lev['rocks']:
                with self.subTest(level=lev['id'],rock=rock):
                    altered=deepcopy(lev)
                    altered['rocks'].remove(rock)
                    result=solve(altered)
                    self.assertNotEqual(result['status'],'budget_exceeded')
                    if result['status']=='solved':
                        self.assertNotEqual(result['minMoves'],lev['optimalMoves'])

    def test_hint_from_intermediate_position(self):
        lev=LEVELS[0];st=transition(lev,initial(lev),(2,3))[0]
        result=solve(lev,start=st)
        self.assertEqual(result['minMoves'],2)
        self.assertEqual(result['solution'][0]['jumpTo'],[4,3])

    def test_hint_after_deviation(self):
        lev=LEVELS[0];st=transition(lev,initial(lev),(2,3))[0]
        st=transition(lev,st,(0,3))[0]
        result=solve(lev,start=st)
        self.assertEqual(result['minMoves'],3)
        self.assertEqual(result['solution'][0]['jumpTo'],[2,3])

    def test_budget_is_not_unreachable(self):
        self.assertEqual(solve(LEVELS[0],max_states=1)['status'],'budget_exceeded')
        lev=fixture()
        self.assertEqual(solve(lev)['status'],'unreachable')

    def test_level_four_requires_a_westward_jump(self):
        self.assertEqual(solve(LEVELS[3],allow_west=False)['status'],'unreachable')

    def test_pad_ids_do_not_affect_logical_states(self):
        lev=deepcopy(LEVELS[4]);before=initial(lev)
        for i,pad in enumerate(lev['pads']):pad['id']=f'new-{100-i}'
        lev['pads'].reverse()
        self.assertEqual(initial(lev),before)

    def test_validation_rejects_overlaps(self):
        lev=deepcopy(LEVELS[0]);lev['pads'][0]['at']=lev['start']
        with self.assertRaises(AssertionError):validate(lev)

    def test_all_reachable_transitions_preserve_invariants(self):
        for lev in LEVELS:
            land={tuple(p) for p in lev['land']};rocks={tuple(p) for p in lev['rocks']}
            begin=initial(lev);q=deque([begin]);seen={begin};count=len(begin[1])
            while q:
                st=q.popleft();frog=st[0]
                for dx,dy in DIRECTIONS:
                    for distance in (1,2):
                        target=(frog[0]+dx*distance,frog[1]+dy*distance)
                        result=transition(lev,st,target)
                        if result is None:continue
                        nxt=result[0];pads=set(nxt[1])
                        self.assertEqual(len(pads),count)
                        self.assertEqual(len(nxt[1]),count)
                        self.assertFalse(pads & (land|rocks))
                        self.assertTrue(all(0<=x<7 and 0<=y<7 for x,y in pads))
                        self.assertIn(nxt[0],pads|land)
                        if nxt not in seen:seen.add(nxt);q.append(nxt)
            self.assertLess(len(seen),50_000)


if __name__=='__main__':
    unittest.main(verbosity=2)
