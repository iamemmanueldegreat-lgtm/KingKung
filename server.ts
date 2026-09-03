import express from "express";
import path from "path";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import rateLimit from "express-rate-limit";

const Type = {
  OBJECT: "object",
  STRING: "string",
  ARRAY: "array",
  INTEGER: "integer",
  NUMBER: "number",
  BOOLEAN: "boolean",
} as const;

// Lazy-loaded AI clients
let openaiClient: OpenAI | null = null;
let lastApiKey: string | null = null;
let geminiClient: GoogleGenAI | null = null;

const DEEPSEEK_MODEL = "deepseek-chat";
const GEMINI_MODEL = "gemini-3.6-flash";

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

function getDeepSeekClient(): any {
  const gemini = getGeminiClient();
  const dsKey = process.env.DEEPSEEK_API_KEY;

  if (dsKey && (!openaiClient || dsKey !== lastApiKey)) {
    lastApiKey = dsKey;
    openaiClient = new OpenAI({
      apiKey: dsKey,
      baseURL: "https://api.deepseek.com/v1"
    });
  }

  return {
    models: {
      generateContent: async (args: any) => {
        // Option 1: Gemini via @google/genai SDK
        if (gemini && !openaiClient) {
          try {
            let formattedContents: any = args.contents;
            if (typeof args.contents === "string") {
              formattedContents = args.contents;
            } else if (Array.isArray(args.contents)) {
              formattedContents = args.contents.map((m: any) => {
                if (typeof m === "string") return { role: "user", parts: [{ text: m }] };
                const role = (m.role === "assistant" || m.role === "model") ? "model" : "user";
                const text = m.parts ? (m.parts[0]?.text || "") : (m.content || m.text || "");
                return { role, parts: [{ text }] };
              });
            }

            const configObj: any = {};
            if (args.config?.systemInstruction) {
              configObj.systemInstruction = args.config.systemInstruction;
            }
            if (args.config?.responseMimeType) {
              configObj.responseMimeType = args.config.responseMimeType;
            }
            if (args.config?.responseSchema) {
              configObj.responseSchema = args.config.responseSchema;
            }

            const res = await gemini.models.generateContent({
              model: GEMINI_MODEL,
              contents: formattedContents,
              config: configObj,
            });

            return {
              text: res.text || ""
            };
          } catch (geminiError: any) {
            console.error("Gemini API call failed, attempting DeepSeek fallback:", geminiError.message || geminiError);
            if (!openaiClient) throw geminiError;
          }
        }

        // Option 2: DeepSeek via OpenAI SDK
        if (openaiClient) {
          let messages: any[] = [];
          let systemInstruction = "";
          
          if (args.config && args.config.systemInstruction) {
            systemInstruction = args.config.systemInstruction;
          }

          if (args.config && args.config.responseSchema) {
            const schemaStr = JSON.stringify(args.config.responseSchema);
            systemInstruction += `\n\nCRITICAL JSON SCHEMA REQUIREMENT:
You MUST return a JSON object conforming strictly to the following JSON Schema structure:
${schemaStr}

Ensure you output ONLY a valid stringified JSON object containing exactly the requested keys. Avoid wrapping JSON keys in custom types or lists unless explicitly requested. Do not output anything other than this JSON.`;
          }

          if (systemInstruction) {
            messages.push({ role: "system", content: systemInstruction });
          }

          if (typeof args.contents === "string") {
            messages.push({ role: "user", content: args.contents });
          } else if (Array.isArray(args.contents)) {
            for (const msg of args.contents) {
              const role = (msg.role === 'model' || msg.role === 'assistant') ? 'assistant' : 'user';
              const content = msg.parts ? msg.parts[0]?.text : (msg.content || msg.text);
              messages.push({ role, content });
            }
          }
          
          let response_format: any;
          if (args.config && (args.config.responseMimeType === "application/json" || args.config.responseSchema)) {
            response_format = { type: "json_object" };
          }

          const res = await openaiClient.chat.completions.create({
            model: DEEPSEEK_MODEL,
            messages,
            response_format,
          });

          return {
            text: res.choices[0].message.content
          };
        }

        throw new Error("No AI provider API key is configured or available.");
      },

      generateContentStream: async (args: any) => {
        // Option 1: Gemini via @google/genai SDK
        if (gemini && !openaiClient) {
          try {
            let formattedContents: any = args.contents;
            if (typeof args.contents === "string") {
              formattedContents = args.contents;
            } else if (Array.isArray(args.contents)) {
              formattedContents = args.contents.map((m: any) => {
                if (typeof m === "string") return { role: "user", parts: [{ text: m }] };
                const role = (m.role === "assistant" || m.role === "model") ? "model" : "user";
                const text = m.parts ? (m.parts[0]?.text || "") : (m.content || m.text || "");
                return { role, parts: [{ text }] };
              });
            }

            const configObj: any = {};
            if (args.config?.systemInstruction) {
              configObj.systemInstruction = args.config.systemInstruction;
            }

            const responseStream = await gemini.models.generateContentStream({
              model: GEMINI_MODEL,
              contents: formattedContents,
              config: configObj,
            });

            async function* geminiStreamGenerator() {
              for await (const chunk of responseStream) {
                yield { text: chunk.text || "" };
              }
            }
            return geminiStreamGenerator();
          } catch (geminiError: any) {
            console.error("Gemini stream failed, attempting DeepSeek fallback:", geminiError.message || geminiError);
            if (!openaiClient) throw geminiError;
          }
        }

        // Option 2: DeepSeek via OpenAI SDK
        if (openaiClient) {
          let messages: any[] = [];
          if (args.config && args.config.systemInstruction) {
            messages.push({ role: "system", content: args.config.systemInstruction });
          }
          if (Array.isArray(args.contents)) {
            for (const msg of args.contents) {
              const role = (msg.role === 'model' || msg.role === 'assistant') ? 'assistant' : 'user';
              const content = msg.parts ? msg.parts[0]?.text : (msg.content || msg.text);
              messages.push({ role, content });
            }
          } else if (typeof args.contents === "string") {
            messages.push({ role: "user", content: args.contents });
          }
          
          const stream = await openaiClient.chat.completions.create({
            model: DEEPSEEK_MODEL,
            messages,
            stream: true
          });

          async function* dsStreamGenerator() {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content || "";
              yield { text };
            }
          }
          return dsStreamGenerator();
        }

        throw new Error("No AI provider API key is configured or available.");
      }
    }
  };
}

function parseJsonSafe(text: string): any {
  let cleaned = text.trim();
  
  // Remove <think>...</think> block if present
  const thinkStart = cleaned.indexOf("<think>");
  const thinkEnd = cleaned.indexOf("</think>");
  if (thinkStart !== -1 && thinkEnd !== -1 && thinkEnd > thinkStart) {
    cleaned = cleaned.substring(0, thinkStart) + cleaned.substring(thinkEnd + 8);
    cleaned = cleaned.trim();
  }

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Attempt jsonrepair
    try {
      const repaired = jsonrepair(cleaned);
      return JSON.parse(repaired);
    } catch (repairErr) {
      console.error("jsonrepair parsing failed too:", repairErr);
    }

    console.error("Failed parsing JSON directly. Attempting extraction from:", text);
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        const potentialJson = cleaned.substring(startIdx, endIdx + 1);
        try {
          return JSON.parse(jsonrepair(potentialJson));
        } catch {
          return JSON.parse(potentialJson);
        }
      } catch (innerErr) {
        console.error("Extraction fallback failed too:", innerErr);
      }
    }
    const arrayStartIdx = cleaned.indexOf("[");
    const arrayEndIdx = cleaned.lastIndexOf("]");
    if (arrayStartIdx !== -1 && arrayEndIdx !== -1 && arrayEndIdx > arrayStartIdx) {
      try {
        const potentialArray = cleaned.substring(arrayStartIdx, arrayEndIdx + 1);
        try {
          return JSON.parse(jsonrepair(potentialArray));
        } catch {
          return JSON.parse(potentialArray);
        }
      } catch (innerErr) {
        console.error("Array extraction fallback failed too:", innerErr);
      }
    }
    throw err;
  }
}

