# Bash Simplicity

- MUST run one command per Bash call, with no shell plumbing: no `;`, `&&`, `|`, `$()`, `2>&1`, `echo $?`, or inline interpreters (`node -e`, `python -c`). The tool already captures output and exit codes.
- Files: the Read, Edit and Write tools by default; `cat`, `head`, `tail`, `sed`, `awk` and heredocs MAY be used when simpler (a `sed -n` line range, a one-line `sed -i`). SHOULD use Edit for exact or multi-line replacements, where `sed` flags differ between GNU and BSD/macOS.
- Search: MUST use the Grep and Glob tools when they are in the tool list; otherwise `grep -rn` (or `rg`) and `find` or `ls`, still one command each: no pipes to `head`, no chained `find -exec grep`.
- Scratch files (commit messages, PR bodies) go in the project-level `tmp/`, never `repo/tmp/`, and are removed after use. From `git -C repo`, a message file is `../tmp/<file>`.
- MUST NOT use `kill`, `pkill` or `lsof` to stop a process: stop a background task with TaskStop; a process the session did not start is the user's to stop.
