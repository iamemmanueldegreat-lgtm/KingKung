import { db } from '../src/lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

async function count() {
  const c = 'wellspring-university-architecture-300-level-s1-arc-301';
  const t = await getDocs(collection(db, `courses/${c}/topics`));
  console.log(`Course ${c} has ${t.size} topics.`);
  process.exit(0);
}
count().catch(console.error);
