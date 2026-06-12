// Milestone 3 turns this into a real client: lb add <url>, lb list, lb rm.
const API = process.env.LINKBOX_API ?? 'http://localhost:4321';

const [command = 'help'] = process.argv.slice(2);

if (command === 'help') {
  console.log('usage: lb <add|list|rm|search> — not implemented yet');
} else {
  const res = await fetch(`${API}/health`);
  console.log('api says:', await res.text());
}
