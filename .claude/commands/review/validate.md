Validate that review updates were done correctly.

Arguments: $MODULE_PATH (optional - validates specific module, or all if omitted)

## Task

Use the **code-reviewer** agent to validate review file updates by checking:

### 1. Content Quality Checks

For each updated review file, verify:

**✅ Must Have:**
- Context section at top explaining threat model correction
- Balanced final assessment (not "STOP PRODUCTION" drama)
- Technical analysis preserved (cache bugs, architecture, performance)
- Realistic severity ratings (not everything CRITICAL)

**❌ Must NOT Have:**
- XSS attack scenarios showing how to "attack" own docs
- Exploit code examples for user-controlled content
- "Malicious attacker" language where user = attacker
- Detailed sanitization guides for non-issues
- "Impact: Full system compromise" for local tool bugs

**🔄 Should Be Reframed:**
- "Attacker can inject" → "Could crash on unusual input"
- "RCE vulnerability" → "Command execution bug"
- "Security risk" → "Reliability issue" or "Code quality"

### 2. Technical Accuracy

Verify that:
- Real bugs are still marked as issues (cache failures, race conditions)
- Non-issues are clearly marked as N/A with explanation
- Command injection is kept but reframed (reliability, not attacker)
- Path traversal is downgraded appropriately

### 3. Spot Check Files

Sample 3-5 files and check:
1. Does the context section make sense?
2. Is security theater actually deleted (not just reclassified)?
3. Are real bugs still identified with actionable recommendations?
4. Is the language about reliability/crashes instead of attackers?

### 4. Generate Report

Create a validation report with:

```markdown
# Review Update Validation Report

## Module: [module name or "All Modules"]

### ✅ Passing Criteria
- [ ] Context sections added
- [ ] Security theater deleted
- [ ] Technical analysis preserved
- [ ] Severity ratings realistic
- [ ] Language focuses on reliability

### ⚠️ Issues Found
[List any problems discovered]

### 📊 Sample File Checks
[Brief notes on 3-5 spot-checked files]

### ✅ Overall Assessment
[PASS / NEEDS WORK / FAIL]

### 📝 Recommendations
[What should be fixed if not passing]
```

## Success Criteria

**PASS:** If reviews:
- Focus on real bugs and code quality
- Delete XSS/injection scenarios for user's own content
- Keep valuable technical analysis
- Use appropriate language (reliability, not attackers)

**NEEDS WORK:** If some security theater remains or good content was deleted

**FAIL:** If security theater still dominates or technical analysis was lost

## Output

Save validation report to:
- `agent/reports/review/validation/[module-name]-validation.md` (for specific module)
- `agent/reports/review/validation/full-validation.md` (for all modules)
