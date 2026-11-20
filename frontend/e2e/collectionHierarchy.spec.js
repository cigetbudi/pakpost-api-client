import {test,expect} from '@playwright/test';

async function seed(page){
  await page.goto('/');
  await page.evaluate(()=>{
    const items=['Auth','Billing','Catalog'].map((name,i)=>({
      id:`col-${i}`,name,variables:[],folderDocs:{},requests:[{
        id:`request-${i}`,name:`${name} endpoint`,requestName:`${name} endpoint`,method:'GET',
        url:`https://example.test/${i}`,folderPath:[],responseExamples:[]
      }]
    }));
    sessionStorage.setItem('pakpost_v5_collections_live',JSON.stringify({version:1,collections:items}));
    localStorage.setItem('pakpost_v14_global_collection_sort','manual');
  });
  await page.reload();
  await expect(page.getByRole('button',{name:'Actions for collection Auth'})).toBeVisible();
}
const stored=page=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('pakpost_v5_collections_live')).collections);

test('nested Local collections move into another collection and back to root',async({page})=>{
  await seed(page);
  await page.getByRole('button',{name:'Actions for collection Auth'}).click();
  await page.getByRole('menuitem',{name:'Move collection…'}).click();
  await page.getByLabel('Destination').selectOption({label:'Inside Billing'});
  await page.getByRole('button',{name:'Move collection',exact:true}).click();
  await expect.poll(async()=>{const items=await stored(page);return items.find(item=>item.id==='col-0')?.parentCollectionId;}).toBe('col-1');
  await expect(page.getByRole('button',{name:'Actions for collection Auth'})).toBeVisible();
  await page.getByRole('button',{name:'Actions for collection Auth'}).click();
  await page.getByRole('menuitem',{name:'Move collection…'}).click();
  await page.getByLabel('Destination').selectOption({label:'Collection root (last)'});
  await page.getByRole('button',{name:'Move collection',exact:true}).click();
  await expect.poll(async()=>{const items=await stored(page);return items.find(item=>item.id==='col-0')?.parentCollectionId??null;}).toBe(null);
  const items=await stored(page);
  expect(items.find(item=>item.id==='col-0').requests[0].name).toBe('Auth endpoint');
});

test('Local collections can reorder by dropping near top of destination row',async({page})=>{
  await seed(page);
  const source=page.locator('.pp-local-collection-head').last();
  const target=page.locator('.pp-local-collection-head').first();
  await source.dragTo(target,{targetPosition:{x:10,y:2}});
  await expect.poll(async()=>{
    const items=await stored(page);return items.filter(item=>!item.parentCollectionId)
      .sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(item=>item.id);
  }).toEqual(['col-2','col-0','col-1']);
});
