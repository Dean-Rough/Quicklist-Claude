# Branch Protection Setup Guide

This guide will help you enable branch protection rules on GitHub to ensure the CI/CD pipeline prevents bad code from reaching production.

## Prerequisites

- Repository must be pushed to GitHub
- You must have admin access to the repository
- CI workflow must be merged to main branch first

## Step-by-Step Setup

### 1. Navigate to Branch Protection Settings

1. Go to your GitHub repository: `https://github.com/deannewton/Quicklist-Claude`
2. Click on **Settings** tab (top navigation)
3. In the left sidebar, click **Branches** under "Code and automation"

### 2. Add Branch Protection Rule

1. Click **Add rule** (or **Add branch protection rule**)
2. In "Branch name pattern", enter: `main`

### 3. Configure Protection Rules

Enable the following settings:

#### Require Pull Request Before Merging

- [x] **Require a pull request before merging**
  - Require approvals: `1` (recommended)
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners (if you have a CODEOWNERS file)

#### Require Status Checks to Pass

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging

  **Search and add these status checks:**
  - `quality-checks (18.x)` - Quality checks on Node 18
  - `quality-checks (20.x)` - Quality checks on Node 20
  - `dependency-check` - Verify dependencies are up to date
  - `code-quality-report` - Final quality report

  Note: These checks will appear in the search box only after the CI workflow has run at least once on the main branch.

#### Additional Protections

- [x] **Require conversation resolution before merging**
  - Ensures all PR comments are addressed before merging

- [ ] **Require signed commits** (optional but recommended for security)

- [ ] **Require linear history** (optional - prevents merge commits, forces rebase/squash)

- [x] **Do not allow bypassing the above settings**
  - Prevents administrators from bypassing rules
  - Recommended: Enable this to ensure everyone follows the same process

- [ ] **Allow force pushes** (leave DISABLED)
  - Force pushes can overwrite history and break the CI pipeline

- [ ] **Allow deletions** (leave DISABLED)
  - Prevents accidental branch deletion

#### Rules Applied to Everyone

- [x] **Include administrators**
  - Applies rules to repository administrators as well
  - Recommended: Enable this to lead by example

### 4. Save the Rule

1. Scroll to the bottom of the page
2. Click **Create** (or **Save changes** if editing)

## What This Protects Against

### Examples of Bad Code That Will Be Blocked

1. **Syntax Errors**

   ```javascript
   // Missing closing brace - ESLint will catch this
   function badFunction() {
       console.log("Missing brace"
   ```

2. **Formatting Issues**

   ```javascript
   // Inconsistent formatting - Prettier will catch this
   const badFormatting = { foo: 'bar', baz: 'qux' };
   ```

3. **Security Vulnerabilities**

   ```javascript
   // SQL injection vulnerability - Audit will catch this
   const query = `SELECT * FROM users WHERE id = ${userId}`;
   ```

4. **Unresolved Dependencies**
   - Out-of-date `package-lock.json`
   - Missing or conflicting dependencies
   - Known vulnerabilities in packages

5. **Code Quality Issues**

   ```javascript
   // Unused variables - ESLint will catch this
   const unusedVar = 'never used';

   // Console.log in production - ESLint will catch this
   console.log('Debug message');
   ```

## Testing Branch Protection

### Test 1: Try to Push Directly to Main (Should Fail)

```bash
# This should be rejected by GitHub
git checkout main
echo "test" >> test.txt
git add test.txt
git commit -m "test"
git push origin main  # ❌ Will be rejected
```

### Test 2: Create PR with Failing Code (Should Block Merge)

```bash
# Create a branch with intentional errors
git checkout -b test/failing-code
echo "const bad = {foo: 'bar'" >> test.js  # Syntax error
git add test.js
git commit -m "test: add failing code"
git push origin test/failing-code

# Open PR on GitHub
# ❌ CI will fail, merge button will be disabled
```

