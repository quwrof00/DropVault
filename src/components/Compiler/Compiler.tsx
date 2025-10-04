import { useState } from "react";
import axios from "axios";

const languageMap: { [key: string]: number } = {
  c: 50,
  cpp: 54,
  java: 62,
  javascript: 63,
  python: 71,
};

export default function Compiler({
  code,
  language,
  // onCompileStart,
  // onCompileEnd,
}: {
  code: string;
  language: string;
  onCompileStart: () => void;
  onCompileEnd: () => void;
}) {
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const runCode = async () => {
    if (!code.trim()) {
      setOutput("Code is empty.");
      return;
    }

    if (!languageMap[language]) {
      setOutput(`Unsupported language: ${language}`);
      return;
    }

    setLoading(true);
    setOutput("");

    try {
      const { data: result } = await axios.post(
        "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true",
        {
          source_code: code,
          language_id: languageMap[language],
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-RapidAPI-Key": import.meta.env.VITE_JUDGE0_API_KEY,
            "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
          },
        }
      );

      if (result.stdout) {
        setOutput(result.stdout.trim());
      } else if (result.stderr) {
        setOutput(`Error:\n${result.stderr.trim()}`);
      } else if (result.compile_output) {
        setOutput(`Compilation Error:\n${result.compile_output.trim()}`);
      } else {
        setOutput("No output.");
      }
    } catch (err: any) {
      console.error("Error running code:", err);
      setOutput(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to run code. Check your API key or quota."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 border-t pt-4">
      <div className="flex gap-4 mb-2">
        <button
          onClick={runCode}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Running..." : "Run Code"}
        </button>
      </div>

      <pre className="bg-gray-100 p-4 rounded min-h-[100px] whitespace-pre-wrap">
        {loading ? "Compiling..." : output}
      </pre>
    </div>
  );
}
