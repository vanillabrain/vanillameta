# Use Case: Manage Share Access

## Overview

**Use Case ID:** UC-010  
**Use Case Name:** Manage Share Access  
**Primary Actor:** Report Author  
**Goal:** Review, extend, replace, or withdraw the share links of a report so that access stays under the author's control  
**Trigger:** Report Author opens the share management of a report  
**Status:** Draft

**Requirements:** [FR-008, NFR-007](../requirements.md)

## Preconditions

- Report Author is signed in and owns the report
- The report has at least one share link

## Main Success Scenario

1. Author opens the report's share management.
2. System lists the report's links with their edition, role, expiry, and status.
3. Author withdraws a link.
4. System deactivates the link and every scoped access bound to it.
5. The link immediately stops granting access.

## Alternative Flows

### A1: Extend or Shorten Expiry

**Trigger:** Author changes a link's expiry instead of withdrawing it (step 3)  
**Flow:**

1. System applies the new expiry.
2. Use case continues at step 4.

### A2: Replace the Link

**Trigger:** Author wants the same grant under a fresh URL (step 3)  
**Flow:**

1. System withdraws the old link and issues a new one with identical grant.
2. System returns the new link to the author.
3. Use case continues at step 5.

### A3: Withdraw All Links

**Trigger:** Author revokes every share link of the report (step 3)  
**Flow:**

1. System asks for confirmation and lists affected links.
2. Author confirms: System deactivates all links and their scoped access.
3. Use case continues at step 5.

## Postconditions

### Success Postconditions

- The chosen links no longer grant access; their scoped access is dead
- Remaining links keep their grants untouched
- The report and its versions are unchanged

### Failure Postconditions

- Every link keeps its prior state — no partial withdrawal occurs

## Business Rules

### BR-001: Withdrawal Is Immediate and Total

A withdrawn link denies every subsequent access, including through tools and
cached sessions; there is no grace period.

### BR-002: Withdrawal Is Not Recall

Withdrawing a link stops future access only — it does not erase what a
recipient already saw or copied while the link was valid.
