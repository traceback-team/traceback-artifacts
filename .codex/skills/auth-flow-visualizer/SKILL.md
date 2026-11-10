---
name: auth-flow-visualizer
description: "Create or update visual HTML guides for TRACEBACK system flows, AWS deployment setup, API contracts, and lifecycle states."
---

# TRACEBACK System Visualizer

Use this skill when documenting a TRACEBACK subsystem as a visual, reusable HTML
mini-site. It supports authentication, catalog/product management, commerce, and
future domains without reducing the explanation to a table or a prose-only page.

## Workflow

- The canonical guides and this skill live in `traceback-team/traceback-artifacts`,
  separate from the TRACEBACK backend and frontend. Inspect
  `traceback-team/traceback` or `traceback-team/traceback-client`, as appropriate,
  at a known revision before asserting current implementation or deployment state.
  In Codex Cloud, attach all three repositories to the same environment. The
  iPad itself does not need to clone them. If a relevant source repository is
  unavailable in the task, mark implementation claims unverified instead of guessing.
- Link source files to their GitHub URL and checked revision. Do not use
  relative paths that escape this documentation repository: the published
  site cannot resolve them.
- Create or update HTML artifacts under `docs/artifact/` in the repository.
  Use a descriptive filename such as `auth-flow.html` or `aws-ssm-access-guide.html`.
  Do not place generated artifacts inside `.codex/skills/`; that directory contains
  reusable skill instructions and resources. If an artifact is added or moved, update
  the relevant checkpoint or documentation links so readers can find it.
- Keep diagrams and interaction code in the HTML. Screenshots may live in
  `docs/artifact/images/`; verify their relative paths and include them in PDF
  output. Use inline `data:` images when a single portable HTML file is needed,
  accepting the larger HTML size and harder image replacement.
- Treat it as a small documentation site: keep a shared shell and domain
  navigation. The five TRACEBACK infrastructure pages show the project topology,
  actual configuration, choices, environment boundaries, and verification state.
  Explain only the concepts needed at each step on that same page, below the
  setting or command that raised the question. Keep deeper account/auth behavior
  in its own topic artifact. Preserve existing source-reference sections.
- Keep `docs/artifact/index.html` as the single mobile entry point. Add each new
  guide to `docs/artifact/catalog.json`, run `scripts/build_index.py`, and give
  the guide a visible return link to the index. New subjects/topics can use
  `docs/artifact/topics/<subject>/<topic>/<slug>/index.html`; do not break older
  published URLs when organizing existing guides.
- Make the explanation visual-first with SVG or CSS diagrams, lanes, arrows,
  highlights, and state transitions. Do not turn the main explanation into tables or
  prose cards.
- Add interaction when it clarifies behavior, such as domain tabs, branch selectors,
  step controls, focus highlighting, or expand/collapse details.
- Use restrained animation to communicate direction or state change, respect
  `prefers-reduced-motion`, and keep the initial frame understandable without input.
- Label ownership on every meaningful node: framework/library, TRACEBACK custom code,
  frontend, database, or external service. Show the actual method, endpoint, event,
  or state transition when known, and briefly explain what the node does.
- Mark short-circuit conditions, transaction boundaries, retries, and failure paths
  explicitly. Do not imply a callback or library hook runs unless the source proves it.
- Name the actor and target whenever a sentence mentions a server, key, port,
  request, response, inbound rule, outbound rule, or permission. For example,
  distinguish the reader's local computer from the remote EC2 instance, and
  distinguish an AWS login identity from the Linux user inside EC2. Explain a
  prerequisite term such as HTTP/HTTPS or a new connection before using it to
  explain stateful return traffic. A beginner should not need another source to
  identify who owns an object or which direction an arrow travels.
- Use semantic controls, visible labels, `aria-live` where state changes, text
  alternatives, keyboard operation, and responsive layout down to narrow widths.
- Provide a visible PDF save action. Its print view must include content hidden
  behind tabs or closed details, preserve diagrams and screenshots, and omit
  navigation controls; restore the interactive state after printing.

## Information density and progressive disclosure

