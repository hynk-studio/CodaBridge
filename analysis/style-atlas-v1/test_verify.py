"""TEST ONLY regressions; real source fixtures are read, never rewritten."""
import copy
import csv
import math
import unittest
from collections import Counter
from unittest.mock import patch

import verify as atlas_verify


class ClickVerificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        atlas = atlas_verify.read('public/style-atlas-v1/atlas.json')
        preserved = atlas_verify.read('analysis/dialogue-transfer/inputs/validated.json')
        cls.row = next(row for row in atlas['records'] if row['sourceLine'] == 2)
        cls.original = next(row for row in preserved['calls'] if row['sourceLine'] == 2)
        with (atlas_verify.ROOT/'data/context/sperm-whale-dialogues.csv').open(newline='') as source:
            cls.raw = next(csv.DictReader(source))
        cls.intervals = [float(cls.raw[f'ICI{j}']) for j in range(1, int(cls.raw['nClicks']))]

    def test_actual_line_2_with_current_interpreter_sum(self):
        self.assertEqual(self.row['rec'], 'sw061b001_124')
        atlas_verify.check_record(self.row, self.original, self.raw)

    def test_actual_line_2_with_alternate_summation(self):
        # fsum reproduces this row's reported alternate result on Python 3.9 too.
        alternate = [math.fsum(self.intervals[:j]) for j in range(len(self.intervals)+1)]
        self.assertEqual(self.row['clicks'][3], 0.1189333)
        self.assertEqual(alternate[3], 0.11893329999999999)
        self.assertNotEqual(alternate, self.row['clicks'])
        self.assertEqual(max(abs(a-b) for a, b in zip(alternate, self.row['clicks'])),
                         1.1102230246251565e-16)
        # Exercise the same record verifier with independent raw-ICI sums; do not
        # change stored clicks, features, source strings or parser evidence.
        with patch.object(atlas_verify, 'sum', math.fsum, create=True):
            atlas_verify.check_record(self.row, self.original, self.raw)

    def test_materially_perturbed_click_fails(self):
        clicks = self.row['clicks'].copy()
        clicks[3] += 1e-6
        with self.assertRaises(AssertionError):
            atlas_verify.check_clicks(clicks, self.intervals)

    def test_missing_and_extra_clicks_fail(self):
        for clicks in [self.row['clicks'][:-1], self.row['clicks']+[1.0]]:
            with self.subTest(length=len(clicks)), self.assertRaises(AssertionError):
                atlas_verify.check_clicks(clicks, self.intervals)

    def test_nonfinite_clicks_fail(self):
        for value in [math.nan, math.inf, -math.inf]:
            for index in [3, -1]:
                clicks = self.row['clicks'].copy()
                clicks[index] = value
                with self.subTest(value=value, index=index), self.assertRaises(AssertionError):
                    atlas_verify.check_clicks(clicks, self.intervals)

    def test_nonfinite_recomputed_values_fail(self):
        for value in [math.nan, math.inf, -math.inf]:
            intervals = self.intervals.copy()
            intervals[-1] = value
            with self.subTest(value=value), self.assertRaises(AssertionError):
                atlas_verify.check_clicks(self.row['clicks'], intervals)

    def test_feature_vectors_require_exact_dimensions_and_finite_values(self):
        for field in ['gapShares', 'clickPositions']:
            for mutation in ['missing', 'extra', math.nan, math.inf, -math.inf]:
                row = copy.deepcopy(self.row)
                vector = row['features'][field]
                if mutation == 'missing':
                    vector.pop()
                elif mutation == 'extra':
                    vector.append(0.0)
                else:
                    vector[-1] = mutation
                with self.subTest(field=field, mutation=mutation), self.assertRaises(AssertionError):
                    atlas_verify.check_record(row, self.original, self.raw)

    def test_raw_numeric_text_stays_exact(self):
        row, original = copy.deepcopy(self.row), copy.deepcopy(self.original)
        # Numerically identical spelling still changes source evidence. Even a
        # matching altered parser copy must fail against the original CSV row.
        row['raw']['ICI1'] += '0'
        original['raw']['ICI1'] += '0'
        self.assertEqual(float(row['raw']['ICI1']), self.intervals[0])
        with self.assertRaisesRegex(AssertionError, 'raw source binding mismatch'):
            atlas_verify.check_record(row, original, self.raw)

    def test_source_identity_tampering_fails(self):
        for key, value in [('id', 'row-3'), ('sourceLine', 3), ('rec', 'sw061b001_125'),
                           ('caller', '2'), ('onset', self.row['onset']+1e-12),
                           ('prefix', 'altered'), ('root', 'altered')]:
            row = copy.deepcopy(self.row)
            row[key] = value
            with self.subTest(key=key), self.assertRaises(AssertionError):
                atlas_verify.check_record(row, self.original, self.raw)

    def test_stored_parser_clicks_remain_exact_even_within_tolerance(self):
        row = copy.deepcopy(self.row)
        row['clicks'][3] = math.nextafter(row['clicks'][3], math.inf)
        atlas_verify.check_clicks(row['clicks'], self.intervals)
        with self.assertRaisesRegex(AssertionError, 'preserved row mismatch'):
            atlas_verify.check_record(row, self.original, self.raw)


