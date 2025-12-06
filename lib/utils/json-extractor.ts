/**
 * Extract JSON from text that might be wrapped in markdown code blocks
 */
export function extractJSON(text: string): any {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  // Remove markdown code blocks (handle multiple variations)
  let cleaned = text.trim();
  
  // Remove ```json or ``` at the start (case insensitive, with optional whitespace)
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*/i, '');
  
  // Remove ``` at the end (with optional whitespace)
  cleaned = cleaned.replace(/\s*```$/i, '');
  
  // Remove any leading text before the first {
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0) {
    cleaned = cleaned.substring(firstBrace);
  }
  
  // Remove any trailing text after the last }
  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastBrace + 1);
  }
  
  // Clean up any leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // If still no JSON object found, try to find it anywhere in the text
  if (!cleaned.startsWith('{')) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
  }
  
  // Final validation - must start with { and end with }
  if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) {
    throw new Error(`No valid JSON object found in text. First 100 chars: ${text.substring(0, 100)}`);
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    // Last resort: try to extract balanced braces
    let braceCount = 0;
    let startIdx = -1;
    let endIdx = -1;
    
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (startIdx === -1) startIdx = i;
        braceCount++;
      } else if (text[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIdx !== -1) {
          endIdx = i;
          break;
        }
      }
    }
    
    if (startIdx !== -1 && endIdx !== -1) {
      try {
        return JSON.parse(text.substring(startIdx, endIdx + 1));
      } catch (e) {
        // Log the problematic content for debugging
        console.error('JSON extraction failed. Content:', text.substring(0, 200));
        throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Log the problematic content for debugging
    console.error('JSON extraction failed. Content:', text.substring(0, 200));
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

