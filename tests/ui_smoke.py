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
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/api/**',mock)
 page.goto(BASE_URL,wait_until='networkidle')
 page.screenshot(path=str(ARTIFACTS/'login-desktop.png'))
 assert 'blur' in page.locator('.loginCard').evaluate('(el)=>getComputedStyle(el).backdropFilter')
 page.locator('#authEmail').fill('ana@example.com');page.locator('#authPass').fill('test-password')
 page.locator('#authSubmit').click()
 page.locator('.cockpit').wait_for();page.wait_for_timeout(600)
 page.screenshot(path=str(ARTIFACTS/'dashboard-desktop.png'),full_page=True)
 for tab in ['inventory','clients','orders','budgets','fiscal','security','atendimento']:
  page.locator('#nav [data-page="'+tab+'"]').click()
  page.wait_for_timeout(150)
  assert page.locator('#content .hero h1').count()==1
  assert page.locator('#nav [data-page="'+tab+'"]').get_attribute('aria-current')=='page'
 page.locator('#nav [data-page="clients"]').click();page.wait_for_timeout(150)
 page.get_by_role('button',name='+ Novo cliente').click()
 assert page.get_by_role('dialog').count()==1
 page.keyboard.press('Tab');page.keyboard.press('Shift+Tab')
 assert page.locator('#modal').evaluate('(el)=>el.contains(document.activeElement)')
 page.keyboard.press('Escape')
 assert page.get_by_role('dialog').count()==0
 assert page.get_by_role('button',name='+ Novo cliente').evaluate('(el)=>el===document.activeElement')
 page.locator('#nav [data-page="overview"]').click();page.wait_for_timeout(150)
 page.locator('#startRideBtn').click()
 page.wait_for_function("S.page==='atendimento'")
 page.wait_for_timeout(1100)
 assert page.locator('.rideTransition').count()==0
 for width in [390,320,768]:
  page.set_viewport_size({'width':width,'height':844})
  page.evaluate("go('overview')");page.wait_for_timeout(250)
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),str(width)+' overflow'
  page.screenshot(path=str(ARTIFACTS/('dashboard-'+str(width)+'.png')),full_page=True)
 page.set_viewport_size({'width':390,'height':844});page.evaluate('logout()');page.wait_for_timeout(150)
 page.screenshot(path=str(ARTIFACTS/'login-mobile.png'),full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 page.locator('#tabRegister').click();assert page.locator('#authName').is_visible()
 page.locator('#tabLogin').click();assert not page.locator('#authName').is_visible()
 page.locator('.passToggle').click();assert page.locator('#authPass').get_attribute('type')=='text'
 page.locator('.passToggle').click();assert page.locator('#authPass').get_attribute('type')=='password'
 page.emulate_media(reduced_motion='reduce')
 assert page.locator('.loginCard').evaluate('(el)=>getComputedStyle(el).animationName')=='none'
 page.evaluate("S.token='preview-token';boot()");page.wait_for_timeout(150)
 page.locator('#startRideBtn').click();page.wait_for_function("S.page==='atendimento'")
 assert page.locator('.rideTransition').count()==0
 assert not errors,errors
 print('PASS: login, registration tabs, password toggle, seven modules, dialog keyboard/focus, desktop/mobile layouts, transition cleanup, reduced motion; no browser errors. APIs mocked, no production writes.')
 browser.close()
