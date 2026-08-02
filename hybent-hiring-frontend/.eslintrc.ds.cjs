/**
 * Design-system compliance lint.
 *
 * Separate from `.eslintrc.cjs` on purpose. The main config runs with
 * `--max-warnings 0` and gates CI; these rules currently report thousands of
 * pre-existing violations, so wiring them into that config would block every
 * commit on day one.
 *
 *   npm run lint:ds          the full debt report
 *   npm run lint:ds -- src/modules/recruiter    one workspace at a time
 *
 * The count is the migration's progress bar. Phase 10 flips these to errors,
 * folds them into the main config, and deletes this file.
 *
 * Baseline at phase 1 — see the redesign roadmap:
 *   2,074 inline style objects
 *   175 distinct hardcoded hex colours
 *   29 distinct border radii
 *   77 distinct box shadows
 */

const NO_HEX = {
  selector: 'Literal[value=/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/]',
  message:
    'Hardcoded hex colour. Use a token: rgb(var(--hb-blue)) in CSS, or a Tailwind hb-* class. See src/styles/tokens.css.',
}

const NO_HEX_TEMPLATE = {
  selector: 'TemplateElement[value.raw=/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/]',
  message:
    'Hardcoded hex colour in a template literal. Use a token — see src/styles/tokens.css.',
}

const NO_ARBITRARY_RADIUS = {
  selector: 'Literal[value=/\\brounded-\\[\\d+px\\]/]',
  message:
    'Arbitrary border radius. Use rounded-hb-xs | hb-sm | hb-md | hb-lg | hb-xl | hb-full.',
}

const NO_ARBITRARY_TYPE = {
  selector: 'Literal[value=/\\btext-\\[\\d+px\\]/]',
  message:
    'Arbitrary font size. Use the ramp: text-hb-display | hb-h2 | hb-h3 | hb-body | hb-sm | hb-xs | hb-label | hb-num | hb-ctl-lg | hb-micro.',
}

const NO_POPPINS = {
  selector: 'Literal[value=/Poppins/]',
  message:
    'Poppins is not a Hybent typeface. Use font-display (Sora), font-body (Manrope) or font-mono (IBM Plex Mono).',
}

/**
 * Hand-written style objects — `style={{ background: '#6c47ff' }}`.
 *
 * Deliberately narrowed to an object *literal*. The rule's target is a page
 * author writing CSS by hand, and matching the bare attribute caught two things
 * that are not that:
 *
 *   style={drag.draggableProps.style}   a style object a library hands you
 *   style={chartLabel(theme)}           a style object the design system builds
 *
 * Both are the correct way to use those libraries — recharts' `LabelList` and
 * `@hello-pangea/dnd` take style objects and no class — and there is no version
 * of them that satisfies the broader selector. Flagging them taught the only
 * available lesson wrong: that the fix is an eslint-disable.
 *
 * A literal is still a literal even when its values are computed, so
 * `style={{ top: menu.y }}` is still reported. That is intended: a positioned
 * overlay belongs in a primitive.
 */
const NO_INLINE_STYLE = {
  selector: 'JSXAttribute[name.name="style"] > JSXExpressionContainer > ObjectExpression',
  message:
    'Hand-written style object. Use a design-system component or a token class. If the value is genuinely computed at runtime, the component belongs in src/components/hb/ where that is allowed.',
}

const TOKEN_RULES = [NO_HEX, NO_HEX_TEMPLATE, NO_ARBITRARY_RADIUS, NO_ARBITRARY_TYPE, NO_POPPINS]

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2020, sourceType: 'module', ecmaFeatures: { jsx: true } },
  ignorePatterns: [
    'dist',
    'dev-dist',
    'archive',
    '*.cjs',
    /* The company site is already on the design system and owns its own
       stylesheet; its inline styles are gradient stops and animation delays. */
    'src/modules/site',
    /* The marketing shell that wraps it. These five render inside `.hb-site`
       and are styled by `hybent-site.css`, not by the product token layer —
       rewriting them against `--hb-*` would make the public pages stop
       matching hybent.com, which is the opposite of the goal. `AppLayout`
       composes them; `HiringHomePage` is a marketing page that happens to
       live outside `modules/site`. */
    'src/components/layout/GlobalNav.tsx',
    'src/components/layout/GlobalFooter.tsx',
    'src/components/layout/SiteSvgDefs.tsx',
    'src/components/common/MouseTrail.tsx',
    'src/modules/hiring/pages/HiringHomePage.tsx',
  ],
  rules: {
    'no-restricted-syntax': ['warn', ...TOKEN_RULES, NO_INLINE_STYLE],
  },
  overrides: [
    {
      /**
       * The design system is the one layer allowed to compute a style — a
       * caller-supplied column width, a chart height, a skeleton's column
       * count. Encapsulating exactly those is what the layer is *for*, and
       * pushing them behind a component is how pages get to zero.
       *
       * Token rules still apply here in full: no hex, no arbitrary radius or
       * type, no Poppins. Only the inline-style selector is lifted.
       *
       * An `eslint-disable` comment cannot express this, because the main
       * config does not define `no-restricted-syntax` and would then flag every
       * such comment as an unused directive.
       */
      files: ['src/components/hb/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-syntax': ['warn', ...TOKEN_RULES],
      },
    },
  ],
}
