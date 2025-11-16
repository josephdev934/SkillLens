// src/app/analyze/page.tsx
"use client";

import { useState, useMemo } from "react";
import axios from "axios";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  BookOpen,
  Download,
  Clipboard,
  RefreshCw,
} from "lucide-react";

// --- Type Definitions ---
interface AnalysisResult {
  requiredSkills: string[];
  missingSkills: string[];
  technicalSkills: string[];
  softSkills: string[];
}

// --- Stat Card Component ---
const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode }> = ({
  title,
  value,
  icon,
}) => (
  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-inner flex flex-col items-center transition-shadow hover:shadow-lg">
    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center">
      {icon}
      <span className="ml-1">{title}</span>
    </div>
    <div className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">{value}</div>
  </div>
);

// --- Helper: normalize strings ---
const normalize = (str: string) =>
  str.trim().toLowerCase().replace(/[\.\-\s]/g, "");

export default function AnalyzePage() {
  const [jobDescription, setJobDescription] = useState("");
  const [userSkills, setUserSkills] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // --- API call & analysis ---
  const handleAnalyze = async () => {
    if (!jobDescription || !userSkills) {
      setError("Please fill in both fields before analyzing.");
      return;
    }
    setError(null);
    setLoading(true);
    setAnalysis(null);

    try {
      const res = await axios.post("/api/jobs", {
        jobDescription,
        userSkills: userSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });

      if (res.data && Array.isArray(res.data.requiredSkills) && Array.isArray(res.data.missingSkills)) {
        const userSkillsArray = userSkills.split(",").map(normalize);
        const matchedSkills: string[] = [];
        const missingSkills: string[] = [];

        res.data.requiredSkills.forEach((skill: string) => {
          const normSkill = normalize(skill);
          const isMatched = userSkillsArray.some(
            (userSkill) => userSkill.includes(normSkill) || normSkill.includes(userSkill)
          );
          if (isMatched) matchedSkills.push(skill);
          else missingSkills.push(skill);
        });

        const technicalKeywords = [
          "html","css","javascript","typescript","react","angular","vue","svelte","node","express","api","sql",
          "postgres","mysql","mongodb","redis","docker","kubernetes","aws","gcp","azure","git","webpack","vite",
          "next","nestjs"
        ];
        const technicalSkills: string[] = [];
        const softSkills: string[] = [];

        res.data.requiredSkills.forEach((skill: string) => {
          const lower = skill.toLowerCase();
          if (technicalKeywords.some((kw) => lower.includes(kw))) technicalSkills.push(skill);
          else softSkills.push(skill);
        });

        setAnalysis({
          requiredSkills: res.data.requiredSkills,
          missingSkills,
          technicalSkills,
          softSkills,
        });
      } else {
        setError("API returned an unexpected data format.");
      }
    } catch (err) {
      console.error(err);
      setError("Analysis failed. Check server console/network tab.");
    }
    setLoading(false);
  };

  // --- Computed ---
  const matchedSkills = useMemo(() => {
    if (!analysis) return [];
    return analysis.requiredSkills.filter((skill) => !analysis.missingSkills.includes(skill));
  }, [analysis]);

  const matchPercentage = useMemo(() => {
    if (!analysis || analysis.requiredSkills.length === 0) return 0;
    return Math.round((matchedSkills.length / analysis.requiredSkills.length) * 100);
  }, [analysis, matchedSkills]);

  const technicalMatchPercentage = useMemo(() => {
    if (!analysis || analysis.technicalSkills.length === 0) return 0;
    const matchedTech = matchedSkills.filter((s) => analysis.technicalSkills.includes(s)).length;
    return Math.round((matchedTech / analysis.technicalSkills.length) * 100);
  }, [analysis, matchedSkills]);

  const softMatchPercentage = useMemo(() => {
    if (!analysis || analysis.softSkills.length === 0) return 0;
    const matchedSoft = matchedSkills.filter((s) => analysis.softSkills.includes(s)).length;
    return Math.round((matchedSoft / analysis.softSkills.length) * 100);
  }, [analysis, matchedSkills]);

  const readinessScore = useMemo(() => {
    if (!analysis) return 0;
    const score = Math.round(matchPercentage * 0.6 + technicalMatchPercentage * 0.3 + softMatchPercentage * 0.1);
    return Math.max(0, Math.min(100, score));
  }, [analysis, matchPercentage, technicalMatchPercentage, softMatchPercentage]);

  const readinessTip = useMemo(() => {
    if (!analysis) return "";
    if (readinessScore >= 80) return "Great match! Focus on polishing soft skills and system design to stand out.";
    if (readinessScore >= 60) return "You're in a good place — prioritize framework depth and APIs, then pick a couple of missing tools.";
    if (readinessScore >= 40) return "You have the basics. Focus on core frameworks, REST/GraphQL, and one database.";
    return "Large gaps detected. Start with fundamentals (HTML/CSS/JS) and a single stack (e.g., React + Node).";
  }, [analysis, readinessScore]);

  const topSuggested = useMemo(() => {
    if (!analysis) return [];
    const importanceWords = ["must", "required", "need", "essential", "strong", "experience", "proficiency", "proven"];
    const ranked: { skill: string; score: number }[] = [];

    analysis.missingSkills.forEach((skill) => {
      const lowerJD = jobDescription.toLowerCase();
      const skillLower = skill.toLowerCase();
      let score = 0;
      importanceWords.forEach((word) => {
        if (lowerJD.includes(`${word} ${skillLower}`) || lowerJD.includes(`${word} with ${skillLower}`)) score += 5;
      });
      const occurrences = (lowerJD.match(new RegExp(skillLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      score += occurrences * 2;
      ranked.push({ skill, score });
    });

    ranked.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, 5).map((r) => r.skill);
    if (top.length < 5) {
      const remaining = analysis.missingSkills.filter((s) => !top.includes(s)).slice(0, 5 - top.length);
      return [...top, ...remaining];
    }
    return top;
  }, [analysis, jobDescription]);

  const learningRoadmap = useMemo(() => {
    if (!analysis) return [];
    const roadmap: string[] = [];
    const lowerMissing = analysis.missingSkills.map((s) => s.toLowerCase());
    const hasHTMLorCSSorJS = lowerMissing.some((s) => s.includes("html") || s.includes("css") || s.includes("javascript") || s.includes("typescript"));
    const hasFramework = lowerMissing.some((s) => s.includes("react") || s.includes("angular") || s.includes("vue") || s.includes("next") || s.includes("svelte"));
    const hasBackend = lowerMissing.some((s) => s.includes("node") || s.includes("express") || s.includes("api") || s.includes("sql") || s.includes("mongodb"));
    const hasTools = lowerMissing.some((s) => s.includes("git") || s.includes("docker") || s.includes("aws") || s.includes("azure"));
    const hasSoft = analysis.missingSkills.some((s) => s.toLowerCase().includes("communication") || s.toLowerCase().includes("team") || s.toLowerCase().includes("collaboration"));

    if (hasHTMLorCSSorJS) roadmap.push("1. Core fundamentals — HTML, CSS, and JavaScript (build small projects).");
    if (hasFramework) roadmap.push("2. Learn a modern framework — React/Next.js and state management (Redux/Zustand).");
    if (hasBackend) roadmap.push("3. Backend basics — Build RESTful APIs with Node/Express and practice with a database.");
    if (hasTools) roadmap.push("4. Developer tools — Git, Docker, and basic cloud deployment.");
    if (hasSoft) roadmap.push("5. Soft skills — communication, teamwork, documenting your work (README/comments).");
    if (roadmap.length === 0) roadmap.push("1. Start with core JS + one framework, 2. Build CRUD app + DB, 3. Learn Git & deployment.");
    return roadmap;
  }, [analysis]);

  const handleCopySummary = async () => {
    if (!analysis) {
      setToast("No analysis to copy");
      setTimeout(() => setToast(null), 2000);
      return;
    }
    const summary: string[] = [];
    summary.push(`SkillLens analysis for job (summary)`);
    summary.push(`Match: ${matchPercentage}% | Readiness score: ${readinessScore}/100`);
    summary.push("");
    summary.push("Matched skills:");
    matchedSkills.forEach((s) => summary.push(` - ${s}`));
    summary.push("");
    summary.push("Top missing skills (important):");
    topSuggested.forEach((s) => summary.push(` - ${s}`));
    summary.push("");
    summary.push("Suggested roadmap:");
    learningRoadmap.forEach((r) => summary.push(` - ${r}`));

    try {
      await navigator.clipboard.writeText(summary.join("\n"));
      setToast("Summary copied to clipboard");
      setTimeout(() => setToast(null), 2000);
    } catch (e) {
      console.error("copy failed", e);
      setToast("Copy failed");
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleDownload = () => {
    setToast("PDF export coming soon (demo).");
    setTimeout(() => setToast(null), 2000);
  };

  const handleReset = () => {
    setJobDescription("");
    setUserSkills("");
    setAnalysis(null);
    setError(null);
    setToast("Reset done");
    setTimeout(() => setToast(null), 1200);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen text-white">
      <h1 className="text-4xl font-extrabold mb-8 text-center">SkillLens Job Analyzer</h1>
      <h2 className="text-lg md:text-xl text-gray-400 text-center mb-6">
      Analyze your skills against any job description and get a clear readiness score
      </h2>


      {/* Input Area */}
      <div className="space-y-4 mb-8 p-6 rounded-lg shadow-inner bg-black">
        <textarea
          className="w-full p-4 border rounded bg-black text-white"
          placeholder="Paste job description here..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={6}
        />
        <input
          className="w-full p-4 border rounded bg-black text-white placeholder-gray-500"
          placeholder="Your skills, comma-separated (e.g., React, Node.js, Python)"
          value={userSkills}
          onChange={(e) => setUserSkills(e.target.value)}
        />
        <div className="flex gap-3">
          <button
            className="flex-1 w-full text-white font-semibold px-6 py-3 rounded-lg transition disabled:opacity-60 items-center justify-center"
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze Skills"
            )}
          </button>
          <button
            className="px-4 py-3 rounded-lg bg-gray-800 flex items-center gap-2"
            onClick={handleReset}
            title="Reset"
          >
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 mb-6 text-red-700 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900 dark:text-red-300">
          Error: {error}
        </div>
      )}

      {/* Analysis Dashboard */}
      {analysis && (
        <div className="p-6 rounded-xl shadow-2xl border">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-yellow-400" />
              <div>
                <h2 className="text-2xl font-bold text-blue-300">Skill Match Summary</h2>
                <div className="text-sm text-gray-400">{readinessTip}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-blue-400">{matchPercentage}%</div>
              <div className="text-sm text-gray-400">Match</div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6 text-center">
            <StatCard title="Total Skills" value={analysis.requiredSkills.length} icon={<Zap className="w-5 h-5 text-gray-500" />} />
            <StatCard title="Skills Matched" value={matchedSkills.length} icon={<CheckCircle className="w-5 h-5 text-green-500" />} />
            <StatCard title="Skills Missing" value={analysis.missingSkills.length} icon={<XCircle className="w-5 h-5 text-red-500" />} />
          </div>

          {/* Readiness Score */}
          <div className="mb-6 p-4 rounded bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-300">Job Readiness Score</div>
                <div className="text-2xl font-bold text-white">{readinessScore}/100</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-300">Technical: {technicalMatchPercentage}%</div>
                <div className="text-sm text-gray-300">Soft: {softMatchPercentage}%</div>
              </div>
            </div>
            <div className="mt-4 bg-gray-700 h-3 rounded overflow-hidden">
              <div
                className="h-3 bg-green-500 transition-all duration-400"
                style={{ width: `${readinessScore}%` }}
              />
            </div>
            {/* Tech / Soft bars */}
            <div className="mt-2 space-y-1">
              <div className="text-sm text-gray-300">Technical Match</div>
              <div className="bg-gray-700 h-2 rounded">
                <div className="bg-blue-500 h-2" style={{ width: `${technicalMatchPercentage}%` }} />
              </div>
              <div className="text-sm text-gray-300">Soft Skills Match</div>
              <div className="bg-gray-700 h-2 rounded">
                <div className="bg-purple-500 h-2" style={{ width: `${softMatchPercentage}%` }} />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3 text-blue-300">Technical Skills</h3>
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-2 rounded">
              {analysis.technicalSkills.map((skill) => (
                <span
                  key={skill}
                  title={matchedSkills.includes(skill) ? "You already have this skill" : "Missing skill — recommended to learn"}
                  className={`inline-flex items-center gap-1 px-3 py-1 text-sm rounded transition-shadow hover:shadow-md ${
                    matchedSkills.includes(skill) ? "bg-green-500 text-white" : "bg-red-800 text-red-200"
                  }`}
                >
                  ⚡ {skill}
                </span>
              ))}
            </div>

            <h3 className="text-xl font-semibold mb-3 mt-4 text-purple-300">Soft Skills</h3>
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-2 rounded">
              {analysis.softSkills.map((skill) => (
                <span
                  key={skill}
                  title={matchedSkills.includes(skill) ? "You already have this skill" : "Missing skill — recommended to learn"}
                  className={`inline-flex items-center gap-1 px-3 py-1 text-sm rounded transition-shadow hover:shadow-md ${
                    matchedSkills.includes(skill) ? "bg-green-500 text-white" : "bg-gray-700 text-white"
                  }`}
                >
                  🧠 {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Matched Skills */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3 flex items-center text-green-400">
              <CheckCircle className="w-5 h-5 mr-2" /> Matched Skills ({matchedSkills.length})
            </h3>
            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-2">
              {matchedSkills.map((skill) => (
                <span key={skill} className="inline-block px-3 py-1 text-sm rounded bg-green-500 text-white">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Top 5 Missing Skills */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3 text-yellow-400 flex items-center">
              <BookOpen className="w-5 h-5 mr-2" /> Top 5 Important Missing Skills
            </h3>
            {topSuggested.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topSuggested.map((skill) => (
                  <a
                    key={skill}
                    href={`https://www.google.com/search?q=${encodeURIComponent(skill + " tutorial")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 rounded bg-yellow-500 text-black font-semibold shadow hover:opacity-90 transition"
                  >
                    📚 {skill}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No high-priority missing skills detected.</p>
            )}
          </div>

          {/* Learning Roadmap */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3 text-indigo-300">Recommended Learning Roadmap</h3>
            <ol className="list-decimal list-inside space-y-2 pl-4 text-gray-200">
              {learningRoadmap.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3 items-center">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 transition"
              title="Download PDF (demo)"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 transition"
              title="Copy summary to clipboard"
            >
              <Clipboard className="w-4 h-4" /> Copy Summary
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 transition"
              title="Reset"
            >
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>
      )}

      {!analysis && !loading && (
        <div className="mt-10 p-10 text-center text-gray-500 bg-black rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          Enter the details above and click 'Analyze Skills' to begin.
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed right-6 bottom-6 bg-gray-800 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}
    </div>
  );
}
