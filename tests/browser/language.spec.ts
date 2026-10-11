import {test,expect} from '@playwright/test';

test('English and Italian switch immediately, persist, and translate terms and errors',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Accept and continue'}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Language',{exact:true}).selectOption('it');
 await expect(page.locator('html')).toHaveAttribute('lang','it');await expect(page.getByLabel('Lingua',{exact:true})).toHaveValue('it');
 await expect(page.getByRole('heading',{name:'Personalizza QuickDrop'})).toBeVisible();await expect(page.getByLabel('Aspetto')).toBeVisible();
 await page.getByRole('button',{name:'Chiudi finestra'}).click();await expect(page.getByRole('heading',{name:'Invia qualcosa'})).toBeVisible();
 const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(element=>element.getBoundingClientRect().right>innerWidth+1).map(element=>({tag:element.tagName,class:element.className,right:element.getBoundingClientRect().right})));expect(overflow).toEqual([]);
 await page.getByLabel('Incolla offerta',{exact:true}).fill('invalid');await page.getByRole('button',{name:'Crea risposta di connessione'}).click();
 await expect(page.getByRole('alert').filter({hasText:'Dati di abbinamento non validi'})).toBeVisible();
 await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await expect(page.locator('.modal-backdrop')).toHaveCSS('opacity','1');await page.screenshot({path:'test-results/settings-italian.png'});await page.getByRole('button',{name:'Chiudi finestra'}).click();
 await page.reload();await expect(page.getByRole('dialog',{name:'Termini di servizio'})).toBeVisible();await expect(page.getByRole('heading',{name:'La tua responsabilità'})).toBeVisible();
 await page.getByRole('button',{name:'Accetta e continua'}).click();await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByLabel('Lingua',{exact:true}).selectOption('en');
 await page.getByRole('button',{name:'Close dialog'}).click();await expect(page.getByRole('heading',{name:'Send something'})).toBeVisible();
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.getByRole('button',{name:'Accept and continue'})).toBeVisible();
});

test('changing language preserves an active session and leaves shared text unchanged',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext();const sender=await a.newPage(),receiver=await b.newPage();
 try {
  await Promise.all([sender.goto('/'),receiver.goto('/')]);for(const page of [sender,receiver])await page.getByRole('button',{name:'Accept and continue'}).click();
  await sender.getByRole('tab',{name:'Text',exact:true}).click();await sender.getByLabel('Text to share').fill('Settings');await sender.getByRole('button',{name:'Create connection offer'}).click();
  await expect(sender.getByLabel('Connection offer')).toBeVisible();await receiver.getByLabel('Paste offer',{exact:true}).fill(await sender.getByLabel('Connection offer').inputValue());await receiver.getByRole('button',{name:'Create connection answer'}).click();
  await expect(receiver.getByLabel('Connection answer')).toBeVisible();await sender.getByLabel('Paste answer',{exact:true}).fill(await receiver.getByLabel('Connection answer').inputValue());await sender.getByRole('button',{name:'Connect browsers'}).click();
  await expect(receiver.getByText('Browsers connected')).toBeVisible();
  await receiver.getByRole('button',{name:'Settings',exact:true}).click();await receiver.getByLabel('Language').selectOption('it');await receiver.getByRole('button',{name:'Chiudi finestra'}).click();
  await expect(receiver.getByText('Browser collegati')).toBeVisible();await sender.getByRole('button',{name:'Send text',exact:true}).click();await receiver.getByRole('button',{name:'Accetta trasferimento'}).click();
  await expect(receiver.getByLabel('TESTO CONDIVISO')).toHaveValue('Settings');
  await receiver.getByRole('tab',{name:'Testo',exact:true}).click();await receiver.getByLabel('Testo da condividere').fill('Una risposta');await receiver.getByRole('button',{name:'Invia testo',exact:true}).click();await sender.getByRole('button',{name:'Accept transfer'}).click();
  await expect(sender.getByLabel('SHARED TEXT')).toHaveValue('Una risposta');await expect(receiver.getByText('Ricevuto dall’altro browser',{exact:true})).toBeVisible();
 }finally{await a.close();await b.close();}
});

