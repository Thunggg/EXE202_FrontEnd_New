"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MetaMaskConnect from "@/components/metamask-connect";

function addressToNullifierDecimal(address: string) {
  const a = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return null;
  try {
    return BigInt(a).toString(10);
  } catch {
    return null;
  }
}

async function postJsonWithTimeout<T>(url: string, body: unknown, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    window.clearTimeout(t);
  }
}

async function getJsonWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { method: "GET", signal: ctrl.signal });
  } finally {
    window.clearTimeout(t);
  }
}

export default function DappPage() {
  const expRef = useRef<{ dispose: () => void; vote: (id: string) => Promise<void> } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(() => new Set());
  const [isVoting, setIsVoting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletHasVoted, setWalletHasVoted] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "error" | "info" | "success" } | null>(null);

  const MAX_CANDIDATES = 3; // must match circom: var MAX_CANDIDATES = 3;
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsCounts, setStatsCounts] = useState<number[]>(() => Array(MAX_CANDIDATES).fill(0));
  const [statsAnimate, setStatsAnimate] = useState(false);

  const candidates = useMemo(
    () => [
      {
        id: "candidate-1",
        name: "Ứng viên A",
        age: 28,
        district: "Quận 1",
        bio: "Tập trung minh bạch, chuyển đổi số và cải thiện trải nghiệm người dân.",
      },
      {
        id: "candidate-2",
        name: "Ứng viên B",
        age: 35,
        district: "Quận 3",
        bio: "Ưu tiên an sinh, giáo dục và các chương trình hỗ trợ cộng đồng.",
      },
      {
        id: "candidate-3",
        name: "Ứng viên C",
        age: 42,
        district: "Thủ Đức",
        bio: "Tập trung hạ tầng, kinh tế địa phương và hỗ trợ doanh nghiệp nhỏ.",
      },
    ],
    []
  );

  useEffect(() => {
    let disposed = false;
    let api: { dispose: () => void } | null = null;

    (async () => {
      // Ensure the legacy theme CSS applies correctly
      document.body.classList.add("light-theme", "dapp-body");

      const mod = await import("./runtime/initExperience.js");
      if (disposed) return;

      api = mod.initExperience({
        assetBase: "/dapp-assets/",
        onSelectCandidate: (id: string) => setSelectedId(id),
        onVoteComplete: (id: string) => {
          setVotedIds((prev) => new Set(prev).add(id));
          setIsVoting(false);
        },
      });
      expRef.current = api as any;
    })().catch(() => {
      // ignore; UI will stay but no 3D experience
    });

    return () => {
      disposed = true;
      document.body.classList.remove("dapp-body");
      api?.dispose?.();
    };
  }, []);

  const selectedVoter = candidates.find((v) => v.id === selectedId) ?? null;
  const hasVoted = selectedId ? votedIds.has(selectedId) : false;
  const alreadyVoted = hasVoted || walletHasVoted;
  const selectedCandidateIndex = selectedId ? candidates.findIndex((c) => c.id === selectedId) : -1;
  const isSupportedCandidate = selectedCandidateIndex >= 0 && selectedCandidateIndex < MAX_CANDIDATES;

  useEffect(() => {
    setVoteError(null);
  }, [selectedId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!isStatsOpen) return;

    let cancelled = false;
    setStatsError(null);
    setStatsLoading(true);
    setStatsAnimate(false);

    (async () => {
      try {
        const reqs = Array.from({ length: MAX_CANDIDATES }, (_, i) => getJsonWithTimeout(`/api/votes/${i}`, 12000));
        const responses = await Promise.all(reqs);

        const counts = await Promise.all(
          responses.map(async (r) => {
            if (!r.ok) throw new Error(await r.text());
            const j = await r.json();
            const c = Number(j?.count ?? 0);
            return Number.isFinite(c) ? c : 0;
          })
        );

        if (cancelled) return;
        setStatsCounts(counts);

        // trigger bar animation after DOM paints
        window.setTimeout(() => {
          if (!cancelled) setStatsAnimate(true);
        }, 60);
      } catch (e: any) {
        if (cancelled) return;
        setStatsError(e?.message ?? "Không thể tải thống kê.");
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isStatsOpen, MAX_CANDIDATES]);

  const close = () => {
    if (isVoting) return;
    setSelectedId(null);
  };

  const vote = async () => {
    if (!selectedId || alreadyVoted || isVoting) return;
    setVoteError(null);
    if (!walletAddress) {
      setVoteError("Vui lòng kết nối MetaMask trước khi vote.");
      return;
    }
    if (walletHasVoted) {
      setToast({ kind: "info", message: "Ví này đã vote rồi." });
      return;
    }

    const candidateIndex = selectedCandidateIndex;
    if (candidateIndex < 0) return;
    if (!isSupportedCandidate) {
      setVoteError(`Hệ thống hiện chỉ hỗ trợ vote trong khoảng 0..${MAX_CANDIDATES - 1}.`);
      setToast({ kind: "error", message: `Chỉ hỗ trợ ${MAX_CANDIDATES} lựa chọn (0..${MAX_CANDIDATES - 1}).` });
      return;
    }

    setIsVoting(true);
    try {
      const nullifier = addressToNullifierDecimal(walletAddress);
      if (!nullifier) {
        setToast({ kind: "error", message: "Địa chỉ ví không hợp lệ." });
        return;
      }

      const payload = {
        candidateId: String(candidateIndex),
        proofInput: {
          vote: String(candidateIndex),
          hasVoted: "0",
          nullifier,
        },
      };

      let res: Response;
      try {
        res = await postJsonWithTimeout("/api/vote", payload, 20000);
      } catch {
        setToast({ kind: "error", message: "Gửi vote bị timeout. Vui lòng thử lại." });
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error === "NULLIFIER_USED") {
            setWalletHasVoted(true);
            setToast({ kind: "error", message: "Bạn đã vote rồi (ví này đã được dùng)." });
            return;
          }
        } catch {
          // ignore parse errors
        }

        setVoteError(text || "Gửi vote thất bại.");
        return;
      }

      // Mark voted immediately to avoid UI "treo" if animation callbacks don't fire
      setVotedIds((prev) => new Set(prev).add(selectedId));
      setWalletHasVoted(true);

      let txHash: string | null = null;
      try {
        const data = await res.json();
        txHash = typeof data?.txHash === "string" ? data.txHash : null;
      } catch {
        // ignore non-JSON responses
      }

      setToast({
        kind: "success",
        message: txHash ? `Vote thành công. Tx: ${txHash}` : "Vote thành công.",
      });

      const anim = expRef.current?.vote?.(selectedId);
      if (anim) {
        await Promise.race([anim, new Promise<void>((r) => window.setTimeout(r, 3000))]);
      }
    } catch {
      setToast({ kind: "error", message: "Có lỗi khi vote. Vui lòng thử lại." });
    } finally {
      setIsVoting(false);
    }
  };

  const onWalletChange = (addr: string | null) => {
    setWalletAddress(addr);
    setWalletHasVoted(false);
    setVoteError(null);
  };

  const totalVotes = statsCounts.reduce((a, b) => a + b, 0);
  const statsRows = candidates.slice(0, MAX_CANDIDATES).map((c, i) => {
    const votes = statsCounts[i] ?? 0;
    const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    return { key: c.id, label: c.name, votes, pct };
  });

  return (
    <>
      <div className="experience">
        <canvas className="experience-canvas" />
      </div>

      <div id="loader-wrapper">
        <div className="loader" />
      </div>

      <header>
        <a href="/" id="logo">
          <img src="/dapp-assets/images/logo.png" width={70} height={70} alt="Creative Works Logo" />
        </a>
        <div className="wallet-bar">
          <button
            type="button"
            className="stats-btn"
            aria-label="Mở thống kê bỏ phiếu"
            title="Thống kê bỏ phiếu"
            onClick={() => setIsStatsOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 19h16v2H2V3h2v16Zm4-8h2v6H8v-6Zm4-5h2v11h-2V6Zm4 3h2v8h-2V9Z"
              />
            </svg>
          </button>
          <MetaMaskConnect onAddressChange={onWalletChange} />
        </div>
      </header>

      <main>
        <a href="#" id="close-btn" style={{ display: "none" }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 96 960 960" width="48" height="48">
            <path d="m330 768 150-150 150 150 42-42-150-150 150-150-42-42-150 150-150-150-42 42 150 150-150 150 42 42Zm150 208q-82 0-155-31.5t-127.5-86Q143 804 111.5 731T80 576q0-83 31.5-156t86-127Q252 239 325 207.5T480 176q83 0 156 31.5T763 293q54 54 85.5 127T880 576q0 82-31.5 155T763 858.5q-54 54.5-127 86T480 976Zm0-60q142 0 241-99.5T820 576q0-142-99-241t-241-99q-141 0-240.5 99T140 576q0 141 99.5 240.5T480 916Zm0-340Z" />
          </svg>
        </a>
        <section className="section section--about">
          <h1>Voting DApp</h1>
          <p>
            Chọn một ứng viên trên tường (3D), sau đó bấm Vote. Animation sẽ “thả phiếu” vào thùng phiếu.
          </p>
        </section>
      </main>

      <footer>2026 zk voting - integrated into Next.js</footer>

      {toast && (
        <div
          className={`toast ${
            toast.kind === "error" ? "toast--error" : toast.kind === "success" ? "toast--success" : "toast--info"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      {isStatsOpen && (
        <div
          className="stats-modal__backdrop"
          role="presentation"
          onClick={() => setIsStatsOpen(false)}
        >
          <div className="stats-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="stats-modal__close" onClick={() => setIsStatsOpen(false)} aria-label="Đóng">
              ×
            </button>

            <div className="stats-modal__title">Thống kê bỏ phiếu</div>
            <div className="stats-modal__subtitle">Tổng số người đã vote: {totalVotes}</div>

            {statsLoading ? (
              <div className="stats-modal__loading">Đang tải...</div>
            ) : statsError ? (
              <div className="stats-modal__error">{statsError}</div>
            ) : (
              <div className={`stats-chart ${statsAnimate ? "stats-chart--animate" : ""}`}>
                <div className="stats-rows">
                  {statsRows.map((r) => (
                    <div className="stats-row" key={r.key}>
                      <div className="stats-row__head">
                        <div className="stats-row__label">{r.label}:</div>
                        <div className="stats-row__meta">
                          {r.votes} votes ({r.pct}%)
                        </div>
                      </div>
                      <div className="stats-row__barTrack" aria-hidden="true">
                        <div className="stats-row__barFill" style={{ ["--bar-w" as any]: `${r.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedVoter && (
        <div className="voter-modal__backdrop" role="presentation" onClick={close}>
          <div className="voter-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="voter-modal__close" onClick={close} aria-label="Đóng">
              ×
            </button>
            <div className="voter-modal__title">
              <div className="voter-modal__badge">{selectedVoter.name}</div>
              <div className="voter-modal__meta">
                {selectedVoter.age} tuổi • {selectedVoter.district}
              </div>
            </div>

            <div className="voter-modal__body">{selectedVoter.bio}</div>
            {voteError && <div className="voter-modal__error">{voteError}</div>}
            {walletHasVoted && <div className="voter-modal__error">Ví này đã vote rồi.</div>}

            <div className="voter-modal__actions">
              <button
                className="voter-modal__btn"
                onClick={vote}
                disabled={alreadyVoted || isVoting || !walletAddress || !isSupportedCandidate}
              >
                {!isSupportedCandidate ? "Chưa hỗ trợ" : alreadyVoted ? "Đã vote" : isVoting ? "Đang bỏ phiếu..." : "Vote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

