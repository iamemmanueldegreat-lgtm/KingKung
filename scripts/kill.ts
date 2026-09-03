import { exec } from 'child_process';
exec("ps aux | grep expand_all_lessons | awk '{print $2}' | xargs kill -9", (err, stdout, stderr) => {
  console.log("Killed expand_all_lessons");
  process.exit(0);
});