### Test 3: Create PR with Good Code (Should Pass)

```bash
# Create a branch with good code
git checkout -b test/passing-code
echo "const good = { foo: 'bar' };" >> test.js
git add test.js
git commit -m "test: add passing code"
git push origin test/passing-code

# Open PR on GitHub
# ✅ CI will pass, merge button will be enabled after approval
```

## Monitoring CI Status

### In Pull Requests

Each PR will show:

- ✅ Green check: All checks passed
- ❌ Red X: One or more checks failed
- 🟡 Yellow dot: Checks in progress

Click "Details" next to any check to see logs.

### Status Badge in README

The badge in README.md shows main branch CI status:

- ![Passing](https://img.shields.io/badge/build-passing-brightgreen) - All checks passing
- ![Failing](https://img.shields.io/badge/build-failing-red) - One or more checks failing

## Troubleshooting

### Status Checks Don't Appear

**Problem**: The required status checks don't show up in the search box.

**Solution**:

1. Merge the CI workflow to main branch first
2. Wait for the workflow to run at least once
3. Return to branch protection settings
4. The checks should now appear in the search

### CI Checks Hang or Time Out

**Problem**: CI checks run for too long or hang indefinitely.

**Solution**:

- Check the workflow logs for errors
- Verify `npm ci` completes successfully
- Check for network issues with npm registry
- Workflow has 10-minute timeout to prevent infinite hangs

### False Positives (Checks Fail But Code is Fine)

**Problem**: CI fails for warnings that aren't actually errors.

**Solution**:

1. Review ESLint configuration to adjust warning levels
2. Update `.prettierrc` if formatting rules are too strict
3. Use `eslint-disable-next-line` for legitimate exceptions
4. Adjust `npm audit --audit-level` if security checks are too strict

### Need to Bypass Temporarily

**Problem**: Emergency fix needed, but CI is failing.

**Options**:

1. Fix the CI issue first (recommended)
2. Temporarily disable branch protection:
   - Go to Settings > Branches
   - Click "Edit" on the main branch rule
   - Uncheck "Do not allow bypassing the above settings"
   - Merge your fix
   - Re-enable the setting immediately

**Warning**: Only bypass in true emergencies. Document why in commit message.

## Maintenance

### Weekly Tasks

- Review Dependabot PRs
- Check for new security advisories
- Update status check requirements if CI workflow changes

### Monthly Tasks

- Review branch protection effectiveness
- Analyze CI failure patterns
- Update documentation based on common issues

### When Updating CI Workflow

If you add/remove/rename jobs in `.github/workflows/ci.yml`:

1. Update the required status checks in branch protection
2. Remove old check names
3. Add new check names
4. Test with a draft PR

## Additional Security

### CODEOWNERS File (Optional)

Create `.github/CODEOWNERS` to require specific people to review certain files:

```
# Global owners
* @deannewton

# Require security review for auth changes
/server.js @deannewton @security-team

# Require database review for schema changes
/schema.sql @deannewton @database-team

# Require CI/CD review for workflow changes
/.github/workflows/ @deannewton @devops-team
```

### Secret Scanning (Automatic)

GitHub automatically scans for leaked secrets. Enable advanced security features:

1. Settings > Code security and analysis
2. Enable "Secret scanning"
3. Enable "Push protection" to block commits with secrets

### Dependabot Security Updates

Already configured in `.github/dependabot.yml`:

- Automatic PRs for security vulnerabilities
- Daily checks for security updates
- Weekly checks for dependency updates

## Summary

Once enabled, branch protection ensures:

✅ No direct pushes to main
✅ All code reviewed before merging
✅ All CI checks must pass
✅ Dependencies stay up to date
✅ Security vulnerabilities blocked
✅ Code quality maintained
✅ Formatting consistency enforced

This prevents bad code from reaching production and gives you confidence in every merge.

---

**Last Updated**: 2025-11-13
**Maintained By**: @deannewton
