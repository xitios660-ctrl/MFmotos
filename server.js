const express=require('express'),path=require('path'),crypto=require('crypto'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),helmet=require('helmet'),cors=require('cors');
const {Pool}=require('pg');const app=express(),PORT=process.env.PORT||10000,DB=process.env.DATABASE_URL,SECRET=process.env.JWT_SECRET||'mf-change-me';
const pool=new Pool({connectionString:DB,ssl:DB&&!DB.includes('localhost')?{rejectUnauthorized:false}:false});const q=(s,p=[])=>pool.query(s,p),uid=()=>crypto.randomUUID(),plate=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7),money=n=>+Number(n||0).toFixed(2);
app.use(helmet({contentSecurityPolicy:false}));app.use(cors());app.use(express.json({limit:'5mb'}));
async function init(){
await q(`
CREATE TABLE IF NOT EXISTS users(id text primary key,name text not null,email text unique not null,password_hash text not null,created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS clients(id text primary key,user_id text references users(id) on delete cascade,name text not null,phone text,email text,cpf_cnpj text,created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS inventory(id text primary key,user_id text references users(id) on delete cascade,sku text,name text not null,category text,quantity int default 0,min_quantity int default 3,cost numeric(12,2) default 0,price numeric(12,2) default 0,moto_models text[] default '{}',created_at timestamptz default now(),updated_at timestamptz default now());
CREATE TABLE IF NOT EXISTS vehicle_cache_user(user_id text references users(id) on delete cascade,plate text not null,brand text,model text,year text,color text,source text,updated_at timestamptz default now(),primary key(user_id,plate));
CREATE TABLE IF NOT EXISTS service_orders(id text primary key,user_id text references users(id) on delete cascade,client_id text references clients(id) on delete set null,client_name text,plate text not null,brand text,model text,year text,color text,description text not null,status text default 'pendente',estimated_cost numeric(12,2) default 0,final_cost numeric(12,2) default 0,created_at timestamptz default now(),updated_at timestamptz default now());
CREATE TABLE IF NOT EXISTS budgets(id text primary key,user_id text references users(id) on delete cascade,client_name text,plate text,items jsonb default '[]',grand_total numeric(12,2) default 0,status text default 'aberto',created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS sales(id text primary key,user_id text references users(id) on delete cascade,client_name text,items jsonb default '[]',subtotal numeric(12,2) default 0,discount numeric(12,2) default 0,total numeric(12,2) default 0,payment_method text,created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS fiscal_documents(id text primary key,user_id text references users(id) on delete cascade,sale_id text references sales(id) on delete set null,type text default 'NFC-e',client_name text,client_document text,items jsonb default '[]',total numeric(12,2) default 0,status text default 'rascunho',provider_ref text,access_key text,error_message text,created_at timestamptz default now(),updated_at timestamptz default now());
`);
for(const t of ['clients','inventory','service_orders','budgets','sales','fiscal_documents']){
  await q('ALTER TABLE '+t+' ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id) ON DELETE CASCADE');
}
await q("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS brand text");
await q("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS model text");
await q("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS year text");
await q("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS color text");
await q("ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'");
await q("CREATE TABLE IF NOT EXISTS attendances(id text primary key,user_id text references users(id) on delete cascade,client_id text references clients(id) on delete set null,client_name text,phone text,email text,cpf_cnpj text,plate text,brand text,model text,year text,color text,description text,items jsonb default '[]',total numeric(12,2) default 0,discount numeric(12,2) default 0,payment_method text,status text default 'aberto',created_at timestamptz default now(),updated_at timestamptz default now())");
await q("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS attendance_id text REFERENCES attendances(id) ON DELETE SET NULL");
await q("ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS attendance_id text REFERENCES attendances(id) ON DELETE SET NULL");
await q("ALTER TABLE sales ADD COLUMN IF NOT EXISTS attendance_id text REFERENCES attendances(id) ON DELETE SET NULL");
await q("CREATE INDEX IF NOT EXISTS idx_attendances_user_id ON attendances(user_id)");


let first=(await q('select id from users order by created_at asc limit 1')).rows[0];
if(first){
  for(const t of ['clients','inventory','service_orders','budgets','sales','fiscal_documents']){
    await q('update '+t+' set user_id=$1 where user_id is null',[first.id]);
  }
  let legacy=await q('select plate,brand,model,year,color,source,updated_at from vehicle_cache');
  for(const v of legacy.rows){
    await q(`insert into vehicle_cache_user(user_id,plate,brand,model,year,color,source,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(user_id,plate) do nothing`,[first.id,v.plate,v.brand,v.model,v.year,v.color,v.source,v.updated_at]);
  }
}
for(const t of ['clients','inventory','service_orders','budgets','sales','fiscal_documents']){
  await q('create index if not exists idx_'+t+'_user_id on '+t+'(user_id)');
}
}
const wrap=f=>(r,s,n)=>Promise.resolve(f(r,s,n)).catch(n);function auth(r,s,n){try{r.user=jwt.verify((r.headers.authorization||'').replace('Bearer ',''),SECRET);n()}catch{s.status(401).json({error:'Faça login novamente.'})}}
app.get('/api/health',wrap(async(_,s)=>{await q('select 1');s.json({ok:true,app:'MF Moto Peças'})}));
app.get('/api/auth/registration-status',wrap(async(_,s)=>s.json({open:true})));
app.post('/api/auth/register',wrap(async(r,s)=>{let{name,email,password}=r.body;email=String(email||'').toLowerCase().trim();if(!name||!email||String(password).length<8)return s.status(400).json({error:'Preencha nome, e-mail e uma senha com pelo menos 8 caracteres.'});if((await q('select 1 from users where email=$1',[email])).rowCount)return s.status(409).json({error:'E-mail já cadastrado.'});let u={id:uid(),name:String(name).trim(),email};await q('insert into users(id,name,email,password_hash,created_at) values($1,$2,$3,$4,now())',[u.id,u.name,u.email,await bcrypt.hash(password,12)]);s.json({token:jwt.sign({sub:u.id,name:u.name,email:u.email},SECRET,{expiresIn:'7d'}),user:u})}));
app.post('/api/auth/login',wrap(async(r,s)=>{let u=(await q('select * from users where email=$1',[String(r.body.email||'').toLowerCase().trim()])).rows[0];if(!u||!await bcrypt.compare(String(r.body.password||''),u.password_hash))return s.status(401).json({error:'E-mail ou senha incorretos.'});s.json({token:jwt.sign({sub:u.id,name:u.name,email:u.email},SECRET,{expiresIn:'7d'}),user:{id:u.id,name:u.name,email:u.email}})}));
app.get('/api/me',auth,(r,s)=>s.json(r.user));
app.post('/api/auth/password',auth,wrap(async(r,s)=>{let current=String(r.body.current_password||''),next=String(r.body.new_password||'');if(next.length<8)return s.status(400).json({error:'A nova senha precisa ter pelo menos 8 caracteres.'});if(current===next)return s.status(400).json({error:'Escolha uma senha diferente da atual.'});let u=(await q('select password_hash from users where id=$1',[r.user.sub])).rows[0];if(!u||!await bcrypt.compare(current,u.password_hash))return s.status(401).json({error:'Senha atual incorreta.'});await q('update users set password_hash=$1 where id=$2',[await bcrypt.hash(next,12),r.user.sub]);s.json({ok:true,message:'Senha alterada com sucesso.'})}));
app.get('/api/dashboard',auth,wrap(async(r,s)=>{let u=r.user.sub,[c,o,i,b,v,l]=await Promise.all([q('select count(*)::int n from clients where user_id=$1',[u]),q("select count(*)::int n,count(*) filter(where status<>'concluido')::int open from service_orders where user_id=$1",[u]),q('select count(*)::int n from inventory where user_id=$1',[u]),q('select count(*)::int n from budgets where user_id=$1',[u]),q("select coalesce(sum(total),0)::float total,count(*)::int n from sales where user_id=$1 and created_at>=date_trunc('day',now())",[u]),q('select count(*)::int n from inventory where user_id=$1 and quantity<=min_quantity',[u])]);s.json({clients:c.rows[0].n,orders:o.rows[0].n,open_orders:o.rows[0].open,inventory:i.rows[0].n,budgets:b.rows[0].n,today_sales:v.rows[0].total,today_sales_count:v.rows[0].n,low_stock:l.rows[0].n})}));

