import React from 'react';
import { motion } from 'framer-motion';
import owlImage from '../assets/mascots/owl.png';
import squirrelImage from '../assets/mascots/squirrel.png';

export type MascotType = 'owl' | 'squirrel';
export type MascotPosition = 'left' | 'right' | 'center';
export type MascotSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface MascotGuideProps {
    /** Which mascot to display */
    type: MascotType;
    /** Message to show in speech bubble. If empty, no bubble shown */
    message?: string;
    /** Position of the mascot */
    position?: MascotPosition;
    /** Size of the mascot image */
    size?: MascotSize;
    /** Enable floating animation */
    animated?: boolean;
    /** Show speech bubble above or beside the mascot */
    bubblePosition?: 'top' | 'side';
    /** Additional CSS classes */
    className?: string;
    /** Whether to flip the mascot horizontally */
    flip?: boolean;
}

const sizeMap: Record<MascotSize, string> = {
    xs: 'w-16 h-16',
    sm: 'w-24 h-24',
    md: 'w-32 h-32',
    lg: 'w-40 h-40',
    xl: 'w-56 h-56',
};

const imageSizeMap: Record<MascotSize, string> = {
    xs: 'max-w-[64px]',
    sm: 'max-w-[96px]',
    md: 'max-w-[128px]',
    lg: 'max-w-[160px]',
    xl: 'max-w-[224px]',
};

export const MascotGuide: React.FC<MascotGuideProps> = ({
    type,
    message,
    position = 'center',
    size = 'md',
    animated = true,
    bubblePosition = 'top',
    className = '',
    flip = false,
}) => {
    const mascotSrc = type === 'owl' ? owlImage : squirrelImage;
    const mascotAlt = type === 'owl' ? '부엉이 가이드' : '다람쥐 가이드';

    const positionClasses = {
        left: 'justify-start',
        center: 'justify-center',
        right: 'justify-end',
    };

    return (
        <div className={`flex ${positionClasses[position]} ${className}`}>
            <div className={`flex ${bubblePosition === 'side' ? 'flex-row items-end gap-4' : 'flex-col items-center'}`}>
                {/* Speech Bubble */}
                {message && bubblePosition === 'top' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="relative bg-white border-2 border-amber-200 rounded-2xl px-5 py-3 mb-3 shadow-lg max-w-xs"
                    >
                        <p className="text-gray-700 font-medium text-sm leading-relaxed">
                            {message}
                        </p>
                        {/* Bubble tail */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-amber-200 transform rotate-45" />
                    </motion.div>
                )}

                {/* Side bubble layout */}
                {message && bubblePosition === 'side' && position === 'left' && (
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="relative bg-white border-2 border-amber-200 rounded-2xl px-5 py-3 shadow-lg max-w-xs order-2"
                    >
                        <p className="text-gray-700 font-medium text-sm leading-relaxed">
                            {message}
                        </p>
                        {/* Bubble tail pointing left */}
                        <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 bg-white border-l-2 border-b-2 border-amber-200 transform rotate-45" />
                    </motion.div>
                )}

                {/* Mascot Image */}
                <motion.div
                    className={`relative ${sizeMap[size]}`}
                    animate={animated ? { y: [0, -8, 0] } : undefined}
                    transition={animated ? {
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                    } : undefined}
                >
                    <img
                        src={mascotSrc}
                        alt={mascotAlt}
                        className={`${imageSizeMap[size]} h-auto object-contain drop-shadow-lg ${flip ? 'scale-x-[-1]' : ''}`}
                        style={{
                            filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.15))'
                        }}
                    />
                </motion.div>

                {/* Side bubble for right position */}
                {message && bubblePosition === 'side' && position === 'right' && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="relative bg-white border-2 border-amber-200 rounded-2xl px-5 py-3 shadow-lg max-w-xs order-0"
                    >
                        <p className="text-gray-700 font-medium text-sm leading-relaxed">
                            {message}
                        </p>
                        {/* Bubble tail pointing right */}
                        <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 bg-white border-r-2 border-t-2 border-amber-200 transform rotate-45" />
                    </motion.div>
                )}
            </div>
        </div>
    );
};

// Preset components for common use cases
export const OwlGuide: React.FC<Omit<MascotGuideProps, 'type'>> = (props) => (
    <MascotGuide type="owl" {...props} />
);

export const SquirrelGuide: React.FC<Omit<MascotGuideProps, 'type'>> = (props) => (
    <MascotGuide type="squirrel" {...props} />
);

// Loading state mascots
export const OwlWriting: React.FC<{ message?: string; size?: MascotSize }> = ({
    message = "열심히 이야기를 쓰고 있어요...",
    size = 'lg'
}) => (
    <div className="flex flex-col items-center">
        <motion.div
            animate={{ rotate: [-2, 2, -2] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        >
            <MascotGuide
                type="owl"
                message={message}
                size={size}
                animated={false}
            />
        </motion.div>
    </div>
);

export const SquirrelReading: React.FC<{ message?: string; size?: MascotSize }> = ({
    message = "책을 준비하고 있어요...",
    size = 'lg'
}) => (
    <div className="flex flex-col items-center">
        <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
            <MascotGuide
                type="squirrel"
                message={message}
                size={size}
                animated={false}
            />
        </motion.div>
    </div>
);

export default MascotGuide;
