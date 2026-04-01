# Changelog

## 0.1.0

Initial release.

### Modules

- **Rule** — `define`, `meta`, `banMember`, `banImport`, `banStatement`
- **Visitor** — `on`, `onExit`, `merge`, `tracked`, `filter`, `accumulate`, `toOxlintVisitor`
- **AST** — `matchMember`, `matchCallOf`, `matchImport`, `narrow`, `memberPath`, `findAncestor`, object helpers
- **Diagnostic** — `make`, `fromId`, `withFix`, `withSuggestions`, composable fix helpers
- **RuleContext** — Effect service wrapping oxlint context with convenience accessors
- **SourceCode** — effectful queries over tokens, comments, scope, and source text
- **Scope** — variable lookup, reference analysis, and scope navigation with `Option`
- **Plugin** — `define` and `merge` for plugin assembly
- **Comment** — comment type predicates
- **Token** — token type predicates
- **Testing** — AST builders, mock context, `runRule`, `expectDiagnostics`