app.get('/api/attendances',auth,wrap(async(r,s)=>{
  let rows=(await q('select * from attendances where user_id=$1 order by created_at desc',[r.user.sub])).rows;
  s.json(rows.map(x=>({...x,total:+x.total,discount:+x.discount})));
}));
app.post('/api/attendances/confirm',auth,wrap(async(r,s)=>{
  let x=r.body||{},u=r.user.sub,p=plate(x.plate),rawItems=Array.isArray(x.items)?x.items:[];
  if(!rawItems.length)return s.status(400).json({error:'Adicione pelo menos um produto ou serviço.'});
  let items=rawItems.map(z=>({inventory_id:z.inventory_id||null,name:String(z.name||'Item').trim()||'Item',quantity:Math.max(1,+z.quantity||1),unit_price:money(z.unit_price),type:z.type==='produto'?'produto':'servico'}));
  let total=money(items.reduce((a,z)=>a+z.quantity*z.unit_price,0)),discount=money(x.discount),clientName=String(x.client_name||'').trim();
  let c=await pool.connect();
  try{
    await c.query('begin');
    let client=null;
    if(x.client_id)client=(await c.query('select * from clients where id=$1 and user_id=$2',[x.client_id,u])).rows[0]||null;
    if(!client&&clientName){
      if(String(x.email||'').trim())client=(await c.query('select * from clients where user_id=$1 and lower(email)=lower($2) limit 1',[u,String(x.email).trim()])).rows[0]||null;
      if(!client&&String(x.phone||'').trim())client=(await c.query('select * from clients where user_id=$1 and phone=$2 limit 1',[u,String(x.phone).trim()])).rows[0]||null;
      if(!client)client=(await c.query('select * from clients where user_id=$1 and lower(name)=lower($2) limit 1',[u,clientName])).rows[0]||null;
    }
    if(client){
      client=(await c.query("update clients set name=coalesce(nullif($1,''),name),phone=coalesce(nullif($2,''),phone),email=coalesce(nullif($3,''),email),cpf_cnpj=coalesce(nullif($4,''),cpf_cnpj) where id=$5 and user_id=$6 returning *",[clientName,String(x.phone||'').trim(),String(x.email||'').trim(),String(x.cpf_cnpj||'').trim(),client.id,u])).rows[0];
    }else if(clientName){
      client=(await c.query('insert into clients(id,user_id,name,phone,email,cpf_cnpj) values($1,$2,$3,$4,$5,$6) returning *',[uid(),u,clientName,String(x.phone||'').trim(),String(x.email||'').trim(),String(x.cpf_cnpj||'').trim()])).rows[0];
    }
    if(client)clientName=client.name;
    let attendanceId=uid(),description=String(x.description||'').trim()||items.map(z=>z.name).join(', '),status=x.paid?'pago':(p.length===7?'oficina':'orcamento');
    let attendance=(await c.query('insert into attendances(id,user_id,client_id,client_name,phone,email,cpf_cnpj,plate,brand,model,year,color,description,items,total,discount,payment_method,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning *',[attendanceId,u,client?.id||null,clientName,String(x.phone||''),String(x.email||''),String(x.cpf_cnpj||''),p,String(x.brand||''),String(x.model||''),String(x.year||''),String(x.color||''),description,JSON.stringify(items),total,discount,String(x.payment_method||'pix'),status])).rows[0];
    let budget=(await c.query("insert into budgets(id,user_id,attendance_id,client_name,plate,brand,model,year,color,items,grand_total,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'aberto') returning *",[uid(),u,attendanceId,clientName,p,String(x.brand||''),String(x.model||''),String(x.year||''),String(x.color||''),JSON.stringify(items),total])).rows[0];
    let order=null;
    if(p.length===7){
      order=(await c.query("insert into service_orders(id,user_id,attendance_id,client_id,client_name,plate,brand,model,year,color,description,status,estimated_cost,items) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pendente',$12,$13) returning *",[uid(),u,attendanceId,client?.id||null,clientName,p,String(x.brand||''),String(x.model||''),String(x.year||''),String(x.color||''),description,total,JSON.stringify(items)])).rows[0];
      await c.query("insert into vehicle_cache_user(user_id,plate,brand,model,year,color,source) values($1,$2,$3,$4,$5,$6,'atendimento') on conflict(user_id,plate) do update set brand=excluded.brand,model=excluded.model,year=excluded.year,color=excluded.color,source=excluded.source,updated_at=now()",[u,p,String(x.brand||''),String(x.model||''),String(x.year||''),String(x.color||'')]);
    }
    let sale=null;
    if(x.paid){
      let sold=[],subtotal=0;
      for(let z of items){
        let qty=z.quantity,unit=z.unit_price,name=z.name;
        if(z.inventory_id){
          let prod=(await c.query('select * from inventory where id=$1 and user_id=$2 for update',[z.inventory_id,u])).rows[0];
          if(!prod)throw new Error('Produto não encontrado no estoque: '+name);
          if(prod.quantity<qty)throw new Error('Estoque insuficiente: '+prod.name);
          await c.query('update inventory set quantity=quantity-$1,updated_at=now() where id=$2 and user_id=$3',[qty,prod.id,u]);
          name=prod.name;if(!unit)unit=money(prod.price);
          sold.push({inventory_id:prod.id,name,quantity:qty,unit_price:unit,total:money(qty*unit),type:'produto'});
        }else sold.push({name,quantity:qty,unit_price:unit,total:money(qty*unit),type:z.type||'servico'});
        subtotal+=qty*unit;
      }
      subtotal=money(subtotal);
      let saleTotal=money(Math.max(0,subtotal-discount));
      sale=(await c.query('insert into sales(id,user_id,attendance_id,client_name,items,subtotal,discount,total,payment_method) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',[uid(),u,attendanceId,clientName,JSON.stringify(sold),subtotal,discount,saleTotal,String(x.payment_method||'pix')])).rows[0];
    }
    await c.query('commit');
    s.json({ok:true,attendance:{...attendance,total:+attendance.total,discount:+attendance.discount},client,budget:{...budget,grand_total:+budget.grand_total},order:order?{...order,estimated_cost:+order.estimated_cost,final_cost:+order.final_cost}:null,sale:sale?{...sale,subtotal:+sale.subtotal,discount:+sale.discount,total:+sale.total}:null});
  }catch(e){await c.query('rollback');s.status(400).json({error:e.message})}finally{c.release()}
}));

