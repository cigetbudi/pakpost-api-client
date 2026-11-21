import {test,expect} from '@playwright/test';

const account={id:'11111111-1111-1111-1111-111111111111',displayName:'Workspace Tester',email:'test@example.invalid'};
const origin='http://127.0.0.1:4173';

// Regression: the browser boots as a guest while /auth/session is pending.
// A verified cookie must restore the user's Cloud choice, not pin it to Local.
test('Cloud storage and selected workspace survive delayed cookie restoration and hard refresh',async({page,context})=>{
  await context.addCookies([{name:'pakpost_dev_session',value:'fake-cookie',url:origin}]);
  await page.addInitScript(({id})=>{
    const key=`pakpost_workspace_view_v1:${id}`;
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({scope:'workspace',workspaceId:'ws-b'}));
  },{id:account.id});
  await context.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(path==='/api/auth/session'){
      await new Promise(resolve=>setTimeout(resolve,750));
      return json({authenticated:true,user:account,csrfToken:'test-proof',expiresAt:'2099-11-21T00:00:00Z'});
    }
    if(path==='/api/auth/me')return json(account);
    if(path==='/api/workspaces')return json([{id:'ws-a',name:'Workspace A'},{id:'ws-b',name:'Workspace B'}]);
    if(path==='/api/workspaces/capabilities')return json({canCreateWorkspace:true});
    if(/^\/api\/workspaces\/[^/]+\/collections$/.test(path))return json([]);
    if(/^\/api\/workspaces\/[^/]+\/members$/.test(path))return json([]);
    if(/^\/api\/workspaces\/[^/]+\/environments$/.test(path))return json([]);
    return json({},404);
  });
  await page.goto('/');
  const storage=page.getByRole('combobox',{name:'Storage location for collections and environments'});
  await expect(page.getByRole('button',{name:'Account menu'})).toBeVisible();
  await expect(storage).toContainText('Cloud · Neon');
  await expect(page.locator('.pp-workspace-indicator')).toContainText('Workspace B');
  await page.reload();
  await expect(page.getByRole('button',{name:'Account menu'})).toBeVisible();
  await expect(storage).toContainText('Cloud · Neon');
  await expect(page.locator('.pp-workspace-indicator')).toContainText('Workspace B');

  // Explicit Local selection takes precedence over the authenticated Cloud default.
  await storage.click();
  await page.getByRole('option',{name:'Local · Browser'}).click();
  await expect(storage).toContainText('Local · Browser');
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem(`pakpost_workspace_view_v1:${id}`))?.scope,account.id)).toBe('local');
  await page.reload();
  await expect(page.getByRole('button',{name:'Account menu'})).toBeVisible();
  await expect(storage).toContainText('Local · Browser');
});
