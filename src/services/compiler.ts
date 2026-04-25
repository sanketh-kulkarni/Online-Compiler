'use server';

import type { CompilationResult } from './compiler.types'; // Separate types

// --- Judge0 Configuration ---
// IMPORTANT: Store these in environment variables (e.g., .env.local for development)
// Get your RapidAPI key for Judge0 CE: https://rapidapi.com/judge0-official/api/judge0-ce/
// You need to create a .env.local file in the root of your project and add the following:
//
// JUDGE0_API_KEY=YOUR_RAPIDAPI_KEY_HERE
// NEXT_PUBLIC_JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
// NEXT_PUBLIC_JUDGE0_API_HOST=judge0-ce.p.rapidapi.com
//
// For deployment (e.g., Vercel, Netlify), set these as environment variables in your hosting provider's dashboard.

const JUDGE0_API_URL = process.env.NEXT_PUBLIC_JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY; // Read directly from process.env
const JUDGE0_API_HOST = process.env.NEXT_PUBLIC_JUDGE0_API_HOST || 'judge0-ce.p.rapidapi.com';

// Judge0 Language IDs (Map your app's language values to Judge0 IDs)
// Find more IDs: https://judge0.com/docs/api/languages/all
const languageIdMap: Record<string, number> = {
  c: 50,    // C (GCC 9.2.0)
  cpp: 54,  // C++ (GCC 9.2.0)
  java: 62, // Java (OpenJDK 13.0.1)
  python: 71, // Python (3.8.1)
  // web mode is client-side only, no backend compilation needed via Judge0
};

// Judge0 Status IDs and Descriptions
// https://judge0.com/docs/api/submissions/statuses
const statusDescriptions: Record<number, string> = {
  1: 'In Queue',
  2: 'Processing',
  3: 'Accepted', // Successfully executed
  4: 'Wrong Answer', // Specific to competitive programming, treat as output
  5: 'Time Limit Exceeded',
  6: 'Compilation Error',
  7: 'Runtime Error (SIGSEGV)',
  8: 'Runtime Error (SIGXFSZ)',
  9: 'Runtime Error (SIGFPE)',
  10: 'Runtime Error (SIGABRT)',
  11: 'Runtime Error (NZEC - Non-Zero Exit Code)',
  12: 'Runtime Error (Other)',
  13: 'Internal Error', // Judge0 server error
  14: 'Exec Format Error',
};


/**
 * Compiles and runs code using the Judge0 API.
 *
 * @param language The programming language value (e.g., 'c', 'python').
 * @param code The source code to execute.
 * @returns A promise that resolves to a CompilationResult object.
 */
