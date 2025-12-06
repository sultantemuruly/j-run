# Agentic AI System Design for SAT Question Generation

## Architecture Overview

Based on the provided flowchart, we'll implement a multi-agent system using OpenAI Agents SDK with the following components:

### Agent Hierarchy

1. **Question Picker Agent** (Practice Tests Only)
   - Selects next question based on SAT structure rules
   - Considers previous question history
   - Uses `digital_sat_structure.docx` for rules
   - Output: Section, topic, subtopic, difficulty

2. **Retriever Agent** (RAG System)
   - Queries document embeddings from `sat_info.docx`
   - Retrieves example questions from samples folder
   - Extracts relevant context and examples
   - Output: Rules, explanations, instructions, examples

3. **Question Generator Agent**
   - Generates textual question and answers
   - Uses retrieved context and examples
   - Handles feedback loop from Checking Agent
   - Output: Question text, answer choices, correct answer

4. **Visual Generator Agent** (Conditional)
   - Generates graphs, tables, diagrams when needed
   - Uses examples from samples
   - Handles feedback loop from Visual Checking Agent
   - Output: Image/visual representation

5. **Checking Agent (Content)**
   - Validates generated question against SAT standards
   - Checks alignment with provided data
   - Provides feedback for corrections
   - Output: Validation result + correction instructions

6. **Checking Agent (Visual)**
   - Validates generated visuals
   - Ensures visual matches question context
   - Provides feedback for corrections
   - Output: Validation result + correction instructions

## Data Flow

### Custom Practice Flow
```
User Request → Retriever Agent → Question Generator Agent → Checking Agent → Output
                                    ↓ (if visual needed)
                              Visual Generator Agent → Visual Checking Agent → Output
```

### Practice Test Flow
```
User Request → Question Picker Agent → Retriever Agent → Question Generator Agent → Checking Agent → Output
                                        ↓ (if visual needed)
                                  Visual Generator Agent → Visual Checking Agent → Output
```

## Implementation Stages

### Stage 1: Foundation (File Processing & RAG)
- PDF/DOCX text extraction
- Image extraction from documents
- Document chunking
- Embedding generation and storage
- Semantic search implementation

### Stage 2: Agent Tools
- File reader tool (accesses local files)
- Example retriever tool (searches samples folder)
- Question validator tool
- Visual validator tool

### Stage 3: Core Agents
- Retriever Agent (RAG queries)
- Question Generator Agent
- Visual Generator Agent
- Checking Agents

### Stage 4: Orchestration
- Agent handoffs
- Feedback loops
- Guardrails for quality
- Error handling

### Stage 5: Integration
- API routes for question generation
- Practice test session management
- Timing system
- Question history tracking

## File Structure

```
lib/
  agents/
    tools/
      file-reader.ts
      example-retriever.ts
      question-validator.ts
      visual-validator.ts
    agents/
      question-picker-agent.ts
      retriever-agent.ts
      question-generator-agent.ts
      visual-generator-agent.ts
      checking-agent.ts
      visual-checking-agent.ts
    orchestration/
      question-orchestrator.ts
      practice-test-orchestrator.ts
  rag/
    document-processor.ts
    embedding-service.ts
    vector-store.ts
    retriever.ts
  utils/
    file-extractor.ts
    image-processor.ts
```

## Environment Variables Needed

```env
OPENAI_API_KEY=your_key_here
# Optional: For vector DB (if not using in-memory)
# VECTOR_DB_URL=...
```