- Keep one primary end-to-end flow visible. Do not repeat the same full flow as
  a definition grid, a second lane, and a step rail. If another view does not add
  a distinct relationship, remove it and let the primary flow control the detail.
- Give each always-visible node only the stage name, its main input-to-output
  transformation, and at most one short plain-language responsibility. Do not
  shrink type or tighten spacing to fit examples, evidence, and exceptions into
  the overview; a taller page is preferable to a crowded first view.
- Put concrete evidence next to the stage that raises it, inside an accessible
  expand/collapse block by default. Examples include Catalog rows, before/after
  internal structures, candidate-plan comparisons, source excerpts, and
  engine-specific caveats. Keep the closed summary specific enough that readers
  know what evidence it reveals.
- Use a compact visual for comparisons that readers must scan, such as before →
  after, two candidate paths → one choice, or metadata record → resolved object.
  Put the explanatory prose after that visual instead of embedding paragraphs in
  every overview node.
- Split to another page only when the detail is a reusable subject with its own
  learning goal. Do not create a separate glossary or page merely to make a
  crowded overview shorter; first remove duplication and use local disclosure.
- Check both the default closed state and representative expanded states at a
  narrow and desktop viewport. The closed state must show the whole flow without
  overload, and opening one detail must not create horizontal overflow or tiny text.

### Preserve the big flow across deeper steps

- The learning goal is the system's large flow and responsibility boundaries, not
  exhaustive mastery of every internal type, folder, callback, or file. Inspecting
  internals is appropriate when it verifies who owns a step, why an arrow exists,
  or where a replaceable boundary sits; keep unrelated implementation detail out of
  the primary path.
- When one step introduces concrete architecture nodes such as source folders,
  modules, interfaces, processes, or storage components, reuse those same names and
  visual boundaries in the next behavioral trace. Do not switch back to unrelated
  generic layer names unless the visual explicitly maps each generic layer to the
  previously introduced node.
- Treat a later step as a trace over the earlier map: highlight the nodes traversed,
  preserve their ownership colors, and add the state changes, verified calls, or new
  architecture nodes needed to explain that step's responsibility boundaries. Put
  source lines, callback catalogs, exceptions, and alternative paths in local
  disclosure rather than replacing the large flow with a new dense diagram.
- At every step boundary, state in one sentence what remains the same from the prior
  map and what the current step adds. A reader should not have to reconcile two
  independently named architectures to follow one request end to end.

## Accuracy checks

- Verify every node, edge, state, and transition against the current source before rendering.
- Include endpoint, source ownership, and the relevant source path when that removes ambiguity.
- Do not invent framework behavior, business rules, or future domain behavior. Mark
  planned sections as planned instead of filling them with assumptions.
- Keep detailed source paths in a compact reference area or accessible text, while
  keeping the diagram readable.

## Database learning artifacts

Apply these rules to database topics such as locking, MVCC, isolation levels,
indexes, and transactions.

### Separate common concepts from engine implementations

- Classify each claim before drafting: is it a database-wide concept, or the
  behavior and terminology of a particular engine? Do not mix both categories
  in one unlabeled explanation.
- Explain shared principles in an engine-neutral section. If an engine has an
  important exception or implements the principle differently, label that
  difference next to the common concept and expand it in the engine section.
- Never generalize an engine-specific lock name, wait representation, index
  behavior, or isolation rule into a universal database rule. Name the engine,
  the locked target, and the relevant mode or condition.

### Compare only on shared criteria

- When a PostgreSQL and MySQL InnoDB comparison is useful, use the same axes for
  both engines: purpose, target, mode or mechanism, conflict or wait condition,
  release point, and variables such as isolation level, index, and predicate.
- A common-concept overview followed by engine tabs is appropriate when readers
  need to compare implementations of the same principle. Do not create tabs or
  forced comparisons for unrelated topics merely to satisfy a template.
- Keep the comparison symmetric enough that the same SQL or scenario can be
  traced in each engine, while preserving differences that resist a one-to-one
  mapping.

### Teach from purpose to evidence

