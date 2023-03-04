/*
 * node-subdata-2 - SubData 2 client for Node.js
 * Copyright (C) 2022, 2023  LogN
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

module.exports = {
    env: {
        node: true
    },
    overrides: [
        {
            files: ["**/*.test.ts"],
            env: {
                jest: true
            }
        }
    ],
    root: true,
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: ["tsconfig.json", "tsconfig.eslint.json"],
        warnOnUnsupportedTypeScriptVersion: false
    },
    plugins: ["@typescript-eslint", "deprecation", "unused-imports", "license-header", "simple-import-sort"],
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
    rules: {
        "@typescript-eslint/consistent-type-assertions": ["warn", { assertionStyle: "as" }],
        "@typescript-eslint/consistent-type-imports": ["warn"],
        "@typescript-eslint/explicit-member-accessibility": ["warn"],
        "@typescript-eslint/no-non-null-assertion": ["off"],
        "@typescript-eslint/no-unnecessary-type-assertion": ["warn"],
        "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
        "accessor-pairs": ["warn"],
        "array-callback-return": ["warn"],
        "block-scoped-var": ["warn"],
        "consistent-return": ["warn"],
        "curly": ["warn", "multi"],
        "default-case-last": ["warn"],
        "default-case": ["warn"],
        "default-param-last": ["warn"],
        "deprecation/deprecation": ["warn"],
        "dot-location": ["warn", "property"],
        "dot-notation": ["warn"],
        "eqeqeq": ["warn"],
        "for-direction": ["warn"],
        "getter-return": ["warn"],
        "grouped-accessor-pairs": ["warn", "getBeforeSet"],
        "license-header/header": ["warn", "gpl-header.txt"],
        "no-async-promise-executor": ["warn"],
        "no-await-in-loop": ["warn"],
        "no-case-declarations": ["off"],
        "no-compare-neg-zero": ["warn"],
        "no-cond-assign": ["warn", "except-parens"],
        "no-constant-condition": ["warn", { checkLoops: true }],
        "no-constructor-return": ["warn"],
        "no-control-regex": ["warn"],
        "no-debugger": ["warn"],
        "no-div-regex": ["warn"],
        "no-dupe-args": ["warn"],
        "no-dupe-else-if": ["warn"],
        "no-dupe-keys": ["warn"],
        "no-duplicate-case": ["warn"],
        "no-else-return": ["off"],
        "no-empty-character-class": ["warn"],
        "no-empty-function": ["warn"],
        "no-empty-pattern": ["off"],
        "no-empty": ["warn", { allowEmptyCatch: true }],
        "no-eq-null": ["warn"],
        "no-eval": ["warn"],
        "no-ex-assign": ["warn"],
        "no-extend-native": ["off"],
        "no-extra-boolean-cast": ["warn", { enforceForLogicalOperands: true }],
        "no-extra-parens": ["off"],
        "no-extra-semi": ["warn"],
        "no-fallthrough": ["off"],
        "no-floating-decimal": ["warn"],
        "no-func-assign": ["warn"],
        "no-global-assign": ["warn"],
        "no-import-assign": ["warn"],
        "no-inner-declarations": ["off"],
        "no-invalid-regexp": ["warn", { allowConstructorFlags: ["u", "y"] }],
        "no-invalid-this": ["warn"],
        "no-irregular-whitespace": ["warn", { skipStrings: true, skipComments: true, skipRegExps: true, skipTemplates: true }],
        "no-loss-of-precision": ["warn"],
        "no-misleading-character-class": ["warn"],
        "no-obj-calls": ["warn"],
        "no-promise-executor-return": ["warn"],
        "no-prototype-builtins": ["warn"],
        "no-regex-spaces": ["warn"],
        "no-setter-return": ["warn"],
        "no-sparse-arrays": ["warn"],
        "no-template-curly-in-string": ["warn"],
        "no-undef": ["warn"],
        "no-unexpected-multiline": ["warn"],
        "no-unreachable-loop": ["warn"],
        "no-unreachable": ["warn"],
        "no-unsafe-finally": ["warn"],
        "no-unsafe-negation": ["warn"],
        "no-use-before-define": ["warn"],
        "prefer-template": ["warn"],
        "simple-import-sort/exports": ["warn"],
        "simple-import-sort/imports": ["warn"],
        "template-curly-spacing": ["warn", "never"],
        "unused-imports/no-unused-imports": ["warn"],
        "use-isnan": ["warn"],
        "valid-typeof": ["warn"]
    }
};
