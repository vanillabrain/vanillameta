# Create, update and delete artifacts over MCP

## Sub-features
Tools `vm_create_artifact`, `vm_update_artifact`, `vm_delete_artifact`, `vm_get_artifact`, `vm_list_artifacts`. Kinds are `html`, `document`, `sheet` and `chart`. Updates need the current `expectedRevision`. Deletion is soft. Artifacts belong to the person who approved the grant.

## How to get to it (user POV)
The person asks the AI host to make something. The host calls the tool and replies with a link to `$WEB/ai-artifacts/<id>`.

## Driving it with curl over MCP
There is one scripted OAuth client, so drive writes through `scripts/verify/mcp-artifacts-e2e.sh`, step 4. It creates one artifact of each kind plus a throwaway html artifact named `Delete Me`, updates the document to revision 2, deletes the throwaway one, and sends a stale revision.

The proof is these lines in the run log: `도구 vm_create_artifact` and the four other tools, `생성 html`, `생성 document`, `생성 sheet`, `생성 chart`, `수정(document revision 2)`, `삭제`, `삭제 뒤 읽기 404`, `낡은 revision 거절`. Then read each id back with `GET $VM_API_URL/ai-artifacts/<id>` and compare the stored content with what was sent.

## Gotchas
- A write is refused unless the grant has `artifacts:write`. The refusal text is `The current connection or resource cannot authorize this write. Review access in VanillaMeta.`
- An infrastructure failure answers `The write could not be completed right now. Try again shortly.` It is not a permission problem.
- A revision mismatch returns the text `revision mismatch`, not a permission error.
