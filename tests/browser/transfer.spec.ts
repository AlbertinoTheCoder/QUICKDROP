import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('two independent browsers pair, accept real files, compare bytes, then share safe text',async({browser})=>{
 const senderContext=await browser.newContext(),receiverContext=await browser.newContext();const sender=await senderContext.newPage(),receiver=await receiverContext.newPage();
 const errors:string[]=[];for(const page of [sender,receiver])page.on('pageerror',e=>errors.push(e.message));
 try{await Promise.all([sender.goto('/'),receiver.goto('/')]);await sender.getByRole('button',{name:'Accept and continue'}).click();await receiver.getByRole('button',{name:'Accept and continue'}).click();await expect(sender.locator('.receive-card')).toHaveCSS('opacity','1');await sender.screenshot({path:'test-results/desktop.png',fullPage:true});const bytes=Buffer.alloc(1024*1024+37);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
 await sender.locator('input[type=file]').setInputFiles([{name:'original.bin',mimeType:'application/octet-stream',buffer:bytes},{name:'empty.txt',mimeType:'text/plain',buffer:Buffer.alloc(0)}]);
 await sender.getByRole('button',{name:'Create connection offer'}).click();await expect(sender.getByLabel('Connection offer')).toBeVisible();const offer=await sender.getByLabel('Connection offer').inputValue();expect(offer).toMatch(/^QD1\./);
 await receiver.getByLabel('Paste offer',{exact:true}).fill(offer);await receiver.getByRole('button',{name:'Create connection answer'}).click();const answerOutput=receiver.getByLabel('Connection answer');await expect(answerOutput).toBeVisible();const answer=await answerOutput.inputValue();await sender.getByLabel('Paste answer',{exact:true}).fill(answer);await sender.getByRole('button',{name:'Connect browsers'}).click();await expect(sender.getByText('Browsers connected')).toBeVisible();await expect(receiver.getByText('Browsers connected')).toBeVisible();
 await sender.getByRole('button',{name:'Send files',exact:true}).click();await expect(receiver.getByRole('button',{name:'Accept transfer'})).toBeVisible();await expect(receiver.getByRole('button',{name:'Save original.bin'})).toHaveCount(0);await expect(sender.getByText('Waiting for recipient acceptance',{exact:true})).toBeVisible();
 await receiver.getByRole('button',{name:'Accept transfer'}).click();await expect(sender.getByText('Received by the other browser',{exact:true})).toBeVisible({timeout:20000});await expect(receiver.getByRole('button',{name:'Save original.bin'})).toBeVisible();
 // Compare the download generated from the actual received Blob with the original bytes.
 const downloaded=receiver.waitForEvent('download');await receiver.getByRole('button',{name:'Save original.bin'}).click();const download=await downloaded;const actual=await readFile((await download.path())!);expect(createHash('sha256').update(actual).digest('hex')).toBe(createHash('sha256').update(bytes).digest('hex'));expect(actual.equals(bytes)).toBe(true);
 const emptyDownload=receiver.waitForEvent('download');await receiver.getByRole('button',{name:'Save empty.txt'}).click();expect((await readFile((await (await emptyDownload).path())!)).length).toBe(0);
 await sender.getByRole('tab',{name:'Text',exact:true}).click();const text='<script>window.hacked=true</script>\nHello iPad 🙂';await sender.getByLabel('Text to share').fill(text);await sender.getByRole('button',{name:'Send text',exact:true}).click();await receiver.getByRole('button',{name:'Accept transfer'}).click();await expect(receiver.getByLabel('SHARED TEXT')).toHaveValue(text);expect(await receiver.evaluate(()=>Boolean((window as any).hacked))).toBe(false);await receiver.getByRole('button',{name:'Select all',exact:true}).click();expect(await receiver.getByLabel('SHARED TEXT').evaluate((e:HTMLTextAreaElement)=>e.selectionEnd-e.selectionStart)).toBe(text.length);
 await sender.getByLabel('Text to share').fill('Decline this');await sender.getByRole('button',{name:'Send text',exact:true}).click();await receiver.getByRole('button',{name:'Decline',exact:true}).click();await expect(sender.getByText('Recipient declined',{exact:true})).toBeVisible();
 await sender.getByRole('button',{name:'Send text',exact:true}).click();await expect(receiver.getByRole('button',{name:'Accept transfer'})).toBeVisible();await sender.getByRole('button',{name:'Cancel transfer'}).click();await expect(receiver.getByText('Transfer cancelled',{exact:true})).toBeVisible();
 // The browser that answered can send files and text back without pairing again.
 const replyBytes=Buffer.from('Reply file from the other browser 🙂');
 await receiver.locator('input[type=file]').setInputFiles({name:'reply.txt',mimeType:'text/plain',buffer:replyBytes});
 await expect(receiver.getByRole('button',{name:'Browse files'})).toBeEnabled();
 await receiver.getByRole('button',{name:'Send files',exact:true}).click();
 await expect(sender.getByRole('button',{name:'Accept transfer'})).toBeVisible();
 await expect(sender.getByRole('button',{name:'Save reply.txt'})).toHaveCount(0);
 await sender.getByRole('button',{name:'Accept transfer'}).click();
 await expect(receiver.getByText('Received by the other browser',{exact:true})).toBeVisible();
 const replyDownload=sender.waitForEvent('download');await sender.getByRole('button',{name:'Save reply.txt'}).click();
 expect((await readFile((await (await replyDownload).path())!)).equals(replyBytes)).toBe(true);
 await receiver.getByRole('tab',{name:'Text',exact:true}).click();await receiver.getByLabel('Text to share').fill('A reply in the same session');
 await receiver.getByRole('button',{name:'Send text',exact:true}).click();await sender.getByRole('button',{name:'Decline',exact:true}).click();
 await expect(receiver.getByText('Recipient declined',{exact:true})).toBeVisible();await expect(sender.getByText('Browsers connected')).toBeVisible();
 await receiver.getByRole('button',{name:'Send text',exact:true}).click();await sender.getByRole('button',{name:'Accept transfer'}).click();
 await expect(sender.getByLabel('SHARED TEXT')).toHaveValue('A reply in the same session');
 await expect(receiver.getByRole('button',{name:'Send text',exact:true})).toBeEnabled();
 await sender.getByRole('button',{name:'End session'}).click();await expect(receiver.getByRole('button',{name:'Start again',exact:true})).toBeVisible();await expect(receiver.getByText('Browsers connected')).toHaveCount(0);expect(errors).toEqual([]);
 }finally{await senderContext.close();await receiverContext.close();}
});
test('mobile layout, invalid pairing and harmless settings',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Accept and continue'}).click();await expect(page.locator('.receive-card')).toHaveCSS('opacity','1');await page.screenshot({path:'test-results/mobile.png',fullPage:true});for(const width of [320,360,390,768]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}await page.setViewportSize({width:390,height:844});await page.getByLabel('Paste offer',{exact:true}).fill('not a valid offer');await page.getByRole('button',{name:'Create connection answer'}).click();await expect(page.getByRole('alert').filter({hasText:'Invalid pairing data'})).toBeVisible();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Appearance').selectOption('light');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.getByLabel('Reduce animations').check();await page.getByRole('button',{name:'Close dialog'}).click();});
test('offer preparation error displays the actual cause without blaming a missing answer',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(RTCPeerConnection.prototype,'createOffer',{value:()=>Promise.reject(new Error('Network discovery timed out. Try again.')),configurable:true});});
 await page.goto('/');await page.getByRole('button',{name:'Accept and continue'}).click();await page.locator('input[type=file]').setInputFiles({name:'small.txt',mimeType:'text/plain',buffer:Buffer.from('small file')});
 await page.getByRole('button',{name:'Create connection offer'}).click();
 await expect(page.getByRole('alert').filter({hasText:'Pairing failed.'})).toContainText('Network discovery timed out. Try again.');
 await expect(page.getByText('No remote network routes were loaded.',{exact:false})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Start again',exact:true})).toBeVisible();
});