function detectCurriculumSource(text: string, requestedSource?: string): "NBTE" | "CCMAS" {
  if (requestedSource === "NBTE" || requestedSource === "CCMAS") {
    return requestedSource;
  }
  const upper = text.toUpperCase();
  return upper.includes("NATIONAL BOARD FOR TECHNICAL EDUCATION") ||
    upper.includes("NATIONAL DIPLOMA") ||
    upper.includes("HIGHER NATIONAL DIPLOMA") ||
    /\bHND\b/.test(upper)
    ? "NBTE"
    : "CCMAS";
}

function extractCourseSpecificationBlocks(text: string, source: "NBTE" | "CCMAS") {
  const codePattern = /(?:course\s+code|subject\/course|course\s+code\s*:?)\s*:?\s*([A-Z]{2,4}\s*\d{3})/gi;
  const matches = Array.from(text.matchAll(codePattern));
  const seen = new Set<string>();
  const blocks: string[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const rawCode = matches[index][1].replace(/\s+/g, " ").trim().toUpperCase();
    if (seen.has(rawCode)) continue;
    const start = matches[index].index ?? 0;
    const nextStart = matches[index + 1]?.index ?? text.length;
    const block = text.slice(start, nextStart).trim();
    if (block.length < 80) continue;
    seen.add(rawCode);
    blocks.push(block.slice(0, source === "NBTE" ? 5500 : 4500));
  }

  return blocks;
}

function prepareCurriculumForParsing(text: string, source: "NBTE" | "CCMAS") {
  const pageStart = (page: number) => text.indexOf(`===== PAGE ${page} =====`);

  if (source === "CCMAS") {
    const computerScienceMatches = Array.from(text.matchAll(/B\.Sc\. Computer Science/gi));
    const computerScienceStart = computerScienceMatches.length > 1
      ? computerScienceMatches[1].index ?? text.indexOf("B.Sc. Computer Science")
      : text.indexOf("B.Sc. Computer Science");
    const cybersecurityStart = text.indexOf("B.Sc. Cybersecurity", computerScienceStart + 1);
    const section = computerScienceStart >= 0
      ? text.slice(computerScienceStart, cybersecurityStart > computerScienceStart ? cybersecurityStart : text.length)
      : text;
    const structureStart = section.indexOf("Global Course Structure");
    const detailsStart = section.indexOf("Course Contents and Learning Outcomes");
    const structureEnd = detailsStart > structureStart ? detailsStart : section.length;
    const details = detailsStart >= 0 ? section.slice(detailsStart) : section;
    return {
      sourceText: section.slice(structureStart >= 0 ? structureStart : 0, structureEnd).slice(0, 60000),
      courseBlocks: extractCourseSpecificationBlocks(details, source),
      note: "This is a CCMAS Computing document. Use the B.Sc. Computer Science programme section only; ignore Cybersecurity, Data Science, Information Systems, and unrelated programmes."
    };
  }

  const tableStart = pageStart(8);
  const detailStart = pageStart(12);
  const tables = tableStart >= 0
    ? text.slice(tableStart, detailStart > tableStart ? detailStart : text.length).slice(0, 45000)
    : text.slice(0, 45000);
  const detailText = detailStart >= 0 ? text.slice(detailStart) : text;
  const detailBlocks = extractCourseSpecificationBlocks(detailText, source);

  return {
    sourceText: tables,
    courseBlocks: detailBlocks,
    note: "This is an NBTE polytechnic curriculum. It may contain ND1/ND2 and/or HND1/HND2 course structures. Use the official year/level and semester tables to identify courses, then use the matching course specification blocks to extract learning objectives and topics. Preserve HND courses when present, and do not treat weekly lesson-plan rows as separate courses."
  };
}

function chunkCurriculumBlocks(blocks: string[], maxBlocks = 7) {
  const chunks: string[][] = [];
  for (let index = 0; index < blocks.length; index += maxBlocks) {
    chunks.push(blocks.slice(index, index + maxBlocks));
  }
  return chunks.length ? chunks : [[]];
}

function cleanAndValidateQuestions(questions: any[]): any[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => {
    const question = q.question || 'Appraisal Assessment Component';
    const options = Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'];
    let correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
    const explanation = q.explanation || 'Syllabus alignment confirmed.';
    let calculatedAnswer = q.calculatedAnswer || q.calculated_answer || options[correctIndex] || '';

    // If calculatedAnswer was not provided by AI, use options[correctIndex] as fallback
    if (!calculatedAnswer) {
      calculatedAnswer = options[correctIndex] || '';
    }

    // 1. Check if the AI wrote a correction in the explanation, e.g. "correctIndex should be 1"
    const correctionRegex = /correctIndex\s*(?:should\s*be|\s*=|is|to\s*be|updated\s*to)\s*([0-3])/i;
    const match = explanation.match(correctionRegex);
    if (match) {
      const parsedIndex = parseInt(match[1], 10);
      if (parsedIndex >= 0 && parsedIndex < options.length) {
        console.log(`[Validation Auto-Fix] Found index correction in explanation: correctIndex updated to ${parsedIndex}`);
        correctIndex = parsedIndex;
      }
    } else {
      // Letter correction search, e.g. "correctIndex should be B" or "correct option is B" or "correctIndex should be option B"
      const letterRegex = /correctIndex\s*(?:should\s*be|\s*=|is|to\s*be|updated\s*to)\s*(?:option\s+)?([A-D])/i;
      const letterMatch = explanation.match(letterRegex);
      if (letterMatch) {
        const char = letterMatch[1].toUpperCase();
        const parsedIndex = char.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
        if (parsedIndex >= 0 && parsedIndex < options.length) {
          console.log(`[Validation Auto-Fix] Found letter index correction in explanation: correctIndex updated to ${parsedIndex} (${char})`);
          correctIndex = parsedIndex;
        }
      }
    }

    // 2. Perform Consistency Check: Compare (Calculated answer, Correct option text, Correct index, Explanation result)
    // If the correct option text doesn't match the calculated answer, let's see if another option matches calculatedAnswer.
    if (options[correctIndex] !== calculatedAnswer) {
      // Find matches in options array
      const matchedIdx = options.findIndex(opt => opt === calculatedAnswer || parseFloat(opt) === parseFloat(calculatedAnswer));
      if (matchedIdx !== -1) {
        console.log(`[Validation Auto-Fix] correctIndex updated to ${matchedIdx} to match calculatedAnswer "${calculatedAnswer}"`);
        correctIndex = matchedIdx;
      } else {
        // If no option text matches calculatedAnswer, maybe calculatedAnswer is one of the options but formatted slightly differently
        const trimmedCal = String(calculatedAnswer).trim().toLowerCase();
        const matchedIdxTrimmed = options.findIndex(opt => String(opt).trim().toLowerCase() === trimmedCal);
        if (matchedIdxTrimmed !== -1) {
          console.log(`[Validation Auto-Fix] correctIndex updated to ${matchedIdxTrimmed} to match trimmed calculatedAnswer`);
          correctIndex = matchedIdxTrimmed;
        } else {
          // If still no option text matches, we override calculatedAnswer to options[correctIndex] to enforce structural rendering sanity!
          console.log(`[Validation Auto-Fix] Forcing calculatedAnswer to match existing correctIndex option: "${options[correctIndex]}"`);
          calculatedAnswer = options[correctIndex];
        }
      }
    }

    return {
      question,
      options,
      correctIndex,
      calculatedAnswer,
      explanation
    };
  });
}

