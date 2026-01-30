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

##Why StencilJS?


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
