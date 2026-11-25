# Using the REST workbench

Open PakPost in your browser or desktop app. The Local workspace can be used without signing in. Cloud storage requires a compatible server and Google sign-in.

## Send your first request

1. Create a request tab, choose GET and enter `https://httpbin.org/get`.
2. Edit query parameters, headers, authentication or body as appropriate.
3. Select Send. Inspect status, response time, response headers and the response body.
4. Save to a collection or folder. Use Ctrl+S to save and Ctrl+K to find requests or commands.

Paste a cURL command into the URL bar to import it. An HTTP(S) URL without a scheme in an imported cURL command defaults to HTTPS. Keep explicit HTTP for a local server that requires it. Import Postman collections or OpenAPI JSON using the import panel; review imported scripts and credentials before sending anything.

## Organize requests and variables

Use Collections for folders and requests, Environments for environment-specific values, and History to inspect previous requests. Pin important tabs; reorder tabs and requests where supported. Use `{{baseUrl}}` or other variable references in request fields. Choose an environment before sending. Avoid hardcoding real credentials into shared requests. Export secrets only intentionally.

## Scripting and collection runs

Pre-request and Post-response scripts run in a restricted QuickJS worker. Choose from categorized snippets or paste compatible `pm.*` code. The facade is a subset of Postman, not a complete runtime.

```javascript
pm.environment.set('timestamp', new Date().toISOString());
pm.test('Success', () => {
    pm.expect(pm.response.code).to.equal(200);
});
```

Use the pre-request statement before Send and the assertion in the post-response script. The console shows script logs. Collection Runner accepts CSV/JSON iteration data, supports variable chaining, and exports JSON/JUnit reports. Keep test data and exported reports private when appropriate.

## Inspect responses

Use Analysis for JSONPath filtering, capture a baseline and compare the latest JSON response, or inspect available timing data. Save extracted values to an environment variable when permitted. JSONPath and timing support are partial; detailed DNS/TCP/TLS timings are not guaranteed.

## Collaborate in a workspace

Sign in, choose Cloud storage and select a workspace. Authorized leads/admins can invite members and manage roles or remove eligible members. Workspace permissions are enforced server-side. Realtime updates refresh authorized data; an offline client may need to reconnect. Removing a member does not delete their account or previously shared requests.

## Choose a request transport

Browser direct mode is subject to CORS. Use the optional [browser interceptor](extensions.md) for approved destinations, Secure Proxy within server policy, or Native HTTP from the desktop application for local/internal APIs. Cancel stops the client-side operation where supported; it does not undo a transaction already accepted upstream.

## Moving to the official Cloud domain

The official workbench is https://app.pakpostapi.com. Browser cookies and local storage are origin-specific. Sign in again using the same Google account. Cloud workspaces use the same server database during the transition. Export local collections and environments from the old origin and import them at the new one; review sensitive values before export. Browser-local history, drafts, preferences and other local state do not automatically migrate. Keep the old origin available until you have verified the data you need.