function getFallbackCourse(department: string) {
  const normalized = (department || "").toLowerCase();
  const schools = ["University of Benin (UNIBEN)", "Auchi Polytechnic"];
  const randomSchool = schools[Math.floor(Math.random() * schools.length)];
  
  if (normalized.includes("math") || normalized.includes("calc")) {
    return {
      school: randomSchool,
      code: "MTH 101",
      title: "General Mathematics I",
      description: "Foundational real-life mathematics covering equations, basic calculus limits, systems of logic, quadratics, inequalities, and core vector transformations designed for engineers and scientists.",
      topics: [
        {
          title: "Quadratic Equations and Functions",
          content: "A detailed review of second-order polynomial systems. In this unit, we learn how to compute the discriminant, interpret vertex and axis coordinates, and solve solutions using the universal quadratic formula and completing the square."
        },
        {
          title: "Introduction to Limits and Continuity",
          content: "Exploring the fundamental definition of limits, approaching infinitesimal bounds on Cartesian coordinate planes. This unit covers evaluating standard left and right-hand limits and verifying curve continuity conditions."
        }
      ]
    };
  } else if (normalized.includes("computer") || normalized.includes("software") || normalized.includes("csc") || normalized.includes("tech")) {
    return {
      school: randomSchool,
      code: "CSC 101",
      title: "Introduction to Computer Science",
      description: "Comprehensive introduction to digital design, computational theory, machine instructions, flowcharts, variable allocations, and core binary logic gates.",
      topics: [
        {
          title: "Binary Logic and Logic Gates",
          content: "Discover how registers and physical transistors process binary currents. Learn key Boolean logic functions including AND, OR, XOR, and NOT, alongside high-yield visual representations and algebraic operations."
        },
        {
          title: "Introduction to Algorithmic Efficiency",
          content: "Understanding space and time optimization. Students learn to trace operations, construct basic pseudocode algorithms, and write simple iterative loops using standard high-level programming structures."
        }
      ]
    };
  } else if (normalized.includes("mechanic") || normalized.includes("elect") || normalized.includes("engine") || normalized.includes("mechatronic")) {
    return {
      school: randomSchool,
      code: "MEG 201",
      title: "Basic Engineering Thermodynamics",
      description: "Core analytical curriculum on heat engines, conservation laws, temperature coefficients, closed-system cycles, and performance barriers in mechanical processes.",
      topics: [
        {
          title: "The First Law of Thermodynamics",
          content: "Focusing on thermal conservation. Learn how internal energy changes correlate to boundary work and heat transfer rates under localized atmospheric measurements."
        },
        {
          title: "Understanding Entropy and Irreversibility",
          content: "Evaluating academic formulations for systemic disorder. Explore the Carnot cycle limits, mechanical efficiency formulas, and entropy calculations in industrial heat pumps."
        }
      ]
    };
  } else if (normalized.includes("econ") || normalized.includes("bus") || normalized.includes("finance") || normalized.includes("account")) {
    return {
      school: randomSchool,
      code: "ECO 101",
      title: "Principles of Microeconomics",
      description: "Analytical overview of microeconomic principles, market equilibrium equations, price elasticity indexes, production efficiency, and utility maximization theories.",
      topics: [
        {
          title: "Supply, Demand, and Market Equilibrium",
          content: "Analyzing forces that influence buyer actions and vendor strategies. Covers constructing supply-demand schedules, interpreting equilibrium intersections, and predicting micro-level pricing pivots in modern commerce."
        },
        {
          title: "Theory of Consumer Choice",
          content: "How individual consumers evaluate budget constraints and marginal utility. Connects modern economic utility graphs directly to real-life shopping preferences in local major markets."
        }
      ]
    };
  } else {
    // Default fallback
    return {
      school: randomSchool,
      code: "GST 111",
      title: `Introduction to ${department || "Academic Studies"}`,
      description: `Comprehensive academic foundations, terminology structures, core paradigms, and fundamental principles designed for collegiate success in ${department || "all professional majors"}.`,
      topics: [
        {
          title: "Core Foundations and Definitions",
          content: `Delve deep into the most significant definitions, academic histories, and theoretical methodologies under the study umbrella of ${department || "the syllabus"}. Learners analyze fundamental frameworks.`
        },
        {
          title: "Practical Intersections and Applications",
          content: `Analyzing the real-life applications of ${department || "theoretical concepts"} to local industries, technological frameworks, and societal development within academic workspaces.`
        }
      ]
    };
  }
}

function getFallbackStudy(topic: string, course: string) {
  const cleanTopic = topic || "Selected Topic";
  const cleanCourse = course || "Selected Course";
  
  return {
    content: `### Kortex Local Study Companion: ${cleanTopic}
      
Welcome to your adaptive study guide! To ensure that your study schedule remains completely uninterrupted when cloud networks or high-speed AI quotas are reached, Kortex has activated its local learning engine backup for this syllabus.

#### 1. Comprehensive Overview
The concept of **${cleanTopic}** is a core pillar inside the curriculum of **${cleanCourse}**. Understanding this topic equips you to solve complex problems, formulate models, and build structural workflow rules. Mastering these concepts prepares you to trace complex operations with analytical precision.

#### 2. Key Academic Principles
- **Determined input parameters**: Every standard theoretical formulation of **${cleanTopic}** is governed by precise boundary conditions and operational constants.
- **Systematic efficiency constraints**: Optimizing variables requires identifying key systemic limits (such as network latency, physical friction, or financial budget coefficients).
- **Real-world Application**: We observe these models in high-load scenarios across major industries—ranging from regulating systems, balancing distribution grids, to organizing supply streams. Always include practical case descriptions in your essay responses to demonstrate deep understanding.

#### 3. Core Operational Case study
By applying the frameworks of **${cleanTopic}**, you can segment processes into modules, reducing operational delays and maximizing resource output. For assignments and examinations, remember that clear layouts and step-by-step proofs are essential.`,

    key_takeaways: `### Key Academic Takeaways
    
- **Continuous Study Backup**: This complete study syllabus was compiled automatically in offline backup mode to maintain your session continuity.
- **Fundamental Importance**: Remember that **${cleanTopic}** serves as a foundational element. Always double-check definitions of core concepts.
- **Accurate Application**: Be structured in your problem solving: declare variables, state governing laws, and verify units carefully before finalizing results.
- **Instant Interactive Quiz**: Check out the *Practice* section below to challenge yourself with dynamic local quiz questions designed to test your core recall immediately.`,

    quiz_questions: [
      {
        question: `What is the primary academic goal of studying ${cleanTopic} within the curriculum?`,
        options: [
          "To analyze underlying structures systematically in order to optimize performance",
          "To learn historical dates without practical applications",
          "To temporarily bypass all practice examinations and tutorials",
          "To completely reject mathematical standards and logical proofs"
        ],
        correctIndex: 0,
        calculatedAnswer: "To analyze underlying structures systematically in order to optimize performance",
        explanation: `The primary goal of ${cleanTopic} within ${cleanCourse} is to evaluate structural functions and optimize resources.`
      },
      {
        question: `When writing academic essay solutions about ${cleanTopic}, which strategy delivers the highest grading results?`,
        options: [
          "Leaving the question sheet completely blank",
          "Interweaving clear definitions with practical localized real-world case examples",
          "Avoiding algebraic unit descriptions and diagrams",
          "Writing unrelated details to fill up space on the response page"
        ],
        correctIndex: 1,
        calculatedAnswer: "Interweaving clear definitions with practical localized real-world case examples",
        explanation: "Relating abstract concepts to concrete local case examples is highly favored by examiners as it proves real retention."
      },
      {
        question: "Which of the following describes the most robust strategy to solve computational modeling problems?",
        options: [
          "Establishing detailed parameter bounds, dimensions, and initial constants systematically",
          "Guessing an approximate integer value based on nearby equations",
          "Failing to read through or verify the steps",
          "Working without structured formulas or equations"
        ],
        correctIndex: 0,
        calculatedAnswer: "Establishing detailed parameter bounds, dimensions, and initial constants systematically",
        explanation: "Mapping initial variables and boundary values ensures safe computations."
      },
      {
        question: "How should a student best prepare for examination problems on this topic?",
        options: [
          "Relying entirely on scanning notes passively during the morning of the exam",
          "Splitting study blocks into active reading, review, and interactive practice tests",
          "Discarding formulas and flashcard summaries",
          "Avoiding any feedback assessments"
        ],
        correctIndex: 1,
        calculatedAnswer: "Splitting study blocks into active reading, review, and interactive practice tests",
        explanation: "Active recall combined with self-assessment is scientifically proven to boost exam scores by up to 50%."
      },
      {
        question: "Why has Kortex generated this specific lesson package?",
        options: [
          "Because your browser profile was deleted",
          "To keep your educational session seamless and uninterrupted during high cloud AI quota traffic",
          "To prevent you from taking actual quizzes",
          "To replace your professor's lectures entirely"
        ],
        correctIndex: 1,
        calculatedAnswer: "To keep your educational session seamless and uninterrupted during high cloud AI quota traffic",
        explanation: "Kortex includes active local fallbacks to ensure student study flows are never interrupted by external server limits."
      }
    ]
  };
}

