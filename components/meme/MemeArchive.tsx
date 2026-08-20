"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { memes } from "@/data/memes";
import type { MemeCategory } from "@/types/meme";
import { MemeCard } from "./MemeCard";

type Filter = "all" | MemeCategory;

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "reaction", label: "리액션" },
  { value: "daily", label: "일상" },
  { value: "work", label: "회사" },
  { value: "classic", label: "고전" },
];

export function MemeArchive() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const pagesBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const archiveHref = pagesBasePath ? `${pagesBasePath}/memes/` : "/memes";

  const visibleMemes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko");
    return memes.filter((meme) => {
      const matchesFilter = filter === "all" || meme.category === filter;
      const matchesQuery =
        normalized.length === 0 ||
        [meme.title, meme.description, ...meme.tags]
          .join(" ")
          .toLocaleLowerCase("ko")
          .includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);

  return (
    <main id="top" className="archive-shell">
      <header className="archive-header">
        <Link
          className="archive-brand"
          href={archiveHref}
          aria-label="Meme Archive 홈"
          onClick={(event) => {
            if (!pagesBasePath) return;
            event.preventDefault();
            window.location.assign(archiveHref);
          }}
        >
          <span className="archive-brand__mark">M</span>
          <span>
            MEME
            <br />
            ARCHIVE
          </span>
        </Link>
        <p className="archive-header__manifesto">
          유행은 지나가도
          <br />
          밈은 남습니다.
        </p>
        <div className="archive-header__issue">
          <span>ISSUE</span>
          <strong>001</strong>
        </div>
      </header>

      <section className="archive-hero" aria-labelledby="archive-title">
        <div>
          <p className="eyebrow eyebrow--dark">인터넷 웃음 보관소</p>
          <h1 id="archive-title">
            오늘도 인터넷은
            <br />
            <em>진지하지 않습니다.</em>
          </h1>
        </div>
        <p className="archive-hero__note">
          맥락 없이 봐도 웃기고,
          <br />
          맥락을 알면 더 웃긴 것들.
          <br />
          <span>현재 {memes.length}개 임시 소장 중</span>
        </p>
      </section>

      <section className="archive-tools" aria-label="밈 탐색 도구">
        <nav className="category-nav" aria-label="카테고리">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              className={filter === item.value ? "is-active" : ""}
              onClick={() => setFilter(item.value)}
              aria-pressed={filter === item.value}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <label className="archive-search">
          <span className="sr-only">밈 검색</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목이나 태그를 검색하세요"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">
              지우기
            </button>
          )}
        </label>
      </section>

      <div className="archive-result-line" aria-live="polite">
        <span>{String(visibleMemes.length).padStart(2, "0")} RESULTS</span>
        <span>SCROLL TO INVESTIGATE ↓</span>
      </div>

      {visibleMemes.length > 0 ? (
        <section className="meme-grid" aria-label="밈 목록">
          {visibleMemes.map((meme, index) => (
            <MemeCard key={meme.id} meme={meme} index={index} />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <span aria-hidden="true">¯\\_(ツ)_/¯</span>
          <h2>그 밈은 아직 수집 전입니다.</h2>
          <p>다른 검색어를 시도하거나 전체 카테고리로 돌아가 보세요.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            전체 아카이브 보기
          </button>
        </section>
      )}

      <footer className="archive-footer">
        <a href="#top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          맨 위로 ↑
        </a>
        <p>MEME ARCHIVE · MOCK COLLECTION · 2026</p>
      </footer>
    </main>
  );
}