test('terms popup blocks the app until accepted and cannot be unaccepted',async({page})=>{
 await page.goto('/');
 const dialog=page.getByRole('dialog');
 await expect(dialog).toBeVisible();
 await expect(dialog).toContainText('We are not responsible for shared content');
 for(const [width,height] of [[320,568],[390,844],[1280,800]]){
  await page.setViewportSize({width,height});
  const action=page.getByRole('button',{name:'Accept and continue'});
  await expect(action).toBeInViewport();
  const bounds=await action.boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 await page.screenshot({path:'test-results/terms-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/terms-mobile.png'});

 await expect(page.getByRole('button',{name:'Close dialog'})).toHaveCount(0);
 await expect(page.locator('.app-shell > div[inert]')).toHaveCount(1);
 await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
 await page.locator('.modal-backdrop').click({position:{x:5,y:5}});await expect(dialog).toBeVisible();
 await page.getByRole('button',{name:'Accept and continue'}).focus();
 await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Accept and continue'})).toBeFocused();
 await page.getByRole('button',{name:'Accept and continue'}).click();await expect(dialog).toHaveCount(0);
 await expect(page.locator('.app-shell > div[inert]')).toHaveCount(0);
 await expect(page.getByRole('checkbox')).toHaveCount(0);
 await page.locator('input[type=file]').setInputFiles({name:'test.txt',mimeType:'text/plain',buffer:Buffer.from('test')});
 await expect(page.getByRole('button',{name:'Create connection offer'})).toBeEnabled();
 await page.getByRole('button',{name:'Terms of Service',exact:true}).click();await expect(dialog).toBeVisible();
 await expect(page.getByRole('button',{name:'Accept and continue'})).toHaveCount(0);
 await page.getByRole('button',{name:'Close dialog'}).click();
 await expect(page.getByRole('button',{name:'Create connection offer'})).toBeEnabled();
 await page.reload();await expect(dialog).toBeVisible();
});

test('opening the app never triggers a download',async({page})=>{
 const downloads:string[]=[];page.on('download',download=>downloads.push(download.suggestedFilename()));
 const response=await page.goto('/');expect(response!.headers()['content-type']).toContain('text/html');expect(response!.headers()['content-disposition']).toBeUndefined();
 await page.getByRole('button',{name:'Accept and continue'}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Close dialog'}).click();
 await expect(page.getByRole('heading',{name:'Send something'})).toBeVisible();expect(downloads).toEqual([]);
});
