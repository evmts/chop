#!/usr/bin/env python3
"""
Automated feature implementation script for Chop TUI.
Uses Claude Code SDK to implement incomplete features with agents.
"""

import subprocess
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

# Try to import claude-code-sdk, fall back to subprocess if not available
try:
    from claude_code_sdk import query, ClaudeCodeOptions
    HAS_SDK = True
except ImportError:
    HAS_SDK = False
    print("Claude Code SDK not found, using subprocess fallback")

REPORTS_DIR = Path(__file__).parent / "implementation_reports"
MAX_TURNS = 50
MAX_LOOPS = 3

# Issues to implement (in dependency order)
ISSUES = [
    {
        "number": 8,
        "title": "Text input handling for parameter editing in History view",
        "file": "src/views/history.zig",
        "priority": 1,
        "dependencies": [],
    },
    {
        "number": 10,
        "title": "Parameter reset functionality in History view",
        "file": "src/views/history.zig",
        "priority": 2,
        "dependencies": [],
    },
    {
        "number": 16,
        "title": "EVM log conversion in Blockchain",
        "file": "src/core/blockchain.zig",
        "priority": 3,
        "dependencies": [],
    },
    {
        "number": 9,
        "title": "EVM call execution pipeline in History view",
        "file": "src/views/history.zig",
        "priority": 4,
        "dependencies": [8, 16],
    },
    {
        "number": 12,
        "title": "Bytecode disassembly triggering in Contracts view",
        "file": "src/views/contracts.zig",
        "priority": 5,
        "dependencies": [],
    },
    {
        "number": 13,
        "title": "Text input for Goto PC modal in Contracts view",
        "file": "src/views/contracts.zig",
        "priority": 6,
        "dependencies": [12],
    },
    {
        "number": 14,
        "title": "JUMP destination navigation in Contracts view",
        "file": "src/views/contracts.zig",
        "priority": 7,
        "dependencies": [12],
    },
    {
        "number": 15,
        "title": "Blockchain state querying in Inspector view",
        "file": "src/views/inspector.zig",
        "priority": 8,
        "dependencies": [],
    },
    {
        "number": 17,
        "title": "Blockchain state reset in Settings view",
        "file": "src/views/settings.zig",
        "priority": 9,
        "dependencies": [],
    },
    {
        "number": 18,
        "title": "Account regeneration in Settings view",
        "file": "src/views/settings.zig",
        "priority": 10,
        "dependencies": [],
    },
    {
        "number": 19,
        "title": "State export in Settings view",
        "file": "src/views/settings.zig",
        "priority": 11,
        "dependencies": [],
    },
    {
        "number": 20,
        "title": "Dashboard data refresh",
        "file": "src/views/dashboard.zig",
        "priority": 12,
        "dependencies": [],
    },
    {
        "number": 11,
        "title": "Save fixture functionality in History view",
        "file": "src/views/history.zig",
        "priority": 13,
        "dependencies": [8, 9],
    },
]


@dataclass
class ImplementationResult:
    issue_number: int
    success: bool
    build_passed: bool
    tests_passed: bool
    error_message: Optional[str]
    duration_seconds: float
    agent_output: str


def setup_reports_dir():
    """Create reports directory if it doesn't exist."""
    REPORTS_DIR.mkdir(exist_ok=True)
    return REPORTS_DIR


def get_previous_reports() -> dict:
    """Read all previous implementation reports."""
    reports = {}
    if REPORTS_DIR.exists():
        for report_file in REPORTS_DIR.glob("issue_*.json"):
            try:
                with open(report_file) as f:
                    data = json.load(f)
                    issue_num = data.get("issue_number")
                    if issue_num:
                        reports[issue_num] = data
            except (json.JSONDecodeError, IOError):
                continue
    return reports


