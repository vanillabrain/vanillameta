# CLAUDE.md - Requirements Folder Structure Guide

## Overview
This folder contains all project milestones and their associated requirements documentation. Each milestone represents a major project phase or feature set.

## Milestone Naming Convention
**CRITICAL**: Milestone folders MUST follow this exact pattern:
```
M##_Milestone_Name/
```

- `M##` - Two-digit milestone number (M01, M02, etc.)
- `_` - Single underscore separator
- `Milestone_Name` - Descriptive name using underscores for spaces

### Examples:
- ✅ `M01_Backend_Setup/`
- ✅ `M02_Frontend_UI/`
- ✅ `M03_Authentication_System/`
- ❌ `M1_Backend/` (missing leading zero)
- ❌ `M01-Backend-Setup/` (wrong separator)
- ❌ `Backend_Setup/` (missing M## prefix)

## Milestone Structure
Each milestone folder MUST contain:

### 1. Milestone Meta File (REQUIRED)
- **Name**: `M##_milestone_meta.md`
- **Purpose**: Contains milestone metadata and overview
- **Location**: Root of milestone folder

### 2. Product Requirements Documents (PRD)
- **Pattern**: `PRD_*.md`
- **Examples**: `PRD_Backend_Setup.md`, `PRD_User_Authentication.md`
- **Purpose**: Define product requirements and user stories

### 3. Technical Specifications
- **Pattern**: `SPECS_*.md`
- **Examples**: `SPECS_API_V1.md`, `SPECS_Database_Schema.md`
- **Purpose**: Technical implementation details

### 4. Amendments (as needed)
- **Pattern**: `PRD_AMEND_##_*.md`
- **Examples**: `PRD_AMEND_01_Additional_Endpoints.md`
- **Purpose**: Document changes to original requirements

## Example Structure
```
02_REQUIREMENTS/
├── M01_Backend_Setup/
│   ├── M01_milestone_meta.md
│   ├── PRD_Backend_Setup.md
│   ├── SPECS_API_V1.md
│   └── PRD_AMEND_01_Cache_Layer.md
├── M02_Frontend_UI/
│   ├── M02_milestone_meta.md
│   ├── PRD_User_Interface.md
│   └── SPECS_Component_Library.md
└── M03_Authentication_System/
    ├── M03_milestone_meta.md
    ├── PRD_Authentication.md
    └── SPECS_OAuth_Integration.md
```

## Important Notes for Claude Code

1. **Always use the M## prefix** when creating milestone folders
2. **Use underscores** for spaces in milestone names
3. **Create the milestone meta file first** using the template from `99_TEMPLATES/milestone_meta_template.md`
4. **Update the project manifest** (`00_PROJECT_MANIFEST.md`) when creating new milestones
5. **Maintain sequential numbering** - don't skip milestone numbers

## Common Mistakes to Avoid
- Creating milestones without the M## prefix
- Using hyphens instead of underscores
- Forgetting the milestone meta file
- Not updating the project manifest
- Creating milestones in the wrong location (must be in 02_REQUIREMENTS)