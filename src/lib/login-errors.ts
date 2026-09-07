const messages:Record<string,string>={
  invalid:'Невірна електронна пошта або пароль.',
  validation:'Перевірте електронну пошту та пароль.',
  rate:'Забагато спроб. Повторіть пізніше.',
  origin:'Походження запиту не дозволене. Відкрийте сторінку входу ще раз.',
  unavailable:'Не вдалося увійти. Спробуйте ще раз.',
};

export function loginErrorMessage(code:string|string[]|undefined){
  return typeof code==='string'&&Object.hasOwn(messages,code)?messages[code]:'';
}
