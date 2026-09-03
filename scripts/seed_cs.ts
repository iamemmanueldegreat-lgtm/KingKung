import { db } from '../src/lib/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';

const curriculum = [
  {
    code: 'COM 111',
    title: 'Introduction to Computing',
    credit_units: 2,
    level: 'ND1',
    semester: 1,
    topics: [
      'History of Computers',
      'Classification of Computers',
      'Computer Hardware Components',
      'Computer Software (System & Application)',
      'Data Representation and Number Systems',
      'Basic Computer Operations'
    ]
  },
  {
    code: 'COM 112',
    title: 'Introduction to Digital Electronics',
    credit_units: 2,
    level: 'ND1',
    semester: 1,
    topics: [
      'Basic Concepts of Electricity',
      'Semiconductor Theory',
      'Logic Gates and Truth Tables',
      'Boolean Algebra',
      'Combinational Logic Circuits',
      'Sequential Logic Circuits'
    ]
  },
  {
    code: 'COM 113',
    title: 'Introduction to Programming',
    credit_units: 2,
    level: 'ND1',
    semester: 1,
    topics: [
      'Problem Solving Concepts',
      'Algorithms and Flowcharts',
      'Introduction to Programming Languages',
      'Basic Syntax and Data Types',
      'Control Structures (Sequence, Selection, Iteration)',
      'Functions and Procedures'
    ]
  },
  {
    code: 'COM 121',
    title: 'Scientific Programming Language (Java/C++)',
    credit_units: 2,
    level: 'ND1',
    semester: 2,
    topics: [
      'Introduction to Object Oriented Programming',
      'Classes and Objects',
      'Methods and Constructors',
      'Inheritance and Polymorphism',
      'Arrays and Strings',
      'File Handling and Exceptions'
    ]
  },
  {
    code: 'COM 123',
    title: 'Computer Application Packages I',
    credit_units: 2,
    level: 'ND1',
    semester: 2,
    topics: [
      'Word Processing Concepts',
      'Advanced Document Formatting',
      'Spreadsheet Concepts and Formulas',
      'Data Analysis with Spreadsheets',
      'Presentation Software Basics',
      'Database Management Basics (Access)'
    ]
  },
  {
    code: 'COM 124',
    title: 'Data Structures and Algorithms',
    credit_units: 2,
    level: 'ND1',
    semester: 2,
    topics: [
      'Introduction to Data Structures',
      'Arrays, Records, and Pointers',
      'Linked Lists',
      'Stacks and Queues',
      'Trees and Graphs',
      'Sorting and Searching Algorithms'
    ]
  },
  {
    code: 'BAM 111',
    title: 'Introduction to Business I',
    credit_units: 2,
    level: 'ND1',
    semester: 1,
    department: 'Business Administration & Management',
    topics: [
      'The Concept and Scope of Business',
      'Business Environment',
      'Forms of Business Ownership',
      'Business Location and Layout',
      'Business Finance and Sources of Capital',
      'The Role of Government in Business'
    ]
  },
  {
    code: 'BAM 112',
    title: 'Principles of Economics I',
    credit_units: 2,
    level: 'ND1',
    semester: 1,
    department: 'Business Administration & Management',
    topics: [
      'Basic Economic Concepts',
      'Theory of Demand and Supply',
      'Elasticity of Demand and Supply',
      'Theory of Consumer Behaviour',
      'Theory of Production',
      'Market Structures'
    ]
  }
];

async function seedCurriculum() {
  const school = 'NBTE';
  const program_type = 'polytechnic';

  console.log('Starting seed process for CS and BAM...');
  
  for (const course of curriculum) {
    const department = course.department || 'Computer Science';
    const safeCode = course.code.replace(/[^a-zA-Z0-9]/g, '');
    const docId = `${department.replace(/[^a-zA-Z0-9]/g, '')}-${course.level}-s${course.semester}-${safeCode}`.toLowerCase();
    
    console.log(`Processing ${course.code} - ${course.title}`);
    
    const courseRef = doc(db, 'courses', docId);
    
    const coursePayload = {
      code: course.code,
      title: course.title,
      school,
      department,
      level: course.level,
      semester: course.semester,
      credit_units: course.credit_units,
      program_type,
      source: school,
      description: `${course.title} — ${department}, ${course.level}, Semester ${course.semester}`,
      createdAt: new Date().toISOString()
    };
    
    const batch = writeBatch(db);
    batch.set(courseRef, coursePayload, { merge: true });
    
    const topicsRef = collection(db, `courses/${docId}/topics`);
    
    course.topics.forEach((topicTitle, idx) => {
      const safeTitle = topicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40);
      const topicId = `1-${idx + 1}-${safeTitle}`;
      
      const topicRef = doc(topicsRef, topicId);
      batch.set(topicRef, {
        id: topicId,
        course_id: docId,
        title: topicTitle,
        chapter: 'General Objectives',
        chapter_order: 1,
        order: idx + 1,
        content: `Content for ${topicTitle} has not been fully populated yet.`,
        createdAt: new Date().toISOString()
      }, { merge: true });
    });
    
    await batch.commit();
  }
  
  console.log('Curriculum seeding complete!');
  process.exit(0);
}

seedCurriculum().catch(console.error);
