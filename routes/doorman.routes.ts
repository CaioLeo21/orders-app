import express from 'express'
import { Router, Request, Response } from 'express'

const app = express()
const route = Router()


route.get('/doorman', (req: Request, res: Response) => {
    res.send('Hello doorman')
})

route.get('/doorman/:id', (req: Request, res: Response) => {
    res.send('Hello doorman')
})

route.post('/doorman', (req: Request, res: Response) => {
    res.send('Hello doorman')
})

route.put('/doorman/:id', (req: Request, res: Response) => {
    res.send('Hello doorman')
})

route.delete('/doorman/:id', (req: Request, res: Response) => {
    res.send('Hello doorman')
})

app.use(route)