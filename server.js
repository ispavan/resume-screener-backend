import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";

dotenv.config();

const app = express();

// ✅ Allowed frontend origins
const allowedOrigins = [
  "https://ai-resume-check.netlify.app", // ✅ Replace with your actual Netlify frontend URL
  "http://localhost:5173", // ✅ Vite default port (React local dev)
];

app.use(
  cors({
    origin: function (origin, callback) {
      console.log(`🌐 Request from origin: ${origin}`);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ Blocked by CORS: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // ✅ Allows cookies and authentication if needed
  })
);

app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

// ✅ Root route to test if backend is running
app.get("/", (req, res) => {
  res.json({ message: "✅ Backend is running 🚀" });
});

app.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    const jobDescription = req.body.jobDescription;
    
    if (!req.file) {
      return res.status(400).json({ message: "❌ No resume uploaded" });
    }
    if (!jobDescription) {
      return res.status(400).json({ message: "❌ No job description provided" });
    }

    let resumeText = "";
    
    // ✅ Extract text if it's a PDF
    if (req.file.mimetype === "application/pdf") {
      console.log("🔍 Extracting text from uploaded PDF...");
      const pdfData = await pdfParse(req.file.buffer);
      resumeText = pdfData.text.trim();
      console.log("✅ Extracted text (first 100 chars):", resumeText.substring(0, 100));
    }

    if (!resumeText) {
      return res.status(400).json({ message: "❌ No readable text found in resume" });
    }

    // ✅ Call Google Gemini AI
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `
      Compare the following **resume** with the **job description** and provide a rating out of 10 based on relevance.
      Suggest specific improvements and missing skills.

      **Job Description:** 
      ${jobDescription}

      **Resume:** 
      ${resumeText}

      Provide a **rating out of 10**, followed by a **brief explanation** of the strengths, weaknesses, and improvements of the resume.
    `;

    console.log("🤖 Sending request to Google Gemini...");
    const response = await model.generateContent(prompt);
    
    // ✅ Check if AI response exists
    if (!response || !response.response || !response.response.text) {
      console.error("❌ Invalid response from Google Gemini");
      return res.status(500).json({ message: "AI analysis failed: No response from AI." });
    }

    const aiResponse = response.response.text();
    console.log("✅ AI Response received.");

    res.json({ analysis: aiResponse });
  } catch (error) {
    console.error("❌ Server Error:", error);
    res.status(500).json({ message: "Internal server error. Please try again." });
  }
});

// ✅ Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
