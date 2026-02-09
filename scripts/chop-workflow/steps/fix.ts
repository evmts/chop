export default function renderFix(props: {
  taskDesc: string;
  issues: string[];
}): string {
  const issueList = props.issues.length > 0
    ? props.issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")
    : "No specific issues listed.";

  return `FIX REVIEW ISSUES — Address all feedback from code review.

TASK: ${props.taskDesc}

ISSUES TO FIX:
${issueList}

STEP 1: Read each issue carefully:
- Understand what the reviewer is asking for
- Read the referenced files and line numbers

STEP 2: Fix each issue:
- Make the minimal change to resolve the issue
- Do NOT introduce new features or refactors beyond what's needed
- Follow the same patterns as the rest of the codebase

STEP 3: Verify fixes:
- Run: bun test — ALL tests must still pass
- Run: bun run typecheck — no type errors (if configured)
- Ensure no regressions

STEP 4: Commit fixes:
- One commit per logical group of fixes
- Use emoji prefix: 🐛 fix(scope): description
- Reference the review issue in the commit message

After fixing, output:
\`\`\`json
{
  "fixesMade": ["Fixed missing Hex re-export in src/shared/types.ts", "Added error case test for..."],
  "commitMessage": "🐛 fix(shared): address review feedback — add missing exports and error tests",
  "summary": "Fixed 2 issues: missing type export and missing error test..."
}
\`\`\``;
}