def get_issue_body(issue_number: int) -> str:
    """Fetch issue body from GitHub."""
    try:
        result = subprocess.run(
            ["gh", "issue", "view", str(issue_number), "--repo", "evmts/chop", "--json", "body"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get("body", "")
    except (subprocess.TimeoutExpired, json.JSONDecodeError):
        pass
    return ""


def check_build() -> tuple[bool, str]:
    """Run zig build and check for errors."""
    try:
        result = subprocess.run(
            ["zig", "build"],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=Path(__file__).parent
        )
        return result.returncode == 0, result.stderr or result.stdout
    except subprocess.TimeoutExpired:
        return False, "Build timed out"
    except Exception as e:
        return False, str(e)


def check_tests() -> tuple[bool, str]:
    """Run zig build test and check for errors."""
    try:
        result = subprocess.run(
            ["zig", "build", "test"],
            capture_output=True,
            text=True,
            timeout=300,
            cwd=Path(__file__).parent
        )
        return result.returncode == 0, result.stderr or result.stdout
    except subprocess.TimeoutExpired:
        return False, "Tests timed out"
    except Exception as e:
        return False, str(e)


def run_claude_agent(prompt: str, max_turns: int = MAX_TURNS) -> str:
    """Run Claude Code agent with the given prompt."""
    if HAS_SDK:
        # Use SDK if available
        options = ClaudeCodeOptions(
            max_turns=max_turns,
            system_prompt="You are implementing features for a Zig TUI application. Focus on clean, idiomatic Zig code."
        )
        result = query(prompt, options=options)
        return str(result)
    else:
        # Fallback to subprocess using claude CLI
        try:
            print(f"    Running claude agent (this may take several minutes)...")
            result = subprocess.run(
                ["claude", "--print", "--dangerously-skip-permissions"],
                input=prompt,
                capture_output=True,
                text=True,
                timeout=600,  # 10 minute timeout per issue
                cwd=Path(__file__).parent
            )
            output = result.stdout
            if result.stderr:
                output += "\n" + result.stderr
            print(f"    Agent completed with {len(output)} chars output")
            return output
        except subprocess.TimeoutExpired:
            print("    Agent timed out!")
            return "ERROR: Agent timed out after 10 minutes"
        except Exception as e:
            print(f"    Agent error: {e}")
            return f"ERROR: {e}"


def build_implementation_prompt(issue: dict, previous_reports: dict, loop_number: int) -> str:
    """Build the prompt for implementing an issue."""
    issue_body = get_issue_body(issue["number"])

    # Get reports for dependencies
    dep_context = ""
    for dep_num in issue.get("dependencies", []):
        if dep_num in previous_reports:
            dep_report = previous_reports[dep_num]
            if dep_report.get("success"):
                dep_context += f"\n\nDependency Issue #{dep_num} was successfully implemented:\n"
                dep_context += f"Summary: {dep_report.get('summary', 'No summary')}\n"

    # Get previous attempt context
    prev_attempt = ""
    if issue["number"] in previous_reports:
        prev = previous_reports[issue["number"]]
        if not prev.get("success"):
            prev_attempt = f"""

PREVIOUS ATTEMPT FAILED:
Error: {prev.get('error_message', 'Unknown error')}
Build passed: {prev.get('build_passed', False)}
Tests passed: {prev.get('tests_passed', False)}

Previous agent output summary:
{prev.get('summary', 'No summary available')}

Please learn from the previous attempt and fix the issues.
"""

    prompt = f"""# Implementation Task: Issue #{issue['number']}

## Title: {issue['title']}

## Primary File: {issue['file']}

## Issue Description:
{issue_body}
{dep_context}
{prev_attempt}

## Instructions:

1. First, read the relevant files to understand the current implementation:
   - {issue['file']}
   - src/types.zig
   - src/core/blockchain.zig (if relevant)

2. Implement the feature as described in the issue:
   - Follow the existing code patterns and style
   - Use idiomatic Zig
   - Handle errors properly
   - Don't over-engineer

3. After implementation, verify by reading the file to confirm changes.

4. Important constraints:
   - Only modify the files necessary for this feature
   - Don't break existing functionality
   - Follow the libvaxis widget patterns used in other views
   - Use the existing styles from styles.zig

5. When done, write a brief summary of what you implemented.

This is loop {loop_number} of {MAX_LOOPS}. Focus on getting this feature working correctly.
"""
    return prompt


def save_report(issue: dict, result: ImplementationResult, loop_number: int):
    """Save implementation report to disk."""
    report = {
        "issue_number": issue["number"],
        "title": issue["title"],
        "file": issue["file"],
        "loop_number": loop_number,
        "timestamp": datetime.now().isoformat(),
        "success": result.success,
        "build_passed": result.build_passed,
        "tests_passed": result.tests_passed,
        "error_message": result.error_message,
        "duration_seconds": result.duration_seconds,
        "summary": result.agent_output[:2000] if result.agent_output else "",
    }

    report_path = REPORTS_DIR / f"issue_{issue['number']}_loop_{loop_number}.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    # Also save as latest
    latest_path = REPORTS_DIR / f"issue_{issue['number']}.json"
    with open(latest_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"  Report saved to {report_path}")


def fix_regression(error_output: str, issue: dict) -> bool:
    """Attempt to fix a build/test regression."""
    fix_prompt = f"""# Fix Build/Test Regression

The implementation of Issue #{issue['number']} ({issue['title']}) caused a regression.

## Error Output:
{error_output[:3000]}

## Instructions:
1. Read the file that was modified: {issue['file']}
2. Identify what caused the regression
3. Fix the issue while keeping the feature implementation intact
4. If the feature can't be implemented without breaking things, revert to minimal safe changes

Focus on fixing the regression, not adding new features.
"""

    print("  Attempting to fix regression...")
    output = run_claude_agent(fix_prompt, max_turns=20)

    # Check if fix worked
    build_ok, _ = check_build()
    tests_ok, _ = check_tests()

    return build_ok and tests_ok


def implement_issue(issue: dict, previous_reports: dict, loop_number: int) -> ImplementationResult:
    """Implement a single issue using Claude agent."""
    print(f"\n{'='*60}")
    print(f"Implementing Issue #{issue['number']}: {issue['title']}")
    print(f"File: {issue['file']}")
    print(f"Loop: {loop_number}")
    print('='*60)

    start_time = datetime.now()

    # Check dependencies
    for dep_num in issue.get("dependencies", []):
        if dep_num in previous_reports:
            if not previous_reports[dep_num].get("success"):
                return ImplementationResult(
                    issue_number=issue["number"],
                    success=False,
                    build_passed=True,
                    tests_passed=True,
                    error_message=f"Dependency #{dep_num} not yet implemented",
                    duration_seconds=0,
                    agent_output=""
                )

    # Build prompt and run agent
    prompt = build_implementation_prompt(issue, previous_reports, loop_number)
    agent_output = run_claude_agent(prompt)

    duration = (datetime.now() - start_time).total_seconds()

    # Check build
    print("  Checking build...")
    build_ok, build_output = check_build()
    if not build_ok:
        print(f"  Build FAILED")
        # Try to fix
        if fix_regression(build_output, issue):
            build_ok = True
            print("  Regression fixed!")
        else:
            return ImplementationResult(
                issue_number=issue["number"],
                success=False,
                build_passed=False,
                tests_passed=False,
                error_message=f"Build failed: {build_output[:500]}",
                duration_seconds=duration,
                agent_output=agent_output
            )
    print("  Build OK")

    # Check tests
    print("  Checking tests...")
    tests_ok, test_output = check_tests()
    if not tests_ok:
        print(f"  Tests FAILED")
        # Try to fix
        if fix_regression(test_output, issue):
            tests_ok = True
            print("  Regression fixed!")
        else:
            return ImplementationResult(
                issue_number=issue["number"],
                success=False,
                build_passed=True,
                tests_passed=False,
                error_message=f"Tests failed: {test_output[:500]}",
                duration_seconds=duration,
                agent_output=agent_output
            )
    print("  Tests OK")

    # Success!
    print(f"  Issue #{issue['number']} implemented successfully!")
    return ImplementationResult(
        issue_number=issue["number"],
        success=True,
        build_passed=True,
        tests_passed=True,
        error_message=None,
        duration_seconds=duration,
        agent_output=agent_output
    )


def run_implementation_loop(loop_number: int) -> dict:
    """Run one loop of implementation for all issues."""
    print(f"\n{'#'*60}")
    print(f"# IMPLEMENTATION LOOP {loop_number}")
    print('#'*60)

    previous_reports = get_previous_reports()
    results = {}

    # Sort issues by priority
    sorted_issues = sorted(ISSUES, key=lambda x: x["priority"])

    for issue in sorted_issues:
        # Skip if already successfully implemented
        if issue["number"] in previous_reports:
            if previous_reports[issue["number"]].get("success"):
                print(f"\nSkipping Issue #{issue['number']} - already implemented")
                results[issue["number"]] = True
                continue

        result = implement_issue(issue, previous_reports, loop_number)
        save_report(issue, result, loop_number)
        results[issue["number"]] = result.success

        # Update previous_reports for next iteration
        previous_reports[issue["number"]] = {
            "success": result.success,
            "build_passed": result.build_passed,
            "tests_passed": result.tests_passed,
            "error_message": result.error_message,
            "summary": result.agent_output[:2000] if result.agent_output else ""
        }

    return results


def generate_final_report(all_results: list[dict]):
    """Generate a final summary report."""
    report_path = REPORTS_DIR / "final_report.md"

    with open(report_path, "w") as f:
        f.write("# Chop TUI Implementation Report\n\n")
        f.write(f"Generated: {datetime.now().isoformat()}\n\n")

        # Summary
        total = len(ISSUES)
        successful = sum(1 for r in all_results[-1].values() if r)

        f.write(f"## Summary\n\n")
        f.write(f"- Total Issues: {total}\n")
        f.write(f"- Implemented: {successful}\n")
        f.write(f"- Remaining: {total - successful}\n")
        f.write(f"- Success Rate: {successful/total*100:.1f}%\n\n")

        # Per-issue status
        f.write("## Issue Status\n\n")
        f.write("| Issue | Title | Status |\n")
        f.write("|-------|-------|--------|\n")

        for issue in ISSUES:
            status = "✅" if all_results[-1].get(issue["number"]) else "❌"
            f.write(f"| #{issue['number']} | {issue['title']} | {status} |\n")

        # Loop history
        f.write("\n## Loop History\n\n")
        for i, results in enumerate(all_results, 1):
            success_count = sum(1 for r in results.values() if r)
            f.write(f"- Loop {i}: {success_count}/{total} successful\n")

    print(f"\nFinal report saved to {report_path}")


def main():
    # Force unbuffered output
    import sys
    sys.stdout.reconfigure(line_buffering=True)

    print("="*60)
    print("Chop TUI Feature Implementation Script")
    print("="*60)
    print(f"Working directory: {Path(__file__).parent}")
    print(f"Reports directory: {REPORTS_DIR}")
    print(f"Total issues to implement: {len(ISSUES)}")

    setup_reports_dir()

    all_results = []

    for loop_num in range(1, MAX_LOOPS + 1):
        results = run_implementation_loop(loop_num)
        all_results.append(results)

        # Check if all complete
        if all(results.values()):
            print(f"\n{'='*60}")
            print("ALL ISSUES IMPLEMENTED SUCCESSFULLY!")
            print("="*60)
            break

        # Show progress
        successful = sum(1 for r in results.values() if r)
        print(f"\nLoop {loop_num} complete: {successful}/{len(ISSUES)} issues implemented")

        if loop_num < MAX_LOOPS:
            remaining = [i["number"] for i in ISSUES if not results.get(i["number"])]
            print(f"Remaining issues: {remaining}")
            print("Starting next loop...")

    # Generate final report
    generate_final_report(all_results)

    # Final status
    final_results = all_results[-1]
    if all(final_results.values()):
        print("\n✅ All features implemented successfully!")
        return 0
    else:
        failed = [i["number"] for i in ISSUES if not final_results.get(i["number"])]
        print(f"\n❌ Some features not implemented: {failed}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
