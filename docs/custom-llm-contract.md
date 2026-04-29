# Custom LLM Contract

This document defines the one-hop Custom LLM contract for Vapi.

## Endpoint

- `POST /api/openai/chat/completions`
- OpenAI-compatible request/response surface for Vapi Custom LLM mode.

## Authentication

- Optional shared secret header: `x-vapi-secret`.
- If `VAPI_CUSTOM_LLM_SECRET` is set, requests without a matching header are rejected with `401`.

## Request Expectations

- Body shape follows OpenAI Chat Completions payload.
- The endpoint reads:
  - `messages` to resolve the latest user utterance.
  - `metadata.call.id` if provided (fallback to generated call id).
  - `stream` flag.

## Internal Decision Contract

The endpoint must call intake orchestration and receive:

- `say: string`
- `end_call: boolean`
- `state: string`
- `status: string`

These values are authoritative and must not be reinterpreted.

## Response Semantics

- Assistant speech is always exactly `say`.
- If `end_call=true`:
  - return assistant speech as normal content,
  - include tool call `endCall` with empty JSON arguments to force termination.
- If `end_call=false`:
  - no endCall tool call is emitted.

## Failure Semantics

- Any orchestration failure returns a safe fallback message and terminal behavior:
  - speech: \"Sorry, I am unable to continue this call right now. Please try again in a moment.\"
  - emits `endCall` tool call.

## Observability

The endpoint logs per-turn:

- `callId`
- resolved transcript
- terminal intent (`end_call`)
- state/status

