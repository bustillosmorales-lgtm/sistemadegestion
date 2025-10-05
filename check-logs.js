// Simple script to check if there are running dev servers
const ps = require('child_process').execSync('tasklist').toString();
if (ps.includes('node.exe')) {
  console.log('✅ Node processes running');
} else {
  console.log('❌ No Node processes');
}
