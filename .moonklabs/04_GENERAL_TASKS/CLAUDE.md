# General Tasks Instructions

## General Task Structure

General tasks are standalone work items not tied to sprints:

- Files follow pattern: `T<NNN>_<Description>.md`
- Completed tasks: `TX<NNN>_<Description>.md`

Always use the template at `.Moonklabs/99_TEMPLATES/task_template.md` when creating new general tasks.

## Task Formatting

General tasks use standardized YAML frontmatter and sections:

```yaml
---
task_id: T001
status: open # open | in_progress | pending_review | done | failed | blocked
complexity: Medium # Low | Medium | High
last_updated: YYYY-MM-DD HH:MM
---
```

The full task structure with all sections is defined in the task template. Always maintain this structure.

## Working with General Tasks

When handling general tasks:

1. Update the status field as you progress
2. Record timestamps in this format (YYYY-MM-DD HH:MM)
3. Log all significant actions in the Output Log section:

   ```plaintext
   [YYYY-MM-DD HH:MM] Started task
   [YYYY-MM-DD HH:MM] Modified files: file1.js, file2.js
   ```

4. Mark subtasks as they're completed: `- [x] Completed subtask`
5. Use the Acceptance Criteria as your primary completion checklist
6. Ensure all sections from the task template are preserved

## Task Completion Process

When a task is complete:

1. Update status to "done"
2. Update all Acceptance Criteria with [x]
3. Add final Output Log entry
4. Rename file from T... to TX... (e.g., `TX001_Task_Name.md`)
