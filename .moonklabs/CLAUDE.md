# CLAUDE.md - Moonklabs Framework Structure Guide

## Overview

This is the root directory of the Moonklabs framework structure. It contains all project documentation, requirements, sprints, and organizational files.

## Critical Files

### Project Manifest

**IMPORTANT**: The project manifest file MUST be named:

```
00_PROJECT_MANIFEST.md
```

**NOT**:

- ❌ `MANIFEST.md`
- ❌ `PROJECT_MANIFEST.md`
- ❌ `project_manifest.md`

The manifest is the central reference file that tracks:

- Project name and status
- Current milestone and sprint
- Project metadata
- Last updated timestamp

## Directory Structure

```
.Moonklabs/
├── 00_PROJECT_MANIFEST.md          # Central project reference (CORRECT NAME)
├── 01_PROJECT_DOCS/                # General project documentation
├── 02_REQUIREMENTS/                # Milestone-based requirements
├── 03_SPRINTS/                     # Sprint execution folders
├── 04_GENERAL_TASKS/               # Non-sprint tasks
├── 05_ARCHITECTURAL_DECISIONS/     # ADR documentation
├── 10_STATE_OF_PROJECT/            # Project review snapshots
└── 99_TEMPLATES/                   # Document templates
```

## Naming Conventions Summary

### Files

- **Project Manifest**: `00_PROJECT_MANIFEST.md`
- **Milestone Meta**: `M##_milestone_meta.md`
- **Sprint Meta**: `S##_M##_sprint_meta.md`
- **Task Files**: `TASK_##_*.md`
- **ADR Files**: `ADR_###_*.md`

### Folders

- **Milestones**: `M##_Milestone_Name/`
- **Sprints**: `S##_M##_Sprint_Name/`
- **State Snapshots**: `YYYY-MM-DD_HH-MM_snapshot/`

## Important Notes for Claude Code

1. **Always create `00_PROJECT_MANIFEST.md`** when initializing a project
2. **Use the templates** from `99_TEMPLATES/` for consistency
3. **Follow the naming conventions exactly** - they enable proper sorting and navigation
4. **Update the manifest** when creating milestones or sprints
5. **Use underscores** for spaces in folder and file names

## Common Initialization Mistakes

- Creating `MANIFEST.md` instead of `00_PROJECT_MANIFEST.md`
- Missing the leading zeros in numbered prefixes
- Using hyphens instead of underscores
- Creating files without using templates
- Not updating the manifest after structural changes
