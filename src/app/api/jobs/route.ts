import { NextResponse } from "next/server";
// import { connectDB } from "@/lib/db";
// import { JobAnalysis } from "@/lib/models/JobAnalysis";
import { GoogleGenAI } from "@google/genai"; // make sure your package version supports this

// In-memory fallback storage (for testing without MongoDB)
const jobAnalysisStore: any[] = [];

export async function POST(req: Request) {
  // await connectDB(); // skip DB for now

  const { jobDescription, userSkills } = await req.json();

  try {
    // Initialize Gemini client
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Call the AI model
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { text: `Extract all technical and soft skills from this job description: "${jobDescription}"` }
          ],
        },
      ],
    });

    // Safely handle undefined text
    const resultText: string = response.text || "";

    // Convert AI output to array of skills
    const extractedSkills: string[] = resultText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Determine missing skills
    const missingSkills = extractedSkills.filter(
      (skill) => !userSkills.includes(skill)
    );

    // Save to in-memory store (skip MongoDB for now)
    const jobAnalysis = {
      jobTitle: "Unknown",
      description: jobDescription,
      requiredSkills: extractedSkills,
      missingSkills,
    };
    jobAnalysisStore.push(jobAnalysis);

    // Return response
    return NextResponse.json({
      requiredSkills: jobAnalysis.requiredSkills,
      missingSkills: jobAnalysis.missingSkills,
    });
  } catch (err) {
    console.error("Job Analysis Error:", err);
    return NextResponse.json({ error: "Failed to analyze job" }, { status: 500 });
  }
}
