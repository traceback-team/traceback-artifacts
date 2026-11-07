# Artifact working rules

This repository owns the TRACEBACK learning HTML, images, and the
`auth-flow-visualizer` skill. The backend source of truth is the separate
`traceback-team/traceback` repository; frontend and Vercel implementation live in
`traceback-team/traceback-client`.

Before changing a guide:

1. Check the current Git branch and create or switch to a task-specific branch
   before editing. Do not make artifact changes directly on `main` unless the
   user explicitly requests it.
2. Read `README.md` and `.codex/skills/auth-flow-visualizer/SKILL.md`. When
   creating or restructuring a learning path, also read
   `.codex/skills/question-led-learning/SKILL.md`.
3. Identify which statements describe general concepts and which describe
   current TRACEBACK code or deployed state.
4. For current-code claims, inspect `traceback-team/traceback` or
   `traceback-team/traceback-client` at an identifiable revision, as appropriate.
   Their default branches are `main`; use `development` or the named PR branch
   when documenting work that has not reached `main`.
   In Codex Cloud, attach both source repositories and this artifact repository
   to the same environment; do not assume the reader's iPad has a local checkout.
   If the relevant source is unavailable, say so and avoid asserting that code
   or infrastructure is current.
5. Edit only this repository's guides and supporting assets. Link source
   excerpts to the relevant source repository and revision, with line numbers where
   the skill requires them.
6. Run `python3 scripts/verify_site.py` and inspect the rendered page at a
   narrow and a desktop viewport when the visual layout changes.

The index at `docs/artifact/index.html` is the single entry point. Keep the
five AWS learning guides in their established reading order and preserve the
skill's Required artifact standard.

Before merging any artifact PR:

CodeRabbit auto-review is enabled in `.coderabbit.yaml` and runs on pushed PR
commits. Never post `@coderabbitai review` or invoke a manual CodeRabbit review
command. A rate-limited automatic review is a blocker, not a reason to request
another review manually.

1. Wait for the CodeRabbit review to finish. Inspect its review, comments, and
   status check; `PENDING`, a rate-limit message, or no submitted review is not
   a passing review. Address valid findings and wait for the follow-up review.
2. Review the artifact content separately for accuracy against the named source
   revisions and observed infrastructure state. CodeRabbit code review does not
   replace this content review.
3. Merge only after both reviews and the site checks are complete. If CodeRabbit
   cannot finish, leave the PR open and report the blocker to the user.
