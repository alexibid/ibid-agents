# Monitor

The desktop dashboard of ibid-agents. It only observes: nothing here sends a prompt.

## What it shows

| Screen | Shows |
| --- | --- |
| Pedidos | Every prompt, with its date, tokens, share of the 5-hour and weekly limits, and tool. "Ver mais" opens the agents that prompt invoked; clicking an agent opens what it was asked and what it returned |
| Telemetria | Tokens per day and tool, the agents called most, and the LangGraph steps with their failures and average time |
| Erros | Failures of prompts, agents and LangGraph steps, filtered by origin and text |
| Memória | The notes the archivist keeps; empty search lists what is still to be done |

The strip at the top and the menu bar item show the 5-hour and weekly limits of both tools.

## Parts

| Part | Where | Does |
| --- | --- | --- |
| Database | `../database/` | PostgreSQL in Docker, on `127.0.0.1:54329` |
| Monitor service | `../langgraph/src/monitor.ts` | Reads the conversation records and the limits, and serves `http://127.0.0.1:4710` |
| Dashboard | `src/` | Angular, signals, one gateway to the service |
| Desktop shell | `src-tauri/` | Starts the monitor service, opens the window, owns the menu bar item |

## Commands

| Command | Does |
| --- | --- |
| `node ../database/start.mjs` | Creates the database settings once and starts the container |
| `npm run build` in `../langgraph` | Builds the monitor service the application starts |
| `npm run desktop:build` | Builds `ibid agents.app` under `src-tauri/target/release/bundle/macos/` |
| `npm run desktop` | Runs the application against the development server |
| `npm start` | Serves the dashboard alone on port 4711; the monitor service must be running |
| `npm test` | Runs the unit tests once |

The application is built for this machine: the paths of Node and of the monitor service are
fixed when it is built. Build it again after moving the repository or changing Node.

## Layers

`domain/` holds types and pure functions. `application/` holds the gateway contract and the
signal stores. `infrastructure/` holds the HTTP gateway and the menu bar. `ui/` holds atoms,
molecules, organisms and pages; native `button`, `input`, `select` and `dialog` exist only
inside atoms.
