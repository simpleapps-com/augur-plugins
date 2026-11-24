# `/rules file [what]`

## Does

Drafts a GitHub issue on `simpleapps-com/augur-plugins`, the marketplace this skill ships from, proposing a new rule or a change to an existing one, so every project that uses this skill gets it, and files it on the user's yes. `[what]` is the rule, lesson or change in the user's words, or a file and line in the project; without it, the session's latest lesson or `audit` finding is the candidate, confirmed first. It changes nothing in the project.

## Reads

The rule or lesson named, this skill's current text for what it would change ([core/](core/), [catalogue.md](catalogue.md)), the project's banned-strings list if it has one, and the issues on the target repo (to avoid a duplicate).

## Steps

1. **Classify** it as one of: a new rule (`rules: new rule: <name>`), a change to a core (`rules: change to core:<name>`), or a change to a catalogue entry (`rules: change to catalogue:<entry>`). `<name>` and `<entry>` are lower-case words and hyphens only. A rule that only makes sense in this project is not filed: say so and stop.
2. **Look for a duplicate:** `gh issue list --repo simpleapps-com/augur-plugins --search "rules:" --state all --limit 100`. If an open one covers it, or a closed one already turned it down, show it and stop; adding to it is the user's call. If the command fails, go on to the draft and say duplicates were not checked.
3. **Draft** the issue in the scratch folder, the title on its first line so it is checked too:
   - **Proposed text:** the rule, or for a change the current text and its replacement.
   - **Why:** what goes wrong without it.
   - **Where it came from:** the incident, retold with placeholders. The target repo is public: no client, project, repo or person's name or id, credential, customer value, private path or host, and no quoted user words; paraphrase them.
   - The attribution footer the session's harness asks for, if any.
4. **Check** the draft against the project's banned-strings list, as `SKILL.md` "Nothing private" says. A match stops the run: say the draft matched, never the string. List or not, re-read the draft for anything private; without a list, say no list checked it.
5. **Show** the title, the full body and the repo it goes to, then wait.
6. **File** it only on a clear yes to that draft: `gh issue create --repo simpleapps-com/augur-plugins --title '<title>' --body-file <draft>`, then delete the draft. A change asked for instead is made to the draft, checked again (step 4) and shown again. Anything but a clear yes files nothing; delete the draft. If the command fails, keep the draft, show the error, and give the repo's new-issue page (`https://github.com/simpleapps-com/augur-plugins/issues/new`) for the user to file it; MUST NOT retry with other flags.

## Approval

Typing `/rules file`, or asking in the user's own words for a rule to be filed upstream, starts the run; the issue is filed only on the user's yes to the draft shown in step 5. When the model picked this skill for another request, it shows the draft and the repo and files nothing. In chat it always gives the draft and the new-issue page.

## Report

The issue's URL and title, and what the project keeps meanwhile: its own lesson, or its wording after a core's closing marker, until a release carries the change.
