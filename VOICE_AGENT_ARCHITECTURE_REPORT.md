# Voice Agent Architecture Report for Aspargo / HezQ

This report explains the main ways to build an AI voice agent, the trade-offs between them, and how those choices apply to the Aspargo / HezQ telehealth intake use case.

The goal is simple:

The caller speaks to an AI assistant. The assistant collects enough information for a licensed doctor to review whether HezQ, a sildenafil oral spray, may be appropriate. The system should feel natural, but it should also reliably collect safety information, save incomplete calls, avoid medical advice, handle clarifying questions, and produce a trustworthy intake record for the doctor.

This is not legal or medical advice. It is an engineering architecture report to help you decide how to build the system.

## Short Recommendation

For the Aspargo / HezQ use case, the best architecture is:

**A deterministic intake state machine inside a broader control plane.**

In simpler words:

- Put the required intake steps in code, not only inside the LLM prompt.
- Let the LLM help with natural wording, clarifications, and extracting what the user said.
- Save the state of the call after every important turn, not only at the end.
- Keep Vapi structured outputs at the end of the call as a final cleanup/reconciliation layer.
- Use Vapi, Retell, or Pipecat depending on how much control you want. For the current demo, Vapi is enough to start if you add your own backend control plane.

The mental model:

The state machine is the checklist.

The control plane is the nurse coordinator who knows what has been asked, what is missing, what is risky, what should happen next, and what needs to be saved.

The LLM is the bedside manner. It helps the agent sound human, explain terms, and understand messy speech.

The final structured output is the discharge summary. Helpful, but too late to be the only thing you rely on.

## Current Aspargo Demo: What Exists Today

The Aspargo demo currently uses Vapi as the voice runtime.

Important files:

- `prompts/hezq-clinical-intake-system-prompt.v2.md`
- `vapi/assistants/alex-aspargotest__08c34165-7b51-419f-9873-c54d8c01d4b2.json`
- `app/api/vapi-webhook/route.ts`
- `app/api/intake-form/route.ts`
- `app/components/AIAgentSection.tsx`

The current assistant prompt contains a full intake flow. It tells the model to:

- act as Alex, a clinical intake assistant
- collect medical history for HezQ
- avoid medical advice
- ask short voice-friendly questions
- follow a strict sequence
- handle emergencies and proxy callers
- capture future-step answers if the patient volunteers them early
- confirm captured answers later
- end the call after completion

The assistant config in `vapi/assistants/alex-aspargotest__...json` attaches a Vapi structured output:

```json
"artifactPlan": {
  "structuredOutputIds": [
    "8fd95c09-df2f-4ed9-8cca-9b341db88bb3"
  ]
}
```

The webhook in `app/api/vapi-webhook/route.ts` waits for Vapi events:

- `end-of-call-report`
- `call.analysis.completed`

Then it looks for structured data in:

- `artifact.structuredData`
- `analysis.structuredData`
- `artifact.structuredOutputs[*].result`

Then it maps that structured data into Airtable fields like:

- ED Symptoms
- Nitrates/Poppers
- Recent Cardio Event
- Chest Pain/SOB
- High BP/Alpha Blockers
- Recent Normal BP
- Severe Conditions
- Penile Conditions
- Blood Conditions
- Allergies
- Other Medications

This is a good prototype.

But today, most of the live call control is still in the prompt. The backend mainly receives the final call artifact and writes to Airtable. That means the structured intake is mostly a post-call report, not a live source of truth during the call.

## The Main Design Question

The key question is not "Should the agent ask one question at a time?"

The deeper question is:

**How do we know, with enough confidence, that the patient actively provided the required information for a doctor to review?**

For telehealth intake, you do not need mathematical proof. You need a defensible record:

- The question was asked.
- The user answered it.
- The answer was clear enough.
- For important fields, the answer was confirmed.
- The transcript evidence exists.
- If the call ended early, the partial record still exists.
- The doctor can see what was collected, what was unclear, and what was missing.

That is why architecture matters.

## What Makes Voice Agents Different From Chatbots

Voice is not just chat with audio added.

A chatbot can show many options on screen. A user can reread them. A voice caller cannot.

Voice is:

- serial: the user hears one thing after another
- temporary: once spoken, it disappears
- noisy: speech recognition can misunderstand words
- interruptible: the user may speak while the agent is speaking
- time-sensitive: pauses feel awkward very quickly
- emotionally different: medical questions can feel personal or embarrassing

Because of that, the agent needs more than a good prompt. It needs orchestration.

## Basic Building Blocks of a Voice Agent

Most production voice agents are built as a pipeline:

1. Audio comes in from the user.
2. Speech-to-text turns speech into text.
3. A decision layer decides what to do.
4. An LLM produces or helps produce the response.
5. Text-to-speech turns the response into audio.
6. Audio is played back to the user.
7. State is saved.

The names vary by platform, but the pieces are the same.

### Transport

The transport is how audio moves.

Examples:

- browser call
- phone call
- SIP
- WebRTC
- WebSocket

Vapi and Retell hide a lot of this. Pipecat gives you more control.

### VAD / Endpointing

VAD means voice activity detection.

Endpointing means deciding when the user has finished speaking.

This is one of the most important parts of a voice agent.

If endpointing is too aggressive, the agent cuts the user off.

If endpointing is too slow, the agent feels sluggish.

For a medical intake, you usually want a slightly more patient setup than for a fast sales bot. Some callers may pause because they are thinking, embarrassed, unsure, or trying to remember medication names.

### STT

STT means speech-to-text.

This is where names like sildenafil, tadalafil, nitroglycerin, Flomax, Peyronie's, sickle cell, and NAION can get misheard.

Medical terms and drug names need tuning.

Common techniques:

- custom vocabulary
- keyword boosting
- keyterm prompting
- medical STT models
- transcript correction
- confirmation prompts

### LLM

The LLM is the language model.

It can do many jobs:

- understand what the user said
- classify the answer as yes, no, unclear, or off-topic
- explain a term
- generate a warm response
- decide whether to call a tool
- summarize the call

But you do not need to give the LLM every job.

For telehealth intake, the safest approach is to give the LLM fewer high-risk decisions.

### TTS

TTS means text-to-speech.

This controls how the agent sounds.

Important concerns:

- voice quality
- latency
- pronunciation
- speed
- whether it can speak medical terms correctly
- whether it supports pronunciation dictionaries

### Tools and Webhooks

Tools let the voice agent call your backend.

Examples:

