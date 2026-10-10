# Use Case: Publish Snapshot Edition

## Overview

**Use Case ID:** UC-003  
**Use Case Name:** Publish Snapshot Edition  
**Primary Actor:** Report Author  
**Goal:** Issue a share link that serves a chosen frozen version of the report without touching the data source  
**Trigger:** Report Author requests sharing of a report as a snapshot edition  
**Status:** Draft

**Requirements:** [FR-003, FR-004, FR-014, NFR-001, NFR-005, C-004](../requirements.md)

## Preconditions

- Report Author is signed in
- The report exists

## Main Success Scenario

1. Author opens the sharing settings of the report.
2. Author selects the snapshot edition.
3. System presents the report's snapshot versions.
4. Author chooses a version (default: latest), a role, remix permission, and optional expiry.
5. System issues a share link bound to the chosen version.
6. Author copies the link and hands it to recipients.

## Alternative Flows

### A1: No Snapshot Exists

**Trigger:** The report has no snapshot versions (step 3)  
**Flow:**

1. System informs the author a snapshot is required and offers to capture one.
2. Author accepts: System performs snapshot capture (see UC-002).
3. Use case continues at step 3.
4. Author declines: Use case ends.

### A2: Repoint Existing Link to a Newer Version

**Trigger:** A snapshot link already exists and a newer version is available (step 4)  
**Flow:**

1. System offers to repoint the existing link to the newer version.
2. Author accepts: System rebinds the existing link; its URL stays the same.
3. Author declines: System issues a separate link for the chosen version.
4. Use case continues at step 5.

### A3: Expiry Date Invalid

**Trigger:** Author sets an expiry date in the past (step 4)  
**Flow:**

1. System rejects the date and explains the requirement.
2. Author corrects or clears the expiry date.
3. Use case continues at step 5.

## Postconditions

### Success Postconditions

- An active share link exists bound to a specific snapshot version
- Opening the link renders stored results only; the data source is never contacted
- The link may grant anonymous access when its role is Viewer

### Failure Postconditions

- No share link is created or modified
- Existing share links and snapshot versions remain unchanged

## Business Rules

### BR-001: Anonymous Access Is Snapshot-Only

Only snapshot-edition links with the Viewer role may be opened without signing
in. Every other grant requires an identified recipient.

### BR-002: A Link Pins One Version

Each snapshot link serves exactly one version. Sharing a newer version means
repointing the link or issuing a new link — a served edition never changes
underneath its readers.
