# Audit

## Does

Scans a site for custom code that an installed `@simpleapps-com/augur-*` package already replaces, and reports each finding with its replacement and a priority. It reads only: no code changes, no installs, no issues, unless the user asks afterwards.

## Steps

1. **Source root.** `<site>` as in `SKILL.md`. `ls <site>/app`, then `ls <site>/src/app`: the first that exists sets `<src>` (`<site>` or `<site>/src`).
2. **Installed packages.** `ls <site>/node_modules/@simpleapps-com/`. Scan only for what installed packages provide; list missing packages separately.
3. **What the packages provide now.** Read each installed package's `llms.txt`, `README.md` and `EXPORTS.md`, including any note on what an export replaces. They are the current truth; the patterns below are a starting set and MAY miss newer exports.
4. **Scan.** One search per pattern, each its own command, the pattern in double quotes (none of them contains `"`, `$` or a backtick; a `.` stands in for either quote mark):
   ```
   grep -rnE --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=.turbo --exclude-dir=coverage --exclude-dir=.git --exclude="*.test.*" --exclude="*.spec.*" "<pattern>" <src>
   ```

   | Area | Pattern | Custom code |
   |------|---------|-------------|
   | utils | `from .@/lib/utils` | a local `cn()` and helpers |
   | utils | `(function\|const) formatPrice\|from .@/.*[Pp]rice` | price formatting |
   | utils | `from .@/types/` | local copies of shared types |
   | utils | `staleTime\|gcTime\|CACHE_CONFIG` | cache config (one line each; read the file) |
   | web | `from .@/components/ui/` | local UI components |
   | hooks | `(function\|const) (useDebounce\|useIsMobile\|useMobile\|useIsHydrated\|useItemPrice\|useFormatPrice)\b` | hooks a package provides |
   | hooks | `from .@/.*(useDebounce\|useIsMobile\|useMobile\|useIsHydrated)` | imports of those local hooks |
   | hooks | `useCartStore\|CartStore` | a cart store |
   | server | `(function\|const) (cachedSdkCall\|sdkCall\|getServerQueryClient)\b` | an SDK cache or query client |
   | server | `(function\|const) isDev\b\|NODE_ENV.*development` | environment detection |
   | server | `CredentialsProvider\|providers:.*Credentials` | hand-built auth (unless the file uses the package's auth factory) |
   | standards | `from .(lucide-react\|@heroicons/react)` | another icon library |

   In the table, `\|` is escaped for the table: the pattern itself uses a plain `|`. Also `ls <site>`: any `tailwind.config.*` (`.ts`, `.js`, `.mjs`, `.cjs`) is a Tailwind v3 config.
5. **Judge each match** by reading the file: a match is a lead, not a finding. Drop what the package does not actually replace, and what belongs in the site ("What stays in the site" in `SKILL.md`).
6. **Partial migrations.** For a definition (`function useDebounce` in `src/hooks/`), check whether that file already imports from `@simpleapps-com/augur-*`. For an import (`from "@/lib/utils"`), open the module it imports from and check that file instead. Either way, a file that already uses a package and keeps a local copy is a partial migration, reported apart from new findings.

## Writing the wiki settings

None. The audit reads no wiki settings.

## Safeguards

Read-only: `ls`, `grep -rnE` and Read, inside the site. No code changes, installs or issues. When the user asks for issues afterwards: by default one combined issue listing every finding, through one `/repo issue`. One issue per package only when the user asks for that, each its own `/repo issue`. Titles in Conventional Commits style (`chore: replace custom hooks with augur-hooks`), each body listing the files and the replacement for each.

## Report

```
## Augur packages audit: <site>
Installed: augur-core 2026.11.3, augur-utils 2026.11.5, augur-hooks 2026.11.4, augur-web 2026.11.2
Missing: augur-tailwind (the site has a tailwind.config.ts)

| # | File | Custom code | Replacement | Priority |
|---|------|-------------|-------------|----------|
| 1 | src/lib/utils.ts:3 | cn() | augur-utils cn | high |

Partial migrations: src/hooks/usePrice.ts (imports augur-hooks, keeps a local formatter)
Summary: 7 findings (3 high, 3 medium, 1 low) across 3 packages
```

Priority: **high** is a drop-in replacement; **medium** needs refactoring; **low** is cosmetic.
