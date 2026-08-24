import type { GetServerSideProps, NextPage } from 'next';
import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Toaster } from 'react-hot-toast';
import { guardPage } from '../utils/auth/pageGuard';
import Icon from '../components/common/Icon';

const Home: NextPage = () => {
   const router = useRouter();
   useEffect(() => {
      if (router) router.push('/domains');
   }, [router]);

  return (
    <div>
      <Head>
        <title>SerpBear</title>
        <meta name="description" content="SerpBear Google Keyword Position Tracking App" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main role={'main'} className='main flex items-center justify-center w-full h-screen'>
        <Icon type='loading' size={36} color="#999" />
      </main>
      <Toaster position='bottom-center' containerClassName="react_toaster" />
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => guardPage(ctx, { superadminOnly: true });

export default Home;
