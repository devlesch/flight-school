
import { NewHireProfile } from "../types";
import { supabase } from "../lib/supabase";

/**
 * Call the Gemini proxy Edge Function.
 * Replaces direct @google/genai SDK usage — API key stays server-side.
 */
async function callGeminiProxy(
  contents: string | { parts: { text: string }[] },
  config?: { responseMimeType?: string; responseSchema?: unknown }
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        model: 'gemini-2.0-flash',
        contents,
        config,
      },
    });

    if (error) {
      console.error('Gemini proxy error:', error.message);
      return null;
    }

    if (!data?.success) {
      console.error('Gemini proxy failed:', data?.error);
      return null;
    }

    return data.text || null;
  } catch (err) {
    console.error('Gemini service error:', err);
    return null;
  }
}

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

    const text = await callGeminiProxy(prompt);
    return text || "[AI disabled] Sample email draft for " + newHireName;
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

    const text = await callGeminiProxy(prompt);
    return text || "[AI disabled] Sample notification for " + managerName;
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

    const text = await callGeminiProxy(prompt);
    return text || "[AI disabled] Progress analysis unavailable";
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
  businessTitle: string;
}

export const extractNewHireData = async (rawText: string): Promise<ExtractedHireData[]> => {
  try {
    const prompt = `
      Extract a list of new hires from the provided raw text (which comes from a PDF or Excel report).
      Only extract the first 5 entries found.
    `;

    const text = await callGeminiProxy(
      { parts: [{ text: prompt }, { text: rawText }] },
      {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              workerName: { type: 'STRING', description: 'First and Last name of the worker.' },
              managerName: { type: 'STRING', description: 'First and Last name of the manager.' },
              hireDate: { type: 'STRING', description: 'Date of hire in YYYY-MM-DD format.' },
              managerEmail: { type: 'STRING' },
              workerEmail: { type: 'STRING', description: 'Email of the worker, infer first.last@industriousoffice.com if not present.' },
              businessTitle: { type: 'STRING', description: 'Job role or title of the worker.' },
            },
            required: ['workerName', 'managerName', 'hireDate', 'managerEmail', 'workerEmail', 'businessTitle'],
          },
        },
      }
    );

    if (!text) return [];
    return JSON.parse(text) as ExtractedHireData[];
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    return [];
  }
};
