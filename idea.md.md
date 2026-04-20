Goal:
Build a flashcard engine that converts PDFs into high-quality flashcards using AI.

Core features:
- Upload PDF
- Extract content
- Generate flashcards (Q/A format)
- Practice mode
- Spaced repetition (basic version)

Constraints:
- Keep it simple first
- Local working version before deployment

Tech direction (initial):
- Python backend
- Simple web UI (Flask or Stream lit)

What changes have been made over time:
### Iteration 1: From Basic Flashcards → Concept-Based Cards

The initial goal was to generate simple Q/A flashcards from extracted text.

However, this approach resulted in shallow cards that focused mostly on definitions and did not support deeper understanding.

Change:

- Shift from generic Q/A cards to concept-focused flashcards

New requirements:

- Each concept should include multiple card types:
    - Definition
    - Why
    - How
    - Scenario-based questions

Reason:  
A useful learning system should not just test recall, but also understanding and application.

---

### Iteration 2: Introducing Coverage Awareness

Once concept-based cards were generated, another limitation became clear:  
the system had no way to ensure that the entire topic was covered.

Change:

- Add concept coverage tracking

New feature:

- Each concept tracks:
    - coverage percentage
    - missing areas

Reason:  
A strong learning system should not only generate content but also identify what is missing.

---

### Iteration 3: From Passive Feedback → Active Gap Filling

Initially, the system could show missing areas, but users had no way to act on them.

Change:

- Add dynamic generation for missing topics

New feature:

- “Generate Missing Cards” per concept

Reason:  
This transforms the system from passive feedback into an active learning loop where users can improve weak areas directly.

---

### Iteration 4: Improving Learning Interaction (Socratic Hints)

The original study flow allowed users to flip cards immediately to see answers, leading to passive learning.

Change:

- Introduce guided hinting before revealing answers

New feature:

- “Help me think” (Socratic hint mode)
- Provides guiding questions instead of direct answers

Reason:  
Encourages users to think through the problem before seeing the answer, improving retention and understanding.

---

### Iteration 5: From Recall → Synthesis (Boss Fight)

Flashcards tested individual concepts but did not evaluate whether the user could combine them.

Change:

- Introduce cross-concept evaluation

New feature:

- “Boss Fight” mode
- Generates real-world scenarios requiring multiple concepts

Reason:  
True understanding comes from applying multiple ideas together, not just recalling isolated facts.

---

### Iteration 6: Improving Study Flow

Initially, different modes (Full Deck, Spaced Repetition, Boss Fight) behaved independently and reset progress when switching.

Change:

- Move toward a continuous session-based learning model

New direction:

- Preserve user progress across modes
- Allow switching without losing context

Reason:  
Learning should feel continuous rather than segmented into separate workflows.

---

### Iteration 7: From Prototype UI → Product Experience

The initial version used Streamlit to quickly validate the core pipeline.

Limitation:

- Limited control over UI
- Not suitable for complex interactions or polished experience

Change:

- Transition to a split architecture:
    - Python (FastAPI) for backend processing
    - Next.js + Tailwind for frontend

New capabilities:

- Interactive study flow
- Better UI control
- Concept coverage visualization
- Seamless user experience

Reason:  
The goal shifted from validating functionality to building a usable product.