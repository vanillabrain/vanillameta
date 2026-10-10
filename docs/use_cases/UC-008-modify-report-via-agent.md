# Use Case: Modify Report via Agent

## Overview

**Use Case ID:** UC-008  
**Use Case Name:** Modify Report via Agent  
**Primary Actor:** AI Agent  
**Goal:** Turn agent-generated analysis into durable artifacts by remixing or updating a shared report through its tool surface  
**Trigger:** An AI Agent issues a modifying request against a shared report's tool surface  
**Status:** Draft

**Requirements:** [FR-010, FR-013, NFR-006, NFR-008, C-006](../requirements.md)

## Preconditions

- A share link exists whose grant permits modification (remix or edit)
- The AI Agent holds valid scoped access bound to that link

## Main Success Scenario

1. AI Agent inspects the shared report's structure through the tool surface.
2. AI Agent requests a remix of the report into its user's workspace.
3. System creates the independent copy and records its origin.
4. AI Agent submits modifications to the copy — changed widgets, layout, or titles.
5. System validates and stores the new state as a version.
6. AI Agent receives the new report's link and hands it to its user.

## Alternative Flows

### A1: Grant Is Read-Only

**Trigger:** The link's grant does not permit modification (step 2 or 4)  
**Flow:**

1. System rejects the request and states the grant's boundary.
2. System records the attempt.
3. Use case ends.

### A2: Modifications Fail Validation

**Trigger:** Submitted changes are malformed or reference unavailable fields (step 4)  
**Flow:**

1. System rejects the changes and explains the problems.
2. AI Agent corrects and resubmits.
3. Use case continues at step 5.
4. Agent abandons the change: Use case ends.

### A3: Update Attempted on a Snapshot Edition

**Trigger:** The agent requests changes against a frozen edition (step 4)  
**Flow:**

1. System explains that stored editions are immutable and requires a remix first.
2. Use case continues at step 2.

## Postconditions

### Success Postconditions

- A durable report artifact — new copy or new version — exists with recorded origin
- The original shared report is untouched unless the grant permitted editing it
- Every modifying call was recorded for audit

### Failure Postconditions

- No partial modification is stored
- Existing reports, versions, and grants remain unchanged

## Business Rules

### BR-001: Snapshots Are Write-Proof

Agents may never modify a stored edition in place; modification paths always
lead through a remix or through the report's live state.

### BR-002: Agent Writes Are Attributable

Every agent-driven change is recorded against the grant and the user it acted
for — there are no anonymous agent edits.
