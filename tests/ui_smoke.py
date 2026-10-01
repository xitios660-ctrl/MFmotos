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
 elif path=='/fiscal/issuer':data=json.loads(Path('fiscal-issuer.json').read_text())
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
 page.wait_for_timeout(1200)
 assert page.locator('#app').is_hidden()
 page.screenshot(path=str(ARTIFACTS/'cinema-login-desktop.png'))
 for w in [390,320]:
  page.set_viewport_size({'width':w,'height':844})
  page.screenshot(path=str(ARTIFACTS/('cinema-login-'+str(w)+'.png')),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.set_viewport_size({'width':1440,'height':1000})
 page.locator('#cinemaMotionToggle').click()
 assert page.locator('#cinemaVideo').evaluate('(el)=>el.paused')
 page.locator('#cinemaMotionToggle').click()
 page.locator('#cinemaThrottle').focus();page.keyboard.down('Space')
 assert page.locator('#login').evaluate('(el)=>el.classList.contains("login-revving")')
 page.keyboard.up('Space')
 assert page.locator('#cinemaThrottle').get_attribute('aria-pressed')=='false'
 page.locator('#tabRegister').click();assert page.locator('#authName').is_visible()
 page.locator('#tabLogin').click();assert not page.locator('#authName').is_visible()
 page.emulate_media(reduced_motion='reduce')
 page.wait_for_function("document.querySelector('#cinemaVideo').paused")
 assert page.locator('#cinemaThrottle').is_disabled()
 page.emulate_media(reduced_motion='no-preference')
 page.locator('#authEmail').fill('ana@example.com');page.locator('#authPass').fill('test-password')
 page.locator('#authSubmit').click();page.locator('#content .hero').wait_for();page.wait_for_timeout(700)
 assert page.locator('#mobileNav,.mobile,.loginStory').count()==0
 assert page.locator('#cinemaVideo').evaluate('(el)=>el.paused')
 assert page.locator('#nav button').count()==8
 assert page.locator('[data-page="overview"]').count()==0
 assert page.locator('#crumb').inner_text()=='INÍCIO'
 assert page.locator('#startAttendance').is_visible()
 page.locator('#startAttendance').click()
 page.locator('#attClientName').wait_for()
 assert page.locator('#crumb').inner_text()=='ATENDIMENTO'
 page.evaluate("go('inicio')")
 page.locator('#startAttendance').wait_for()
 assert page.locator('#sidebarToggle').count()==0
 for width in [1440,390,320,768]:
  page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(400)
  page.evaluate('setSidebarExpanded(false)');page.wait_for_timeout(400)
  assert page.locator('#workspaceSide').bounding_box()['width']==44
  assert page.locator('.main').bounding_box()['x']==0
  assert abs(page.locator('.main').bounding_box()['width']-width)<1
  assert abs(page.locator('#content').bounding_box()['width']-width)<1
  assert page.locator('#sideCollapse').bounding_box()['width']==44
  assert page.locator('#sidebarSearch').is_hidden()
  assert page.locator('#nav').is_hidden()
  assert page.locator('.workspaceProfile').is_hidden()
  assert page.locator('.workspaceFooter').is_hidden()
  assert page.locator('#workspaceSide').bounding_box()['height']<120
  page.evaluate('scrollTo(0,0)')
  page.screenshot(path=str(ARTIFACTS/('rail-'+str(width)+'.png')))
  page.locator('#sideCollapse').click();page.wait_for_timeout(400)
  assert page.locator('#sidebarSearch').is_visible()
  assert page.locator('#nav button:visible').count()==8
  assert page.locator('.workspaceProfile').is_visible()
  assert page.locator('.workspaceFooter').is_visible()
  assert page.locator('#workspaceSide').bounding_box()['width']>240
  assert page.locator('.main').evaluate('(el)=>el.inert')
  drawer=page.locator('#workspaceSide').bounding_box()
  toggle=page.locator('#sideCollapse').bounding_box()
  assert drawer['x']<=toggle['x'] and toggle['x']+toggle['width']<=drawer['x']+drawer['width']
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
  if width in [1440,390,320,768]:
   page.locator('#sideCollapse').click();page.wait_for_timeout(350)
   page.locator('#sideCollapse').focus();page.keyboard.press('Shift+Tab')
   assert page.locator('#nav button').last.evaluate('(el)=>el===document.activeElement')
   page.locator('#sidebarBackdrop').click(position={'x':width-5,'y':700})
   assert page.locator('#sideCollapse').get_attribute('aria-expanded')=='false'
  for tab in ['inventory','clients','orders','budgets','fiscal','security','atendimento']:
   page.locator('#sideCollapse').click();page.wait_for_timeout(350)
   page.locator('#nav [data-page="'+tab+'"]').click();page.wait_for_timeout(400)
   assert page.locator('#nav [data-page="'+tab+'"]').get_attribute('aria-current')=='page'
   assert page.locator('#content .hero h1').count()==1
   assert page.locator('#sideCollapse').get_attribute('aria-expanded')=='false'
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),str(width)+' overflow in '+tab
 # Dialog navigation uses the keyboard and does not write any real records.
 page.evaluate("go('clients')")
 page.locator('#content .hero h1').filter(has_text='CLIENTES').wait_for()
 page.locator('#content .hero button').click()
 dialog=page.get_by_role('dialog',name='Novo cliente')
 assert dialog.is_visible()
 name=dialog.get_by_label('Nome',exact=True)
 assert name.evaluate('(el)=>el===document.activeElement')
 assert page.locator('#app').evaluate('(el)=>el.inert')
 close=dialog.get_by_role('button',name='Fechar janela')
 close.focus();page.keyboard.press('Shift+Tab')
 assert dialog.locator('button').last.evaluate('(el)=>el===document.activeElement')
 page.keyboard.press('Tab')
 assert close.evaluate('(el)=>el===document.activeElement')
 page.keyboard.press('Escape')
 assert page.get_by_role('dialog').count()==0
 assert not page.locator('#app').evaluate('(el)=>el.inert')
 assert page.locator('#content .hero button').evaluate('(el)=>el===document.activeElement')
 page.emulate_media(reduced_motion='reduce')
 page.locator('#sideCollapse').click()
 assert page.locator('#workspaceSide').evaluate('(el)=>getComputedStyle(el).transitionDuration')=='0s'
 page.keyboard.press('Escape')
 assert not errors,errors
 print('PASS: eight shortcuts, welcome and start attendance, accessible dialog focus/labels/escape, no overview, collapse/expand, full-width workspace and overlay drawer, search with accent normalization, keyboard shortcut, mobile focus and backdrop, all modules at 320/390/768/1440 px, reduced motion; no browser errors. APIs mocked.')
 browser.close()
