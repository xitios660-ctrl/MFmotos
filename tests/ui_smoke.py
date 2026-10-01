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
 page.locator('#authEmail').fill('ana@example.com');page.locator('#authPass').fill('test-password')
 page.locator('#authSubmit').click();page.locator('.cockpit').wait_for();page.wait_for_timeout(700)
 assert page.locator('#mobileNav,.mobile,.loginStory').count()==0
 assert page.locator('#nav button').count()==8
 assert page.locator('#sidebarToggle').count()==0
 for width in [1440,390,320,768]:
  page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(400)
  page.evaluate('setSidebarExpanded(false)');page.wait_for_timeout(400)
  assert page.locator('#workspaceSide').bounding_box()['width']<85
  assert page.locator('#sidebarSearch').is_hidden()
  page.evaluate('scrollTo(0,0)')
  page.screenshot(path=str(ARTIFACTS/('rail-'+str(width)+'.png')))
  page.locator('#sideCollapse').click();page.wait_for_timeout(400)
  assert page.locator('#sidebarSearch').is_visible()
  assert page.locator('#workspaceSide').bounding_box()['width']>240
  page.screenshot(path=str(ARTIFACTS/('expanded-'+str(width)+'.png')))
  page.locator('#sidebarSearch').fill('orcamento')
  assert page.locator('#nav button:visible').count()==1
  assert page.locator('#nav button:visible').get_attribute('data-page')=='budgets'
  page.locator('#sidebarSearch').fill('sem-resultado')
  assert page.locator('#sideNoResults').is_visible()
  page.locator('#sidebarSearch').fill('')
  page.keyboard.press('Escape');assert page.locator('#sideCollapse').get_attribute('aria-expanded')=='false'
  page.keyboard.press('Control+k');assert page.locator('#sidebarSearch').evaluate('(el)=>el===document.activeElement')
  page.keyboard.press('Escape')
  if width<=760:
   page.locator('#sideCollapse').click();page.wait_for_timeout(350)
   page.locator('#sideCollapse').focus();page.keyboard.press('Shift+Tab')
   assert page.locator('#nav button').last.evaluate('(el)=>el===document.activeElement')
   page.locator('#sidebarBackdrop').click(position={'x':width-5,'y':700})
   assert page.locator('#sideCollapse').get_attribute('aria-expanded')=='false'
  for tab in ['inventory','clients','orders','budgets','fiscal','security','atendimento','overview']:
   page.locator('#sideCollapse').click();page.wait_for_timeout(350)
   page.locator('#nav [data-page="'+tab+'"]').click();page.wait_for_timeout(400)
   assert page.locator('#nav [data-page="'+tab+'"]').get_attribute('aria-current')=='page'
   assert page.locator('#content .hero h1').count()==1
   if width<=760:assert page.locator('#sideCollapse').get_attribute('aria-expanded')=='false'
   else:page.locator('#sideCollapse').click();page.wait_for_timeout(350)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),str(width)+' overflow in '+tab
 page.emulate_media(reduced_motion='reduce')
 page.locator('#sideCollapse').click()
 assert page.locator('#workspaceSide').evaluate('(el)=>getComputedStyle(el).transitionDuration')=='0s'
 page.keyboard.press('Escape')
 assert not errors,errors
 print('PASS: eight icon shortcuts, collapse/expand, responsive rail/drawer, search with accent normalization, keyboard shortcut, mobile focus and backdrop, all modules at 320/390/768/1440 px, reduced motion; no browser errors. APIs mocked.')
 browser.close()
