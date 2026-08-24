import { useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import { useFetchChangelog } from '../../services/misc';
import ChangeLog from '../settings/Changelog';

interface FooterProps {
   currentVersion: string
}

const Footer = ({ currentVersion = '' }: FooterProps) => {
   const [showChangelog, setShowChangelog] = useState(false);
   const { data: changeLogs } = useFetchChangelog();
   const latestVersionNum = changeLogs && Array.isArray(changeLogs) && changeLogs[0] ? changeLogs[0].name : '';

   return (
      <footer className='text-center flex flex-1 justify-center pb-5 items-end'>
         <span className='text-gray-500 text-xs'>
            <span>PoloRank v{currentVersion || '0.0.0'}</span>
            <span className='text-gray-400'> · basado en </span>
            <a className='cursor-pointer text-gray-400 hover:text-blue-700' onClick={() => setShowChangelog(true)}>SerpBear</a>
            {currentVersion && latestVersionNum && `v${currentVersion}` !== latestVersionNum && (
               <a className='cursor-pointer text-indigo-700 font-semibold' onClick={() => setShowChangelog(true)}>
                  {' '}| SerpBear {latestVersionNum} disponible
               </a>
            )}
         </span>
         <CSSTransition in={showChangelog} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
             <ChangeLog closeChangeLog={() => setShowChangelog(false)} />
         </CSSTransition>
      </footer>
   );
};

export default Footer;
