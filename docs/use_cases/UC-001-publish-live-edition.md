# Use Case: Publish Live Edition

## Overview

**Use Case ID:** UC-001  
**Use Case Name:** Publish Live Edition  
**Primary Actor:** Report Author  
**Goal:** Create a share link that renders the report with data freshly retrieved from the data source on every open  
**Trigger:** Report Author requests sharing of a report as a live edition  
**Status:** Draft

**Requirements:** [FR-001, FR-004, FR-011, NFR-002, NFR-003, C-004](../requirements.md)

## Preconditions

- Report Author is signed in
- The report exists and contains at least one widget bound to a dataset

## Main Success Scenario

1. Author opens the sharing settings of the report.
2. System presents the available edition choices and role choices.
3. Author selects the live edition and a role (Viewer or Editor).
4. Author optionally sets an expiry date and remix permission.
5. System issues a share link encoding the chosen edition, role, and permissions.
6. Author copies the link and hands it to recipients.

## Alternative Flows

### A1: Expiry Date Invalid

**Trigger:** Author sets an expiry date in the past (step 4)  
**Flow:**

1. System rejects the date and explains the requirement.
2. Author corrects or clears the expiry date.
3. Use case continues at step 5.

### A2: Live Link Already Exists

**Trigger:** An active live-edition link with the same role already exists for the report (step 5)  
**Flow:**

1. System presents the existing link and offers to reuse or replace it.
2. Author chooses reuse: use case continues at step 6 with the existing link.
3. Author chooses replace: System withdraws the old link and issues a new one.
4. Use case continues at step 6.

### A3: Author Cancels

**Trigger:** Author leaves the sharing settings without confirming (step 3–4)  
**Flow:**

1. System discards the unsaved choices.
2. Use case ends.

## Postconditions

### Success Postconditions

- An active live-edition share link exists for the report with the chosen role and expiry
- Every open of the link retrieves current data from the data source

### Failure Postconditions

- No share link is created or modified
- Existing share links and the report remain unchanged

## Business Rules

### BR-001: Live Editions Require Identified Recipients

A live-edition link never grants anonymous access. Recipients must hold a
signed-in account or valid scoped access, because a live link is a path to the
data source.

### BR-002: Live Queries Stay Read-Only

Queries executed through a live share link are read-only and bounded to the
report's own datasets.
