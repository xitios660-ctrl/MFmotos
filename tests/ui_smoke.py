"""Browser UI smoke test. API requests are intercepted; no real records are changed."""
from playwright.sync_api import sync_playwright
import json
from pathlib import Path
import os
BASE_URL=os.environ.get("MF_UI_URL","http://127.0.0.1:4173")
ARTIFACTS=Path(os.environ.get("MF_UI_ARTIFACTS","/tmp/mf-ui-smoke"));ARTIFACTS.mkdir(parents=True,exist_ok=True)
D={'clients':14,'orders':8,'open_orders':3,'inventory':48,'budgets':6,'today_sales':1240.5,'today_sales_count':4,'low_stock':2}
C=[{'id':'c1','name':'Ana Silva','phone':'11999999999','email':'ana@example.com','cpf_cnpj':''}]
I=[{'id':'i1','name':'Óleo 10W30','sku':'OLEO-01','category':'Motor','quantity':12,'min_quantity':3,'cost':25,'price':39.9,'moto_models':['CG 160'],'is_low_stock':False}]
O=[{'id':'o1','client_name':'Ana Silva','plate':'ABC1D23','brand':'Honda','model':'CG 160','year':'2024','color':'Preta','description':'Revisão completa','status':'pendente','estimated_cost':180,'final_cost':0,'items':[]}]
errors=[]
def mock(route):
 path=route.request.url.split('/api')[-1]
 if path=='/auth/registration-status': data={'open':True}
 elif path=='/auth/login':data={'token':'preview-token'}
 elif path=='/dashboard':data=D
 elif path=='/clients':data=C
 elif path=='/inventory':data=I
 elif path=='/orders':data=O
 elif path=='/me':data={'name':'Ana','email':'ana@example.com'}
 else:data=[]
 route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/api/**',mock)
 page.goto(BASE_URL,wait_until='networkidle')
 assert page.locator('.loginStory').count()==0
 assert page.locator('link[href*="liquid-glass"]').count()==0
 page.locator('#authEmail').fill('ana@example.com');page.locator('#authPass').fill('test-password')
 page.locator('#authSubmit').click();page.locator('.cockpit').wait_for();page.wait_for_timeout(700)
 assert page.locator('.mobile').count()==0
 assert page.locator('#mobileNav').evaluate('(el)=>el.closest("header")!==null')
 for width in [1440,390,320]:
  page.set_viewport_size({'width':width,'height':844})
  toggle=page.locator('#shortcutsToggle')
  assert not page.locator('#mobileNav').is_visible()
  toggle.click()
  assert page.locator('#mobileNav').is_visible()
  assert page.locator('#mobileNav button').count()==8
  bounds=page.locator('#mobileNav').bounding_box()
  assert bounds['x']>=0 and bounds['x']+bounds['width']<=width
  page.screenshot(path=str(ARTIFACTS/('menu-'+str(width)+'.png')))
  page.keyboard.press('Escape')
  assert not page.locator('#mobileNav').is_visible()
  assert toggle.evaluate('(el)=>el===document.activeElement')
  page.keyboard.press('Enter')
  page.keyboard.press('Tab')
  assert page.locator('#mobileNav button').first.evaluate('(el)=>el===document.activeElement')
  page.keyboard.press('Escape')
  toggle.click();page.locator('#crumb').click()
  assert not page.locator('#mobileNav').is_visible()
  for tab in ['inventory','clients','orders','budgets','fiscal','security','atendimento','overview']:
   toggle.click();page.locator('#mobileNav [data-page="'+tab+'"]').click()
   page.wait_for_timeout(150)
   assert page.locator('#mobileNav [data-page="'+tab+'"]').get_attribute('aria-current')=='page'
   assert not page.locator('#mobileNav').is_visible()
   assert page.locator('#content .hero h1').count()==1
  page.wait_for_timeout(600)
  page.screenshot(path=str(ARTIFACTS/('restored-'+str(width)+'.png')))
 page.set_viewport_size({'width':1440,'height':1000})
 page.locator('.top .actions>.btn.red').click()
 page.wait_for_function("S.page==='atendimento'")
 assert not errors,errors
 print('PASS: previous visual restored; no bottom bar; all eight shortcuts in header menu; desktop/390/320 px, keyboard, Escape, outside click, selection and header attendance action; no browser errors. APIs mocked.')
 browser.close()
