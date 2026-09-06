import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createAdminClient } from '@insforge/sdk';
import pg from 'pg';

const root=path.resolve(import.meta.dirname,'..');
const dir=path.join(root,'output/production-completion-20260906/production');
const project=JSON.parse(await fs.readFile(path.join(dir,'.insforge/project.json'),'utf8'));
if(project.project_id!=='865860c2-49fa-4e53-908f-9396b2f75233'||project.oss_host!=='https://m8ugbyak.ap-southeast.insforge.app')throw Error('PRODUCTION_TARGET_GUARD');
const ownerId='4345ab88-f8c3-4e23-bfe2-8956cd3cafce';
const approved=[
 {email:'pakapop39@yahoo.com',group:'OPERATIONS',roles:['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC']},
 {email:'vs01.modular@gmail.com',group:'FINANCE',roles:['FINANCE']},
 {email:'designershare6335@gmail.com',group:'LOGISTICS',roles:['LOGISTICS']},
];
const admin=createAdminClient({baseUrl:project.oss_host,apiKey:project.api_key});
const connectionOutput=execFileSync('cmd.exe',['/d','/s','/c','npx -y @insforge/cli db connection-string'],{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const connectionString=connectionOutput.match(/postgres(?:ql)?:\/\/\S+/)?.[0]?.trim();
if(!connectionString)throw Error('CONNECTION_MISSING');
const sql=new pg.Client({connectionString});await sql.connect();
const report=[];
const must=(r,label)=>{if(r.error)throw Error(`${label}: ${r.error.message}`);return r.data;};
try{
 const owner=await sql.query("SELECT 1 FROM public.users u JOIN public.user_roles ur ON ur.user_id=u.id JOIN public.roles r ON r.id=ur.role_id WHERE u.id=$1 AND u.status='ACTIVE' AND r.code='SUPER_ADMIN' AND ur.revoked_at IS NULL",[ownerId]);
 if(owner.rowCount!==1)throw Error('OWNER_GUARD');
 for(const person of approved){
  let existing=(await sql.query('SELECT id FROM auth.users WHERE lower(email)=$1',[person.email])).rows[0];
  let password;
  if(existing){
   const roles=(await sql.query('SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND ur.revoked_at IS NULL',[existing.id])).rows.map(r=>r.code);
   if(roles.some(r=>!person.roles.includes(r)))throw Error(`EXISTING_ROLE_CONFLICT ${person.email}`);
  }else{
   password=randomBytes(36).toString('base64url');
   const created=must(await admin.auth.signUp({email:person.email,password,name:person.email,autoConfirm:true}),`create ${person.email}`);
   existing=created.user?.id?{id:created.user.id}:(await sql.query('SELECT id FROM auth.users WHERE lower(email)=$1',[person.email])).rows[0];
   if(!existing)throw Error('AUTH_USER_NOT_FOUND');
  }
  await sql.query('BEGIN');
  try{
   await sql.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:ownerId,role:'authenticated'})]);
   await sql.query('SELECT public.provision_internal_user($1,$2,$3::text[])',[existing.id,person.email,person.roles]);
   const actual=(await sql.query('SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND ur.revoked_at IS NULL ORDER BY r.code',[existing.id])).rows.map(r=>r.code);
   if(JSON.stringify(actual)!==JSON.stringify([...person.roles].sort()))throw Error('ROLE_VERIFICATION_FAILED');
   await sql.query('COMMIT');
  }catch(e){await sql.query('ROLLBACK');throw e;}
  const checks=[];
  if(password){
   const origin='https://m8ugbyak.insforge.site';
   const login=await fetch(origin+'/api/auth/sign-in',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:person.email,password}),signal:AbortSignal.timeout(30000)});
   if(!login.ok)throw Error(`SIGN_IN_FAILED ${person.email} ${login.status}`);
   const jar=new Map();for(const s of login.headers.getSetCookie()){const v=s.split(';')[0];const i=v.indexOf('=');jar.set(v.slice(0,i),v.slice(i+1));}
   const cookie=[...jar].filter(([,v])=>v).map(([k,v])=>`${k}=${v}`).join('; ');
   try{
    const session=await fetch(origin+'/api/auth/session',{headers:{cookie},signal:AbortSignal.timeout(30000)});const body=await session.json();
    if(!session.ok||body.data?.userStatus!=='ACTIVE'||JSON.stringify([...body.data.roles].sort())!==JSON.stringify([...person.roles].sort()))throw Error('APP_SESSION_ROLE_MISMATCH');
    checks.push({check:'login-and-exact-role-session',passed:true});
    for(const [url,expected] of [['/admin/dashboard',200],['/api/admin/roles',403]]){
     const response=await fetch(origin+url,{headers:{cookie},redirect:'manual',signal:AbortSignal.timeout(30000)});checks.push({path:url,status:response.status,expected,passed:response.status===expected});
     if(response.status!==expected)throw Error(`ACCESS_CHECK_FAILED ${person.email} ${url} ${response.status}`);
    }
   }finally{await fetch(origin+'/api/auth/sign-out',{method:'POST',headers:{cookie},signal:AbortSignal.timeout(30000)});}
   password=undefined;
  }
  report.push({email:person.email,id:existing.id,group:person.group,roles:person.roles,status:'ACTIVE',checks,passwordDelivery:'User must set their own password through forgot-password; generated bootstrap password was not saved or shared.'});
  await fs.writeFile(path.join(dir,'approved-staff-provisioning.json'),JSON.stringify({at:new Date().toISOString(),accounts:report},null,2));
  console.log(JSON.stringify({email:person.email,group:person.group,status:'ACTIVE',checks}));
 }
}finally{await sql.end();}
