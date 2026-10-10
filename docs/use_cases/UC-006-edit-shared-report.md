# Use Case: Edit Shared Report

## Overview

**Use Case ID:** UC-006  
**Use Case Name:** Edit Shared Report  
**Primary Actor:** Recipient  
**Goal:** Modify a shared report in place — its widgets, layout, and titles — so the shared report reflects the collaboration  
**Trigger:** Recipient with an Editor link chooses to edit the shared report  
**Status:** Draft

**Requirements:** [FR-006, NFR-008, C-004](../requirements.md)

## Preconditions

- Recipient holds an Editor-role share link and is signed in
- The shared report exists

## Main Success Scenario

1. Recipient opens the shared report and enters editing.
2. Recipient modifies the report — widgets, layout, or titles.
3. Recipient saves the changes.
4. System stores the new report state and records it as a new version.
5. Everyone viewing the report sees the updated state.

## Alternative Flows

### A1: Changes Rejected as Invalid

**Trigger:** The modification fails validation — e.g. a widget refers to a removed dataset (step 3)  
**Flow:**

1. System rejects the save and explains the problem.
2. Recipient corrects or discards the changes.
3. Use case continues at step 3 or ends.

### A2: Concurrent Edit

**Trigger:** Another editor saved the report while this recipient was editing (step 3)  
**Flow:**

1. System accepts the last save and records both states in the version history.
2. System informs the recipient their save replaced a concurrent change.
3. Use case continues at step 4.

### A3: Recipient Discards Changes

**Trigger:** Recipient abandons editing without saving (step 2–3)  
**Flow:**

1. System discards the unsaved modifications.
2. Use case ends.

## Postconditions

### Success Postconditions

- The shared report reflects the saved modifications
- A restorable version of the prior state exists
- The report's share links, editions, and ownership are unchanged

### Failure Postconditions

- The report's stored state is unchanged
- Existing versions remain intact

## Business Rules

### BR-001: Editors Need Identity

Editing a shared report requires a signed-in account so every change is
attributable — anonymous viewing never implies anonymous editing.

### BR-002: Every Save Keeps History

Each save records the prior state as a restorable version; no edit destroys
the ability to go back.
