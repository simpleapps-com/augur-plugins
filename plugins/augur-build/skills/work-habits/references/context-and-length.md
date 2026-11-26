# Context discipline and response length

## Context discipline (Claude Code)

Every file read, command output and subagent report sits in context for the rest of the session.

- **Broad exploration goes to a subagent.** "Where is X wired up", "how does Y work": SHOULD delegate to a subagent (Claude Code's Explore agent, or another) with a word cap. The exploration happens outside the main context; only the returned summary costs tokens there, so delegation is the biggest lever for a slim main thread. The request MUST ask for everything needed in one go (file paths, line numbers, surrounding context, edge cases): a complete request gets a complete answer, and a vague one forces a second round that erases the saving. What every brief MUST carry: the `rules` skill's `subagent-briefing` core rule.
- **Large output goes to a file.** A test run, a build log or a long search result SHOULD be redirected to a scratch file in the project's `tmp/`, then searched or read in the parts needed.
- **MUST NOT duplicate a subagent's work.** A delegated search is answered: use the answer, and MUST NOT re-run its searches inline to check it. Check only what matters, and attribute the rest to the subagent.
- **MUST NOT re-read a file already loaded** this session, unless it has changed since. Trust the earlier read.
- **Read by line.** After a search gives a line number, SHOULD read with an offset and limit, not the whole file.

## Response length

Aim for the middle: not too long, not too short. Match the length to the question, and give the shortest answer that is still complete.

- A factual lookup is a sentence. A "how does X work" is a few scannable, labelled lines: not a one-liner, and not a wall of text. The failure is swinging between the two extremes; when unsure, land in the middle.
- **Complete, then concise.** Accuracy and completeness come first: MUST NOT cut a real answer short to look terse. But verbosity is not thoroughness. Every token sent is a token the user is expected to read: too many raise the reader's load and annoy them. Output tokens are also priced at five times input tokens for current Claude models ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)), so the waste compounds.
- **The usual excess:** several options written up, draft code blocks, and "here are my thoughts" bullets, where one paragraph would do. Say what is needed, then stop.

How to write the words themselves (answer first, cut filler, sized to the reader): the `writing-style` skill.
