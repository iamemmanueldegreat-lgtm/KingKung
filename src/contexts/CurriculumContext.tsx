import React, { createContext, useContext, useState, useEffect } from 'react';

type CurriculumMode = 'school' | 'ocw';

interface CurriculumContextType {
  curriculumMode: CurriculumMode;
  setCurriculumMode: (mode: CurriculumMode) => void;
}

const CurriculumContext = createContext<CurriculumContextType | undefined>(undefined);

export function CurriculumProvider({ children }: { children: React.ReactNode }) {
  const [curriculumMode, setCurriculumMode] = useState<CurriculumMode>('school');

  useEffect(() => {
    try {
      localStorage.setItem('curriculumMode', 'school');
    } catch (e) {
      console.warn('Failed to save curriculumMode to localStorage', e);
    }
  }, []);

  return (
    <CurriculumContext.Provider value={{ curriculumMode, setCurriculumMode }}>
      {children}
    </CurriculumContext.Provider>
  );
}

export function useCurriculumStore() {
  const context = useContext(CurriculumContext);
  if (!context) {
    throw new Error('useCurriculumStore must be used within a CurriculumProvider');
  }
  return context;
}