function getFallbackQuiz(courseTitle: string, courseCode: string, topicTitle: string, numQuestions: number) {
  const cleanTopic = topicTitle || "Selected Study Unit";
  const num = numQuestions || 5;
  const list = [
    {
      question: `Which of the following describes the central focus of ${cleanTopic} inside ${courseCode || "your course"}?`,
      options: [
        "Analyzing governing principles to maximize structural performance",
        "Relying purely on arbitrary values without mathematical rules",
        "Discarding the syllabus structure completely",
        "Translating simple models to unorganized definitions"
      ],
      correctIndex: 0,
      calculatedAnswer: "Analyzing governing principles to maximize structural performance",
      explanation: `Systematic modeling and optimization represents the central core focus of learning ${cleanTopic}.`
    },
    {
      question: `What is highly essential when analyzing complex variables in ${cleanTopic}?`,
      options: [
        "Declaring parameter values, constants, and boundary values carefully",
        "Leaving coefficients unmeasured and unverified",
        "Assuming standard formulas are always irrelevant",
        "Completing the exam without writing out individual steps"
      ],
      correctIndex: 0,
      calculatedAnswer: "Declaring parameter values, constants, and boundary values carefully",
      explanation: "Mapping initial variables and boundary values ensures safe computations."
    },
    {
      question: "In what way do localized practical examples (e.g. trading grids or transit hubs) aid study comprehension?",
      options: [
        "They translate abstract theoretical math into tangible concepts running in high-load environments",
        "They confuse learners and should be skipped",
        "They make simple assignments more difficult",
        "They remove the need for quantitative equations"
      ],
      correctIndex: 0,
      calculatedAnswer: "They translate abstract theoretical math into tangible concepts running in high-load environments",
      explanation: "Contextual examples help the brain form logical hooks, making retention smoother."
    },
    {
      question: "What is the science behind incorporating interactive multiple-choice check questions in Kortex?",
      options: [
        "They stimulate memory retrieval, enforcing active recall and long-term consolidation",
        "They merely capture browser telemetry fields",
        "They are designed to shorten reading guides artificially",
        "To replace standard term papers entirely"
      ],
      correctIndex: 0,
      calculatedAnswer: "They stimulate memory retrieval, enforcing active recall and long-term consolidation",
      explanation: "Active self-testing is more effective than simple passive reading for long-term recall."
    },
    {
      question: "Which habit is proven to be most effective for mastery of technical curriculums?",
      options: [
        "Structuring study preparation into distributed, incremental milestone reviews and practice quizes",
        "Studying multiple engineering topics in a disorganized rush",
        "Refusing to participate in self-assessment quizzes",
        "Studying only under heavy surrounding audio distractions"
      ],
      correctIndex: 0,
      calculatedAnswer: "Structuring study preparation into distributed, incremental milestone reviews and practice quizes",
      explanation: "Spaced repetition and active self-assessment build the strongest neural memory pathways."
    }
  ];
  
  return list.slice(0, num);
}

