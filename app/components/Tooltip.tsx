'use client';

import { Popover } from '@headlessui/react';

interface TooltipProps {
  title: string;
  description: string;
}

export default function Tooltip({ title, description }: TooltipProps) {
  return (
    <Popover className="relative inline-block">
      <Popover.Button className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-600 text-white text-xs font-bold hover:bg-gray-500 transition-colors duration-200 cursor-pointer ml-2">
        i
      </Popover.Button>

      <Popover.Panel className="absolute z-10 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-4">
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-[#FACC15] font-sans">{title}</h4>
          <p className="text-xs text-gray-300 font-sans leading-relaxed">{description}</p>
        </div>
        
        {/* Arrow pointing up */}
        <div className="absolute -top-2 left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
      </Popover.Panel>
    </Popover>
  );
} 