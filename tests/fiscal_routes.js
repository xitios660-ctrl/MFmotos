// Exercise fiscal routes with an in-memory query stub; no database or provider calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const profile=JSON.parse(fs.readFileSync('fiscal-issuer.json','utf8')),routes=new Map();
const auth=()=>{},app={get(path,...handlers){routes.set('GET '+path,handlers)},post(path,...handlers){routes.set('POST '+path,handlers)}};
let saved=null,providerPayload=null,providerCalls=0;
const context={app,auth,wrap:handler=>handler,fiscalIssuer:profile,uid:()=> 'draft-1',money:n=>+Number(n||0).toFixed(2),process:{env:{}},q:async(sql,p)=>{
 if(sql.startsWith('select 1 from sales'))return {rowCount:0,rows:[]};
 if(sql.startsWith('insert into fiscal_documents')){saved={id:p[0],user_id:p[1],sale_id:p[2],type:p[3],client_name:p[4],client_document:p[5],items:JSON.parse(p[6]),total:p[7],issuer:JSON.parse(p[8]),status:'rascunho'};return {rows:[structuredClone(saved)]}}
 if(sql.startsWith('select * from fiscal_documents where id='))return {rows:saved&&p[1]===saved.user_id?[structuredClone(saved)]:[]};
 if(sql.startsWith('select * from fiscal_documents where user_id='))return {rows:saved&&p[0]===saved.user_id?[structuredClone(saved)]:[]};
 if(sql.startsWith('update fiscal_documents')){saved={...saved,status:'emitida',provider_ref:p[0],access_key:p[1]};return {rows:[structuredClone(saved)]}}
 throw Error('Unexpected query: '+sql);
},fetch:async(url,opt)=>{providerCalls++;providerPayload=JSON.parse(opt.body);return {ok:true,json:async()=>({id:'authorized',access_key:'test-key'})}}};
const source=fs.readFileSync('server.js','utf8');assert.match(source,/ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS issuer jsonb NOT NULL DEFAULT '\{\}'/);
vm.runInNewContext(source.slice(source.indexOf('// Fiscal issuer data'),source.indexOf('app.use(express.static')),context);
async function call(key,request={}){const handlers=routes.get(key);assert.equal(handlers[0],auth);let output,status=200;const response={status(n){status=n;return this},json(value){output=value;return this}};await handlers[1]({user:{sub:'owner-1'},body:{},params:{},...request},response);return {status,output}}
(async()=>{
 const issuer=await call('GET /api/fiscal/issuer');assert.equal(issuer.output.cnpj,'22406461000100');assert.equal(issuer.output.state_registration,'454443891110');
 const draft=await call('POST /api/fiscal',{body:{client_name:'Cliente de teste',client_document:'12345678900',total:45,issuer:{cnpj:'wrong'}}});
 assert.equal(draft.output.client_document,'12345678900');assert.equal(draft.output.client_name,'Cliente de teste');assert.equal(draft.output.issuer.cnpj,profile.cnpj);assert.equal(draft.output.status,'rascunho');
 const originalName=saved.issuer.legal_name;profile.legal_name='Future change';assert.equal(saved.issuer.legal_name,originalName);
 assert.equal((await call('POST /api/fiscal',{body:{sale_id:'another-account-sale'}})).status,400);
 assert.equal((await call('POST /api/fiscal/:id/issue',{params:{id:'draft-1'}})).status,409);assert.equal(providerCalls,0);assert.equal(saved.status,'rascunho');
 context.process.env={FISCAL_PROVIDER_URL:'https://provider.test',FISCAL_PROVIDER_TOKEN:'stub'};
 assert.equal((await call('POST /api/fiscal/:id/issue',{params:{id:'draft-1'},user:{sub:'other-account'}})).status,404);assert.equal(providerCalls,0);
 await call('POST /api/fiscal/:id/issue',{params:{id:'draft-1'}});assert.equal(providerPayload.issuer.legal_name,originalName);assert.equal(providerPayload.client_document,'12345678900');assert.equal(providerCalls,1);
 console.log('PASS: authenticated issuer endpoint, canonical snapshot, separate customer data, sale/account ownership, provider gating and snapshot in provider payload. No external calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
