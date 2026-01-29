/* ================================
  TL;DR  -->  express bootstrap + routes

  - sets up express middleware
  - mounts /api/health and /graphql
================================ */
import express from 'express';
import cors from 'cors';


const app = express();
const PORT = process.env.PORT || 4000;



// Start server
app.listen(PORT, () => {
  console.log('Server ready');
  
});