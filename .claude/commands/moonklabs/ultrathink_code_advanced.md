# Ultra Think - 코드 심층사고 엔진 (/ultrathink_code_advanced 이 5000줄 클래스를 어떻게 분해할까?)

Activate Claude's maximum cognitive depth for code architecture decisions, complex implementation challenges, and discovering elegant solutions at the intersection of theory and practice.

## 🧠 Code Intelligence Framework

### Phase 0: Context Loading & Analysis

```yaml
Initialize:
  - Check for $ARGUMENTS presence
  - If empty: STOP and request clarification
  - Load current codebase context
  - Analyze existing patterns and conventions
  - Map dependency graph
  - Identify technical debt zones
  - Establish performance baselines
  - Scan for anti-patterns
```

### ⚠️ Argument Validation

```python
if not $ARGUMENTS or $ARGUMENTS.strip() == "":
    return """
    🛑 **Ultra Think requires a specific problem or question to analyze.**

    Please provide details about what you'd like me to think deeply about:

    Examples:
    - /ultrathink How should I refactor this authentication service?
    - /ultrathink What's the best way to handle rate limiting in our API?
    - /ultrathink Should we migrate from REST to GraphQL?
    - /ultrathink How to optimize this O(n²) algorithm?

    What specific code challenge would you like me to analyze?
    """
```

## 🌀 Deep Code Reasoning Protocol

### 1. **Problem Decomposition in Code Context**

```typescript
interface ProblemSpace {
  // Surface Layer
  symptom: "What error/issue is manifesting?";

  // Code Layer
  implementation: "What code structures are involved?";

  // Architecture Layer
  design: "What architectural decisions led here?";

  // Principle Layer
  paradigm: "What programming paradigms are at play?";

  // Meta Layer
  evolution: "How will this code need to evolve?";
}
```

**Analytical Questions:**

- What does the code want to be?
- What patterns is it trying to express?
- What constraints are real vs. assumed?
- What would the ideal solution look like if we had no legacy?
- What can we learn from how others solved this?

### 2. **Multi-Paradigm Code Analysis**

#### 🔍 Static Analysis Thinking

```python
def analyze_code_health():
    return {
        'complexity': cyclomatic_complexity_analysis(),
        'coupling': dependency_coupling_matrix(),
        'cohesion': module_cohesion_score(),
        'duplication': code_duplication_patterns(),
        'test_coverage': coverage_gap_analysis(),
        'performance': big_o_complexity_map(),
        'security': vulnerability_surface_analysis()
    }
```

#### 🏗️ Architectural Reasoning

- **Layered Architecture**: How do layers communicate?
- **Domain Boundaries**: Where are the natural seams?
- **Data Flow**: How does information propagate?
- **State Management**: Where does truth live?
- **Error Propagation**: How do failures cascade?

#### 🧬 Pattern Mining

```yaml
Identify Patterns:
  Creational:
    - Factory patterns needed?
    - Builder complexity warranted?
    - Singleton anti-patterns?

  Structural:
    - Adapter opportunities?
    - Facade simplifications?
    - Composite hierarchies?

  Behavioral:
    - Observer decoupling?
    - Strategy flexibility?
    - Command pattern undo/redo?

  Concurrent:
    - Actor model applicable?
    - Producer-consumer queues?
    - Lock-free algorithms possible?
```

### 3. **Solution Space Exploration**

#### 🎯 Implementation Strategies

**Strategy 1: Incremental Refactoring**

```javascript
// Preserve existing behavior while improving structure
const refactoringPath = [
  "Extract method for clarity",
  "Introduce parameter object",
  "Replace conditional with polymorphism",
  "Extract interface",
  "Dependency injection",
];
```

**Strategy 2: Parallel Implementation**

```python
# Build new alongside old
class LegacyImplementation:
    """Current working code"""
    pass

class NextGenImplementation:
    """Clean reimplementation"""
    pass

class FeatureToggle:
    """Gradual migration control"""
    pass
```

**Strategy 3: Abstraction Layer**

```rust
// Introduce abstraction to hide complexity
trait UnifiedInterface {
    fn execute(&self) -> Result<Output, Error>;
}

impl UnifiedInterface for ComplexSystemA { }
impl UnifiedInterface for ComplexSystemB { }
```

### 4. **Deep Technical Analysis**

#### ⚡ Performance Optimization Paths

```yaml
CPU Bound:
  - Algorithm complexity reduction
  - Parallelization opportunities
  - SIMD vectorization potential
  - Cache-friendly data structures

Memory Bound:
  - Memory pooling strategies
  - Lazy evaluation patterns
  - Streaming processing
  - Memory-mapped approaches

I/O Bound:
  - Async/await patterns
  - Connection pooling
  - Batch processing
  - Caching strategies
```

#### 🔐 Security Reasoning

```python
security_analysis = {
    'input_validation': boundary_check_completeness(),
    'authentication': auth_flow_vulnerabilities(),
    'authorization': permission_model_gaps(),
    'data_protection': encryption_coverage(),
    'injection_risks': sanitization_audit(),
    'timing_attacks': constant_time_operations()
}
```

#### 🧪 Testing Strategy Evolution

```typescript
interface TestingDimensions {
  unit: "Pure function isolation";
  integration: "Component interaction";
  contract: "API boundary verification";
  property: "Invariant maintenance";
  fuzzing: "Edge case discovery";
  mutation: "Test quality verification";
  performance: "Regression prevention";
}
```

### 5. **Code Quality Transcendence**

