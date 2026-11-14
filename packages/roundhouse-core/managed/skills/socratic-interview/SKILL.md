---
name: socratic-interview
description: Use when eliciting the human collaborator's objectives, constraints, or design intent through free-form Socratic interview — planning interviews (Gate 1), specification interviews, and decision interviews. Encodes the interview style demonstrated and endorsed by the human during the 2026-10-17/18 taxonomy interview.
---

# Socratic Interview

This skill teaches the free-form Socratic interview style used to elicit
objectives, constraints, and design principles from the human collaborator.
It carries the interview protocol — the opening, the one-at-a-time question
pool, the synthesis close, and the opinion-probe stance — plus the seven
style properties that make the interview work. The orchestrator conducts the
interview; this skill is the authority for how.

## When to use

- Elicitation interviews: planning (Gate 1 intent-elicitation), specification
  interviews, and decision interviews — anywhere the human's intent,
  constraints, edge cases, or design principles must surface before work.
- The interviewer is the orchestrator (or an agent the orchestrator assigns
  to interview); the human answers in free text.
- DO NOT use the `question` tool's option menus for interview questions (see
  property 2); reserve that tool for discrete gate decisions where the
  options are genuinely exhaustive (approve / request changes).

## The seven style properties (normative)

The properties below are normative. An interview that violates one is not a
Socratic interview under this skill.

### 1. Free-form conversational Q&A

The interviewer asks open-ended questions in prose and the human answers in
free text. No forms, no structured wizards, no option menus — the
conversation is the interface.

### 2. No question-tool option menus for elicitation

The `question` tool's multiple-choice prompts constrain answers and must not
be used for interview questions; reserve it for discrete gate decisions
(approve / request changes) where options are genuinely exhaustive.

### 3. One question at a time — never a volley

Present questions **one at a time**. Do not batch multiple questions in a
single turn; a volley of questions overwhelms the human collaborator.

### 4. Reflective playback between turns

Before each new question, the interviewer restates what it heard, names
emerging principles and patterns, and plays back its understanding for
correction. The playback is where shared understanding gets built.

### 5. The interviewer contributes, not just extracts

The interviewer offers observations, proposed principles, honest opinions —
and withdraws them when the human's principle reveals a better reading. (The
exemplar: the interviewer's `software-media-delivery` rename proposal was
withdrawn in favor of dissolution under the taxonomy's own nature-based
principle.)

### 6. Concrete-instance probes

Abstract design questions get grounded in real usage scenarios ("walk me
through a real installation end-to-end") — the concrete instance exposes
rules the abstract discussion misses.

### 7. Let the human's principles do the work

When the human states a principle (for example, "the prefix should indicate
what group they're in"; "org is a suffix on skills, a prefix on packages"),
apply it systematically to everything under discussion rather than re-asking
case by case.

## The interview protocol

### Opening

"I'd like to walk through the workflow with you. To make sure we capture
everything important, I'd like to ask a few questions about your objectives
and constraints."

### Core Questions (present one at a time — hard rule)

Present questions **one at a time**. Do not batch multiple questions in a
single turn; a volley of questions overwhelms the human collaborator.
The list below is a candidate pool — draw from it one question per turn,
in order, adapting to prior answers.

1. "What is the primary goal you're trying to achieve with this work?"
2. "What would constitute successful completion from your perspective?"
3. "Are there any constraints, edge cases, or use cases I should be aware of
   before proceeding?"
4. "What assumptions am I at risk of making that you know are not valid for
   your project?"

### Synthesis

After the human responds: "Thank you. I've noted these objectives/constraints.
I'll keep them in mind as we move through the workflow stages. Let me know if
anything changes."

### When the human asks "What do you think about X?"

Open dialog, don't just state opinion: "I have some thoughts, but I want to
make sure I understand your perspective first. Could you tell me: what's your
main concern about X, and what outcome would you like to see?"

## After the interview

The interview's output — objectives, constraints, principles, decisions —
feeds the artifact the interview serves (the plan draft, the specification,
the decision record). Record the human's principles as rulings in that
artifact, attributed where provenance matters. The reflective playbacks are
the interview's working record, not a deliverable.
