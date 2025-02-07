import express, { Request, Response } from 'express';
import condoRoutes from './routes/condo.routes';

const app = express();
const port = 3000;

app.use(express.json());
app.use(condoRoutes)

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});