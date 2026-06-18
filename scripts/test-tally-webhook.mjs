const wh =
  'https://afhiiplxqtodqxvmswor.supabase.co/functions/v1/tally-webhook/0e73b6f4-608a-4f35-870d-2b4ce72bcd7a';

const body = {
  data: {
    fields: [
      { label: 'Nombres', value: 'Prueba Webhook Fix' },
      { label: 'Correo Electrónico', value: 'webhook-fix-test@example.com' },
      { label: 'DNI o Documento de Identidad', value: '55667788' },
      { label: 'Apellido Paterno', value: 'Perez' },
      { label: 'Apellido Materno', value: 'Gomez' },
      { label: 'Edad', value: '30' },
      { label: 'Distrito', value: 'Los Olivos' },
      {
        label: '¿Cómo nos contactaste o te contactamos?',
        type: 'MULTIPLE_CHOICE',
        value: 'opt1',
        options: [{ id: 'opt1', text: 'Facebook' }],
      },
    ],
  },
};

const t0 = Date.now();
const r = await fetch(wh, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(60000),
});
console.log('status', r.status, 'ms', Date.now() - t0);
console.log(await r.text());
