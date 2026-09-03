import { db } from '../src/lib/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';

const curriculum = [
  { code: 'EEC 111', title: 'Electrical Drawings', level: 'ND1', semester: 1, credit_units: 3, topics: ['Understand symbols of electrical and electronic components', 'Know how to read and interpret Electrical and Electronic drawings', 'Know how to draw diagrams for electrical and electronic circuits using standard symbols', 'Understand how to draw diagrams using dedicated Computer Aided Design (CAD) software'] },
  { code: 'EEC 112', title: 'Introduction to Digital Electronics', level: 'ND1', semester: 1, credit_units: 3, topics: ['Know the basic concept of Number System', 'Understand Logic Gates', 'Know Logic Simplification and its Applications', 'Know Multiplexers and De-Multiplexers', 'Understand Latches, flip-flops, and Counters', 'Understand Microcontrollers and Programming'] },
  { code: 'EEC 113', title: 'Technical Documentation and Report Writing', level: 'ND1', semester: 1, credit_units: 3, topics: ['Understand the principles of technical communication', 'Know tools and software for creating and editing technical documents', 'Understand the structure and formatting of technical documentation', 'Know professional technical report writing', 'Understand logbooks, work reports, risk assessments and method statements', 'Create project documentation'] },
  { code: 'EEC 114', title: 'Electrical Engineering Science I', level: 'ND1', semester: 1, credit_units: 3, topics: ['Understand the concept of the electric current flow', 'Understand simple DC circuits', 'Understand types of energy and their inter-relationships', 'Understand the concept of electrostatics, electric charge and capacitance of a capacitor'] },
  { code: 'EEC 115', title: 'Industrial Health and Safety', level: 'ND1', semester: 1, credit_units: 2, topics: ['Integrate health and safety procedures into the work environment', 'Relate legislation from the Occupational Health and Safety Act and regulations', 'Know how to deal with hazards', 'Know the methods of control that will reduce exposure to hazards', 'Understand health and safety practices', 'Understand the concept of First Aid'] },
  { code: 'EEC 121', title: 'Electrical Power I', level: 'ND1', semester: 2, credit_units: 2, topics: ['Understand the principles of generation and transmission of electrical energy', 'Understand the basic principles of distribution systems', 'Understand the basic principles of protection in power systems', 'Understand types of insulators and support structures'] },
  { code: 'EEC 122', title: 'Electrical Machine I', level: 'ND1', semester: 2, credit_units: 2, topics: ['Understand the concept of magnetism', 'Understand the basic principles of DC Generator', 'Understand the basic principle of DC Motor', 'Understand the basic principles of Single Phase Induction Motor'] },
  { code: 'EEC 123', title: 'Electronics I', level: 'ND1', semester: 2, credit_units: 2, topics: ['Understand the concept of passive components', 'Understand the concept of active components', 'Understand characteristics of a PN Junction and Zener Diode', 'Understand the application of Bipolar Junction Transistor', 'Understand the basic structure and application of Thyristor'] },
  { code: 'EEC 124', title: 'Electrical Engineering Science II', level: 'ND1', semester: 2, credit_units: 3, topics: ['Understand the concepts of magnetism and magnetic circuits', 'Understand the concepts of electromagnetism and electromagnetic induction', 'Understand the concepts of inductance and its applications', 'Understand the fundamentals of Alternating Current (AC) Theory', 'Understand the principles of a.c circuits and their applications'] },
  { code: 'EEC 125', title: 'Electrical and Electronics measurement and Instrumentation', level: 'ND1', semester: 2, credit_units: 2, topics: ['Know electrical and electronic instruments', 'Understand error in measurement', 'Understand measurement instruments in electrical and electronics systems', 'Understand the working principles and constructions of meters and merger', 'Understand controllers and controller design (Proportional Integral Derivative, PID)'] },
  { code: 'EEC 126', title: 'Telecommunication I', level: 'ND1', semester: 2, credit_units: 2, topics: ['Understand the basic principles of telecommunication system', 'Understand the principles of operation and application of various transducers', 'Understand the basic principles of modulation and demodulation of signals', 'Understand the principles of operation of receivers', 'Understand the principles of electro-magnetic wave propagation', 'Understand the principle of radio frequency (RF) wave propagation', 'Understand computer networks'] },
  { code: 'EEC 127', title: 'Electrical Installation of Buildings', level: 'ND1', semester: 2, credit_units: 2, topics: ['Understand electrical/electronic standard symbols', 'Understand schematic, wiring diagrams and earthing system', 'Interpret Building drawings and symbols', 'Understand cables and IEE wiring Regulations', 'Understand bill of quantities of materials for the electrical installation of building', 'Understand Solar power installation, home automation and smart metering'] },
  { code: 'EEC 211', title: 'Electrical Power II', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand other methods of Electricity Generation', 'Understand the transmission lines and cable', 'Understand the performance of short, medium and long transmission lines'] },
  { code: 'EEC 212', title: 'Electrical Machine II', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand the fundamental principles of electrical machines', 'Understand the principles of electro-mechanical energy conversion', 'Know the principles of operation and construction of transformers'] },
  { code: 'EEC 213', title: 'Electronics II', level: 'ND2', semester: 1, credit_units: 3, topics: ['Understand the Field Effect transistor and its applications', 'Understand the biasing equivalent circuits and gain stages', 'Understand the Transformer coupling and power and multistage of amplifiers'] },
  { code: 'EEC 214', title: 'Electric Circuit Theory I', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand a.c theory and its applications in simple electrical circuits', 'Know mesh and nodal analysis and their applications in solving electrical circuits problems', 'Understand network transformation and duality principles', 'Understand network theorems and their applications to d.c and a.c circuits'] },
  { code: 'EEC 215', title: 'Use of Electrical and Electronics Instruments', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand an Oscilloscope', 'Understand the operation of power meter', 'Understand the factors for selection of electrical and electronic instruments', 'Understand the importance of electrical instruments in industries', 'Understand controllers and controller design (Proportional Integral Derivative, PID)'] },
  { code: 'EEC 216', title: 'Telecommunication II', level: 'ND2', semester: 1, credit_units: 2, topics: ['Know the basic principles of audio-visual (Television) signal transmission', 'Know various frequency bands within the radio frequency spectrum', 'Understand the principles of electro-magnetic wave propagation', 'Understand the principle of radio frequency (RF) wave propagation', 'Understand computer networks'] },
  { code: 'EEC 217', title: 'Computer Hardware and Software I', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand the basic functions of a computer', 'Understand the computer hardware components', 'Understand Human-Computer Interaction', 'Understand Application software packages', 'Understand the operation of computer hardware components'] },
  { code: 'EEC 218', title: 'Research Methods in Electrical and Electronics Engineering Technology', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand the Concept of Research in Electrical and Electronics Engineering Technology', 'Understand Terminologies in Electrical and Electronics Engineering Research', 'Understand the Methods of Research in Electrical and Electronics Engineering', 'Understand Sampling Techniques in Electrical and Electronics Engineering Research', 'Understand Data Collection Techniques in Electrical and Electronics Engineering Research', 'Understand Research Report Writing and Presentation'] },
  { code: 'EEC 221', title: 'Electrical Power III', level: 'ND2', semester: 2, credit_units: 2, topics: ['Understand the performance of load flow in an interconnected power system', 'Understand the fault analysis in interconnected power systems', 'Understand the principles of protection systems'] },
  { code: 'EEC 222', title: 'Computer Hardware and Software II', level: 'ND2', semester: 2, credit_units: 2, topics: ['Understand Computer Hardware Repairs', 'Understand Computer Fault Diagnosis', 'Understand basic structure and function of python software', 'Understand MATLAB software'] },
  { code: 'EEC 223', title: 'Electronics III', level: 'ND2', semester: 2, credit_units: 3, topics: ['Understand the nature of feedback in relation to amplifier', 'Understand Controllers and Controller design', 'Understand Oscillators and Multivibrators in electronic circuits', 'Know power converters and their applications'] },
  { code: 'EEC 224', title: 'Electric Circuit Theory II', level: 'ND2', semester: 2, credit_units: 2, topics: ['Understand the principle of power calculation in a.c circuits', 'Understand the basic principles of three-phase systems', 'Know time domain analysis of RC and RL circuits', 'Understand the concept of magnetic coupling phenomena'] },
  { code: 'EEC 225', title: 'Introduction to Industrial Automation', level: 'ND2', semester: 2, credit_units: 3, topics: ['Understand Automation System', 'Understand Programmable Logic Controller', 'Know PLC Software and Programming Tools', 'Understand PLC fault diagnosis and troubleshooting principles including software tools', 'Understand Robotics System', 'Understand Mechatronics System', 'Know how to use Human-Machine Interfaces (HMI)'] }
];

async function seedCurriculum() {
  const school = 'NBTE';
  const program_type = 'polytechnic';
  const department = 'Electrical/Electronic Engineering';

  console.log(`Starting seed process for ${department}...`);
  
  for (const course of curriculum) {
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
