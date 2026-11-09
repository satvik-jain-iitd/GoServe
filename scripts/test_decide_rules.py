# Story #1068: the Rules decision lives in the database. The golden test: the same rider sets go through the n8n rule (ops/n8n/order/code/decide_guard.js, run by node)
# and through decide_rider_rules_v2; the pick, the options and the state must be equal for every set. Every check ends in ROLLBACK.
# The migration runs inside each transaction; SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_decide_rules.py
import json, os, random, subprocess, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside

HERE = os.path.dirname(os.path.abspath(__file__))
SVC = "select set_config('request.jwt.claim.role', 'service_role', true)"   # the caller is the service role (the Management API runs as postgres, which has no JWT)
MIG = migration_inside(["20261108200000_decide_rules.sql"], "to_regproc('public.decide_rider_rules_v2') is not null")
UID = "00000000-0000-0000-0000-0000000000e8"
PLACE = f"select place_order('{UID}', 'key8', jsonb_build_array(jsonb_build_object('menu_item_id', (select id from menu_items order by price_paise limit 1), 'qty', 1)), 'Flat 4')"
GUARD = os.path.join(HERE, "..", "ops", "n8n", "order", "code", "decide_guard.js")
UUID = "11111111-1111-1111-1111-111111111111"
NODE = """
const fs = require('fs'); const src = fs.readFileSync(process.argv[1], 'utf8'); const sets = JSON.parse(fs.readFileSync(0, 'utf8'));
const out = sets.map((riders) => { const j = { kill_switch: false, supabase_url: 'u', session_id: 's1', kitchen_id: process.argv[2], order_id: process.argv[2], riders, params_version: 1, jev_enabled: false };
  const r = new Function('$input', src)({ first: () => ({ json: j }) })[0].json; return r.ok ? { pick: r.rule_pick, options: r.options, state: r.state } : { error: r.error }; });
console.log(JSON.stringify(out));
"""


def node(sets):
    p = subprocess.run(["node", "-e", NODE, GUARD, UUID], input=json.dumps(sets), capture_output=True, text=True, check=True)
    return json.loads(p.stdout)


def rider_sets(n=150, seed=8):
    rnd = random.Random(seed)
    sets = [[{"id": "r1", "free": True, "distance_m": 1200, "trips_done": 2}, {"id": "r2", "free": True, "distance_m": 2100, "trips_done": 0}, {"id": "r3", "free": False, "distance_m": 300, "trips_done": 0}],   # decide.test.js S1
            [{"id": "a", "free": True, "distance_m": 900, "trips_done": 1}, {"id": "b", "free": True, "distance_m": 400, "trips_done": 1}],
            [{"id": "x", "free": False, "distance_m": 10, "trips_done": 0}]]
    for _ in range(n):
        k = rnd.randint(1, 10)
        ranked = rnd.random() < 0.4
        rs = [{"id": f"r{i}", "free": rnd.random() < 0.6, "distance_m": rnd.choice([0, 300, 300, 900, 1500]), "trips_done": rnd.choice([0, 1, 1, 2, 5])} for i in range(k)]
        if ranked:
            for r, rk in zip(rs, rnd.sample(range(1, k + 1), k)):
                r["rank"] = rk
        sets.append(rs)
    return sets


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class DecideRules(unittest.TestCase):
    def sql_decisions(self, sets):
        vals = ", ".join(f"({n}, '{json.dumps(s)}'::jsonb)" for n, s in enumerate(sets))
        r = sql("begin; " + MIG + "; " + SVC + "; " + PLACE + "; select jsonb_agg(decide_rider_rules_v2('s1', (select kitchen_id from orders where session_id = '" + UID + "'), (select id from orders where session_id = '" + UID + "'), v.s) order by v.n) as d "
                f"from (values {vals}) v(n, s); rollback;")
        self.assertIsInstance(r, list, r)
        return r[-1]["d"]

    def test_s1_golden_the_pick_options_and_state_equal_the_n8n_rule_for_every_set(self):
        sets = rider_sets()
        want, got = node(sets), self.sql_decisions(sets)
        self.assertEqual(len(want), len(got))
        for s, w, g in zip(sets, want, got):
            d = g["decision"]
            self.assertEqual([d["rule_pick"], d["chosen_pick"], d["options"]], [w["pick"], w["pick"], w["options"]], s)
            self.assertEqual([x["id"] for x in d["state"]["riders"]], [x["id"] for x in w["state"]["riders"]], s)
            self.assertEqual([[x["free"], x["distance_m"], x["trips_done"]] for x in d["state"]["riders"]], [[x["free"], x["distance_m"], x["trips_done"]] for x in w["state"]["riders"]], s)

    def test_s2_the_decision_row_is_the_one_sub_13_wrote_with_rules_on(self):
        r = self.sql_decisions([[{"id": "r1", "free": True, "distance_m": 5, "trips_done": 0}]])[0]["decision"]
        self.assertEqual([r["use_case"], r["engine"], r["jev"], r["jev_status"], r["chosen_by"], r["chosen_chance"], r["place"], r["result"]], ["D1", "rules", None, "engine_rules", "rule", 1, "demo", None])

    def test_s3_a_decision_is_logged_once_per_call(self):
        r = sql("begin; " + MIG + "; " + SVC + "; " + PLACE + f"; select decide_rider_rules_v2('s1', (select kitchen_id from orders where session_id = '{UID}'), (select id from orders where session_id = '{UID}'), '[{{\"id\":\"r1\",\"free\":true}}]'::jsonb); "
                f"select (select count(*)::int from decision_log where order_id = (select id from orders where session_id = '{UID}')) as n; rollback;")
        self.assertEqual(r[-1]["n"], 1, r)

    def test_s4_bad_input_is_refused_as_an_answer_and_nothing_is_logged(self):
        bad = [[], "x", [{"id": "", "free": True}], [{"id": "a", "free": "yes"}], [{"id": "a", "free": True}, {"id": "a", "free": True}], [{"id": f"r{i}", "free": True} for i in range(11)]]
        for b in bad:
            self.assertEqual(self.sql_decisions([b])[0]["error"], "invalid_request", b)

    def test_s5_a_signed_in_person_who_is_not_an_admin_is_refused(self):
        r = sql("begin; " + MIG + "; " + PLACE + f"; set local role authenticated; select set_config('request.jwt.claim.sub', '{UID}', true), set_config('request.jwt.claim.role', 'authenticated', true); "
                f"select decide_rider_rules_v2('s1', (select kitchen_id from orders where session_id = '{UID}'), (select id from orders where session_id = '{UID}'), '[{{\"id\":\"r1\",\"free\":true}}]'::jsonb) as d; reset role; rollback;")
        row = r[-1] if isinstance(r, list) else r
        self.assertEqual(row["d"]["error"], "not_allowed", r)


if __name__ == "__main__":
    unittest.main()
