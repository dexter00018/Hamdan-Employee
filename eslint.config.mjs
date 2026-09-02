import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Only the three legacy monolithic dashboards retain a temporary warning
  // while their Supabase response types are extracted into shared modules.
  // New files and all smaller components fail lint on explicit `any`.
  {
    files: [
      "app/employee/page.tsx",
      "app/hr/page.tsx",
      "app/super-admin/page.tsx",
      "app/api/address-search/route.ts",
      "app/api/check-email/route.ts",
      "app/auth/reset-password/page.tsx",
      "components/employee/**/*.tsx",
      "components/hr/modals/EmployeeDocumentsModal.tsx",
      "components/super-admin/modals/AuditLogModal.tsx",
      "lib/employee/commute.ts",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
