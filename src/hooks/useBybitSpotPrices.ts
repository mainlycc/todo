import { useCallback, useEffect, useRef, useState } from 'react';

const BYBIT_API = 'https://api.bybit.com/v5/market/tickers';

type BybitTickerResponse = {
  retCode: number;
  result?: { list?: Array<{ symbol: string; lastPrice: string }> };
};

export interface BybitSpotPricesState {
  btc: string | null;
  eth: string | null;
  loading: boolean;
  error: boolean;
}

export interface BybitSpotPricesResult extends BybitSpotPricesState {
  /** Ręczne odświeżenie (pokazuje stan na przycisku) */
  refresh: () => void;
  refreshing: boolean;
}

async function fetchLastPrice(symbol: string): Promise<string | null> {
  const url = `${BYBIT_API}?category=spot&symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url);
  const data = (await res.json()) as BybitTickerResponse;
  if (data.retCode !== 0 || !data.result?.list?.[0]?.lastPrice) return null;
  return data.result.list[0].lastPrice;
}

export function useBybitSpotPrices(pollIntervalMs = 30_000): BybitSpotPricesResult {
  const [state, setState] = useState<BybitSpotPricesState>({
    btc: null,
    eth: null,
    loading: true,
    error: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async (manual: boolean) => {
    if (manual) {
      if (mountedRef.current) setRefreshing(true);
    } else {
      setState(prev => {
        if (prev.btc == null && prev.eth == null) return { ...prev, loading: true };
        return prev;
      });
    }
    try {
      const [btcPrice, ethPrice] = await Promise.all([
        fetchLastPrice('BTCUSDT'),
        fetchLastPrice('ETHUSDT'),
      ]);
      if (!mountedRef.current) return;
      setState({
        btc: btcPrice,
        eth: ethPrice,
        loading: false,
        error: btcPrice === null && ethPrice === null,
      });
    } catch {
      if (!mountedRef.current) return;
      setState(prev => ({ ...prev, loading: false, error: true }));
    } finally {
      if (manual && mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load(false);
    const id = window.setInterval(() => void load(false), pollIntervalMs);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, [load, pollIntervalMs]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return { ...state, refresh, refreshing };
}

export function formatUsdtPrice(lastPrice: string | null): string {
  if (lastPrice == null) return '—';
  const n = Number.parseFloat(lastPrice);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
