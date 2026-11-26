# PRScout

[![CI](https://github.com/RauhanAli/prscout/actions/workflows/ci.yml/badge.svg)](https://github.com/RauhanAli/prscout/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/prscout-cli.svg?color=83a9ff)](https://pypi.org/project/prscout-cli/)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-69c7a6.svg)](https://github.com/RauhanAli/prscout/blob/main/pyproject.toml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-83a9ff.svg)](https://github.com/RauhanAli/prscout/blob/main/LICENSE)

**Find an open-source project that will actually merge your first PR.**

Paste a GitHub repository. PRScout reads its recent pull requests and tells you,
in plain English, whether newcomers get replies, get merged, and where their
work lands. The answer is one of **Worth your time**, **Long shot**, **Not
worth your time** or **Not enough evidence** (or **Personal project** for
someone's own repo, and **A list, not code** for a list or catalogue), with
links to the pull requests behind it.

![PRScout answering for pallets/flask, then finding starter issues](https://raw.githubusercontent.com/RauhanAli/prscout/main/assets/demo.gif)

<!-- PRSCOUT_SITE_URL: the product lives at https://gitprscout.com -->

**[Try it in your browser](https://gitprscout.com)** · no install, no
account · [Install the CLI](#2-the-command-line) ·
[Get the browser extension](#3-the-browser-extension)

PRScout is read-only. It never opens pull requests, posts comments or contacts
maintainers, on any surface.

## Three ways to use it

### 1. The web app

<!-- PRSCOUT_SITE_URL -->

Open **<https://gitprscout.com>** and paste a repository. Or take any GitHub
link and **swap hub for PRScout**: `github.com` becomes `gitprscout.com`, and you
land on the report.

```text
https://github.com/home-assistant/core
https://gitprscout.com/home-assistant/core
```

No repository in mind? **Find a project** asks which languages you read and how
much time you have, then lists welcoming repositories with open starter issues.

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/RauhanAli/prscout/main/assets/web-report-light-desktop.jpg" alt="The report for home-assistant/core: Worth your time, with the counts behind it and where to start" width="640"></td>
    <td><img src="https://raw.githubusercontent.com/RauhanAli/prscout/main/assets/web-find-dark-phone.jpg" alt="Find a project on a phone: pick languages and time, get welcoming repositories" width="200"></td>
  </tr>
</table>

### 2. The command line

The same engine runs on your machine, from PyPI. It needs Python 3.11 or newer;
use whichever installer you have (all three work in PowerShell too):

```sh
pipx install prscout-cli
uv tool install prscout-cli
pip install --user prscout-cli
```

Give it a GitHub token once. PRScout reads only public data, so
[create a token](https://github.com/settings/tokens/new?description=PRScout) with
every box unticked, then run `prscout token` and paste it. If you use the GitHub
CLI, PRScout picks up `gh auth token` and you can skip this.

```sh
prscout start --lang python          # starter issues in repositories that merge newcomers
prscout analyze home-assistant/core  # is this one worth your time?
prscout                              # the interactive terminal interface
```

No AI key is needed. Without one you get the rules-only report: the answer and
the numbers behind it, free. For a written explanation that quotes the threads
it relied on, `prscout models` sets up a model; Gemini's free tier is the cheapest
start.

![prscout analyze pallets/flask in a terminal: Worth your time, what the evidence shows, where outsider work landed](https://raw.githubusercontent.com/RauhanAli/prscout/main/assets/cli-analyze.png)

| Command                                      | Purpose                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `prscout analyze <owner/repo>`               | Assess one repository. `--days N` for the time you have, `--json` for machine-readable output. |
| `prscout start`                              | Starter issues, across repositories (`--lang`, `--topic`, `--hacktoberfest`) or in one.        |
| `prscout compare <repo>…`                    | Several repositories side by side.                                                             |
| `prscout next <repo> --as <login>`           | After your first merge: open issues near the files you already changed.                        |
| `prscout profile`, `prscout discover --live` | Say what you want to work on, then search for it.                                              |
| `prscout token`, `prscout models`            | Save a GitHub token; optionally set up a model.                                                |

**The terminal interface.** Bare `PRScout` opens it: type a repository, watch the
run, open any piece of evidence on GitHub with `o`, and come back to past
assessments. Press `?` on any screen for help.

![The PRScout terminal interface showing the assessment for pallets/flask](https://raw.githubusercontent.com/RauhanAli/prscout/main/assets/tui.png)

[docs/USAGE.md](https://github.com/RauhanAli/prscout/blob/main/docs/USAGE.md)
walks through the whole workflow and
[docs/COMMANDS.md](https://github.com/RauhanAli/prscout/blob/main/docs/COMMANDS.md)
lists every flag.

### 3. The browser extension

**PRScout for GitHub** adds a small chip next to the repository name on
github.com (**PRScout: Worth your time · 15 of 100 newcomer PRs merged**) and
marks the issues PRScout would pick first. Clicking the chip opens the full
report. It sends only the `owner/repo` you are looking at, keeps nothing, and
never writes to GitHub.

![The PRScout chip next to a repository name on GitHub, and PRScout pick marks on the issue list](https://raw.githubusercontent.com/RauhanAli/prscout/main/extension/screenshots/desktop-light.png)

It is not on the extension stores yet. To try it, build it and load it
unpacked in Chrome, Edge, Brave or Firefox:
[extension/README.md](https://github.com/RauhanAli/prscout/blob/main/extension/README.md).

## Hacktoberfest

Every October the site has a seasonal page, **[/hacktoberfest](https://gitprscout.com/hacktoberfest)**:
repositories taking part that actually merge newcomers' work, with starter
issues by language, and a few tips so your pull request doesn't get ignored.
From the command line:

```sh
prscout start --hacktoberfest --lang python
```

## For maintainers: a README badge

Show newcomers they are welcome. Paste this into your README, with your own
`owner/repo`:

```markdown
[![PRScout](https://gitprscout.com/badge/owner/repo.svg)](https://gitprscout.com/owner/repo)
```

The badge shows PRScout's current answer for your repository and links to the
report. It updates when the report does; you never have to touch it again.

## How the verdict works

| Answer                  | Meaning                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| **Worth your time**     | Outsiders get replies and land real work here.                                                         |
| **Long shot**           | Some outside work gets in, but most newcomers don't, or most gets silence or a very slow reply.        |
| **Not worth your time** | The record says a newcomer's week is unlikely to go anywhere here.                                     |
| **Not enough evidence** | Too little outside activity to call it either way. That is an answer, not an error.                    |
| **Personal project**    | Someone's own project or a small team's, like a hackathon entry: not set up for outside contributions. |
| **A list, not code**    | A list or a catalogue of entries, like links or package listings: a merged entry isn't code work.      |

**Rules decide. AI only explains.** The answer comes from fixed rules applied
to counted evidence: who tried, who got merged, how fast the first reply came,
and whether anyone actually reviewed the work. An AI model can add a written
explanation that quotes the threads it relied on, and every claim it makes is
checked against the record before you see it. Unsupported claims are dropped.
The model never chooses the answer.
[docs/DESIGN.md](https://github.com/RauhanAli/prscout/blob/main/docs/DESIGN.md)
has the argument.

## Where it doesn't work

PRScout is a filter, not an oracle. Know the limits:

- **It isn't always right.** Open the linked pull requests before you commit
  a week; the evidence is there so you can check it yourself.
- **It reads the past.** Repository cultures change, and a quiet month can
  look worse than it is.
- **It is about your time, not their quality.** A superb project with a deep
  review queue can still be a poor place for a first pull request.
- **Counts, not conversations.** Without a model, PRScout can't tell you what a
  thread said or who was welcoming, only what happened.

PRScout started as a benchmarked competition entry; that evaluation is now
historical research rather than a live product claim.
[docs/research/EVALUATION.md](https://github.com/RauhanAli/prscout/blob/main/docs/research/EVALUATION.md)
has the design and the full numbers, and
[docs/research/REPRODUCTION.md](https://github.com/RauhanAli/prscout/blob/main/docs/research/REPRODUCTION.md)
reproduces them from a clone with no API key, no token and no money.

## The repository

| Path           | What                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/prscout/` | The engine, the CLI and the terminal interface (`prscout-cli` on PyPI)                                           |
| `web/`         | The web app                                                                                                      |
| `server/`      | The HTTP API the web app calls                                                                                   |
| `extension/`   | The browser extension                                                                                            |
| `docs/`        | Everything else, starting from [docs/README.md](https://github.com/RauhanAli/prscout/blob/main/docs/README.md) |

## Contributing

PRScout is small, and one maintainer runs it. First pull requests are welcome.
[CONTRIBUTING.md](https://github.com/RauhanAli/prscout/blob/main/CONTRIBUTING.md)
starts with a 15-minute path to your first one, and issues labelled
[good first issue](https://github.com/RauhanAli/prscout/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
are sized for it. Participation is governed by the
[Code of Conduct](https://github.com/RauhanAli/prscout/blob/main/CODE_OF_CONDUCT.md);
security reports follow
[SECURITY.md](https://github.com/RauhanAli/prscout/blob/main/SECURITY.md).

Working on PRScout regularly? [docs/DEV-WORKFLOW.md](https://github.com/RauhanAli/prscout/blob/main/docs/DEV-WORKFLOW.md)
is the one-page guide: run the web app locally, preview a branch on staging,
and what CI and deploys expect.

> PRScout started as the winner of **Most useful real-world workflow** at the
> micro1 Frontier Engineering Challenge.

## Licensing

PRScout uses two licenses, split by directory:

- **The engine, CLI, terminal interface and browser extension**
  (`src/prscout/`, `extension/`, everything else at the repo root) are
  [Apache License 2.0](https://github.com/RauhanAli/prscout/blob/main/LICENSE).
  Install the CLI from PyPI, embed the engine, or fork it under Apache terms.
- **The web app and its server** (`web/`, `server/`) are
  [GNU AGPL-3.0](https://github.com/RauhanAli/prscout/blob/main/web/LICENSE). If
  you run a modified version of the web app or server as a network service,
  the AGPL requires you to make your modified source available to the
  people using it.

Apache-licensed contributions from before the split remain Apache-2.0 and
are compatible with the AGPL side, so nothing already in the project needed
anyone's permission to move. If you're contributing new code, see
[CONTRIBUTING.md](https://github.com/RauhanAli/prscout/blob/main/CONTRIBUTING.md#licensing).
