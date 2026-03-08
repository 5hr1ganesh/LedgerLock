# Build Stage
FROM oven/bun:latest as builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install

# Copy source
COPY . .

# Setup CRE (This installs the binary to /root/.cre/bin)
# Note: In a real DON, this environment would be pre-configured.
# For Railway, we ensure the binary is available.
RUN bun x cre-setup

# Final Stage
FROM oven/bun:latest

WORKDIR /app

# Copy from builder
COPY --from=builder /app /app
COPY --from=builder /root/.cre /root/.cre

# Ensure .env is available (In production, use Railway Variables instead)
# ENV CRE_ETH_PRIVATE_KEY=...
# ENV CRE_TARGET=staging-settings

# Path for the cre binary
ENV PATH="/root/.cre/bin:${PATH}"

# Command to run the workflow in actual "execution" mode
# Using 'run' instead of 'simulate' keeps the engine alive.
CMD ["cre", "workflow", "run", "./", "--target", "staging-settings"]
