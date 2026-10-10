# Use Case: Query Report via Agent

## Overview

**Use Case ID:** UC-007  
**Use Case Name:** Query Report via Agent  
**Primary Actor:** AI Agent  
**Secondary Actors:** Data Source  
**Goal:** Answer questions about a shared report by inspecting and retrieving its data through the link's tool surface, within the granted scope  
**Trigger:** An AI Agent connects to a share link's tool surface on behalf of a recipient  
**Status:** Draft

**Requirements:** [FR-009, NFR-002, NFR-003, NFR-006, NFR-007, C-006](../requirements.md)

## Preconditions

- A share link exists and has been granted a scoped tool surface
- The AI Agent holds valid scoped access bound to that link

## Main Success Scenario

1. AI Agent connects to the share link's tool surface.
2. System presents the tools the grant allows and the report's structure: its datasets, fields, and edition.
3. AI Agent requests the report's schema or a bounded retrieval of its data.
4. System executes the request within the granted scope — current data for a live edition, stored results for a snapshot edition.
5. System returns the results to the AI Agent.
6. AI Agent uses the results to answer its user's question.

## Alternative Flows

### A1: Request Exceeds Granted Scope

**Trigger:** The agent asks for data outside the report's datasets, or attempts a modifying operation (step 3)  
**Flow:**

1. System rejects the request, explains the boundary, and records the attempt.
2. AI Agent reformulates within scope.
3. Use case continues at step 3 or ends.

### A2: Request Exceeds Bounds

**Trigger:** The retrieval exceeds row or time bounds (step 4)  
**Flow:**

1. System returns a bounded result marked as truncated, or fails the request with a clear reason.
2. AI Agent narrows the request.
3. Use case continues at step 3.

### A3: Scoped Access Expired or Withdrawn

**Trigger:** The grant is expired or revoked (step 1 or 4)  
**Flow:**

1. System denies the call and states the grant is no longer valid.
2. Use case ends.

## Postconditions

### Success Postconditions

- The AI Agent obtained report data strictly within the link's scope
- Every call was recorded for audit
- A snapshot edition was answered entirely from stored results

### Failure Postconditions

- Nothing outside the granted scope is disclosed
- The report and data source remain unmodified

## Business Rules

### BR-001: The Link Bounds the Agent

An AI Agent may reach exactly the report and edition its link grants — never
the wider workspace, other datasets, or data source internals.

### BR-002: Every Agent Call Is Audited

Each tool call is recorded with time, tool, and outcome, so scoped access is
always accountable.
