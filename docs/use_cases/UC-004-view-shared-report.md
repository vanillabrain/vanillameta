# Use Case: View Shared Report

## Overview

**Use Case ID:** UC-004  
**Use Case Name:** View Shared Report  
**Primary Actor:** Recipient  
**Goal:** See the report granted by a share link — current data for a live edition, frozen data for a snapshot edition  
**Trigger:** Recipient opens a share link  
**Status:** Draft

**Requirements:** [FR-001, FR-003, FR-011, NFR-001, NFR-005, NFR-007, C-004](../requirements.md)

## Preconditions

- Recipient holds a share link issued for a report

## Main Success Scenario

1. Recipient opens the share link.
2. System checks that the link is active and unexpired, and that the recipient satisfies its access requirements.
3. System renders the edition the link is bound to: current data for a live edition, stored results for a snapshot edition.
4. Recipient sees the report's title, widgets, and the time its data reflects.

## Alternative Flows

### A1: Link Expired or Withdrawn

**Trigger:** The link is expired or has been revoked (step 2)  
**Flow:**

1. System informs the recipient the link is no longer available.
2. Use case ends.

### A2: Live Data Source Unavailable

**Trigger:** A live edition cannot retrieve current data (step 3)  
**Flow:**

1. System informs the recipient that current data is unavailable.
2. If a snapshot of the report exists, System offers the latest stored edition instead.
3. Recipient accepts: System renders the stored edition; use case continues at step 4.
4. Recipient declines: Use case ends.

### A3: Recipient Holds an Editor Link

**Trigger:** The link grants the Editor role (step 4)  
**Flow:**

1. System additionally presents edit affordances on the rendered report.
2. Recipient may proceed to editing (see UC-006).
3. Use case continues at step 4.

## Postconditions

### Success Postconditions

- Recipient sees the report within the bounds of the link's edition and role
- A snapshot edition renders entirely from stored results

### Failure Postconditions

- No report data is disclosed
- The report and its versions remain unchanged

## Business Rules

### BR-001: The Link Decides Freshness

A live edition shows retrieval time; a snapshot edition shows capture time.
The recipient always sees which moment the displayed data belongs to.
