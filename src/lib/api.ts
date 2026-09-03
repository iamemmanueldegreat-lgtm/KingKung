export const generateCourseForDepartment = async (department: string) => {
  try {
    const res = await fetch("/api/generate-course", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department }),
    });
    if (!res.ok) throw new Error("Network response was not ok");
    return await res.json();
  } catch (error) {
    console.error("AI Generation Error for department:", department, error);
    return null;
  }
};

export interface GeneratedStudyPackage {
  content: string;
  key_takeaways: string;
  quiz_questions: any[];
}

export const generateStudyContent = async (
  topic: string,
  course: string,
  level: string,
  department: string = '',
  school: string = ''
): Promise<GeneratedStudyPackage> => {
  try {
    const res = await fetch("/api/generate-study", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, course, level, department, school }),
    });
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    return {
      content: data.content || '',
      key_takeaways: data.key_takeaways || '',
      quiz_questions: data.quiz_questions || []
    };
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw new Error("Failed to generate study content. Please try again.");
  }
};

export const generateCourseImagePrompt = async (title: string, department: string) => {
  try {
    const res = await fetch("/api/generate-image-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, department }),
    });
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    return data.content;
  } catch (error) {
    console.error("AI Generation Error:", error);
    return `educational illustration for ${title} ${department}`;
  }
};
