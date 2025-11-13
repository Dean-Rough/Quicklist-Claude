# Pre-Commit Hooks Configuration

This document explains the pre-commit hooks configured for the Quicklist-Claude project to prevent secrets from being committed to git.

## Overview

The project uses **Husky** and **lint-staged** to automatically run checks before each commit. The pre-commit hook performs two main functions:

1. **Code Quality**: Runs ESLint and Prettier on staged files
2. **Secret Scanning**: Scans for potential secrets and API keys

## Installation

The hooks are automatically installed when you run:

```bash
npm install
```

This is handled by the `prepare` script in `package.json`.

## What Gets Checked

### Code Quality (via lint-staged)

The following checks run automatically on staged files:

- **JavaScript files (\*.js)**:
  - `eslint --fix` - Lints and auto-fixes issues
  - `prettier --write` - Formats code

- **JSON, Markdown, YAML files**:
  - `prettier --write` - Formats files

- **HTML files**:
  - `prettier --write` - Formats HTML

### Secret Scanning

The pre-commit hook scans for these types of secrets:

#### API Keys and Tokens

- Stripe keys: `sk_live_`, `pk_live_`, `sk_test_`, `pk_test_`
- Generic API keys: `api_key="..."`, `apikey="..."`
- Access tokens: `access_token="..."`
- Auth tokens: `auth_token="..."`

#### AWS Credentials

- AWS Access Key IDs: `AKIA[0-9A-Z]{16}`
- AWS Secret Access Keys

#### Private Keys

- RSA, DSA, EC, OpenSSH, PGP private keys
- Pattern: `-----BEGIN PRIVATE KEY`

#### Database URLs

- PostgreSQL: `postgresql://user:password@...`
- MySQL: `mysql://user:password@...`
- MongoDB: `mongodb://user:password@...`

#### Passwords

- `password="..."`
- `passwd="..."`
- `db_password="..."`

#### OAuth Secrets

- Client secrets: `client_secret="..."`
- Client IDs: `client_id="..."`

#### Provider-Specific

- Google/Firebase: `AIza[0-9A-Za-z_-]{35}`
- GitHub tokens: `ghp_`, `gho_`, `ghu_`, `ghs_`
- JWT tokens: Long base64 strings starting with `eyJ`

#### High-Entropy Strings

- Any quoted string with 64+ random characters

## Exception Patterns

The scanner allows commits with secrets that contain these keywords (for documentation/examples):

- `example`
- `sample`
- `fake`
- `test`
- `mock`
- `placeholder`
- `your_api_key`
- `your-api-key`
- `xxxxxxxx`
- `REPLACE_WITH`

## What Happens on Commit

When you run `git commit`, the following sequence occurs:

1. **Lint-staged runs** - Formats and lints your staged files
2. **Secret scanner runs** - Checks all staged files for secrets
3. **If secrets found** - Commit is blocked with error message
4. **If no secrets** - Commit proceeds normally

### Example: Blocked Commit

```bash
$ git commit -m "Add feature"

Scanning for secrets...
  POTENTIAL SECRET FOUND in config.js:
    5:const apiKey = 'sk_live_EXAMPLE_KEY_HERE'; // Example key - not real

ERROR: Potential secrets detected in staged files!

If these are false positives (e.g., examples, documentation):
  - Add 'example', 'sample', 'fake', or 'test' to the pattern
  - Or add the exception to EXCEPTION_PATTERNS in .husky/pre-commit

If these are real secrets:
  - Remove them from the files
  - Move secrets to .env files (which are gitignored)
  - Use environment variables instead

Commit blocked to prevent secret exposure.
```

### Example: Successful Commit

```bash
$ git commit -m "Add feature"

[STARTED] Running tasks for staged files...
[COMPLETED] Running tasks for staged files...
Scanning for secrets...
No secrets detected - commit allowed
[feature-branch abc123] Add feature
 1 file changed, 10 insertions(+)
```

## How to Handle Secrets

### DO: Use Environment Variables

```javascript
// Good - loads from .env file (gitignored)
const stripeKey = process.env.STRIPE_SECRET_KEY;
const apiKey = process.env.GEMINI_API_KEY;
```

### DON'T: Hardcode Secrets

```javascript
// Bad - hardcoded secret will be blocked
const stripeKey = 'sk_live_EXAMPLE_KEY_HERE';
```

### For Documentation/Examples

If you need to include example keys in documentation:

```javascript
// Example for documentation - use "example" or "test" in the pattern
const exampleStripeKey = 'sk_test_EXAMPLE_KEY_HERE'; // Example key - not real
```

## Files Ignored

The scanner automatically skips:

- Binary files (`.png`, `.jpg`, `.gif`, `.pdf`, `.zip`, etc.)
- `node_modules/` directory
- Files matched by `.prettierignore`

## Configuration Files

### `.husky/pre-commit`

The main pre-commit hook script. Contains:

- lint-staged execution
- Secret scanning patterns
- Exception patterns

### `.lintstagedrc.json`

Configures what commands run on staged files:

```json
{
  "*.js": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"],
  "*.html": ["prettier --write"]
}
```

### `.eslintrc.json`

ESLint configuration for JavaScript linting

### `.prettierrc.json`

Prettier configuration for code formatting

### `.gitignore`

Updated to include additional secret file patterns:

- `.env*` files
- `*.pem`, `*.key` (certificate/key files)
- `credentials.json`, `secrets.json`
- Cloud provider config directories (`.aws/`, `.gcloud/`, `.azure/`)

## Testing the Hook

To test that the pre-commit hook is working:

1. Create a test file with a fake secret:

```bash
echo 'const key = "sk_live_EXAMPLE_KEY_HERE";' > test.js
git add test.js
git commit -m "Test"
```

2. The commit should be blocked with a warning

3. Clean up:

```bash
git restore --staged test.js
rm test.js
```

## Manual Commands

You can run the checks manually without committing:

```bash
# Run lint-staged manually
npx lint-staged

# Run ESLint on all files
npm run lint

# Auto-fix ESLint issues
npm run lint:fix

# Format all files with Prettier
npm run format

# Check formatting without changing files
npm run format:check
```

## Bypassing the Hook (Not Recommended)

In emergencies, you can bypass the pre-commit hook:

```bash
git commit --no-verify -m "Emergency fix"
```

**Warning**: Only use this if absolutely necessary. You risk committing secrets.

## Troubleshooting

### Hook not running

1. Ensure Husky is installed: `npm install`
2. Check that `.husky/pre-commit` is executable: `chmod +x .husky/pre-commit`
3. Verify git hooks are enabled: `git config core.hooksPath`

### False positives

If the scanner incorrectly flags safe code:

1. Add exception keywords to your code comments:

   ```javascript
   const testKey = 'sk_test_EXAMPLE_KEY_HERE'; // Example key - not real
   ```

2. Or modify `EXCEPTION_PATTERNS` in `.husky/pre-commit`

### ESLint/Prettier errors

If linting fails:

1. Fix issues manually: `npm run lint:fix`
2. Check ESLint config: `.eslintrc.json`
3. Review Prettier config: `.prettierrc.json`

## Additional Security

Beyond pre-commit hooks, also ensure:

1. All `.env` files are in `.gitignore`
2. Use services like GitHub secret scanning
3. Rotate any accidentally committed secrets immediately
4. Use tools like `git-secrets` for additional protection
5. Review the `.gitignore` file regularly

## References

- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)
- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)
