import express from 'express'
import { Router, Request, Response } from 'express'
import { CondoController } from '../controllers/condo.controller'

const app = express()
const route = Router()

const condoController = new CondoController()

route.get('/condo', async (req: Request, res: Response): Promise<any> => {
    try {
        const condos = await condoController.getAllCondos()
        return res.json(condos)
    } catch (error) {
        throw new Error('Erro ao buscar condominios')
    }
})

route.get('/condo/:id', async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params
        const condo = await condoController.getCondoByID(Number(id))
        return res.json(condo)
    } catch (error) {
        throw new Error('Erro ao buscar condominio por ID')
    }
})

route.get('/condo/:name', async (req: Request, res: Response): Promise<any> => {
    try {
        const { name } = req.params
        const condo = await condoController.getCondoByName(name)
        return res.json(condo)
    } catch (error) {
        throw new Error('Erro ao buscar condominio por ID')
    }
})

route.post('/condo', async (req: Request, res: Response): Promise<any> => {
    try {
        const condo = await condoController.getCondoByID(req.body)
        return res.json(condo)
    } catch (error) {
        throw new Error('Erro ao cadastrar condominio')
    }
})

route.put('/condo/:id', async (req: Request, res: Response): Promise<any> => {
    try {
        const condo = await condoController.updateCondo(req.body)
        return res.json(condo)
    } catch (error) {
        throw new Error('Erro ao atualizar condominio')
    }
})

route.delete('/condo/:id', async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params
        const condo = await condoController.deleteCondoByID(Number(id))
        return res.json(condo)
    } catch (error) {
        throw new Error('Erro ao excluir condominio por ID')
    }
})

route.delete('/condo/:name', async (req: Request, res: Response): Promise<any> => {
    try {
        const { name } = req.params
        const condo = await condoController.deleteCondoByName(name)
        return res.json(condo)
    } catch (error) {
        throw new Error('Erro ao excluir condominio por nome')
    }
})

app.use(route)