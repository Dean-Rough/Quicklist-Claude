# Contributing to Quicklist-Claude

Thank you for considering contributing to Quicklist-Claude! This document outlines our development workflow and quality standards.

## Table of Contents

- [Development Workflow](#development-workflow)
- [Quality Standards](#quality-standards)
- [Branch Protection Rules](#branch-protection-rules)
- [CI/CD Pipeline](#cicd-pipeline)
- [Pre-commit Hooks](#pre-commit-hooks)
- [Code Style](#code-style)
- [Security](#security)

## Development Workflow

1. **Fork and Clone**

   ```bash
   git clone https://github.com/yourusername/Quicklist-Claude.git
   cd Quicklist-Claude
   npm install
   ```

2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. **Make Your Changes**
   - Write clean, maintainable code
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation as needed

4. **Test Locally**

   ```bash
   # Run linting
   npm run lint

   # Run formatting check
   npm run format:check

   # Auto-fix formatting issues
   npm run format

   # Run security audit
   npm audit
   ```

5. **Commit Your Changes**
   - Pre-commit hooks will automatically run linting and formatting checks
   - If hooks fail, fix the issues and try again
   - Write clear, descriptive commit messages

   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

6. **Push and Create Pull Request**

   ```bash
   git push origin feature/your-feature-name
   ```

   - Open a pull request against the `main` branch
   - Fill out the PR template with details
   - Wait for CI checks to pass
   - Request review from maintainers

## Quality Standards

All code contributions must meet these quality standards:

### Code Quality

- Pass ESLint checks with no errors
- Follow Prettier formatting rules
- No console.log statements in production code (use logger instead)
- Proper error handling with try-catch blocks
- Meaningful variable and function names

### Security

- No hardcoded secrets or API keys
- Use environment variables for configuration
- Parameterized SQL queries (never string concatenation)
- Input validation and sanitization
- No moderate or higher severity vulnerabilities

### Documentation

- Update README.md if adding new features
- Add JSDoc comments for functions
- Update API documentation if changing endpoints
- Include code comments for complex logic

## Branch Protection Rules

To maintain code quality and prevent broken code from reaching production, the `main` branch has the following protection rules enabled:

### How to Enable Branch Protection (for maintainers)

1. **Navigate to Repository Settings**
   - Go to your GitHub repository
   - Click on "Settings" tab
   - Click on "Branches" in the left sidebar

2. **Add Branch Protection Rule**
   - Click "Add rule" or edit existing rule for `main`
   - Branch name pattern: `main`

3. **Configure Required Settings**

   **Require a pull request before merging:**
   - Enable "Require a pull request before merging"
   - Require approvals: 1 (recommended for team projects)
   - Dismiss stale pull request approvals when new commits are pushed

   **Require status checks to pass before merging:**
   - Enable "Require status checks to pass before merging"
   - Require branches to be up to date before merging
   - Search and select these status checks:
     - `quality-checks (18.x)`
     - `quality-checks (20.x)`
     - `dependency-check`
     - `code-quality-report`

   **Additional protections:**
   - Enable "Require conversation resolution before merging"
   - Enable "Do not allow bypassing the above settings" (prevents admin override)
   - Optional: "Require linear history" (prevents merge commits)

4. **Save Changes**
   - Click "Create" or "Save changes"

### What This Means for Contributors

- You **cannot** push directly to the `main` branch
- All changes **must** go through a pull request
- CI checks **must** pass before merging
- At least one approval is required (if enabled)
- Branches must be up to date with main before merging

### If CI Checks Fail

1. **Review the CI logs** in your pull request to see what failed
2. **Fix the issues locally**:
   ```bash
   # Run the same checks locally
   npm run lint
   npm run format:check
   npm audit --audit-level=moderate
   ```
3. **Commit and push the fixes**:
   ```bash
   git add .
   git commit -m "fix: resolve linting/formatting issues"
   git push
   ```
4. **Wait for CI to re-run** automatically

## CI/CD Pipeline

Our CI/CD pipeline runs on every push to `main` and on all pull requests. The pipeline includes:

### Quality Checks (Runs on Node.js 18.x and 20.x)

1. **Checkout code** - Pulls the latest code
2. **Setup Node.js** - Configures Node.js with npm caching for speed
3. **Install dependencies** - Runs `npm ci` for clean, fast installs
4. **Run ESLint** - Checks code quality and style
5. **Run Prettier** - Verifies code formatting
6. **Security audit** - Checks for moderate+ severity vulnerabilities
7. **Vulnerability scan** - Additional check for critical/high vulnerabilities
8. **Build verification** - Ensures the build script works

### Dependency Check

- Verifies `package-lock.json` is up to date
- Prevents merge conflicts in dependencies

### Code Quality Report

- Summarizes all check results
- Fails if any check fails

### Expected Runtime

- Total pipeline: **< 2 minutes**
- Most checks complete in 30-60 seconds

## Pre-commit Hooks

Pre-commit hooks are set up using Husky and lint-staged to catch issues before you commit:

### What Runs on Pre-commit

- ESLint on staged JavaScript files
- Prettier formatting on staged files
- Auto-fix where possible

### If Pre-commit Fails

1. Review the error messages
2. Fix the issues (many will auto-fix)
3. Stage the fixed files: `git add .`
4. Try committing again

### Bypassing Hooks (Not Recommended)

```bash
git commit --no-verify -m "your message"
```

Note: Bypassing hooks will likely cause CI to fail, so only do this in emergencies.

## Code Style

### JavaScript

- Use ES6+ features (async/await, arrow functions, destructuring)
- Use `const` by default, `let` when reassignment is needed
- Avoid `var`
- Use template literals for string interpolation
- Use meaningful variable names (no single letters except in loops)

### Formatting

- 2 spaces for indentation
- Single quotes for strings (unless using template literals)
- Semicolons required
- Max line length: 100 characters (enforced by Prettier)
- Trailing commas in objects/arrays

### Node.js Backend

- Use Express middleware pattern
- Always use parameterized queries for database
- Proper error handling with try-catch
- Use logger instead of console.log
- Add request ID tracking for debugging

### Frontend

- Follow existing single-file architecture
- Use `app` global object for organization
- Centralized state in `app.state`
- Async/await for API calls
- Proper error handling with user-friendly messages

## Security

### Sensitive Data

- Never commit secrets, API keys, or credentials
- Always use `.env` for configuration
- Add new secrets to `.env.example` (without values)
- Verify `.gitignore` includes `.env`

### SQL Queries

```javascript
// Good - Parameterized query
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// Bad - String concatenation (SQL injection risk)
const result = await pool.query(`SELECT * FROM users WHERE id = ${userId}`);
```

### Input Validation

- Always validate user input
- Use sanitize-html for HTML content
- Validate email formats, URL formats, etc.
- Set reasonable limits on input length

### Dependencies

- Keep dependencies up to date
- Review Dependabot PRs promptly
- Run `npm audit` regularly
- Avoid packages with known vulnerabilities

## Example: Complete Contribution Flow

```bash
# 1. Start with latest main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/improve-image-upload

# 3. Make changes to code
# ... edit files ...

# 4. Test locally
npm run lint
npm run format:check
npm audit

# 5. Fix any issues
npm run format  # Auto-fix formatting
npm run lint -- --fix  # Auto-fix linting where possible

# 6. Commit (pre-commit hooks will run)
git add .
git commit -m "feat: improve image upload validation and error handling"

# 7. Push and open PR
git push origin feature/improve-image-upload

# 8. Open PR on GitHub and wait for CI checks
# 9. Address review comments if needed
# 10. Merge once approved and CI passes
```

## Getting Help

- Check existing documentation in the `/docs` folder
- Review [CLAUDE.md](CLAUDE.md) for architecture details
- Open an issue for bugs or feature requests
- Ask questions in pull request comments
- Contact maintainers: @deannewton

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Quicklist-Claude!
