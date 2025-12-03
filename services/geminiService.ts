import { GoogleGenAI, Type } from "@google/genai";
import { Account, Priority, Task, SubTask } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-2.5-flash";

/**
 * Parses natural language input to create structured tasks.
 * It attempts to route tasks to the correct account based on context.
 */
export const parseTasksFromInput = async (
  input: string,
  availableAccounts: Account[]
): Promise<any[]> => {
  
  const accountNames = availableAccounts.map(a => a.name).join(", ");
  const currentTime = new Date().toString(); // Provides local time context

  const prompt = `
    You are an intelligent task manager assistant. 
    The user has the following accounts connected: [${accountNames}].
    The current date and time is: ${currentTime}.
    
    Analyze the user's request: "${input}".
    
    Extract distinct tasks. For each task:
    1. Assign it to the most relevant account from the list. If unclear, default to the first one.
    2. Determine priority (Low, Medium, High).
    3. Create a concise title.
    4. Add a brief description if details are available.
    5. Extract any due date or time mentioned and convert it to a strict ISO 8601 format string (YYYY-MM-DDTHH:mm:ss). If no date is mentioned, leave it null.
    
    Return a JSON array of tasks.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              accountNameMatch: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              description: { type: Type.STRING },
              dueDate: { type: Type.STRING, description: "ISO 8601 date string if a date is mentioned" },
            },
            required: ["title", "accountNameMatch", "priority"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini parse error:", error);
    return [];
  }
};

/**
 * Analyzes the existing task list to provide insights, reviews, or answers to user queries.
 */
export const analyzeTaskList = async (tasks: Task[], query: string): Promise<string> => {
  const taskContext = tasks.map(t => 
    `- [${t.priority}] "${t.title}" (Status: ${t.completed ? 'Completed' : 'Pending'}, Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'None'})`
  ).join('\n');

  const prompt = `
    You are a helpful productivity assistant.
    Here is the user's current task list:
    
    ${taskContext}
    
    The user asks: "${query}"
    
    Provide a helpful, concise response based strictly on the tasks listed above. 
    If the user asks to identify specific tasks (e.g., "which ones are urgent"), list them bulleted.
    Keep the tone professional and encouraging.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "text/plain",
      },
    });

    return response.text || "I couldn't analyze your tasks at the moment.";
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "Sorry, I encountered an error while analyzing your tasks.";
  }
};

/**
 * Generates subtasks for a complex task.
 */
export const breakDownTask = async (taskTitle: string): Promise<{ title: string }[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Break down the task "${taskTitle}" into 3-5 actionable subtasks.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
            },
            required: ["title"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini breakdown error:", error);
    return [];
  }
};

/**
 * Simulates fetching/importing tasks from an external source by generating realistic sample data.
 */
export const generateSampleTasksForAccount = async (accountName: string): Promise<any[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Generate 3 realistic, professional tasks for a user's "${accountName}" account. Mix of priorities.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              description: { type: Type.STRING },
            },
            required: ["title", "priority"],
          },
        },
      },
    });
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    return [];
  }
}