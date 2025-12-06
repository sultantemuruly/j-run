# Agentic AI System Setup Guide

This guide will help you set up and use the agentic AI system for SAT question generation.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **OpenAI API Key** - Get one from [OpenAI Platform](https://platform.openai.com/api-keys)
3. **SAT Materials** - PDF/DOCX files in the `data/` folder

## Environment Variables

Create a `.env.local` file in the root directory with:

```env
# OpenAI API Key (required)
OPENAI_API_KEY=your_openai_api_key_here

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_key
DATABASE_URL=your_database_url
DIRECT_URL=your_direct_url
```

## Initial Setup

### 1. Install Dependencies

All required packages are already in `package.json`. Run:

```bash
npm install
```

### 2. Initialize RAG System

Before generating questions, you need to process your SAT materials and generate embeddings:

```bash
npm run initialize-rag
```

This will:
- Process all PDF/DOCX files in `data/` folder
- Extract text and images
- Generate embeddings for semantic search
- Cache embeddings in `.cache/embeddings.json`

**Note:** This may take several minutes depending on the number of files. The embeddings are cached, so you only need to run this once (or when you add new files).

### 3. File Structure

Your `data/` folder should be structured like this:

```
data/
  ├── sat_info.docx                    # General SAT information
  ├── digital_sat_structure.docx        # SAT test structure rules
  └── samples/
      ├── math/
      │   ├── algebra/
      │   │   ├── easy.pdf
      │   │   ├── medium.pdf
      │   │   └── hard.pdf
      │   ├── advanced-math/
      │   └── ...
      └── reading-and-writing/
          ├── information-and-ideas/
          └── ...
```

## How It Works

### Agent Architecture

The system uses multiple specialized AI agents that work together:

1. **Question Picker Agent** (Practice Tests Only)
   - Selects next question based on SAT structure
   - Considers previous question history
   - Uses adaptive difficulty logic

2. **Retriever Agent** (RAG System)
   - Searches document embeddings for relevant context
   - Retrieves example questions from samples
   - Extracts rules, explanations, and instructions

3. **Question Generator Agent**
   - Generates SAT-style questions
   - Uses retrieved context and examples
   - Includes feedback loop for quality

4. **Visual Generator Agent** (Conditional)
   - Creates graphs, tables, diagrams when needed
   - Validates visual content

5. **Checking Agents**
   - Validate generated questions and visuals
   - Provide feedback for corrections
   - Ensure SAT standards compliance

### Question Generation Flow

**Custom Practice:**
```
User Request → Retriever Agent → Question Generator → Checking Agent → Output
                                    ↓ (if visual needed)
                              Visual Generator → Visual Checking Agent
```

**Practice Test:**
```
User Request → Question Picker → Retriever Agent → Question Generator → Checking Agent → Output
```

## Usage

### Custom Practice

1. Go to `/practice` page
2. Select section, topics, subtopics, and difficulties
3. Click "Start Custom Practice"
4. Answer questions and get instant feedback

### Practice Test (Coming Soon)

1. Go to `/practice` page
2. Click "Start Full-Length Test"
3. Complete the adaptive SAT test
4. Get detailed score report

## API Endpoints

### Generate Question

```bash
POST /api/questions/generate
Content-Type: application/json

{
  "section": "math" | "reading-and-writing",
  "topic": "Algebra",
  "subtopic": "Linear equations" (optional),
  "difficulty": "easy" | "medium" | "hard",
  "customContext": "optional context" (optional)
}
```

### Practice Test

```bash
POST /api/practice-test
Content-Type: application/json

# Initialize session
{
  "action": "initialize"
}

# Get next question
{
  "action": "get-next-question",
  "sessionId": "session_id"
}

# Submit answer
{
  "action": "submit-answer",
  "sessionId": "session_id",
  "questionIndex": 0,
  "userAnswer": "A",
  "timeSpent": 120
}
```

## Troubleshooting

### RAG Initialization Fails

- Check that files exist in `data/` folder
- Ensure OpenAI API key is set correctly
- Check file permissions
- Verify PDF/DOCX files are not corrupted

### Question Generation Fails

- Ensure RAG system is initialized (`npm run initialize-rag`)
- Check OpenAI API key and quota
- Verify embeddings cache exists (`.cache/embeddings.json`)
- Check server logs for detailed errors

### Slow Question Generation

- First question may take 10-30 seconds (embeddings + generation)
- Subsequent questions are faster (cached embeddings)
- Consider using `gpt-4o-mini` for faster responses (edit agent models in `lib/agents/agents/`)

## Customization

### Change AI Models

Edit agent constructors in `lib/agents/agents/`:

```typescript
constructor() {
  super('gpt-4o'); // Change to 'gpt-4o-mini' for faster/cheaper
}
```

### Adjust Validation Thresholds

Edit validation scores in:
- `lib/agents/orchestration/question-orchestrator.ts` (line 98, 150)
- `lib/agents/agents/checking-agent.ts` (line 29)

### Modify RAG Search Parameters

Edit in `lib/rag/retriever.ts`:
- `limit`: Number of chunks to retrieve (line 44)
- `minSimilarity`: Minimum similarity score (line 45)

## Performance Tips

1. **Cache Embeddings**: Always cache embeddings (default behavior)
2. **Batch Processing**: Embeddings are generated in batches of 100
3. **Use Mini Models**: For faster responses, use `gpt-4o-mini` for non-critical agents
4. **Optimize Chunk Size**: Adjust in `lib/rag/document-processor.ts` (line 23)

## Next Steps

- [ ] Implement practice test UI
- [ ] Add question history tracking
- [ ] Implement score reporting
- [ ] Add progress analytics
- [ ] Migrate to Supabase Storage (optional)
- [ ] Add vector database (Supabase pgvector or Pinecone)

## Support

For issues or questions, check:
- Server logs in terminal
- Browser console for client errors
- OpenAI API dashboard for quota/rate limits

