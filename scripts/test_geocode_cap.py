# Story 1512: a daily cap on Ola address lookups, for each person and for the whole app (geocode_count). The scenario names are the story's.
# Scenario: Under the cap. Given I made 3 lookups today, when I confirm a pin, then Ola is asked.
# Scenario: Over the cap. Given I made as many lookups today as the cap, then Ola is not asked.
# Scenario: A new day. Given I was over the cap yesterday, then today I am under it.
# Scenario: The cap is a setting. Given the admin value changes from 30 to 5, then the sixth lookup of the day is not sent to Ola.
# Every check runs the migration inside the transaction and ends in ROLLBACK, so it holds before and after the migration is on dev, and dev stays clean.
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_geocode_cap.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = open(os.path.join(HERE, "..", "supabase", "migrations", "20261114170000_geocode_lookup_cap.sql")).read()
ME, OTHER = "00000000-0000-0000-0000-0000000015a1", "00000000-0000-0000-0000-0000000015a2"
TODAY = "(now() at time zone 'Asia/Kolkata')::date"
SETUP = [f"insert into auth.users (id) values ('{ME}'), ('{OTHER}')", "delete from geocode_person_day", "delete from geocode_day",
         "update settings set value = '30' where name = 'geocode_person_day_cap'", "update settings set value = '2500' where name = 'geocode_app_day_cap'"]
MINE = f"(select count from geocode_person_day where person = '{ME}' and day = {TODAY})"
TOTAL = f"(select count from geocode_day where day = {TODAY})"


def made(n, person=ME, day=TODAY):
    return [f"insert into geocode_person_day (day, person, count) values ({day}, '{person}', {n}) on conflict (day, person) do update set count = excluded.count",
            f"insert into geocode_day (day, count) values ({day}, {n}) on conflict (day) do update set count = geocode_day.count + excluded.count"]


def ask(n=1):   # the answers are kept first: a count read in the same statement as the call would be the count before it
    return f"create temp table said as select array_agg(geocode_count('{ME}')) as answers from generate_series(1, {n})"


def run(*steps, final=f"(select answers from said) as answers, {MINE} as mine, {TOTAL} as total"):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    r = sql("begin; " + MIG + "; " + "; ".join(SETUP + flat + [f"select {final}"]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class GeocodeCap(unittest.TestCase):
    def test_under_the_cap(self):
        r = run(made(3), ask())
        self.assertEqual((r["answers"], r["mine"], r["total"]), (["ok"], 4, 4), r)

    def test_over_the_cap(self):
        r = run(made(30), ask())
        self.assertEqual((r["answers"], r["mine"], r["total"]), (["person"], 30, 30), r)   # nothing is added: Ola is not asked

    def test_the_count_is_for_the_person(self):
        r = run(made(30, OTHER), ask())   # someone else is over the cap; I am not
        self.assertEqual((r["answers"], r["mine"]), (["ok"], 1), r)

    def test_a_new_day(self):
        r = run(made(30, day=f"{TODAY} - 1"), ask(), final=f"(select answers from said) as answers, {MINE} as mine, (select count(*) from geocode_person_day where day < {TODAY}) as old")
        self.assertEqual((r["answers"], r["mine"], r["old"]), (["ok"], 1, 0), r)   # yesterday's counts are gone

    def test_the_cap_is_a_setting(self):
        r = run("update settings set value = '5' where name = 'geocode_person_day_cap'", ask(6))
        self.assertEqual((r["answers"], r["mine"]), (["ok"] * 5 + ["person"], 5), r)

    def test_the_whole_app_total(self):
        r = run("update settings set value = '2' where name = 'geocode_app_day_cap'", made(2, OTHER), ask())
        self.assertEqual((r["answers"], r["mine"], r["total"]), (["app"], 0, 2), r)   # my own count does not move

    def test_a_cap_must_be_a_whole_number_of_zero_or_more(self):
        for bad in ("-1", "1.5", "\"30\"", "null"):
            r = sql("begin; " + MIG + f"; update settings set value = '{bad}' where name = 'geocode_person_day_cap'; rollback;")
            self.assertIn("settings_geocode_day_cap_rule", str(r), bad)

    def test_only_the_service_role_may_count_and_no_one_reads_the_tables(self):
        r = run(final="has_function_privilege('anon', 'geocode_count(uuid)', 'execute') as anon, has_function_privilege('authenticated', 'geocode_count(uuid)', 'execute') as authed, "
                      "has_function_privilege('service_role', 'geocode_count(uuid)', 'execute') as service, has_table_privilege('authenticated', 'geocode_person_day', 'select') as reads, "
                      "(select bool_and(relrowsecurity) from pg_class where relname in ('geocode_person_day', 'geocode_day')) as rls")
        self.assertEqual((r["anon"], r["authed"], r["service"], r["reads"], r["rls"]), (False, False, True, False, True), r)

    def test_the_tables_hold_no_place(self):
        r = run(final="(select array_agg(table_name || '.' || column_name) from information_schema.columns where table_name in ('geocode_person_day', 'geocode_day')) as cols")
        self.assertEqual(sorted(r["cols"]), ["geocode_day.count", "geocode_day.day", "geocode_person_day.count", "geocode_person_day.day", "geocode_person_day.person"], r)


if __name__ == "__main__":
    unittest.main()
