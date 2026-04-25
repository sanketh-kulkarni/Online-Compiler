
/**
 * Represents the result of compiling and running code.
 */
export interface CompilationResult {
    /**
     * The standard output (stdout) from the executed code.
     */
    output: string;
    /**
     * Any errors that occurred during compilation or execution (stderr, compiler messages, etc.).
     * Null if no errors occurred.
     */
    errors: string | null;
  }
  