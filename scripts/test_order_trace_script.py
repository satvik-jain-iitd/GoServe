# Story #484: the read script prints one time-ordered line per event, from the order's own events and the trace table.
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from order_trace import timeline


class Timeline(unittest.TestCase):
    def test_events_and_trace_lines_are_merged_in_time_order_with_the_actor(self):
        events = [{"event": "order.ready", "actor": "sim", "created_at": "2026-10-27T02:47:00+00:00"}]
        trace = [
            {"at": "2026-10-27T02:47:02+00:00", "actor": "n8n", "event": "push_sent", "result": "201", "detail": {"host": "web.push.apple.com", "text": "ready"}},
            {"at": "2026-10-27T02:46:00+00:00", "actor": "app", "event": "app_open", "result": "visible", "detail": None},
        ]
        lines = timeline(events, trace)
        self.assertEqual([l.split()[1] for l in lines], ["app", "db", "n8n"])
        self.assertIn("push_sent 201 web.push.apple.com ready", lines[2])
        self.assertTrue(lines[0].startswith("02:46:00"), lines[0])

    def test_a_missing_field_never_crashes_the_script(self):
        self.assertEqual(len(timeline([{"event": "order.placed", "created_at": "2026-10-27T02:41:36+00:00"}], [{"at": "2026-10-27T02:41:37+00:00", "actor": "sw", "event": "push_received"}])), 2)


if __name__ == "__main__":
    unittest.main()
