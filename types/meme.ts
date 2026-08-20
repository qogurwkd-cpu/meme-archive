export type MemeCategory = "reaction" | "daily" | "work" | "classic";

export type Meme = {
  id: string;
  title: string;
  description: string;
  origin?: string;
  usage?: string;
  image?: string;
  tags: string[];
  category: MemeCategory;
  emoji: string;
  accent: string;
  createdAt?: string;
};