export async function compileAndRun(
  language: string,
  code: string
): Promise<CompilationResult> {
  console.log(`Executing code for language: ${language} via Judge0`);

  if (language === 'web') {
    // Web mode is client-side only
    return {
      output: 'Live preview is handled client-side.',
      errors: null,
    };
  }

  // --- API Key Check ---
  if (!JUDGE0_API_KEY) {
     console.error('Judge0 API Key not configured.');
     return {
        output: '',
        errors: 'Compiler service not configured. The Judge0 API Key is missing or invalid. Please set the JUDGE0_API_KEY environment variable in your .env.local file or deployment settings. Refer to src/services/compiler.ts for details.',
     };
   }


  const languageId = languageIdMap[language];
  if (!languageId) {
    console.error(`Unsupported language: ${language}`);
    return {
      output: '',
      errors: `Unsupported language: ${language}. Please select a supported language.`,
    };
  }


  try {
    // 1. Create Submission
    console.log('Creating Judge0 submission...');
    const createResponse = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=false`, {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': JUDGE0_API_KEY,
        'X-RapidAPI-Host': JUDGE0_API_HOST,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language_id: languageId,
        source_code: code,
        // stdin: '', // Add standard input if needed
      }),
      // Increase timeout if needed, though polling handles long execution
      // next: { revalidate: 0 } // Ensure no caching for API calls
    });

    if (!createResponse.ok) {
      const errorBody = await createResponse.text();
      console.error(`Judge0 submission creation failed: ${createResponse.status}`, errorBody);
      // Provide more context from the response if possible
      let detail = errorBody;
      try {
        const jsonError = JSON.parse(errorBody);
        detail = jsonError.message || jsonError.error || errorBody;
      } catch { /* Ignore if body is not JSON */ }

      // Specific check for 401/403 Unauthorized/Forbidden, likely bad API key
      if (createResponse.status === 401 || createResponse.status === 403) {
         return {
            output: '',
            errors: `Compiler service authentication failed (Status ${createResponse.status}). Please check if the JUDGE0_API_KEY in your .env.local file is correct and active on RapidAPI. Server response: ${detail}`
         }
      }

      return {
        output: '',
        errors: `Failed to create code submission (Status ${createResponse.status}). Server response: ${detail}`,
      };
    }

    const { token } = await createResponse.json();
    if (!token) {
      console.error('Judge0 submission token not received.');
      return { output: '', errors: 'Failed to get submission token from compiler service.' };
    }
    console.log(`Judge0 submission created with token: ${token}`);


    // 2. Poll for Result
    let attempts = 0;
    const maxAttempts = 15; // ~15 seconds max wait time (adjust as needed)
    const pollDelay = 1000; // 1 second

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Polling Judge0 submission (${attempts}/${maxAttempts})...`);

      await new Promise(resolve => setTimeout(resolve, pollDelay)); // Wait before polling

      const getResponse = await fetch(`${JUDGE0_API_URL}/submissions/${token}?base64_encoded=false&fields=stdout,stderr,status_id,compile_output,message,time,memory,status`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': JUDGE0_API_KEY,
          'X-RapidAPI-Host': JUDGE0_API_HOST,
        },
        // next: { revalidate: 0 } // Ensure no caching for API calls
      });

      if (!getResponse.ok) {
         const errorBody = await getResponse.text();
         console.warn(`Judge0 polling failed (attempt ${attempts}): ${getResponse.status}`, errorBody);
         // Consider breaking if it's a persistent client error (e.g., 401 Unauthorized)
         if (getResponse.status === 401 || getResponse.status === 403) {
             return { output: '', errors: `Compiler service authentication failed during polling (Status ${getResponse.status}). Check your API key.` };
         }
         if (getResponse.status === 404) {
             return { output: '', errors: `Submission token not found during polling (Status ${getResponse.status}). It might have expired or is invalid.` };
         }
        // Otherwise, retry (could be temporary server issue)
        continue;
      }

      const result = await getResponse.json();
      const statusId = result.status?.id;

      console.log('Judge0 poll result:', result);

      // Check if processing is finished (status ID > 2 means done)
      if (statusId > 2) {
        // Decode outputs safely - Judge0 might return base64 or plain text
        const stdout = result.stdout ? decodeOutput(result.stdout) : null;
        const stderr = result.stderr ? decodeOutput(result.stderr) : null;
        const compileOutput = result.compile_output ? decodeOutput(result.compile_output) : null;
        const message = result.message ? decodeOutput(result.message) : null; // General message from Judge0
        const statusDescription = result.status?.description || statusDescriptions[statusId] || 'Unknown Status';

        let errors: string | null = null;

        if (statusId === 6) { // Compilation Error
          errors = `Compilation Error:\n${compileOutput || stderr || message || 'No details provided.'}`;
        } else if (statusId > 3 && statusId !== 4) { // Runtime Error, TLE, Internal Error, etc. (Exclude Wrong Answer if treating as output)
          errors = `Execution Error (${statusDescription}):\n${stderr || message || 'No details provided.'}`;
          // Include stdout as well, as it might contain partial output before error
        } else if (stderr) {
            // Even with status 3 (Accepted) or 4 (Wrong Answer), there might be stderr output (e.g., warnings)
            // Combine with existing errors if any
            const stderrMessage = `Standard Error Output:\n${stderr}`;
            errors = errors ? `${errors}\n\n${stderrMessage}` : stderrMessage;
        }

        // Construct final output
        // If Accepted (3) or Wrong Answer (4), stdout is the primary output.
        // If Error (>= 5), stdout might still be relevant (partial output).
        let finalOutput = stdout || '';
        if (!finalOutput && !errors && statusId === 3) {
            finalOutput = '✅ Execution successful, no output generated.';
        }


        console.log(`Judge0 Execution Finished. Status: ${statusDescription}`);
        return {
          output: finalOutput,
          errors: errors,
          // Optionally return time and memory usage
          // time: result.time,
          // memory: result.memory,
        };
      }
      // If status is 1 (In Queue) or 2 (Processing), continue polling
    }

    // If loop finishes without result
    console.error('Judge0 execution timed out after polling.');
    return { output: '', errors: 'Execution timed out. The code took too long to process or the compiler service is busy.' };

  } catch (error) {
    console.error('Error communicating with Judge0 API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      output: '',
      errors: `Failed to communicate with the compiler service: ${errorMessage}`,
    };
  }
}


// Helper function to decode base64 or return plain text
function decodeOutput(encoded: string | null | undefined): string | null {
  if (!encoded) return null;
  try {
    // Attempt to decode base64
    // Check if it looks like base64 first (optional, basic check)
    if (/^[A-Za-z0-9+/=]+$/.test(encoded) && encoded.length % 4 === 0) {
       const decoded = atob(encoded);
       // Check if the decoded string contains non-printable characters, might indicate it wasn't base64
       // This check is imperfect but can help in some cases
       // eslint-disable-next-line no-control-regex
       if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(decoded)) {
          // console.warn("Decoded string contains non-printable characters, treating as plain text:", encoded);
          return encoded; // Assume it wasn't base64 if weird chars found
       }
       return decoded;
    }
    return encoded; // Assume it's plain text if it doesn't look like base64
  } catch (e) {
    // If atob fails, it's likely not base64
    // console.warn("Failed to decode base64 string, returning as is:", encoded, e);
    return encoded; // Return the original string if decoding fails
  }
}