- save an intake answer
- advance the state machine
- transfer the call
- send an SMS
- look up a patient
- schedule an appointment
- mark a call as unsafe/incomplete

Tools are how you move from "the LLM is talking" to "the system is doing work."

### Structured Outputs

Structured outputs produce JSON after the call, or sometimes after analysis completes.

This is useful for:

- CRM updates
- Airtable records
- analytics
- intake summaries
- QA

But structured outputs are usually not enough by themselves for live safety control, because they arrive after the conversation or after call analysis.

## The Universe of Voice Agent Architectures

There are many ways to build this. They sit on a spectrum from "mostly prompt" to "mostly code."

## Architecture 1: Prompt-Only Agent

This is the simplest version.

You write one big system prompt. The prompt says:

- who the agent is
- what questions to ask
- what order to follow
- what to do if the user asks for clarification
- when to end the call
- what not to say

The model is responsible for remembering and following the whole flow.

### What this looks like

The current Aspargo prompt is close to this architecture.

The prompt says: follow these steps in exact order, ask this question, wait for answer, move to the next step.

### Benefits

- Fast to build.
- Easy to change in the dashboard.
- No extra backend state machine.
- Good for demos.
- Good for simple flows where mistakes are low risk.
- The model can sound natural because it controls the conversation.

### Weaknesses

- The LLM may skip steps.
- The LLM may ask a future question too early.
- The LLM may forget what it captured.
- The LLM may accept vague answers.
- The LLM may fail to confirm important answers.
- The LLM may drift when users ask clarifying questions.
- Testing is harder because the "logic" lives in prose.
- You only discover mistakes after listening to calls.
- It is harder to prove what happened.

### Best use cases

- low-stakes FAQ bots
- simple receptionist bots
- restaurant reservations
- early prototypes
- demos
- flows where a human reviews everything anyway and missing data is not dangerous

### Fit for HezQ intake

Good for prototype.

Not ideal for production if the intake is used by a doctor to evaluate prescription eligibility.

## Architecture 2: Prompt-Only Agent plus End-of-Call Structured Output

This is the current Vapi demo pattern.

The model runs the call from the prompt. After the call, Vapi structured outputs extract a JSON intake record.

### Benefits

- Still simple.
- Better than freeform transcript parsing.
- Gives you clean Airtable data.
- Schema validation reduces malformed output.
- The full transcript is available to the extractor, so it can reconcile some contradictions.

### Weaknesses

- The structured output is late.
- It may not exist at `end-of-call-report` time because analysis can race the webhook. Your webhook already handles this by also listening for `call.analysis.completed`.
- It does not save live progress unless you build that separately.
- If the call drops early, you may not get the profile you wanted.
- It does not control what the agent does during the call.
- It may infer answers from unclear speech unless the schema/prompt prevents it.

### Best use cases

- post-call summaries
- sales qualification
- support ticket creation
- low-risk intake
- QA scoring
- analytics

### Fit for HezQ intake

Useful, but not enough alone.

For HezQ, this should be the final reconciliation layer, not the only source of truth.

## Architecture 3: Finite State Machine in Code

A finite state machine, or FSM, is a set of known states and known transitions.

Every state has:

- a question to ask
- expected answer types
- rules for yes/no/unclear
- hard-stop behavior
- next state

Example:

State: `nitrates_poppers`

Question: "Are you taking any medications containing nitrates, like nitroglycerin, or using recreational drugs known as poppers?"

If answer is yes:

- mark hard stop
- tell caller sildenafil is not safe with nitrates/poppers
- end call

If answer is no:

- save answer
- move to next state

If answer is unclear:

- ask for a definitive yes or no

### Benefits

- Very reliable.
- Easy to test.
- Easy to audit.
- Easy to see where the call is.
- The doctor can know which exact fields were asked and answered.
- Hard stops are enforced in code.
- You can save every answer immediately.
- You can restart/resume an incomplete call.

### Weaknesses

- More engineering.
- Can sound robotic if you use only fixed templates.
- Clarifying questions need a side path.
- Users may volunteer future information, which the FSM must capture without jumping.
- If built too rigidly, it creates a bad patient experience.

### Best use cases

- eligibility screening
- regulated workflows
- insurance forms
- medical intake
- compliance-heavy workflows
- identity verification
- payments
- any flow where order and completeness matter

### Fit for HezQ intake

Very strong fit.

But a pure FSM is not enough by itself. You still need natural language understanding and clarifications.

## Architecture 4: Control Plane with an FSM Inside It

This is the recommended architecture.

A control plane is broader than a state machine.

The FSM decides the next required step.

The control plane manages the whole call:

- current state
- collected slots
- confidence per field
- transcript snippets
- user interruptions
- clarifying questions
- tool calls
- saving partial data
- final submission
- retries
- escalation
- audit logs
- vendor events

The control plane is the "mission control" for the call.

### Why this is better than "FSM vs control plane"

It is not really a choice between FSM and control plane.

For Aspargo, you want both:

- The FSM handles the required intake order.
- The control plane handles everything around the FSM.

Analogy:

The FSM is the recipe.

The control plane is the cook who follows the recipe, watches the stove, notices missing ingredients, handles interruptions, plates the food, and cleans up.

### What the LLM does in this architecture

The LLM does not own the clinical flow.

The LLM helps with:

- classifying the user's answer
- extracting volunteered future slots
- explaining terms in simple language
- producing a friendly version of the next question
- summarizing for the doctor

The code owns:

- what state we are in
- whether a field is complete
- whether a hard stop was triggered
- whether the call should end
- what is saved
- what must be asked next

### Benefits

- Best balance of safety and naturalness.
- You can support clarifications without losing the intake path.
- You can save incomplete profiles.
- You can audit every transition.
- You can use Vapi/Retell as the voice runtime while keeping your business logic in your backend.
- You can add more channels later, like web chat or SMS, using the same intake state machine.

### Weaknesses

- More complex than prompt-only.
- Needs backend state storage.
- Needs good tool/webhook integration.
- Needs careful latency design.
- Needs good tests.

### Fit for HezQ intake

Best fit.

## Architecture 5: Retell Conversation Flow / Node-Based Flow

Retell has conversation-flow primitives like:

- conversation nodes
- function nodes
- code nodes
- branch nodes
- transfer nodes
- extract dynamic variables nodes
- webhooks
- call analysis
- transcript update events

This means Retell can represent more of the flow as a graph inside the platform.

### Benefits

- More built-in flow structure than a single prompt.
- Node-based design can be easier to visualize.
- Function nodes can guarantee a tool runs on node entry.
- Branch nodes can represent conditional flows.
- Webhooks and custom functions can connect to your backend.
- Retell documents healthcare/HIPAA positioning and BAA support.

