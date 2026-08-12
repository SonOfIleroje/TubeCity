<h1 align="center">TubeCity</h1>

<p align="center">
  <strong>Your YouTube channel, rendered as a living skyscraper in an explorable 3D city.</strong>
</p>

---

## What is TubeCity?

TubeCity turns YouTube channel analytics into a 3D data-visualization experience — every channel becomes a unique building in an explorable city. The bigger the channel, the taller and more detailed the building. Fly through the skyline and discover creators from around the world.

Built on top of the open-source [Git City](https://github.com/srizzon/git-city) concept (which does the same thing for GitHub profiles), reworked around the YouTube Data API and given a sponsorship-driven monetization model.

## Features

- **3D Buildings from Channel Data** — Building height, width, and window activity map to subscriber count, upload volume, and engagement
- **Free Flight Mode** — Fly through the city with smooth camera controls and explore the skyline
- **Channel Profile Pages** — Dedicated pages for each channel with stats and highlights
- **Sponsorship Placement Model** — A monetization system built directly into the visualization: Prime District placement, Brand Discovery Pro, and billboard ads
- **Compare Mode** — Put two channels side by side and compare their buildings and stats

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org) (App Router, Turbopack)
- **3D Engine:** [Three.js](https://threejs.org) via [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) + [drei](https://github.com/pmndrs/drei)
- **Database & Auth:** [Supabase](https://supabase.com) (PostgreSQL, Row Level Security)
- **Data:** [YouTube Data API v3](https://developers.google.com/youtube/v3)
- **Styling:** [Tailwind CSS](https://tailwindcss.com)
- **Hosting:** [Vercel](https://vercel.com)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/SonOfIleroje/TubeCity.git
cd TubeCity

# Install dependencies
npm install

# Set up environment variables

# Linux / macOS
cp .env.example .env.local

# Windows (Command Prompt)
copy .env.example .env.local

# Windows (PowerShell)
Copy-Item .env.example .env.local

# Fill in your environment variables

# Run the dev server
npm run dev
```

## Environment Setup

After copying `.env.example` to `.env.local`, fill in the required Supabase and YouTube Data API credentials — see `.env.example` for the full list.

## Credits & License

Forked from [Git City](https://github.com/srizzon/git-city) by [@samuelrizzondev](https://x.com/samuelrizzondev), used and modified under its [AGPL-3.0](LICENSE) license — any public deployment of this project must share its source code.

---

<p align="center">
  Built by Joseph "Blaze" Adomokhai — <a href="https://github.com/SonOfIleroje">@SonOfIleroje</a>
</p>
