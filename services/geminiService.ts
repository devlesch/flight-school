
import { GoogleGenAI, Type } from "@google/genai";
import { NewHireProfile } from "../types";

// Initialize the GoogleGenAI client lazily - only when actually used
let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('Gemini API key not set - AI features disabled');
      return null;
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export const generateEmailDraft = async (
  newHireName: string,
  managerName: string,
  progress: number,
  topic: string,
  overdueItems: string[] = []
): Promise<string> => {
  try {
    const isOverdue = overdueItems.length > 0;
    
    let prompt = `
      You are an AI assistant writing on behalf of a Manager at Industrious.
      Write a short email draft.
      
      Sender: ${managerName}
      Recipient: ${newHireName}
      Context: The new hire has completed ${progress}% of their onboarding training.
      Topic: ${topic}
    `;

    if (isOverdue) {
      prompt += `
      CRITICAL CONTEXT: The employee is overdue on the following tasks: ${overdueItems.join(', ')}.
      
      TONE GUIDELINES:
      - Supportive but Accountable: Remind them dates are important for their success.
      - Direct: List the items that need attention.
      - Action-Oriented: Ask for a specific completion timeline.
      `;
    } else {
      prompt += `
      TONE GUIDELINES:
      - Straightforward: Straight to the point, no jargon.
      - Thoughtful: Clean, considered, and intelligent.
      - Inviting: Welcoming and warm.
      `;
    }

    prompt += `
      - Use short sentences.
      - Avoid excessive adjectives and adverbs.
      - No "marketing speak".
      - Keep it under 100 words.
    `;

    const client = getAI();
    if (!client) {
      return "[AI disabled] Sample email draft for " + newHireName;
    }

    // Use gemini-3-flash-preview for basic text generation tasks.
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Could not generate email draft.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error communicating with AI service.";
  }
};

export const generateManagerNotification = async (
  adminName: string,
  managerName: string,
  atRiskEmployeeName: string,
  overdueItems: string[]
): Promise<string> => {
  try {
    const prompt = `
      You are an AI assistant writing an email from an Admin to a Manager at Industrious.
      
      Sender: ${adminName} (Operations Admin)
      Recipient: ${managerName} (Manager)
      Subject: New Hire Support Needed: ${atRiskEmployeeName}
      
      Context: ${atRiskEmployeeName} is currently behind schedule on their onboarding training.
      Specific Delays: ${overdueItems.join(', ')}.
      
      Goal: Ask the manager to check in with their direct report during their next 1:1 to unblock them.
      
      Tone: Collaborative, professional, concise.
    `;

    const client = getAI();
    if (!client) {
      return "[AI disabled] Sample notification for " + managerName;
    }

    // Use gemini-3-flash-preview for text generation tasks.
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Could not generate email draft.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error communicating with AI service.";
  }
};

export const analyzeProgress = async (hires: NewHireProfile[]): Promise<string> => {
  try {
    const dataSummary = hires.map(h => 
      `- ${h.name} (${h.department}): ${h.progress}% complete. Start Date: ${h.startDate}`
    ).join('\n');

    const prompt = `
      Analyze the following onboarding progress data.
      Identify anyone behind schedule (less than 20% progress) and high performers.
      Suggest 1 specific, direct action item for the Operations Manager.
      
      Data:
      ${dataSummary}
      
      Tone: Professional, direct, fact-based. No fluff.
      Format: Markdown. Concise (max 3 bullet points).
    `;

    const client = getAI();
    if (!client) {
      return "[AI disabled] Progress analysis unavailable";
    }

    // Use gemini-3-flash-preview for analysis of summary data.
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error analyzing progress.";
  }
};

// Interface for extracted data
export interface ExtractedHireData {
  workerName: string;
  managerName: string;
  hireDate: string;
  managerEmail: string;
  workerEmail: string;
  businessTitle: string; // Added field
}

export const extractNewHireData = async (rawText: string): Promise<ExtractedHireData[]> => {
  try {
    const client = getAI();
    if (!client) {
      return [];
    }

    const prompt = `
      Extract a list of new hires from the provided raw text (which comes from a PDF or Excel report).
      Only extract the first 5 entries found.
    `;

    // Define the response schema for structured extraction and use gemini-3-flash-preview.
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      // Fix: Follow @google/genai guidelines for multi-part content
      contents: { 
        parts: [
          { text: prompt },
          { text: rawText }
        ] 
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              workerName: {
                type: Type.STRING,
                description: 'First and Last name of the worker.',
              },
              managerName: {
                type: Type.STRING,
                description: 'First and Last name of the manager.',
              },
              hireDate: {
                type: Type.STRING,
                description: 'Date of hire in YYYY-MM-DD format.',
              },
              managerEmail: {
                type: Type.STRING,
              },
              workerEmail: {
                type: Type.STRING,
                description: 'Email of the worker, infer first.last@industriousoffice.com if not present.',
              },
              businessTitle: {
                type: Type.STRING,
                description: 'Job role or title of the worker.',
              },
            },
            required: ['workerName', 'managerName', 'hireDate', 'managerEmail', 'workerEmail', 'businessTitle'],
          },
        },
      }
    });
    
    const text = response.text;
    if (!text) return [];
    
    // Parse the JSON array returned by the model.
    return JSON.parse(text) as ExtractedHireData[];
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    return [];
  }
};
