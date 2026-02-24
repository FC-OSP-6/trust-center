#CyQu Trust Center Prototype

##What is CYQU Trust Center?

Cyber Quotient Evaluation is a cybersecurity service provided by Aon Cyber Solutions.
Aon Cyber Solutions is a management consulting company that focuses on comprehensive cyber risk strategy. Their clients submit their product for a cyber risk assessment, then the service provides analytics on their cyber risk exposure. This service provides documents and answers to insurance questions for underwriting, sales, vendor reviews, and due diligence.
Currently this information is hard to retrieve and slow to process because the brokers have to ask the engineers to gather it for them. CYQU Trust Center is for brokers and clients to quickly and easily understand security information. This easy to use UI is where Security and Compliance answers will be readily available.

##MVP Checklist:

##Installation:

ENV:

Seed:

Run Server:

Step 1. Go to the root folder
Step 2. Run the command npm install to install dependencies
Step 3. Npm run dev to run the client and server concurrently.

##Tech Stack:

##Why GraphQL?

- Aligns with Aon's use of GraphQL, ensuring consistency with their tech stack
- Allows the frontend to request exactly the data it needs, preventing over and under fetching
- Uses a single endpoint with a schema that is strongly typed
- Makes nested and relational data easier to query in one request
- Improves frontend-backend collaboration through a shared schema contract

##Why StencilJS?

- Aligns with Aon's use of Stencil, maintaining consistency with their architecture
- Allows for more flexibility because the web components are framework-agnostic
- Separates component prensentation (Stencil) from component behavior (React)
- Compiles to optimized, standards-based browser components
- Includes strong TypeScript support out of the box
- Reduces long-term framework lock-in risk

##Why Flat Folder Rule?
--- Needs Review ---

- Enforces data integrity at the database level
- Defines clear structure and contstraints for all stored data
- Makes migrations versioned and predictable
- Prevents invalid data from entering the system
- Serves as documentation of the domain model
- Reduces reliance on application-layer validation alone

##Why DB schema approach?
--- Needs Review ---

- Enforces data integrity at the database level
- Defines clear structure and constraints for all stored data
- Makes migrations versioned and predictable
- Prevents invalid data from entering the system
- Serves as documentation of the domain model
- Reduces reliance on application-layer validation alone

##Why tests centralized in /testing?
--- Needs Review ---

- Keeps testing logic separate from production code
- Improves organization and discoverability of tests
- Makes shared fixtures and utilities easier to manage
- Supports scaling across unit, integration and end to end tests
- Reduces clutter in feature folders
- Encourages consistent testing patterns across the project

##Common Problems:

1.
2.
3.

##Repo Map:

Client, server, stencil, testing.

##Golden demo flow (draft):

## How to Run Locally

```bash
# Install dependencies
npm install

# Run both server and client concurrently
npm run dev
```

**Or run separately:**

```bash
# Terminal 1 - Start server only
npm run dev:server

# Terminal 2 - Start client only
npm run dev:client
```

**Verify:**

- Client runs at http://localhost:5173
- Server runs at http://localhost:4000
- Server logs "Server ready" in terminal