### Weaknesses

- You still need to decide whether platform nodes are enough for your compliance/audit needs.
- Complex flows can become hard to manage visually.
- You may still want your own backend as the source of truth.
- Migrating away later may require translating platform-specific flow definitions.

### Best use cases

- teams that want a managed platform with more visual flow control
- appointment booking
- patient reminders
- structured inbound/outbound call flows
- business users reviewing call paths

### Fit for HezQ intake

Good candidate.

Retell may be attractive if you want more built-in conversation-flow primitives than Vapi. But you should still keep critical clinical intake state in your own backend if you want durable auditability and vendor portability.

## Architecture 6: Vapi Managed Voice Runtime plus Your Backend Control Plane

This is probably the best near-term path if you want to build from the current repo.

Vapi gives you:

- voice runtime
- phone/web calls
- transcriber configuration
- voice configuration
- server events
- tool calls
- structured outputs
- live call control
- assistant-request for dynamic assistant selection
- call control / transfer support

Your backend would add:

- call session table
- intake state table
- field status table
- evidence snippets
- partial Airtable updates
- final reconciliation
- medical term glossary
- transition logic

### Benefits

- You do not need to build the audio stack.
- You can keep the current Vapi demo.
- You can incrementally move logic out of the prompt.
- Vapi has structured outputs and webhooks already.
- Vapi has pronunciation dictionaries for ElevenLabs voices.
- Vapi supports Deepgram keyword/keyterm prompting through transcriber config.
- Vapi supports HIPAA mode, with important provider/BAA caveats.

### Weaknesses

- Vapi does not automatically enforce your state machine.
- You must build the control plane yourself.
- You must handle webhook idempotency and event races.
- Some live changes require careful use of tools/live call control.
- HIPAA requires attention to every provider touching PHI, not just Vapi.

### Fit for HezQ intake

Strong near-term fit.

Recommended if you want speed and can build backend state tracking.

## Architecture 7: Pipecat Custom Pipeline

Pipecat is an open-source Python framework for building realtime voice and multimodal agents.

Instead of using Vapi as the managed voice runtime, Pipecat lets you assemble the pieces:

- transport
- VAD
- STT
- context aggregator
- LLM
- TTS
- output transport

Pipecat uses concepts like frames, processors, pipelines, and transports.

### Benefits

- Maximum control.
- Easier to insert custom processors at any point.
- You can run your own state machine directly in the audio pipeline.
- You can choose your own STT/TTS/LLM providers.
- You can tune VAD and endpointing more deeply.
- Better for advanced custom behavior.

### Weaknesses

- More engineering burden.
- You own more infrastructure.
- Telephony integration is more work.
- You need to handle scaling, observability, retries, failures, and deployment.
- You need more voice engineering expertise.

### Best use cases

- complex custom voice products
- teams needing full control over latency and audio
- custom providers
- advanced interruption handling
- enterprise deployments where vendor abstraction is limiting

### Fit for HezQ intake

Good later, not necessary at the very beginning.

Use Pipecat if Vapi/Retell become limiting, especially around live state updates, low-level VAD behavior, custom STT, or deep integration needs.

## Architecture 8: Realtime Speech-to-Speech Model

This uses a realtime speech model that takes audio in and produces audio out, sometimes without a text pipeline in the middle.

Examples include realtime model APIs from major providers.

### Benefits

- Very natural.
- Low latency.
- Handles interruptions better.
- More human-like pacing.

### Weaknesses

- Harder to debug.
- Harder to audit.
- Harder to enforce exact intake behavior.
- Tool calls and state control can be less transparent.
- Medical transcript evidence can be harder to structure.

### Best use cases

- open-ended companionship
- coaching
- casual support
- fast conversational experiences
- situations where naturalness matters more than exact form completion

### Fit for HezQ intake

Not ideal as the only architecture.

It may be useful for the responder voice layer later, but the clinical intake control should still live outside the model.

## Architecture 9: Multi-Agent System

This uses several specialized agents:

- intake agent
- clarification agent
- safety triage agent
- scheduling agent
- handoff agent
- summarizer agent

A supervisor routes between them.

### Benefits

- Each agent can have a smaller prompt.
- Easier to specialize behavior.
- Useful when the product grows beyond one intake flow.
- Helps avoid one giant prompt with too many responsibilities.

### Weaknesses

- More latency if agents call each other.
- More orchestration complexity.
- Routing errors can happen.
- Harder to debug at first.

### Best use cases

- large healthcare call centers
- intake plus scheduling plus billing plus support
- multi-specialty routing
- insurance workflows
- triage plus escalation

### Fit for HezQ intake

Probably overkill today.

Useful later if the agent must handle many non-intake tasks.

## Recommended Architecture for Aspargo

The right structure is:

**Managed voice platform + backend control plane + deterministic intake FSM + bounded LLM flexibility + final structured-output reconciliation.**

In plain English:

Let Vapi or Retell handle the phone call and speaking.

Let your backend decide where the call is in the intake.

Let the LLM understand the caller and explain things naturally.

Let Airtable receive partial and final records.

Let structured outputs clean up the final record, but do not rely on them as the only intake source.

## Why the Core Should Be Deterministic

The HezQ flow asks about safety-sensitive fields.

Examples:

- age
- ED symptoms
- nitrates or poppers
- recent ED medications
- recent heart attack, stroke, or heart surgery
- chest pain or severe shortness of breath with light activity
- uncontrolled high blood pressure or alpha blockers
- recent normal blood pressure
- severe liver/kidney disease, bleeding disorder, ulcers, NAION
- priapism or penile shape condition
- blood conditions
- allergies
- other daily medications or supplements

These are not casual conversation topics. They are required inputs for a doctor.

You want to know:

- Did the patient answer?
- Was it yes/no/unknown?
- Did the answer trigger a hard stop?
- Did we save the answer?
- Did we preserve transcript evidence?
- Did the patient ask a clarification?
- Did the agent explain without giving medical advice?
- Did the patient confirm understanding?

An LLM-only prompt can try to do this. A control plane can prove it happened.

## Why the System Still Needs Flexibility

Patients will not behave like a perfect form.

They may say:

- "What are nitrates?"
- "Is nitroglycerin one of those?"
- "I take something for my prostate, I forgot the name."
- "What is Flomax?"
- "What does alpha blocker mean?"
- "What is Peyronie's?"
- "I had chest pain a year ago, does that count?"
- "I don't know if my blood pressure is normal."
- "I take Cialis sometimes, is that the same kind of thing?"
- "Can I still get approved?"
- "Why do you need to know this?"
- "Is this private?"
- "Are you a real person?"

