import { GoogleGenAI, Type } from "@google/genai";

let aiObj: GoogleGenAI | null = null;

function getAi(): GoogleGenAI {
  if (!aiObj) {
    // Attempt to use either VITE_GEMINI_API_KEY or process.env.GEMINI_API_KEY
    const key = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("Missing Gemini API Key. Please add VITE_GEMINI_API_KEY in your Vercel Environment Variables.");
    }
    aiObj = new GoogleGenAI({ apiKey: key });
  }
  return aiObj;
}

export interface IdentificationResult {
  match: boolean;
  matchedUserId?: string;
  confidence: number;
  reason: string;
}

export async function identifyFace(
  referenceUsers: { id: string; name: string; photo: string }[],
  checkImageB64: string
): Promise<IdentificationResult> {
  const checkData = checkImageB64.split(",")[1];

  const parts: any[] = [
    {
      text: "You are an expert biometric security system. You need to identify the person in the VERIFICATION IMAGE by comparing it to the REFERENCE IMAGES provided. Analyze facial features, eyes, nose, mouth structure, and jawline. Ignore differences in lighting, background, or minor expression changes.",
    },
  ];

  referenceUsers.forEach((user, index) => {
    parts.push({ text: `REFERENCE IMAGE ${index + 1} - User ID: ${user.id} (Name: ${user.name})` });
    parts.push({ inlineData: { mimeType: "image/jpeg", data: user.photo.split(",")[1] } });
  });

  parts.push({ text: "VERIFICATION IMAGE (The person trying to clock in):" });
  parts.push({ inlineData: { mimeType: "image/jpeg", data: checkData } });

  parts.push({ text: "Return true for 'match' ONLY if the VERIFICATION IMAGE is definitively the same person as ONE of the REFERENCE IMAGES. If match is true, provide that person's exact User ID in 'matchedUserId'." });

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        // @ts-ignore - The types for Schema might not be fully exported or matched in exact version
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            match: {
              type: Type.BOOLEAN,
              description: "True if the verification image matches exactly one of the reference images.",
            },
            matchedUserId: {
              type: Type.STRING,
              description: "The User ID of the matched person from the reference images, if a match was found.",
            },
            confidence: {
              type: Type.NUMBER,
              description: "Your confidence in the assessment as a float from 0.0 to 1.0.",
            },
            reason: {
              type: Type.STRING,
              description: "Brief rationale explaining why they match or don't match.",
            },
          },
          required: ["match", "confidence", "reason"],
        },
      },
    });

    if (!response.text) {
      throw new Error("No response text from Gemini");
    }
    
    return JSON.parse(response.text) as IdentificationResult;
  } catch (err) {
    console.error("Gemini face verification failed:", err);
    throw err;
  }
}
