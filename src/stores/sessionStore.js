import { create } from 'zustand';

export const useSessionStore = create((set, get) => ({
  activeSession: null,
  elapsed: 0,
  isMinimized: false,

  setSession: (data) => set({ activeSession: data, elapsed: data.elapsed }),
  clearSession: () => set({ activeSession: null, elapsed: 0 }),
  setMinimized: (minimized) => set({ isMinimized: minimized }),

  initListeners: () => {
    // Listen to ticks FROM main process
    const hasStrafe = typeof window !== 'undefined' && window.strafe !== undefined;
    if (!hasStrafe) return () => {};

    const unsubTick = window.strafe.onSessionTick((data) => {
      set({
        activeSession: data,
        elapsed: data.elapsed,
      });
    });

    const unsubEnded = window.strafe.onSessionEnded((data) => {
      set({ activeSession: null, elapsed: 0 });
    });

    const unsubMin = window.strafe.onMinimized(() => {
      set({ isMinimized: true });
    });

    const unsubRestore = window.strafe.onRestored(() => {
      set({ isMinimized: false });
    });

    // Ask main process if a session is already active
    if (window.strafe.getActiveSession) {
      window.strafe.getActiveSession().then(session => {
        if (session) {
          set({ activeSession: session, elapsed: session.elapsed });
        }
      });
    }

    return () => {
      unsubTick();
      unsubEnded();
      unsubMin();
      unsubRestore();
    };
  },
}));
