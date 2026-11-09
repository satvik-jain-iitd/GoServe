-- Story #938: a session can no longer be joined by its id, and no one can reset another session.
-- join_session let any signed-in user read a customer's orders. reset_session let that user delete them.
-- Both are dropped. Every link they made is deleted, so no one keeps access they got before.
-- The table session_links stays (0052 still cleans it) and is now empty.
drop function if exists join_session(text);
drop function if exists reset_session(text);
delete from session_links where true;