The agent must not freeze.

It should:

1. answer the clarification briefly
2. avoid giving personal medical advice
3. return to the current intake question
4. only advance after the needed answer is clear

This is mixed initiative, but bounded.

The patient can ask questions, but the patient does not take control of the medical flow.

## A Good Clarification Pattern

Use this pattern:

1. Acknowledge.
2. Explain the term in plain language.
3. Avoid personal advice.
4. Ask the original question again.

Example: nitrates.

Patient: "What are nitrates?"

Agent: "Nitrates are medicines sometimes used for chest pain, such as nitroglycerin. Are you currently taking nitroglycerin or any nitrate medicine, or using poppers?"

Example: Flomax.

Patient: "What is Flomax?"

Agent: "Flomax is a medicine sometimes used for prostate or urinary symptoms, and it is one example of an alpha blocker. Do you take Flomax or any alpha blocker?"

Example: Cialis.

Patient: "Is Cialis an ED medication?"

Agent: "Yes, Cialis is the brand name for tadalafil, which is an erectile dysfunction medication. In the last 48 hours, have you taken Cialis, Viagra, Levitra, Stendra, or any sexual enhancement product?"

Example: medical advice boundary.

Patient: "Is it safe for me if I take blood pressure medicine?"

Agent: "I am an AI, so I cannot tell you whether it is safe for you personally, but I will make sure the doctor sees it. Do you have uncontrolled high blood pressure, or do you take an alpha blocker like Flomax?"

This lets the call feel natural while keeping the intake intact.

## What Should Live in Code vs in the Prompt

### Put in code

- the list of required states
- allowed transitions
- hard stop rules
- field definitions
- whether each field is missing, answered, confirmed, unclear, or skipped
- save-to-Airtable behavior
- retry limits
- call outcome
- confidence scoring
- audit trail
- evidence snippets
- webhook idempotency
- final reconciliation logic

### Put in the LLM prompt

- voice style
- empathy
- no medical advice
- how to explain terms
- how to phrase short answers
- how to ask the exact current question naturally
- how to classify an answer if using LLM extraction

### Put in structured outputs

- final call summary
- final normalized intake JSON
- QA flags
- contradictions detected
- missing fields
- doctor-facing summary

## What "Confidence" Should Mean

Do not use a single vague confidence number.

Use field-level evidence.

Each field should have a status:

- not_started
- asked
- answered_explicitly
- answered_unclearly
- captured_early
- confirmed
- contradicted
- hard_stop
- not_applicable
- incomplete

Each field should store:

- value
- source turn
- transcript evidence
- whether the answer was confirmed
- whether it was inferred or explicit
- timestamp
- confidence score
- notes for doctor

Example:

```json
{
  "field": "uses_nitrates_or_poppers",
  "value": false,
  "status": "confirmed",
  "confidence": 0.96,
  "asked_at_turn": 4,
  "answered_at_turn": 5,
  "confirmed_at_turn": 5,
  "evidence": [
    {
      "speaker": "assistant",
      "text": "Are you taking any medications containing nitrates, like nitroglycerin, or using recreational drugs known as poppers?"
    },
    {
      "speaker": "user",
      "text": "No, I do not take those."
    }
  ]
}
```

This is much more useful than just:

```json
{
  "uses_nitrates_or_poppers": false
}
```

The doctor needs to know how strong the record is.

## Suggested Confidence Ladder

Use a ladder like this:

- 0.95 to 1.00: explicit answer, confirmed, clear transcript
- 0.85 to 0.94: explicit answer, clear transcript, confirmation not needed because it was just asked and answered
- 0.70 to 0.84: answer captured from volunteered info, later confirmed
- 0.50 to 0.69: likely answer, but wording was indirect or STT uncertain
- 0.20 to 0.49: unclear answer, do not treat as complete
- 0.00 to 0.19: missing, contradictory, or unusable

For hard-stop fields, require high confidence before treating the field as cleared.

Hard-stop fields should not be inferred casually.

## Partial Save Strategy

One of the most important changes: save incomplete profiles during the call.

Do not wait until the end.

People hang up. Phones disconnect. Webhooks race. Structured outputs can arrive late. A partial profile is better than nothing.

### What to save after every turn

Save:

- call_id
- caller phone number if available
- current_state
- current question
- fields collected so far
- field statuses
- transcript snippets
- hard-stop flags
- emergency flags
- call outcome so far
- last updated timestamp

### How to save to Airtable

Airtable can store partial records, but you need a strategy.

Option A: create one record at call start and update it throughout the call.

Best for auditability.

Option B: create records only after fields are collected.

Simpler but messier.

Option C: write partial state to your database/Redis, then sync to Airtable periodically.

Best long-term.

Recommended:

- Create a call session record at call start.
- Save partial intake updates after each answered field.
- Mark the record as `in_progress`, `incomplete`, `hard_stopped`, `completed`, or `needs_review`.
- On `call.analysis.completed`, reconcile final structured output into the same record.

### Airtable fields to add

Consider adding:

- Call ID
- Call Status
- Intake Completion Percent
- Current Step
- Missing Required Fields
- Hard Stop Triggered
- Needs Doctor Review
- Needs Human Follow-up
- Confidence Summary
- Transcript Evidence URL or text
- Last Updated
- Final Structured Output Source

The existing columns capture the final medical answers. They do not fully capture the quality of the intake process.

## Suggested State Model

Use a call session object:

```json
{
  "call_id": "call_123",
  "patient_phone": "+14435589279",
  "state": "nitrates_poppers",
  "status": "in_progress",
  "fields": {
    "age_18_or_older": {
      "value": true,
      "status": "confirmed",
      "confidence": 0.96
    },
    "ed_symptoms": {
      "value": true,
      "status": "confirmed",
      "confidence": 0.95
    },
    "uses_nitrates_or_poppers": {
      "value": null,
      "status": "asked",
      "confidence": 0.0
    }
  },
  "captured_future_slots": {},
  "risk_flags": [],
  "events": []
}
```

Use event logs:

```json
{
  "event_type": "field_answered",
  "state": "nitrates_poppers",
  "field": "uses_nitrates_or_poppers",
  "value": false,
  "confidence": 0.93,
  "transcript": "No, I do not take nitrates or poppers.",
  "timestamp": "2026-04-28T12:00:00Z"
}
```