// clientes
app.get('/api/clients',auth,wrap(async(r,s)=>s.json((await q('select * from clients where user_id=$1 order by created_at desc',[r.user.sub])).rows)));
app.post('/api/clients',auth,wrap(async(r,s)=>{let x=r.body;if(!x.name)return s.status(400).json({error:'Nome obrigatório.'});s.json((await q('insert into clients(id,user_id,name,phone,email,cpf_cnpj) values($1,$2,$3,$4,$5,$6) returning *',[uid(),r.user.sub,x.name,x.phone||'',x.email||'',x.cpf_cnpj||''])).rows[0])}));
app.delete('/api/clients/:id',auth,wrap(async(r,s)=>{await q('delete from clients where id=$1 and user_id=$2',[r.params.id,r.user.sub]);s.json({ok:true})}));
// estoque
app.get('/api/inventory',auth,wrap(async(r,s)=>s.json((await q('select *,quantity<=min_quantity as is_low_stock from inventory where user_id=$1 order by name',[r.user.sub])).rows.map(x=>({...x,cost:+x.cost,price:+x.price})))));
app.post('/api/inventory',auth,wrap(async(r,s)=>{let x=r.body,m=Array.isArray(x.moto_models)?x.moto_models:String(x.moto_models||'').split(',').map(v=>v.trim()).filter(Boolean);s.json((await q('insert into inventory(id,user_id,sku,name,category,quantity,min_quantity,cost,price,moto_models) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *',[uid(),r.user.sub,x.sku||'',x.name,x.category||'',+x.quantity||0,+x.min_quantity||3,money(x.cost),money(x.price),m])).rows[0])}));
app.delete('/api/inventory/:id',auth,wrap(async(r,s)=>{await q('delete from inventory where id=$1 and user_id=$2',[r.params.id,r.user.sub]);s.json({ok:true})}));
// placa: cache -> histórico -> placai -> APIBrasil
async function cache(userId,p,d,source){await q(`insert into vehicle_cache_user(user_id,plate,brand,model,year,color,source) values($1,$2,$3,$4,$5,$6,$7) on conflict(user_id,plate) do update set brand=excluded.brand,model=excluded.model,year=excluded.year,color=excluded.color,source=excluded.source,updated_at=now()`,[userId,p,d.brand||'',d.model||'',d.year||'',d.color||'',source])}
async function placai(p){try{let a=await fetch('https://www.placai.com/api/placaOrder',{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0'},body:JSON.stringify({placa:p,product_id:1,utm:{},score:'0.0'}),signal:AbortSignal.timeout(8000)});if(!a.ok)return null;let tid=(await a.json())?.data?.transaction_id;if(!tid)return null;await new Promise(r=>setTimeout(r,1500));let b=await fetch(`https://www.placai.com/api/resultado/${tid}/preview`,{headers:{'user-agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)});let v=(await b.json())?.data?.veiculo||{};return v.fabricante||v.modelo?{brand:v.fabricante,model:v.modelo,year:v.ano_fabricacao,color:v.cor}:null}catch{return null}}
async function apibrasil(p){if(!process.env.APIBRASIL_BEARER_TOKEN||!process.env.APIBRASIL_DEVICE_TOKEN)return null;try{let r=await fetch('https://gateway.apibrasil.io/api/v2/vehicles/dados',{method:'POST',headers:{'content-type':'application/json',DeviceToken:process.env.APIBRASIL_DEVICE_TOKEN,Authorization:`Bearer ${process.env.APIBRASIL_BEARER_TOKEN}`},body:JSON.stringify({placa:p}),signal:AbortSignal.timeout(9000)});let v=(await r.json()).response||{};return v.MARCA||v.MODELO?{brand:v.MARCA,model:v.MODELO,year:String(v.ANO||v.ano||''),color:v.COR||v.cor}:null}catch{return null}}
app.get('/api/vehicle/:p',auth,wrap(async(r,s)=>{let u=r.user.sub,p=plate(r.params.p);if(p.length<7)return s.status(400).json({error:'Placa inválida.'});let a=(await q('select brand,model,year,color,source from vehicle_cache_user where user_id=$1 and plate=$2',[u,p])).rows[0];if(a)return s.json({found:true,plate:p,...a});a=(await q('select brand,model,year,color from service_orders where user_id=$1 and plate=$2 order by created_at desc limit 1',[u,p])).rows[0];if(a&&(a.brand||a.model)){await cache(u,p,a,'historico');return s.json({found:true,plate:p,source:'historico',...a})}a=await placai(p);let src='placai';if(!a){a=await apibrasil(p);src='apibrasil'}if(a){await cache(u,p,a,src);return s.json({found:true,plate:p,source:src,...a})}s.json({found:false,plate:p,message:'Não localizado automaticamente. Preencha manualmente; ficará salvo somente nesta conta.'})}));
// ordens
app.get('/api/orders',auth,wrap(async(r,s)=>s.json((await q('select * from service_orders where user_id=$1 order by created_at desc',[r.user.sub])).rows.map(x=>({...x,estimated_cost:+x.estimated_cost,final_cost:+x.final_cost})))));
app.post('/api/orders',auth,wrap(async(r,s)=>{let x=r.body,p=plate(x.plate),cid=x.client_id||null,it=Array.isArray(x.items)?x.items:[];if(p.length<7)return s.status(400).json({error:'Placa inválida.'});if(cid&&!(await q('select 1 from clients where id=$1 and user_id=$2',[cid,r.user.sub])).rowCount)return s.status(400).json({error:'Cliente inválido para esta conta.'});let row=(await q(`insert into service_orders(id,user_id,client_id,client_name,plate,brand,model,year,color,description,status,estimated_cost,items) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,[uid(),r.user.sub,cid,x.client_name||'',p,x.brand||'',x.model||'',x.year||'',x.color||'',x.description||'',x.status||'pendente',money(x.estimated_cost),JSON.stringify(it)])).rows[0];await cache(r.user.sub,p,x,'ordem');s.json({...row,estimated_cost:+row.estimated_cost,final_cost:+row.final_cost})}));
app.put('/api/orders/:id',auth,wrap(async(r,s)=>{let x=r.body,it=Array.isArray(x.items)?x.items:null;let row=(await q(`update service_orders set status=$1,description=$2,estimated_cost=$3,final_cost=$4,items=coalesce($5::jsonb,items),updated_at=now() where id=$6 and user_id=$7 returning *`,[x.status,x.description,money(x.estimated_cost),money(x.final_cost),it?JSON.stringify(it):null,r.params.id,r.user.sub])).rows[0];if(!row)return s.status(404).json({error:'OS não encontrada nesta conta.'});s.json({...row,estimated_cost:+row.estimated_cost,final_cost:+row.final_cost})}));
app.delete('/api/orders/:id',auth,wrap(async(r,s)=>{await q('delete from service_orders where id=$1 and user_id=$2',[r.params.id,r.user.sub]);s.json({ok:true})}));
// orçamentos + IA
app.get('/api/budgets',auth,wrap(async(r,s)=>s.json((await q('select * from budgets where user_id=$1 order by created_at desc',[r.user.sub])).rows.map(x=>({...x,grand_total:+x.grand_total})))));
app.post('/api/budgets',auth,wrap(async(r,s)=>{let x=r.body,it=Array.isArray(x.items)?x.items:[],t=money(x.grand_total??it.reduce((a,b)=>a+(+b.total||0),0)),p=plate(x.plate);let row=(await q('insert into budgets(id,user_id,client_name,plate,brand,model,year,color,items,grand_total,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *',[uid(),r.user.sub,x.client_name||'',p,x.brand||'',x.model||'',x.year||'',x.color||'',JSON.stringify(it),t,x.status||'aberto'])).rows[0];if(p.length===7&&(x.brand||x.model))await cache(r.user.sub,p,x,'orcamento');s.json({...row,grand_total:+row.grand_total})}));
app.put('/api/budgets/:id',auth,wrap(async(r,s)=>{let x=r.body,it=Array.isArray(x.items)?x.items:[],t=money(x.grand_total??it.reduce((a,b)=>a+(+b.total||0),0)),p=plate(x.plate),status=['aberto','aprovado','recusado','concluido'].includes(String(x.status||''))?String(x.status):'aberto';let row=(await q('update budgets set client_name=$1,plate=$2,brand=$3,model=$4,year=$5,color=$6,items=$7,grand_total=$8,status=$9 where id=$10 and user_id=$11 returning *',[x.client_name||'',p,x.brand||'',x.model||'',x.year||'',x.color||'',JSON.stringify(it),t,status,r.params.id,r.user.sub])).rows[0];if(!row)return s.status(404).json({error:'Orçamento não encontrado nesta conta.'});if(p.length===7&&(x.brand||x.model))await cache(r.user.sub,p,x,'orcamento');s.json({...row,grand_total:+row.grand_total})}));
app.delete('/api/budgets/:id',auth,wrap(async(r,s)=>{let row=(await q('delete from budgets where id=$1 and user_id=$2 returning id',[r.params.id,r.user.sub])).rows[0];if(!row)return s.status(404).json({error:'Orçamento não encontrado nesta conta.'});s.json({ok:true})}));


function normText(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9$.,+; ]/g,' ').replace(/\s+/g,' ').trim()}
const wordNums={zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90,cem:100,cento:100};
function simpleNumberText(v){
  let s=normText(v).replace(/\b(reais|real|cada)\b/g,'').trim();
  if(!s)return null;
  let numeric=s.match(/^\d+(?:[.,]\d{1,2})?$/);
  if(numeric)return Number(s.replace(',','.'));
  let decimal=s.match(/^([a-z]+|\d+)\s+e\s+([a-z]+|\d{1,2})$/);
  if(decimal){
    let a=/^\d+$/.test(decimal[1])?+decimal[1]:wordNums[decimal[1]],b=/^\d+$/.test(decimal[2])?+decimal[2]:wordNums[decimal[2]];
    if(Number.isFinite(a)&&Number.isFinite(b)){
      if(a<10&&b>=10&&b<100)return money(a+b/100);
      if(a>=20&&a%10===0&&b<10)return a+b;
    }
  }
  let parts=s.split(/\s+e\s+|\s+/).filter(Boolean),total=0,seen=false;
  for(let p of parts){if(wordNums[p]===undefined)return null;total+=wordNums[p];seen=true}
  return seen?total:null;
}
function qtyPrefix(segment){
  let n=normText(segment),m=n.match(/^(\d{1,3})\b/);
  if(m)return {qty:Math.max(1,+m[1]),rest:n.slice(m[0].length).trim()};
  let first=n.split(' ')[0],v=wordNums[first];
  if(Number.isFinite(v)&&v>0)return {qty:v,rest:n.slice(first.length).trim()};
  return {qty:1,rest:n};
}
function bestInventoryMatch(text,rows){
  let n=normText(text),stop=new Set(['quero','preciso','orcamento','de','do','da','para','por','com','sem','reais','real','cada','veiculo','moto']);
  let words=n.split(' ').filter(x=>x.length>2&&!stop.has(x)&&!/^\d/.test(x));
  let best=null,score=0;
  for(let p of rows){
    let hay=normText([p.name,p.category,(p.moto_models||[]).join(' ')].join(' '));
    let s=words.reduce((a,w)=>a+(hay.includes(w)?1:0),0);
    if(s>score){score=s;best=p}
  }
  return score>0?best:null;
}
function parseLocalItem(segment,rows){
  let src=normText(segment),q=qtyPrefix(src),rest=q.rest,price=0,nameText=rest;
  let marker=rest.match(/\b(?:de|por|a)\s+(.+?)\s*$/);
  if(marker){
    let candidate=marker[1].trim(),parsed=simpleNumberText(candidate);
    if(parsed!==null&&parsed>=0){price=money(parsed);nameText=rest.slice(0,marker.index).trim()}
  }
  if(!price){
    let rm=rest.match(/\br\$\s*(\d+(?:[.,]\d{1,2})?)/),tail=rest.match(/\b(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real)\b/);
    let x=rm||tail;if(x){price=money(String(x[1]).replace(',','.'));nameText=rest.slice(0,x.index).replace(/\b(?:de|por|a)\s*$/,'').trim()}
  }
  nameText=nameText.replace(/\b(?:de|por|a)\s*$/,'').trim();
  let best=bestInventoryMatch(nameText,rows),fromInventory=false,name=nameText||'Item informado';
  if(best){name=best.name;if(!price&&+best.price>0){price=money(best.price);fromInventory=true}}
  let item={name:name,quantity:q.qty,unit_price:price,total:money(q.qty*price),from_inventory:fromInventory,needs_price:!price};
  return item;
}
function localBudget(message,rows){
  let raw=String(message||'').trim(),work=raw.replace(/^ve[ií]culo[^.]*\.\s*/i,'').trim();
  let parts=work.split(/\s*(?:\+|;|\bmais\b)\s*/i).map(x=>x.trim()).filter(Boolean);
  if(!parts.length)parts=[work];
  let items=parts.map(x=>parseLocalItem(x,rows)).filter(x=>x.name);
  let total=money(items.reduce((a,x)=>a+x.total,0)),pending=items.filter(x=>x.needs_price);
  let lines=items.map(x=>x.quantity+'x '+x.name+(x.needs_price?' (preço pendente)':' a R$ '+x.unit_price.toFixed(2).replace('.',',')+' = R$ '+x.total.toFixed(2).replace('.',',')));
  let reply=pending.length?'Orçamento montado, mas '+pending.length+' item(ns) ainda precisam de preço.':'Orçamento calculado: '+lines.join(' + ')+'.';
  return {reply:reply,items:items,grand_total:total,provider:'local-gratis'};
}
function parseAIText(txt){try{let t=String(txt||'').trim(),f=String.fromCharCode(96).repeat(3);if(t.startsWith(f)){let p=t.indexOf('\n');if(p>=0)t=t.slice(p+1);if(t.endsWith(f))t=t.slice(0,-3)}return JSON.parse(t.trim())}catch{return null}}
async function openAIBudget(key,model,prompt){let rr=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+key},body:JSON.stringify({model:model,input:prompt,max_output_tokens:1200}),signal:AbortSignal.timeout(20000)}),d=await rr.json();if(!rr.ok)throw new Error((d&&d.error&&d.error.message)||'Falha no provedor de IA.');let txt=d.output_text||(d.output||[]).flatMap(o=>o.content||[]).map(x=>x.text||'').join('');let parsed=parseAIText(txt);if(!parsed)throw new Error('Resposta de IA inválida.');return parsed}
app.post('/api/ai/budget',auth,wrap(async(r,s)=>{let rows=(await q('select name,category,price,quantity,moto_models from inventory where user_id=$1 order by name',[r.user.sub])).rows;let provider=String(process.env.AI_PROVIDER||'local').toLowerCase();if(provider==='openai'&&process.env.OPENAI_API_KEY){let inv=rows.map(x=>x.name+'|'+x.price+'|'+x.quantity+'|'+(x.moto_models||[]).join(',')).join('\n');let prompt='Você é o orçamentista da MF Moto Peças. Use somente preços do estoque abaixo ou preços informados pelo usuário. Nunca invente valor. Retorne SOMENTE JSON no formato {"reply":"texto","items":[{"name":"","quantity":1,"unit_price":0,"total":0,"from_inventory":true,"needs_price":false}],"grand_total":0}.\nESTOQUE:\n'+inv+'\nPEDIDO:'+String(r.body.message||'');try{let out=await openAIBudget(process.env.OPENAI_API_KEY,process.env.OPENAI_MODEL||'gpt-4.1-mini',prompt);return s.json(Object.assign({},out,{provider:'openai'}))}catch(e){console.warn('IA externa indisponível, usando modo local:',e.message)}}return s.json(localBudget(r.body.message,rows))}));

// PDV
app.get('/api/sales',auth,wrap(async(r,s)=>s.json((await q('select * from sales where user_id=$1 order by created_at desc',[r.user.sub])).rows.map(x=>({...x,total:+x.total})))));
app.post('/api/sales',auth,wrap(async(r,s)=>{let items=r.body.items||[];if(!items.length)return s.status(400).json({error:'Carrinho vazio.'});let c=await pool.connect();try{await c.query('begin');let out=[],sub=0;for(let z of items){let qty=Math.max(1,+z.quantity||1),u=0,name=String(z.name||'Item');if(z.inventory_id){let p=(await c.query('select * from inventory where id=$1 and user_id=$2 for update',[z.inventory_id,r.user.sub])).rows[0];if(!p||p.quantity<qty)throw new Error('Estoque insuficiente ou item não pertence a esta conta: '+(p?.name||name));await c.query('update inventory set quantity=quantity-$1 where id=$2 and user_id=$3',[qty,p.id,r.user.sub]);name=p.name;u=money(z.unit_price??p.price);out.push({inventory_id:p.id,name,quantity:qty,unit_price:u,total:money(qty*u),type:'produto'})}else{u=money(z.unit_price);if(!name||u<0)throw new Error('Serviço/item manual inválido.');out.push({name,quantity:qty,unit_price:u,total:money(qty*u),type:z.type||'servico'})}sub+=qty*u}let disc=money(r.body.discount),total=money(Math.max(0,sub-disc)),row=(await c.query('insert into sales(id,user_id,client_name,items,subtotal,discount,total,payment_method) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[uid(),r.user.sub,r.body.client_name||'',JSON.stringify(out),money(sub),disc,total,r.body.payment_method||'pix'])).rows[0];await c.query('commit');s.json({...row,subtotal:+row.subtotal,discount:+row.discount,total:+row.total})}catch(e){await c.query('rollback');s.status(400).json({error:e.message})}finally{c.release()}}));
// fiscal: nunca finge emissão sem provedor autorizado
app.get('/api/fiscal',auth,wrap(async(r,s)=>s.json((await q('select * from fiscal_documents where user_id=$1 order by created_at desc',[r.user.sub])).rows.map(x=>({...x,total:+x.total})))));
app.post('/api/fiscal',auth,wrap(async(r,s)=>{let x=r.body,sale=x.sale_id||null;if(sale&&!(await q('select 1 from sales where id=$1 and user_id=$2',[sale,r.user.sub])).rowCount)return s.status(400).json({error:'Venda inválida para esta conta.'});s.json((await q('insert into fiscal_documents(id,user_id,sale_id,type,client_name,client_document,items,total) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[uid(),r.user.sub,sale,x.type||'NFC-e',x.client_name||'',x.client_document||'',JSON.stringify(x.items||[]),money(x.total)])).rows[0])}));
app.post('/api/fiscal/:id/issue',auth,wrap(async(r,s)=>{if(!process.env.FISCAL_PROVIDER_URL||!process.env.FISCAL_PROVIDER_TOKEN)return s.status(409).json({error:'Emissão oficial exige FISCAL_PROVIDER_URL e FISCAL_PROVIDER_TOKEN de provedor homologado/SEFAZ.'});let d=(await q('select * from fiscal_documents where id=$1 and user_id=$2',[r.params.id,r.user.sub])).rows[0];if(!d)return s.status(404).json({error:'Documento não encontrado nesta conta.'});let rr=await fetch(process.env.FISCAL_PROVIDER_URL,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.FISCAL_PROVIDER_TOKEN}`},body:JSON.stringify(d)}),x=await rr.json();if(!rr.ok)return s.status(502).json({error:x.message||'Rejeitada pelo provedor.'});s.json((await q("update fiscal_documents set status='emitida',provider_ref=$1,access_key=$2,updated_at=now() where id=$3 and user_id=$4 returning *",[x.id||x.ref||'',x.access_key||x.chave||'',d.id,r.user.sub])).rows[0])}));
app.use(express.static(path.join(__dirname,'public')));app.get(/^(?!\/api).*/,(_,s)=>s.sendFile(path.join(__dirname,'public/index.html')));app.use((e,r,s,n)=>{console.error(e);s.status(500).json({error:e.message||'Erro interno.'})});init().then(()=>app.listen(PORT,()=>console.log('MF Moto Peças online',PORT))).catch(e=>{console.error(e);process.exit(1)});
