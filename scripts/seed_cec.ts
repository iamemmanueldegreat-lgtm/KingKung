import { db } from '../src/lib/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';

const curriculum = [
  { code: 'CEC 101', title: 'Structural Mechanics', level: 'ND1', semester: 1, credit_units: 2, topics: ['Know the equation of static equilibrium of structures', 'Understand the kinetics of rigid bodies', 'Know analytical and graphical methods of determining member forces in roof and plant frames'] },
  { code: 'CEC 103', title: 'Workshop Technology I', level: 'ND1', semester: 1, credit_units: 1, topics: ['Setting out a simple residential building foundation and super structure', 'Demonstrate plumbing for waste water', 'Laying of blocks/brick in different bonds', 'Identify constraction wood types, sizes and nails, Screws', 'Prepare a piece of wood by hand and machine', 'Carpentry and joinery workshop'] },
  { code: 'CEC 105', title: 'Civil Engineering Construction I', level: 'ND1', semester: 1, credit_units: 3, topics: ['Know the various building components and their functional requirements', 'Understand the preliminaries involved in the construction of building', 'Understand the general principles of selecting and preparing sites to receive various types of foundation', 'Understand the principle of damp-proofing in building', 'Know the different types of floors', 'Understand masonry wall construction', 'Know the types, principles and rules governing stair construction', 'Know the types of roofs ceiling structures and coverings'] },
  { code: 'CEC 107', title: 'Introduction to Fluid Mechanics', level: 'ND1', semester: 1, credit_units: 2, topics: ['Understand the general properties of fluids', 'Know fluid statics and pressure effects on fluids', 'Understand buoyancy of floating bodies', 'Understand the basic principle of fluid motion', 'Know about flow through office weirs', 'Understand the different types of flow in pipes', 'Understand the nature of uniform flow in open channel'] },
  { code: 'CEC 102', title: 'Introductory Hydrology', level: 'ND1', semester: 2, credit_units: 2, topics: ['Understand the concept of Hydrologic Cycle', 'Understand what make up the weather and climate of a place', 'Understand precipitation as an important component of the hydrological process', 'Understand the basic concept of evaporation and transpiration', 'Know the basic concepts of run-off', 'Understand the processes of infiltration and interception'] },
  { code: 'CEC 104', title: 'Science and Properties of Materials', level: 'ND1', semester: 2, credit_units: 3, topics: ['Understand the internal structure of the atom', 'Understand the microstructure of solids', 'Understand the macroscopic properties of materials', 'Know various types and properties of aggregates used in Civil Engineering', 'Know types and properties of other materials used in Civil Engineering Construction', 'Know the types and properties of cement', 'Understand the properties and uses of concrete', 'Know Properties and Uses of Ferrocement'] },
  { code: 'CEC 106', title: 'Strength of Materials', level: 'ND1', semester: 2, credit_units: 3, topics: ['Understand the behaviour of materials at stresses below and above elastic limit', 'Understand the properties of sections', 'Understand the principles of deflection', 'Understand the effect of torsion on circular section', 'Understand the use of Mohr\'s circles'] },
  { code: 'CEC 108', title: 'Engineering Geology and Basic Soil Mechanics', level: 'ND1', semester: 2, credit_units: 3, topics: ['Know the nature and composition of the earth crust', 'Know all aspects of structural geology', 'Understand geological surface processes', 'Understand principal geological factors affecting some engineering projects', 'Know about soil mechanics, its applications ad classifications', 'Know about surface drainage and groundwater lowering', 'Know the principle of neutral and effective stresses', 'Understand the crystal formation of soils using clay mineralogy'] },
  { code: 'CEC 110', title: 'Civil Engineering Construction II', level: 'ND1', semester: 2, credit_units: 3, topics: ['Know the use of scaffolding', 'Know the various types of fenestrations in buildings', 'Know the different types of finishes for floors, walls and ceilings', 'Understand the needs for external works around the buildings', 'Understand the general administration of building construction works', 'Understand various requirements as regards fire precautions'] },
  { code: 'CEC 201', title: 'Hydraulics and Hydrology', level: 'ND2', semester: 1, credit_units: 3, topics: ['Understand the importance of uniform flow in open channel', 'Understand the importance of non-uniform flow in open channel', 'Understand the importance of unsteady flow', 'Know the different types of instruments for measuring precipitation', 'Understand the method of determining average precipitation', 'Understand rainfall analysis and their applications', 'Understand the concept of evaporation and the factors affecting it', 'Understand the nature of evaporating surfaces'] },
  { code: 'CEC 203', title: 'Workshop Technology II', level: 'ND2', semester: 1, credit_units: 1, topics: ['PLUMBING, SEWAGE, WELDING AND ELECTRICAL INSTALLATION', 'Installation of a typical plumbing assignment', 'Survey on the sources of water supply and drain runs', 'Use the principles of sewage disposal', 'Cutting and filling operations on steel, aluminium, tin', 'Carry out cable jointing and circuit exercises'] },
  { code: 'CEC 205', title: 'Theory of Structures I', level: 'ND2', semester: 1, credit_units: 3, topics: ['Know the different methods of computing slope and deflection', 'Know the principles for the stability of dams, retaining walls and chimneys', 'Understand interminancy in beams'] },
  { code: 'CEC 207', title: 'Hydrogeology', level: 'ND2', semester: 1, credit_units: 1, topics: ['Understand the occurrences of ground water distribution and their uses', 'Understand factors that affect water movement in soils', 'Know the principles of groundwater investigation/exploration', 'Understand the principles of Groundwater exploitation', 'Understand the chemical characteristics of groundwater'] },
  { code: 'CEC 209', title: 'Civil Engineering Drawing I', level: 'ND2', semester: 1, credit_units: 2, topics: ['Know the drawing office practice', 'Understand how to create linear and aligned dimensions', 'Understand building layout orientation', 'Know the production of Civil Engineering drawings in standard Format', 'Understand the view of two and three storey buildings with basement in detail', 'Understand reinforced concrete structural detailing'] },
  { code: 'CEC 211', title: 'Civil Engineering Construction III', level: 'ND2', semester: 1, credit_units: 3, topics: ['Know the various processes and sequence of Highway Construction', 'Know the various construction equipment required for Highway Construction', 'Know the safety devises required to be put in place during Highway construction', 'Know the furniture required to be put in place on the completed highway'] },
  { code: 'CEC 202', title: 'Water Supply and Sanitary Engineering', level: 'ND2', semester: 2, credit_units: 3, topics: ['Understand how to estimate water demand', 'Know sources of water', 'Know the principles of intake design', 'Know the different type of pumps and their selections', 'Understand the basic water treatment processes', 'Understand the methods of storage and distribution of treated water', 'Know the general principles involved in rural water supply', 'Know the sources and characteristics of waste water', 'Understand basic methods and processes of sewage treatment', 'Know major sewer appurtenances', 'Understand the effects of pollution and the methods of control'] },
  { code: 'CEC 204', title: 'Introduction to Highway Engineering', level: 'ND2', semester: 2, credit_units: 2, topics: ['Understand the necessity of providing highway or road for a community', 'Know the history of development of Highway in Nigeria', 'Know the highway administration and financing in Nigeria', 'Know the terms used in highway scheme', 'Understand the compaction of soils as a means of improving soil strength', 'Know the processes of pavement construction', 'Know the equipment in road construction', 'Know the materials for pavement construction', 'Know the procedure for pavement maintenance and repairs'] },
  { code: 'CEC 206', title: 'Introduction to Structural Design', level: 'ND2', semester: 2, credit_units: 2, topics: ['Understand the elastic, load factor and limit state methodology design in reinforced concrete elements', 'Know the various types of foundation', 'Understand simple structural steel design for tension, compression and flexure'] },
  { code: 'CEC 208', title: 'Soil Science and Irrigation Engineering', level: 'ND2', semester: 2, credit_units: 2, topics: ['Understand the concept of soil science and irrigation', 'Understand the interrelation of soil, moisture and plant', 'Know the methods of application of water to soils', 'Know the quality characteristics of irrigation water', 'Understand the principles of field drainage and flood control'] },
  { code: 'CEC 210', title: 'Civil Engineering Drawing II', level: 'ND2', semester: 2, credit_units: 2, topics: ['Understand drawing detailing of reinforced concrete members', 'Understand steel structural frame members', 'Understand sanitary engineering drawing', 'Understand the details of sanitary engineering facilities', 'Know air conditioning and duct layout', 'Understand external work involved in building', 'Understand the general principle of a canal and irrigation Engineering drawing', 'Understand the drawing special stairs'] },
  { code: 'CEC 212', title: 'Soil Mechanics I', level: 'ND2', semester: 2, credit_units: 3, topics: ['Understand the principle of compaction and its determination', 'Know about California Bearing Ratio (CBR)', 'Know Darcy’s Law and permeability in soil', 'Understand Soil Stabilization', 'Know shear strength of soils and application to determination of bearing capacity', 'Understand the earth pressure theories', 'Understand the compressibility and settlement of soils'] },
  { code: 'CEC 214', title: 'Engineering Measurement & Evaluation', level: 'ND2', semester: 2, credit_units: 2, topics: ['Understand the duties and relation of professional in connection with Civil Engineering Contracts', 'Know the main purposes of Civil Engineering Measurement And Evaluation', 'Understand choice of the methods of preparing Civil Engineering Measurements and Evaluation', 'Understand the general principles and rules to be followed in taking- off of Engineering Measurements', 'Know the methods of measuring quantities for sub-structure from drawings', 'Analyse and build up unit prices and rate for civil engineering works', 'Understand the principles of abstracting and billing', 'Understand the principles of specification writing'] },
  { code: 'CEC 216', title: 'Technical Report writing', level: 'ND2', semester: 2, credit_units: 1, topics: ['Content of a Technical Report', 'Understand the methodology and sequence of writing technical report', 'Understand the information that is required in technical report writing'] },
  { code: 'CEC 242', title: 'Construction Management', level: 'ND2', semester: 2, credit_units: 2, topics: ['Know the historical development in management', 'Know the processes involved in the field of management', 'Know the structure of a coordinated system of authority', 'Know the relationship between authority responsibility and accountability', 'Know the different parties to a contract, forms of contract and contract procedures', 'Know the concept of sub-contracting and the role of sub-contractors', 'Know the techniques of contract planning', 'Know the importance of site layout', 'Know the need for quality control on site', 'Know how resources for a project are obtained and allocated', 'Know how resources are used for production', 'Know the need for safety on construction site', 'Know the duties of a supervisor', 'Know the elementary principles of accounting'] }
];

async function seedCurriculum() {
  const school = 'NBTE';
  const program_type = 'polytechnic';
  const department = 'Civil Engineering';

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
