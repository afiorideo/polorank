/* eslint-disable @next/next/no-img-element */
import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { redirectIfAuthenticated } from '../../utils/auth/pageGuard';

type Step = 'email' | 'code';

const Login: NextPage = () => {
   const router = useRouter();
   const [step, setStep] = useState<Step>('email');
   const [email, setEmail] = useState('');
   const [code, setCode] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [info, setInfo] = useState<string | null>(null);
   const [pending, setPending] = useState(false);

   const post = async (route: string, body: object) => {
      const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'application/json' });
      const res = await fetch(`${window.location.origin}${route}`, { method: 'POST', headers, body: JSON.stringify(body) });
      return res.json();
   };

   const sendCode = async (e?: React.FormEvent) => {
      if (e) { e.preventDefault(); }
      setError(null);
      setInfo(null);
      const mail = email.trim().toLowerCase();
      if (!mail) { return; }
      setPending(true);
      try {
         const res = await post('/api/auth/request', { email: mail });
         if (!res.success) {
            setError(res.error || 'No pudimos enviar el código.');
         } else {
            setEmail(mail);
            setStep('code');
            setInfo(res.message || `Si el correo está autorizado, te llegará un código de 6 dígitos a ${mail}.`);
         }
      } catch (fetchError) {
         setError('No pudimos conectar con el servidor. Inténtalo de nuevo.');
      }
      setPending(false);
   };

   const verify = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const token = code.trim();
      if (token.length < 6) { return; }
      setPending(true);
      try {
         const res = await post('/api/auth/verify', { email, code: token });
         if (!res.success) {
            setError(res.error || 'Código incorrecto o vencido.');
            setPending(false);
            return;
         }
         router.push(res.redirect || '/');
      } catch (fetchError) {
         setError('No pudimos conectar con el servidor. Inténtalo de nuevo.');
         setPending(false);
      }
   };

   const labelStyle = 'mb-2 font-semibold inline-block text-sm text-gray-700';
   const inputStyle = 'w-full p-2 border border-gray-200 rounded mb-3 focus:outline-none focus:border-blue-200';
   const buttonStyle = 'w-full py-2 px-5 rounded cursor-pointer bg-blue-700 text-white font-semibold text-sm disabled:opacity-60';
   const linkStyle = 'text-xs text-gray-500 hover:text-blue-700 cursor-pointer';

   return (
      <div className={'Login'}>
         <Head>
            <title>Ingresar - PoloRank</title>
         </Head>
         <div className='flex items-center justify-center w-full h-screen'>
            <div className='w-80 mt-[-300px]'>
               <h3 className="py-7 text-2xl font-bold text-blue-700 text-center flex items-center justify-center gap-2">
                  <img src='/brand/polo-face.png' alt='' width={40} height={44} />
                  PoloRank
               </h3>
               <div className='relative bg-[white] rounded-md text-sm border p-5'>
                  {step === 'email' && (
                     <form onSubmit={sendCode} data-testid='login_email_form'>
                        <div className="settings__section__input mb-5">
                           <label className={labelStyle} htmlFor='login_email'>Correo</label>
                           <input
                              id='login_email'
                              className={`${inputStyle} ${error ? 'border-red-400 focus:border-red-400' : ''}`}
                              type="email"
                              autoComplete='email'
                              autoFocus
                              required
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              placeholder='tu@correo.cl'
                           />
                        </div>
                        {error && <p className='mb-3 text-red-600 text-xs'>{error}</p>}
                        <button type='submit' className={buttonStyle} disabled={pending}>
                           {pending ? 'Enviando código…' : 'Enviar código de acceso'}
                        </button>
                        <p className='mt-3 text-center text-xs text-gray-400'>Te enviamos un código de 6 dígitos a tu correo. Sin contraseñas.</p>
                     </form>
                  )}
                  {step === 'code' && (
                     <form onSubmit={verify} data-testid='login_code_form'>
                        {info && <p className='mb-3 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800'>{info}</p>}
                        <div className="settings__section__input mb-5">
                           <label className={labelStyle} htmlFor='login_code'>Código de acceso</label>
                           <input
                              id='login_code'
                              className={`${inputStyle} text-center text-2xl tracking-[0.5em] ${error ? 'border-red-400 focus:border-red-400' : ''}`}
                              inputMode='numeric'
                              autoComplete='one-time-code'
                              maxLength={6}
                              autoFocus
                              required
                              value={code}
                              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                              placeholder='000000'
                           />
                        </div>
                        {error && <p className='mb-3 text-red-600 text-xs'>{error}</p>}
                        <button type='submit' className={buttonStyle} disabled={pending || code.length < 6}>
                           {pending ? 'Verificando…' : 'Ingresar'}
                        </button>
                        <div className='flex items-center justify-between mt-4'>
                           <button type='button' className={linkStyle}
                              onClick={() => { setStep('email'); setCode(''); setError(null); setInfo(null); }}>← Cambiar correo</button>
                           <button type='button' className={linkStyle} disabled={pending} onClick={() => sendCode()}>Reenviar código</button>
                        </div>
                     </form>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => redirectIfAuthenticated(ctx);

export default Login;
