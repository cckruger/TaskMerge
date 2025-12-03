import React from 'react';
import { Account } from '../types';

interface AccountBadgeProps {
  account: Account;
  size?: 'sm' | 'md';
}

export const AccountBadge: React.FC<AccountBadgeProps> = ({ account, size = 'sm' }) => {
  // Fallback to gray if no color is set
  const color = account.color || 'gray';

  // Dynamic Tailwind classes to support any color passed in.
  // Since we are using the CDN version of Tailwind, this works dynamically.
  // If using a build step, these would need to be safelisted.
  const style = `bg-${color}-100 text-${color}-700 border-${color}-200 dark:bg-${color}-900/30 dark:text-${color}-300 dark:border-${color}-800/50`;
  
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${style} ${sizeClasses}`}>
      {account.name}
    </span>
  );
};