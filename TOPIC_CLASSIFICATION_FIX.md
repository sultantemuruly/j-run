# Topic/Subtopic Classification Fix

## Problem Analysis

### Issues Identified:
1. **Topic Mismatch**: Questions generated for "Geometry and Trigonometry" were actually Algebra questions (e.g., slope calculation)
2. **Subtopic Display Error**: Showing "Lines" instead of "Lines, angles, and triangles"
3. **No Topic Validation**: System wasn't verifying that generated questions match requested topics
4. **Metadata Confusion**: Displaying folder names instead of display names

### Root Causes:
1. **No Topic Enforcement**: Question generator wasn't strictly enforcing topic alignment
2. **No Topic Validation**: Validator wasn't checking if question matches requested topic
3. **Poor Subtopic Extraction**: Using simple pattern matching that finds partial matches
4. **Metadata Mapping**: Not converting folder names to display names

## Solution Implemented

### 1. Topic Classification System (`lib/utils/topic-classifier.ts`)
- **Complete topic/subtopic mappings** for all Math and Reading & Writing topics
- **Programmatic topic classification** based on question content
- **Topic validation** to verify questions match requested topics
- **Folder ↔ Display name conversion** functions

### 2. Enhanced Question Generator Prompt
- **Explicit topic requirements** with examples
- **Available subtopics listed** for reference
- **Strict warnings** about topic alignment
- **Clear examples** of what belongs to each topic

### 3. Topic Validation in Question Validator
- **Programmatic topic check** before AI validation
- **Automatic topic classification** of generated question
- **Mismatch detection** with specific error messages
- **Score penalty** for topic mismatches (caps at 0.3)
- **Forced regeneration** if topic doesn't match

### 4. Metadata Display Fix
- **Folder → Display name conversion** for topics
- **Proper subtopic display** using requested subtopic
- **Fallback classification** if subtopic not provided
- **Capitalized difficulty** display

## How It Works

### Topic Classification:
1. Analyzes question text for topic-specific keywords
2. Matches against known topic patterns
3. Returns classified topic, subtopic, and confidence score
4. Used for validation and metadata

### Validation Flow:
1. Question generated
2. **Topic validator checks** if question matches requested topic
3. If mismatch → **Critical error**, score capped at 0.3, forced regeneration
4. AI validator also checks topic alignment
5. Both must pass for question to be accepted

### Metadata Flow:
1. Request comes in with folder names (e.g., "geometry-and-trigonometry")
2. Converted to display names (e.g., "Geometry and Trigonometry")
3. Subtopic preserved from request (already in display format)
4. Displayed correctly in UI

## Topic Mappings

### Math Topics:
- `algebra` → "Algebra"
  - Subtopics: Linear equations, Linear functions, Systems, Inequalities
- `geometry-and-trigonometry` → "Geometry and Trigonometry"
  - Subtopics: Area and volume formulas, **Lines, angles, and triangles**, Right triangles, Circles
- `advanced-math` → "Advanced Math"
  - Subtopics: Equivalent expressions, Nonlinear equations, Nonlinear functions
- `problem-solving-and-data-analysis` → "Problem-Solving and Data Analysis"
  - Subtopics: Ratios, Percentages, Probability, Data analysis, etc.

### Reading & Writing Topics:
- All 4 domains with their subtopics properly mapped

## Expected Results

1. **No more topic mismatches**: Questions will match requested topics
2. **Correct subtopic display**: Shows full subtopic name (e.g., "Lines, angles, and triangles")
3. **Automatic correction**: System will regenerate if topic doesn't match
4. **Better metadata**: Display names instead of folder names

## Testing

Generate questions for:
- Geometry and Trigonometry → Should get geometry/trig questions
- Algebra → Should get algebra questions
- Check subtopic display → Should show full subtopic names