This makes the system auditable.

## Suggested Intake FSM

The FSM can follow your current v2 prompt:

1. `age_gate`
2. `chief_complaint`
3. `nitrates_poppers`
4. `recent_ed_medications`
5. `recent_major_cardio_event`
6. `exertional_symptoms`
7. `bp_alpha_blockers`
8. `recent_bp_check`
9. `organs_bleeding_ulcers_eyes`
10. `priapism_penile_shape`
11. `blood_conditions`
12. `allergies`
13. `daily_meds_supplements`
14. `final_confirmation`
15. `wrap_up`

Add global interrupt states:

- `clarification`
- `privacy_question`
- `no_medical_advice_response`
- `repeat_question`
- `audio_unclear`
- `emergency_end`
- `proxy_caller_end`
- `human_escalation`

The global states are temporary. After handling them, return to the previous intake state unless the call must end.

## How a Turn Should Work

For each user turn:

1. Receive final transcript.
2. Store transcript.
3. Run safety classifier.
4. If emergency, execute emergency response and end.
5. Run answer extractor for the current state.
6. Run future-slot extractor for volunteered information.
7. If user asked a clarification, answer it and repeat/confirm the current question.
8. If answer is clear, save field.
9. If answer needs confirmation, confirm.
10. If confirmed, transition to next state.
11. Save partial state to database/Airtable.
12. Send the next response to the voice platform.

The model can help with steps 3, 5, 6, and 7, but code should own steps 8, 9, 10, and 11.

## Handling Early Volunteered Information

Patients often volunteer future information.

Example:

Agent: "Are you 18 or older?"

Patient: "Yes, and I do not take nitrates, but I do take Flomax."

The system should:

- record `age_18_or_older = true`
- capture `uses_nitrates_or_poppers = false` as future info
- capture `high_bp_or_alpha_blockers = true` as future info
- stay in sequence
- when it reaches the nitrate step, confirm: "I noted you said you do not take nitrates or poppers. Is that correct?"
- when it reaches the alpha blocker step, confirm: "I noted you take Flomax, which is an alpha blocker. Is that correct?"

This is important because it makes the call efficient without letting the patient scramble the order of the clinical flow.

## Handling Clarifications About Medicine Names

For HezQ, the agent should have a glossary.

Suggested glossary entries:

- HezQ: sildenafil oral spray used for erectile dysfunction; the doctor decides if appropriate.
- Sildenafil: the active ingredient in Viagra and HezQ.
- Viagra: brand name for sildenafil.
- Cialis: brand name for tadalafil.
- Levitra: brand name for vardenafil.
- Stendra: brand name for avanafil.
- Nitrates: medicines often used for chest pain; examples include nitroglycerin, isosorbide mononitrate, and isosorbide dinitrate.
- Poppers: recreational drugs often containing amyl nitrite or similar substances.
- Alpha blockers: medicines sometimes used for prostate or blood pressure symptoms; examples include Flomax/tamsulosin, doxazosin, terazosin, alfuzosin, silodosin.
- NAION: a rare eye condition involving sudden vision loss related to the optic nerve.
- Priapism: an erection lasting more than 4 hours.
- Peyronie's disease: a condition that can affect the shape or curve of the penis.

The glossary should be in code/config, not buried only in a prompt.

Why?

Because you may need it for:

- response generation
- STT keyword boosting
- pronunciation dictionaries
- doctor-facing summaries
- QA tests

## Example Clarification Flow

State: `nitrates_poppers`

Agent: "Are you taking any medications containing nitrates, like nitroglycerin, or using recreational drugs known as poppers?"

Patient: "What is nitroglycerin?"

System detects:

- intent: clarification
- topic: nitroglycerin
- no answer yet

Agent: "Nitroglycerin is a nitrate medicine sometimes used for chest pain. Are you taking nitroglycerin, any other nitrate medicine, or poppers?"

Patient: "No."

System records:

- `uses_nitrates_or_poppers = false`
- status: answered_explicitly
- confidence: high

Then advance.

## Example Medical Advice Boundary

State: `bp_alpha_blockers`

Agent: "Do you have uncontrolled high blood pressure, or do you take an alpha blocker like Flomax for your prostate?"

Patient: "I take blood pressure pills. Is HezQ safe for me?"

System detects:

- user asked medical advice
- possible volunteered medication info
- no clear yes/no answer yet

Agent: "I cannot tell you whether it is safe for you personally, but I will make sure the doctor sees your blood pressure medication. Do you have uncontrolled high blood pressure, or do you take an alpha blocker like Flomax?"

The system should not say "yes, it is safe" or "you should take it."

## The Role of Final Confirmation

For a doctor-facing intake, add a final confirmation step.

Example:

"Before I send this to the doctor, I want to confirm the key answers I collected. You said you are 18 or older, you have ED symptoms, you do not take nitrates or poppers, and you have not had a heart attack, stroke, or heart surgery in the past six months. Is that correct?"

This can be split into smaller pieces if too long for voice.

For critical fields, you may not need to recap everything, but you should confirm enough that the record is defensible.

## Regulatory and Compliance Considerations

This section is plain-English and not legal advice.

### HIPAA

If the system handles protected health information, HIPAA matters.

Important ideas:

- Any vendor touching PHI may need a BAA.
- Transcripts can contain PHI.
- Audio recordings can contain PHI.
- Logs can contain PHI.
- Prompt/completion logs can contain PHI.
- Analytics tools can accidentally receive PHI.
- You need access controls, encryption, audit logging, and retention policies.

For voice agents, HIPAA is not only about the voice platform. It is about the whole chain:

- Vapi/Retell/Pipecat hosting
- STT provider
- LLM provider
- TTS provider
- Airtable
- logs
- error tracking
- monitoring
- human review tools

Vapi documents HIPAA support with `hipaaEnabled`, but you still need to think about the providers used underneath and whether BAAs are in place.

Retell documents HIPAA/BAA positioning and compliance materials.

Airtable may or may not be appropriate for PHI depending on plan, configuration, BAA, and usage. This should be reviewed carefully before production.

### FDA / Clinical Decision Support

FDA clinical decision support guidance is mostly about software that supports or provides recommendations to healthcare professionals.

For your use case, a safer posture is:

- The AI collects intake information.
- The AI does not diagnose.
- The AI does not approve or reject the patient for treatment as a final medical decision.
- The AI can hard-stop the intake for obvious safety exclusions if approved by medical/legal policy, but it should frame this carefully.
- A licensed clinician reviews the intake and makes the prescribing decision.
- The doctor can see the basis for the information collected.