async function createApp() {
  const app = express();

  // Trust the Replit proxy so express-rate-limit gets the real client IP
  app.set('trust proxy', 1);

  // Middleware to log requests
  app.use((req, res, next) => {
    console.log(`[Express] Received ${req.method} ${req.url}`);
    next();
  });

  // Middleware to parse JSON bodies
  app.use(express.json({ limit: "50mb" }));
  
  // Custom error handler for JSON parsing issues
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && 'body' in err) {
      console.error("Express JSON Syntax Error:", err);
      return res.status(400).json({ error: "Invalid JSON payload sent to server" });
    }
    if (err.type === 'entity.too.large') {
      console.error("Express Payload Too Large:", err);
      return res.status(413).json({ error: "Payload too large" });
    }
    next(err);
  });

  // Rate limiting — 30 AI requests per minute per IP
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a moment before trying again." }
  });
  app.use("/api/generate-course", aiLimiter);
  app.use("/api/generate-study", aiLimiter);
  app.use("/api/generate-quiz", aiLimiter);
  app.use("/api/quiz-explain", aiLimiter);
  app.use("/api/chat", aiLimiter);

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    const dsKey = process.env.DEEPSEEK_API_KEY;
    res.json({
      status: "ok",
      ai: dsKey ? "connected" : "missing_key",
      provider: dsKey ? "deepseek" : "none",
      timestamp: new Date().toISOString()
    });
  });

  // API Diagnostics Route
  app.get("/api/diagnostics", async (req, res) => {
    const results: any = {
      timestamp: new Date().toISOString(),
      keys: {},
      aiTests: {}
    };

    const maskKey = (key: string | undefined) => {
      if (!key) return "NOT_SET";
      if (key.length <= 8) return "SET_BUT_SHORT";
      return `${key.slice(0, 4)}...${key.slice(-4)} (length: ${key.length})`;
    };

    const geminiKey = process.env.GEMINI_API_KEY;
    const dsKey = process.env.DEEPSEEK_API_KEY;
    results.keys.gemini = { status: geminiKey ? "PRESENT" : "MISSING", mask: maskKey(geminiKey) };
    results.keys.deepseek = { status: dsKey ? "PRESENT" : "MISSING", mask: maskKey(dsKey) };

    try {
      if (!geminiKey && !dsKey) {
        results.aiTests.general = { success: false, error: "Neither GEMINI_API_KEY nor DEEPSEEK_API_KEY is set" };
      } else {
        const ai = getDeepSeekClient();
        const testRes = await ai.models.generateContent({
          contents: "Hello, respond with exactly 'OK_TEST'",
        });
        results.aiTests.general = {
          success: true,
          response: testRes.text?.trim()
        };
      }
    } catch (err: any) {
      results.aiTests.general = {
        success: false,
        error: err.message || err.toString()
      };
    }

    return res.json(results);
  });

  // API Routes
  app.post("/api/test", (req, res) => {
    res.json({ status: "success" });
  });

  app.post("/api/generate-course", async (req, res) => {
    const { department } = req.body;
    if (!department || typeof department !== "string" || !department.trim()) {
      return res.status(400).json({ error: "department is required" });
    }
    const prompt = `You are a world-class university curriculum designer. Create ONE highly realistic, comprehensive course for the "${department}" department.
Include:
1. school (set as "University Level")
2. code (e.g. "MTH 101")
3. title
4. description
5. topics: an array of at least 8 progressive topics for this course. Each topic should have a "title", "chapter" (the module name), "chapter_order", and "order".`;

    try {
      const ai = getDeepSeekClient();
      const response = await ai.models.generateContent({
        contents: prompt,
        config: {
          systemInstruction: "You are a professional university curriculum designer. You must return ONLY a valid JSON object matching the requested schema. Do not output conversational preamble or postscript.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              school: { type: Type.STRING },
              code: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              topics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    chapter: { type: Type.STRING },
                    chapter_order: { type: Type.INTEGER },
                    order: { type: Type.INTEGER }
                  },
                  required: ["title", "chapter", "chapter_order", "order"]
                }
              }
            },
            required: ["school", "code", "title", "description", "topics"]
          }
        }
      });

      const responseText = response.text || "{}";
      const coursePackage = parseJsonSafe(responseText);
      return res.json(coursePackage);
    } catch (error: any) {
      console.log(`Course generation failed under current API limits. Activating high-fidelity fallback course: ${error.message || error}`);
      try {
        const coursePackage = getFallbackCourse(department);
        return res.json(coursePackage);
      } catch (fbErr: any) {
        return res.status(500).json({ error: `Failed to compile fallback: ${fbErr.message || fbErr}` });
      }
    }
  });

  app.post("/api/generate-study", async (req, res) => {
    const { topic, course, level, department, school } = req.body;
    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({ error: "topic is required" });
    }
    
    const systemPrompt = `You are an expert, patient, and highly detailed university professor. Your job is to teach full curriculum topics to students who rely entirely on you for their education. You must be comprehensive, rigorous, and thorough, leaving no part of the topic unexplained.

HOWEVER, you are strictly forbidden from using complex vocabulary, academic jargon, or 'big grammar.' You must explain advanced university concepts using simple, everyday English. Whenever you must use a technical term required by the curriculum, define it immediately in brackets (using simple words) before moving on.

STUDENT PROFILE CONTEXT:
- Student Department: ${department || "General Studies"}
- Student Course: ${course || "General Course"}
- Student Level of Study: ${level || "Undergraduate"}
- School/College: ${school || "Institution"}

Core Goal:
Guide the student from complete ignorance to full mastery of the textbook topic. Explanations must be highly personalized to the student's department ("${department || "General Studies"}") and stage of learning ("${level || "Undergraduate"}").

Structure your teaching strictly following "The Deep Teaching Explanation Sequence" below:

Phase 1: The Foundation (The "What" and "Why")
- Provide a clear, jargon-free definition/introduction of the topic.
- Explain why this topic exists. What real-world problem does it solve? If a student understands why a concept was invented, they will care about learning it.

Phase 2: The Deep Dive (The Mechanics)
- Break the topic into its main components, explaining how it works.
- Use a logical, step-by-step progression (e.g., Step 1, Step 2, Step 3) with smaller, logical paragraphs.
- Crucial Rule: Every time a new technical term from the curriculum is introduced, immediately define it in brackets using simple words before moving on.
- Adapt this breakdown to the student's field: Computer Science gets programming/IT examples, engineering students get physical machine examples, business administration gets enterprise/retail examples, and so on.

Phase 3: The Master Analogy or Case Study
- Provide a detailed, highly relatable real-world scenario or case study.
- Use local, everyday examples (like managing a local business, navigating traffic, or dealing with power supply) to map the academic theory directly to reality.

Phase 4: Walkthrough Examples (The "How-To")
- If this is a math, science, engineering, or computing topic, provide a full, step-by-step walkthrough of a calculation, algorithm, or problem solver.
- Explain clearly why you are moving from one step to the next, not just giving the answers.

Phase 5: Common Traps and Misconceptions (Section Title: "Where Most Students Get Confused")
- Call out where students usually fail or get confused.
- Clarify the tricky parts of the topic that usually cause people to fail their continuous assessments or final exams.

Phase 6: Exam Focus (Section Title: "Exam Takeaways")
- Summarize the 3 or 4 core principles they absolutely must remember and write down to get full marks on a course assessment or final exam.

General Rules for High-Quality Teaching:
1. Adapt depth to the student's level ("${level || "Undergraduate"}"). Avoid topics that are too advanced or out-of-scope for this stage.
2. Compare similar or easily confused concepts using Markdown tables (e.g. Compiler vs Interpreter).
3. Always encourage deep critical understanding rather than dry memorization.
4. If programming is involved: explain the concept, provide functional code snippets with inner comments, walk through lines, and explain expected output.

CRITICAL FORMATTING INSTRUCTIONS for Markdown:
- Use standard markdown headings (e.g., '### Heading Text').
- ALWAYS insert two separate newline characters (\\n\\n) before and after every single heading (###), bullet point, or paragraph. Do NOT merge headings with the following paragraph text under any circumstances, as they must render correctly inside standard React markdown parsers.
- Avoid using long block text with no line breaks. Use bullet points and numeric spacing separated by double newlines.

Anytime you are asked about your identity, who you are, or who is speaking, your answer should be Kortex AI.

CRITICAL OBJECTIVE LIMITATION:
You must return ONLY a valid stringified JSON object matching the requested schema. No markdown, conversational or chat elements are allowed outside the designated JSON structure. The 'content' field must contain the detailed formatted study guide under the system prompt tutoring parameters, and 'key_takeaways' must contain the takeaways.`;

    const prompt = `Write a highly detailed, comprehensive study guide, key takeaways, and exactly 5 practice quiz questions for the topic "${topic}" in the course "${course}" suitable for a student at level "${level || 'Undergraduate'}" and department "${department || 'General'}".
Ensure the study guide content field conforms strictly to Kortex AI's tutoring principles and structured sections schema.

CRITICAL PRACTICE QUESTIONS INSTRUCTIONS:
1. For each of the exactly 5 practice quiz questions, you MUST first identify the correct educational or mathematical concept/fact, calculate the correct answer beforehand, and determine the exact option text before choosing distractors (incorrect options).
2. You MUST set 'correctIndex' to be the exact index (0, 1, 2, or 3) of the correct option text in the 'options' array.
3. The 'correctIndex' MUST be 100% synchronized with the generated correct option text and the explanation.
4. Set 'calculatedAnswer' to the exact string representing the correct calculated answer (such as "13" or "A compiler").
5. The 'explanation' (Retrieval Rationale) MUST be simple, short, and highly direct (strictly 1 or 2 sentences maximum), explaining in a very simple way why the correct option is indeed correct, and why option at correctIndex matches the calculated answer.`;

    try {
      const ai = getDeepSeekClient();
      const response = await ai.models.generateContent({
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING, description: "Detailed study guide with headings formatted in Markdown under Kortex AI tutoring principles" },
              key_takeaways: {
                type: Type.ARRAY,
                description: "Key core learnings as individual clear bullet points. Strictly write 3 to 6 distinct and concise points.",
                items: { type: Type.STRING }
              },
              quiz_questions: {
                type: Type.ARRAY,
                description: "Exactly 5 quiz questions",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    correctIndex: { type: Type.INTEGER },
                    calculatedAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ["question", "options", "correctIndex", "calculatedAnswer", "explanation"]
                }
              }
            },
            required: ["content", "key_takeaways", "quiz_questions"]
          }
        }
      });

      const responseText = response.text || "{}";
      const studyPackage = parseJsonSafe(responseText);
      if (studyPackage) {
        // Enforce formatting of key takeaways into clean Markdown points
        if (Array.isArray(studyPackage.key_takeaways)) {
          studyPackage.key_takeaways = studyPackage.key_takeaways
            .map((item: any) => {
              const str = String(item).trim();
              if (str.startsWith('- ') || str.startsWith('* ')) return str;
              return `- ${str}`;
            })
            .join('\n');
        } else if (typeof studyPackage.key_takeaways === 'string') {
          let formatted = studyPackage.key_takeaways.replace(/\\n/g, '\n').trim();
          if (!formatted.startsWith('- ') && !formatted.startsWith('* ')) {
            formatted = formatted
              .split('\n')
              .map((line: string) => {
                const trimmed = line.trim();
                if (!trimmed) return '';
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return trimmed;
                return `- ${trimmed}`;
              })
              .filter(Boolean)
              .join('\n');
          }
          studyPackage.key_takeaways = formatted;
        }

        if (Array.isArray(studyPackage.quiz_questions)) {
          studyPackage.quiz_questions = cleanAndValidateQuestions(studyPackage.quiz_questions);
        }
      }
      return res.json(studyPackage);
    } catch (error: any) {
      console.log(`Study guide generation failed under current API limits. Activating adaptive offline learning guide: ${error.message || error}`);
      try {
        const studyPackage = getFallbackStudy(topic, course);
        return res.json(studyPackage);
      } catch (fbErr: any) {
        return res.status(500).json({ error: `Failed to compile study pack fallback: ${fbErr.message || fbErr}` });
      }
    }
  });

  app.post("/api/generate-image-prompt", async (req, res) => {
    const { title, department } = req.body;
    const prompt = `Generate a short, descriptive 1-sentence prompt for an AI image generator (like Stable Diffusion) for a university course titled "${title}" in the ${department} department. 
The image should be an elegant, modern, academic 3D illustration or a digital art style. 
Avoid text in the image. Keep it professional, clean and educational.
Output ONLY the short prompt string.`;

    try {
      const ai = getDeepSeekClient();
      const response = await ai.models.generateContent({
        contents: prompt,
      });
      const promptText = response.text?.trim() || `educational illustration for ${title} ${department}`;
      return res.json({ content: promptText });
    } catch (error: any) {
      console.log(`Generating image prompt failed. Returning baseline fallback prompt: ${error.message || error}`);
      return res.json({ content: `educational illustration for ${title} ${department}` });
    }
  });

  app.post("/api/generate-quiz", async (req, res) => {
    const { courseTitle, courseCode, topicTitle, numQuestions } = req.body;
    try {
         const prompt = `You are a knowledgeable professor teaching ${courseTitle} (Code: ${courseCode}). 
The student just studied the topic: "${topicTitle}". Generate exactly ${numQuestions || 5} multiple-choice test questions suitable for a university exam about *this specific topic only*.
Make the questions challenging but fair. They must have exactly 4 options.

CRITICAL INSTRUCTIONS FOR ACCURACY:
1. You MUST first identify the correct educational or mathematical concept/fact, calculate the correct answer beforehand, and determine the exact option text before choosing distractors (incorrect options).
2. You MUST set 'correctIndex' to be the exact index (0, 1, 2, or 3) of the correct option text in the 'options' array.
3. The 'correctIndex' MUST be 100% synchronized with the generated correct option text and the explanation.
4. Set 'calculatedAnswer' to the exact string representing the correct calculated answer (such as "13" or "A compiler").
5. The 'explanation' (Retrieval Rationale) MUST be simple, short, and highly direct (strictly 1 or 2 sentences maximum), explaining in a very simple way why the correct option is indeed correct, and why option at correctIndex matches the calculated answer.
6. MANDATORY UNIQUE QUESTIONS: Every single one of the ${numQuestions || 5} questions MUST be completely unique, distinct, and high-quality. Do NOT generate duplicate questions or minor phrasing variations of the same test question. Choose different key definitions, core equations, operational mechanics, features, and use-cases of "${topicTitle}" to verify the student's concept recall broadly and deeply.`;

      const ai = getDeepSeekClient();
      const response = await ai.models.generateContent({
        contents: prompt,
        config: {
          systemInstruction: "You are a professional academic test designer. You must return ONLY a JSON object containing a 'questions' array. No commentary.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    correctIndex: { type: Type.INTEGER },
                    calculatedAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ["question", "options", "correctIndex", "calculatedAnswer", "explanation"]
                }
              }
            },
            required: ["questions"]
          }
        }
      });

      const responseText = response.text || "{}";
      const parsed = parseJsonSafe(responseText);
      const generatedQuestions = parsed.questions || [];
      const validatedQuestions = cleanAndValidateQuestions(generatedQuestions);
      return res.json(validatedQuestions);
    } catch (error: any) {
      console.log(`Quiz generation failed under current API limits. Activating offline academic test parameters: ${error.message || error}`);
      try {
        const generatedQuestions = getFallbackQuiz(courseTitle, courseCode, topicTitle, numQuestions);
        return res.json(generatedQuestions);
      } catch (fbErr: any) {
        return res.status(500).json({ error: `Failed to compile quiz fallback: ${fbErr.message || fbErr}` });
      }
    }
  });

  app.post("/api/quiz-explain", async (req, res) => {
    const { question, options, correctIndex, chosenIndex, userQuery } = req.body;
    try {
      const correctOptionText = Array.isArray(options) && typeof correctIndex === "number" ? options[correctIndex] : "";
      const chosenOptionText = Array.isArray(options) && typeof chosenIndex === "number" ? options[chosenIndex] : "";

      const prompt = `You are Kortex AI, an expert academic tutor.
Below is a multiple-choice question from a practice quiz that a student just answered, along with their selected answer, the correct answer, and their follow-up question.

QUESTION DETAILS:
- Question: "${question}"
- Options:
  A: "${options?.[0] || ''}"
  B: "${options?.[1] || ''}"
  C: "${options?.[2] || ''}"
  D: "${options?.[3] || ''}"
- Correct Answer: Correct Index ${correctIndex} is "${correctOptionText}"
- Student Selected Answer: Selected Index ${chosenIndex} is "${chosenOptionText}"

STUDENT'S FOLLOW-UP QUESTION:
"${userQuery}"

Task:
Answer the student's question clearly, thoroughly, and encouragingly in 2 to 4 sentences. Explain the solution to help them understand the concept deeply.`;

      const ai = getDeepSeekClient();
      const response = await ai.models.generateContent({
        contents: prompt
      });

      return res.json({ explanation: response.text || "I apologize, but I could not formulate an answer right now. Please try again." });
    } catch (error: any) {
      console.error(`Quiz explanation failed:`, error);
      return res.status(500).json({ error: error.message || "Failed to generate explanation." });
    }
  });

  app.post("/api/chat", async (req, res) => {
    const { messages, model, student, topicTitle, courseTitle, studyContext } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }
    const department = student?.department || "";
    const level = student?.level || "";
    const school = student?.school || "";
    const fullName = student?.fullName || "";

    // Set SSE headers upfront
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Stop generating if client disconnects — saves API tokens
    let clientDisconnected = false;
    req.on("close", () => { clientDisconnected = true; });

    try {
      const chatMessages = messages.map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      }));

      let systemInstruction = "";

      if (!studyContext) {
        // GENERAL AI CHAT: Provide normal, general answers like Google or ChatGPT
        systemInstruction = `You are Kortex AI, a helpful, intelligent, and highly knowledgeable AI assistant. Your identity is Kortex AI.
You answer questions in a normal, general, conversational manner, just like Google or ChatGPT would.

CRITICAL INSTRUCTIONS:
1. DO NOT try to force-link everything to the student's registered student profile, registered department, or enrolled course context (${department || "General"}). Only reference these domains if the user's specific query explicitly asks about them or invites that connection.
2. KEEP ANSWERS EXTREMELY CONCISE, SIMPLE, AND SHORT. The completed answer MUST be brief, focused, and straight-to-the-point (strictly under 150 words or 2-3 short, punchy paragraphs maximum). Simple questions should have simple, direct answers. Do NOT write long essays or massive walls of text. This is a conversational AI chat, not a textbook.
3. DO NOT output unsolicited structures such as 'Key Takeaways', 'Common Examination Questions', 'Quick Quizzes', 'Related Topics', or matching textbook study packages, unless specifically asked by the user to do so.
4. TABLE REQUIREMENT: If you create/design a table, always format it as a valid, standard Markdown table (complete with dashes and vertical bars |). Ensure it has clear, readable headings, consistent columns, and matching sides so it renders perfectly as a beautiful structured grid table. Avoid copy-pasting disorganized unstructured plaintext representations that look like broken words or sentences. If you cannot create/design a proper table, do not use one at all; use simple prose or bullet points instead.`;
      } else {
        // CONTEXTUAL ASK AI INSIDE EXPLANATIONS: Keep details as needed for study guides
        systemInstruction = `You are Kortex AI, an AI tutor built for students in universities, polytechnics, and colleges. Your role is to teach topics clearly, accurately, and in a way that matches the active topic and its course subject. Any time you are asked about your identity, who you are, or who is speaking, your answer should be Kortex AI.

STUDENT PROFILE CONTEXT:
- Student Name: ${fullName || "Student"}
- Department: ${department || "General"}
- Level of Study: ${level || "General"}
- School/Institution: ${school || "General"}

ACTIVE MATERIAL CONTEXT:
- Active Topic: "${topicTitle || ""}"
- Course Subject: "${courseTitle || ""}"

Core Goal
Your goal is not just to answer questions, but to help students understand concepts deeply. Explain topics as a good lecturer or tutor would, using simple language and clear examples.
Always assume that the student is learning and may have little or no prior knowledge of the topic.

---

Teaching Principles

1. Base Answers on the Active Topic and Course Domain
Your primary directive is to focus on the active topic ("${topicTitle || ""}") and the course subject ("${courseTitle || ""}").
Do NOT force explanations or examples to align with the student's registered department/major ("${department || "General"}") if they are studying a different or general subject. For example, if a Computer Science student is asking a question about an English, Physics, or Chemistry topic, your explanation and examples MUST pertain purely to that respective topic's domain (English syntax, physical mechanics, or chemical molecular bonds). Only relate topics back to the student's major if they naturally fit or are directly relevant. Ensure the active learning material's domain is the primary context.

---

2. Use Simple Language
Use simple words and short sentences. Avoid complicated grammar and difficult vocabulary unless technical terms are necessary.
When technical terms are used: define them immediately, explain them in plain English, and give practical examples.
The goal is understanding, not sounding academic.

---

3. Structure Every Explanation
Organize explanations beautifully but KEEP THEM VERY SHORT. Use simple, quick bullet points or 1-2 short headings instead of major academic sub-sections. Never output multiple long paragraphs. Keep the explanation brief, sweet, and highly readable.

---

4. Explain Step by Step
Break difficult concepts into smaller pieces. Do not skip steps. Do not assume the student already understands previous concepts. Build explanations from basic to advanced.

---

5. Be Exceptionally Concise and Simple (Mandatory Short Length)
Your completed answer MUST be brief, focused, and short (strictly under 150 words total). Explain the core concept perfectly in simple terms, but KEEP IT BRIEF. Avoid long essays, huge walls of text, or unnecessary academic preamble. The absolute goal is for the student to understand instantly without having to read a long message.

---

6. Use Examples Frequently
Use examples throughout the explanation. All examples should match the domain of the active topic ("${topicTitle || ""}") and course subject ("${courseTitle || ""}"). Do not force irrelevant examples based on his/her registered department unless it naturally fits. IMPORTANT: Use everyday, real-world examples (like cooking, driving, shopping, or sports) that ANYONE can understand. Do NOT use coding or programming examples unless the topic itself is explicitly a coding or programming topic (e.g., Java, Python). Since users are mostly beginners, even for coding courses, keep coding-related analogies to an absolute minimum and rely primarily on universal, everyday analogies. All examples should also match the student's learning level of study ("${level || "General"}").

---

7. Compare Similar Concepts
When concepts are often confused, explain the differences clearly using Markdown tables (e.g., Router vs Switch, RAM vs ROM, Compiler vs Interpreter).

---

8. Use Analogies
Use familiar, real-world analogies to simplify difficult concepts. DO NOT use coding or software-related analogies for non-coding topics. Always prefer analogies based on common human experiences (e.g. baking a cake, building a house, organizing a library).

---

9. Encourage Understanding Instead of Memorization
Focus on helping students understand concepts. Explain why something works, what would happen if it didn't exist, and common student mistakes.

---

10. Explain Mathematics and Formulas
If formulas are involved: write the formula, explain each variable, solve examples step-by-step, show units, and interpret the final answer. Do not skip calculation steps.

---

11. Handle Programming Topics Properly
For programming questions: explain the concept first, then provide code, explain it line by line, mention common mistakes, explain the output, and use comments inside.

---

12. Use Tables When Appropriate
Use tables for differences, comparisons, advantages and disadvantages, features, and classifications.
TABLE REQUIREMENT: If you create/design a table, always format it as a valid, standard Markdown table (complete with dashes and vertical bars |). Ensure it has clear, readable headings, consistent columns, and matching sides so it renders perfectly as a beautiful structured grid table. Avoid copy-pasting disorganized unstructured plaintext representations that look like broken words or sentences. If you cannot create/design a proper table, do not use one at all.

---

13. Answer According to Study Level
Adjust explanation depth according to: ND1, ND2, HND, Undergraduate, Beginner, Intermediate, Advanced. The student is currently studying at level "${level || "General"}". Avoid teaching beyond this level.

---

14. Handle Examination Questions
If asked an exam question: explain the topic first, then provide the full answer showing reasons, teaching the concept.

---

15. If the Question Is Ambiguous
If the user's request is highly ambiguous or vague, ask for their course, department, or level before answering.

---

16. Maintain Accuracy
Never invent facts.

---

17. DO NOT Add Unsolicited Reinforcements
NEVER add unrequested quizzes, exams, key points summary lists, or lists of related topics at the end of every conversation response unless the student explicitly asks you to generate a quiz or exam. Answer simply, clearly, and immediately stop when the question has been answered.

Response Style:
Be friendly, patient, extremely clear, concise, educational, and accurate.
Avoid unnecessary jargon, overly academic language, massive blocks of text, or skipping the core facts. Keep answers relatively brief but highly effective, ensuring the student understands without feeling overwhelmed.`;

        if (topicTitle) {
          systemInstruction += `\n\n- CURRENTLY ACTIVE TOPIC BEING READ BY STUDENT: "${topicTitle}"`;
        }

        if (studyContext) {
          systemInstruction += `\n\n---
CONTEXT OF THE STUDY GUIDE/MATERIAL CURRENTLY BEING READ BY THE STUDENT:
The student is active on the learning screen of the topic "${topicTitle || 'Current Lesson'}". Confidently explain, clarify, or simplify questions about this specific teaching material:
"""
${studyContext}
"""

TUTORING INSTRUCTION REGARDING CONTEXT:
When the user asks questions or raises issues, prioritize referencing, explaining, and elaborating on the study material details provided above. Ensure your responses are tailored to help them master this core concept. Do not copy-paste large blocks verbatim unless requested; instead, explain, break down, give intuitive analogies, or guide step-by-step.`;
        }
      }

      console.log(`Chat API: Streaming response via DeepSeek (${DEEPSEEK_MODEL})`);

      const ai = getDeepSeekClient();
      const responseStream = await ai.models.generateContentStream({
        contents: chatMessages,
        config: {
          systemInstruction
        }
      });

      for await (const chunk of responseStream) {
        if (clientDisconnected) break;
        const text = chunk.text || "";
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      return res.end();
    } catch (error: any) {
      console.log(`Chat API streaming hit API limitations. Sending supportive fallback message: ${error.message || error}`);
      const fallbackText = "Hello! I am Kortex AI. I noticed that we have temporarily reached our high-speed cloud service rate limits, but don't worry! I'm still here to support you in offline local student helper mode.\n\nHow can I help you today? You can ask me study questions, request course outlines, or let me know what topic you are working on!";
      res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }
  });

  // Curriculum PDF parsing — extracts structured courses + topics from curriculum text
  app.post("/api/parse-curriculum", async (req, res) => {
    const { text, department, level, semester, programType, source: requestedSource } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ error: "Extracted curriculum text is required" });
    }

    const source = detectCurriculumSource(text, requestedSource || programType);
    const prepared = prepareCurriculumForParsing(text, source);
    const selectedDepartment = department || (source === "NBTE" ? "Computer Science" : "Computer Science");
    const selectedLevel = level || (source === "NBTE" ? "ND1" : "100 Level");
    const selectedSemester = source === "NBTE" ? (semester || 1) : null;
    const structureText = prepared.sourceText.slice(0, 65000);
    const batches = chunkCurriculumBlocks(prepared.courseBlocks, source === "CCMAS" ? 6 : 5);

    try {
      const ai = getDeepSeekClient();
      const extractedCourses: any[] = [];

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        const courseBlocks = batches[batchIndex]
          .join("\n\n--- COURSE SPECIFICATION ---\n\n")
          .slice(0, 36000);
        const prompt = `You are an expert Nigerian curriculum archivist. Parse one batch of an official ${source} curriculum PDF.

DOCUMENT RULES:
${prepared.note}
- Preserve official course codes and titles exactly; do not invent courses.
- The course structure text is authoritative for course units, levels, and semesters.
- Only return courses represented by the specification excerpts in THIS BATCH.
- Use the specification excerpts to extract actual general objectives, theoretical contents, practical contents, learning outcomes, and assessment topics.
- Ignore table totals, prerequisites, page numbers, repeated headers/footers, admissions prose, and unrelated programmes.
- Do not return duplicate courses unless the excerpts contain genuinely different level/semester offerings.
- A course may have an empty topics array only when no teachable content is present in its excerpt.

IMPORT CONTEXT:
- Department: "${selectedDepartment}"
- Default level if a course row does not state one: "${selectedLevel}"
- Default semester if a course row does not state one: ${selectedSemester ?? "not applicable for this CCMAS level-based structure"}

COURSE STRUCTURE / RELEVANT PDF TEXT:
"""
${structureText}
"""

SPECIFICATION EXCERPTS FOR THIS BATCH:
"""
${courseBlocks}
"""

Return ONLY valid JSON:
{
  "courses": [
    {
      "code": "COM 111",
      "title": "Introduction to Computing",
      "level": "ND1",
      "semester": ${selectedSemester ?? "null"},
      "credit_units": 3,
      "topics": [
        { "title": "History and Evolution of Computers", "chapter": "Foundations of Computing", "chapter_order": 1, "order": 1 }
      ]
    }
  ]
}

Allowed levels: ND1, ND2, HND1, HND2, 100 Level, 200 Level, 300 Level, 400 Level.
For CCMAS, leave semester null unless the excerpt explicitly provides a semester.`;

        const response = await ai.models.generateContent({
          contents: prompt,
          config: {
            systemInstruction: "Extract only official Nigerian curriculum data from the provided text. Return valid JSON and never invent missing courses.",
            responseMimeType: "application/json"
          }
        });
        const parsedBatch = parseJsonSafe(response.text || "{}");
        if (Array.isArray(parsedBatch?.courses)) {
          extractedCourses.push(...parsedBatch.courses);
        }
      }

      const mergedCourses = new Map<string, any>();
      for (const course of extractedCourses) {
        const code = String(course.code || "").replace(/\s+/g, " ").trim().toUpperCase();
        const title = String(course.title || "").replace(/\s+/g, " ").trim();
        if (!code || !title) continue;

        const courseLevel = course.level || selectedLevel;
        const courseSemester = source === "NBTE" && (course.semester === 1 || course.semester === 2)
          ? course.semester
          : source === "NBTE" ? selectedSemester : null;
        const key = `${code}|${courseLevel}|${courseSemester ?? "all"}`;
        const existing = mergedCourses.get(key);
        const incomingTopics = Array.isArray(course.topics) ? course.topics : [];

        if (!existing) {
          mergedCourses.set(key, {
            code,
            title,
            level: courseLevel,
            semester: courseSemester,
            credit_units: Number(course.credit_units) || 2,
            topics: incomingTopics
          });
          continue;
        }

        const topicKeys = new Set((existing.topics || []).map((topic: any) => String(topic.title || "").toLowerCase()));
        for (const topic of incomingTopics) {
          const topicKey = String(topic.title || "").toLowerCase();
          if (topicKey && !topicKeys.has(topicKey)) {
            existing.topics.push(topic);
            topicKeys.add(topicKey);
          }
        }
        existing.credit_units = existing.credit_units || Number(course.credit_units) || 2;
      }

      const courses = Array.from(mergedCourses.values());
      return res.json({
        source,
        department: selectedDepartment,
        detectedSections: prepared.courseBlocks.length,
        batches: batches.length,
        courses
      });
    } catch (error: any) {
      console.error("Curriculum parsing error:", error);
      return res.status(500).json({ error: error.message || "Failed to parse curriculum" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true as any,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Express App Error:", err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
    }
  });

  return app;
}

