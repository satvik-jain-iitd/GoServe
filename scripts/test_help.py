# Story #355 (E27, plan v2 B.19): help and FAQ. Scenario: Given the faq table, when help is asked, then topics with questions and answers return.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_help.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_payments import SETUP, q, run

CLEAR = "delete from faq"


def item(topic, question, answer="An answer.", position=0, topic_position=0, active="true"):
    return f"insert into faq (topic, topic_position, question, answer, position, active) values ('{topic}', {topic_position}, '{question}', '{answer}', {position}, {active})"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Help(unittest.TestCase):
    def test_help_returns_topics_with_their_questions_and_answers_in_order_the_scenario(self):
        r = run(CLEAR, item("Payment", "Can I pay cash?", "Yes, at the door.", 2, 2), item("Payment", "Can I pay by UPI?", "Yes.", 1, 2), item("Orders", "How long?", "About 30 minutes.", 1, 1), q("help_v2()"))
        self.assertEqual(r["rs"][0], {"ok": True, "topics": [
            {"topic": "Orders", "items": [{"question": "How long?", "answer": "About 30 minutes."}]},
            {"topic": "Payment", "items": [{"question": "Can I pay by UPI?", "answer": "Yes."}, {"question": "Can I pay cash?", "answer": "Yes, at the door."}]}]}, r)

    def test_a_switched_off_question_is_not_returned_and_a_topic_with_none_is_not_either(self):
        r = run(CLEAR, item("Orders", "Shown"), item("Orders", "Hidden", active="false"), item("Gone", "Hidden too", active="false"), q("help_v2()"))
        self.assertEqual([(t["topic"], [i["question"] for i in t["items"]]) for t in r["rs"][0]["topics"]], [("Orders", ["Shown"])], r)

    def test_no_questions_gives_an_empty_list(self):
        self.assertEqual(run(CLEAR, q("help_v2()"))["rs"][0], {"ok": True, "topics": []})

    def test_the_starter_content_is_there_for_the_first_screens(self):
        r = run(q("help_v2()"))
        topics = [t["topic"] for t in r["rs"][0]["topics"]]
        self.assertEqual(topics, ["Ordering", "Paying", "Delivery", "Your account"], r)
        self.assertTrue(all(i["question"] and i["answer"] for t in r["rs"][0]["topics"] for i in t["items"]), r)

    def test_nobody_reads_the_table_and_only_the_service_role_asks(self):
        for role in ("anon", "authenticated"):
            for stmt in ("select count(*) from faq", "select help_v2()"):
                r = sql("begin; " + "; ".join(SETUP + [f"set local role {role}", stmt]) + "; rollback;")
                self.assertIn("permission denied", str(r), (role, stmt))


if __name__ == "__main__":
    unittest.main()
