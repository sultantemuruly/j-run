# Quick Setup Checklist

## ✅ Step 1: Add OpenAI API Key

Create `.env.local` file in the root directory:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Get your API key:** https://platform.openai.com/api-keys

---

## ✅ Step 2: Verify Dependencies

Dependencies are already installed! ✅

If you need to reinstall:
```bash
npm install
```

---

## ✅ Step 3: Initialize RAG System

**This is the most important step!** This processes your SAT materials:

```bash
npm run initialize-rag
```

**What this does:**
- Processes all PDF/DOCX files in `data/` folder
- Extracts text and **images** (tables, graphs, diagrams from DOCX files)
- Stores images in `.cache/images/` directory
- Generates embeddings for semantic search
- Caches results in `.cache/embeddings.json` and `.cache/images/index.json`

**Time:** This may take 5-15 minutes depending on:
- Number of files
- File sizes
- Number of images in documents
- OpenAI API rate limits

**Note:** 
- You only need to run this once (or when you add new files)
- Images from DOCX files are automatically extracted and stored
- PDF images are not extracted (PDFs are processed as text-only)

---

## ✅ Step 4: Start Development Server

```bash
npm run dev
```

Then open: http://localhost:3000

---

## ✅ Step 5: Test the System

1. **Login/Signup** at http://localhost:3000
2. Go to **Practice** page
3. Select:
   - Section (Math or Reading & Writing)
   - Topics (auto-selected, deselect what you don't want)
   - Subtopics (optional)
   - Difficulties (Easy, Medium, Hard)
4. Click **"Start Custom Practice"**
5. Wait for question generation (10-30 seconds for first question)
6. Answer and see results!

---

## 🐛 Troubleshooting

### "OPENAI_API_KEY is not defined"
- Make sure `.env.local` exists in root directory
- Check that the key starts with `sk-`
- Restart the dev server after adding the key

### "Failed to generate question"
- Make sure you ran `npm run initialize-rag` first
- Check that `.cache/embeddings.json` exists
- Check server logs for detailed errors

### "No cache found" during initialization
- This is normal for first run
- The system will generate embeddings and cache them
- Images will also be extracted and stored in `.cache/images/`

### Slow question generation
- First question: 10-30 seconds (normal)
- Subsequent questions: 5-15 seconds
- This is due to AI generation + validation

### RAG initialization fails
- Check that files exist in `data/` folder
- Verify PDF/DOCX files are not corrupted
- Check OpenAI API quota/rate limits

---

## 📁 Expected File Structure

```
data/
  ├── sat_info.docx                    ✅ Should exist
  ├── digital_sat_structure.docx       ✅ Should exist
  └── samples/
      ├── math/
      │   ├── algebra/
      │   │   ├── easy.pdf
      │   │   ├── medium.pdf
      │   │   └── hard.pdf
      │   └── ...
      └── reading-and-writing/
          └── ...
```

---

## 🎯 Next Steps After Setup

- [ ] Test custom practice questions
- [ ] Try different topics and difficulties
- [ ] Check question quality and adjust validation thresholds if needed
- [ ] Implement practice test UI (currently just API ready)

---

## 💡 Tips

1. **First run is slowest** - embeddings are generated once and cached
2. **Images are auto-extracted** - All images from DOCX files are stored automatically
3. **Check OpenAI dashboard** - monitor API usage and costs
4. **Adjust models** - Use `gpt-4o-mini` for faster/cheaper responses (edit in `lib/agents/agents/`)
5. **Cache locations**:
   - Embeddings: `.cache/embeddings.json` (gitignored)
   - Images: `.cache/images/` (gitignored, except index.json)
6. **Visual generation** - The system uses your actual image examples to generate visuals

---

## 📚 More Info

See `AGENT_SYSTEM_SETUP.md` for detailed documentation.

