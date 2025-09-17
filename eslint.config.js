import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['client/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { 
            group: ['**/server/**', 'server/**', 'server/*'], 
            message: 'Do not import server code into the client bundle.' 
          }
        ]
      }]
    }
  }
);