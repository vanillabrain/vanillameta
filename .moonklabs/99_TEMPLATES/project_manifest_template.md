---
project_name: {{project_name}}
current_milestone_id: {{current_milestone_id}}
highest_sprint_in_milestone: {{highest_sprint_in_milestone}}
current_sprint_id: {{current_sprint_id}}
status: active
last_updated: {{timestamp}}
---

# Project Manifest: {{project_name}}

This manifest serves as the central reference point for the project. It tracks the current focus and links to key documentation.

## 1. Project Vision & Overview

{{project_vision}}

This project follows a milestone-based development approach.

## 2. Current Focus

- **Milestone:** {{current_milestone_id}} - {{current_milestone_name}}
- **Sprint:** {{current_sprint_id}} - {{current_sprint_name}}

## 3. Sprints in Current Milestone

{{sprint_list}}

## 4. Key Documentation

- [Architecture Documentation](./01_PROJECT_DOCS/ARCHITECTURE.md)
- [Current Milestone Requirements](./02_REQUIREMENTS/{{current_milestone_id}}_{{current_milestone_slug}}/)
- [General Tasks](./04_GENERAL_TASKS/)

## 5. Quick Links

- **Current Sprint:** [{{current_sprint_id}} Sprint Folder](./03_SPRINTS/{{current_sprint_id}}_{{current_milestone_id}}_{{current_sprint_slug}}/)
- **Active Tasks:** Check sprint folder for T##_{{current_sprint_id}}_*.md files
- **Project Reviews:** [Latest Review](./10_STATE_OF_PROJECT/)
