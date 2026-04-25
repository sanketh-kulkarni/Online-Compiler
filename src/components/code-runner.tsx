"use client";

import type { FC } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import { Play, Trash2, Download, Settings2 } from 'lucide-react'; // Added Settings2 for potential future use
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; // Added CardDescription
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { compileAndRun } from '@/services/compiler';
import type { CompilationResult } from '@/services/compiler.types'; // Import type
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils'; // Import cn utility

const languages = [
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
  { value: 'python', label: 'Python' },
  // { value: 'html', label: 'HTML' }, // HTML is part of web mode
  { value: 'web', label: 'Web (HTML/CSS/JS)' }, // Combined web option
];

// Initial code snippets for each language
const initialCode: Record<string, string> = {
  c: `#include <stdio.h>\n\nint main() {\n   printf("Hello, C!\\n");\n   return 0;\n}`,
  cpp: `#include <iostream>\n\nint main() {\n   std::cout << "Hello, C++!" << std::endl;\n   return 0;\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java!");\n    }\n}`,
  python: `print("Hello, Python!")`,
  // Web initial code is handled separately below
};

// Separate initial states for web components
const initialHtml = `<h1>Sanketh Kulkarni!</h1>
<p>Edit the HTML, CSS, and JavaScript below. The output will update live.</p>
<button>Click Me</button>`;
const initialCss = `body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  padding: 1.5rem;
  background-color: #ffffff; /* White background for output */
  color: #1f2937; /* Dark gray text */
  line-height: 1.6;
}
h1 {
  color: hsl(var(--primary)); /* Use primary color */
  border-bottom: 2px solid hsl(var(--primary) / 0.2);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}
p {
  margin-bottom: 1rem;
}
button { /* Basic button styling */
  padding: 0.5rem 1rem;
  background-color: #49ed3a;
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background-color 0.2s;
}
button:hover {
  background-color: hsl(var(--primary) / 0.9);
}`;
const initialJs = `console.log("Hello from the script!");

document.addEventListener('DOMContentLoaded', () => {
  const p = document.querySelector('p');
  if (p) {
    p.textContent = 'JavaScript successfully updated this paragraph on load!';
  }
});

// Example: Add dynamic behavior
let count = 0;
const button = document.querySelector('button');
if (button) {
  button.addEventListener('click', () => {
    count++;
    alert(\`Button clicked \${count} times!\`);
  });
}`;


