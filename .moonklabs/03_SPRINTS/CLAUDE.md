# Sprint Management Instructions

## Important Section - Always read

- When updating Tasks Logs (Output Log) always fetch current date and time first
- Update Output Log after every Subtask
- Always be truthful in Logs. If you cannot complete a task for technical reasons, just write it down. Don't lie!
- Only mark lines as done if you could acctually progress them.
- Update the task file after every completed subtask and check Acceptance criteria as well if successful.

## Sprint Structure

Sprints are organized by milestone and sequence:

- Folders follow pattern: `S<NN>_M<NN>_<Focus_Area>/` where:
  - `S<NN>` is the sprint sequence number
  - `M<NN>` directly references the milestone ID this sprint belongs to
  - `<Focus_Area>` describes the sprint's main focus
- Each sprint has a meta file: `S<NN>_sprint_meta.md`
- Tasks use pattern: `T<NN>_S<NN>_<Description>.md`

## Sprint Meta Files

Sprint meta files define sprint goals and track status:

```yaml
---
sprint_id: S01
milestone_id: M01
status: in_progress # planning | in_progress | review | complete
---
```

Update status as progress occurs:

- planning → in_progress → review → complete

Always use the template at `.Moonklabs/99_TEMPLATES/sprint_template.md` when creating new sprint meta files.

## Sprint Tasks

Tasks within a sprint follow a standard format:

- Status progression: open → in_progress → pending_review → done
- When completing a task:
  - Ask for user confirmation
  - Update status to "done"
  - Rename file from T... to TX... (e.g., `TX01_S01_Task_Name.md`)
  - Update Output Log with final entry

Always use the template at `.Moonklabs/99_TEMPLATES/task_template.md` when creating new sprint tasks.

## Working with Sprint Tasks

When executing a sprint task:

1. Analyze task's Acceptance Criteria and Subtasks
2. Update status to "in_progress"
3. Log activities in the Output Log with timestamps after every Subtask(!)
4. Mark subtasks as completed using [x] only when they are really completed. If you were not able to complete them, don't mark them and tell the user.
5. Reference architectural guidelines when implementing technical solutions
6. Ensure the task follows the structure from the task template