- Explain in this order: what it is, why it is needed, how it works internally,
  how engines differ, and a concrete example. Use a compact visual before dense
  reference material.
- For terms that beginners commonly confuse, state both the lock or operation's
  target and its actual role. Similar names do not imply the same target,
  compatibility, or implementation.
- Do not simplify away technically meaningful differences. Verify engine claims
  against the official documentation, state important conditions and limits,
  and keep the detailed comparison available without overwhelming the primary
  learning path.

## Required artifact standard

Apply this standard whenever creating or updating an HTML artifact
under `docs/artifact/`. Do not consider the artifact complete until a new reader
can answer these questions from the page itself:

1. What is the end-to-end flow? Show it first with a labeled visual and explain
   the arrows, participants, and boundaries in plain language.
2. Where can the reader learn the underlying terms, practical options, and
   tradeoffs? Put the terms and comparison after the concrete TRACEBACK step
   on that page. Separate AWS product names from general networking/computing
   terms. Use another page only for a genuinely separate subject, such as
   account behavior after an infrastructure overview.
3. Which option does TRACEBACK use, and why? Tie the decision to the actual
   code, configuration, and operational constraints.
4. Where is it implemented? Place relevant source/configuration excerpts next
   to their explanation, with a link to the current file. Explain who consumes
   each value and at what stage; do not leave a code dump without a purpose.
5. What works now, what is configured but untested, and what is still pending?
   Label these states explicitly, including security and deployment boundaries.

Keep the visual and its detailed explanation close enough to read together.
Treat repository code as evidence of TRACEBACK's implementation, not evidence
that the choice is universal or optimal. For layered decisions, compare each
independent layer in order (for example, browser session vs token, account-flow
library, then templated pages vs headless API; or email protocol, delivery
provider, then synchronous vs queued sending). Name at least one credible
alternative at each real decision point, its tradeoff, and the reason the
current project chose its path. Do not invent an alternative merely to fill a
template.
Use screenshots only when they add verifiable setup context; diagrams may explain
the general path. Verify the source and observed setup before asserting a current
state. An attractive page that omits a required answer is unfinished.

## AWS initial setup learning set

Maintain five project-configuration pages in order: `flow-1-system.html`,
`flow-2-access.html`, `flow-3-deploy.html`, `flow-4-address.html`, and
`flow-5-dns.html`. They show the full TRACEBACK configuration and connection
paths, including Client→Vercel and Server→AWS, actual environment-variable
locations, development/production boundaries, and explicit verification state.
Do not shorten actual configuration into a summary or move it out of the five
pages. Use tabs for meaningful tasks, such as choosing and configuring EC2 access
versus actually opening the session. Put alternative choices and longer setup
evidence in accessible details blocks, with screenshots or rendered diagrams
when they help verify the observed setting. Keep existing long guides at their
published URLs as historical references: `traceback-system-guide.html`,
`1-aws-ssm-ssh-learning-guide.html`, `2-dev-server-first-deployment.html`,
`3-development-ip-domain-guide.html`, and `4-dns-resolution-map.html`. Preserve
their existing URLs and fragment IDs. Do not add separate vocabulary-only pages
or a vocabulary section to the index. The main path should read like a sentence
followed by just enough explanation to understand and reproduce that sentence.

The index also links the authentication study path:
`auth-session-allauth-guide.html` compares session/token, account-flow tools,
and allauth presentation modes; `email-smtp-ses-guide.html` compares mail
transport, delivery provider, and send timing. Keep both paths connected to
the system guide and the deployment guide where server configuration matters.

- On a project-flow page, start with the actual TRACEBACK participants and
  explain which connections are code-defined, previously observed, or live-tested.
  Compare relevant options in a collapsible block, show the concrete setting and
  evidence, then define the terms the reader just met below it. Keep current-state
  and general claims visibly distinct.
- Before splitting a long guide into sections or tabs, draw one end-to-end map
  that includes its main path, meaningful alternate paths, and where those paths
  rejoin. Label which part each later section enlarges. At section boundaries,
  say why the next section follows and how it changes the same flow. Put a new
  term such as bastion at its actual branch in the map before analyzing it;
  otherwise the reader has no reason to care about that branch.
