import express from 'express'
import { Router, Request, Response } from 'express'

const app = express()
const route = Router()


route.get('/house', (req: Request, res: Response) => {
    res.send('Hello house')
})

route.get('/house/:id', (req: Request, res: Response) => {
    res.send('Hello house')
})

route.post('/house', (req: Request, res: Response) => {
    res.send('Hello house')
})

route.put('/house/:id', (req: Request, res: Response) => {
    res.send('Hello house')
})

route.delete('/house/:id', (req: Request, res: Response) => {
    res.send('Hello house')
})

app.use(route)