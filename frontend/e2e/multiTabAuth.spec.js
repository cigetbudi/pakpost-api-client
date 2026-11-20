import {test,expect} from '@playwright/test';

// Isolated browser test: no real credentials, backend or NeonDB needed.
test('same-origin tabs reuse a live login and sign out together',async({page,context})=>{
  const fakeToken='e2e-only-mock-bearer';
  await context.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me'){
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        id:'11111111-1111-1111-1111-111111111111',email:'test@example.invalid',displayName:'Smoke Tester'
      })});
    }else if(path==='/api/workspaces'){
      await route.fulfill({status:200,contentType:'application/json',body:'[]'});
    }else if(path==='/api/workspaces/capabilities'){
      await route.fulfill({status:200,contentType:'application/json',body:'{"canCreateWorkspace":false}'});
    }else{
      await route.fulfill({status:404,contentType:'application/json',body:'{}'});
    }
  });

  // Seed the first tab only. A newly opened tab starts without credentials.
  await page.addInitScript(value=>sessionStorage.setItem('pakpost_token',value),fakeToken);
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();

  const second=await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('button',{name:'Sign out'})).toBeVisible();
  expect(await second.evaluate(()=>sessionStorage.getItem('pakpost_token'))).toBe(fakeToken);

  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(second.locator('.pp-top').getByRole('button',{name:'Sign in'})).toBeVisible();
  expect(await second.evaluate(()=>sessionStorage.getItem('pakpost_token'))).toBeNull();
});
