/* ================================
  TL;DR  -->  express bootstrap + routes

  - sets up express middleware
  - mounts /api/health and /graphql
================================ */
import express from 'express';
import cors from 'cors';


const app = express();
const SERVER_PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());


// Start server
app.listen(SERVER_PORT, () => {
  console.log('Server ready');
  
});