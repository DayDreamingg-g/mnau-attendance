import test from 'node:test';
import assert from 'node:assert/strict';
import {loginErrorMessage} from '../src/lib/login-errors';

test('login displays only known error codes, never query text',()=>{
  assert.equal(loginErrorMessage('invalid'),'Невірна електронна пошта або пароль.');
  for(const value of [undefined,['invalid'],'<script>alert(1)</script>','constructor','__proto__']){
    assert.equal(loginErrorMessage(value),'');
  }
});