export const CodeRunner: FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>(languages[0].value);
  // State for standard languages
  const [code, setCode] = useState<string>(initialCode[languages[0].value]);
  // State for web mode
  const [htmlCode, setHtmlCode] = useState<string>(initialHtml);
  const [cssCode, setCssCode] = useState<string>(initialCss);
  const [jsCode, setJsCode] = useState<string>(initialJs);

  // Output states
  const [output, setOutput] = useState<string>('');
  const [errors, setErrors] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isWebMode, setIsWebMode] = useState<boolean>(selectedLanguage === 'web');

  const { toast } = useToast();

  // Update editor content when language changes
  useEffect(() => {
    if (selectedLanguage === 'web') {
      setIsWebMode(true);
      // No need to reset code on switch *to* web, preserve user edits
      updateWebOutput(); // Generate initial preview
    } else {
      setIsWebMode(false);
      // Set code for non-web languages, clear web-specific output/errors
      setCode(initialCode[selectedLanguage] || '');
      setOutput(''); // Clear preview/output
      setErrors(null); // Clear errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage]); // updateWebOutput dependency removed

  // Update combined output for web languages (HTML, CSS, JS)
  const updateWebOutput = useCallback(() => {
    // No need to check isWebMode here, as this is only called/debounced when it's true
    const combinedHtml = `
      <!DOCTYPE html>
      <html style="height: 100%;">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Live Preview</title>
        <style>
          /* Basic reset and box-sizing */
          *, *::before, *::after { box-sizing: border-box; }
          body { margin: 0; min-height: 100%; }
          /* User CSS */
          ${cssCode}
        </style>
      </head>
      <body>
        ${htmlCode}
        <script>
          // User JS - Wrap in try-catch for basic error handling
          try {
            (function() { // IIFE to scope variables
              ${jsCode}
            })();
          } catch (e) {
            console.error("JavaScript Error:", e);
            // Display error overlay in the preview
            const errorDiv = document.createElement('div');
            errorDiv.style.position = 'fixed';
            errorDiv.style.bottom = '10px';
            errorDiv.style.left = '10px';
            errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
            errorDiv.style.color = 'white';
            errorDiv.style.padding = '10px';
            errorDiv.style.borderRadius = '5px';
            errorDiv.style.fontFamily = 'monospace';
            errorDiv.style.fontSize = '14px';
            errorDiv.style.zIndex = '10000'; // Ensure it's on top
            errorDiv.textContent = 'JS Error: ' + e.message;
            // Add to body, or shadow root if using one
            if(document.body) document.body.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 5000); // Auto-remove after 5s
          }
        </script>
      </body>
      </html>
    `;
    setOutput(combinedHtml);
    setErrors(null); // Clear backend errors for live preview
  }, [htmlCode, cssCode, jsCode]);

  // Live update for web languages with debounce
  useEffect(() => {
    if (isWebMode) {
      const debounceTimer = setTimeout(() => {
        updateWebOutput();
      }, 300); // Debounce updates
      return () => clearTimeout(debounceTimer);
    }
  }, [isWebMode, htmlCode, cssCode, jsCode, updateWebOutput]);


  const handleRunCode = useCallback(async () => {
    if (isWebMode) {
      // For web languages, the output is already live-updating.
      toast({
        title: 'Live Preview Active',
        description: 'Output updates automatically as you type.',
        duration: 3000,
      });
      return;
    }

    const currentCode = code; // Capture code state at the time of click

    if (!currentCode.trim()) {
      toast({
        title: 'Empty Code',
        description: 'Please write some code before running.',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    setOutput('⏳ Running code...');
    setErrors(null);

    try {
      console.log(`Sending code to compileAndRun: Language=${selectedLanguage}`); // Debug log
      const result: CompilationResult = await compileAndRun(selectedLanguage, currentCode);
      console.log('Received result from compileAndRun:', result); // Debug log

      setOutput(result.output || (result.errors ? '' : '✅ No output generated.')); // Show output, clear loading
      setErrors(result.errors); // Set errors if any

      if (result.errors) {
        toast({
          title: result.output ? 'Execution Finished with Errors' : 'Execution Failed',
          description: 'Check the Errors panel below the output.',
          variant: 'destructive',
        });
      } else {
         toast({
           title: 'Execution Successful',
           description: `${languages.find(l => l.value === selectedLanguage)?.label} code executed.`,
         });
      }
    } catch (error) {
      console.error('Execution failed in handleRunCode:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setOutput(''); // Clear output on failure
      setErrors(`❌ Execution failed: ${errorMessage}`);
      toast({
        title: 'Execution Failed',
        description: `An unexpected error occurred: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  }, [code, isWebMode, selectedLanguage, toast]); // Dependencies


  const handleClearCode = () => {
    if (isWebMode) {
      setHtmlCode('');
      setCssCode('');
      setJsCode('');
      // Output updates via useEffect debounce
    } else {
      setCode('');
      setOutput('');
      setErrors(null);
    }
     toast({
       title: 'Editor Cleared',
       description: 'Code and output panels have been cleared.',
       duration: 2000,
     });
  };

  const handleDownloadCode = () => {
    let content = '';
    let filename = `coderunner_code`;
    let mimeType = 'text/plain';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (isWebMode) {
      // Simple combined HTML download for web mode
      content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeRunner Web Export</title>
  <style>
${cssCode}
  </style>
</head>
<body>
${htmlCode}
  <script>
${jsCode}
  </script>
</body>
</html>`;
      filename = `coderunner_web_${timestamp}.html`;
      mimeType = 'text/html';
    } else {
       content = code;
       const langInfo = languages.find(l => l.value === selectedLanguage);
       const extensionMap: Record<string, string> = {
           c: 'c', cpp: 'cpp', java: 'java', python: 'py'
       };
       const extension = extensionMap[selectedLanguage] || 'txt';
       filename = `coderunner_${selectedLanguage}_${timestamp}.${extension}`;
       const mimeMap: Record<string, string> = {
            c: 'text/x-csrc',
            cpp: 'text/x-c++src',
            java: 'text/x-java-source',
            py: 'text/x-python',
            txt: 'text/plain',
       };
       mimeType = mimeMap[extension] || 'text/plain';
    }


    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` }); // Ensure UTF-8
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
     toast({
       title: 'Code Downloaded',
       description: `File ${filename} saved.`,
       duration: 3000,
     });
  };

  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value);
    // State update (code, isWebMode, output) is handled by useEffect
  };

   // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Use `code` property for better cross-platform compatibility
      if ((event.ctrlKey || event.metaKey) && event.code === 'Enter') {
        event.preventDefault();
        if (!isWebMode && !isRunning) { // Only run if not web mode and not already running
           handleRunCode();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunCode, isWebMode, isRunning]); // Add isWebMode and isRunning dependency


  return (
    <div className="flex flex-col h-screen bg-background text-foreground p-4 md:p-6 gap-4 overflow-hidden"> {/* Ensure overflow hidden here */}
      {/* Header Section */}
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold text-primary tracking-tight">
              CodeRunner
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select onValueChange={handleLanguageChange} value={selectedLanguage}>
            <SelectTrigger className="w-[150px] sm:w-[180px] bg-card text-card-foreground focus:ring-primary/50">
              <SelectValue placeholder="Select Language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
              onClick={handleRunCode}
              disabled={isRunning || isWebMode} // Disable run in web mode or while running
              className={cn(
                "bg-primary hover:bg-primary/90 text-primary-foreground",
                {"cursor-not-allowed opacity-50": isWebMode || isRunning} // Style disabled state
              )}
              title={isWebMode ? "Live Preview Active" : (isRunning ? "Running..." : "Run Code (Ctrl+Enter / Cmd+Enter)")}
            >
              <Play className={cn("mr-2 h-4 w-4", isRunning && "animate-spin")} />
              {isRunning ? 'Running...' : (isWebMode ? 'Live' : 'Run')}
            </Button>
          <Button onClick={handleClearCode} variant="outline" title="Clear Editor and Output">
            <Trash2 className="mr-2 h-4 w-4" /> Clear
          </Button>
          <Button onClick={handleDownloadCode} variant="outline" title="Download Code">
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
          {/* Optional Settings Button */}
          {/* <Button variant="ghost" size="icon" title="Settings">
             <Settings2 className="h-5 w-5" />
          </Button> */}
        </div>
      </header>


      {/* Main Content Area (Improved Split View) */}
      <div className="flex flex-1 flex-col md:flex-row gap-4 overflow-hidden"> {/* Ensure overflow hidden here */}

        {/* Code Editor Panel */}
        <Card className="flex flex-col flex-1 w-full md:w-1/2 border border-border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden">
           {isWebMode ? (
             // --- Web Mode Editor ---
             <>
             <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30">
                <CardTitle className="text-base sm:text-lg">Web Editor</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Edit HTML, CSS, and JavaScript. Preview updates live.</CardDescription>
             </CardHeader>
             <div className="flex flex-col flex-1 overflow-hidden"> {/* Allow vertical flex and hide overflow */}
                 {/* HTML */}
                 <div className="flex flex-col flex-1 border-b border-border min-h-[100px]"> {/* Minimum height */}
                     <label htmlFor="html-editor" className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted/20 border-b border-border">HTML</label>
                     <ScrollArea className="flex-1"> {/* Make ScrollArea expand */}
                        <Textarea
                            id="html-editor"
                            value={htmlCode}
                            onChange={(e) => setHtmlCode(e.target.value)}
                            placeholder="Write your HTML code here..."
                            className="w-full h-full p-3 font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0 bg-transparent"
                            spellCheck="false"
                            aria-label="HTML Code Editor"
                        />
                    </ScrollArea>
                 </div>
                 {/* CSS */}
                 <div className="flex flex-col flex-1 border-b border-border min-h-[100px]"> {/* Minimum height */}
                     <label htmlFor="css-editor" className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted/20 border-b border-border">CSS</label>
                    <ScrollArea className="flex-1"> {/* Make ScrollArea expand */}
                        <Textarea
                            id="css-editor"
                            value={cssCode}
                            onChange={(e) => setCssCode(e.target.value)}
                            placeholder="Write your CSS code here..."
                            className="w-full h-full p-3 font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0 bg-transparent"
                            spellCheck="false"
                            aria-label="CSS Code Editor"
                        />
                    </ScrollArea>
                 </div>
                 {/* JS */}
                 <div className="flex flex-col flex-1 min-h-[100px]"> {/* Minimum height */}
                     <label htmlFor="js-editor" className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted/20 border-b border-border">JavaScript</label>
                     <ScrollArea className="flex-1"> {/* Make ScrollArea expand */}
                        <Textarea
                            id="js-editor"
                            value={jsCode}
                            onChange={(e) => setJsCode(e.target.value)}
                            placeholder="Write your JavaScript code here..."
                            className="w-full h-full p-3 font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0 bg-transparent"
                            spellCheck="false"
                            aria-label="JavaScript Code Editor"
                        />
                    </ScrollArea>
                 </div>
             </div>
            </>
           ) : (
             // --- Standard Language Editor ---
             <>
             <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30">
                 <CardTitle className="text-base sm:text-lg">
                     {languages.find(l => l.value === selectedLanguage)?.label || 'Code'} Editor
                 </CardTitle>
                 <CardDescription className="text-xs sm:text-sm">
                     Write your {languages.find(l => l.value === selectedLanguage)?.label || 'code'} below. Press Run or Ctrl+Enter.
                 </CardDescription>
             </CardHeader>
             <CardContent className="flex-1 p-0 overflow-hidden"> {/* Prevent padding issues */}
                 <ScrollArea className="h-full w-full"> {/* Ensure ScrollArea takes full height */}
                     <Textarea
                         value={code}
                         onChange={(e) => setCode(e.target.value)}
                         placeholder={`// Write your ${languages.find(l => l.value === selectedLanguage)?.label} code here...`}
                         className="w-full min-h-[500px]  p-0 font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0 bg-card text-card-foreground"
                         spellCheck="false"
                         aria-label={`${languages.find(l => l.value === selectedLanguage)?.label || 'Code'} Editor`}
                     />
                 </ScrollArea>
             </CardContent>
            </>
           )}
        </Card>

        {/* Output Panel */}
        <Card className="flex flex-col flex-1  w-full md:w-1/2 border border-border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden">
          <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30">
            <CardTitle className="text-base sm:text-lg">Output</CardTitle>
             <CardDescription className="text-xs sm:text-sm">
               {isWebMode ? "Live preview of your HTML/CSS/JS." : "Results and errors from code execution."}
             </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden bg-muted/10"> {/* Full height, hide overflow */}
            {isWebMode ? (
               // --- Web Mode Output (Iframe) ---
               <iframe
                 srcDoc={output} // `output` state now holds the full HTML for web mode
                 title="Live Preview"
                 sandbox="allow-scripts allow-modals allow-forms allow-same-origin" // Standard sandbox permissions
                 className="w-full h-full border-0 bg-white" // White background for clarity
                 aria-label="Web Code Live Preview"
               />
            ) : (
              // --- Standard Language Output ---
              <ScrollArea className="h-full"> {/* Full height scroll */}
                {/* Errors Panel - Displayed conditionally first */}
                {errors && (
                  <div className="p-3 border-b border-destructive/30 bg-destructive/10 text-destructive">
                    <h3 className="font-semibold mb-1 text-sm">Errors:</h3>
                    <pre className="whitespace-pre-wrap text-xs sm:text-sm font-mono break-words"> {/* Allow long lines to wrap */}
                        {errors}
                    </pre>
                  </div>
                )}
                {/* Standard Output Panel */}
                <pre className={cn(
                    "p-3 whitespace-pre-wrap text-sm font-mono break-words", // Allow long lines to wrap
                    errors ? "text-muted-foreground/80" : "text-foreground", // Dim output if errors exist
                    !output && !errors && "text-muted-foreground italic" // Style placeholder
                    )}>
                  {/* Show output even if there are errors, unless output is empty */}
                  {(output || errors) ? output : 'Output will appear here...'}
                </pre>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
