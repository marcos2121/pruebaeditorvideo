import unittest
from fractions import Fraction

from editor import ai
from editor.plan import (TimeMap, Word, auto_keywords, build_segments, emphasis_times, frame_select_expr, is_filler,
                         motion_expr, zoom_intervals)
from editor.subtitles import build_ass, build_srt, chunk_words

FPS = Fraction(30)


class PlanTests(unittest.TestCase):
    def test_fillers(self):
        for w in ("eh", "Ehh,", "ehm...", "mmm", "Um", "uhm"):
            self.assertTrue(is_filler(w), w)
        for w in ("este", "en", "me", "hum", "ahora"):
            self.assertFalse(is_filler(w), w)

    def test_long_pauses_are_cut_short_ones_kept(self):
        speech = [(1.0, 3.0), (3.3, 5.0), (8.0, 10.0)]
        segs = build_segments(12.0, speech, [], FPS, min_silence=0.6, keep_pause=0.1)
        self.assertEqual(segs, [(27, 153), (237, 303)])

    def test_filler_is_removed(self):
        words = [Word(1.0, 1.5, "hola"), Word(1.6, 2.0, "ehm"), Word(2.1, 2.6, "amigos")]
        segs = build_segments(5.0, [], words, FPS, keep_pause=0.1, remove_fillers=True)
        self.assertEqual(len(segs), 2)
        tm = TimeMap(segs, FPS)
        self.assertIsNone(tm.to_out(1.8))
        self.assertIsNotNone(tm.to_out(2.3))

    def test_time_map_roundtrip(self):
        segs = [(30, 90), (150, 300)]
        tm = TimeMap(segs, FPS, offset=2.0)
        self.assertAlmostEqual(tm.duration, 7.0)
        self.assertAlmostEqual(tm.to_out(1.5), 2.5)
        self.assertAlmostEqual(tm.to_out(5.0), 2.0 + 2.0 + 0.0)
        self.assertIsNone(tm.to_out(4.0))
        self.assertEqual(tm.map_interval(2.5, 6.0), (3.5, 5.0))
        self.assertEqual(tm.out_to_src_segments(3.0, 5.0), [(60, 90), (150, 180)])

    def test_select_expr_counts_frames(self):
        self.assertEqual(frame_select_expr([(10, 20), (30, 31)]), "between(n,10,19)+between(n,30,30)")
        self.assertEqual(frame_select_expr([(10, 20)], base=10), "between(n,0,9)")

    def test_zoom_alternates_and_resets_on_chapters(self):
        segs = [(i * 90, i * 90 + 75) for i in range(8)]  # tramos de 2.5 s
        tm = TimeMap(segs, FPS)
        zooms = zoom_intervals(tm, resets=[])
        self.assertEqual(zooms[0], (2.5, 5.0))
        with_reset = zoom_intervals(tm, resets=[2.5])
        self.assertNotIn((2.5, 5.0), with_reset)


class MotionTests(unittest.TestCase):
    def test_auto_keywords_prefers_repeated_and_numbers(self):
        words = [Word(i, i + 0.5, t) for i, t in enumerate(
            "el dropshipping funciona dropshipping entonces entonces 500 ventas".split())]
        kws = auto_keywords(words)
        self.assertIn("500", kws)
        self.assertIn("dropshipping", kws)
        self.assertNotIn("entonces", kws)

    def test_emphasis_spacing(self):
        words = [(0.0, 0.3, "clave"), (2.0, 2.3, "clave"), (7.0, 7.3, "Clave.")]
        self.assertEqual(emphasis_times(words, ["clave"], min_gap=6), [0.0, 7.0])

    def test_motion_expr(self):
        tm = TimeMap([(0, 90), (120, 300)], FPS)
        self.assertEqual(motion_expr(tm, [], 1.12, False, []), "1")
        expr = motion_expr(tm, [(3.0, 9.0)], 1.12, True, [4.0])
        self.assertTrue(expr.startswith("1+gte(t,3.000)*lt(t,9.000)*0.120"))
        self.assertIn("sin(PI*(t-4.000)/0.5)", expr)


class TextTests(unittest.TestCase):
    def test_vertical_layout_and_cta(self):
        ass = build_ass(1080, 1920, "Montserrat", [(0.0, 0.4, "hola"), (0.5, 0.9, "mundo")], "caps", [], [], [], [],
                        None, "", 0.0, cta_at=10.0)
        self.assertIn("PlayResY: 1920", ass)
        self.assertIn("HOLA", ass)
        self.assertIn("SUSCRÍBETE", ass)
        self.assertIn("Style: Sub,Montserrat,87,", ass)  # 1080 * 0.075 * 1.08

    def test_chunks_break_on_sentence_and_length(self):
        words = [(0.0, 0.3, "Hola."), (0.4, 0.7, "Esto"), (0.8, 1.0, "es"), (1.1, 1.5, "genial")]
        chunks = chunk_words(words, max_chars=32, max_dur=3)
        self.assertEqual([len(c) for c in chunks], [1, 3])

    def test_srt_format(self):
        srt = build_srt([(0.0, 0.5, "Hola"), (0.6, 1.0, "mundo.")])
        self.assertIn("00:00:00,000 --> 00:00:01,250", srt)
        self.assertIn("Hola mundo.", srt)

    def test_chapters_are_validated(self):
        plan = ai.ContentPlan(chapters=[ai.Chapter(5, "A"), ai.Chapter(10, "B"), ai.Chapter(200, "C"),
                                        ai.Chapter(400, "D")], hook=(10, 30))
        plan = ai._clean(plan, 600)
        self.assertEqual([c.start for c in plan.chapters], [0.0, 200, 400])
        self.assertIsNone(plan.hook)  # demasiado cerca del inicio

    def test_fallback_without_ai(self):
        lines = [(t, f"Tema número {t}") for t in range(0, 1800, 30)]
        plan = ai.fallback_plan(lines, 1800)
        self.assertGreaterEqual(len(plan.chapters), 3)
        self.assertEqual(plan.chapters[0].start, 0)
        self.assertFalse(plan.used_ai)


if __name__ == "__main__":
    unittest.main()
