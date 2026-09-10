import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import { z } from "zod";
import { insertMessageSchema } from "@shared/schema";
import fs from "fs";
import { nanoid } from "nanoid";
import { generateHealthChat, generateImageAnalysis } from "./gemini";
import { registerMediaiRoutes } from "./mediaiRoutes";

// Configure multer for file storage
const memStorage = multer.memoryStorage();
const upload = multer({
  storage: memStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "audio/webm",
      "audio/wav",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "video/webm",
    ];
    
    const mime = (file.mimetype || "").split(";")[0];
    const isAudio =
      mime.startsWith("audio/") ||
      mime === "video/webm" ||
      mime === "application/octet-stream";
    if (allowedMimeTypes.includes(mime) || (file.fieldname === "audio" && isAudio)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

// Mock AI response functions (in a real app, these would call actual AI APIs)
function generateTextAnalysisResponse(message: string, history: any[]): any {
  // Mock diagnosis based on simple keyword matching
  if (message.toLowerCase().includes("cough") && message.toLowerCase().includes("fever")) {
    return {
      message: `Based on your description of a cough with fever, I'm considering these possibilities:
      
Possible Conditions:
- Upper Respiratory Infection (85% match)
- COVID-19 (65% match)
- Bronchitis (40% match)

I recommend:
- Rest and increase fluid intake
- Consider over-the-counter fever reducer like acetaminophen
- Monitor your temperature
- Consider COVID-19 testing given current symptoms

Important: If you develop difficulty breathing or your fever exceeds 102°F (39°C), please seek immediate medical attention.`,
      diagnosis: {
        conditions: [
          { name: "Upper Respiratory Infection", confidence: 0.85 },
          { name: "COVID-19", confidence: 0.65 },
          { name: "Bronchitis", confidence: 0.4 }
        ],
        recommendations: [
          "Rest and increase fluid intake",
          "Consider over-the-counter fever reducer like acetaminophen",
          "Monitor your temperature",
          "Consider COVID-19 testing given current symptoms"
        ],
        warnings: [
          "If you develop difficulty breathing or your fever exceeds 102°F (39°C), please seek immediate medical attention."
        ]
      }
    };
  } else if (message.toLowerCase().includes("headache")) {
    return {
      message: `Thank you for sharing about your headache. To better understand your condition, I need some additional information:

1. How would you describe the pain (throbbing, dull, sharp)?
2. How long have you been experiencing this headache?
3. Where is the pain located (front, back, sides)?
4. Are you experiencing any other symptoms like nausea, sensitivity to light or sound?
5. Do you have a history of headaches or migraines?

This information will help me provide a more accurate assessment.`,
      diagnosis: null
    };
  } else if (message.toLowerCase().includes("rash")) {
    return {
      message: `I understand you're experiencing a rash. This could be caused by several conditions. To help narrow down the possibilities:

1. Where is the rash located on your body?
2. Does it itch, burn, or hurt?
3. When did you first notice it?
4. Have you started any new medications or used new products recently?
5. Do you have any known allergies?

If you could upload a photo of the affected area, I can provide a more detailed analysis.`,
      diagnosis: null
    };
  } else {
    return {
      message: `Thank you for sharing that information. To give you the most accurate assessment, I need a few more details:

- How long have you been experiencing these symptoms?
- Have you been in contact with anyone who has been sick recently?
- Are you experiencing any other symptoms?
- Do you have any pre-existing medical conditions?

The more details you can provide, the better I can assist you.`,
      diagnosis: null
    };
  }
}

function generateImageAnalysisResponse(imageType: string): any {
  // Mock image analysis results
  if (imageType.includes("x-ray") || imageType.includes("xray")) {
    return {
      observations: [
        "The lung fields appear clear without evidence of infiltrates or consolidation",
        "Heart size is within normal limits",
        "No pleural effusion is visible",
        "Bony structures appear intact"
      ],
      findings: [
        "Normal chest X-ray with no acute cardiopulmonary process identified"
      ],
      recommendations: [
        "No follow-up imaging needed at this time",
        "Correlate with clinical symptoms"
      ]
    };
  } else if (imageType.includes("skin") || imageType.includes("rash")) {
    return {
      observations: [
        "Erythematous papular rash with defined borders",
        "No vesicles or pustules present",
        "Appears to cover approximately 4x5cm area"
      ],
      findings: [
        "Appearance consistent with contact dermatitis",
        "Consider allergic reaction to topical agent"
      ],
      recommendations: [
        "Avoid potential irritants/allergens",
        "Consider over-the-counter hydrocortisone cream",
        "If not improving within 48-72 hours, consult with a dermatologist"
      ]
    };
  } else {
    return {
      observations: [
        "Image quality is adequate for analysis",
        "No obvious abnormalities detected"
      ],
      findings: [
        "Preliminary assessment shows no significant findings"
      ],
      recommendations: [
        "Consider providing additional clinical information",
        "Follow up with your healthcare provider for a comprehensive evaluation"
      ]
    };
  }
}

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:5050";

export async function registerRoutes(app: Express): Promise<Server> {
  // prefix all routes with /api
  const apiRouter = (route: string) => `/api${route}`;

  registerMediaiRoutes(app);

  app.post(apiRouter("/chat"), async (req: Request, res: Response) => {
    try {
      const message = String(req.body?.message || "").trim();
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      const text = await generateHealthChat(message);
      return res.status(200).json({ text });
    } catch (error: any) {
      console.error("Chat error:", error);
      return res.status(502).json({
        message: error?.message || "Failed to get AI response",
      });
    }
  });

  app.post(apiRouter("/vision"), async (req: Request, res: Response) => {
    try {
      const prompt = String(req.body?.prompt || "").trim();
      const mimeType = String(req.body?.mimeType || "image/jpeg");
      const data = String(req.body?.data || "");
      if (!prompt || !data) {
        return res.status(400).json({ message: "Image and prompt are required" });
      }
      const text = await generateImageAnalysis(prompt, mimeType, data);
      return res.status(200).json({ text });
    } catch (error: any) {
      console.error("Vision error:", error);
      return res.status(502).json({
        message: error?.message || "Failed to analyze image",
      });
    }
  });

  app.post(apiRouter("/risk/predict"), async (req: Request, res: Response) => {
    try {
      const r = await fetch(`${ML_SERVICE_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const text = await r.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }
      return res.status(r.status).json(data);
    } catch (error) {
      console.error("ML proxy error:", error);
      return res.status(503).json({
        message:
          "Risk estimation service is unavailable. Start the Python ML service (ml_service) on port 5050 or set ML_SERVICE_URL.",
      });
    }
  });

  // Text analysis endpoint
  app.post(apiRouter("/analyze/text"), async (req: Request, res: Response) => {
    try {
      // Validate request
      const schema = z.object({
        message: z.string().min(1),
        history: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string()
        })).optional()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: validationResult.error.errors 
        });
      }
      
      const { message, history = [] } = validationResult.data;
      
      // Generate AI response
      const aiResponse = generateTextAnalysisResponse(message, history);
      
      // In a real application, you would store this interaction
      // Save the AI message to storage
      
      // Return response
      return res.status(200).json(aiResponse);
    } catch (error) {
      console.error("Error in text analysis:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Speech-to-text endpoint (Deepgram). Chrome's Web Speech API often fails with
  // a "network" error when Google speech endpoints are blocked.
  app.post(apiRouter("/speech-to-text"), upload.single("audio"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const deepgramKey = process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY;
      if (!deepgramKey) {
        return res.status(500).json({ message: "Speech-to-text is not configured (missing DEEPGRAM_API_KEY)" });
      }

      const dgRes = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramKey}`,
            "Content-Type": req.file.mimetype || "audio/webm",
          },
          body: req.file.buffer,
        },
      );

      if (!dgRes.ok) {
        const errText = await dgRes.text();
        console.error("Deepgram error:", dgRes.status, errText.slice(0, 400));
        return res.status(502).json({ message: "Could not transcribe audio. Please try again." });
      }

      const payload = (await dgRes.json()) as {
        results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
      };
      const transcribedText =
        payload.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";

      if (!transcribedText) {
        return res.status(200).json({ text: "", message: "No speech detected" });
      }

      return res.status(200).json({ text: transcribedText });
    } catch (error) {
      console.error("Error in speech-to-text:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Image analysis endpoint
  app.post(apiRouter("/analyze/image"), upload.single("image"), async (req: Request, res: Response) => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      
      // Get the file type and original name for analysis
      const fileType = req.file.mimetype;
      const fileName = req.file.originalname.toLowerCase();
      
      // In a real app, you would call an actual image analysis AI API here
      
      // Generate mock analysis based on file name
      let imageType = "generic";
      if (fileName.includes("xray") || fileName.includes("x-ray") || fileName.includes("chest")) {
        imageType = "x-ray";
      } else if (fileName.includes("skin") || fileName.includes("rash") || fileName.includes("dermatology")) {
        imageType = "skin";
      }
      
      const analysisResult = generateImageAnalysisResponse(imageType);
      
      return res.status(200).json(analysisResult);
    } catch (error) {
      console.error("Error in image analysis:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Profile image upload endpoint (local storage version to bypass CORS)
  const profileUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profile-images');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueId = nanoid();
        const extension = path.extname(file.originalname);
        cb(null, `${uniqueId}${extension}`);
      }
    }),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit for profile images
    },
    fileFilter: (req, file, cb) => {
      // Accept only image files
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
      }
    }
  });

  // Profile image upload endpoint
  app.post(apiRouter("/profile/upload"), profileUpload.single("image"), async (req: Request, res: Response) => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      
      // Get the user ID from the request
      const userId = req.body.userId;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Construct the URL to the uploaded file
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const relativePath = path.join('/uploads/profile-images', req.file.filename).replace(/\\/g, '/');
      const fileUrl = `${baseUrl}${relativePath}`;
      
      // Return the URL to the client
      return res.status(200).json({ 
        url: fileUrl,
        fileName: req.file.filename
      });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
