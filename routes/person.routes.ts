import express from 'express'
import { Router, Request, Response } from 'express'

const app = express()
const route = Router()


route.get('/person', (req: Request, res: Response) => {
    res.send('Hello Person')
})

route.get('/person/:id', (req: Request, res: Response) => {
    res.send('Hello Person')
})

route.post('/person', (req: Request, res: Response) => {
    res.send('Hello Person')
})

route.put('/person/:id', (req: Request, res: Response) => {
    res.send('Hello Person')
})

route.delete('/person/:id', (req: Request, res: Response) => {
    res.send('Hello Person')
})

app.use(route)