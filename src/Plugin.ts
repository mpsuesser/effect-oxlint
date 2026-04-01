/**
 * Plugin definition and composition for Effect-first oxlint plugins.
 *
 * @since 0.1.0
 */
import type { CreateRule, Plugin as OxlintPlugin, Rule } from '@oxlint/plugins';
import * as Arr from 'effect/Array';

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

/**
 * The raw oxlint plugin type.
 *
 * @since 0.1.0
 */
export type { OxlintPlugin as Plugin };

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

/**
 * Define a typed oxlint plugin from a name and rule map.
 *
 * @example
 * ```ts
 * import { Plugin, Rule } from 'effect-oxlint'
 *
 * export default Plugin.define({
 *   name: 'my-effect-rules',
 *   rules: {
 *     'no-throw-in-gen': myThrowRule,
 *     'prefer-effect-fn': myFnRule,
 *   }
 * })
 * ```
 *
 * @since 0.1.0
 */
export const define = (config: {
	readonly name: string;
	readonly rules: Record<string, CreateRule>;
}): OxlintPlugin => ({
	meta: { name: config.name },
	rules: config.rules
});

/**
 * Merge multiple plugins into one.
 *
 * If two plugins define a rule with the same name, the later one wins.
 *
 * @since 0.1.0
 */
export const merge = (
	...plugins: ReadonlyArray<OxlintPlugin>
): OxlintPlugin => ({
	meta: {
		name: Arr.join(
			Arr.map(plugins, (p) => p.meta?.name ?? 'unknown'),
			'+'
		)
	},
	rules: Arr.reduce<OxlintPlugin, Record<string, Rule>>(
		plugins,
		{},
		(acc, p) => ({ ...acc, ...p.rules })
	)
});
