import type { Config } from 'prettier';

const config: Config = {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
  bracketSpacing: true,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  vueIndentScriptAndStyle: true,
  singleAttributePerLine: false
};

export default config;