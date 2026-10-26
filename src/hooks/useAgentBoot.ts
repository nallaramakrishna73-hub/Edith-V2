import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api.ts';
import { OSOverview } from '../types/api.ts';
import { getIndianTimeDetails, IndianTimeDetails } from '../utils/time.ts';

export interface AgentBootState {
  isBooting: boolean;
  isBooted: boolean;
  bootStep: string;
  bootProgress: number;
  overview: OSOverview | null;
  agentGreeting: string;
  spokenGreeting: string;
  istTime: IndianTimeDetails;
  hasGreetedVocal: boolean;
}

export function useAgentBoot(options?: {
  autoSpeak?: boolean;
  onSpeakGreeting?: (text: string) => void;
}) {
  const initialTime = getIndianTimeDetails();

  const [state, setState] = useState<AgentBootState>({
    isBooting: true,
    isBooted: false,
    bootStep: 'POWERING NEURAL CORES...',
    bootProgress: 10,
    overview: null,
    agentGreeting: '',
    spokenGreeting: '',
    istTime: initialTime,
    hasGreetedVocal: false,
  });

  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function boot() {
      const timeDetails = getIndianTimeDetails();

      try {
        setState((s) => ({ ...s, bootStep: 'LOADING HARDWARE TELEMETRY...', bootProgress: 35, istTime: timeDetails }));
        const overview = await api.getOSOverview();

        setState((s) => ({ ...s, bootStep: 'CALIBRATING INDIAN STANDARD TIME & NEURAL AGENT...', bootProgress: 75, overview }));
        await new Promise((r) => setTimeout(r, 350));

        const currentTime = getIndianTimeDetails();
        const displayGreeting = currentTime.greetingSentence;
        const spoken = currentTime.spokenGreeting;

        setState((s) => ({
          ...s,
          isBooting: false,
          isBooted: true,
          bootStep: 'SYSTEM OPERATIONAL (IST)',
          bootProgress: 100,
          agentGreeting: displayGreeting,
          spokenGreeting: spoken,
          istTime: currentTime,
        }));

        // Trigger immediate vocal response with natural speech
        if (options?.autoSpeak && options.onSpeakGreeting) {
          options.onSpeakGreeting(spoken);
          setState((s) => ({ ...s, hasGreetedVocal: true }));
        }
      } catch (err) {
        console.warn('Fast boot overview fallback:', err);
        const currentTime = getIndianTimeDetails();
        const fallbackDisplay = currentTime.greetingSentence;
        const fallbackSpoken = currentTime.spokenGreeting;

        setState({
          isBooting: false,
          isBooted: true,
          bootStep: 'STANDALONE READY (IST)',
          bootProgress: 100,
          overview: null,
          agentGreeting: fallbackDisplay,
          spokenGreeting: fallbackSpoken,
          istTime: currentTime,
          hasGreetedVocal: false,
        });

        if (options?.autoSpeak && options.onSpeakGreeting) {
          options.onSpeakGreeting(fallbackSpoken);
        }
      }
    }

    boot();
  }, [options]);

  return state;
}
