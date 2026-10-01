"""Verify issuer display and recipient fields with mocked fiscal APIs."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
issuer=json.loads(Path('fiscal-issuer.json').read_text())
created=[]
def mock(route):
 path=route.request.url.split('/api')[-1]
 if path=='/fiscal/issuer':data=issuer
 elif path=='/fiscal' and route.request.method=='POST':
  body=route.request.post_data_json
  created.append(dict(body,id='test-draft',status='rascunho',issuer=issuer));data=created[-1]
 elif path=='/fiscal':data=created
 else:data=[]
 route.fulfill(json=data)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1440,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("localStorage.mf_token='preview-token'")
 page.route('**/api/**',mock)
 page.goto(os.environ.get('MF_UI_URL','http://127.0.0.1:4173'),wait_until='networkidle')
 page.evaluate("go('fiscal')");page.locator('.fiscalIssuer').wait_for();page.wait_for_timeout(500)
 for expected in ['Camila Alves de Santana','MF Motos','22.406.461/0001-00','454443891110','Simples Nacional convencional','Rua Dr. Deodato Wertheimer, 2351','Mogi Moderno','Mogi das Cruzes','08717-030','Cruzeiro do Sul Contabilidade','A1 · Informado pela empresa']:
  assert expected in page.locator('.fiscalIssuer').inner_text(),expected
 directory=Path('/tmp/mf-fiscal');directory.mkdir(exist_ok=True)
 for width in [1440,390,320]:
  page.set_viewport_size({'width':width,'height':900});page.screenshot(path=str(directory/('issuer-'+str(width)+'.png')),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.get_by_role('button',name='+ Nova nota').click()
 assert '22.406.461/0001-00' in page.locator('.fiscalIssuerPreview').inner_text()
 assert page.locator('[name=client_document]').input_value()==''
 assert page.locator('#fiscalClient').input_value()==''
 page.locator('#fiscalClient').fill('Cliente de teste');page.locator('[name=client_document]').fill('12345678900');page.locator('#fiscalTotal').fill('45')
 page.get_by_role('button',name='Salvar rascunho').click()
 page.locator('.table tbody').get_by_text('Cliente de teste').wait_for()
 assert created[0]['client_document']=='12345678900'
 assert not errors,errors
 print('PASS: issuer details match the supplied photo, responsive layouts, issuer preview, recipient fields remain separate, draft creation. APIs mocked; no real notes created.')
 browser.close()