class ProvenanceAndRankingTests(unittest.TestCase):
    def test_source_and_artifact_hashes_remain_exact(self):
        actual_sha = atlas_verify.sha
        for target in ['data/context/sperm-whale-dialogues.csv',
                       'public/style-atlas-v1/atlas.json', 'public/style-atlas-v1/summary.json']:
            def tampered_sha(path):
                return '0'*64 if path == target else actual_sha(path)
            with self.subTest(path=target), patch.object(atlas_verify, 'sha', side_effect=tampered_sha):
                with self.assertRaisesRegex(AssertionError, 'SHA-256 mismatch'):
                    atlas_verify.verify([])

    def test_root_counts_order_and_dimensions_stay_exact(self):
        group = dict(records=3, largestRootShare=2/3, rootContributions=[
            dict(root='a', records=2, share=2/3), dict(root='b', records=1, share=1/3)])
        roots = Counter(a=2, b=1)
        rounded = copy.deepcopy(group)
        rounded['rootContributions'][0]['share'] = math.nextafter(2/3, math.inf)
        rounded['largestRootShare'] = math.nextafter(2/3, math.inf)
        atlas_verify.check_root_contributions(rounded, roots)
        for mutation in ['root', 'records', 'missing', 'extra', 'order', 'share', 'nonfinite']:
            changed = copy.deepcopy(group)
            entries = changed['rootContributions']
            if mutation in ['root', 'records']:
                entries[0][mutation] = 'different' if mutation == 'root' else 2+1e-12
            elif mutation == 'missing':
                entries.pop()
            elif mutation == 'extra':
                entries.append(dict(root='c', records=0, share=0))
            elif mutation == 'order':
                entries.reverse()
            else:
                entries[0]['share'] = 0.5 if mutation == 'share' else math.nan
            with self.subTest(mutation=mutation), self.assertRaises(AssertionError):
                atlas_verify.check_root_contributions(changed, roots)

    def test_ranking_accumulation_matches_js_left_fold(self):
        # TEST ONLY positive differences distinguish ordered from compensated sums.
        values = [1.0, 2**-53, 2**-53]
        self.assertEqual(atlas_verify.ordered_sum(values), 1.0)
        self.assertEqual(math.fsum(values), 1.0000000000000002)

    def test_nearest_ranking_has_no_fuzzy_ties(self):
        # TEST ONLY raw ICI rows: all distances are within the verification
        # tolerance, but only exact ties may be ordered by source line.
        rows = [dict(sourceLine=line, raw=dict(nClicks='3', ICI1=a, ICI2=b))
                for line, a, b in [(10, '0.50000000001', '0.49999999999'),
                                    (30, '0.5', '0.5'), (20, '0.5', '0.5')]]
        scores = atlas_verify.nearest_scores([0, 0.5, 1], rows)
        self.assertEqual([line for _, line in scores], [20, 30, 10])
        self.assertGreater(scores[2][0], 0)
        self.assertLess(scores[2][0], 1e-10)


if __name__ == '__main__':
    unittest.main()
