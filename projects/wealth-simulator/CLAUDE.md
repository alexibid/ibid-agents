# Engineering & Architecture Standards

## 1. Clean Code & Naming Conventions (Strict)
- **Three-Word Limit**: Every identifier (variable, function, method, class, interface, type, or property) MUST contain a maximum of 3 words (e.g., `computeTargetValue`, `QuotePort`, `StockStrategy`, `liveQuote$`). Identifiers with 4 or more words are strictly forbidden.
- **Zero Inline Comments**: NEVER write inline comments (`//` or `/* */`) inside function, method, or constructor bodies. If logic requires explanation, extract it into a private method with a self-explanatory name (up to 3 words).
- **JSDoc Declarations Only**: Place English JSDoc comments (`/** ... */`) strictly above `class`, `interface`, `type`, and `method` declarations.
- **English Only**: Write all code, identifiers, JSDoc blocks, unit test descriptions, and commit messages in English.
- **Method Hygiene**: Enforce Single Responsibility. Keep methods under 15 lines, use guard clauses instead of nested `if/else` blocks, and never pass boolean flag parameters.

## 2. Explicit OOP, SOLID & Design Patterns
- **Domain Purity**: Classes and interfaces inside `core/domain/` must be pure TypeScript OOP with zero Angular, RxJS, or third-party framework imports.
- **Strategy Pattern (OCP)**: Encapsulate interchangeable business algorithms behind a `[Name]Strategy` interface. Never use `switch` or `if/else` chains to branch business calculations.
- **Ports & Adapters (DIP & ISP)**:
  - Define granular contracts in `core/ports/[name].port.ts` alongside an `InjectionToken`.
  - Implement external integrations (HTTP APIs, AI models, storage) in `core/adapters/[name].adapter.ts`.
  - Adapters must map external DTOs into pure domain models before returning data.
- **Composite Pattern (Tree & LSP)**: Model hierarchical domain structures using an abstract base `Node` class, a terminal `Leaf` class, and a recursive `Group` class that aggregates child operations transparently.
- **Facade Pattern**: Isolate state management behind `core/facades/[name].facade.ts`. UI components must NEVER inject NgRx `Store`, dispatch actions directly, or import selectors.

## 3. Modern Angular & Reactive State Boundaries
- **Component Standards**: All components must be `standalone: true`, enforce `ChangeDetectionStrategy.OnPush`, use `inject()` for dependency injection, and use Signal primitives (`input()`, `output()`, `computed()`).
- **Pragmatic NgRx vs. RxJS**:
  - **NgRx Store**: Use strictly for persistent domain state, user commands, and transactional state transitions.
  - **RxJS Streams**: Use strictly for real-time polling, asynchronous event coordination (`switchMap`, `combineLatest`, `retry`, `shareReplay`), and ephemeral data streams. Do not dispatch high-frequency polling ticks into the NgRx Store.
- **Subscription Safety**: Never use manual `.subscribe()` in components unless paired with `takeUntilDestroyed()`. Prefer exposing streams as Angular Signals via `toSignal()` inside the Facade.

## 4. Testing Mandate
- **Mandatory Specs**: Every generated class, strategy, adapter, facade, stream, reducer, and component MUST have a companion `.spec.ts` file.
- **Isolation**: Test domain classes and strategies with zero Angular TestBed overhead. Test adapters, facades, and components by mocking Port `InjectionToken` providers.

## 5. Reference Code Template

```typescript
/**
 * Contract for calculating asset exit metrics.
 */
export interface ExitStrategy {
  /**
   * Computes target metrics from simulation parameters.
   */
  computeExit(input: SimulationInput): SimulationResult;
}

/**
 * Equity exit calculation with flat broker fees.
 */
export class StockStrategy implements ExitStrategy {
  /**
   * Computes share count and target sell price.
   */
  computeExit(input: SimulationInput): SimulationResult {
    const netCapital = this.deductFee(input.investedAmount, input.brokerFee);
    const sharesCount = netCapital / input.buyPrice;
    const targetGross = this.computeGrossTarget(input);

    return {
      sharesCount,
      targetSellPrice: targetGross / sharesCount,
      grossValue: targetGross,
      netProfit: input.targetProfit,
    };
  }

  /**
   * Deducts broker fee from capital amount.
   */
  private deductFee(capital: number, fee: number): number {
    return Math.max(0, capital - fee);
  }

  /**
   * Computes required gross value after tax.
   */
  private computeGrossTarget(input: SimulationInput): number {
    const grossProfit = input.targetProfit / (1 - input.taxRate);
    return input.investedAmount + grossProfit + input.brokerFee;
  }
}
