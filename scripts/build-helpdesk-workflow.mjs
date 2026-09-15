import { writeFileSync } from 'node:fs';
import { helpdeskEvent, helpdeskEmail } from '../lib/automations/helpdesk-email.mjs';
const nodes = [];
function add(name, type, version, parameters, extra = {}) {
  nodes.push({ id: `helpdesk-${nodes.length + 1}`, name, type: `n8n-nodes-base.${type}`, typeVersion: version, position: [nodes.length * 250, 0], parameters, ...extra });
}
add('Helpdesk Webhook', 'webhook', 2.1, { httpMethod: 'POST', path: 'helpdesk-email-manila', authentication: 'headerAuth', responseMode: 'onReceived', options: {} });
add('Validate Helpdesk Event', 'code', 2, { jsCode: `${helpdeskEvent.toString()}\nconst event = helpdeskEvent($input.first().json.body);\nreturn event ? [{json: event}] : [];` });
add('Config', 'code', 2, { jsCode: `return [{json: {...$input.first().json, testMode: true, testEmail: '', fromEmail: '', hrEmail: '', portalUrl: ''}}];` });
add('Get Requestor Email', 'httpRequest', 4.2, {
  url: "={{ 'https://msoomcjzzudibiyezclj.supabase.co/auth/v1/admin/users/' + encodeURIComponent($json.request.user_id) }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', options: { timeout: 30000 },
});
add('Build Helpdesk Email', 'code', 2, { jsCode: `${helpdeskEmail.toString()}\nconst config = $('Config').first().json;\nconst mail = helpdeskEmail(config, $input.first().json, config);\nreturn mail ? [{json: mail}] : [];` });
add('Send Helpdesk Email', 'emailSend', 2.1, { fromEmail: '={{ $json.fromEmail }}', toEmail: '={{ $json.toEmail }}', subject: '={{ $json.subject }}', emailFormat: 'html', html: '={{ $json.html }}', options: { appendAttribution: false } }, { retryOnFail: false });
const connections = {};
nodes.slice(0,-1).forEach((node, i) => { connections[node.name] = { main: [[{ node: nodes[i+1].name, type: 'main', index: 0 }]] }; });
writeFileSync(new URL('../docs/automations/manila-helpdesk-email.json', import.meta.url), JSON.stringify({ name: 'MANILA - Helpdesk Request and HR Reply Email', nodes, connections, active: false, pinData: {}, settings: { executionOrder: 'v1', timezone: 'Asia/Manila', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' }, tags: [] }, null, 2) + '\n');