- Choose the learning depth from the task and the intended reader. For a
  beginner or study guide, let a reader understand the whole flow from the
  picture and short captions first, then reveal terminology, mechanisms,
  tradeoffs, and source code. An experienced-reader summary may be compact, but
  keep the diagram and deeper explanation accessible. Ask the user about level
  only when it cannot be inferred; TRACEBACK's study and startup guides default
  to beginner-friendly maps with optional depth.
- Give the visual a short plain-language explanation, then put longer reasoning,
  exceptions, and code in accessible expand/collapse sections. Ensure closed
  details are included when printing to PDF. Put the detail beside the step it
  explains instead of collecting all explanation at the end.
- Anticipate a beginner's next question at each conceptual jump (for example,
  how a service connects, which identity authorizes it, and why a port is or is
  not needed). Answer it next to the relevant diagram in plain language.
- Before writing a glossary, draw a concept map for every cluster of related
  terms. Show containment (which resource is inside which), sequence (what must
  exist or happen first), and independent controls (for example route table vs
  security group vs IAM). Label arrows by their meaning; do not use one arrow
  for both containment and network traffic. A term pair such as “EC2 · instance”
  must say whether it is a service-to-resource relationship or two alternatives.
- Run a beginner-question audit after drafting each section: ask “why is this
  needed?”, “who owns/uses it?”, “what is it inside or attached to?”, “what
  happens before and after?”, “how is it different from the adjacent term?”,
  and “what fails if it is absent?”. Answer the likely questions near the map,
  then leave a glossary only for quick recall. Review every guide in the
  learning set for the same isolated-definition problem when changing one.
- In a setup recipe, label shared prerequisites and standard commands separately
  from one project's provider, profile, resource IDs, or convenience shortcuts.
  Never imply a project-specific alias is a built-in cloud command or a required
  industry-wide step.
- For every code block, label it as an exact repository excerpt, executable
  example, schematic pseudocode, or observed console value. Exact excerpts must
  identify the source file and real line numbers, offer a source link, and put
  the relevant explanation beside the code when space permits. Verify every
  copied line and line range against the current source; refresh stale copies
  instead of leaving plausible but outdated examples. Never assign repository
  line numbers to a generated command or console-only setting.
- For a guide that may be read on mobile or outside the checkout, make exact
  source links land on the relevant lines in the repository viewer. Keep the
  displayed source revision identifiable so later edits do not silently change
  what the linked line numbers mean.
- Show setup dependencies in the order a first-time deployer must complete them.
  Place the status of each TRACEBACK step on that flow, including the first
  missing step that blocks a live request. Explain DNS, inbound routing, TLS
  certificate issuance/renewal, reverse proxy, runtime environment variables,
  database access, deployment, and frontend verification at their actual points
  in the path; do not collect omissions only in a final checklist.
- Define even basic terms at first use or in a nearby beginner glossary, while
  keeping general networking terms distinct from AWS product names.
- Next to the relevant visual, compare practical setup options, their tradeoffs,
  TRACEBACK's choice, and the reason for it. Put applicable configuration or
  source excerpts beside their explanation, with links to the current files.
  Explain who reads each setting and when, especially for environment files.
- Give enough console or terminal steps for a new AWS user to reproduce the
  setup. Distinguish a general procedure from values observed in this account.
- Mark each important setting as **configured and verified**, **configured but
  not yet tested**, or **still to do**. Show the current inbound, outbound,
  route-table, subnet, IAM, DNS, and runtime state where relevant. Name remaining
  checks such as NACL rules, narrow egress, HTTPS, and EC2-to-RDS connectivity
  instead of implying the initial deployment is complete.
- Recheck live-state claims or date them, and compare code excerpts with the
  current repository. Review screenshots before publishing: record visible
  account/resource identifiers and remove secrets or personal data. Show console
  screenshots large enough to read or give a direct full-resolution link; do not
  shrink dense settings pages into a two-column thumbnail grid.
