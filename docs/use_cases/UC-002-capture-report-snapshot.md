# Use Case: Capture Report Snapshot

## Overview

**Use Case ID:** UC-002  
**Use Case Name:** Capture Report Snapshot  
**Primary Actor:** Report Author  
**Goal:** Freeze the report's data results, chart options, and layout as a new restorable version  
**Trigger:** Report Author requests a snapshot capture of a report  
**Status:** Draft

**Requirements:** [FR-002, FR-014, NFR-004, NFR-009](../requirements.md)

## Preconditions

- Report Author is signed in
- The report exists

## Main Success Scenario

1. Author requests a snapshot capture for the report.
2. System retrieves each widget's data once from the data source.
3. System stores the retrieved results, chart options, and layout as a new snapshot version.
4. System displays the new version in the report's version history with its capture time.

## Alternative Flows

### A1: A Widget Fails to Retrieve

**Trigger:** One or more widgets cannot retrieve their data (step 2)  
**Flow:**

1. System records an error marker for each failed widget in the snapshot.
2. System completes the capture for the remaining widgets.
3. System notifies the author which widgets failed.
4. Use case continues at step 4.

### A2: Result Exceeds Storage Limit

**Trigger:** A widget's retrieved rows exceed the snapshot storage limit (step 3)  
**Flow:**

1. System truncates the stored rows to the limit and records the truncation on that widget.
2. The stored edition visibly indicates the truncation when rendered.
3. Use case continues at step 4.

### A3: Report Has No Widgets

**Trigger:** The report contains no widgets (step 2)  
**Flow:**

1. System informs the author that an empty report cannot be captured.
2. Use case ends.

## Postconditions

### Success Postconditions

- A new snapshot version exists containing stored results, chart options, and layout
- The snapshot is immutable and independently shareable
- No data source credentials or connection details are stored in the snapshot

### Failure Postconditions

- No snapshot is created
- Previous versions and the report remain unchanged

## Business Rules

### BR-001: Snapshots Are Immutable

Once stored, a snapshot's contents never change. Updated data requires a new
capture producing a new version.

### BR-002: Snapshots Carry No Secrets

A snapshot stores result rows and presentation options only — never data
source credentials, connection strings, or query text containing secrets.
