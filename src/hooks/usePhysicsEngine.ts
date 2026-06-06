import { useCallback, useRef, useState } from 'react';
import { PHYSICS_DT } from '../physics/integrators';
import { useSimLoop } from './useSimLoop';

interface UsePhysicsEngineOptions<TState, TParams> {
  params: TParams;
  initialState: TState;
  step: (state: TState, params: TParams, dt: number) => TState;
  running: boolean;
  onFrame?: (state: TState) => void;
}

/**
 * Ref-based fixed-step integrator: many physics substeps per frame, one React commit.
 */
export function usePhysicsEngine<TState, TParams>({
  params,
  initialState,
  step,
  running,
  onFrame,
}: UsePhysicsEngineOptions<TState, TParams>) {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const stateRef = useRef(initialState);
  const [state, setState] = useState(initialState);

  const syncState = useCallback((next: TState) => {
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  useSimLoop({
    running,
    dt: PHYSICS_DT,
    onStep: useCallback((dt) => {
      stateRef.current = step(stateRef.current, paramsRef.current, dt);
    }, [step]),
    onFrame: useCallback(() => {
      const next = stateRef.current;
      setState(next);
      onFrame?.(next);
    }, [onFrame]),
  });

  return { state, stateRef, syncState, paramsRef };
}
