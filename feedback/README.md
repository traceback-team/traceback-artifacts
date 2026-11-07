# Public artifact feedback

Each `*.json` file in this directory is a public opinion about one published
TRACEBACK HTML guide. The public form records a document URL, section ID when
available, a free-form location, the opinion, the Pages revision, and the
GitHub account that submitted it. Text selection is not required.

The Cloudflare Worker accepts form submissions only from the GitHub account
with ID `88140361` (`oscar2272`). It writes a new JSON file here using a
GitHub App installed only on `traceback-team/traceback-artifacts`. The repository
is public, so **anyone can read these opinions**. Do not put secrets or private
information in a comment.

Saving a file here does not edit an HTML guide, start a Codex Cloud task, or
open a pull request. To act on an opinion, start a separate Codex Cloud task
with this repository and ask it to read `feedback/<id>.json`. Review document
changes in a PR before merging them to `main`.

The Pages workflow publishes only `docs/artifact/**` and does not run for a
feedback-only commit under this directory.