Do not market the AI as deciding whether the patient can take HezQ unless legal/regulatory counsel approves that product scope.

### Medical Advice Boundary

The agent should not answer:

- "Should I take this?"
- "What dose should I use?"
- "Is it safe for me?"
- "Can I mix it with alcohol?"
- "Can I take it with my specific medicine?"
- "Will I be approved?"

It can say:

"I cannot give medical advice, but I will include that for the doctor."

Then it returns to the intake question.

### Emergency Escalation

For current emergency symptoms, the agent should give a clear emergency instruction and end or transfer according to policy.

Examples:

- chest pain right now
- severe shortness of breath right now
- stroke-like symptoms
- fainting/collapse
- erection lasting more than 4 hours right now
- sudden vision loss
- severe allergic reaction

Do not continue normal intake after a live emergency red flag.

## Platform Comparison

## Vapi

Vapi is good if you want a managed voice platform and you are comfortable building your own backend control plane.

Useful Vapi primitives:

- server events
- tool calls
- structured outputs
- live call control
- dynamic assistant selection through assistant-request
- client transcript events
- transcriber configuration
- voice configuration
- pronunciation dictionaries for ElevenLabs voices
- Deepgram keywords/keyterms
- HIPAA mode

Vapi is strong for:

- fast prototypes
- managed phone/web voice calls
- structured post-call extraction
- integrating with tools
- keeping your current demo close to what exists

Vapi is weaker if:

- you want the platform itself to enforce a complex statechart
- you want full low-level pipeline control
- you want all logic represented visually as nodes

Recommended Vapi path:

- keep Vapi as voice runtime
- add backend state/session store
- add tools for state updates
- listen to transcript/conversation events if needed
- write partial intake updates during the call
- use structured outputs after the call for reconciliation

## Retell

Retell is good if you want a managed voice platform with more built-in conversation-flow/node concepts.

Useful Retell primitives:

- conversation flow nodes
- branch nodes
- function nodes
- code nodes
- custom functions
- node functions
- transcript updated webhooks
- call analyzed webhooks
- transfer nodes
- dynamic variables
- custom pronunciation
- interruption sensitivity controls
- compliance/BAA positioning

Retell is strong for:

- visual or semi-visual flows
- deterministic node flows
- teams that prefer platform-managed conversation graph concepts
- healthcare phone workflows

Retell is weaker if:

- you want total portability
- you do not want platform-specific flow definitions
- your flow becomes too complex for a visual builder

Recommended Retell path:

- use Retell conversation flow for the intake states
- still store authoritative state in your backend
- use webhooks/functions to save partial profiles
- use call analysis for final reconciliation

## Pipecat

Pipecat is good if you want deep control and are comfortable building more infrastructure.

Useful Pipecat concepts:

- pipelines
- frames
- processors
- transports
- VAD analyzers
- STT services
- LLM services
- TTS services
- event handlers
- custom processors

Pipecat is strong for:

- custom voice stacks
- advanced VAD/endpointing
- custom STT/TTS provider choices
- lower-level control
- open-source flexibility

Pipecat is weaker if:

- you want fast managed telephony
- you do not want to run more infrastructure
- you are early and still validating the flow

Recommended Pipecat path:

- use later if Vapi/Retell limit you
- or use if you already know you need full custom runtime control

## Should You Use Vapi, Retell, or Pipecat?

For the current stage:

**Use Vapi if you want to build quickly from the current repo.**

You already have Vapi configured. You can add a backend control plane without rebuilding the voice stack.

Use Retell if:

- you want stronger built-in conversation-flow primitives
- you want node-based branching
- you want a platform that represents more of the flow directly

Use Pipecat if:

- you want maximum control
- you have engineering capacity
- managed platforms are blocking your design
- you need custom audio/VAD/transcription behavior

My practical recommendation:

Start with Vapi plus your own control plane.

Do not jump to Pipecat unless you hit clear platform limitations.

Evaluate Retell if visual conversation flows and node functions feel more aligned with your team than building the FSM fully in your own backend.

## VAD and Endpointing Considerations

Endpointing is a major quality lever.

For HezQ intake, callers may pause because questions are sensitive. If the system interrupts too quickly, it will feel rude and may capture incomplete answers.

### Too aggressive

Example:

Patient: "I take... uh..."

Agent: "Sorry, was that yes or no?"

Bad experience.

### Too slow

Patient: "No."

Long pause.

Agent finally responds.

Feels broken.

### Suggested approach

Start with conservative endpointing for medical intake.

Tune based on real calls.

Track:

- average silence before response
- false cutoffs
- user interruptions
- repeated questions
- abandonment
- STT confidence if available

For Deepgram-style settings:

- shorter endpointing can feel faster
- longer endpointing helps slow speakers
- Nova-3 uses keyterm prompting rather than old keyword boosting
- medical terms should be explicitly included as keyterms

## Transcription Customization

For this use case, transcription accuracy matters a lot.

Terms to tune:

- HezQ
- sildenafil
- Viagra
- tadalafil
- Cialis
- vardenafil
- Levitra
- avanafil
- Stendra
- nitroglycerin
- nitrates
- poppers
- Flomax
- tamsulosin
- alpha blocker
- doxazosin
- terazosin
- alfuzosin
- silodosin
- NAION
- Peyronie's
- priapism
- sickle cell
- multiple myeloma
- leukemia

### Vapi

Vapi supports Deepgram custom keywords/keyterms in transcriber configuration.

For Nova-3, use keyterm prompting rather than old keyword boosting.

Vapi also supports custom transcribers if you need more control.

### Retell

Retell supports custom pronunciation for how the agent speaks. It also has speech and background-noise/interruption controls. For transcription tuning, check the specific STT provider configuration available in your Retell setup.

### Pipecat

Pipecat lets you configure the STT service directly. With Deepgram, you can pass options like keywords/keyterms depending on model support. You can also choose different STT providers or add a custom transcript correction processor.

## Pronunciation Customization

Pronunciation matters because the agent will say medicine names.

If the agent says "sildenafil" or "Peyronie's" badly, trust drops.

### Vapi

Vapi supports pronunciation dictionaries for ElevenLabs voices. It can use alias rules or phoneme rules depending on model support.

### Retell

Retell supports custom pronunciation dictionaries for certain voice configurations, including IPA or CMU pronunciation.

### Pipecat

Pipecat depends on your TTS provider. If you use ElevenLabs, Cartesia, Azure, or another TTS provider, use that provider's pronunciation/lexicon features where available.

