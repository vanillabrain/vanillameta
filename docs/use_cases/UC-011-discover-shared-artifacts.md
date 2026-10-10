# Use Case: Discover Shared Artifacts

## Overview

**Use Case ID:** UC-011  
**Use Case Name:** Discover Shared Artifacts  
**Primary Actor:** Report Author, Recipient  
**Goal:** Find reports, datasets, and snapshot versions accessible to the user so existing work can be viewed or reused  
**Trigger:** A signed-in user searches or browses the artifact catalog  
**Status:** Draft

**Requirements:** [FR-012, C-004](../requirements.md)

## Preconditions

- User is signed in
- The user has access to at least one artifact (own or shared)

## Main Success Scenario

1. User opens the artifact catalog and enters a search term or filter (type, owner, edition).
2. System returns the artifacts matching the criteria that the user may access.
3. User selects an artifact.
4. System opens it — a report for viewing or remix, a dataset for inspection.

## Alternative Flows

### A1: No Matching Artifacts

**Trigger:** The search yields nothing within the user's access (step 2)  
**Flow:**

1. System reports no results and suggests broadening the criteria.
2. User adjusts the search.
3. Use case continues at step 2 or ends.

### A2: Artifact No Longer Accessible

**Trigger:** A listed artifact was withdrawn between listing and opening (step 4)  
**Flow:**

1. System informs the user the artifact is no longer available.
2. Use case continues at step 2.

## Postconditions

### Success Postconditions

- The user found and opened an artifact they are permitted to access

### Failure Postconditions

- No artifact outside the user's access is revealed — not even its existence

## Business Rules

### BR-001: Discovery Respects Access

Search results contain only artifacts the user may access; private reports of
others are invisible to search as if they did not exist.
