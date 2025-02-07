import express from 'express'
import { Router, Request, Response } from 'express'

const app = express()
const route = Router()


route.get('/order', (req: Request, res: Response) => {
    res.send('Hello order')
})

route.get('/order/:id', (req: Request, res: Response) => {
    res.send('Hello order')
})

route.post('/order', (req: Request, res: Response) => {
    res.send('Hello order')
})

route.put('/order/:id', (req: Request, res: Response) => {
    res.send('Hello order')
})

route.delete('/order/:id', (req: Request, res: Response) => {
    res.send('Hello order')
})

app.use(route)