### Practical recommendation

Create a shared glossary file for:

- display name
- spoken pronunciation
- STT keyterm
- explanation
- related brand/generic names

This avoids separately maintaining prompt text, STT vocabulary, and TTS pronunciation.

## Data Architecture

Recommended storage:

1. Fast session store during call.
2. Durable database for audit and replay.
3. Airtable as operational dashboard if needed.
4. Final structured output stored alongside raw field evidence.

### Minimum database objects

CallSession:

- call_id
- platform
- caller_id
- started_at
- ended_at
- status
- current_state
- completion_percent
- hard_stop_reason
- emergency_flag
- transfer_flag

IntakeField:

- call_id
- field_name
- value
- status
- confidence
- asked_at
- answered_at
- confirmed_at
- evidence
- source

CallEvent:

- call_id
- event_type
- state
- transcript
- data
- timestamp

FinalIntake:

- call_id
- normalized_payload
- structured_output_source
- reconciliation_notes
- doctor_summary

## How to Reconcile Live State with Final Structured Output

At the end of the call, you may have:

- live state captured during the call
- Vapi structured output
- transcript

Do not blindly overwrite live state with final structured output.

Use rules:

- If live state has explicit confirmed answer, keep it.
- If structured output fills a field that live state missed, mark it as `post_call_inferred`.
- If structured output contradicts live state, mark `needs_review`.
- If hard-stop live state exists, do not erase it.
- Store both original and final values.

Example:

Live state:

```json
"recent_cardio_event": {
  "value": false,
  "status": "confirmed"
}
```

Structured output:

```json
"recent_cardio_event": true
```

Final result:

```json
{
  "recent_cardio_event": false,
  "status": "needs_review",
  "notes": "Live confirmed answer conflicts with post-call structured output."
}
```

This is safer than assuming the final extractor is always right.

## Testing Strategy

You need tests at several levels.

### State machine tests

For every state:

- yes transition
- no transition
- unclear transition
- clarification transition
- emergency interruption
- user hangs up

These should be unit tests.

### Transcript simulation tests

Feed the system realistic transcripts:

- direct yes/no
- rambling answer
- user volunteers future info
- user asks "what is Flomax?"
- user says "maybe"
- user contradicts earlier answer
- user has noisy audio
- user asks for medical advice

### Voice call tests

Use real or simulated calls to measure:

- latency
- interruption handling
- STT errors
- completion rate
- how often users ask clarifications
- which fields are missed
- which terms are misheard

### Regression tests

Every time you change:

- prompt
- model
- STT provider
- TTS voice
- endpointing
- state rules

rerun the same test scripts.

## Observability

Log enough to debug without leaking PHI unnecessarily.

Track:

- current state at each turn
- previous state
- transition reason
- answer classification
- confidence
- tool call success/failure
- Airtable write success/failure
- call platform event ids
- latency per step

Avoid:

- sending raw PHI to non-BAA logging tools
- logging full transcripts casually
- storing unnecessary audio forever

## Latency Trade-Offs

Every extra model call can make the voice agent slower.

A pure control-plane design might do:

- user speaks
- STT completes
- extractor LLM runs
- state machine updates
- responder LLM runs
- TTS speaks

That can add latency.

Ways to reduce it:

- use a small fast model for extraction
- use deterministic regex/rules for simple yes/no when possible
- use fixed templates for standard questions
- only use responder LLM for clarifications or more natural phrasing
- stream TTS as early as possible
- save state asynchronously after response starts when safe
- keep prompts short

For HezQ intake, many turns can be deterministic:

If the user says "yes" or "no" clearly, you do not need a large LLM to decide.

Use the LLM where language is messy.

## Example Recommended Runtime Flow with Vapi

Call starts.

Backend creates call session:

```json
{
  "call_id": "abc",
  "status": "in_progress",
  "state": "age_gate"
}
```

Agent asks first question.

User answers.

Vapi sends transcript/tool event.

Backend:

- stores transcript
- extracts answer
- updates field
- advances state
- updates Airtable partial record
- returns next question or uses live call control/tool response

Call continues.

If user asks clarification:

- backend identifies clarification
- agent explains term
- repeats current question
- state does not advance

If call drops:

- backend marks session incomplete
- Airtable shows partial intake
- human team can follow up

At end:

- Vapi sends end-of-call report
- Vapi later sends call.analysis.completed if structured data is ready
- backend reconciles final structured output with live state
- Airtable record becomes completed or needs_review

## What to Change in the Current Repo Later

This report does not make implementation changes, but a future implementation would likely add:

- `lib/intake/state-machine.ts`
- `lib/intake/fields.ts`
- `lib/intake/glossary.ts`
- `lib/intake/extract-answer.ts`
- `lib/intake/reconcile.ts`
- `app/api/vapi-webhook/route.ts` expanded to handle transcript/tool events, not only end-of-call intake
- Airtable upsert behavior keyed by call ID
- a session store
- tests for every state transition

You would also shrink the Vapi system prompt.

Instead of putting the whole clinical state machine in the prompt, the prompt would say:

"You are Alex. Follow the current instruction from the backend. Keep responses short. Do not give medical advice. If the user asks a clarification, answer briefly and return to the current question."

The backend would provide the current state and exact question.

## How Much Freedom Should the Agent Have?

Give freedom in wording.

Do not give freedom in clinical flow.

Good freedom:

- empathetic acknowledgements
- explaining terms
- saying "thank you"
- repeating a question more clearly
- handling "I did not understand"

Bad freedom:

- deciding to skip a required question
- deciding a vague answer is good enough for a hard-stop field
- deciding to approve the patient
- giving medication advice
- inventing doctor instructions
- saying it sent a text if it did not

## What About "Mixed Initiative"?

Mixed initiative means the user can influence the conversation, not just answer a form.

For HezQ, use bounded mixed initiative.

Allowed:

- clarification questions
- privacy questions
- repeat requests
- early volunteered info
- short side comments

Not allowed:

- letting the user bypass safety questions
- letting the model skip gates
- letting the model convert the call into general medical Q&A

This gives the user dignity without losing safety.

## The Best Final Answer

Use a deterministic FSM for the clinical intake itself.

Wrap it in a control plane that handles:

- state
- evidence
- confidence
- partial saving
- clarifications
- vendor events
- final reconciliation

Use the LLM for language, not for owning the whole medical flow.

Use Vapi or Retell as the voice platform. Use Pipecat only if you need deeper custom control.

Use structured outputs at the end, but do not rely on them as the only intake record.

