# Meme Archive

장난스러운 입구와 짧은 미니 게임을 지나 인터넷 밈 컬렉션을 둘러보는 웹 프로젝트입니다.

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm ci
npm run dev
```

## 검증

```bash
npm run typecheck
npm run lint
npm test
```

## GitHub Pages

`main` 브랜치에 변경 사항이 올라오면 GitHub Actions가 정적 사이트를 빌드하고 Pages에 배포합니다. 저장소의 **Settings → Pages → Build and deployment**에서 소스를 **GitHub Actions**로 설정해야 합니다.

이 프로젝트는 GitHub 프로젝트 사이트의 하위 경로를 빌드 시 자동으로 적용하며, `/`, `/game/`, `/memes/`를 각각 정적 HTML로 생성합니다.
