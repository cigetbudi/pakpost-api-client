import {test,expect} from '@playwright/test';

const profile={id:'11111111-1111-1111-1111-111111111111',email:'tester@example.invalid',displayName:'PakPost Tester',avatarUrl:'https://lh3.googleusercontent.com/a/example.jpg'};
test('account dropdown, Google avatar and session management are accessible without exposing cookie',async({page,context})=>{
  await context.addCookies([{name:'pakpost_dev_session',value:'test-cookie',url:'http://127.0.0.1:4173'}]);
  await context.route('https://lh3.googleusercontent.com/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64')}));
  await context.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(path==='/api/auth/session')return json({authenticated:true,user:profile,csrfToken:'test-proof',expiresAt:'2099-11-20T00:00:00Z'});
    if(path==='/api/auth/me')return json(profile);
    if(path==='/api/auth/sessions')return json([
      {id:'11111111-1111-1111-1111-111111111111',current:true,userAgent:'Firefox Linux',createdAt:'2026-11-20T00:00:00Z',expiresAt:'2099-11-20T00:00:00Z'},
      {id:'22222222-2222-2222-2222-222222222222',current:false,userAgent:'Chrome Android',createdAt:'2026-11-20T00:00:00Z',expiresAt:'2099-11-20T00:00:00Z'}]);
    if(path==='/api/workspaces')return json([]);
    if(path==='/api/workspaces/capabilities')return json({canCreateWorkspace:false});
    return json({},404);
  });
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Account menu'})).toBeVisible();
  await expect(page.locator('.pp-profile .pp-user-avatar img')).toHaveAttribute('src',profile.avatarUrl);
  await page.getByRole('button',{name:'Account menu'}).click();
  await expect(page.getByRole('menuitem',{name:'Sign out'})).toBeVisible();
  // Being "visible" in Playwright does not detect ancestor overflow clipping.
  // Make sure the actual sign-out hit target is above the Explorer, not behind it.
  await expect.poll(()=>page.getByRole('menuitem',{name:'Sign out'}).evaluate(el=>{
    const r=el.getBoundingClientRect();
    const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return hit===el || el.contains(hit);
  })).toBe(true);
  await page.getByRole('menuitem',{name:'Security & sessions'}).click();
  await expect(page.getByRole('heading',{name:'Security & sessions'})).toBeVisible();
  await expect(page.getByText('Current session', { exact: true })).toBeVisible();
  await expect(page.getByRole('button',{name:'Revoke',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'Revoke',exact:true}).click();
  await expect(page.getByRole('alertdialog',{name:'Revoke this session?'})).toBeVisible();
  await page.getByRole('button',{name:'Cancel'}).click();
});
