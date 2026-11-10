-- Story #1192: nearest_pin (story #987) runs as the caller and calls distance_m, but anon and authenticated could not run distance_m, so every call answered
-- "permission denied for function distance_m" (42501) on dev and prod and the app silently fell back to an empty pin. distance_m is pure arithmetic on four numbers
-- (no table, no data), so running it is harmless for any caller. Idempotent: a grant that already exists changes nothing.
grant execute on function distance_m(double precision, double precision, double precision, double precision) to anon, authenticated;
