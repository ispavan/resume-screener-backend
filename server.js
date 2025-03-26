import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

app.post("/analyze", upload.single("resume"), async (req, res) => {
  const jobDescription = req.body.jobDescription; // Get job description from frontend

  if (!req.file) {
    return res.status(400).json({ message: "No resume uploaded" });
  }
  if (!jobDescription) {
    return res.status(400).json({ message: "No job description provided" });
  }

  let resumeText = "";

  if (req.file.mimetype === "application/pdf") {
    try {
      console.log("Extracting text from uploaded PDF...");
      const pdfData = await pdfParse(req.file.buffer);
      resumeText = pdfData.text.trim();
      console.log("Extracted text:", resumeText.substring(0, 100)); // Log first 100 chars
    } catch (err) {
      console.error("Error processing PDF:", err);
      return res.status(500).json({ message: "Failed to process PDF" });
    }
  }

  if (!resumeText) {
    return res.status(400).json({ message: "No readable text found in resume" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `
      Compare the following **resume** with the **job description** and provide a rating out of 10 based on relevance.
      Suggest specific improvements and missing skills.

      **Job Description:** 
      ${jobDescription}

      **Resume:** 
      ${resumeText}

      Provide a **rating out of 10**, followed by a **brief explanation** of the strengths weaknesses and improvements of the resume.
    `;

    const response = await model.generateContent(prompt);

    if (!response || !response.response) {
      throw new Error("Invalid response from Gemini API");
    }

    const aiResponse =response.text();

    res.json({ analysis: aiResponse });
  } catch (error) {
    console.error("Error with Google Gemini API:", error);
    res.status(500).json({ message: "AI analysis failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
