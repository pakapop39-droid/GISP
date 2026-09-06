import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@insforge/sdk';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const root=path.resolve(import.meta.dirname,'..');
const dir=path.join(root,'output/production-completion-20260906/cn01');
await fs.mkdir(dir,{recursive:true});
const mode=process.argv[2]??'export';
const must=(r,label)=>{if(r.error)throw Error(`${label}: ${r.error.message}`);return r.data;};
async function client(relative,id){const p=JSON.parse(await fs.readFile(path.join(root,relative,'.insforge/project.json'),'utf8'));if(p.project_id!==id)throw Error('PROJECT_GUARD');return createAdminClient({baseUrl:p.oss_host,apiKey:p.api_key});}
const source=await client('.','db09b94e-fc37-4f90-9530-3289afef0b79');
async function all(db,table,filter){let out=[];for(let n=0;;n+=200){let q=db.database.from(table).select('*').order(['product_collections','product_tags'].includes(table)?'product_id':'id').range(n,n+199);if(filter)q=filter(q);const rows=must(await q,table);out.push(...rows);if(rows.length<200)return out;}}
async function related(db,table,col,ids){const out=[];for(let i=0;i<ids.length;i+=30)out.push(...await all(db,table,q=>q.in(col,ids.slice(i,i+30))));return [...new Map(out.map(x=>[x.id??JSON.stringify(x),x])).values()];}
if(mode==='export'){
 const data={};data.suppliers=await all(source,'suppliers',q=>q.eq('code','CN01'));if(data.suppliers.length!==1)throw Error('SUPPLIER_GUARD');
 data.products=await all(source,'products',q=>q.eq('supplier_id',data.suppliers[0].id));
 const manifest=JSON.parse(await fs.readFile(path.join(root,'outputs/catalog-import-phase01-20260905/gisp-import-manifest-722.json'),'utf8'));
 const expected=new Set(manifest.products.map(p=>p.sku));if(data.products.length!==722||data.products.some(p=>!expected.has(p.sku)))throw Error('PRODUCT_GUARD');
 const ids=data.products.map(p=>p.id);
 for(const table of ['product_variants','product_options','product_cost_versions','product_prices','product_media','product_collections','product_tags','product_documents']){data[table]=await related(source,table,'product_id',ids);console.log(table,data[table].length);}
 data.product_option_values=await related(source,'product_option_values','option_id',data.product_options.map(x=>x.id));
 data.file_metadata=await related(source,'file_metadata','id',[...data.product_media,...data.product_documents].map(x=>x.file_id));
 data.categories=await related(source,'categories','id',[...new Set(data.products.map(x=>x.category_id).filter(Boolean))]);
 while(data.categories.some(c=>c.parent_id&&!data.categories.some(p=>p.id===c.parent_id))){const missing=data.categories.map(c=>c.parent_id).filter(id=>id&&!data.categories.some(p=>p.id===id));data.categories.push(...await related(source,'categories','id',missing));}
 for(const [table,links,key] of [['collections','product_collections','collection_id'],['tags','product_tags','tag_id'],['price_formula_versions','product_prices','formula_version_id']])data[table]=await related(source,table,'id',[...new Set(data[links].map(x=>x[key]).filter(Boolean))]);
 data.supplier_locations=await all(source,'supplier_locations',q=>q.eq('supplier_id',data.suppliers[0].id));
 await fs.writeFile(path.join(dir,'source.json'),JSON.stringify(data));
 const report={exportedAt:new Date().toISOString(),counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),productStatuses:data.products.reduce((o,p)=>(o[p.status]=(o[p.status]??0)+1,o),{}),sha256:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
 await fs.writeFile(path.join(dir,'source-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}else if(mode==='prepare'){
 const data=JSON.parse(await fs.readFile(path.join(dir,'source.json'),'utf8'));
 data.price_formula_components=await related(source,'price_formula_components','formula_version_id',data.price_formula_versions.map(p=>p.id));
 const manifest=JSON.parse(await fs.readFile(path.join(root,'outputs/catalog-import-phase01-20260905/gisp-import-manifest-722.json'),'utf8'));
 const assets=[];
 for(const p of manifest.products){const product=data.products.find(x=>x.sku===p.sku);for(const im of p.images){const local=path.resolve(root,'outputs/catalog-import-phase01-20260905',im.localRelativePath);const bytes=await fs.readFile(local);if(createHash('sha256').update(bytes).digest('hex')!==im.sha256)throw Error(`IMAGE_HASH ${p.sku}`);const file=data.file_metadata.find(f=>f.entity_id===product.id&&f.object_key.includes(im.sha256.slice(0,16)));if(!file)throw Error(`IMAGE_MAPPING ${p.sku}`);assets.push({fileId:file.id,local,sha256:im.sha256});}}
 if(assets.length!==3942||new Set(assets.map(a=>a.fileId)).size!==3942)throw Error('ASSET_GUARD');
 for(const p of data.product_prices){const cost=data.product_cost_versions.find(c=>c.id===p.source_cost_version_id);const snap=p.calculation_snapshot;if(!cost||Number(p.amount)<=0||Number(p.amount)!==Number(snap.memberPrice)||Number(cost.factory_cost)*Number(cost.exchange_rate_to_thb)!==Number(snap.factoryCostThb))throw Error(`PRICE_GUARD ${p.id}`);const sum=Number(snap.factoryCostThb)+snap.components.filter(c=>c.includedInMemberPrice).reduce((n,c)=>n+Number(c.calculatedAmount),0);if(Math.abs(sum-Number(p.amount))>0.011)throw Error(`PRICE_SUM ${p.id}`);}
 await fs.writeFile(path.join(dir,'prepared.json'),JSON.stringify(data));await fs.writeFile(path.join(dir,'assets.json'),JSON.stringify(assets));
 console.log(JSON.stringify({validatedProducts:data.products.length,validatedPrices:data.product_prices.length,validatedImages:assets.length,formulaComponents:data.price_formula_components.length}));
}else if(['import-rehearsal','import-production'].includes(mode)){
 const production=mode==='import-production';
 const relative=production?'output/production-completion-20260906/production':'output/production-completion-20260906/rehearsal';
 const db=await client(relative,production?'865860c2-49fa-4e53-908f-9396b2f75233':'2cff11a0-9e16-41d4-989a-dcfc9f48103d');
 const data=JSON.parse(await fs.readFile(path.join(dir,'prepared.json'),'utf8'));
 const users=await all(db,'users');const actor=production?users.find(u=>u.status==='ACTIVE'):users.find(u=>u.status==='ACTIVE');
 if(!actor||(production&&users.length!==1))throw Error('ACTOR_GUARD');
 const connectionOutput=execFileSync('cmd.exe',['/d','/s','/c','npx -y @insforge/cli db connection-string'],{cwd:path.join(root,relative),encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const connectionString=connectionOutput.match(/postgres(?:ql)?:\/\/\S+/)?.[0]?.trim();if(!connectionString)throw Error('CONNECTION_MISSING');
 const sql=new pg.Client({connectionString});await sql.connect();
 const counts={};
 try{await sql.query('BEGIN');
  const existing=await sql.query("SELECT count(*)::int AS count FROM products p JOIN suppliers s ON s.id=p.supplier_id WHERE s.code='CN01'");if(existing.rows[0].count!==0)throw Error('TARGET_NOT_EMPTY');
  if(!production)await sql.query("UPDATE price_formula_versions SET status='RETIRED' WHERE scope_type='GLOBAL' AND status='ACTIVE'");
  for(const table of ['suppliers','categories','products','product_variants','product_options','product_option_values','price_formula_versions','price_formula_components','product_cost_versions','product_prices']){
   let rows=data[table].map(x=>({...x}));if(table==='categories')rows.sort((a,b)=>Number(Boolean(a.parent_id))-Number(Boolean(b.parent_id)));
   if(!production&&table==='price_formula_versions'){const v=await sql.query('SELECT COALESCE(MAX(version_number),0)::int AS n FROM price_formula_versions');rows.forEach((r,i)=>r.version_number=v.rows[0].n+i+1);}
   for(const row of rows){for(const key of ['created_by','reviewed_by','activated_by'])if(row[key])row[key]=actor.id;if(table==='products'){row.status='DRAFT';row.published_at=null;}}
   for(let i=0;i<rows.length;i+=50){const batch=rows.slice(i,i+50);if(!batch.length)continue;const columns=Object.keys(batch[0]);const names=columns.map(k=>`"${k}"`).join(',');await sql.query(`INSERT INTO public."${table}" (${names}) SELECT ${names} FROM jsonb_populate_recordset(NULL::public."${table}",$1::jsonb)`,[JSON.stringify(batch)]);}
   counts[table]=rows.length;
  }
  await sql.query("INSERT INTO audit_events(actor_user_id,entity_type,entity_id,action,after_data) VALUES($1,'supplier',$2,'CN01_PRODUCTION_DATA_IMPORT',$3::jsonb)",[actor.id,data.suppliers[0].id,JSON.stringify({counts,source:'approved CN01 package',sourceProject:'db09b94e-fc37-4f90-9530-3289afef0b79',sourceActorsNotCopied:true,initialStatus:'DRAFT_PENDING_MEDIA_VERIFICATION'})]);
  await sql.query('COMMIT');
 }catch(e){await sql.query('ROLLBACK');throw e;}finally{await sql.end();}
 await fs.writeFile(path.join(dir,`${mode}.json`),JSON.stringify({at:new Date().toISOString(),counts},null,2));console.log(JSON.stringify({mode,counts}));
}else if(mode==='upload-production'){
 const db=await client('output/production-completion-20260906/production','865860c2-49fa-4e53-908f-9396b2f75233');
 const data=JSON.parse(await fs.readFile(path.join(dir,'prepared.json'),'utf8'));const assets=JSON.parse(await fs.readFile(path.join(dir,'assets.json'),'utf8'));
 const users=await all(db,'users');if(users.length!==1||users[0].status!=='ACTIVE')throw Error('ACTOR_GUARD');const actor=users[0];
 const stateFile=path.join(dir,'production-upload.ndjson');const state=new Map((await fs.readFile(stateFile,'utf8').catch(()=>'' )).trim().split('\n').filter(Boolean).map(line=>{const r=JSON.parse(line);return [r.fileId,r];}));
 let index=0,write=Promise.resolve();const pending=assets.filter(a=>!state.has(a.fileId));
 await Promise.all(Array.from({length:18},async()=>{while(index<pending.length){const asset=pending[index++];const meta=data.file_metadata.find(f=>f.id===asset.fileId);const bytes=await fs.readFile(asset.local);let stored;
  for(let attempt=0;attempt<4;attempt++){try{stored=must(await db.storage.from(meta.bucket).upload(meta.object_key,new File([bytes],meta.original_name,{type:meta.mime_type})),`upload ${meta.id}`);break;}catch(e){if(attempt===3)throw e;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}}
  if(!stored.key||!stored.url)throw Error('STORAGE_RESPONSE_MISSING');const record={fileId:meta.id,key:stored.key,url:stored.url,sha256:asset.sha256};state.set(meta.id,record);write=write.then(()=>fs.appendFile(stateFile,JSON.stringify(record)+'\n'));await write;if(state.size%200===0||state.size===assets.length)console.log(`IMAGES ${state.size}/${assets.length}`);
 }}));
 if(state.size!==3942)throw Error('UPLOAD_COUNT');
 for(const table of ['file_metadata','product_media']){
  const existing=await related(db,table,table==='file_metadata'?'entity_id':'product_id',data.products.map(p=>p.id));const existingIds=new Set(existing.map(x=>x.id));
  const rows=data[table].filter(r=>!existingIds.has(r.id)).map(r=>{if(table==='product_media')return r;const stored=state.get(r.id);return {...r,organization_id:actor.primary_organization_id,uploaded_by:actor.id,member_profile_id:null,url:stored.url,object_key:stored.key};});
  for(let i=0;i<rows.length;i+=50)must(await db.database.from(table).insert(rows.slice(i,i+50)),`insert ${table}`);console.log(table,rows.length);
 }
 console.log('PRODUCTION_MEDIA_ATTACHED');
}else if(mode==='verify-publish-production'){
 const relative='output/production-completion-20260906/production';const db=await client(relative,'865860c2-49fa-4e53-908f-9396b2f75233');
 const data=JSON.parse(await fs.readFile(path.join(dir,'prepared.json'),'utf8'));const state=new Map((await fs.readFile(path.join(dir,'production-upload.ndjson'),'utf8')).trim().split('\n').map(line=>{const r=JSON.parse(line);return [r.fileId,r];}));
 const users=await all(db,'users');if(users.length!==1||users[0].status!=='ACTIVE')throw Error('ACTOR_GUARD');const actor=users[0];
 const media=await related(db,'product_media','product_id',data.products.map(p=>p.id));const files=await related(db,'file_metadata','entity_id',data.products.map(p=>p.id));
 if(media.length!==3942||files.length!==3942||media.filter(m=>m.is_primary).length!==722)throw Error('MEDIA_COUNTS');
 for(const f of files){const expected=state.get(f.id);if(!expected||f.bucket!=='gisp-confidential'||f.object_key!==expected.key||f.url!==expected.url||f.uploaded_by!==actor.id||f.url.includes('kit6y4pj'))throw Error('FILE_MAPPING');}
 const samples=Array.from({length:12},(_,i)=>files[Math.floor(i*(files.length-1)/11)]);let verified=0;
 for(const f of samples){const signed=must(await db.storage.from(f.bucket).createSignedUrl(f.object_key,300),'sign image');const r=await fetch(signed.signedUrl);if(!r.ok)throw Error(`IMAGE_HTTP ${r.status}`);const hash=createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');if(hash!==state.get(f.id).sha256)throw Error('DOWNLOADED_HASH');verified++;}
 const published=data.products.filter(p=>p.status==='PUBLISHED').map(p=>p.id);if(published.length!==634)throw Error('PUBLISH_SELECTION');
 const connectionOutput=execFileSync('cmd.exe',['/d','/s','/c','npx -y @insforge/cli db connection-string'],{cwd:path.join(root,relative),encoding:'utf8',stdio:['ignore','pipe','pipe']});const connectionString=connectionOutput.match(/postgres(?:ql)?:\/\/\S+/)?.[0]?.trim();if(!connectionString)throw Error('CONNECTION_MISSING');
 const sql=new pg.Client({connectionString});await sql.connect();let statuses;
 try{await sql.query('BEGIN');await sql.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor.id,role:'authenticated'})]);
  const validation=await sql.query('SELECT id,public.product_validation_result(id) AS result FROM products WHERE id=ANY($1::uuid[])',[published]);
  const blockers=validation.rows.filter(r=>r.result.blockingCount!==0);await fs.writeFile(path.join(dir,'publish-validation.json'),JSON.stringify({checked:validation.rows.length,blockers},null,2));if(blockers.length)throw Error(`PUBLISH_BLOCKERS ${blockers.length}`);
  for(const fn of ['submit_product_for_review','review_catalog_product','publish_product']){const args=fn==='review_catalog_product'?"id,'PASSED','CN01 approved source transferred; prices and image integrity verified'":'id';await sql.query(`SELECT public.${fn}(${args}) FROM unnest($1::uuid[]) AS id`,[published]);}
  statuses=(await sql.query('SELECT status,count(*)::int AS count FROM products WHERE supplier_id=$1 GROUP BY status',[data.suppliers[0].id])).rows;
  if(statuses.find(s=>s.status==='PUBLISHED')?.count!==634||statuses.find(s=>s.status==='DRAFT')?.count!==88)throw Error('FINAL_STATUS');await sql.query('COMMIT');
 }catch(e){await sql.query('ROLLBACK');throw e;}finally{await sql.end();}
 const report={at:new Date().toISOString(),media:media.length,primaryImages:722,downloadedImageHashChecks:verified,publishValidation:634,statuses};await fs.writeFile(path.join(dir,'production-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else throw Error('Unsupported mode');



