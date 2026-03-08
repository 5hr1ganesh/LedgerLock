FROM oven/bun:latest

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install

# Copy source
COPY . .

# Setup CRE 
RUN ./node_modules/.bin/cre-setup

# Path for the cre binary (Setup usually installs to ~/.cre/bin)
ENV PATH="/root/.cre/bin:${PATH}"

# Command to run the workflow in actual "execution" mode
CMD ["bun", "run", "start"]
