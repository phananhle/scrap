🌴 MCPS in Poke

How to Add MCPs (Custom Integrations) to Poke

Want to integrate your Model Context Protocol (MCP) server with Poke?

Go to https://poke.com/settings/connections/integrations/new to add your MCP integration
Use our verified MCP server template with 1-click deploy: https://github.com/InteractionCo/mcp-server-template
The template repository is pre-configured and verified to work seamlessly with Poke, making it easy to get started with your custom MCP implementation!

How to Send Messages to Poke

To send messages to Poke programmatically:

Create an API key at https://poke.com/settings/advanced
Make a POST request to the Poke API with your API key and message
Examples:

Bash

API_KEY="your-api-key-here"
MESSAGE="Hello from HackMIT!"

response=$(curl 'https://poke.com/api/v1/inbound-sms/webhook' \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -X POST \
        -d "{\"message\": \"$MESSAGE\"}")

echo $response
TypeScript

const API_KEY = 'your-api-key-here';
const MESSAGE = 'Hello from HackMIT!';

const response = await fetch('https://poke.com/api/v1/inbound-sms/webhook', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: MESSAGE })
});