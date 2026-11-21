import {test,expect} from '@playwright/test';

// No real credentials, database or backend are used in this browser contract test.
test('two tabs share server cookie and synchronize server-side logout',async({page,context})=>{
  const origin='http://127.0.0.1:4173';
  await context.addCookies([{name:'pakpost_dev_session',value:'fake-cookie',url:origin}]);
  await context.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const session=route.request().headers().cookie?.includes('pakpost_dev_session=fake-cookie');
    const user={id:'11111111-1111-1111-1111-111111111111',email:'test@example.invalid',displayName:'Smoke Tester'};
    const reply=(body,status=200,headers={})=>route.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(body)});
    if(path==='/api/auth/session')return reply(session?
      {authenticated:true,user,csrfToken:'nonsecret-test-proof',expiresAt:'2026-11-21T00:00:00Z'}:
      {authenticated:false,user:null,csrfToken:null,expiresAt:null});
    if(path==='/api/auth/me')return reply(user);
    if(path==='/api/auth/logout')return reply({},200,{'set-cookie':'pakpost_dev_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax'});
    if(path==='/api/workspaces')return reply([]);
    if(path==='/api/workspaces/capabilities')return reply({canCreateWorkspace:false});
    return reply({},404);
  });
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();
  const second=await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('button',{name:'Sign out'})).toBeVisible();
  expect(await second.evaluate(()=>sessionStorage.getItem('pakpost_token'))).toBeNull();
  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(second.locator('.pp-top').getByRole('button',{name:'Sign in'})).toBeVisible();
});