For the current Aspargo demo, the most practical next step is:

1. Keep Vapi.
2. Add a backend call session/intake state model.
3. Add an FSM for the HezQ intake.
4. Add live partial saves to Airtable.
5. Add a glossary for medicine names and clarifications.
6. Tune STT keyterms and TTS pronunciations.
7. Keep Vapi structured outputs as final reconciliation.

## Worked Example: Complete Call

Agent: "Are you 18 or older?"

Patient: "Yes."

System:

- `age_18_or_older = true`
- status confirmed
- advance to ED symptoms
- save partial record

Agent: "Are you currently experiencing difficulty getting or maintaining an erection?"

Patient: "Yes, that's why I'm calling."

System:

- `ed_symptoms = true`
- confidence high
- advance to nitrates
- save partial record

Agent: "Are you taking any medications containing nitrates, like nitroglycerin, or using recreational drugs known as poppers?"

Patient: "What is nitroglycerin?"

System:

- clarification intent
- no state transition

Agent: "Nitroglycerin is a nitrate medicine sometimes used for chest pain. Are you taking nitroglycerin, any other nitrate medicine, or poppers?"

Patient: "No."

System:

- `uses_nitrates_or_poppers = false`
- confidence high
- advance
- save partial

Agent: "In the last 48 hours, have you taken an erectile dysfunction medication or sexual enhancement product, like Viagra, Cialis, Levitra, or Stendra?"

Patient: "I took Cialis yesterday."

System:

- `recent_ed_medications = true`
- `recent_ed_medication_details = Cialis yesterday`
- continue but flag for doctor
- save partial

Agent: "Thanks, I will flag that for the doctor. In the past six months, have you had a heart attack, a stroke, or surgery on your heart?"

Patient: "No."

System:

- save
- advance

Call continues.

If the patient hangs up later, Airtable still has a partial intake with the first several fields.

That is the core reason to build a control plane.

## Worked Example: Incomplete Call

Call reaches Step 4B.

Agent: "Have you had your blood pressure checked in the last six months, and was it in a normal range?"

Patient disconnects.

Current post-call-only architecture:

- You may get a transcript and maybe structured output.
- You may not have a clean field-level partial state.

Recommended architecture:

- Airtable already has all fields answered so far.
- Record status becomes `incomplete`.
- Missing field is `recent_normal_bp`.
- Follow-up team knows exactly where to resume.

## Worked Example: Contradiction

Patient says early:

"I do not take any meds."

Later says:

"Actually I take Flomax."

System should:

- update `high_bp_or_alpha_blockers = true`
- mark prior broad statement as superseded
- add note: patient corrected medication history
- not treat this as a failure

People correct themselves. The architecture should support that.

## Worked Example: Ambiguous Answer

Agent: "Have you had a heart attack, stroke, or heart surgery in the past six months?"

Patient: "I do not think so."

System:

- answer status: unclear
- do not advance

Agent: "To make sure the doctor gets a clear file, I need a definite answer. Was that a yes or a no?"

This is not because "one question at a time" is sacred.

It is because the doctor-facing intake needs a clear answer.

## Common Mistakes to Avoid

### Mistake 1: Treating final structured output as proof

Structured output is useful, but it is not proof that the patient actively answered every question.

Store evidence.

### Mistake 2: Letting the model own safety decisions

Do not rely only on a prompt for hard-stop logic.

### Mistake 3: Not saving partial calls

Partial calls are common in voice.

Save early and often.

### Mistake 4: Logging PHI everywhere

Debugging is important, but PHI leakage is a real risk.

### Mistake 5: Overbuilding too early

Do not jump straight to Pipecat if Vapi plus a backend state layer solves your problem.

### Mistake 6: Making the FSM too rigid

Patients ask clarifying questions. The system must handle that naturally.

## Source Notes

Research used for this report included:

- Vapi documentation on server events, tool calls, live call control, structured outputs, pronunciation dictionaries, custom keywords/keyterms, custom transcribers, and HIPAA mode.
- Retell documentation on conversation flow nodes, function nodes, code nodes, custom functions, webhooks, transcript updates, custom pronunciation, interruption sensitivity, and compliance positioning.
- Pipecat documentation on pipelines, frames, processors, transports, Deepgram STT, VAD, and modular voice agent construction.
- FDA materials and summaries around the 2026 Clinical Decision Support Software guidance.
- Voice UI design principles around cognitive load in audio-only interfaces.
- HIPAA/voice-agent compliance discussions around PHI, BAAs, logging, transcripts, encryption, and auditability.

Important public references:

- Vapi server events: https://docs.vapi.ai/server-url/events
- Vapi structured outputs: https://docs.vapi.ai/assistants/structured-outputs-quickstart
- Vapi live call control: https://docs.vapi.ai/calls/call-features
- Vapi pronunciation dictionaries: https://docs.vapi.ai/assistants/pronunciation-dictionaries
- Vapi custom keywords: https://docs.vapi.ai/customization/custom-keywords
- Vapi HIPAA: https://docs.vapi.ai/security-and-privacy/hipaa
- Retell custom functions: https://docs.retellai.com/build/conversation-flow/custom-function
- Retell function calling: https://docs.retellai.com/build/single-multi-prompt/function-calling
- Retell node functions: https://docs.retellai.com/build/conversation-flow/conversation-node-functions
- Retell webhooks: https://docs.retellai.com/features/webhook
- Retell compliance: https://docs.retellai.com/general/compliance
- Pipecat overview: https://docs.pipecat.ai/guides/learn/overview
- Pipecat Deepgram STT: https://docs.pipecat.ai/api-reference/server/services/stt/deepgram
- FDA CDS town hall: https://www.fda.gov/medical-devices/medical-devices-news-and-events/town-hall-clinical-decision-support-software-final-guidance-03112026
- FDA CDS FAQ: https://www.fda.gov/medical-devices/software-medical-device-samd/clinical-decision-support-software-frequently-asked-questions-faqs
- Voice UI cognitive load: https://www.informit.com/articles/article.aspx?p=170792

## Final Practical Decision

If you want the safest, clearest architecture for the first production version:

Build a backend control plane with an explicit FSM.

Use Vapi for voice runtime.

Use the LLM as a helper for language and extraction.

Save partial state during the call.

Use post-call structured output as a second pass, not the source of truth.

That gives you:

- natural enough calls
- controlled medical intake
- incomplete-call recovery
- doctor-facing evidence
- better auditability
- a path to Retell or Pipecat later if needed

This is the architecture I would choose for Aspargo / HezQ.
