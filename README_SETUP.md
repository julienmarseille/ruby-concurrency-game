# Ruby Concurrency Game - Vite + Phaser 3 Setup

The project has been successfully initialized with a clean multi-file architecture using Vite as the bundler and Phaser 3 as the game framework.

## Project Structure

```
/
├── index.html                 # Main entry point
├── index.old.html             # Backup of original single-file game
├── package.json               # Dependencies (phaser, vite)
├── vite.config.js             # Vite configuration
│
├── src/
│   ├── main.js                # Entry point - initializes Phaser game
│   ├── style.css              # Dark theme styling for HTML panels
│   ├── config.js              # Game configuration & constants
│   ├── GameState.js           # Pure game logic (no DOM/Phaser)
│   │
│   ├── objects/
│   │   ├── ThreadCard.js      # Phaser Container for thread visualization
│   │   ├── PipeSystem.js      # Pipe animation system
│   │   └── TraceGraph.js      # Timeline trace visualization
│   │
│   ├── panels/
│   │   ├── QueuePanel.js      # Left panel - incoming requests
│   │   ├── InfoPanel.js       # Right panel - explanations & shop
│   │   └── StatsHeader.js     # Top header - stats display
│   │
│   └── scenes/
│       └── MainScene.js       # Main Phaser scene
│
└── dist/                      # Built output (created by npm run build)
```

## Available Scripts

```bash
npm run dev      # Start dev server at http://localhost:3000 (or next available port)
npm run build    # Build for production to dist/
npm run preview  # Preview production build locally
```

## Architecture

- **Pure Game Logic**: `GameState.js` contains all game mechanics (threads, queue, GVL, phases) with no dependencies on Phaser or DOM
- **Phaser Objects**: `ThreadCard`, `PipeSystem`, `TraceGraph` are reusable Phaser containers
- **HTML Panels**: `QueuePanel`, `InfoPanel`, `StatsHeader` manage DOM elements independently
- **Scene**: `MainScene` orchestrates everything in a Phaser scene

## Starting the Game

1. Run `npm run dev`
2. Open browser to displayed URL (default http://localhost:3001/)
3. Game initializes with "Phase 1 — No runtime" message
4. Free thread available to purchase

## Next Steps

- Add more request types (CPU-bound, I/O-bound patterns)
- Implement Phases 2+ (GVL contention visualization)
- Add Fibers and Ractors mechanics
- Enhance particle animations
- Add audio effects