test('relay credentials reach the peer connection and cancellation prevents late pairing',async({page})=>{
 await page.addInitScript(()=>{
  const Original=window.RTCPeerConnection;
  (window as any).RTCPeerConnection=class extends Original{
   constructor(config:RTCConfiguration){super(config);(window as any).iceConfig=config;}
   createOffer():Promise<never>{return Promise.reject(new Error('Test stopped after reading ICE configuration.'));}
  };
 });
 await page.route('**/api/ice',route=>route.fulfill({json:{enabled:true,iceServers:[{urls:'turns:relay.example:443?transport=tcp',username:'temporary',credential:'temporary-secret'}]}}));
 await page.goto('/');await page.getByRole('button',{name:'Accept and continue'}).click();await page.getByRole('tab',{name:'Text',exact:true}).click();await page.getByLabel('Text to share').fill('hello');await page.getByRole('button',{name:'Create connection offer'}).click();
 await expect(page.getByRole('alert').filter({hasText:'Test stopped'})).toBeVisible();expect(await page.evaluate(()=>(window as any).iceConfig.iceServers)).toContainEqual({urls:['turns:relay.example:443?transport=tcp'],username:'temporary',credential:'temporary-secret'});
 await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByText('Relay fallback').locator('..')).toContainText('Enabled');await page.getByRole('button',{name:'Close dialog'}).click();await page.getByRole('button',{name:'Start again',exact:true}).click();
 await page.unroute('**/api/ice');let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/ice',async route=>{await held;try{await route.fulfill({json:{enabled:false}});}catch{}});
 await page.getByRole('button',{name:'Create connection offer'}).click();await page.getByRole('button',{name:'Cancel pairing'}).click();release();
 await expect(page.getByRole('button',{name:'Create connection offer'})).toBeVisible();await expect(page.getByRole('button',{name:'Send text',exact:true})).toHaveCount(0);
});

test('private relay access can be entered without storing credentials or changing language',async({page})=>{
 await page.route('**/api/ice',route=>route.request().method()==='GET'?route.fulfill({json:{enabled:true}}):route.request().headers()['x-relay-access']==='friend-code'?route.fulfill({json:{enabled:false}}):route.fulfill({status:401,json:{error:'Relay access code required.',code:'RELAY_ACCESS_REQUIRED'}}));
 await page.goto('/');await page.getByRole('button',{name:'Accept and continue'}).click();await page.getByRole('tab',{name:'Text',exact:true}).click();await page.getByLabel('Text to share').fill('hello');await page.getByRole('button',{name:'Create connection offer'}).click();
 await expect(page.getByRole('alert')).toContainText('Enter the connection code in Settings');await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Connection code').fill('friend-code');
 expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('friend-code');await page.getByRole('button',{name:'Close dialog'}).click();await page.getByRole('button',{name:'Create connection offer'}).click();await expect(page.getByLabel('Connection offer')).toBeVisible();
});

test('a blocked preview request has an accurate Italian message rather than claiming relay failure',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('qd-language','it'));
 await page.route('**/api/ice',route=>route.fulfill({status:403,body:'Blocked request.'}));
 await page.goto('/');await page.getByRole('button',{name:'Accetta e continua'}).click();await page.getByRole('tab',{name:'Testo',exact:true}).click();await page.getByLabel('Testo da condividere').fill('ciao');await page.getByRole('button',{name:'Crea offerta di connessione'}).click();
 await expect(page.getByRole('alert')).toContainText('PROXY 403');await expect(page.getByRole('alert')).not.toContainText('La preparazione del relay');
});

test('pairing on a direct-only preview never calls the blocked relay POST',async({page})=>{
 const posts:string[]=[];await page.route('**/api/ice',route=>{if(route.request().method()==='GET')return route.fulfill({json:{enabled:false}});posts.push(route.request().method());return route.fulfill({status:403,body:'Blocked by proxy'});});
 await page.goto('/');await page.getByRole('button',{name:'Accept and continue'}).click();await page.getByRole('tab',{name:'Text',exact:true}).click();await page.getByLabel('Text to share').fill('hello');await page.getByRole('button',{name:'Create connection offer'}).click();await expect(page.getByLabel('Connection offer')).toBeVisible();expect(posts).toEqual([]);await expect(page.getByRole('alert')).toHaveCount(0);
});
