"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MetaMaskConnect from "@/components/metamask-connect";

export default function DappPage() {
  const expRef = useRef<{ dispose: () => void; vote: (id: string) => Promise<void> } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(() => new Set());
  const [isVoting, setIsVoting] = useState(false);

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

  const close = () => {
    if (isVoting) return;
    setSelectedId(null);
  };

  const vote = async () => {
    if (!selectedId || hasVoted || isVoting) return;
    setIsVoting(true);
    try {
      await expRef.current?.vote?.(selectedId);
    } catch {
      setIsVoting(false);
    }
  };

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
          <MetaMaskConnect />
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

            <div className="voter-modal__actions">
              <button className="voter-modal__btn" onClick={vote} disabled={hasVoted || isVoting}>
                {hasVoted ? "Đã vote" : isVoting ? "Đang bỏ phiếu..." : "Vote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