async function runStartupDiagnostics() {
  console.log("\n=================== STARTUP DIAGNOSTICS ===================");
  const geminiKey = process.env.GEMINI_API_KEY;
  const dsKey = process.env.DEEPSEEK_API_KEY;
  console.log(`[DIAG] GEMINI_API_KEY: ${geminiKey ? "PRESENT (" + geminiKey.slice(0, 4) + "..." + geminiKey.slice(-4) + ")" : "MISSING"}`);
  console.log(`[DIAG] DEEPSEEK_API_KEY: ${dsKey ? "PRESENT (" + dsKey.slice(0, 4) + "..." + dsKey.slice(-4) + ")" : "MISSING"}`);

  if (geminiKey || dsKey) {
    try {
      console.log(`[DIAG] Testing AI Engine provider connection...`);
      const ai = getDeepSeekClient();
      const testRes = await ai.models.generateContent({
        contents: "Say 'AI Engine OK'",
      });
      console.log(`[DIAG] AI response: "${testRes.text?.trim()}"`);
    } catch (e: any) {
      console.error(`[DIAG] AI Engine connection notice: ${e.message || e}`);
    }
  } else {
    console.log("[DIAG] Warning: Neither GEMINI_API_KEY nor DEEPSEEK_API_KEY is defined. AI interactions will rely on local offline fallback.");
  }
  console.log("===================================================================\n");
}

async function startServer() {
  const PORT = 3000;
  const app = await createApp();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    runStartupDiagnostics().catch(err => {
      console.error("[DIAG] Diagnostics error occurred:", err);
    });
  });
}

// Vercel serverless export — Vercel calls this instead of app.listen()
let _vercelApp: any = null;
export default async (req: any, res: any) => {
  if (!_vercelApp) {
    _vercelApp = await createApp();
  }
  _vercelApp(req, res);
};

// Only start the HTTP server in non-Vercel environments
if (!process.env.VERCEL) {
  startServer();
}
