import { db } from '../src/lib/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';

const curriculum = [
  { code: 'MAC 111', title: 'Media Writing and Style I', level: 'ND1', semester: 1, credit_units: 3, topics: ['Know communication and its process', 'Understand media writing', 'Understand the responsibilities of a media writer', 'Know the skills of writing for radio', 'Know the skills of writing for television', 'Know the skills of writing an advertising copy', 'Know the skills of proof reading and editing in media writing'] },
  { code: 'MAC 113', title: 'Computer Application for Media and Communication', level: 'ND1', semester: 1, credit_units: 3, topics: ['Understand the concept of computer', 'Know the hardware and software components of a computer', 'Know word processing application', 'Know spreadsheet application in media and communication', 'Know presentation application in media and communication', 'Know Screen writing applications in film', 'Understand web browser as a tool for media and communication'] },
  { code: 'MAC 114', title: 'Foundation of Media and Communication', level: 'ND1', semester: 1, credit_units: 2, topics: ['Understand the concept of Communication', 'Understand the models of Communication', 'Understand the concept of Media', 'Understand Media and Communication as a social force', 'Understand Media and Communication Audience'] },
  { code: 'MAC 115', title: 'News writing and Reporting I', level: 'ND1', semester: 1, credit_units: 3, topics: ['Understand the concept of storytelling', 'Understand the concept of news', 'Know the news sources and process of news gathering', 'Know the concept of newswriting', 'Know the structure of news story', 'Know the duties and responsibilities of a reporter'] },
  { code: 'MAC 116', title: 'Fundamentals of Broadcasting', level: 'ND1', semester: 1, credit_units: 3, topics: ['Understand the evolution of broadcasting', 'Know Radio as medium of broadcasting', 'Know Television as medium of broadcasting', 'Understand the role of National and international broadcasting organizations'] },
  { code: 'MAC 117', title: 'Principles of Advertising', level: 'ND1', semester: 1, credit_units: 3, topics: ['Understand the concept of advertising', 'Understand advertising as a communication process', 'Understand the roles of advertising in the society', 'Know the features of advertising', 'Understand advertising appeal', 'Understand advertising media', 'Understand the role of research in advertising', 'Know the preparation and production of advertising materials', 'Understand the legal and ethical environment of advertising', 'Know an Advertising agency', 'Understand new trends in advertising', 'Know career prospects in advertising'] },
  { code: 'MAC 121', title: 'Media Writing and Style II', level: 'ND1', semester: 2, credit_units: 2, topics: ['Know print media writing', 'Know the skills of writing for Public Relations', 'Know the skills of digital media writing', 'Understand style in media writing', 'Know idiomatic expressions in Media Writing'] },
  { code: 'MAC 122', title: 'Indigenous Communication Systems', level: 'ND1', semester: 2, credit_units: 2, topics: ['Understand the concept of Indigenous Communication Systems', 'Know the instruments of indigenous communication', 'Understand the iconography of indigenous communication', 'Know the demonstrative channels of indigenous communication', 'Know folk media and extra-mundane means of communication', 'Know verbal Communication, Media and information dissemination in Nigeria', 'Know the use of names, venue-oriented, and institutional channels of indigenous communication'] },
  { code: 'MAC 123', title: 'Digital Communication', level: 'ND1', semester: 2, credit_units: 3, topics: ['Understand the concept of digital communication', 'Know the uses of email', 'Know short message services (SMS) and multimedia messaging services (MMS)', 'Know blogging as digital communication', 'Understand podcast as digital communications', 'Understand website as digital communication', 'Understand the concept of digital media', 'Know social media as digital media platforms', 'Understand digital footprints and reputation'] },
  { code: 'MAC 124', title: 'Graphic design for media and communication', level: 'ND1', semester: 2, credit_units: 3, topics: ['Know the concept of graphic', 'Know graphic designer in media and communication', 'Understand the concept of typography', 'Understand measurement and sizes in graphic design', 'Know paper and ink quality', 'Know layout and design formats', 'Know production of posters, flyers and banners', 'Know graphics for set design and captioning of audio-visual production', 'Understand emerging trends in media and communication graphics'] },
  { code: 'MAC 125', title: 'News Writing and Reporting II', level: 'ND1', semester: 2, credit_units: 3, topics: ['Understand Beat reporting', 'Understand style and headline casting in news writing and reporting', 'Understand research-based reporting', 'Know to write specialised news report', 'Know the professional hazards and safety measures in reporting', 'Understand legal and ethical limitations in reporting', 'Know the application of software in news writing and reporting'] },
  { code: 'MAC 126', title: 'Principles of Public Relations', level: 'ND1', semester: 2, credit_units: 3, topics: ['Understand the history of public relations', 'Understand the communication process in public relations', 'Understand the roles and functions of public relations in the society', 'Understand the Publics in public relations', 'know the strategic tools of public relations', 'Understand the media of public relations', 'Know public relations research', 'know to prepare and produce public relations copy', 'Know the structure, personnel and functions of a public relations consulting firm', 'Understand legal and ethical environment of public relations', 'Understand new trends in public relations', 'Know career prospects in public relations'] },
  { code: 'MAC 211', title: 'Media and Communication Theory', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand concept of Communication', 'Understand media and communication theories', 'Understand models of media and communication theories', 'Understand effects and functional theories of media and communication', 'Understand technological determinism theory of media and communication'] },
  { code: 'MAC 212', title: 'Research Methods in Media and Communication', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understands the concepts of media and communication research', 'Know the terminologies of media and communication research', 'Know the methods of media and communication research', 'Know sampling techniques in media and communication research', 'Know data collection techniques in media and communication research', 'Know research report writing and presentation'] },
  { code: 'MAC 213', title: 'Editing and Fact Checking', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand Copy Editing', 'Understand the need for copy editing', 'Understand editing applications', 'Know editing of articles', 'Know fact checking in media and communication text'] },
  { code: 'MAC 214', title: 'Feature Writing', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand Feature articles', 'Understand research and the stages in writing Features', 'Understand styles in feature article writing', 'Understand the use of illustration in feature article writing'] },
  { code: 'MAC 215', title: 'Media, Communication and Society', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand the relationship between media, government and society', 'Understand the development of Nigerian media from 1859 to date', 'Understand media ownership and control', 'Understand functions of media in society', 'Understand the concept of press freedom', 'Understand media regulatory agencies', 'Understand media and information literacy'] },
  { code: 'MAC 216', title: 'Media and Communications Ethics', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand the concepts of ethics', 'Understand the theories of ethics in media and communication', 'Understand morality in ethics', 'Know ethical issues of professional practice in media and communication industry', 'Know the codes of ethics of professional bodies in media and communication industry', 'Know guidelines for protection of sources of news', 'Know principal guidelines to ethical decision making'] },
  { code: 'MAC 217', title: 'Photography in media and communication', level: 'ND2', semester: 1, credit_units: 2, topics: ['Understand the history of photography', 'Understand camera in photography', 'Understand light and exposure in photography', 'Know darkroom procedure in photography development', 'Know editing in photography', 'Understand modern photography'] },
  { code: 'MAC 218', title: 'Broadcast Production I', level: 'ND2', semester: 1, credit_units: 3, topics: ['Understand the process of radio broadcast production', 'Understand the process of television broadcast production', 'Know scripts writing for radio and television production', 'Understand the technical aspects of radio production', 'Understand the technical aspects of television production', 'Know production techniques of programmes'] },
  { code: 'MAC 219', title: 'Foundations of Film Production', level: 'ND2', semester: 1, credit_units: 3, topics: ['Understand Film Production', 'Know Preproduction', 'Know Production', 'Know Post-Production'] },
  { code: 'MAC 221', title: 'Foundation of Child Rights Reporting and Advocacy', level: 'ND2', semester: 2, credit_units: 2, topics: ['Understand the Concept of Child and the Basket of Rights', 'Understand Laws and Conventions on Child Rights', 'Know the Factors responsible for the development of a Child', 'Know the role of media in the promotion of Child Rights', 'Know human rights and human rights-based organizations'] },
  { code: 'MAC 222', title: 'Speech Communication', level: 'ND2', semester: 2, credit_units: 2, topics: ['Know the classical theory of rhetoric’s', 'Know speech process', 'Know audience and speaking occasion', 'Know selection of a speech subject and purpose', 'Understand speech composition', 'Know the basic sound of speech', 'Know how to pronounce correctly', 'Know the development effective speaking voice', 'Know the principles of effective speech delivery'] },
  { code: 'MAC 223', title: 'Newspaper and Magazine Production', level: 'ND2', semester: 2, credit_units: 3, topics: ['Understand the history of newspaper publications', 'Know the structure of a newspaper organization', 'Understand the history of magazine publications', 'Know the structure of a magazine organization', 'Know copy editing and page planning in newspaper and magazine production', 'Know techniques in newspaper and magazine production in an era of ICT', 'Understand Newspaper and magazine circulation and marketing', 'Understand the effects of technology on newspapers and magazine publications'] },
  { code: 'MAC 224', title: 'Broadcast Production II', level: 'ND2', semester: 2, credit_units: 2, topics: ['Know audience research in broadcast production', 'Know radio programmes production and presentation', 'Know television programmes production and presentation', 'Know the outside broadcast production and streaming'] },
  { code: 'MAC 225', title: 'Media and Communication Law', level: 'ND2', semester: 2, credit_units: 2, topics: ['Know the nature of law and legal systems in Nigeria', 'Know the concept of media law', 'Know defamation in media and communication law', 'Know contempt in media and communication law', 'Know copyright in media and communication law', 'Understand the law of sedition', 'Know the restrictions on invasion of privacy', 'Know the FOI Law and Cybercrime law'] },
  { code: 'MAC 226', title: 'Investigative and Interpretative Reporting', level: 'ND2', semester: 2, credit_units: 3, topics: ['Understand investigative reporting', 'Know investigation in journalism', 'Know investigative report writing', 'Understand interpretative reporting', 'Know interpretative report writing', 'Understand the legal and ethical issues of investigative and investigative reporting'] },
  { code: 'MAC 227', title: 'Media, Democracy and Governance', level: 'ND2', semester: 2, credit_units: 2, topics: ['Understand the concept of democracy', 'Understand the concept of good governance', 'Understand the roles of international institutions in promoting democracy and good governance', 'Understand role of the media in promoting democracy and good governance'] }
];

async function seedCurriculum() {
  const school = 'NBTE';
  const program_type = 'polytechnic';
  const department = 'Mass Communication';

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
