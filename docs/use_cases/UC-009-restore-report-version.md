# Use Case: Restore Report Version

## Overview

**Use Case ID:** UC-009  
**Use Case Name:** Restore Report Version  
**Primary Actor:** Report Author  
**Goal:** Return a report's current state to a chosen earlier version without losing the history between them  
**Trigger:** Report Author requests restoration of a report version  
**Status:** Draft

**Requirements:** [FR-007, FR-014](../requirements.md)

## Preconditions

- Report Author is signed in and owns the report
- The report has at least one earlier version

## Main Success Scenario

1. Author opens the report's version history.
2. System lists versions with their capture times and origins.
3. Author selects a version and previews it.
4. Author confirms the restore.
5. System makes the chosen state the report's current state, keeping every version in history.

## Alternative Flows

### A1: Author Cancels at Preview

**Trigger:** Author decides against the selected version (step 4)  
**Flow:**

1. System discards the pending restore.
2. Use case ends.

### A2: Bindings Changed Since the Version

**Trigger:** The chosen version's dataset bindings no longer match available datasets (step 4)  
**Flow:**

1. System warns which bindings will be broken by the restore.
2. Author confirms: the restore proceeds and affected widgets are marked for reconnection.
3. Author cancels: Use case ends.

## Postconditions

### Success Postconditions

- The report's current state equals the chosen version's stored structure and bindings
- All versions, including the one that was current, remain in history
- Share links bound to specific versions still serve those versions

### Failure Postconditions

- The report's current state is unchanged
- No version is deleted or altered

## Business Rules

### BR-001: Restore Never Rewrites History

Restoring creates a new current state; it never deletes or overwrites a
version — the restored state itself becomes the newest entry.
