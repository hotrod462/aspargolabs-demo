# Custom LLM Hard Cutover Runbook

## Production Switch Sequence

1. Deploy code including `POST /api/openai/chat/completions`.
2. Set `VAPI_CUSTOM_LLM_SECRET` and `VAPI_CUSTOM_LLM_URL`.
3. Update Alex assistant model provider to `custom-llm`.
4. Sync assistant config with `npm run vapi:sync`.
5. Run immediate smoke call (normal path + hard-stop path).

## First-Hour Monitoring

Track:

- `401/403` on custom endpoint (secret mismatch)
- custom endpoint `5xx`
- elevated turn latency
- terminal turns where `end_call=true` but call did not end

## Rollback Triggers

Rollback if any of the following persists for 5+ minutes:

- custom endpoint `5xx` > 3%
- repeated terminal call non-disconnect behavior
- p95 turn latency regression > 2x baseline

## Rollback Steps

1. Revert Alex assistant `model.provider` to previous OpenAI profile.
2. Sync assistant config (`npm run vapi:sync`).
3. Re-run smoke call for hard-stop branch.
4. Keep custom endpoint deployed for debug traces.

