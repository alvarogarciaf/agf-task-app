import nextConfig from "eslint-config-next";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [".firebase/**", "node_modules/**", ".next/**", "out/**"],
  },
  ...nextConfig,
  {
    rules: {
      // Next/React 19 rule is strict; shadcn and local-first patterns use effects for sync.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
];

export default config;
