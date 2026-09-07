import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {db} from '../../src/lib/db';
import {COOKIE,cookieOptions,hashToken,principalFromToken} from '../../src/lib/auth';

const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3001';
const origin=process.env.APP_ORIGIN??'http://localhost:3000';
const email='html-form-integration@test.com';
const password='Test1234!';
async function submit(values:Record<string,string>,requestOrigin=origin){
  return fetch(base+'/api/auth/login',{
    method:'POST',redirect:'manual',
    headers:{origin:requestOrigin,'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(values),
  });
}

before(async()=>{
  await db.user.create({data:{email,name:'Перевірка HTML входу',passwordHash:await bcrypt.hash(password,12)}});
});
after(async()=>{await db.$disconnect();});

test('HTTPS always requires Secure cookies and production rejects HTTP',()=>{
  const previous={APP_ORIGIN:process.env.APP_ORIGIN,APP_ENV:process.env.APP_ENV,COOKIE_SECURE:process.env.COOKIE_SECURE,DEMO_MODE:process.env.DEMO_MODE,DEMO_DATE:process.env.DEMO_DATE};
  try{
    Object.assign(process.env,{APP_ORIGIN:'https://attendance.example',COOKIE_SECURE:'false',APP_ENV:'production',DEMO_MODE:'false'});
    delete process.env.DEMO_DATE;
    assert.deepEqual(cookieOptions(),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:2592000});
    process.env.APP_ORIGIN='http://attendance.example';
    assert.throws(()=>cookieOptions(),/Production requires HTTPS/);
  }finally{
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});

test('actual HTML form POST creates opaque DB session and redirects into protected pages',async()=>{
  const html=await(await fetch(base+'/login')).text();
  const action=html.match(/<form[^>]+action="([^"]+)"/)?.[1];
  assert.equal(action,'/api/auth/login');
  // Fetch submits exactly the browser's encoded form body, without JS/hydration.
  const response=await submit({email:'  HTML-FORM-INTEGRATION@TEST.COM  ',password});
  assert.equal(response.status,303);
  assert.equal(response.headers.get('location'),'/');
  const setCookie=response.headers.get('set-cookie')!;
  assert.match(setCookie,/HttpOnly/i);
  assert.match(setCookie,/SameSite=lax/i);
  assert.match(setCookie,/Path=\//i);
  const cookie=setCookie.split(';')[0];
  assert.match(cookie,new RegExp(`^${COOKIE}=[a-f0-9]{64}$`));
  const token=cookie.split('=')[1];
  assert.equal((await principalFromToken(token))?.email,email);
  const session=await db.session.findUniqueOrThrow({where:{tokenHash:hashToken(token)}});
  assert.notEqual(session.tokenHash,token);
  assert.ok(session.expiresAt.getTime()>Date.now());
  const protectedPage=await fetch(base+'/groups',{headers:{cookie},redirect:'manual'});
  assert.equal(protectedPage.status,200);
  assert.ok((await protectedPage.text()).includes('Перевірка HTML входу'));
});

test('HTML failures use generic rendered messages without credentials in redirect URLs',async()=>{
  const known=await submit({email,password:'wrong-password'});
  const missing=await submit({email:'absent-html-form@test.com',password:'wrong-password'});
  assert.equal(known.status,303);
  assert.equal(missing.status,303);
  assert.equal(known.headers.get('location'),'/login?error=invalid');
  assert.equal(missing.headers.get('location'),known.headers.get('location'));
  assert.equal(known.headers.get('set-cookie'),null);
  const rendered=await(await fetch(base+known.headers.get('location'))).text();
  assert.match(rendered,/Невірна електронна пошта або пароль\./);
  assert.doesNotMatch(rendered,/wrong-password|html-form-integration@test.com/);
  const invalid=await submit({email:'bad-address',password});
  assert.equal(invalid.headers.get('location'),'/login?error=validation');
  const foreignOrigin=await submit({email,password},'https://untrusted.invalid');
  assert.equal(foreignOrigin.headers.get('location'),'/login?error=origin');
  assert.equal(foreignOrigin.headers.get('set-cookie'),null);
});

test('HTML and JSON login share the same rate limit bucket',async()=>{
  const limitedEmail='html-rate-limit@test.com';
  for(let i=0;i<4;i++){
    const form=await submit({email:limitedEmail,password:'wrong'});
    assert.equal(form.headers.get('location'),'/login?error=invalid');
    const json=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({email:limitedEmail,password:'wrong'})});
    assert.equal(json.status,401);
  }
  const limited=await submit({email:limitedEmail,password});
  assert.equal(limited.headers.get('location'),'/login?error=rate');
  assert.equal(limited.headers.get('retry-after'),'900');
  assert.equal(limited.headers.get('set-cookie'),null);
  assert.match(await(await fetch(base+'/login?error=rate')).text(),/Забагато спроб/);
});

test('malformed JSON and duplicate HTML fields are validation errors',async()=>{
  const json=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{'});
  assert.equal(json.status,400);
  const duplicate=await fetch(base+'/api/auth/login',{method:'POST',redirect:'manual',headers:{origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams([['email',email],['email','absent@test.com'],['password',password]])});
  assert.equal(duplicate.headers.get('location'),'/login?error=validation');
});
