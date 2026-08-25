'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Spinner from '@/components/Spinner';
import {
  buildPartialCommuteMessage,
  formatCommuteClock,
  formatCommuteDistance,
  formatCommuteMinutes,
  formatCommuteUpdatedAt,
  formatRainAmount,
  formatWeatherBucketTime,
  getAddressPrimaryLabel,
  getAddressSecondaryLabel,
  getAdviceAvailability,
  getCommuteWeatherHighlight,
  getManilaDateTimeInputs,
  getManilaForecastMaxDate,
  getRouteCheckpointVisual,
  getTrafficLevelStyle,
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

type CommuteSurfaceProps = {
  className?: string;
};

type MetricCardProps = CommuteSurfaceProps & {
  icon: string;
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  valueClassName?: string;
};

function MetricCard({ icon, label, value, helper, valueClassName = '', className = '' }: MetricCardProps) {
  return (
    <div className={`min-h-[88px] border-b border-slate-200 p-3 sm:min-h-0 sm:border-b-0 sm:border-r sm:px-5 sm:py-2 sm:last:border-r-0 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center text-xl text-blue-600" aria-hidden="true">
          {icon}
        </span>
        <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      </div>
      <p className={`mt-1.5 text-xl font-black leading-none text-slate-950 sm:text-2xl ${valueClassName}`}>{value}</p>
      {helper && <p className="mt-1 text-[8px] leading-relaxed text-slate-400">{helper}</p>}
    </div>
  );
}

type CheckpointItemProps = CommuteSurfaceProps & {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
};

function CheckpointItem({ selected, label, onClick, children, className = '' }: CheckpointItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={selected}
      aria-label={label}
      className={`group relative flex-1 min-w-0 rounded-2xl border p-3 text-left lg:text-center transition-all duration-200 hover:bg-blue-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selected ? 'border-blue-500 bg-blue-50/50 shadow-sm' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

type AdvisoryBannerProps = CommuteSurfaceProps & {
  icon: string;
  title: string;
  children: ReactNode;
};

function AdvisoryBanner({ icon, title, children, className = '' }: AdvisoryBannerProps) {
  return (
    <div className={`commute-advisory-surface rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-3.5 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm" aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <p className="text-[8px] font-extrabold uppercase tracking-wider text-blue-700">{title}</p>
          <div className="mt-1 text-[10px] font-semibold leading-relaxed text-slate-700">{children}</div>
        </div>
      </div>
    </div>
  );
}

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
  const [showCommuteIncidents, setShowCommuteIncidents] = useState(false);
  const [commuteError, setCommuteError] = useState<string | null>(null);
  const [commuteResult, setCommuteResult] = useState<CommuteCheckResult | null>(null);
  const [selectedCommuteCheckpointIndex, setSelectedCommuteCheckpointIndex] = useState<number | null>(null);
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

  const swapCommuteAddresses = () => {
    setCommuteOrigin(commuteDestination);
    setCommuteDestination(commuteOrigin);
    setSelectedOriginAddress(selectedDestinationAddress);
    setSelectedDestinationAddress(selectedOriginAddress);
    setOriginSuggestions([]);
    setDestinationSuggestions([]);
    setOriginSearchError(null);
    setDestinationSearchError(null);
    setOriginActiveSuggestion(-1);
    setDestinationActiveSuggestion(-1);
    setShowOriginSuggestions(false);
    setShowDestinationSuggestions(false);
    setCommuteError(null);
    setCommuteResult(null);
    setCommuteUIState('idle');
    setCommuteHasAttempted(false);
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
    setCommuteDestination((current) => current || initialDestination || 'Makati City');
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
    setShowCommuteIncidents(false);
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
      setSelectedCommuteCheckpointIndex(
        payload.route_weather_summary?.wettest_checkpoint?.index ??
          payload.route_weather_checkpoints?.[0]?.index ??
          null
      );
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
    setSelectedCommuteCheckpointIndex(null);
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
          <div className={`commute-canvas-surface w-full max-w-[1500px] max-h-[100dvh] overflow-y-auto p-4 shadow-2xl sm:max-h-[94vh] sm:rounded-[28px] sm:p-6 ${darkMode ? 'bg-slate-950' : 'bg-[#fcfbf8]'}`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 text-xl  ">
                  🌦️
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="mb-0">Plan My Commute</h3>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    Weather and traffic advice across your selected route.
                  </p>
                </div>
              </div>
              <button
                ref={commuteCloseButtonRef}
                type="button"
                onClick={() => onClose()}
                className="w-11 h-11 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition flex-shrink-0"
                aria-label="Close commute assistant"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 items-start">
            <div className="min-w-0">
            {isCommuteFormCollapsed && (
              <div className="mb-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3  ">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-[8px] font-extrabold uppercase tracking-wider ${commuteUIState === 'partial' ? 'text-orange-700' : 'text-blue-700 '}`}>
                      {commuteUIState === 'partial' ? '⚠ Partial data' : '● Live'}
                      {commuteResult ? ` · Updated ${formatCommuteUpdatedAt(commuteResult.freshness?.overall_updated_at || commuteResult.generated_at)}` : ''}
                    </p>
                    <p className="mt-1 truncate text-xs font-black text-slate-900 ">
                      {selectedOriginAddress ? getAddressPrimaryLabel(selectedOriginAddress) : shortCommutePlace(commuteOrigin, 'From')}
                      {' → '}
                      {selectedDestinationAddress ? getAddressPrimaryLabel(selectedDestinationAddress) : shortCommutePlace(commuteDestination, 'To')}
                    </p>
                    <p className="mt-1 text-[9px] font-semibold text-slate-500 ">
                      🕒 Depart {commuteDepartureTime} · {commuteAdviceOptions.length} selected
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCommuteFormCollapsed(false)}
                    className="inline-flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-3 text-[9px] font-extrabold text-blue-700 shadow-sm transition hover:bg-blue-50   "
                  >
                    ✏️ Edit
                  </button>
                </div>
              </div>
            )}
            <section className={`rounded-3xl bg-white border border-slate-200 p-3.5 sm:p-4 lg:p-5 shadow-sm   ${isCommuteFormCollapsed ? 'hidden' : 'block'}`}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.16em] font-extrabold text-slate-500">
                    Plan your route
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Select an exact address for better route accuracy.
                  </p>
                </div>
                <span title="Address results are limited to the Philippines" className="hidden sm:inline-flex rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[8px] font-extrabold text-slate-500">
                  PH · Philippines only
                </span>
              </div>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] lg:items-end lg:gap-3">
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label-branded mb-0">From</label>
                  <span className="text-[9px] font-bold text-slate-400">Starting point</span>
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
                  <div className="relative" role="combobox" aria-expanded={showOriginSuggestions} aria-haspopup="listbox" aria-owns="commute-origin-listbox">
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

                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-xs pointer-events-none" aria-hidden="true">⌖</span>

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
                              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs">
                                📍
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
                      className="absolute bottom-1.5 right-1.5 z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50   "
                      title="Use my current location"
                      aria-label="Use my current location"
                    >
                      ◎
                    </button>
                  )}
                </div>
              </div>

              <div className="relative flex h-12 items-center justify-center lg:h-14">
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-blue-200 lg:hidden " aria-hidden="true" />
                <button
                  type="button"
                  onClick={swapCommuteAddresses}
                  disabled={!commuteOrigin && !commuteDestination}
                  className="relative z-10 flex h-11 min-w-11 items-center justify-center rounded-full border border-blue-200 bg-white px-3 text-base font-extrabold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:opacity-40   "
                  title="Swap starting point and destination"
                  aria-label="Swap starting point and destination"
                >
                  ⇄
                </button>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label-branded mb-0">To</label>
                  <span className="text-[9px] font-bold text-slate-400">Destination</span>
                </div>
                <div className="relative">
                  {selectedDestinationAddress ? (
                    <div className={`commute-location-card min-h-14 rounded-xl border px-3 py-2.5 flex items-start gap-2.5 transition-shadow ${
                      commuteResult?.highlight_route_for_rain ||
                      commuteResult?.highlight_destination_for_rain ||
                      commuteResult?.weather?.rain_alert?.active ||
                      Number(commuteResult?.weather?.rain_probability ?? 0) >= 50
                        ? Number(commuteResult?.route_weather_summary?.highest_rain_probability ?? commuteResult?.weather?.rain_probability ?? 0) >= 70
                          ? 'border-orange-300 bg-orange-50/70 ring-2 ring-orange-200/70'
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
                  <div className="relative" role="combobox" aria-expanded={showDestinationSuggestions} aria-haspopup="listbox" aria-owns="commute-destination-listbox">
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
                          ? '!border-red-400 ring-2 ring-red-200/70'
                          : Number(commuteResult?.route_weather_summary?.highest_rain_probability ?? commuteResult?.weather?.rain_probability ?? 0) >= 70
                            ? '!border-orange-400 ring-2 ring-orange-200/70'
                            : '!border-amber-400 ring-2 ring-amber-200/70'
                        : ''
                    }`}
                    placeholder="Search landmark, street, or barangay..."
                    aria-autocomplete="list"
                    aria-controls="commute-destination-listbox"
                    aria-activedescendant={destinationActiveSuggestion >= 0 ? `commute-destination-option-${destinationActiveSuggestion}` : undefined}
                  />

                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-xs pointer-events-none" aria-hidden="true">●</span>

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
                            <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs">
                              📍
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
                          ? 'bg-red-50 border-red-200'
                          : rainChance >= 70
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-amber-50 border-amber-200'
                      }`}>
                        <p className="text-[10px] font-extrabold text-slate-900">
                          ☔ {Math.round(rainChance)}% rain chance
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

              <div className="grid grid-cols-2 gap-2.5 mt-3">
                <div>
                  <label className="label-branded mb-1.5 block">Date</label>
                  <input
                    type="date"
                    value={commuteDepartureDate}
                    min={getManilaDateTimeInputs().date}
                    max={getManilaForecastMaxDate()}
                    onChange={(event) => setCommuteDepartureDate(event.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="label-branded mb-1.5 block">Departure</label>
                  <input
                    type="time"
                    step="1800"
                    value={commuteDepartureTime}
                    onChange={(event) => setCommuteDepartureTime(event.target.value)}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/80">
                <p className="text-[9px] uppercase tracking-[0.16em] font-extrabold text-slate-500">
                  What do you want to know?
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  Select only what you need. This keeps the AI request focused and smaller.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 sm:grid-cols-4">
                  {[
                    {
                      icon: '☁️',
                      value: 'route_weather' as CommuteAdviceOption,
                      label: 'Route weather',
                      detail: 'Weather along route',
                    },
                    {
                      icon: '🌧️',
                      value: 'rain_risk' as CommuteAdviceOption,
                      label: 'Rain risk',
                      detail: 'Chance and rainfall',
                    },
                    {
                      icon: '🚗',
                      value: 'traffic_delays' as CommuteAdviceOption,
                      label: 'Traffic delays',
                      detail: 'ETA and congestion',
                    },
                    {
                      icon: '◷',
                      value: 'best_departure' as CommuteAdviceOption,
                      label: 'Best departure',
                      detail: 'When to leave',
                    },
                  ].map(({ icon, value, label, detail }) => {
                    const selected = commuteAdviceOptions.includes(value);
                    return (
                      <label
                        key={label}
                        className={`min-h-11 rounded-xl border px-3 py-2 flex items-center gap-2 cursor-pointer transition ${
                          selected
                            ? 'bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-200  '
                            : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50/40  '
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={commuteLoading}
                          onChange={() => toggleCommuteAdviceOption(value)}
                          className="sr-only"
                        />
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`} aria-hidden="true">
                          {selected ? '✓' : icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[9px] font-extrabold leading-tight">{label}</span>
                          <span className="block text-[8px] font-semibold mt-0.5 text-slate-400 leading-tight sm:hidden">
                            {detail}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className={`mt-2.5 flex items-center gap-2 text-[9px] font-bold ${commuteAdviceOptions.length > 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                  <span aria-hidden="true">{commuteAdviceOptions.length > 0 ? '✓' : '!'}</span>
                  <span>
                    {commuteAdviceOptions.length > 0
                      ? `${commuteAdviceOptions.length} option${commuteAdviceOptions.length === 1 ? '' : 's'} selected`
                      : 'Select at least one option'}
                  </span>
                </div>
              </div>

            <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-xs">
                    ✨
                  </span>
                  <div>
                    <p className="text-[10px] font-extrabold text-slate-700 leading-none">
                      AI advisory
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1">
                      Choose recommendation language
                    </p>
                  </div>
                </div>
              </div>

              <div className="inline-flex w-full sm:w-auto items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCommuteLanguage('en')}
                  aria-pressed={commuteLanguage === 'en'}
                  className={`flex-1 sm:flex-none min-h-11 px-4 py-2 rounded-lg text-[10px] font-extrabold transition-all ${
                    commuteLanguage === 'en'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setCommuteLanguage('tl')}
                  aria-pressed={commuteLanguage === 'tl'}
                  className={`flex-1 sm:flex-none min-h-11 px-4 py-2 rounded-lg text-[10px] font-extrabold transition-all ${
                    commuteLanguage === 'tl'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Filipino
                </button>
              </div>
            </div>

              {((commuteOrigin.trim() && !selectedOriginAddress) ||
                (commuteDestination.trim() && !selectedDestinationAddress)) && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
                  <span className="text-amber-700 font-black" aria-hidden="true">!</span>
                  <p className="text-[9px] font-semibold text-amber-800">
                    Select each location from the address suggestions to verify its exact map coordinates.
                  </p>
                </div>
              )}

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
                className="commute-plan-button sticky bottom-2 z-20 mt-3 flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 px-3.5 text-left text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 sm:static"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25" aria-hidden="true">
                  {commuteLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h2.5a3.5 3.5 0 0 0 3.5-3.5v-5A3.5 3.5 0 0 1 17.5 6H18"/><path d="m15 3 3 3-3 3"/></svg>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-black leading-tight">
                    {commuteLoading ? 'Checking live route…' : 'Check Route & Weather'}
                  </span>
                  <span className="mt-1 block text-[8px] font-semibold text-white/75">
                    Live traffic · rain risk · best departure
                  </span>
                </span>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-base font-black text-blue-700" aria-hidden="true">→</span>
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
                <span className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-xl" aria-hidden="true">📍</span>
                <p className="mt-3 text-xs font-extrabold text-slate-700">Your trip advice will appear here</p>
                <p className="mt-1 text-[10px] text-slate-400">Choose your route, departure time, and advice options, then generate.</p>
              </div>
            )}

            {commuteResult && (
              <div
                aria-busy={commuteLoading}
                className="space-y-4 rounded-3xl border border-slate-200 bg-white p-3.5 sm:p-5  "
              >
                <div
                  aria-live={commuteFailedAnnouncementAssertive ? 'assertive' : 'polite'}
                  className={`hidden sm:flex sm:flex-row sm:items-center sm:justify-between gap-2 border-b px-1 pb-4 ${
                    commuteUIState === 'partial'
                      ? 'border-orange-200'
                      : commuteUIState === 'failed'
                        ? 'border-slate-200'
                        : commuteUIState === 'updating'
                          ? 'border-blue-200'
                          : 'border-slate-200 '
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                          commuteUIState === 'partial'
                            ? 'bg-orange-100 text-orange-700'
                            : commuteUIState === 'failed'
                              ? 'bg-slate-200 text-slate-600'
                              : commuteUIState === 'updating'
                                ? 'bg-blue-100 text-blue-700 animate-pulse'
                                : 'bg-blue-100 text-blue-700  '
                        }`}
                        aria-hidden="true"
                      >
                        {commuteUIState === 'partial'
                          ? '!'
                          : commuteUIState === 'failed'
                            ? '↺'
                            : commuteUIState === 'updating'
                              ? '…'
                              : '●'}
                      </span>
                      <p className={`text-[10px] font-extrabold uppercase tracking-wide ${
                        commuteUIState === 'partial'
                          ? 'text-orange-900'
                          : commuteUIState === 'failed'
                            ? 'text-slate-700'
                            : commuteUIState === 'updating'
                              ? 'text-blue-900'
                              : 'text-blue-700 '
                      }`}>
                        {commuteUIState === 'updating'
                          ? 'UPDATING · Previous result shown'
                          : commuteUIState === 'partial'
                            ? `PARTIAL DATA · Updated ${formatCommuteUpdatedAt(commuteResult.freshness?.overall_updated_at || commuteResult.generated_at)}`
                            : commuteUIState === 'failed'
                              ? `LAST SUCCESSFUL RESULT · Updated ${formatCommuteUpdatedAt(commuteResult.freshness?.overall_updated_at || commuteResult.generated_at)}`
                              : `LIVE · Updated ${formatCommuteUpdatedAt(commuteResult.freshness?.overall_updated_at || commuteResult.generated_at)}`}
                      </p>
                    </div>
                    <p className="text-xl sm:text-3xl font-black text-slate-950 mt-2 leading-tight ">
                      {selectedOriginAddress ? getAddressPrimaryLabel(selectedOriginAddress) : shortCommutePlace(commuteResult.origin?.name, 'Origin')} → {selectedDestinationAddress ? getAddressPrimaryLabel(selectedDestinationAddress) : shortCommutePlace(commuteResult.destination?.name, 'Destination')}
                    </p>
                    <p className="text-[9px] text-slate-500 mt-1">
                      Depart {formatCommuteClock(commuteResult.route?.departure_time || commuteResult.route_weather_checkpoints?.[0]?.arrival_time)}
                      {(commuteAdviceOptions.includes('traffic_delays') || commuteAdviceOptions.includes('best_departure'))
                        ? commuteResult.partial?.traffic_available === true && commuteResult.route?.arrival_time
                          ? ` · ETA ${formatCommuteClock(commuteResult.route.arrival_time)}`
                          : ' · Traffic ETA unavailable'
                        : ' · Forecast matched to route passing times'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={checkCommuteRoute}
                    disabled={commuteLoading}
                    className="min-h-11 px-4 rounded-xl bg-blue-600 border border-blue-600 text-white text-[9px] font-extrabold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {commuteLoading ? 'Refreshing…' : '↻ Refresh'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-slate-200 pb-3 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-0 " aria-label="Requested advice availability">
                  {([
                    ['route_weather', '☁️', 'Route weather'],
                    ['rain_risk', '🌧️', 'Rain risk'],
                    ['traffic_delays', '🚗', 'Traffic delays'],
                    ['best_departure', '◷', 'Best departure'],
                  ] as Array<[CommuteAdviceOption, string, string]>).map(([option, icon, label]) => {
                    const availability = getAdviceAvailability(
                      option,
                      commuteAdviceOptions,
                      commuteResult
                    );
                    const statusLabel =
                      availability === 'available'
                        ? 'Available'
                        : availability === 'unavailable'
                          ? 'Unavailable'
                          : 'Not requested';
                    return (
                      <div
                        key={option}
                        className={`min-h-10 px-2.5 py-2 flex items-center gap-2 sm:border-r sm:border-slate-200 sm:px-5 sm:last:border-r-0  ${
                          availability === 'available'
                            ? 'text-blue-700 '
                            : 'text-slate-500 '
                        }`}
                      >
                        <span className="text-xs" aria-hidden="true">
                          {availability === 'available'
                            ? '✓'
                            : availability === 'unavailable'
                              ? '!'
                              : icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[9px] font-extrabold truncate">{label}</span>
                          <span className="block text-[8px] font-semibold mt-0.5">{statusLabel}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                {(commuteAdviceOptions.includes('traffic_delays') || commuteAdviceOptions.includes('best_departure')) && (commuteResult.partial?.traffic_available === true && commuteResult.route ? (
                <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 sm:grid-cols-4 ">
                  <MetricCard icon="🕒" label="ETA" value={formatCommuteMinutes(commuteResult.route?.eta_minutes)} />
                  <MetricCard icon="📍" label="Distance" value={formatCommuteDistance(commuteResult.route?.distance_km)} />
                  <MetricCard
                    icon="🚗"
                    label="Traffic delay"
                    value={`+${formatCommuteMinutes(commuteResult.route?.delay_minutes)}`}
                    helper="Compared with normal traffic"
                    valueClassName="text-orange-600 "
                  />
                  <MetricCard
                    icon="📶"
                    label="Traffic level"
                    value={commuteResult.route?.traffic_level ?? 'Unknown'}
                    valueClassName={
                      commuteResult.route?.traffic_level === 'Light'
                        ? 'text-blue-600 '
                        : commuteResult.route?.traffic_level === 'Moderate'
                          ? 'text-orange-600 '
                          : 'text-red-600 '
                    }
                  />
                </div>
                ) : (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3.5 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center flex-shrink-0" aria-hidden="true">🚗</span>
                    <div>
                      <p className="text-xs font-extrabold text-orange-900">Live traffic unavailable</p>
                      <p className="text-[10px] text-orange-700 mt-1">Destination weather is available, but ETA and traffic delay could not be refreshed.</p>
                    </div>
                  </div>
                ))}

                {(commuteAdviceOptions.includes('route_weather') || commuteAdviceOptions.includes('rain_risk')) && commuteResult.route_weather_summary?.available && commuteResult.route_weather_checkpoints && commuteResult.route_weather_checkpoints.length > 0 && (
                  <section className="overflow-hidden rounded-2xl bg-[#fcfbf8] ">
                    <div className="px-3.5 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 ">
                      <div>
                        <p className="text-xs font-extrabold text-slate-900 ">Weather along your route</p>
                        <p className="text-[9px] text-slate-400 mt-0.5 ">
                          Forecast matched to your estimated passing time
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[8px] font-extrabold text-blue-700  ">
                          🗺️ {commuteResult.route_weather_checkpoints.length} checkpoints
                        </span>
                        <span className="text-[8px] font-bold text-slate-400">Tap a card</span>
                      </div>
                    </div>

                    <div className="p-3 sm:p-3.5">
                      {(() => {
                        const routeCheckpoints = commuteResult.route_weather_checkpoints || [];
                        const selectedCheckpoint =
                          routeCheckpoints.find((checkpoint) => checkpoint.index === selectedCommuteCheckpointIndex) ||
                          routeCheckpoints[0];
                        const selectedVisual = selectedCheckpoint
                          ? getRouteCheckpointVisual(selectedCheckpoint)
                          : null;

                        return (
                          <>
                            <div className="flex flex-col lg:flex-row lg:items-stretch gap-0 lg:gap-2">
                              {routeCheckpoints.map((checkpoint, index) => {
                                const visual = getRouteCheckpointVisual(checkpoint);
                                const rainChance = Number(checkpoint.rain_probability ?? 0);
                                const isSelected = checkpoint.index === selectedCheckpoint?.index;
                                const isHighRisk = rainChance >= 70;
                                const isRainRisk = rainChance >= 50;
                                const cardTone = !checkpoint.available
                                  ? 'border-slate-200 bg-slate-50/60  '
                                  : isHighRisk
                                    ? 'border-orange-300 bg-orange-50/40  '
                                    : isRainRisk
                                      ? 'border-amber-200 bg-amber-50/30  '
                                      : 'border-slate-200 bg-transparent ';

                                return (
                                  <div key={`${checkpoint.index}-${checkpoint.lat}-${checkpoint.lon}`} className="contents">
                                    <CheckpointItem
                                      selected={isSelected}
                                      onClick={() => setSelectedCommuteCheckpointIndex(checkpoint.index)}
                                      label={`View forecast details for ${checkpoint.location_name}`}
                                      className={cardTone}
                                    >
                                      <div className="flex items-start justify-between gap-3 lg:flex-col lg:items-center">
                                        <span className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border text-3xl shadow-sm lg:h-20 lg:w-20 lg:text-4xl ${
                                          isHighRisk
                                            ? 'border-orange-200 bg-white  '
                                            : 'border-blue-100 bg-white  '
                                        }`} aria-hidden="true">
                                          {visual.icon}
                                        </span>
                                        <div className="min-w-0 flex-1 lg:w-full">
                                          <div className="flex items-center justify-between gap-2 lg:justify-center">
                                            <p className={`text-[11px] font-extrabold truncate ${isHighRisk ? 'text-orange-900 ' : 'text-slate-900 '}`} title={checkpoint.location_name}>
                                              {shortCommutePlace(checkpoint.location_name, `Checkpoint ${index + 1}`)}
                                            </p>
                                            <span className={`rounded-full px-2 py-1 text-[9px] font-black ${
                                              isHighRisk
                                                ? 'bg-orange-100 text-orange-700  '
                                                : isRainRisk
                                                  ? 'bg-amber-100 text-amber-700  '
                                                : 'bg-blue-100 text-blue-700  '
                                            }`}>
                                              {checkpoint.available && checkpoint.rain_probability != null
                                                ? `${Math.round(checkpoint.rain_probability)}%`
                                                : 'N/A'}
                                            </span>
                                          </div>
                                          <p className="mt-1 text-[9px] font-semibold text-slate-500 ">
                                            🕒 {formatCommuteClock(checkpoint.arrival_time)}
                                          </p>
                                          <p className="mt-1.5 text-[9px] font-bold text-slate-700 ">
                                            {visual.label}
                                          </p>
                                          {checkpoint.available && checkpoint.precipitation_mm != null && (
                                            <p className="mt-1 text-[9px] font-extrabold text-sky-700 ">
                                              💧 {formatRainAmount(checkpoint.precipitation_mm)} possible
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <span className="mt-2 hidden text-[8px] font-bold text-blue-700  lg:block">
                                        {isSelected ? 'Details shown below' : 'Click for details'}
                                      </span>
                                    </CheckpointItem>

                                    {index < routeCheckpoints.length - 1 && (
                                      <>
                                        <div className="flex lg:hidden h-4 pl-5 items-stretch" aria-hidden="true">
                                          <span className={`w-0.5 h-full ${isHighRisk || isRainRisk ? 'bg-orange-400' : 'bg-blue-500'}`} />
                                        </div>
                                        <div className="hidden lg:flex w-4 items-center justify-center" aria-hidden="true">
                                          <span className={`h-0.5 w-full ${isHighRisk || isRainRisk ? 'bg-orange-400' : 'bg-blue-500'}`} />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {selectedCheckpoint && selectedVisual && (
                              <div className="mt-3 rounded-2xl border border-blue-200 bg-white p-3.5 shadow-sm  " aria-live="polite">
                                <div className="flex items-start gap-3">
                                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm " aria-hidden="true">
                                    {selectedVisual.icon}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-extrabold text-slate-900 ">
                                          {shortCommutePlace(selectedCheckpoint.location_name, 'Route checkpoint')}
                                        </p>
                                        <p className="mt-0.5 text-[9px] text-slate-500 ">
                                          Estimated passing time · {formatCommuteClock(selectedCheckpoint.arrival_time)}
                                        </p>
                                      </div>
                                      <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-extrabold text-slate-600 shadow-sm  ">
                                        {selectedVisual.label}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between  ">
                                  <div className="flex min-w-0 items-start gap-2.5">
                                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-base " aria-hidden="true">
                                      📍
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-[8px] font-extrabold uppercase tracking-wider text-slate-400">
                                        Checkpoint address
                                      </p>
                                      <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-700 ">
                                        {selectedCheckpoint.resolved_address || selectedCheckpoint.location_name || 'Approximate route checkpoint'}
                                      </p>
                                      {!selectedCheckpoint.resolved_address && (
                                        <p className="mt-0.5 text-[8px] text-slate-400">
                                          Approximate route area; a street-level address was not returned.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {Number.isFinite(Number(selectedCheckpoint.lat)) && Number.isFinite(Number(selectedCheckpoint.lon)) && (
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedCheckpoint.lat},${selectedCheckpoint.lon}`)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex min-h-11 flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 text-[9px] font-extrabold text-blue-700 transition hover:bg-blue-100   "
                                    >
                                      🗺️ Open in Maps
                                    </a>
                                  )}
                                </div>

                                {selectedCheckpoint.available ? (
                                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div className="rounded-xl bg-white p-2.5 ">
                                      <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">☔ Rain chance</p>
                                      <p className="mt-1 text-sm font-black text-sky-700 ">
                                        {selectedCheckpoint.rain_probability != null ? `${Math.round(selectedCheckpoint.rain_probability)}%` : 'N/A'}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-white p-2.5 ">
                                      <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">💧 Expected rain</p>
                                      <p className="mt-1 text-sm font-black text-slate-900 ">
                                        {selectedCheckpoint.precipitation_mm != null ? formatRainAmount(selectedCheckpoint.precipitation_mm) : 'N/A'}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-white p-2.5 ">
                                      <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">🌡️ Temperature</p>
                                      <p className="mt-1 text-sm font-black text-slate-900 ">
                                        {selectedCheckpoint.temperature_c != null ? `${Math.round(selectedCheckpoint.temperature_c)}°C` : 'N/A'}
                                      </p>
                                      {selectedCheckpoint.apparent_temperature_c != null && (
                                        <p className="text-[8px] text-slate-400">Feels {Math.round(selectedCheckpoint.apparent_temperature_c)}°C</p>
                                      )}
                                    </div>
                                    <div className="rounded-xl bg-white p-2.5 ">
                                      <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">💨 Wind</p>
                                      <p className="mt-1 text-sm font-black text-slate-900 ">
                                        {selectedCheckpoint.wind_speed_kmh != null ? `${Math.round(selectedCheckpoint.wind_speed_kmh)} km/h` : 'N/A'}
                                      </p>
                                      {selectedCheckpoint.wind_gust_kmh != null && (
                                        <p className="text-[8px] text-slate-400">Gusts {Math.round(selectedCheckpoint.wind_gust_kmh)} km/h</p>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-3 rounded-xl bg-white p-3 text-[10px] font-semibold text-slate-600  ">
                                    Forecast detail is unavailable for this passing time. Try refreshing the route.
                                  </div>
                                )}

                                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[8px] font-semibold text-slate-400">
                                  <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700  ">Open-Meteo</span>
                                  <span>{String(selectedCheckpoint.forecast_method || 'hourly forecast').replace(/_/g, ' ')}</span>
                                  <span className="sm:ml-auto">Tap another checkpoint to compare.</span>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {commuteResult.route_weather_summary?.recommendation && (
                        <AdvisoryBanner icon="☂️" title="Trip recommendation" className="mt-3">
                          {commuteResult.route_weather_summary.recommendation}
                        </AdvisoryBanner>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] text-slate-400">
                        <span>TomTom route</span>
                        <span>·</span>
                        <span>Open-Meteo forecast</span>
                        <span>·</span>
                        <span>Asia/Manila</span>
                        <span className="sm:ml-auto">Forecast may change.</span>
                      </div>
                    </div>
                  </section>
                )}

                {commuteUIState === 'partial' && (
                  <div role="status" aria-live="polite" className="rounded-2xl border border-orange-200 bg-orange-50 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-black" aria-hidden="true">!</span>
                      <p className="text-xs font-extrabold uppercase tracking-wide text-orange-900">PARTIAL DATA</p>
                    </div>
                    <p className="text-[10px] text-orange-700 mt-1">
                      {buildPartialCommuteMessage(
                        commuteResult.partial,
                        commuteAdviceOptions
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-bold text-orange-700/80">
                      <span>Traffic updated {formatCommuteUpdatedAt(commuteResult.freshness?.traffic_updated_at)}</span>
                      <span>Weather updated {formatCommuteUpdatedAt(commuteResult.freshness?.weather_updated_at)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={checkCommuteRoute}
                      disabled={commuteLoading}
                      className="mt-3 w-full min-h-10 rounded-xl bg-orange-600 text-white text-[10px] font-extrabold hover:bg-orange-700 transition disabled:opacity-50"
                    >
                      {commuteLoading ? 'Retrying…' : 'Retry missing live data'}
                    </button>
                  </div>
                )}

                {commuteResult.ai_advisory && (() => {
                  const advisory = commuteResult.ai_advisory;
                  const isTl = advisory.language === 'tl';
                  const readableOrigin = selectedOriginAddress
                    ? getAddressPrimaryLabel(selectedOriginAddress)
                    : shortCommutePlace(commuteResult.origin?.name, 'Origin');
                  const readableDestination = selectedDestinationAddress
                    ? getAddressPrimaryLabel(selectedDestinationAddress)
                    : shortCommutePlace(commuteResult.destination?.name, 'Destination');
                  const readableRoute = `${readableOrigin} → ${readableDestination}`;
                  const cleanAdvisoryText = (value: string | null | undefined) => {
                    let text = String(value || '');
                    const replacements: Array<[string | undefined, string]> = [
                      [commuteResult.origin?.name, readableOrigin],
                      [commuteResult.destination?.name, readableDestination],
                    ];
                    replacements.forEach(([source, replacement]) => {
                      if (source) text = text.split(source).join(replacement);
                    });
                    return text.replace(/-?\d{1,2}\.\d{4,},\s*-?\d{1,3}\.\d{4,}/g, readableOrigin);
                  };

                  const status = advisory.status || 'good_to_go';
                  const statusMeta =
                    status === 'consider_alternate_route'
                      ? {
                          icon: '🔴',
                          label: isTl ? 'ISIPIN ANG IBANG RUTA' : 'CONSIDER ALTERNATE ROUTE',
                          card: 'bg-red-50 border-red-200',
                          badge: 'bg-red-600 text-white',
                          title: 'text-red-950',
                        }
                      : status === 'expect_delays'
                        ? {
                            icon: '🟠',
                            label: isTl ? 'ASAHAN ANG PAGKAANTALA' : 'EXPECT DELAYS',
                            card: 'bg-orange-50 border-orange-200',
                            badge: 'bg-orange-500 text-white',
                            title: 'text-orange-950',
                          }
                        : status === 'leave_early'
                          ? {
                              icon: '🟡',
                              label: isTl ? 'UMALIS NANG MAS MAAGA' : 'LEAVE EARLY',
                              card: 'bg-amber-50 border-amber-200',
                              badge: 'bg-amber-500 text-white',
                              title: 'text-amber-950',
                            }
                          : {
                              icon: '🟢',
                              label: isTl ? 'MAAYOS ANG BIYAHE' : 'GOOD TO GO',
                              card: 'bg-blue-50 border-blue-200',
                              badge: 'bg-blue-600 text-white',
                              title: 'text-blue-950',
                            };

                  return (
                    <div className={`p-4 rounded-2xl border ${statusMeta.card}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase tracking-[0.18em] font-extrabold text-slate-500">
                            {isTl ? 'AI Desisyon sa Biyahe' : 'AI Commute Decision'}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-extrabold ${statusMeta.badge}`}>
                              <span>{statusMeta.icon}</span>
                              {advisory.status_label || statusMeta.label}
                            </span>

                            <span className="rounded-full bg-white/80 border border-black/5 px-2 py-1 text-[9px] font-extrabold text-slate-600">
                              {isTl ? 'FILIPINO' : 'ENGLISH'}
                            </span>
                          </div>

                          <p className={`text-sm font-extrabold mt-2 ${statusMeta.title}`}>
                            {readableRoute}
                          </p>
                        </div>

                        {Number(advisory.recommended_extra_minutes ?? 0) > 0 && (
                          <div className="flex-shrink-0 rounded-2xl bg-white/80 border border-black/5 px-3 py-2 text-center shadow-sm">
                            <p className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">
                              {isTl ? 'Inirerekomendang allowance' : 'Recommended Buffer'}
                            </p>
                            <p className="text-lg font-black text-slate-900 leading-none mt-1">
                              +{Math.round(Number(advisory.recommended_extra_minutes))}
                              <span className="text-[9px] ml-0.5">min</span>
                            </p>
                            <p className="text-[7px] text-slate-400 mt-1 max-w-[110px] leading-tight">Includes weather and incidents, not traffic alone.</p>
                          </div>
                        )}
                      </div>

                      {advisory.summary && (
                        <p className="text-xs text-slate-700 leading-relaxed mt-3">
                          {cleanAdvisoryText(advisory.summary)}
                        </p>
                      )}

                      {Array.isArray(advisory.key_reasons) && advisory.key_reasons.length > 0 && (
                        <div className="mt-3 rounded-xl bg-white/70 border border-black/5 p-3">
                          <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
                            {isTl ? 'Bakit ito ang rekomendasyon' : 'Why this recommendation'}
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {advisory.key_reasons.slice(0, 3).map((reason, index) => (
                              <div key={`${reason}-${index}`} className="flex items-start gap-2 text-[10px] text-slate-700 leading-relaxed">
                                <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                                <span>{cleanAdvisoryText(reason)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 gap-2 mt-3">
                        {advisory.traffic_summary && (
                          <div className="rounded-xl bg-white/70 border border-black/5 p-3">
                            <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
                              {isTl ? 'Trapiko' : 'Traffic'}
                            </p>
                            <p className="text-[10px] text-slate-700 mt-1 leading-relaxed">
                              {cleanAdvisoryText(advisory.traffic_summary)}
                            </p>
                          </div>
                        )}

                        {advisory.weather_summary && (
                          <div className="rounded-xl bg-white/70 border border-black/5 p-3">
                            <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
                              {isTl ? 'Panahon' : 'Weather'}
                            </p>
                            <p className="text-[10px] text-slate-700 mt-1 leading-relaxed">
                              {cleanAdvisoryText(advisory.weather_summary)}
                            </p>
                          </div>
                        )}
                      </div>

                      {advisory.recommendation && (
                        <div className="mt-3 rounded-xl bg-slate-950  text-white  border border-transparent  p-3.5">
                          <p className="text-[9px] uppercase tracking-wider font-extrabold text-white/60">
                            {isTl ? 'Gawin ngayon' : 'What to do'}
                          </p>
                          <p className="text-xs font-semibold mt-1 leading-relaxed">
                            {cleanAdvisoryText(advisory.recommendation)}
                          </p>
                        </div>
                      )}

                      <p className="text-[9px] text-slate-400 mt-3 leading-relaxed">
                        {isTl
                          ? 'Ang AI advice ay base lamang sa route, traffic incident, at weather data na ipinakita sa itaas. Ang incident delay ay hindi awtomatikong idinadagdag sa kabuuang ETA.'
                          : 'AI advice is based only on the route, traffic incident, and weather data shown above. Individual incident delays are not automatically added to the total ETA.'}
                      </p>
                    </div>
                  );
                })()}

                {(commuteAdviceOptions.includes('route_weather') || commuteAdviceOptions.includes('rain_risk')) && commuteResult.weather && (!commuteResult.route_weather_checkpoints || commuteResult.route_weather_checkpoints.length === 0) && (() => {
                  const weatherHighlight = getCommuteWeatherHighlight(commuteResult.weather);
                  const rainChance = Number(commuteResult.weather.rain_probability ?? 0);
                  const rainAlertActive = commuteResult.weather.rain_alert?.active === true || rainChance >= 50;
                  return (
                    <section className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border ${weatherHighlight.card}`}>
                      <span className={`absolute inset-y-0 left-0 w-1 ${weatherHighlight.accent}`} aria-hidden="true" />

                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 pl-1">
                        <div className="flex items-center gap-2">
                          <span className="w-9 h-9 rounded-xl bg-white/70 border border-white/70 flex items-center justify-center text-lg flex-shrink-0" aria-hidden="true">{weatherHighlight.icon}</span>
                          <div className="min-w-0">
                            <p className={`text-xs font-extrabold ${weatherHighlight.text}`}>Destination Weather</p>
                            <p className={`text-[10px] font-semibold mt-0.5 truncate ${weatherHighlight.text} opacity-75`}>
                              {selectedDestinationAddress ? getAddressPrimaryLabel(selectedDestinationAddress) : commuteResult.destination?.name || 'Destination'}
                            </p>
                          </div>
                        </div>

                        <span className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-extrabold ${weatherHighlight.badge}`}>
                          {weatherHighlight.label}
                        </span>
                      </div>

                      {commuteAdviceOptions.includes('rain_risk') && rainAlertActive && (
                        <div className="mt-3 ml-1 rounded-xl bg-white/80 border border-white/70 px-3 py-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                            <div>
                              <p className={`text-xs font-extrabold ${weatherHighlight.text}`}>
                                ☔ {Math.round(rainChance)}% chance of rain
                              </p>
                              <p className="text-[10px] text-slate-600 mt-0.5">
                                {commuteResult.weather.rain_intensity_label || 'Rain possible at the destination.'}
                              </p>
                            </div>
                            {commuteResult.weather.expected_precipitation_next_hour_mm != null && (
                              <div className="sm:text-right">
                                <p className="text-[8px] uppercase tracking-wider font-extrabold text-slate-500">Possible next hour</p>
                                <p className={`text-sm font-black ${weatherHighlight.text}`}>
                                  {formatRainAmount(commuteResult.weather.expected_precipitation_next_hour_mm)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 ml-1">
                        {commuteAdviceOptions.includes('route_weather') && commuteResult.weather.temperature_c != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Temperature</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                              🌡️ {Math.round(commuteResult.weather.temperature_c)}°C
                            </p>
                          </div>
                        )}

                        {commuteAdviceOptions.includes('route_weather') && commuteResult.weather.apparent_temperature_c != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Feels Like</p>
                            <p className={`text-sm font-extrabold mt-0.5 ${
                              Number(commuteResult.weather.apparent_temperature_c) >= 35
                                ? 'text-orange-600'
                                : 'text-slate-900'
                            }`}>
                              ☀️ {Math.round(commuteResult.weather.apparent_temperature_c)}°C
                            </p>
                          </div>
                        )}

                        {commuteAdviceOptions.includes('rain_risk') && commuteResult.weather.rain_probability != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Rain Chance</p>
                            <p className={`text-sm font-extrabold mt-0.5 ${
                              Number(commuteResult.weather.rain_probability) >= 85
                                ? 'text-red-600'
                                : Number(commuteResult.weather.rain_probability) >= 70
                                  ? 'text-orange-600'
                                  : Number(commuteResult.weather.rain_probability) >= 50
                                    ? 'text-amber-700'
                                    : 'text-slate-900'
                            }`}>
                              ☔ {Math.round(commuteResult.weather.rain_probability)}%
                            </p>
                          </div>
                        )}

                        {commuteAdviceOptions.includes('rain_risk') && commuteResult.weather.expected_precipitation_next_30_minutes_mm != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Next 30 Min</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                              🌧️ {formatRainAmount(commuteResult.weather.expected_precipitation_next_30_minutes_mm)}
                            </p>
                          </div>
                        )}

                        {commuteAdviceOptions.includes('rain_risk') && commuteResult.weather.expected_precipitation_next_hour_mm != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Next Hour</p>
                            <p className={`text-sm font-extrabold mt-0.5 ${rainAlertActive ? weatherHighlight.text : 'text-slate-900'}`}>
                              💧 {formatRainAmount(commuteResult.weather.expected_precipitation_next_hour_mm)}
                            </p>
                          </div>
                        )}

                        {commuteAdviceOptions.includes('route_weather') && commuteResult.weather.wind_speed_kmh != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Wind</p>
                            <p className={`text-sm font-extrabold mt-0.5 ${
                              Number(commuteResult.weather.wind_speed_kmh) >= 35
                                ? 'text-cyan-700'
                                : 'text-slate-900'
                            }`}>
                              💨 {Math.round(commuteResult.weather.wind_speed_kmh)} km/h
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 ml-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-500">
                        <span className="font-bold">Updated {formatWeatherBucketTime(commuteResult.weather.weather_time)}</span>
                        <span>· {commuteResult.weather.bucket_minutes || 30}-minute weather bucket</span>
                        {commuteResult.weather.relative_humidity_percent != null && (
                          <span>· Humidity {Math.round(commuteResult.weather.relative_humidity_percent)}%</span>
                        )}
                        {commuteResult.weather.wind_gust_kmh != null && (
                          <span>· Gusts {Math.round(commuteResult.weather.wind_gust_kmh)} km/h</span>
                        )}
                        {commuteResult.weather.rain_probability_method?.includes('estimate') && (
                          <span className="w-full text-slate-400">The :30 rain chance is estimated from the surrounding hourly ensemble forecast.</span>
                        )}
                      </div>
                    </section>
                  );
                })()}

                {commuteAdviceOptions.includes('traffic_delays') && (commuteResult.incidents?.length ?? 0) > 0 && (
                  <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowCommuteIncidents((value) => !value)}
                      className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="label-branded mb-0">Traffic Incidents</p>
                          <span className="px-2 py-0.5 rounded-full bg-slate-900  text-white text-[9px] font-extrabold border border-transparent ">
                            {commuteResult.incidents?.length ?? 0} LIVE
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {showCommuteIncidents ? 'Hide reported incidents' : 'View reported incidents near your route'}
                        </p>
                      </div>
                      <span className={`text-slate-500 text-lg transition-transform ${showCommuteIncidents ? 'rotate-180' : ''}`}>
                        ⌄
                      </span>
                    </button>

                    {showCommuteIncidents && (
                      <div className="px-3.5 pb-3.5 border-t border-slate-100">
                        <div className="space-y-2 mt-3">
                      {(commuteResult.incidents ?? []).slice(0, 5).map((incident, index) => {
                        const style = getTrafficLevelStyle(incident.severity);

                        return (
                          <div
                            key={incident.id || `${incident.type || 'incident'}-${index}`}
                            className="rounded-xl bg-slate-50 border border-slate-100 p-3"
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`}
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs font-extrabold text-slate-900">
                                    {incident.location_label ||
                                      incident.category_label ||
                                      incident.type ||
                                      'Traffic incident'}
                                  </p>

                                  {incident.severity && (
                                    <span
                                      className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold ${style.badge}`}
                                    >
                                      {incident.severity}
                                    </span>
                                  )}
                                </div>

                                <p className="text-[10px] text-slate-600 mt-1">
                                  {incident.category_label ||
                                    incident.type ||
                                    'Traffic incident'}
                                  {incident.delay_minutes
                                    ? ` · about +${incident.delay_minutes} min`
                                    : ''}
                                  {incident.length_meters
                                    ? ` · ${Math.round(incident.length_meters)} m affected`
                                    : ''}
                                </p>

                                {(incident.from || incident.to) && (
                                  <p className="text-[10px] text-slate-500 mt-1">
                                    {incident.from || 'Start'} → {incident.to || 'End'}
                                  </p>
                                )}

                                {incident.distance_from_route_km != null && (
                                  <p className="text-[9px] text-slate-400 mt-1">
                                    {incident.distance_from_route_km <= 0.05
                                      ? 'On your route'
                                      : `${incident.distance_from_route_km.toFixed(2)} km from route`}
                                  </p>
                                )}

                                {incident.last_report_time && (
                                  <p className="text-[9px] text-slate-400 mt-1">
                                    TomTom update:{' '}
                                    {new Date(incident.last_report_time).toLocaleTimeString(
                                      'en-US',
                                      {
                                        timeZone: 'Asia/Manila',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      }
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100 text-[9px] font-bold text-slate-500">
                          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1" />Light</span>
                          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-1" />Moderate</span>
                          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1" />Heavy</span>
                          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-800 mr-1" />Severe / road closed</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}


                {(commuteAdviceOptions.includes('traffic_delays') || commuteAdviceOptions.includes('best_departure')) && (
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                    <span className="font-semibold">
                      Route traffic: {commuteResult.route?.traffic_level ?? 'Unknown'}
                    </span>
                    <span>Live ETA/delay from TomTom Routing</span>
                    <span className="ml-auto">{selectedOriginAddress ? getAddressPrimaryLabel(selectedOriginAddress) : commuteResult.origin?.name ?? 'Origin'} → {selectedDestinationAddress ? getAddressPrimaryLabel(selectedDestinationAddress) : commuteResult.destination?.name ?? 'Destination'}</span>
                  </div>
                )}

                <div className="sticky bottom-0 z-30 -mx-3.5 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden  ">
                  <button
                    type="button"
                    onClick={() => setIsCommuteFormCollapsed(false)}
                    className="min-h-11 rounded-xl border border-blue-200 bg-white px-3 text-[10px] font-extrabold text-blue-700 transition hover:bg-blue-50   "
                  >
                    ✏️ Edit trip
                  </button>
                  <button
                    type="button"
                    onClick={checkCommuteRoute}
                    disabled={commuteLoading}
                    className="min-h-11 rounded-xl bg-blue-600 px-3 text-[10px] font-extrabold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {commuteLoading ? 'Refreshing…' : '↻ Refresh advice'}
                  </button>
                </div>
              </div>
            )}
            </div>
            </div>
          </div>
        </div>
      )}


    </>
  );
}