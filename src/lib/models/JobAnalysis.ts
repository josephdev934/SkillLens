import mongoose from "mongoose";

const JobAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  jobTitle: { type: String, required: true },
  company: String,
  description: String,
  requiredSkills: { type: [String], default: [] },
  missingSkills: { type: [String], default: [] },
}, { timestamps: true });

export const JobAnalysis = mongoose.models.JobAnalysis || mongoose.model("JobAnalysis", JobAnalysisSchema);
