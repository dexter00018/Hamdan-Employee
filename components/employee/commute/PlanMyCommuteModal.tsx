'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Spinner from '@/components/Spinner';
import { Clock3, CloudRain, Lightbulb, Pencil, TriangleAlert } from 'lucide-react';
import CommuteResultExperience from '@/components/employee/commute/CommuteResultExperience';
import {
  formatCommuteClock,
  formatCommuteUpdatedAt,
  formatRainAmount,
  getAddressPrimaryLabel,
  getAddressSecondaryLabel,
  getManilaDateTimeInputs,
  getManilaForecastMaxDate,
  mapCommuteUIState,
  shortCommutePlace,
  unwrapCommutePayload,
  type AddressSuggestion,
  type CommuteAdviceOption,
  type CommuteCheckResult,
  type CommuteErrorPayload,
  type CommuteUIState,
} from '@/lib/employee/commute';

type PlanMyCommuteModalProps = {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  initialDestination?: string | null;
};

export default function PlanMyCommuteModal({
  open,
  onClose,
  darkMode,
  initialDestination,
}: PlanMyCommuteModalProps) {
  // Manual Weather + Live Traffic route checker.
  const commuteModalRef = useRef<HTMLDivElement>(null);
  const commuteCloseButtonRef = useRef<HTMLButtonElement>(null);
  const [commuteOrigin, setCommuteOrigin] = useState('');
  const [commuteDestination, setCommuteDestination] = useState('');
  const [commuteDepartureDate, setCommuteDepartureDate] = useState(() => getManilaDateTimeInputs().date);
  const [commuteDepartureTime, setCommuteDepartureTime] = useState(() => getManilaDateTimeInputs().time);
  const [commuteLoading, setCommuteLoading] = useState(false);
  const [commuteUIState, setCommuteUIState] = useState<CommuteUIState>('idle');
  const [commuteFailedAnnouncementAssertive, setCommuteFailedAnnouncementAssertive] = useState(false);
  const [commuteHasAttempted, setCommuteHasAttempted] = useState(false);
  const [commuteError, setCommuteError] = useState<string | null>(null);
  const [commuteResult, setCommuteResult] = useState<CommuteCheckResult | null>(null);
  const [isCommuteFormCollapsed, setIsCommuteFormCollapsed] = useState(false);
  const [commuteLanguage, setCommuteLanguage] = useState<'en' | 'tl'>('en');
  const [commuteAdviceOptions, setCommuteAdviceOptions] = useState<CommuteAdviceOption[]>([]);
  const [originSuggestions, setOriginSuggestions] = useState<AddressSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedOriginAddress, setSelectedOriginAddress] = useState<AddressSuggestion | null>(null);
  const [selectedDestinationAddress, setSelectedDestinationAddress] = useState<AddressSuggestion | null>(null);
  const [originSearchLoading, setOriginSearchLoading] = useState(false);
  const [originLocationResolving, setOriginLocationResolving] = useState(false);
  const [destinationSearchLoading, setDestinationSearchLoading] = useState(false);
  const [originSearchError, setOriginSearchError] = useState<string | null>(null);
  const [destinationSearchError, setDestinationSearchError] = useState<string | null>(null);
  const [originActiveSuggestion, setOriginActiveSuggestion] = useState(-1);
  const [destinationActiveSuggestion, setDestinationActiveSuggestion] = useState(-1);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const originSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originSearchController = useRef<AbortController | null>(null);
  const destinationSearchController = useRef<AbortController | null>(null);
  const commuteRequestController = useRef<AbortController | null>(null);
  const previousCommuteUIState = useRef<CommuteUIState>('idle');

  useEffect(() => {
    const enteredFailedState =
      commuteUIState === 'failed' && previousCommuteUIState.current !== 'failed';
    previousCommuteUIState.current = commuteUIState;

    if (!enteredFailedState) return;
    setCommuteFailedAnnouncementAssertive(true);
    const timer = window.setTimeout(
      () => setCommuteFailedAnnouncementAssertive(false),
      1200
    );
    return () => window.clearTimeout(timer);
  }, [commuteUIState]);

  useEffect(() => {
    return () => {
      if (originSearchTimer.current) clearTimeout(originSearchTimer.current);
      if (destinationSearchTimer.current) clearTimeout(destinationSearchTimer.current);
      originSearchController.current?.abort();
      destinationSearchController.current?.abort();
    };
  }, []);

  const fetchAddressSuggestions = async (
    query: string,
    kind: 'origin' | 'destination'
  ) => {
    const trimmed = query.trim();

    if (trimmed.length < 3) {
      if (kind === 'origin') {
        setOriginSuggestions([]);
        setOriginSearchLoading(false);
        setOriginSearchError(null);
        setOriginActiveSuggestion(-1);
      } else {
        setDestinationSuggestions([]);
        setDestinationSearchLoading(false);
        setDestinationSearchError(null);
        setDestinationActiveSuggestion(-1);
      }
      return;
    }

    if (kind === 'origin') {
      setOriginSearchLoading(true);
      setOriginSearchError(null);
    } else {
      setDestinationSearchLoading(true);
      setDestinationSearchError(null);
    }

    const controllerRef =
      kind === 'origin'
        ? originSearchController
        : destinationSearchController;

    // Cancel the previous request for this field. This avoids stale results and
    // reduces unnecessary calls to the public Photon fair-use endpoint.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetch(
        `/api/address-search?q=${encodeURIComponent(trimmed)}`,
        {
          cache: 'no-store',
          signal: controller.signal,
        }
      );

      const raw = await response.text();
      let payload: any = {};

      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to search addresses.');
      }

      const rawResults = Array.isArray(payload?.results)
        ? payload.results
        : [];

      // Remove exact duplicate Photon results so React does not render
      // identical address cards with the same identity.
      const seen = new Set<string>();
      const results = rawResults.filter((place: AddressSuggestion) => {
        const key = [
          String(place?.id ?? ''),
          Number(place?.latitude ?? 0).toFixed(6),
          Number(place?.longitude ?? 0).toFixed(6),
          String(place?.address ?? '').trim().toLowerCase(),
        ].join('|');

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (kind === 'origin') {
        setOriginSuggestions(results);
        setOriginActiveSuggestion(results.length > 0 ? 0 : -1);
        setShowOriginSuggestions(true);
      } else {
        setDestinationSuggestions(results);
        setDestinationActiveSuggestion(results.length > 0 ? 0 : -1);
        setShowDestinationSuggestions(true);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;

      // Autocomplete is an enhancement. A temporary provider interruption
      // should not trigger Next.js' red development overlay or block manual
      // entry of a complete address.
      console.warn(
        'Address autocomplete temporarily unavailable:',
        error instanceof Error ? error.message : error
      );

      if (kind === 'origin') {
        setOriginSuggestions([]);
        setOriginSearchError('Address search is temporarily unavailable. Try again.');
        setShowOriginSuggestions(true);
      } else {
        setDestinationSuggestions([]);
        setDestinationSearchError('Address search is temporarily unavailable. Try again.');
        setShowDestinationSuggestions(true);
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;

        if (kind === 'origin') {
          setOriginSearchLoading(false);
        } else {
          setDestinationSearchLoading(false);
        }
      }
    }
  };

  const scheduleAddressSearch = (
    query: string,
    kind: 'origin' | 'destination'
  ) => {
    const timer =
      kind === 'origin'
        ? originSearchTimer
        : destinationSearchTimer;

    if (timer.current) {
      clearTimeout(timer.current);
    }

    if (query.trim().length < 3) {
      if (kind === 'origin') {
        setOriginSuggestions([]);
        setShowOriginSuggestions(false);
        setOriginSearchLoading(false);
        setOriginSearchError(null);
      } else {
        setDestinationSuggestions([]);
        setShowDestinationSuggestions(false);
        setDestinationSearchLoading(false);
        setDestinationSearchError(null);
      }
      return;
    }

    if (kind === 'origin') {
      setOriginSearchLoading(true);
      setOriginSearchError(null);
    } else {
      setDestinationSearchLoading(true);
      setDestinationSearchError(null);
    }

    timer.current = setTimeout(() => {
      fetchAddressSuggestions(query, kind);
    }, 350);
  };

  const selectAddressSuggestion = (
    suggestion: AddressSuggestion,
    kind: 'origin' | 'destination'
  ) => {
    // Keep the human-readable address for the input, but preserve the
    // selected Photon coordinates separately. The commute workflow will use
    // the coordinates directly instead of trying to geocode this text again.
    const exactAddress =
      suggestion.address ||
      [suggestion.name, suggestion.municipality].filter(Boolean).join(', ') ||
      suggestion.name;

    if (kind === 'origin') {
      setCommuteOrigin(exactAddress);
      setSelectedOriginAddress(suggestion);
      setOriginSuggestions([]);
      setOriginSearchError(null);
      setOriginActiveSuggestion(-1);
      setShowOriginSuggestions(false);
    } else {
      setCommuteDestination(exactAddress);
      setSelectedDestinationAddress(suggestion);
      setDestinationSuggestions([]);
      setDestinationSearchError(null);
      setDestinationActiveSuggestion(-1);
      setShowDestinationSuggestions(false);
    }
  };

  const clearCommuteAddress = (kind: 'origin' | 'destination') => {
    if (kind === 'origin') {
      setCommuteOrigin('');
      setSelectedOriginAddress(null);
      setOriginSuggestions([]);
      setOriginSearchError(null);
      setOriginActiveSuggestion(-1);
      setShowOriginSuggestions(false);
    } else {
      setCommuteDestination('');
      setSelectedDestinationAddress(null);
      setDestinationSuggestions([]);
      setDestinationSearchError(null);
      setDestinationActiveSuggestion(-1);
      setShowDestinationSuggestions(false);
    }
    setCommuteError(null);
    setCommuteResult(null);
    setCommuteUIState('idle');
    setCommuteHasAttempted(false);
  };

  // Swap From and To, including the exact selected suggestion (coordinates)
  // behind each field so the next check uses the swapped positions.
  const swapCommuteEndpoints = () => {
    const nextOriginText = commuteDestination;
    const nextOriginAddress = selectedDestinationAddress;
    const nextDestinationText = commuteOrigin;
    const nextDestinationAddress = selectedOriginAddress;

    setCommuteOrigin(nextOriginText);
    setSelectedOriginAddress(nextOriginAddress);
    setOriginSuggestions(destinationSuggestions);
    setShowOriginSuggestions(false);
    setOriginActiveSuggestion(-1);
    setOriginSearchError(null);

    setCommuteDestination(nextDestinationText);
    setSelectedDestinationAddress(nextDestinationAddress);
    setDestinationSuggestions(originSuggestions);
    setShowDestinationSuggestions(false);
    setDestinationActiveSuggestion(-1);
    setDestinationSearchError(null);

    setCommuteError(null);
    setCommuteUIState('idle');
  };

  // Modal-level accessibility: Escape closes the whole modal (not just an
  // address-suggestion dropdown), focus moves into the modal on open and
  // is trapped inside it while open, and focus returns to whatever
  // triggered the modal once it closes.
  const commuteTriggerElementRef = useRef<HTMLElement | null>(null);

  // onClose is often passed as a new inline function on every parent
  // render (e.g. onClose={() => setCommuteModalOpen(false)}). Keeping it
  // out of the effect below (via a ref) means the effect only re-runs
  // when `open` actually changes -- not on every parent re-render -- so
  // it doesn't repeatedly re-run its setup (including the initial-focus
  // step) while the user is typing.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    commuteTriggerElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = window.setTimeout(() => {
      const container = commuteModalRef.current;
      // Only steal focus to the close button if the user hasn't already
      // manually focused something inside the modal (e.g. clicked into
      // the origin field and started typing right as the modal opened).
      if (container && !container.contains(document.activeElement)) {
        commuteCloseButtonRef.current?.focus();
      }
    }, 0);

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const container = commuteModalRef.current;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      commuteTriggerElementRef.current?.focus();
    };
  }, [open]);

  const handleAddressSearchKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    kind: 'origin' | 'destination'
  ) => {
    const suggestions =
      kind === 'origin' ? originSuggestions : destinationSuggestions;
    const activeIndex =
      kind === 'origin' ? originActiveSuggestion : destinationActiveSuggestion;
    const setActiveIndex =
      kind === 'origin' ? setOriginActiveSuggestion : setDestinationActiveSuggestion;
    const setVisible =
      kind === 'origin' ? setShowOriginSuggestions : setShowDestinationSuggestions;

    const isVisible = kind === 'origin' ? showOriginSuggestions : showDestinationSuggestions;

    if (event.key === 'Escape') {
      if (isVisible) {
        event.stopPropagation();
        setVisible(false);
      }
      return;
    }
    if (suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setVisible(true);
      setActiveIndex((activeIndex + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setVisible(true);
      setActiveIndex((activeIndex - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectAddressSuggestion(suggestions[activeIndex], kind);
    }
  };


  useEffect(() => {
    if (!open) return;

    setCommuteError(null);
    setCommuteResult(null);
    setCommuteUIState('idle');
    setCommuteHasAttempted(false);
    setIsCommuteFormCollapsed(false);
    const currentManila = getManilaDateTimeInputs();
    setCommuteDepartureDate(currentManila.date);
    setCommuteDepartureTime(currentManila.time);
    setOriginSuggestions([]);
    setDestinationSuggestions([]);
    setShowOriginSuggestions(false);
    setShowDestinationSuggestions(false);
    setCommuteDestination((current) => current || initialDestination || '');
  }, [open, initialDestination]);

  const useCurrentLocationForCommute = () => {
    if (!navigator.geolocation) {
      setCommuteError('Location access is not supported by this browser.');
      return;
    }
    setCommuteError(null);
    setOriginLocationResolving(true);
    setSelectedOriginAddress(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);
        const coordinateFallback = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

        try {
          const response = await fetch(
            `/api/address-search?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`,
            { cache: 'no-store' }
          );
          const payload = await response.json().catch(() => ({}));
          const resolved = payload?.result || payload?.results?.[0];
          if (!response.ok || !resolved) throw new Error(payload?.error || 'Reverse geocoding failed.');

          const suggestion: AddressSuggestion = {
            ...resolved,
            latitude,
            longitude,
          };
          setCommuteOrigin(suggestion.address || suggestion.name);
          setSelectedOriginAddress(suggestion);
        } catch {
          setCommuteOrigin(coordinateFallback);
          setSelectedOriginAddress({
            id: `browser-geolocation-${latitude}-${longitude}`,
            name: 'Current location',
            address: coordinateFallback,
            municipality: '',
            latitude,
            longitude,
            type: 'geolocation',
          });
        } finally {
          setOriginLocationResolving(false);
          setOriginSuggestions([]);
          setOriginSearchError(null);
          setShowOriginSuggestions(false);
        }
      },
      () => {
        setOriginLocationResolving(false);
        setCommuteError('Unable to read your current location. You can type your starting place instead.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const checkCommuteRoute = async () => {
    if (!commuteOrigin.trim() || !commuteDestination.trim()) {
      setIsCommuteFormCollapsed(false);
      setCommuteError('Enter both From and To locations.');
      setCommuteUIState('input_error');
      setCommuteHasAttempted(true);
      return;
    }
    if (!selectedOriginAddress || !selectedDestinationAddress) {
      setIsCommuteFormCollapsed(false);
      setCommuteError('Select both locations from the address suggestions so exact coordinates can be verified.');
      setCommuteUIState('input_error');
      setCommuteHasAttempted(true);
      return;
    }
    if (commuteAdviceOptions.length === 0) {
      setIsCommuteFormCollapsed(false);
      setCommuteError('Select at least one advice option.');
      setCommuteUIState('input_error');
      setCommuteHasAttempted(true);
      return;
    }
    commuteRequestController.current?.abort();
    const controller = new AbortController();
    commuteRequestController.current = controller;
    setCommuteLoading(true);
    setCommuteUIState('updating');
    setCommuteHasAttempted(true);
    setCommuteError(null);
    try {
      const requestedDeparture = new Date(
        `${commuteDepartureDate}T${commuteDepartureTime}:00+08:00`
      );
      const response = await fetch('/api/commute-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          origin: commuteOrigin.trim(),
          destination: commuteDestination.trim(),
          language: commuteLanguage,
          requested_departure_at: Number.isFinite(requestedDeparture.getTime())
            ? requestedDeparture.toISOString()
            : null,
          advice_options: commuteAdviceOptions,
          origin_position: selectedOriginAddress
            ? {
                lat: selectedOriginAddress.latitude,
                lon: selectedOriginAddress.longitude,
              }
            : null,
          destination_position: selectedDestinationAddress
            ? {
                lat: selectedDestinationAddress.latitude,
                lon: selectedDestinationAddress.longitude,
              }
            : null,
        }),
      });
      const rawPayload = await response.json().catch(() => ({
        success: false,
        error: 'The commute service returned an invalid response.',
      }));
      const payload = unwrapCommutePayload(rawPayload) as CommuteCheckResult & CommuteErrorPayload;

      const mapped = mapCommuteUIState({
        responseOk: response.ok,
        responseStatus: response.status,
        payload,
      });

      if (mapped.state === 'input_error' || mapped.state === 'failed') {
        setIsCommuteFormCollapsed(false);
        setCommuteUIState(mapped.state);
        setCommuteError(mapped.message);
        return;
      }

      if (!payload?.success || !payload?.origin || !payload?.destination) {
        const incomplete = mapCommuteUIState({
          responseOk: true,
          payload: {
            ...payload,
            data_status: 'unavailable',
            error:
              payload?.error ||
              'The commute service returned an incomplete response.',
          },
        });
        setCommuteUIState(incomplete.state);
        setIsCommuteFormCollapsed(false);
        setCommuteError(incomplete.message);
        return;
      }

      setCommuteResult(payload);
      setIsCommuteFormCollapsed(true);
      setCommuteUIState(mapped.state);
      setCommuteError(null);
    } catch (err: any) {
      // A previous request aborted because a newer one replaced it should not
      // overwrite the newer request's state.
      if (
        err?.name === 'AbortError' &&
        commuteRequestController.current !== controller
      ) {
        return;
      }
      const mapped = mapCommuteUIState({ thrownError: err });
      setIsCommuteFormCollapsed(false);
      setCommuteUIState(mapped.state);
      setCommuteError(mapped.message);
    } finally {
      if (commuteRequestController.current === controller) {
        setCommuteLoading(false);
      }
    }
  };

  const toggleCommuteAdviceOption = (option: CommuteAdviceOption) => {
    setCommuteAdviceOptions((current) =>
      current.includes(option)
        ? current.filter((value) => value !== option)
        : [...current, option]
    );
    setCommuteError(null);
    setCommuteResult(null);
    setCommuteUIState('idle');
    setCommuteHasAttempted(false);
  };




  return (
    <>
      {/* Weather + Live Traffic Route Checker */}
      {open && (
        <div
          ref={commuteModalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Plan My Commute"
          className={`${darkMode ? 'dark' : ''} commute-theme-scope fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:p-4`}
          data-theme={darkMode ? 'dark' : 'light'}
        >
          <div className={`commute-canvas-surface w-[calc(100%-1rem)] max-w-[780px] max-h-[92dvh] overflow-y-auto rounded-[24px] p-4 shadow-2xl sm:p-6 ${darkMode ? 'bg-slate-950' : 'bg-[#fcfbf8]'}`}>
            {/* Header: compact brand row, no illustration clutter. */}
            <div className="commute-modal-header sticky top-0 z-50 -mx-4 -mt-4 mb-4 border-b border-emerald-100/70 px-4 pb-3 pt-4 backdrop-blur-xl sm:-mx-6 sm:-mt-6 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md shadow-emerald-600/25 flex items-center justify-center flex-shrink-0">
                    {/* Same navigation icon language the portal uses elsewhere. */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 11 18-5-7 18-2.4-8.6L3 11Z"/></svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[19px] sm:text-xl font-extrabold tracking-tight text-emerald-950 mb-0">
                      Plan My Commute
                    </h3>
                    <p className="text-[11px] sm:text-xs font-medium text-emerald-800/75 mt-0.5">
                      Get the best route, avoid traffic, and arrive on time.
                    </p>
                  </div>
                </div>
                <button
                  ref={commuteCloseButtonRef}
                  type="button"
                  onClick={() => onClose()}
                  className="w-9 h-9 rounded-full bg-white/70 ring-1 ring-emerald-200/60 text-slate-500 flex items-center justify-center hover:bg-white hover:text-slate-800 shadow-sm transition flex-shrink-0"
                  aria-label="Close commute assistant"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 items-start">
            <div className="min-w-0">
            {isCommuteFormCollapsed && (
              <div className="mb-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3  ">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-[8px] font-extrabold uppercase tracking-wider ${commuteUIState === 'partial' ? 'text-orange-700' : 'text-blue-700 '}`}>
                      {commuteUIState === 'partial' ? <span className="inline-flex items-center gap-0.5"><TriangleAlert size={10} strokeWidth={2.6} className="shrink-0" /> Partial data</span> : '● Live'}
                      {commuteResult ? ` · Updated ${formatCommuteUpdatedAt(commuteResult.freshness?.overall_updated_at || commuteResult.generated_at)}` : ''}
                    </p>
                    <p className="mt-1 truncate text-xs font-black text-slate-900 ">
                      {selectedOriginAddress ? getAddressPrimaryLabel(selectedOriginAddress) : shortCommutePlace(commuteOrigin, 'From')}
                      {' → '}
                      {selectedDestinationAddress ? getAddressPrimaryLabel(selectedDestinationAddress) : shortCommutePlace(commuteDestination, 'To')}
                    </p>
                    <p className="mt-1 text-[9px] font-semibold text-slate-500 ">
                      <Clock3 size={11} strokeWidth={2.4} className="inline-block align-[-1px] mr-0.5" /> Depart {commuteDepartureTime} · {commuteAdviceOptions.length} selected
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCommuteFormCollapsed(false)}
                    className="inline-flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-3 text-[9px] font-extrabold text-blue-700 shadow-sm transition hover:bg-blue-50   "
                  >
                    <Pencil size={11} strokeWidth={2.4} className="mr-0.5" /> Edit
                  </button>
                </div>
              </div>
            )}
            <section className={`rounded-[20px] p-4 sm:p-5 space-y-4 ${isCommuteFormCollapsed ? 'hidden' : 'block'} cm-card`}>
              <div className="flex items-center justify-between gap-3">
                <div className="pl-0.5">
                <p className="flex items-center gap-1.5 text-[15px] sm:text-[16px] cm-heading">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 11 18-5-7 18-2.4-8.6L3 11Z"/></svg>
                  Plan Your Route
                </p>
                <p className="text-[11px] sm:text-xs cm-sub mt-0.5 font-medium pl-[23px]">
                  Enter your starting point and destination to get the best route options.
                </p>
              </div>
                <span title="Address results are limited to the Philippines" className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/70 ring-1 ring-slate-200/80 px-3 py-1.5 text-[10px] font-semibold text-slate-500 flex-shrink-0">
                  🇵🇭 PH - Philippines only
                </span>
              </div>
            <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
              {/* Floating swap button: sits on the seam between From and To on
                  every breakpoint (stacked cards on mobile, two columns on lg). */}
              <button
                type="button"
                onClick={swapCommuteEndpoints}
                className="absolute left-1/2 top-1/2 z-30 h-10 w-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-md ring-2 ring-white dark:ring-[#0b1220] transition hover:bg-emerald-700 active:scale-95"
                title="Swap starting point and destination"
                aria-label="Swap starting point and destination"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
              </button>
              <div className="relative order-1 lg:order-none cm-field p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#059669" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5" fill="#fff"/></svg>
                  <span className="text-[11px] font-extrabold text-emerald-700">From</span>
                </div>
                <div className="relative">
                  {originLocationResolving ? (
                    <div className="min-h-14 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center gap-2.5" role="status" aria-live="polite">
                      <Spinner size="sm" />
                      <div><p className="text-[10px] font-extrabold text-slate-700">Locating…</p><p className="text-[9px] text-slate-400 mt-0.5">Finding a readable address for your GPS position.</p></div>
                    </div>
                  ) : selectedOriginAddress ? (
                    <div className="commute-location-card min-h-14 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2.5 flex items-start gap-2.5">
                      <span className="commute-location-icon mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="commute-location-title text-[11px] font-extrabold text-slate-950 leading-tight">
                          {getAddressPrimaryLabel(selectedOriginAddress)}
                        </p>
                        <p className="commute-location-address text-[9px] text-slate-600 mt-1 leading-snug line-clamp-2" title={getAddressSecondaryLabel(selectedOriginAddress)}>
                          {getAddressSecondaryLabel(selectedOriginAddress)}
                        </p>
                      </div>
                      <button type="button" onClick={() => clearCommuteAddress('origin')} className="commute-location-clear w-11 h-11 rounded-xl bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 transition" aria-label="Change starting point">×</button>
                    </div>
                  ) : (
                  <div className="relative" role="combobox" aria-expanded={showOriginSuggestions} aria-haspopup="listbox" aria-controls="commute-origin-listbox">
                    <input
                      value={commuteOrigin}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCommuteOrigin(value);
                        setSelectedOriginAddress(null);
                        setOriginSearchError(null);
                        setShowOriginSuggestions(true);
                        scheduleAddressSearch(value, 'origin');
                      }}
                      onKeyDown={(event) => handleAddressSearchKeyDown(event, 'origin')}
                      onFocus={() => {
                        if (originSuggestions.length > 0) {
                          setShowOriginSuggestions(true);
                        } else if (commuteOrigin.trim().length >= 3) {
                          scheduleAddressSearch(commuteOrigin, 'origin');
                        }
                      }}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setShowOriginSuggestions(false);
                        }, 180);
                      }}
                      autoComplete="off"
                      className="input-field w-full !h-14 !pl-10 !pr-16"
                      placeholder="Search landmark, street, or barangay..."
                      aria-autocomplete="list"
                      aria-controls="commute-origin-listbox"
                      aria-activedescendant={originActiveSuggestion >= 0 ? `commute-origin-option-${originActiveSuggestion}` : undefined}
                    />

                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none" aria-hidden="true">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3"/><path d="M12 20v3"/><path d="M1 12h3"/><path d="M20 12h3"/></svg>
                    </span>

                    {originSearchLoading && (
                      <div className="absolute right-14 top-1/2 -translate-y-1/2">
                        <Spinner size="sm" />
                      </div>
                    )}

                    {showOriginSuggestions && commuteOrigin.trim().length >= 3 && (
                      <div id="commute-origin-listbox" role="listbox" className="absolute left-0 right-0 top-full z-[100] mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        {originSearchLoading && originSuggestions.length === 0 && (
                          <div className="px-3.5 py-4 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500"><Spinner size="sm" /> Searching addresses…</div>
                        )}
                        {originSuggestions.map((place, index) => (
                          <button
                            key={`origin-${place.id}-${place.latitude}-${place.longitude}-${index}`}
                            id={`commute-origin-option-${index}`}
                            role="option"
                            aria-selected={index === originActiveSuggestion}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectAddressSuggestion(place, 'origin')}
                            className={`w-full px-3.5 py-3 text-left border-b border-slate-100 last:border-b-0 transition ${index === originActiveSuggestion ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-emerald-700">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {getAddressPrimaryLabel(place)}
                                </p>
                                {place.address && (
                                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                    {getAddressSecondaryLabel(place)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                        {!originSearchLoading && originSuggestions.length === 0 && (
                          <div className="px-3.5 py-4 text-center">
                            <p className="text-[10px] font-extrabold text-slate-700">{originSearchError ? 'Address search unavailable' : 'No matching Philippine address found'}</p>
                            <p className="text-[9px] text-slate-400 mt-1">{originSearchError || 'Try a landmark, street, barangay, or city name.'}</p>
                          </div>
                        )}
                        <div className="sticky bottom-0 border-t border-slate-100 bg-slate-50 px-3.5 py-2 text-[8px] font-semibold text-slate-400">Location data: OpenStreetMap</div>
                      </div>
                    )}
                  </div>
                  )}

                  {!selectedOriginAddress && !originLocationResolving && (
                    <button
                      type="button"
                      onClick={useCurrentLocationForCommute}
                      className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                      title="Use my current location"
                      aria-label="Use my current location"
                    >
                      ◎
                    </button>
                  )}
                </div>
              </div>

              <div className="relative order-3 lg:order-none cm-field p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#e11d48" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5" fill="#fff"/></svg>
                  <span className="text-[11px] font-extrabold text-rose-600">To</span>
                </div>
                <div className="relative">
                  {selectedDestinationAddress ? (
                    <div className={`commute-location-card min-h-14 rounded-xl border px-3 py-2.5 flex items-start gap-2.5 transition-shadow ${
                      commuteResult?.highlight_route_for_rain ||
                      commuteResult?.highlight_destination_for_rain ||
                      commuteResult?.weather?.rain_alert?.active ||
                      Number(commuteResult?.weather?.rain_probability ?? 0) >= 50
                        ? Number(commuteResult?.route_weather_summary?.highest_rain_probability ?? commuteResult?.weather?.rain_probability ?? 0) >= 70
                          ? 'border-sky-300 bg-sky-50/70 ring-2 ring-sky-200/70'
                          : 'border-amber-200 bg-amber-50 ring-2 ring-amber-200/70'
                        : 'border-blue-200 bg-blue-50/70'
                    }`}>
                      <span className="commute-location-icon mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="commute-location-title text-[11px] font-extrabold text-slate-950 leading-tight">
                          {getAddressPrimaryLabel(selectedDestinationAddress)}
                        </p>
                        <p className="commute-location-address text-[9px] text-slate-600 mt-1 leading-snug line-clamp-2" title={getAddressSecondaryLabel(selectedDestinationAddress)}>
                          {getAddressSecondaryLabel(selectedDestinationAddress)}
                        </p>
                      </div>
                      <button type="button" onClick={() => clearCommuteAddress('destination')} className="commute-location-clear w-11 h-11 rounded-xl bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 transition" aria-label="Change destination">×</button>
                    </div>
                  ) : (
                  <div className="relative" role="combobox" aria-expanded={showDestinationSuggestions} aria-haspopup="listbox" aria-controls="commute-destination-listbox">
                  <input
                    value={commuteDestination}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCommuteDestination(value);
                      setSelectedDestinationAddress(null);
                      setDestinationSearchError(null);
                      setShowDestinationSuggestions(true);
                      scheduleAddressSearch(value, 'destination');
                    }}
                    onKeyDown={(event) => handleAddressSearchKeyDown(event, 'destination')}
                    onFocus={() => {
                      if (destinationSuggestions.length > 0) {
                        setShowDestinationSuggestions(true);
                      } else if (commuteDestination.trim().length >= 3) {
                        scheduleAddressSearch(commuteDestination, 'destination');
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setShowDestinationSuggestions(false);
                      }, 180);
                    }}
                    autoComplete="off"
                    className={`input-field w-full !h-14 !pl-10 !pr-10 transition-shadow ${
                      commuteResult?.highlight_route_for_rain ||
                      commuteResult?.highlight_destination_for_rain ||
                      commuteResult?.weather?.rain_alert?.active ||
                      Number(commuteResult?.weather?.rain_probability ?? 0) >= 50
                        ? Number(commuteResult?.route_weather_summary?.highest_rain_probability ?? commuteResult?.weather?.rain_probability ?? 0) >= 85
                          ? '!border-sky-500 ring-2 ring-sky-200/70'
                          : Number(commuteResult?.route_weather_summary?.highest_rain_probability ?? commuteResult?.weather?.rain_probability ?? 0) >= 70
                            ? '!border-cyan-500 ring-2 ring-cyan-200/70'
                            : '!border-amber-400 ring-2 ring-amber-200/70'
                        : ''
                    }`}
                    placeholder="Search landmark, street, or barangay..."
                    aria-autocomplete="list"
                    aria-controls="commute-destination-listbox"
                    aria-activedescendant={destinationActiveSuggestion >= 0 ? `commute-destination-option-${destinationActiveSuggestion}` : undefined}
                  />

                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-500 pointer-events-none" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5" fill="#fff"/></svg>
                  </span>

                  {destinationSearchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Spinner size="sm" />
                    </div>
                  )}

                  {showDestinationSuggestions && commuteDestination.trim().length >= 3 && (
                    <div id="commute-destination-listbox" role="listbox" className="absolute left-0 right-0 top-full z-[100] mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                      {destinationSearchLoading && destinationSuggestions.length === 0 && (
                        <div className="px-3.5 py-4 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500"><Spinner size="sm" /> Searching addresses…</div>
                      )}
                      {destinationSuggestions.map((place, index) => (
                        <button
                          key={`destination-${place.id}-${place.latitude}-${place.longitude}-${index}`}
                          id={`commute-destination-option-${index}`}
                          role="option"
                          aria-selected={index === destinationActiveSuggestion}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectAddressSuggestion(place, 'destination')}
                          className={`w-full px-3.5 py-3 text-left border-b border-slate-100 last:border-b-0 transition ${index === destinationActiveSuggestion ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-rose-500">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-slate-900 truncate">
                                {getAddressPrimaryLabel(place)}
                              </p>
                              {place.address && (
                                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                  {getAddressSecondaryLabel(place)}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                      {!destinationSearchLoading && destinationSuggestions.length === 0 && (
                        <div className="px-3.5 py-4 text-center">
                          <p className="text-[10px] font-extrabold text-slate-700">{destinationSearchError ? 'Address search unavailable' : 'No matching Philippine address found'}</p>
                          <p className="text-[9px] text-slate-400 mt-1">{destinationSearchError || 'Try a landmark, street, barangay, or city name.'}</p>
                        </div>
                      )}
                      <div className="sticky bottom-0 border-t border-slate-100 bg-slate-50 px-3.5 py-2 text-[8px] font-semibold text-slate-400">Location data: OpenStreetMap</div>
                    </div>
                  )}
                  </div>
                  )}
                  {commuteResult && (() => {
                    const routeWettest = commuteResult.route_weather_summary?.wettest_checkpoint;
                    const rainChance = Number(
                      routeWettest?.rain_probability ?? commuteResult.weather?.rain_probability ?? 0
                    );
                    const active = commuteResult.highlight_route_for_rain ||
                      commuteResult.destination_weather_alert?.active ||
                      commuteResult.weather?.rain_alert?.active ||
                      rainChance >= 50;
                    if (!active) return null;
                    return (
                      <div className={`mt-2 rounded-xl border px-3 py-2 ${
                        rainChance >= 85
                          ? 'bg-sky-50 border-sky-300'
                          : rainChance >= 70
                            ? 'bg-cyan-50 border-cyan-300'
                            : 'bg-amber-50 border-amber-200'
                      }`}>
                        <p className="text-[10px] font-extrabold text-slate-900">
                          <CloudRain size={11} strokeWidth={2.4} className="inline-block align-[-1px] mr-0.5" /> {Math.round(rainChance)}% rain chance
                          {routeWettest?.location_name ? ` near ${shortCommutePlace(routeWettest.location_name, 'your route')}` : ' at the destination'}
                        </p>
                        <p className="text-[9px] text-slate-600 mt-0.5">
                          {routeWettest?.rain_intensity_label || commuteResult.weather?.rain_intensity_label || 'Rain possible'}
                          {routeWettest?.arrival_time ? ` · around ${formatCommuteClock(routeWettest.arrival_time)}` : ''}
                          {routeWettest?.precipitation_mm != null
                            ? ` · ${formatRainAmount(routeWettest.precipitation_mm)} possible`
                            : ''}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="cm-field flex min-w-0 flex-col p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/></svg>
                    <label className="text-[11px] font-bold text-slate-700 mb-0">Date</label>
                  </div>
                  <input
                    type="date"
                    value={commuteDepartureDate}
                    min={getManilaDateTimeInputs().date}
                    max={getManilaForecastMaxDate()}
                    onChange={(event) => setCommuteDepartureDate(event.target.value)}
                    className="input-field h-11 min-h-0 w-full min-w-0"
                  />
                </div>
                <div className="cm-field flex min-w-0 flex-col p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                    <label className="text-[11px] font-bold text-slate-700 mb-0">Departure Time</label>
                  </div>
                  <input
                    type="time"
                    step="1800"
                    value={commuteDepartureTime}
                    onChange={(event) => setCommuteDepartureTime(event.target.value)}
                    className="input-field h-11 min-h-0 w-full min-w-0"
                  />
                </div>
              </div>

              <div className="pl-0.5">
                <p className="flex items-center gap-1.5 text-[15px] sm:text-[16px] cm-heading">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v3.5"/><path d="M12 17.5V21"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.2"/></svg>
                  What do you want to know?
                </p>
                <p className="text-[11px] sm:text-xs cm-sub mt-0.5 font-medium pl-[23px]">
                  Select only what you need. This keeps the AI request focused and smaller.
                </p>
              </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    {
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.883"/><path d="M7 14a4 4 0 0 1 0-8 3 3 0 0 1 3 3 3 3 0 0 1 3 3"/><path d="M17.5 16a3.5 3.5 0 0 0-3.5-3.5 3.5 3.5 0 0 0-3.5 3.5 3.5 3.5 0 0 0 3.5 3.5H22"/></svg>
                      ),
                      value: 'route_weather' as CommuteAdviceOption,
                      label: 'Route weather',
                      detail: 'Along route',
                      tile: 'bg-sky-50 border border-sky-100 text-sky-600',
                    },
                    {
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>
                      ),
                      value: 'rain_risk' as CommuteAdviceOption,
                      label: 'Rain risk',
                      detail: 'Chance & amount',
                      tile: 'bg-cyan-50 border border-cyan-100 text-cyan-600',
                    },
                    {
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                      ),
                      value: 'traffic_delays' as CommuteAdviceOption,
                      label: 'Traffic delays',
                      detail: 'ETA & congestion',
                      tile: 'bg-amber-50 border border-amber-100 text-amber-600',
                    },
                    {
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                      ),
                      value: 'best_departure' as CommuteAdviceOption,
                      label: 'Best departure',
                      detail: 'When to leave',
                      tile: 'bg-emerald-50 border border-emerald-100 text-emerald-600',
                    },
                  ].map(({ icon, value, label, detail, tile }) => {
                    const selected = commuteAdviceOptions.includes(value);
                    return (
                      <label
                        key={label}
                        className={`relative flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] border px-2 py-3 text-center transition ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50/80 shadow-sm shadow-emerald-600/10'
                            : 'border-slate-200 bg-white/60 hover:border-emerald-400/60 hover:bg-emerald-50/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={commuteLoading}
                          onChange={() => toggleCommuteAdviceOption(value)}
                          className="sr-only"
                        />
                        {/* Selected confirmation: small check badge on the tile corner. */}
                        {selected && (
                          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[8px] font-black text-white" aria-hidden="true">
                            ✓
                          </span>
                        )}
                        <span className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${tile}`} aria-hidden="true">
                          {icon}
                        </span>
                        <span className={`block text-[11px] font-bold leading-tight ${selected ? 'text-emerald-900' : 'text-slate-700'}`}>
                          {label}
                        </span>
                        <span className="block text-[9px] font-medium text-slate-400 leading-tight">
                          {detail}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {commuteAdviceOptions.length === 0 && (
                  <div className="cm-hint-strip flex items-center gap-2.5 px-3.5 py-2.5 text-[10px] font-semibold text-amber-800">
                    <span aria-hidden="true" className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white">
                      !
                    </span>
                    Select at least one option to continue
                  </div>
                )}

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2v2.5"/><path d="M12 19.5V22"/><path d="m7.5 5.5 1.8 1.8"/><path d="m14.7 16.7 1.8 1.8"/><path d="M4 12h2.5"/><path d="M17.5 12H20"/><path d="m7.5 18.5 1.8-1.8"/><path d="m14.7 7.3 1.8-1.8"/><circle cx="12" cy="12" r="4.2"/></svg>
                </span>
                <div>
                  <p className="text-[13px] font-black text-slate-900 leading-none">
                    AI Advisory
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    Choose recommendation language
                  </p>
                </div>
              </div>

              <div className="inline-flex w-full sm:w-auto items-center rounded-full bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCommuteLanguage('en')}
                  aria-pressed={commuteLanguage === 'en'}
                  className={`flex-1 sm:flex-none min-h-10 px-4 py-2 rounded-full text-[11px] font-extrabold transition-all ${
                    commuteLanguage === 'en'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setCommuteLanguage('tl')}
                  aria-pressed={commuteLanguage === 'tl'}
                  className={`flex-1 sm:flex-none min-h-10 px-4 py-2 rounded-full text-[11px] font-extrabold transition-all ${
                    commuteLanguage === 'tl'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Filipino
                </button>
              </div>
            </div>

              {/* Tip: exact-coordinate verification, emphasized as the amber
                  variant when a typed place has not been picked from the
                  suggestion list yet. */}
              <div className={`flex items-start gap-2.5 px-3.5 py-2.5 ${
                (commuteOrigin.trim() && !selectedOriginAddress) ||
                (commuteDestination.trim() && !selectedDestinationAddress)
                  ? 'cm-hint-strip text-amber-800'
                  : 'cm-tip'
              }`}>
                <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm`} aria-hidden="true">
                  <Lightbulb size={12} strokeWidth={2.4} />
                </span>
                <p className="text-[11px] font-medium text-slate-600 pt-0.5">
                  Select each location from the address suggestions to verify its exact map coordinates.
                </p>
              </div>

              <button
                type="button"
                onClick={checkCommuteRoute}
                disabled={
                  commuteLoading ||
                  originLocationResolving ||
                  commuteAdviceOptions.length === 0 ||
                  !commuteOrigin.trim() ||
                  !commuteDestination.trim() ||
                  !selectedOriginAddress ||
                  !selectedDestinationAddress ||
                  !commuteDepartureDate ||
                  !commuteDepartureTime
                }
                className="commute-plan-button mt-1 flex min-h-[58px] w-full items-center gap-3.5 rounded-full bg-[#14181b] px-4 py-2.5 text-left text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15" aria-hidden="true">
                  {commuteLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h2.5a3.5 3.5 0 0 0 3.5-3.5v-5A3.5 3.5 0 0 1 17.5 6H18"/><path d="m15 3 3 3-3 3"/></svg>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold leading-tight">
                    {commuteLoading ? 'Checking live route…' : 'Check Route & Weather'}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-medium text-white/70">
                    Live traffic · Rain risk · Best departure
                  </span>
                </span>
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-slate-900" aria-hidden="true">→</span>
              </button>

            </section>
            </div>

            <div className="min-w-0">

            {commuteUIState === 'input_error' && commuteError && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 mb-3"
              >
                <div className="flex items-start gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0 font-black" aria-hidden="true">
                    !
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-amber-950">
                      Check your trip details
                    </p>
                    <p className="text-[10px] mt-1 text-amber-800">{commuteError}</p>
                  </div>
                </div>
              </div>
            )}

            {commuteUIState === 'failed' && commuteError && (
              <div
                role="alert"
                aria-live={commuteFailedAnnouncementAssertive ? 'assertive' : 'polite'}
                className="rounded-2xl border border-red-300 bg-red-50 p-3.5 mb-3"
              >
                <div className="flex items-start gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0 font-black" aria-hidden="true">×</span>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-red-950">ROUTE CHECK FAILED</p>
                    <p className="text-[10px] mt-1 text-red-800">{commuteError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={checkCommuteRoute}
                  disabled={commuteLoading}
                  className="mt-3 w-full min-h-10 rounded-xl bg-red-600 text-white text-[10px] font-extrabold hover:bg-red-700 transition disabled:opacity-50"
                >
                  {commuteLoading ? 'Retrying…' : 'Retry route check'}
                </button>
              </div>
            )}

            {commuteUIState === 'updating' && (
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className={`rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 ${commuteResult ? 'mb-3' : 'lg:min-h-[420px]'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
                    <Spinner size="sm" />
                    Updating route…
                  </div>
                  <span className="text-[9px] font-bold text-slate-400">Live forecast</span>
                </div>
                <div className="mt-4 space-y-3 animate-pulse" aria-hidden="true">
                  <div className="h-3 w-2/3 rounded-full bg-slate-200" />
                  <div className="h-2.5 w-1/3 rounded-full bg-slate-100" />
                  <div className="flex items-center gap-2 py-3">
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="flex-1 flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-slate-200 flex-shrink-0" />
                        {index < 2 && <div className="h-1 flex-1 rounded-full bg-slate-200" />}
                      </div>
                    ))}
                  </div>
                  <div className="h-14 rounded-xl bg-slate-100" />
                </div>
                <p className="text-[9px] text-slate-400 mt-3">
                  TomTom route · Open-Meteo forecast
                  {commuteResult ? ' · Previous successful result remains visible below.' : ''}
                </p>
              </div>
            )}

            {!commuteHasAttempted && !commuteLoading && (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-8 sm:p-10 lg:min-h-[420px] flex flex-col items-center justify-center text-center">
                <span className="flex w-12 h-12 items-center justify-center rounded-2xl cm-tile" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
                </span>
                <p className="mt-3 text-xs font-extrabold text-slate-700">Your trip advice will appear here</p>
                <p className="mt-1 text-[10px] text-slate-400">Choose your route, departure time, and advice options, then generate.</p>
              </div>
            )}

            {commuteResult && isCommuteFormCollapsed && (
              <CommuteResultExperience
                key={`${commuteResult.generated_at}-${commuteResult.destination?.name}`}
                result={commuteResult}
                uiState={commuteUIState}
                loading={commuteLoading}
                originLabel={selectedOriginAddress ? getAddressPrimaryLabel(selectedOriginAddress) : shortCommutePlace(commuteResult.origin?.name, 'Origin')}
                destinationLabel={selectedDestinationAddress ? getAddressPrimaryLabel(selectedDestinationAddress) : shortCommutePlace(commuteResult.destination?.name, 'Destination')}
                onEdit={() => setIsCommuteFormCollapsed(false)}
                onRefresh={checkCommuteRoute}
              />
            )}

            </div>
            </div>
          </div>
        </div>
      )}


    </>
  );
}
