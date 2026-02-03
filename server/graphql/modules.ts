import { createApplication } from 'graphql-modules';
import { createSchema } from 'graphql-yoga';

// Simple schema definition
const typeDefs = `
  type Query {
    hello: String!
    health: String!
  }
`;

const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    health: () => 'OK',
  },
};

// Create the application instance
export const application = createApplication({
  modules: [],
  schemaBuilder: ({ typeDefs: td, resolvers: rs }) => 
    createSchema({
      typeDefs: td,
      resolvers: rs,
    }),
});

// Initialize with our schema
application.init({
  typeDefs,
  resolvers,
});