import {test,expect} from '@playwright/test';

// Browser-level coverage for native HTML5 drag and the accessible menu fallback.
// Runs in guest mode: never accesses Cloud, tokens, or a real database.
async function seedLocalFolders(page){
  await page.goto('/');
  await page.evaluate(()=>{
    const collection={id:'col-dnd',name:'Example',variables:[],folderDocs:{'["A"]':'docs'},requests:[
      {id:'r-a',requestName:'One',name:'One',method:'GET',url:'https://example.test/one',folderPath:['A'],responseExamples:[]},
      {id:'r-b',requestName:'Two',name:'Two',method:'GET',url:'https://example.test/two',folderPath:['B'],responseExamples:[]} ]};
    sessionStorage.setItem('pakpost_v5_collections_live',JSON.stringify({version:1,collections:[collection]}));
  });
  await page.reload();
  await expect(page.getByRole('button',{name:'Actions for folder A'})).toBeVisible();
}
const currentPath=page=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('pakpost_v5_collections_live'))
  .collections[0].requests.find(request=>request.id==='r-a').folderPath);

test('drag A into B and then back to collection root',async({page})=>{
  await seedLocalFolders(page);
  await page.getByRole('button',{name:'A',exact:true}).dragTo(page.getByRole('button',{name:'B',exact:true}));
  await expect.poll(()=>currentPath(page)).toEqual(['B','A']);
  await page.getByRole('button',{name:'A',exact:true}).dragTo(page.locator('.pp-local-collection-head > .pp-tree-row'));
  await expect.poll(()=>currentPath(page)).toEqual(['A']);
});

test('Move to menu moves A into B and restores it to root',async({page})=>{
  await seedLocalFolders(page);
  await page.getByRole('button',{name:'Actions for folder A'}).click();
  await page.getByRole('menuitem',{name:'Move to…'}).click();
  await page.getByRole('combobox',{name:'Destination folder'}).selectOption({label:'B'});
  await page.getByRole('button',{name:'Move folder'}).click();
  await expect.poll(()=>currentPath(page)).toEqual(['B','A']);
  await page.getByRole('button',{name:'Actions for folder A'}).click();
  await page.getByRole('menuitem',{name:'Move to…'}).click();
  await page.getByRole('combobox',{name:'Destination folder'}).selectOption({label:'Collection root'});
  await page.getByRole('button',{name:'Move folder'}).click();
  await expect.poll(()=>currentPath(page)).toEqual(['A']);
});

test('collection menu lets user choose source folder and destination without dragging',async({page})=>{
  await seedLocalFolders(page);
  await page.getByRole('button',{name:'Actions for collection Example'}).click();
  await page.getByRole('menuitem',{name:'Move folder…'}).click();
  await expect(page.getByLabel('Folder to move')).toBeVisible();
  await expect(page.getByRole('button',{name:'Move folder'})).toBeDisabled();
  await page.getByLabel('Folder to move').selectOption({label:'A'});
  await page.getByLabel('Destination folder').selectOption({label:'B'});
  await page.getByRole('button',{name:'Move folder'}).click();
  await expect.poll(()=>currentPath(page)).toEqual(['B','A']);
});

test('Settings shows Preferences without Workspace Management mounted below',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Settings'})).toBeVisible();
  await expect(page.locator('.pp-manager')).toHaveCount(0);
  await expect(page.locator('.pp-settings-screen')).toBeVisible();
});
