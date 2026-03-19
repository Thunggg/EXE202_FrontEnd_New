"use client";

import { useEffect, useMemo, useState } from "react";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function chainLabel(chainIdHex: string | null) {
  if (!chainIdHex) return null;
  const map: Record<string, string> = {
    "0x1": "Ethereum",
    "0xaa36a7": "Sepolia",
    "0x38": "BSC",
    "0x89": "Polygon",
    "0xa4b1": "Arbitrum",
    "0xa": "Optimism",
    "0x2105": "Base",
  };
  return map[chainIdHex] ?? chainIdHex;
}

export default function MetaMaskConnect({
  onAddressChange,
}: {
  onAddressChange?: (address: string | null) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [ethereum, setEthereum] = useState<Eip1193Provider | null>(null);

  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const network = useMemo(() => chainLabel(chainId), [chainId]);

  useEffect(() => {
    setMounted(true);
    setEthereum(window.ethereum ?? null);
  }, []);

  useEffect(() => {
    if (!mounted || !ethereum) return;

    const sync = async () => {
      try {
        const [accounts, cid] = await Promise.all([
          ethereum.request({ method: "eth_accounts" }) as Promise<string[]>,
          ethereum.request({ method: "eth_chainId" }) as Promise<string>,
        ]);
        const nextAddress = accounts?.[0] ?? null;
        setAddress(nextAddress);
        onAddressChange?.(nextAddress);
        setChainId(cid ?? null);
      } catch (e: any) {
        setError(e?.message ?? "Không thể đọc trạng thái MetaMask.");
      }
    };

    const onAccountsChanged = (accounts: string[]) => {
      const nextAddress = accounts?.[0] ?? null;
      setAddress(nextAddress);
      onAddressChange?.(nextAddress);
      setError(null);
    };

    const onChainChanged = (cid: string) => {
      setChainId(cid ?? null);
      setError(null);
    };

    const onDisconnect = () => {
      setAddress(null);
      onAddressChange?.(null);
      setError(null);
    };

    void sync();

    ethereum.on?.("accountsChanged", onAccountsChanged);
    ethereum.on?.("chainChanged", onChainChanged);
    ethereum.on?.("disconnect", onDisconnect);

    return () => {
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      ethereum.removeListener?.("chainChanged", onChainChanged);
      ethereum.removeListener?.("disconnect", onDisconnect);
    };
  }, [ethereum, mounted]);

  const connect = async () => {
    setError(null);
    if (!mounted || !ethereum) {
      setError("Chưa có MetaMask. Hãy cài extension MetaMask rồi thử lại.");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const nextAddress = accounts?.[0] ?? null;
      setAddress(nextAddress);
      onAddressChange?.(nextAddress);
      const cid = (await ethereum.request({ method: "eth_chainId" })) as string;
      setChainId(cid ?? null);
    } catch (e: any) {
      const msg =
        e?.code === 4001
          ? "Bạn đã từ chối kết nối."
          : (e?.message as string | undefined) ?? "Kết nối MetaMask thất bại.";
      setError(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    setError(null);
    setAddress(null);
    onAddressChange?.(null);

    if (!mounted || !ethereum) return;
    try {
      await ethereum.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Not supported by all wallets; local state reset is enough for UI.
    }
  };

  if (!mounted) {
    return (
      <div className="wallet">
        <span className="wallet__hint">...</span>
      </div>
    );
  }

  if (!ethereum) {
    return (
      <div className="wallet">
        <span className="wallet__hint">MetaMask chưa sẵn sàng</span>
      </div>
    );
  }

  return (
    <div className="wallet">
      {address ? (
        <>
          <div className="wallet__pill" title={address}>
            <span className="wallet__dot" aria-hidden="true" />
            <span className="wallet__addr">{shortenAddress(address)}</span>
            {network && <span className="wallet__net">{network}</span>}
          </div>
          <button className="wallet__btn wallet__btn--ghost" onClick={disconnect} type="button">
            Ngắt
          </button>
        </>
      ) : (
        <button className="wallet__btn" onClick={connect} disabled={isConnecting} type="button">
          {isConnecting ? "Đang kết nối..." : "Kết nối MetaMask"}
        </button>
      )}

      {error && <div className="wallet__error">{error}</div>}
    </div>
  );
}

