// Run through cua_repl with an authenticated tab on the isolated TEST clone.
// The host provides CUA's tab API. This module does not launch another browser.
import assert from 'node:assert/strict';

export async function adminDialogRegression(tab,{otherUser}){
  const p=tab.playwright,trigger=p.getByRole('button',{name:'Керувати обліковим записом'});
  await trigger.click();
  const user=p.getByRole('combobox',{name:'Користувач',exact:true});
  await user.click();
  assert.ok(await p.getByRole('listbox').isVisible());
  assert.equal(await p.evaluate(()=>Boolean(document.querySelector('[role=listbox]')?.closest('dialog'))),true);
  await p.getByRole('option',{name:otherUser,exact:true}).click();
  const action=p.getByRole('combobox',{name:'Дія',exact:true}),target=p.getByRole('combobox',{name:'Об’єкт',exact:true});
  await action.click();await p.getByRole('option',{name:'Додати роль',exact:true}).click();
  await target.click();await p.getByRole('option',{name:'Студент · власний профіль',exact:true}).click();
  await target.press('ArrowDown');await target.press('End');await target.press('Enter');
  assert.match(await target.innerText(),/Староста/);
  await p.getByRole('textbox',{name:'Причина зміни'}).fill('Безпечна перевірка без збереження');
  assert.equal(await p.getByRole('button',{name:'Зберегти призначення'}).isEnabled(),true);
  // Includes wrapping from the last control back to the close button.
  for(let i=0;i<9;i++){
    await tab.pressKey('Tab');
    assert.equal(await p.evaluate(()=>Boolean(document.activeElement?.closest('dialog[open]'))),true);
  }
  await action.click();await action.press('Escape');
  assert.equal(await p.getByRole('listbox').count(),0);
  assert.equal(await p.getByRole('dialog').isVisible(),true);
  await action.press('Escape');
  assert.equal(await p.getByRole('dialog').count(),0);
  assert.equal(await p.evaluate(()=>document.activeElement?.textContent),'Керувати обліковим записом');
  await trigger.click();
  const oldUrl=await tab.url();
  // The dashboard link is at the left of the dialog, under the native backdrop.
  await tab.click([100,150]);
  assert.equal(await tab.url(),oldUrl);
  assert.equal(await p.getByRole('dialog').count(),0);
  return {pointer:true,keyboard:true,focusTrap:true,escapeMenuThenDialog:true,focusReturn:true,backdrop:true,saved:false};
}

export async function revokeAllRegression(tab,{base,email,password}){
  const p=tab.playwright;
  await tab.goto(base+'/login');
  await p.getByRole('textbox',{name:'Електронна пошта',exact:true}).fill(email);
  await p.getByLabel('Пароль',{exact:true}).fill(password);
  await p.getByRole('button',{name:'Увійти до системи →',exact:true}).click();
  await p.getByRole('link',{name:'Мій профіль'}).waitFor({state:'visible'});
  await p.getByRole('link',{name:'Мій профіль'}).click();
  await p.getByRole('button',{name:'Вийти з усіх пристроїв'}).click();
  await p.getByRole('button',{name:'Увійти до системи →',exact:true}).waitFor({state:'visible'});
  assert.equal(new URL(await tab.url()).pathname,'/login');
  await tab.goto(base+'/profile');
  await p.getByRole('button',{name:'Увійти до системи →',exact:true}).waitFor({state:'visible'});
  assert.equal(new URL(await tab.url()).pathname,'/login');
  await tab.back();
  await p.getByRole('button',{name:'Увійти до системи →',exact:true}).waitFor({state:'visible'});
  assert.equal(new URL(await tab.url()).pathname,'/login');
  const errors=await tab.dev.logs({levels:['error'],limit:100});
  assert.ok(!errors.some(e=>/419|hydrat|Suspense|client.*render/i.test(e.message)),JSON.stringify(errors));
  return {redirect:true,protectedProfile:true,back:true,reactErrors:0};
}
