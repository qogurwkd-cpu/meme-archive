import type { Meme } from "@/types/meme";

export function MemeCard({ meme, index }: { meme: Meme; index: number }) {
  return (
    <article className="meme-card" style={{ "--card-accent": meme.accent } as React.CSSProperties}>
      <div className="meme-card__visual" aria-label={`${meme.title} 이미지 자리`}>
        <span className="meme-card__number">#{String(index + 1).padStart(2, "0")}</span>
        <span className="meme-card__emoji" role="img" aria-label="">
          {meme.emoji}
        </span>
        <span className="meme-card__stamp">ARCHIVED</span>
      </div>
      <div className="meme-card__body">
        <p className="meme-card__category">{meme.category}</p>
        <h2>{meme.title}</h2>
        <p className="meme-card__description">{meme.description}</p>
        <ul className="meme-tags" aria-label="태그">
          {meme.tags.map((tag) => (
            <li key={tag}>#{tag}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
