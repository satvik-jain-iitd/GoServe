# Issue protocol

How we handle any bug or problem, every time. This is the standard. Follow it
so nothing is fixed twice and nothing is lost.

## Steps

1. **Capture evidence first.**
   Reproduce the problem. Grab the raw evidence: an execution log, an error
   message, a screenshot, a request and response. Label every claim
   VERIFIED (we saw it), INFERRED (we think so), or UNKNOWN.

2. **Find the owning user story.**
   Which feature or story does this sit under? Look at the epic and its stories.
   If there is no story, create one (issue label `story`, linked to its epic)
   before you fix anything.

3. **Create an issue.**
   Open a GitHub issue. Use label `bug` or `enhancement`. Include:
   - Steps to reproduce.
   - Actual result.
   - Expected result.
   - Root cause, with the evidence.
   - Acceptance criteria.
   - A link to the owning story.

4. **Fix on a branch.**
   Branch name `fix/<issue>-<slug>` (bugs) or `feat/<issue>-<slug>` (features),
   cut from `dev`. Keep the change small. Add or update a test when you can.

5. **Verify end to end.**
   Run the real flow again. Paste the fresh evidence. Do not close the issue on
   hope.

6. **Document.**
   - Add a row to `docs/process-trace.md`.
   - Add or update a follow-up in `docs/follow-ups.md`.
   - Write an ADR if the change touches architecture or scope.
   - Update the relevant doc under `docs/` (for example
     `docs/integrations/n8n-goserve-forms.md`).

7. **Open a PR to `dev`.**
   Wait for CI to pass. Merge. Reference the issue so it closes automatically
   (write "Closes #NN" in the PR body). The owner merges `dev` into `main`.

## Why this exists

We hit the blank-Telegram bug (issue #6) because a fix was tried without a
written contract for the form fields. This protocol keeps the story, the issue,
the fix, and the docs tied together.
