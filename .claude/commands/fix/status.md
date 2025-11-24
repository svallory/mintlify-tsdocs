Check the status of review fixes.

## Task

Read and display `agent/reports/review/FIX_TRACKER.md` to show:

1. **Overall Progress:**
   - Critical issues fixed
   - High priority issues fixed
   - Medium priority issues fixed
   - Non-issues skipped

2. **Module Status:**
   - Which modules have been addressed
   - Which are in progress
   - Which are pending

3. **Build Status:**
   - Last successful build
   - Any failing builds

4. **Recently Completed:**
   - Last 5 fixes with details

5. **Next Recommended:**
   - What should be fixed next
   - Priority order

Then provide a concise summary:

```
Fix Progress: X/Y issues addressed
Critical: X/3 fixed
High: X/6 fixed
Build: Passing/Failing
Next: [Recommended next issue]
```

Also check if there are any issues marked as ❌ Failed that need attention.
