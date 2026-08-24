/* eslint-disable @next/next/no-img-element */
import React from 'react';

type LogoProps = {
   /** face height in px */
   size?: number,
   /** hide the wordmark (icon only) */
   iconOnly?: boolean,
   className?: string,
}

/** PoloRank brand mark: the face + "PoloRank" wordmark in Space Grotesk with the Emignia gradient. */
const Logo = ({ size = 32, iconOnly = false, className = '' }: LogoProps) => (
   <span className={`inline-flex items-center gap-2 select-none ${className}`} data-testid='logo'>
      <img src='/brand/polo-face.png' alt='PoloRank' width={Math.round(size * 0.9)} height={size} style={{ height: size, width: 'auto' }} />
      {!iconOnly && (
         <span
         className='font-display font-bold tracking-tight leading-none'
         style={{
            fontSize: Math.round(size * 0.62),
            background: 'linear-gradient(135deg, #6C63FF 0%, #3B82F6 55%, #00E5FF 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
         }}>
            PoloRank
         </span>
      )}
   </span>
);

export default Logo;
