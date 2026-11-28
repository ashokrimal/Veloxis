import React, {useEffect} from 'react';
import {AnimatePresence, motion, type PanInfo} from 'motion/react';

interface BottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  ariaDescribedBy?: string;
  role?: 'dialog' | 'alertdialog';
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  isOpen,
  onClose,
  ariaLabelledBy,
  ariaDescribedBy,
  role = 'dialog',
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.y > 95 || info.velocity.y > 500) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="bottom-sheet-backdrop"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.2, ease: 'easeOut'}}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 dark:bg-[#02040a]/75 sm:p-4 backdrop-blur-xs"
          role={role}
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
        >
          <motion.div
            key="bottom-sheet-panel"
            initial={{y: '100%', opacity: 0.9}}
            animate={{y: 0, opacity: 1}}
            exit={{y: '100%', opacity: 0.9}}
            transition={{type: 'spring', stiffness: 360, damping: 34, mass: 0.85}}
            drag="y"
            dragConstraints={{top: 0, bottom: 0}}
            dragElastic={{top: 0.04, bottom: 0.35}}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full ${maxWidthClass} max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-b-0 sm:border-b bg-white dark:bg-[#0D1322] vx-card-elevated pb-[env(safe-area-inset-bottom)]`}
          >
            {/* Top 1px White Highlight Line */}
            <div
              aria-hidden="true"
              className="pointer-events-none sticky top-0 z-20 h-px w-full bg-gradient-to-r from-transparent via-white/90 dark:via-white/25 to-transparent"
            />

            {/* Drag Handle */}
            <div className="sticky top-px z-10 flex justify-center bg-white/95 dark:bg-[#0D1322]/95 pt-3 pb-1.5 backdrop-blur-xs cursor-grab active:cursor-grabbing">
              <span
                aria-hidden="true"
                className="h-1 w-10 rounded-full bg-[#D6D0C4] dark:bg-[#2A3958]"
              />
            </div>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
