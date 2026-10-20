/**
 * Which keyboard answers are typed with (Р31), for every TypeField below: the on-screen
 * one on a touch device, the device's own if chosen in Settings, a physical one on a laptop.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { keyboardMode, type KeyboardMode } from '../core/keyboard';
import { coarsePointer, onPointerKindChange } from '../platform/keyboardEnv';

const Ctx = createContext<KeyboardMode>('physical');

export function KeyboardModeProvider({ systemKeyboard, children }: { systemKeyboard: boolean; children: ReactNode }) {
  const [coarse, setCoarse] = useState(coarsePointer);
  useEffect(() => onPointerKindChange(setCoarse), []);
  return <Ctx.Provider value={keyboardMode({ coarsePointer: coarse, systemKeyboard })}>{children}</Ctx.Provider>;
}

export function useKeyboardMode(): KeyboardMode {
  return useContext(Ctx);
}
