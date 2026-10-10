# Use Case: Remix Shared Report

## Overview

**Use Case ID:** UC-005  
**Use Case Name:** Remix Shared Report  
**Primary Actor:** Recipient  
**Goal:** Obtain an independent editable copy of a shared report in the recipient's own workspace, leaving the original untouched  
**Trigger:** Recipient requests to remix a shared report  
**Status:** Draft

**Requirements:** [FR-005, FR-013, C-004](../requirements.md)

## Preconditions

- Recipient holds a share link that permits remix
- The shared report exists

## Main Success Scenario

1. Recipient requests a remix of the shared report.
2. System copies the report's structure, widgets, and dataset bindings into the recipient's workspace.
3. System records the copy's origin — the source report and its version.
4. Recipient opens the new copy as its owner and may edit it freely.

## Alternative Flows

### A1: Recipient Not Signed In

**Trigger:** Recipient has no signed-in account (step 1)  
**Flow:**

1. System asks the recipient to sign in or create an account.
2. Recipient signs in.
3. Use case continues at step 2.
4. Recipient abandons sign-in: Use case ends.

### A2: Remix Not Permitted

**Trigger:** The link does not grant remix permission (step 1)  
**Flow:**

1. System informs the recipient this report cannot be remixed.
2. Use case ends.

### A3: Datasets Not Accessible to Recipient

**Trigger:** The copy's dataset bindings point to data sources the recipient may not use (step 2)  
**Flow:**

1. System copies the report with the edition's stored results carried along as static stand-in data.
2. System marks those bindings for the recipient to reconnect to their own data source.
3. Use case continues at step 3.

## Postconditions

### Success Postconditions

- An independent copy of the report exists in the recipient's workspace with recorded origin
- The original report, its versions, and its share links are unchanged

### Failure Postconditions

- No copy is created
- The original report is never modified by a remix attempt

## Business Rules

### BR-001: Remix Never Escalates Visibility

A remixed copy never carries broader sharing grants than the source link
allowed its recipient — private originals cannot become public copies by
remix alone.

### BR-002: Lineage Is Recorded

Every remixed copy records the report and version it was derived from, so
provenance of derived work stays traceable.
