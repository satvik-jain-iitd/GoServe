-- Story #51. The ops screen reads the decisions and the runs of its own session and of the sessions it joined (ADR-012).
-- Writes stay with the service role. The bare anon key still reads nothing.

create policy decision_read_own_session on decision_log for select to authenticated using (is_my_session(session_id));
create policy run_read_own_session on run_log for select to authenticated using (is_my_session(session_id));
