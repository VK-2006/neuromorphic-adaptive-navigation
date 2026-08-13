# Ant Colony Optimization

Each candidate has distance, traffic-adjusted time, traffic delay, risk/safety, familiarity and historical safety. ACO initializes pheromones, lets multiple ants probabilistically explore routes using pheromone and utility heuristics, deposits utility-based pheromone, evaporates it and repeats for configurable iterations. Final utility combines base weighted utility and normalized pheromone/ACO score.