#### 📐 Elegance Metrics

- **Simplicity**: Can we remove code while adding functionality?
- **Orthogonality**: Are concerns properly separated?
- **Composability**: Do pieces combine naturally?
- **Readability**: Would a new developer understand immediately?
- **Extensibility**: How easy is adding new features?

#### 🌊 Flow State Code

```python
# Code that feels natural to write and modify
class FlowStateExample:
    """
    - Clear intent
    - Natural naming
    - Obvious structure
    - Minimal cognitive load
    - Self-documenting
    """
    def process(self, data: Data) -> Result:
        validated = self.validate(data)
        transformed = self.transform(validated)
        return self.persist(transformed)
```

### 6. **Advanced Code Patterns**

#### 🔄 Functional Composition

```haskell
-- Pure functions that compose naturally
processData = validate >=> transform >=> persist
  where
    validate = ...
    transform = ...
    persist = ...
```

#### 🎭 Type-Level Programming

```typescript
// Encode business rules in type system
type ValidatedUser<T> = T & { __validated: true };
type AuthorizedUser<T> = T & { __authorized: true };

function process<T>(user: ValidatedUser<AuthorizedUser<T>>) {
  // Compiler ensures user is validated AND authorized
}
```

#### 🌀 Reactive Patterns

```javascript
// Event-driven, responsive architecture
const userEvents$ = new Subject();

const processedUsers$ = userEvents$.pipe(
  filter(isValid),
  debounceTime(300),
  switchMap(fetchUserDetails),
  retry(3),
  shareReplay(1)
);
```

### 7. **Meta-Code Reasoning**

#### 🤔 Code Philosophy Questions

- Is this code expressing the domain naturally?
- Are we fighting the language or flowing with it?
- What would this look like in 10 lines? 100 lines? 1000 lines?
- How would we explain this to a junior? To a senior? To a non-programmer?
- What parts will definitely change? What parts are eternal?

#### 🧩 Cross-Pollination

```yaml
Borrow From:
  Gaming: "Entity-Component-System for flexibility"
  Databases: "Query optimization techniques"
  Compilers: "AST transformation patterns"
  OS Design: "Scheduling algorithms"
  Biology: "Self-healing systems"
  Physics: "Conservation laws in state management"
```

### 8. **Implementation Roadmap**

#### Phase 1: Immediate Wins

```bash
# Quick improvements with high impact
- Extract constants
- Add type hints
- Improve naming
- Add critical tests
- Document intent
```

#### Phase 2: Structural Improvements

```python
# Refactoring for better architecture
- Introduce interfaces
- Separate concerns
- Reduce coupling
- Increase cohesion
- Establish boundaries
```

#### Phase 3: Paradigm Shifts

```rust
// Fundamental reimagining
- New architecture
- Different paradigm
- Modern patterns
- Performance overhaul
- Future-proofing
```

### 9. **Output Format**

````markdown
# Ultra Think Analysis: [Code Challenge]

## 📊 Current State Assessment

- Code health metrics
- Technical debt quantification
- Performance bottlenecks
- Security vulnerabilities

## 🎯 Core Problem Identification

- Root cause (not symptoms)
- Systemic issues
- Architectural constraints

## 💡 Solution Strategies

### Option 1: [Minimal Refactor]

```[language]
// Code example
```
````

- Effort: Low
- Risk: Low
- Impact: Medium

### Option 2: [Architectural Shift]

```[language]
// Code example
```

- Effort: High
- Risk: Medium
- Impact: High

### Option 3: [Innovation Path]

```[language]
// Code example
```

- Effort: Medium
- Risk: High
- Impact: Transformative

## 🗺️ Implementation Plan

1. Week 1: [Specific tasks]
2. Week 2: [Specific tasks]
3. Week 3: [Specific tasks]

## ⚠️ Risk Mitigation

- Rollback strategy
- Feature flags
- Monitoring plan
- Performance benchmarks

## 📈 Success Metrics

- Performance improvement: X%
- Code complexity reduction: Y%
- Test coverage increase: Z%
- Developer velocity impact

## 🔮 Future Considerations

- Scalability path
- Maintenance strategy
- Evolution roadmap

````

### 10. **Activation Examples**

```bash
# Architecture decision
/ultrathink Should we use microservices or modular monolith for our e-commerce platform?

# Performance optimization
/ultrathink Our API response time is 800ms. How do we get it under 100ms?

# Refactoring strategy
/ultrathink This 5000-line class is unmaintainable. What's the best decomposition approach?

# Technology choice
/ultrathink React vs Vue vs Svelte for our new dashboard - considering our team's background?

# Design pattern application
/ultrathink How to implement undo/redo in our collaborative editor efficiently?

# Debugging complex issues
/ultrathink Random crashes in production but not in staging - systematic debugging approach?
````

## 🚀 Pro Tips

1. **Provide Context**: Include relevant code snippets, architecture diagrams, or performance metrics
2. **Specify Constraints**: Mention tech stack, team size, deadlines, backwards compatibility needs
3. **Share History**: What has been tried before? What failed? Why?
4. **Define Success**: What does "better" mean? Performance? Maintainability? Features?

## 🎓 Learning Integration

Ultra Think doesn't just solve - it teaches:

- Why certain patterns emerge
- When to apply specific solutions
- How to think about similar problems
- What to watch out for in the future

Remember: The best code often comes from deeply understanding the problem space, not just applying patterns. Ultra Think helps you see the forest AND the trees, finding elegant solutions that feel inevitable in hindsight.
