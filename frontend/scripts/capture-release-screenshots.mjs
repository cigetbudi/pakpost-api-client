// Run against an isolated local production preview, never the live website.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const base='http://127.0.0.1:4173';
const output=resolve(process.argv[2]||'../release-screenshots');
await mkdir(output,{recursive:true});
const browser=await chromium.launch();
try {
  for (const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});
    try {
      await context.addInitScript(theme=>{
        localStorage.clear();sessionStorage.clear();
        localStorage.setItem('pakpost_theme',theme);
        localStorage.setItem('pakpost_interceptor_mode','browser');
        sessionStorage.setItem('pakpost_v5_collections_live',JSON.stringify({version:1,collections:[{id:'demo-catalog',name:'Sample catalog',variables:[],folderDocs:{},requests:[{id:'demo-get',name:'Get product',requestName:'Get product',method:'GET',url:'https://api.example.test/products/1',folderPath:[],responseExamples:[]}]}]}));
      },theme);
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.href==='https://api.example.test/products/1')return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({id:1,title:'Mechanical keyboard',price:79,stock:12,category:'Accessories'},null,2)});
        if(url.origin!==base)return route.abort();
        if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/hubs/'))return route.fulfill({status:401,contentType:'application/json',body:'{}'});
        return route.continue();
      });
      const page=await context.newPage();
      await page.goto(base);
      await page.locator('#root .pp-app').waitFor();
      await page.locator('.pp-url-field input').fill('https://api.example.test/products/1');
      const response=page.waitForResponse(r=>r.url()==='https://api.example.test/products/1'&&r.status()===200);
      await page.getByRole('button',{name:/^Send\b/}).click();
      await response;
      await page.locator('.pp-response-body').waitFor();
      await page.locator('.pp-response-body').getByText('Mechanical keyboard',{exact:false}).first().waitFor();
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:resolve(output,`workbench-${theme}.png`),animations:'disabled'});
      console.log(`Captured actual workbench (${theme}) with mocked data`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
