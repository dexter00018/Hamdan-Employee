import { writeFileSync } from 'node:fs';
import { validateEvent, employeeProfiles, buildEmails } from '../lib/automations/announcement-email.mjs';

const nodes = [];
const add = (name, type, typeVersion, parameters, extra = {}) => {
  nodes.push({ name, id: `announcement-${nodes.length + 1}`, type: `n8n-nodes-base.${type}`, typeVersion, position: [nodes.length * 240, 0], parameters, ...extra });
};
add('Announcement Webhook', 'webhook', 2.1, {
  httpMethod: 'POST', path: 'announcement-published-manila', authentication: 'headerAuth',
  responseMode: 'onReceived', options: {},
});
add('Validate Announcement', 'code', 2, {
  jsCode: `${validateEvent.toString()}\nconst event = validateEvent($input.first().json.body);\nreturn event ? [{json: event}] : [];`,
});
add('Config', 'code', 2, {
  jsCode: `return [{json: {
  ...$input.first().json,
  supabaseUrl: 'https://msoomcjzzudibiyezclj.supabase.co',
  portalUrl: 'https://YOUR-MANILA-PORTAL.example/employee',
  fromEmail: '',
  testMode: true,
  testEmail: '' // Set your own address first. Set testMode false only after testing.
}}];`,
});
add('Get Profiles', 'supabase', 1, {
  resource: 'row', operation: 'getAll', tableId: 'profiles', returnAll: true, filterType: 'none', orderBy: 'id.asc',
});
add('Select Employees', 'code', 2, {
  jsCode: `${employeeProfiles.toString()}\nreturn employeeProfiles($input.all());`,
});
add('Get Employee Email', 'httpRequest', 4.2, {
  url: "={{ $('Config').first().json.supabaseUrl + '/auth/v1/admin/users/' + encodeURIComponent($json.id) }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  options: { timeout: 30000, batching: { batch: { batchSize: 1, batchInterval: 150 } } },
});
add('Build Emails', 'code', 2, {
  jsCode: `${buildEmails.toString()}\nreturn buildEmails($input.all(), $('Config').first().json);`,
});
add('Send Announcement Email', 'emailSend', 2.1, {
  fromEmail: '={{ $json.fromEmail }}', toEmail: '={{ $json.toEmail }}',
  subject: '={{ $json.subject }}', emailFormat: 'html', html: '={{ $json.html }}',
  options: { appendAttribution: false },
}, { retryOnFail: false });
const connections = {};
nodes.slice(0, -1).forEach((node, i) => {
  connections[node.name] = { main: [[{ node: nodes[i + 1].name, type: 'main', index: 0 }]] };
});
const workflow = {
  name: 'MANILA - Published Announcement Email', nodes, connections, active: false,
  settings: { executionOrder: 'v1', timezone: 'Asia/Manila', saveDataSuccessExecution: 'none', saveDataErrorExecution: 'all' },
  pinData: {}, tags: [],
};
writeFileSync(new URL('../docs/automations/manila-announcement-email.json', import.meta.url), JSON.stringify(workflow, null, 2) + '\n');
